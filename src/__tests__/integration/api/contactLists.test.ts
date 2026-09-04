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

import { GET, POST } from "@/app/api/contact-lists/route";
import { mockPrisma } from "../../utils/mockPrisma";

describe("/api/contact-lists", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/contact-lists");
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });

    it("should return contact lists for authenticated user", async () => {
      mockPrisma.contactList.findMany.mockResolvedValueOnce([
        {
          id: "list_1", name: "VIP Customers", description: "Top tier customers",
          _count: { contacts: 42 }, createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-02"),
        },
        {
          id: "list_2", name: "Newsletter Subscribers", description: null,
          _count: { contacts: 100 }, createdAt: new Date("2024-01-03"), updatedAt: new Date("2024-01-03"),
        },
      ]);

      const req = new Request("http://localhost/api/contact-lists");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        id: "list_1", name: "VIP Customers", description: "Top tier customers", contactCount: 42,
      });
      expect(data[1]).toMatchObject({
        id: "list_2", name: "Newsletter Subscribers", description: null, contactCount: 100,
      });
    });

    it("should return empty array when user has no contact lists", async () => {
      mockPrisma.contactList.findMany.mockResolvedValueOnce([]);
      const req = new Request("http://localhost/api/contact-lists");
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    it("should return 500 when ensureUser fails", async () => {
      const ensureUser = require("@/lib/ensureUser").ensureUser as jest.Mock;
      ensureUser.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/contact-lists");
      const res = await GET(req);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to sync user" });
    });
  });

  describe("POST", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/contact-lists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test List" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("should create a contact list with name only", async () => {
      mockPrisma.contactList.create.mockResolvedValueOnce({
        id: "list_123", name: "Test List", description: null,
        _count: { contacts: 0 }, createdAt: new Date(), updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/contact-lists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test List" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toMatchObject({
        id: "list_123", name: "Test List", description: null, contactCount: 0,
      });
    });

    it("should create a contact list with description", async () => {
      mockPrisma.contactList.create.mockResolvedValueOnce({
        id: "list_456", name: "Clients", description: "Important clients",
        _count: { contacts: 0 }, createdAt: new Date(), updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/contact-lists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Clients", description: "Important clients" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe("Clients");
      expect(data.description).toBe("Important clients");
    });

    it("should trim whitespace from name", async () => {
      mockPrisma.contactList.create.mockResolvedValueOnce({
        id: "list_789", name: "Trimmed List", description: null,
        _count: { contacts: 0 }, createdAt: new Date(), updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/contact-lists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "  Trimmed List  " }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(mockPrisma.contactList.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: "Trimmed List" }) })
      );
    });

    it("should return 400 when name is missing", async () => {
      const req = new Request("http://localhost/api/contact-lists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "No name" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Name is required" });
    });

    it("should return 400 when name is empty string", async () => {
      const req = new Request("http://localhost/api/contact-lists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Name is required" });
    });

    it("should return 400 when name is only whitespace", async () => {
      const req = new Request("http://localhost/api/contact-lists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Name is required" });
    });

    it("should return 400 when name is not a string", async () => {
      const req = new Request("http://localhost/api/contact-lists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 123 }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("should trim description whitespace", async () => {
      mockPrisma.contactList.create.mockResolvedValueOnce({
        id: "list_001", name: "Test", description: "Desc",
        _count: { contacts: 0 }, createdAt: new Date(), updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/contact-lists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", description: "  Desc  " }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(mockPrisma.contactList.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ description: "Desc" }) })
      );
    });
  });

  describe("GET prisma calls", () => {
    it("should call prisma.contactList.findMany with userId filter", async () => {
      mockPrisma.contactList.findMany.mockResolvedValueOnce([]);

      const req = new Request("http://localhost/api/contact-lists");
      await GET(req);

      expect(mockPrisma.contactList.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user_123" },
          orderBy: { createdAt: "desc" },
        })
      );
    });
  });
});
