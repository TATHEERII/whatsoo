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

import { GET, POST } from "@/app/api/contacts/route";
import { mockPrisma } from "../../utils/mockPrisma";

describe("/api/contacts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/contacts");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("should return contacts for authenticated user", async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([
        { id: "c1", name: "John", phoneNumber: "+123", email: "john@test.com", userId: "user_123", contactListId: null, createdAt: new Date(), updatedAt: new Date() },
        { id: "c2", name: "Jane", phoneNumber: "+456", email: null, userId: "user_123", contactListId: null, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const req = new Request("http://localhost/api/contacts");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("John");
    });

    it("should call prisma with userId filter", async () => {
      mockPrisma.contact.findMany.mockResolvedValueOnce([]);

      const req = new Request("http://localhost/api/contacts");
      await GET(req);

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user_123" }, orderBy: { createdAt: "desc" } })
      );
    });
  });

  describe("POST", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/contacts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("should create a contact with all fields", async () => {
      mockPrisma.contact.create.mockResolvedValueOnce({
        id: "contact_1", name: "John Doe", phoneNumber: "+1234567890",
        email: "john@example.com", userId: "user_123", contactListId: "list_1",
        createdAt: new Date(), updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/contacts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "John Doe", phoneNumber: "+1234567890",
          email: "john@example.com", contactListId: "list_1",
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe("John Doe");
      expect(data.phoneNumber).toBe("+1234567890");
    });

    it("should return 400 when name is missing", async () => {
      const req = new Request("http://localhost/api/contacts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: "+123" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Name is required" });
    });
  });
});
