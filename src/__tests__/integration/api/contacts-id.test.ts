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

import { GET, DELETE } from "@/app/api/contacts/[id]/route";
import { mockPrisma } from "../../utils/mockPrisma";

describe("/api/contacts/[id]", () => {
  const params = { id: "contact_123" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/contacts/contact_123");
      const res = await GET(req, { params });
      expect(res.status).toBe(401);
    });

    it("should return a contact when found", async () => {
      mockPrisma.contact.findFirst.mockResolvedValueOnce({
        id: "contact_123", name: "John Doe", phoneNumber: "+1234567890",
        email: "john@example.com", userId: "user_123", contactListId: null,
        createdAt: new Date(), updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/contacts/contact_123");
      const res = await GET(req, { params });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe("contact_123");
      expect(data.name).toBe("John Doe");
    });

    it("should return 404 when contact not found", async () => {
      mockPrisma.contact.findFirst.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/contacts/nonexistent");
      const res = await GET(req, { params: { id: "nonexistent" } });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Contact not found" });
    });

    it("should call prisma with both id and userId filter", async () => {
      mockPrisma.contact.findFirst.mockResolvedValueOnce({ id: "contact_123" });

      const req = new Request("http://localhost/api/contacts/contact_123");
      await GET(req, { params });

      expect(mockPrisma.contact.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "contact_123", userId: "user_123" } })
      );
    });
  });

  describe("DELETE", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/contacts/contact_123", { method: "DELETE" });
      const res = await DELETE(req, { params });
      expect(res.status).toBe(401);
    });

    it("should delete a contact successfully", async () => {
      mockPrisma.contact.findFirst.mockResolvedValueOnce({
        id: "contact_123", name: "John Doe", userId: "user_123",
      });
      mockPrisma.contact.delete.mockResolvedValueOnce({ id: "contact_123" });

      const req = new Request("http://localhost/api/contacts/contact_123", { method: "DELETE" });
      const res = await DELETE(req, { params });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(mockPrisma.contact.delete).toHaveBeenCalledWith({ where: { id: "contact_123" } });
    });

    it("should return 404 when contact not found", async () => {
      mockPrisma.contact.findFirst.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/contacts/nonexistent", { method: "DELETE" });
      const res = await DELETE(req, { params: { id: "nonexistent" } });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Contact not found" });
    });
  });
});
