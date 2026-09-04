module.exports = {
  toDataURL: jest.fn(async (text: string, options?: Record<string, unknown>) => {
    return `data:image/png;base64,mock-qr-${Buffer.from(text).toString("base64")}`;
  }),
  toString: jest.fn(async (text: string) => text),
  toBuffer: jest.fn(async (text: string) => Buffer.from(text)),
  toFile: jest.fn(async () => {}),
  toBase64: jest.fn(async (text: string) => text),
};
