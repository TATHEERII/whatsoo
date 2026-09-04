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

import { GET, POST } from "@/app/api/templates/route";
import { mockPrisma } from "../../utils/mockPrisma";

describe("/api/templates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/templates");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("should return templates for authenticated user", async () => {
      mockPrisma.template.findMany.mockResolvedValueOnce([
        { id: "t1", name: "Promo", body: "Hello {name}", userId: "user_123", createdAt: new Date(), updatedAt: new Date() },
        { id: "t2", name: "Welcome", body: "Welcome!", userId: "user_123", createdAt: new Date(), updatedAt: new Date() },
      ]);

      const req = new Request("http://localhost/api/templates");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("Promo");
    });

    it("should call prisma with userId filter", async () => {
      mockPrisma.template.findMany.mockResolvedValueOnce([]);

      const req = new Request("http://localhost/api/templates");
      await GET(req);

      expect(mockPrisma.template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user_123" }, orderBy: { createdAt: "desc" } })
      );
    });
  });

  describe("POST", () => {
    it("should return 401 when not authenticated", async () => {
      const { auth } = require("@/auth");
      auth.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test", body: "Hello" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("should create a template successfully", async () => {
      mockPrisma.template.create.mockResolvedValueOnce({
        id: "template_123", name: "Promo", body: "Hello {name}!",
        userId: "user_123", createdAt: new Date(), updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Promo", body: "Hello {name}!" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe("Promo");
      expect(data.body).toBe("Hello {name}!");
    });

    it("should return 400 when name is missing", async () => {
      const req = new Request("http://localhost/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Hello" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Name is required" });
    });

    it("should return 400 when body is missing", async () => {
      const req = new Request("http://localhost/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Promo" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Template body is required" });
    });

    it("should return 400 when name is empty string", async () => {
      const req = new Request("http://localhost/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", body: "Hello" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("should return 400 when body is empty string", async () => {
      const req = new Request("http://localhost/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Promo", body: "" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Template body is required" });
    });

    it("should trim whitespace from name", async () => {
      mockPrisma.template.create.mockResolvedValueOnce({
        id: "t1", name: "Trimmed", body: "Hello", userId: "user_123",
        createdAt: new Date(), updatedAt: new Date(),
      });

      const req = new Request("http://localhost/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "  Trimmed  ", body: "Hello" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(mockPrisma.template.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: "Trimmed" }) })
      );
    });
  });
});
