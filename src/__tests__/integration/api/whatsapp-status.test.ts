import { GET } from "@/app/api/whatsapp/status/route";
import { mockSession } from "../../utils/mockAuth";
import {
  createMockEngineClient,
  mockStatusResponse,
  mockReadyStatusResponse,
  mockQrStatusResponse,
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

jest.mock("qrcode", () => ({
  toDataURL: jest.fn(async () => "data:image/png;base64,fake-qr-data"),
}));

describe("/api/whatsapp/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/whatsapp/status");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("should return engine status with QR when available", async () => {
    mockEngine.status.mockResolvedValueOnce(mockQrStatusResponse);

    const req = new Request("http://localhost/api/whatsapp/status");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ready).toBe(false);
    expect(data.state).toBe("QR_READY");
    expect(data.qr).toBe("data:image/png;base64,fake-qr-data");
    expect(data.phoneNumber).toBeNull();
    expect(data.initializing).toBe(false);
  });

  it("should return ready status when engine is connected", async () => {
    mockEngine.status.mockResolvedValueOnce(mockReadyStatusResponse);

    const req = new Request("http://localhost/api/whatsapp/status");
    const res = await GET(req);
    const data = await res.json();
    expect(data.ready).toBe(true);
    expect(data.state).toBe("CONNECTED");
    expect(data.qr).toBeNull();
    expect(data.phoneNumber).toBe("14155550123");
  });

  it("should return UNLAUNCHED state when engine is unreachable", async () => {
    const { EngineClientError } = require("@/lib/whatsapp/engine-client");
    mockEngine.status.mockRejectedValueOnce(
      new EngineClientError("connect ECONNREFUSED 127.0.0.1:3001")
    );

    const req = new Request("http://localhost/api/whatsapp/status");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ready).toBe(false);
    expect(data.state).toBe("UNLAUNCHED");
    expect(data.qr).toBeNull();
    expect(data.error).toContain("WhatsApp engine unreachable");
  });

  it("should return 502 when engine returns an error with status", async () => {
    const { EngineClientError } = require("@/lib/whatsapp/engine-client");
    mockEngine.status.mockRejectedValueOnce(
      new EngineClientError("Internal error", 500)
    );

    const req = new Request("http://localhost/api/whatsapp/status");
    const res = await GET(req);
    expect(res.status).toBe(502);
  });

  it("should return UNLAUNCHED with error from default status", async () => {
    mockEngine.status.mockResolvedValueOnce(mockStatusResponse);

    const req = new Request("http://localhost/api/whatsapp/status");
    const res = await GET(req);
    const data = await res.json();
    expect(data.state).toBe("UNLAUNCHED");
    expect(data.ready).toBe(false);
    expect(data.qr).toBeNull();
  });

  it("should call engine.status() and return initializing flag", async () => {
    mockEngine.status.mockResolvedValueOnce({
      ready: false,
      state: "INITIALIZING",
      qr: null,
      phoneNumber: null,
      error: null,
      initializing: true,
    });

    const req = new Request("http://localhost/api/whatsapp/status");
    const res = await GET(req);
    const data = await res.json();
    expect(data.initializing).toBe(true);
  });
});
