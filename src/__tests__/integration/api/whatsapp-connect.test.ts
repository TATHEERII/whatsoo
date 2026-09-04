import { POST } from "@/app/api/whatsapp/connect/route";
import { mockSession } from "../../utils/mockAuth";
import {
  createMockEngineClient,
  mockConnectResponse,
} from "../../utils/mockEngineClient";

jest.mock("@/auth", () => ({
  auth: jest.fn(async () => mockSession),
  handlers: { GET: jest.fn(), POST: jest.fn() },
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

const mockEngine = createMockEngineClient();
jest.mock("@/lib/whatsapp/engine-client", () => ({
  getEngineClient: jest.fn(() => mockEngine),
  EngineClientError: class EngineClientError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.name = "EngineClientError";
      this.status = status;
    }
  },
}));

describe("/api/whatsapp/connect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/whatsapp/connect", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return success when engine connects", async () => {
    mockEngine.connect.mockResolvedValueOnce(mockConnectResponse);

    const req = new Request("http://localhost/api/whatsapp/connect", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe("Initializing WhatsApp...");
    expect(mockEngine.connect).toHaveBeenCalled();
  });

  it("should return 502 when engine returns success: false", async () => {
    mockEngine.connect.mockResolvedValueOnce({ success: false, error: "Init failed" });

    const req = new Request("http://localhost/api/whatsapp/connect", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Init failed");
  });

  it("should return 502 when engine.connect throws EngineClientError", async () => {
    const { EngineClientError } = require("@/lib/whatsapp/engine-client");
    mockEngine.connect.mockRejectedValueOnce(
      new EngineClientError("Engine unreachable", 502)
    );

    const req = new Request("http://localhost/api/whatsapp/connect", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Engine unreachable");
  });

  it("should return 502 when engine.connect throws without status", async () => {
    const { EngineClientError } = require("@/lib/whatsapp/engine-client");
    mockEngine.connect.mockRejectedValueOnce(
      new EngineClientError("Unknown error")
    );

    const req = new Request("http://localhost/api/whatsapp/connect", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(502);
  });
});
