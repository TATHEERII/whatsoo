jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: require("../../utils/mockPrisma").mockPrisma,
}));

jest.mock("@/lib/ensureUser", () => ({
  ensureUser: jest.fn(async () => "user_123"),
}));

jest.mock("@/auth", () => ({
  auth: jest.fn(async () => require("../../utils/mockAuth").mockSession),
  handlers: { GET: jest.fn(), POST: jest.fn() },
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

import { GET } from "@/app/api/campaigns/[id]/logs/route";
import { mockPrisma } from "../../utils/mockPrisma";

describe("/api/campaigns/[id]/logs", () => {
  const params = { id: "camp_123" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/campaigns/camp_123/logs");
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
  });

  it("should return 404 when campaign not found", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/campaigns/nonexistent/logs");
    const res = await GET(req, { params: { id: "nonexistent" } });
    expect(res.status).toBe(404);
  });

  it("should return unified logs from both campaignLog and jobQueue", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({ id: "camp_123", name: "Test" });
    mockPrisma.campaignLog.findMany.mockResolvedValueOnce([
      { id: "log_1", recipient: "+123", status: "sent", messageId: "msg_1", error: null, sentAt: new Date("2024-01-02T10:00:00Z") },
      { id: "log_2", recipient: "+456", status: "failed", messageId: null, error: "Blocked", sentAt: new Date("2024-01-01T10:00:00Z") },
    ]);
    mockPrisma.jobQueue.findMany.mockResolvedValueOnce([
      {
        id: "job_1", recipient: "+789", recipientName: "Charlie", status: "pending",
        error: null, scheduledAt: new Date("2024-01-03T10:00:00Z"),
        processedAt: null, completedAt: null, attempts: 0, maxAttempts: 3,
      },
    ]);
    mockPrisma.campaignLog.count.mockResolvedValueOnce(2);
    mockPrisma.jobQueue.count.mockResolvedValueOnce(1);

    const req = new Request("http://localhost/api/campaigns/camp_123/logs?limit=50");
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.logs).toHaveLength(3);
    expect(data.logs.some((l: { source: string }) => l.source === "log")).toBe(true);
    expect(data.logs.some((l: { source: string }) => l.source === "job")).toBe(true);

    const jobEntry = data.logs.find((l: { source: string; id: string }) => l.source === "job" && l.id === "job_1");
    expect(jobEntry.recipientName).toBe("Charlie");

    const logEntry = data.logs.find((l: { source: string; id: string }) => l.source === "log" && l.id === "log_1");
    expect(logEntry.messageId).toBe("msg_1");
  });

  it("should return empty logs when no entries exist", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({ id: "camp_123" });
    mockPrisma.campaignLog.findMany.mockResolvedValueOnce([]);
    mockPrisma.jobQueue.findMany.mockResolvedValueOnce([]);
    mockPrisma.campaignLog.count.mockResolvedValueOnce(0);
    mockPrisma.jobQueue.count.mockResolvedValueOnce(0);

    const req = new Request("http://localhost/api/campaigns/camp_123/logs");
    const res = await GET(req, { params });
    const data = await res.json();
    expect(data.logs).toEqual([]);
    expect(data.pagination.total).toBe(0);
  });

  it("should support pagination with page and limit", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({ id: "camp_123" });
    mockPrisma.campaignLog.findMany.mockResolvedValueOnce([]);
    mockPrisma.jobQueue.findMany.mockResolvedValueOnce([]);
    mockPrisma.campaignLog.count.mockResolvedValueOnce(50);
    mockPrisma.jobQueue.count.mockResolvedValueOnce(50);

    const req = new Request("http://localhost/api/campaigns/camp_123/logs?page=2&limit=10");
    const res = await GET(req, { params });
    const data = await res.json();
    expect(data.pagination.page).toBe(2);
    expect(data.pagination.limit).toBe(10);
    expect(data.pagination.totalPages).toBe(10);
  });

  it("should sort unified logs by timestamp (newest first)", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({ id: "camp_123" });
    mockPrisma.campaignLog.findMany.mockResolvedValueOnce([
      { id: "log_1", recipient: "+123", status: "sent", messageId: null, error: null, sentAt: new Date("2024-01-01T10:00:00Z") },
    ]);
    mockPrisma.jobQueue.findMany.mockResolvedValueOnce([
      {
        id: "job_1", recipient: "+456", recipientName: null, status: "pending",
        error: null, scheduledAt: new Date("2024-01-02T10:00:00Z"),
        processedAt: null, completedAt: null, attempts: 0, maxAttempts: 3,
      },
    ]);
    mockPrisma.campaignLog.count.mockResolvedValueOnce(1);
    mockPrisma.jobQueue.count.mockResolvedValueOnce(1);

    const req = new Request("http://localhost/api/campaigns/camp_123/logs?limit=10");
    const res = await GET(req, { params });
    const data = await res.json();
    expect(data.logs[0].timestamp).toBe("2024-01-02T10:00:00.000Z");
    expect(data.logs[1].timestamp).toBe("2024-01-01T10:00:00.000Z");
  });

  it("should use default pagination when not specified", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({ id: "camp_123" });
    mockPrisma.campaignLog.findMany.mockResolvedValueOnce([]);
    mockPrisma.jobQueue.findMany.mockResolvedValueOnce([]);
    mockPrisma.campaignLog.count.mockResolvedValueOnce(0);
    mockPrisma.jobQueue.count.mockResolvedValueOnce(0);

    const req = new Request("http://localhost/api/campaigns/camp_123/logs");
    const res = await GET(req, { params });
    const data = await res.json();
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(50);
  });
});
