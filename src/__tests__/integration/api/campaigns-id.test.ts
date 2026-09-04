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

import { GET } from "@/app/api/campaigns/[id]/route";
import { mockPrisma } from "../../utils/mockPrisma";

describe("/api/campaigns/[id]", () => {
  const params = { id: "camp_123" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/campaigns/camp_123");
      const res = await GET(req, { params });
      expect(res.status).toBe(401);
    });

    it("should return campaign details with stats", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Summer Sale", description: "A great campaign", status: "running",
        templateName: "Promo", contactList: { id: "list_1", name: "VIP", _count: { contacts: 100 } },
        scheduledAt: new Date("2024-06-01"), createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-02"),
      });
      mockPrisma.campaignLog.groupBy.mockResolvedValueOnce([
        { status: "sent", _count: { _all: 50 } },
        { status: "failed", _count: { _all: 10 } },
      ]);
      mockPrisma.jobQueue.groupBy.mockResolvedValueOnce([
        { status: "pending", _count: { _all: 20 } },
        { status: "processing", _count: { _all: 5 } },
        { status: "completed", _count: { _all: 5 } },
      ]);

      const req = new Request("http://localhost/api/campaigns/camp_123");
      const res = await GET(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("camp_123");
      expect(data.name).toBe("Summer Sale");
      expect(data.stats.totalContacts).toBe(100);
      expect(data.stats.sent).toBe(50);
      expect(data.stats.failed).toBe(10);
      expect(data.stats.pending).toBe(25);
      expect(data.stats.successRate).toBe("83.3%");
    });

    it("should return 404 when campaign not found", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/campaigns/nonexistent");
      const res = await GET(req, { params: { id: "nonexistent" } });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Campaign not found" });
    });

    it("should calculate success rate as 0.0 when no logs exist", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Test", description: null, status: "draft",
        templateName: null, contactList: { id: "list_1", name: "Test", _count: { contacts: 0 } },
        scheduledAt: null, createdAt: new Date(), updatedAt: new Date(),
      });
      mockPrisma.campaignLog.groupBy.mockResolvedValueOnce([]);
      mockPrisma.jobQueue.groupBy.mockResolvedValueOnce([]);

      const req = new Request("http://localhost/api/campaigns/camp_123");
      const res = await GET(req, { params });
      const data = await res.json();
      expect(data.stats.successRate).toBe("0.0%");
      expect(data.stats.sent).toBe(0);
      expect(data.stats.failed).toBe(0);
      expect(data.stats.pending).toBe(0);
    });

    it("should calculate pending as sum of pending and processing jobs", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Test", description: null, status: "running",
        templateName: null, contactList: { id: "list_1", name: "Test", _count: { contacts: 30 } },
        scheduledAt: null, createdAt: new Date(), updatedAt: new Date(),
      });
      mockPrisma.campaignLog.groupBy.mockResolvedValueOnce([
        { status: "sent", _count: { _all: 10 } },
      ]);
      mockPrisma.jobQueue.groupBy.mockResolvedValueOnce([
        { status: "pending", _count: { _all: 8 } },
        { status: "processing", _count: { _all: 7 } },
      ]);

      const req = new Request("http://localhost/api/campaigns/camp_123");
      const res = await GET(req, { params });
      const data = await res.json();
      expect(data.stats.pending).toBe(15);
    });

    it("should calculate success rate correctly", async () => {
      mockPrisma.campaign.findFirst.mockResolvedValueOnce({
        id: "camp_123", name: "Test", description: null, status: "running",
        templateName: null, contactList: { id: "list_1", name: "Test", _count: { contacts: 10 } },
        scheduledAt: null, createdAt: new Date(), updatedAt: new Date(),
      });
      mockPrisma.campaignLog.groupBy.mockResolvedValueOnce([
        { status: "sent", _count: { _all: 8 } },
        { status: "failed", _count: { _all: 2 } },
      ]);
      mockPrisma.jobQueue.groupBy.mockResolvedValueOnce([]);

      const req = new Request("http://localhost/api/campaigns/camp_123");
      const res = await GET(req, { params });
      const data = await res.json();
      expect(data.stats.successRate).toBe("80.0%");
    });
  });
});
