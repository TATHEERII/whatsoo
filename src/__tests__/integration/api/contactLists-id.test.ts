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

import { DELETE } from "@/app/api/contact-lists/[id]/route";
import { mockPrisma } from "../../utils/mockPrisma";

describe("/api/contact-lists/[id]", () => {
  const params = { id: "list_123" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("DELETE", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/contact-lists/list_123", { method: "DELETE" });
      const res = await DELETE(req, { params });
      expect(res.status).toBe(401);
    });

    it("should delete a contact list successfully", async () => {
      mockPrisma.contactList.findFirst.mockResolvedValueOnce({
        id: "list_123", name: "Test List", userId: "user_123",
      });
      mockPrisma.contactList.delete.mockResolvedValueOnce({ id: "list_123" });

      const req = new Request("http://localhost/api/contact-lists/list_123", { method: "DELETE" });
      const res = await DELETE(req, { params });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(mockPrisma.contactList.delete).toHaveBeenCalledWith({ where: { id: "list_123" } });
    });

    it("should return 404 when contact list does not exist", async () => {
      mockPrisma.contactList.findFirst.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/contact-lists/nonexistent", { method: "DELETE" });
      const res = await DELETE(req, { params: { id: "nonexistent" } });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Contact list not found" });
    });

    it("should not delete another user's contact list", async () => {
      mockPrisma.contactList.findFirst.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/contact-lists/list_123", { method: "DELETE" });
      const res = await DELETE(req, { params });
      expect(res.status).toBe(404);
    });

    it("should return 500 when ensureUser fails", async () => {
      const ensureUser = require("@/lib/ensureUser").ensureUser as jest.Mock;
      ensureUser.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/contact-lists/list_123", { method: "DELETE" });
      const res = await DELETE(req, { params });
      expect(res.status).toBe(500);
    });
  });
});
