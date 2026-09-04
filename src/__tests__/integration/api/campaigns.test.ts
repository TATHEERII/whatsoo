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

import { GET, POST } from "@/app/api/campaigns/route";
import { mockPrisma } from "../../utils/mockPrisma";

describe("/api/campaigns", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/campaigns");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("should return campaigns for authenticated user", async () => {
      mockPrisma.campaign.findMany.mockResolvedValueOnce([
        {
          id: "camp_1", name: "Summer Sale", description: "Sale campaign",
          status: "running", templateName: "Promo",
          contactList: { name: "VIP Customers" },
          scheduledAt: null, createdAt: new Date(), updatedAt: new Date(),
        },
        {
          id: "camp_2", name: "Welcome Series", description: null,
          status: "draft", templateName: null,
          contactList: { name: "Subscribers" },
          scheduledAt: null, createdAt: new Date(), updatedAt: new Date(),
        },
      ]);

      const req = new Request("http://localhost/api/campaigns");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        id: "camp_1", name: "Summer Sale", description: "Sale campaign",
        status: "running", templateName: "Promo", contactListName: "VIP Customers",
      });
      expect(data[1]).toMatchObject({
        id: "camp_2", name: "Welcome Series", description: null,
        status: "draft", contactListName: "Subscribers",
      });
    });

    it("should return empty array when user has no campaigns", async () => {
      mockPrisma.campaign.findMany.mockResolvedValueOnce([]);

      const req = new Request("http://localhost/api/campaigns");
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("should return null contactListName when contact list is null", async () => {
      mockPrisma.campaign.findMany.mockResolvedValueOnce([
        {
          id: "camp_1", name: "No List", description: null, status: "draft",
          templateName: null, contactList: null,
          scheduledAt: null, createdAt: new Date(), updatedAt: new Date(),
        },
      ]);

      const req = new Request("http://localhost/api/campaigns");
      const res = await GET(req);
      const data = await res.json();
      expect(data[0].contactListName).toBeNull();
    });

    it("should call prisma with userId filter and orderBy", async () => {
      mockPrisma.campaign.findMany.mockResolvedValueOnce([]);

      const req = new Request("http://localhost/api/campaigns");
      await GET(req);

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user_123" },
          orderBy: { createdAt: "desc" },
        })
      );
    });
  });

  describe("POST", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Campaign" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("should create a campaign with minimum required fields", async () => {
      mockPrisma.contactList.findFirst.mockResolvedValueOnce({
        id: "list_1", name: "Test List", userId: "user_123",
      });
      mockPrisma.campaign.create.mockResolvedValueOnce({
        id: "camp_123", name: "Test Campaign", description: null, message: "Hello!",
        status: "draft", templateName: null, contactList: null,
        scheduledAt: null, createdAt: new Date(), updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Campaign", contactListId: "list_1", message: "Hello!" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe("Test Campaign");
      expect(data.status).toBe("draft");
    });

    it("should return 400 for missing name", async () => {
      const req = new Request("http://localhost/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello!" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Name is required" });
    });

    it("should return 400 for empty name", async () => {
      const req = new Request("http://localhost/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", message: "Hello!" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("should return 400 for whitespace-only name", async () => {
      const req = new Request("http://localhost/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   ", message: "Hello!" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("should return 400 for non-string name", async () => {
      const req = new Request("http://localhost/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 123, message: "Hello!" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("should return 404 when contactListId does not exist", async () => {
      mockPrisma.contactList.findFirst.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", contactListId: "nonexistent" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Contact list not found" });
    });

    it("should create campaign with all fields when contactListId is valid", async () => {
      mockPrisma.contactList.findFirst.mockResolvedValueOnce({
        id: "list_1", name: "Valid List", userId: "user_123",
      });
      mockPrisma.campaign.create.mockResolvedValueOnce({
        id: "camp_456", name: "Full Campaign", description: "A description",
        message: "Hello {name}!", status: "draft", templateId: "tpl_1",
        templateName: "Promo", contactList: { name: "Valid List" },
        scheduledAt: new Date("2024-12-01"), createdAt: new Date(), updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Full Campaign", description: "A description",
          message: "Hello {name}!", templateId: "tpl_1", templateName: "Promo",
          contactListId: "list_1", scheduledAt: "2024-12-01T10:00:00Z",
          delayType: "random", delayValue: 10000, maxAttempts: 5,
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe("Full Campaign");
      expect(data.description).toBe("A description");
    });

    it("should use default delay values when not provided", async () => {
      mockPrisma.campaign.create.mockResolvedValueOnce({
        id: "camp_789", name: "Defaults", description: null, message: "Hi",
        status: "draft", templateName: null, contactList: null,
        scheduledAt: null, createdAt: new Date(), updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Defaults", message: "Hi" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(mockPrisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ delayType: "fixed", delayValue: 5000, maxAttempts: 3 }),
        })
      );
    });

    it("should trim name, description, and message", async () => {
      mockPrisma.campaign.create.mockResolvedValueOnce({
        id: "camp_001", name: "Trimmed", description: "Desc", message: "Hi",
        status: "draft", templateName: null, contactList: null,
        scheduledAt: null, createdAt: new Date(), updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "  Trimmed  ", description: "  Desc  ", message: "  Hi  " }),
      });
      await POST(req);

      expect(mockPrisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "Trimmed", description: "Desc", message: "Hi" }),
        })
      );
    });

    it("should set description and message to null when undefined", async () => {
      mockPrisma.campaign.create.mockResolvedValueOnce({
        id: "camp_002", name: "Minimal", description: null, message: null,
        status: "draft", templateName: null, contactList: null,
        scheduledAt: null, createdAt: new Date(), updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Minimal" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(mockPrisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: null, message: null }),
        })
      );
    });
  });
});
