export const mockStatusResponse = {
  ready: false,
  state: "UNLAUNCHED",
  qr: null,
  phoneNumber: null,
  error: null,
  initializing: false,
};

export const mockReadyStatusResponse = {
  ready: true,
  state: "CONNECTED",
  qr: null,
  phoneNumber: "14155550123",
  error: null,
  initializing: false,
};

export const mockQrStatusResponse = {
  ready: false,
  state: "QR_READY",
  qr: "test-qr-code-data",
  phoneNumber: null,
  error: null,
  initializing: false,
};

export const mockConnectResponse = {
  success: true,
  message: "Initializing WhatsApp...",
};

export const mockReconnectResponse = {
  success: true,
};

export const mockDisconnectResponse = {
  success: true,
};

export const mockSendResponse = {
  success: true,
};

export const mockHealthResponse = {
  ok: true,
  uptime: 12345.67,
};

export function createMockEngineClient() {
  return {
    health: jest.fn(async () => ({ ...mockHealthResponse })),
    status: jest.fn(async () => ({ ...mockStatusResponse })),
    connect: jest.fn(async () => ({ ...mockConnectResponse })),
    reconnect: jest.fn(async () => ({ ...mockReconnectResponse })),
    disconnect: jest.fn(async () => ({ ...mockDisconnectResponse })),
    send: jest.fn(async () => ({ ...mockSendResponse })),
  };
}

export function mockEngineClient() {
  const mockClient = createMockEngineClient();
  jest.mock("@/lib/whatsapp/engine-client", () => ({
    getEngineClient: jest.fn(() => mockClient),
    WhatsAppEngineClient: jest.fn().mockImplementation(createMockEngineClient),
    EngineClientError: class EngineClientError extends Error {
      status?: number;
      constructor(message: string, status?: number) {
        super(message);
        this.name = "EngineClientError";
        this.status = status;
      }
    },
    SendPayload: {},
  }));
  return { mockClient, mockEngineClient: createMockEngineClient, createMockEngineClient };
}
