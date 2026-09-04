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

import { POST } from "@/app/api/campaigns/[id]/control/route";
import { mockPrisma } from "../../utils/mockPrisma";

describe("/api/campaigns/[id]/control", () => {
  const params = { id: "camp_123" };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSqliteQueue.enqueueCampaign.mockReset();
    mockSqliteQueue.enqueueCampaign.mockImplementation(async () => 5);
  });

  it("should return 401 when not authenticated", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/campaigns/camp_123/control", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it("should return 404 when campaign not found", async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/campaigns/camp_123/control", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause" }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Campaign not found" });
  });

    it("should return 400 when action is missing", async () => {
      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Invalid action. Must be one of: start, pause, resume, stop",
    });
  });

    it("should return 400 when action is invalid", async () => {
      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  describe("start action", () => {
    it("should start a draft campaign", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Draft Camp", status: "draft",
      });
      mockPrisma.campaign.update.mockResolvedValueOnce({
        id: "camp_123", name: "Draft Camp", status: "running", updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ status: "running" });
      expect(mockSqliteQueue.startScheduler).toHaveBeenCalled();
    });

    it("should start a stopped campaign", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Stopped Camp", status: "stopped",
      });
      mockPrisma.campaign.update.mockResolvedValueOnce({
        id: "camp_123", name: "Stopped Camp", status: "running", updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(200);
    });

    it("should return 400 when starting a running campaign", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Running", status: "running",
      });

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining("Cannot start") });
    });

    it("should return 400 when starting a paused campaign", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Paused", status: "paused",
      });

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(400);
    });

    it("should return 400 when contact list is empty", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Empty", status: "draft",
      });
      mockSqliteQueue.enqueueCampaign.mockResolvedValueOnce(0);

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("No contacts");
    });

    it("should return 400 when enqueue fails", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Test", status: "draft",
      });
      mockSqliteQueue.enqueueCampaign.mockRejectedValueOnce(new Error("Failed to enqueue"));

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Failed to enqueue" });
    });

    it("should return 400 when starting a completed campaign", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Done", status: "completed",
      });

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(400);
    });
  });

  describe("pause action", () => {
    it("should pause a running campaign", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Running", status: "running",
      });
      mockPrisma.campaign.update.mockResolvedValueOnce({
        id: "camp_123", name: "Running", status: "paused", updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ status: "paused" });
    });

    it("should return 400 when pause is called on draft campaign", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Draft", status: "draft",
      });

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(400);
    });
  });

  describe("resume action", () => {
    it("should resume a paused campaign", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Paused", status: "paused",
      });
      mockPrisma.campaign.update.mockResolvedValueOnce({
        id: "camp_123", name: "Paused", status: "running", updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ status: "running" });
    });

    it("should return 400 when resume is called on a draft campaign", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Draft", status: "draft",
      });

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(400);
    });
  });

  describe("stop action", () => {
    it("should stop a running campaign", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Running", status: "running",
      });
      mockPrisma.campaign.update.mockResolvedValueOnce({
        id: "camp_123", name: "Running", status: "stopped", updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ status: "stopped" });
    });

    it("should stop a paused campaign", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Paused", status: "paused",
      });
      mockPrisma.campaign.update.mockResolvedValueOnce({
        id: "camp_123", name: "Paused", status: "stopped", updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(200);
    });

    it("should return 400 when stop is called on draft campaign", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Draft", status: "draft",
      });

      const req = new Request("http://localhost/api/campaigns/camp_123/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const res = await POST(req, { params });
      expect(res.status).toBe(400);
    });
  });
});
