import {
  WhatsAppEngineClient,
  EngineClientError,
  SendPayload,
  EngineStatus,
} from "@/lib/whatsapp/engine-client";

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

function createMockResponse<T>(data: T, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("WhatsAppEngineClient", () => {
  let client: WhatsAppEngineClient;

  beforeEach(() => {
    mockFetch.mockClear();
    client = new WhatsAppEngineClient({
      baseUrl: "http://localhost:3001",
      token: "test-token",
    });
  });

  describe("constructor", () => {
    it("should use provided baseUrl and token", () => {
      const c = new WhatsAppEngineClient({
        baseUrl: "http://custom:9999",
        token: "my-token",
      });
      expect(c).toBeDefined();
    });

    it("should use env vars when options not provided", () => {
      const c = new WhatsAppEngineClient();
      expect(c).toBeDefined();
    });

    it("should use default URL when env not set", () => {
      const originalUrl = process.env.WHATSAPP_ENGINE_URL;
      const originalToken = process.env.WHATSAPP_ENGINE_TOKEN;
      delete process.env.WHATSAPP_ENGINE_URL;
      delete process.env.WHATSAPP_ENGINE_TOKEN;

      const c = new WhatsAppEngineClient();
      expect(c).toBeDefined();

      // Restore env
      if (originalUrl) process.env.WHATSAPP_ENGINE_URL = originalUrl;
      if (originalToken) process.env.WHATSAPP_ENGINE_TOKEN = originalToken;
    });
  });

  describe("health", () => {
    it("should return health status on 200", async () => {
      const data = { ok: true, uptime: 12345.67 };
      mockFetch.mockResolvedValueOnce(createMockResponse(data));

      const result = await client.health();
      expect(result).toEqual({ ok: true, uptime: 12345.67 });
    });

    it("should throw EngineClientError on non-200 response", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: "Service unavailable" }, { status: 503 })
      );

      await expect(client.health()).rejects.toThrow(EngineClientError);
    });

    it("should throw EngineClientError when fetch fails", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(client.health()).rejects.toThrow(EngineClientError);
      await expect(client.health()).rejects.toThrow(/unreachable/);
    });
  });

  describe("status", () => {
    it("should return engine status on 200", async () => {
      const data: EngineStatus = {
        ready: true,
        state: "CONNECTED",
        qr: null,
        phoneNumber: "14155550123",
        error: null,
        initializing: false,
      };
      mockFetch.mockResolvedValueOnce(createMockResponse(data));

      const result = await client.status();
      expect(result).toEqual(data);
    });

    it("should return status with QR code", async () => {
      const data: EngineStatus = {
        ready: false,
        state: "QR_READY",
        qr: "some-qr-data",
        phoneNumber: null,
        error: null,
        initializing: false,
      };
      mockFetch.mockResolvedValueOnce(createMockResponse(data));

      const result = await client.status();
      expect(result.qr).toBe("some-qr-data");
      expect(result.ready).toBe(false);
    });

    it("should include Authorization header when token is set", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ ready: false, state: "UNLAUNCHED", qr: null, phoneNumber: null, error: null })
      );

      await client.status();
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/status",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should NOT include Authorization header when token is empty", async () => {
      const c = new WhatsAppEngineClient({
        baseUrl: "http://localhost:3001",
        token: "",
      });
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ ready: false, state: "UNLAUNCHED", qr: null, phoneNumber: null, error: null })
      );

      await c.status();
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/status",
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.anything(),
          }),
        })
      );
    });
  });

  describe("connect", () => {
    it("should call POST /connect", async () => {
      const data = { success: true, message: "Initializing WhatsApp..." };
      mockFetch.mockResolvedValueOnce(createMockResponse(data));

      const result = await client.connect();
      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/connect",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should use 30s timeout", async () => {
      const data = { success: true, message: "WhatsApp connected" };
      mockFetch.mockResolvedValueOnce(createMockResponse(data));

      await client.connect();
      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs?.signal).toBeDefined();
    });

    it("should throw on 502", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: "Missing Chromium" }, { status: 502 })
      );

      await expect(client.connect()).rejects.toThrow(EngineClientError);
    });
  });

  describe("reconnect", () => {
    it("should call POST /reconnect", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      const result = await client.reconnect();
      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/reconnect",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should throw on 502", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: "Failed" }, { status: 502 })
      );

      await expect(client.reconnect()).rejects.toThrow(EngineClientError);
    });
  });

  describe("disconnect", () => {
    it("should call POST /disconnect with clearSession", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      const result = await client.disconnect(true);
      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/disconnect",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ clearSession: true }),
        })
      );
    });

    it("should call POST /disconnect with clearSession false", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      await client.disconnect(false);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/disconnect",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ clearSession: false }),
        })
      );
    });
  });

  describe("send", () => {
    it("should call POST /send with text payload", async () => {
      const payload: SendPayload = { to: "+1234567890", text: "Hello!" };
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      const result = await client.send(payload);
      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/send",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(payload),
        })
      );
    });

    it("should call POST /send with filePath and mediaType", async () => {
      const payload: SendPayload = {
        to: "+1234567890",
        filePath: "/path/to/image.png",
        mediaType: "image",
      };
      mockFetch.mockResolvedValueOnce(createMockResponse({ success: true }));

      const result = await client.send(payload);
      expect(result).toEqual({ success: true });
    });
  });

  describe("getEngineClient singleton", () => {
    it("should return a cached instance", () => {
      const { getEngineClient } = require("@/lib/whatsapp/engine-client");
      const instance1 = getEngineClient();
      const instance2 = getEngineClient();
      expect(instance1).toBe(instance2);
    });
  });

  describe("EngineClientError", () => {
    it("should set name and message", () => {
      const err = new EngineClientError("Something went wrong");
      expect(err.name).toBe("EngineClientError");
      expect(err.message).toBe("Something went wrong");
      expect(err.status).toBeUndefined();
    });

    it("should set status when provided", () => {
      const err = new EngineClientError("Bad request", 400);
      expect(err.status).toBe(400);
    });
  });

  describe("request error handling", () => {
    it("should parse error message from JSON response", async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: "Custom error message" }, { status: 400 })
      );

      await expect(client.health()).rejects.toThrow("Custom error message");
    });

    it("should fall back to statusText when JSON has no error field", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Bad Request", { status: 400, statusText: "Bad Request" })
      );

      await expect(client.health()).rejects.toThrow("Bad Request");
    });

    it("should use default error message on parse failure", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 500, statusText: "Internal Server Error" })
      );

      await expect(client.health()).rejects.toThrow();
    });
  });
});
