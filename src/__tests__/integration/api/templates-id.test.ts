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

import { DELETE } from "@/app/api/templates/[id]/route";
import { mockPrisma } from "../../utils/mockPrisma";

describe("/api/templates/[id]", () => {
  const params = { id: "template_123" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("DELETE", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/templates/template_123", { method: "DELETE" });
      const res = await DELETE(req, { params });
      expect(res.status).toBe(401);
    });

    it("should delete a template successfully", async () => {
      mockPrisma.template.findFirst.mockResolvedValueOnce({
        id: "template_123", name: "Promo", userId: "user_123",
      });
      mockPrisma.template.delete.mockResolvedValueOnce({ id: "template_123" });

      const req = new Request("http://localhost/api/templates/template_123", { method: "DELETE" });
      const res = await DELETE(req, { params });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(mockPrisma.template.delete).toHaveBeenCalledWith({ where: { id: "template_123" } });
    });

    it("should return 404 when template not found", async () => {
      mockPrisma.template.findFirst.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/templates/nonexistent", { method: "DELETE" });
      const res = await DELETE(req, { params: { id: "nonexistent" } });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Template not found" });
    });
  });
});
