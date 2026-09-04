import { POST } from "@/app/api/whatsapp/disconnect/route";
import { mockSession } from "../../utils/mockAuth";
import {
  createMockEngineClient,
  mockDisconnectResponse,
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

describe("/api/whatsapp/disconnect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/whatsapp/disconnect", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should disconnect with clearSession=true by default", async () => {
    mockEngine.disconnect.mockResolvedValueOnce(mockDisconnectResponse);

    const req = new Request("http://localhost/api/whatsapp/disconnect", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockEngine.disconnect).toHaveBeenCalledWith(true);
  });

  it("should disconnect with clearSession=false when specified", async () => {
    mockEngine.disconnect.mockResolvedValueOnce(mockDisconnectResponse);

    const req = new Request("http://localhost/api/whatsapp/disconnect", {
      method: "POST",
      body: JSON.stringify({ clearSession: false }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockEngine.disconnect).toHaveBeenCalledWith(false);
  });

  it("should handle disconnect errors gracefully", async () => {
    const { EngineClientError } = require("@/lib/whatsapp/engine-client");
    mockEngine.disconnect.mockRejectedValueOnce(
      new EngineClientError("Disconnect failed", 500)
    );

    const req = new Request("http://localhost/api/whatsapp/disconnect", { method: "POST" });
    const res = await POST(req);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Disconnect failed");
  });

  it("should handle disconnect errors without status", async () => {
    const { EngineClientError } = require("@/lib/whatsapp/engine-client");
    mockEngine.disconnect.mockRejectedValueOnce(
      new EngineClientError("Failed to disconnect")
    );

    const req = new Request("http://localhost/api/whatsapp/disconnect", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(502);
  });
});
