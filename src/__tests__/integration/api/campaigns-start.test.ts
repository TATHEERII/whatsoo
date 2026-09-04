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

const mockSqliteQueue = {
  startScheduler: jest.fn(),
  enqueueCampaign: jest.fn(async () => 5),
  triggerProcessing: jest.fn(async () => {}),
  stopScheduler: jest.fn(),
  processPendingJobs: jest.fn(async () => {}),
  getQueueStats: jest.fn(async () => ({ pending: 0, processing: 0, completed: 0, failed: 0, total: 0 })),
};

jest.mock("@/lib/sqliteQueue", () => ({
  getSqliteQueueService: jest.fn(() => mockSqliteQueue),
}));

import { POST } from "@/app/api/campaigns/[id]/start/route";
import { mockPrisma } from "../../utils/mockPrisma";

describe("/api/campaigns/[id]/start", () => {
  const params = { id: "camp_123" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/campaigns/camp_123/start", { method: "POST" });
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it("should return 404 when campaign not found", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/campaigns/camp_123/start", { method: "POST" });
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Campaign not found" });
  });

  it("should return 400 when campaign is already running", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({
      id: "camp_123", name: "Running", status: "running",
    });

    const req = new Request("http://localhost/api/campaigns/camp_123/start", { method: "POST" });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Cannot start campaign from status 'running'",
    });
  });

  it("should return 400 when campaign is already completed", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({
      id: "camp_123", name: "Done", status: "completed",
    });

    const req = new Request("http://localhost/api/campaigns/camp_123/start", { method: "POST" });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it("should start a draft campaign successfully", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({
      id: "camp_123", name: "Draft Camp", status: "draft",
      delayType: "fixed", delayValue: 5000, maxAttempts: 3,
    });
    mockPrisma.campaign.update.mockResolvedValueOnce({
      id: "camp_123", name: "Draft Camp", status: "running",
      scheduledAt: null, updatedAt: new Date(),
    });

    const req = new Request("http://localhost/api/campaigns/camp_123/start", { method: "POST" });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("running");
    expect(mockSqliteQueue.startScheduler).toHaveBeenCalled();
    expect(mockSqliteQueue.enqueueCampaign).toHaveBeenCalled();
    expect(mockSqliteQueue.triggerProcessing).toHaveBeenCalled();
  });

  it("should start a stopped campaign successfully", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({
      id: "camp_123", name: "Stopped Camp", status: "stopped",
    });
    mockPrisma.campaign.update.mockResolvedValueOnce({
      id: "camp_123", name: "Stopped Camp", status: "running",
      scheduledAt: null, updatedAt: new Date(),
    });

    const req = new Request("http://localhost/api/campaigns/camp_123/start", { method: "POST" });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "running" });
  });

  it("should pass scheduling params when provided", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({
      id: "camp_123", name: "Scheduled Camp", status: "draft",
      delayType: "fixed", delayValue: 5000, maxAttempts: 3,
    });
    mockPrisma.campaign.update.mockResolvedValueOnce({
      id: "camp_123", name: "Scheduled Camp", status: "running",
      scheduledAt: new Date("2024-12-01T10:00:00Z"), updatedAt: new Date(),
    });

    const req = new Request("http://localhost/api/campaigns/camp_123/start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledAt: "2024-12-01T10:00:00Z",
        delayType: "random", delayValue: 10000, maxAttempts: 5,
      }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    expect(mockSqliteQueue.enqueueCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "camp_123", delayType: "random", delayValue: 10000, maxAttempts: 5,
      })
    );
  });

  it("should return 500 when ensureUser fails", async () => {
    const ensureUser = require("@/lib/ensureUser").ensureUser as jest.Mock;
    ensureUser.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/campaigns/camp_123/start", { method: "POST" });
    const res = await POST(req, { params });
    expect(res.status).toBe(500);
  });
});
