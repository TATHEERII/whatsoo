import { addDots } from "../../../whatsapp-engine/src/dotObfuscation";

describe("addDots", () => {
  beforeEach(() => {
    jest.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.3).mockReturnValueOnce(0.7);
  });

  it("should add exactly 3 dots to a message", () => {
    const result = addDots("Hello World");
    const dotCount = (result.match(/•/g) || []).length;
    expect(dotCount).toBe(3);
  });

  it("should add exactly 3 dots to a short message", () => {
    const result = addDots("abcd");
    const dotCount = (result.match(/•/g) || []).length;
    expect(dotCount).toBe(3);
  });

  it("should add exactly 3 dots to a long message (100 chars)", () => {
    const result = addDots("a".repeat(100));
    const dotCount = (result.match(/•/g) || []).length;
    expect(dotCount).toBe(3);
  });

  it("should add exactly 3 dots to a long message (500 chars)", () => {
    const result = addDots("a".repeat(500));
    const dotCount = (result.match(/•/g) || []).length;
    expect(dotCount).toBe(3);
  });

  it("should return empty string unchanged", () => {
    expect(addDots("")).toBe("");
  });

  it("should preserve original text content", () => {
    const original = "Hello World";
    const result = addDots(original);
    const stripped = result.replace(/•/g, "");
    expect(stripped).toBe(original);
  });

  it("should maintain original text length plus 3 dots", () => {
    const result = addDots("Test message");
    expect(result.length).toBe("Test message".length + 3);
  });

  it("should place dots at valid positions within the string", () => {
    const text = "abcdefghij";
    const result = addDots(text);
    const stripped = result.replace(/•/g, "");
    expect(stripped).toBe(text);
    expect(result.length).toBe(text.length + 3);
  });
});
