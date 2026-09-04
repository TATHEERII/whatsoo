import { POST } from "@/app/api/whatsapp/reconnect/route";
import { mockSession } from "../../utils/mockAuth";
import {
  createMockEngineClient,
  mockReconnectResponse,
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

describe("/api/whatsapp/reconnect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/whatsapp/reconnect", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return success when engine reconnects", async () => {
    mockEngine.reconnect.mockResolvedValueOnce(mockReconnectResponse);

    const req = new Request("http://localhost/api/whatsapp/reconnect", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe("Reconnecting WhatsApp...");
    expect(mockEngine.reconnect).toHaveBeenCalled();
  });

  it("should return 502 when engine returns success: false", async () => {
    mockEngine.reconnect.mockResolvedValueOnce({ success: false });

    const req = new Request("http://localhost/api/whatsapp/reconnect", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Failed to reconnect WhatsApp");
  });

  it("should return 502 when engine.reconnect throws", async () => {
    const { EngineClientError } = require("@/lib/whatsapp/engine-client");
    mockEngine.reconnect.mockRejectedValueOnce(
      new EngineClientError("Engine unreachable", 502)
    );

    const req = new Request("http://localhost/api/whatsapp/reconnect", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Engine unreachable");
  });
});
