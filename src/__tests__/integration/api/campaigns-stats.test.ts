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

import { GET } from "@/app/api/campaigns/[id]/stats/route";
import { mockPrisma } from "../../utils/mockPrisma";

describe("/api/campaigns/[id]/stats", () => {
  const params = { id: "camp_123" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/campaigns/camp_123/stats");
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
  });

  it("should return 404 when campaign not found", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/campaigns/nonexistent/stats");
    const res = await GET(req, { params: { id: "nonexistent" } });
    expect(res.status).toBe(404);
  });

  it("should return stats with logs and pagination", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({ id: "camp_123", name: "Test" });
    mockPrisma.campaignLog.count
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(50);
    mockPrisma.jobQueue.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(50);
    mockPrisma.campaignLog.findMany.mockResolvedValueOnce([
      { id: "log_1", recipient: "+123", status: "sent", messageId: "msg_1", error: null, sentAt: new Date("2024-01-01") },
      { id: "log_2", recipient: "+456", status: "failed", messageId: null, error: "Blocked", sentAt: new Date("2024-01-02") },
    ]);

    const req = new Request("http://localhost/api/campaigns/camp_123/stats");
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stats.totalContacts).toBe(50);
    expect(data.stats.sent).toBe(30);
    expect(data.stats.failed).toBe(10);
    expect(data.stats.pending).toBe(8);
    expect(data.stats.successRate).toBe("60.0%");
    expect(data.logs).toHaveLength(2);
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(50);
  });

  it("should support custom pagination params", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({ id: "camp_123" });
    mockPrisma.campaignLog.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(100);
    mockPrisma.jobQueue.count
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(100);
    mockPrisma.campaignLog.findMany.mockResolvedValueOnce([]);

    const req = new Request("http://localhost/api/campaigns/camp_123/stats?page=3&limit=20");
    const res = await GET(req, { params });
    const data = await res.json();
    expect(data.pagination.page).toBe(3);
    expect(data.pagination.limit).toBe(20);
    expect(data.pagination.totalPages).toBe(5);
    expect(mockPrisma.campaignLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 })
    );
  });

  it("should calculate success rate as 0.0 when no logs", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({ id: "camp_123" });
    mockPrisma.campaignLog.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.jobQueue.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.campaignLog.findMany.mockResolvedValueOnce([]);

    const req = new Request("http://localhost/api/campaigns/camp_123/stats");
    const res = await GET(req, { params });
    const data = await res.json();
    expect(data.stats.successRate).toBe("0.0%");
  });

  it("should use default page and limit when not specified", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({ id: "camp_123" });
    mockPrisma.campaignLog.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.jobQueue.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.campaignLog.findMany.mockResolvedValueOnce([]);

    const req = new Request("http://localhost/api/campaigns/camp_123/stats");
    const res = await GET(req, { params });
    const data = await res.json();
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(50);
  });
});
