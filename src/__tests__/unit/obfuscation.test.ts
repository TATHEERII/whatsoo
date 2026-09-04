import {
  obfuscateText,
  obfuscateLine,
  defaultObfuscationOptions,
  ObfuscationOptions,
} from "../../../whatsapp-engine/src/engine";

const INVISIBLE_CHARS = ["\u200B", "\u200C", "\u200D", "\u2060", "\uFEFF"];

describe("obfuscateText", () => {
  const defaultOpts: Required<ObfuscationOptions> = { ...defaultObfuscationOptions };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Math, "random").mockReturnValue(1);
  });

  describe("disabled obfuscation", () => {
    it("should return text unchanged when obfuscation is disabled", () => {
      const opts = { ...defaultOpts, enabled: false };
      const text = "Hello World";
      expect(obfuscateText(text, opts)).toBe("Hello World");
    });

    it("should return empty string unchanged when disabled", () => {
      const opts = { ...defaultOpts, enabled: false };
      expect(obfuscateText("", opts)).toBe("");
    });
  });

  describe("enabled obfuscation", () => {
    it("should return text unchanged when text is empty", () => {
      expect(obfuscateText("", defaultOpts)).toBe("");
    });

    it("should return text unchanged when text is only whitespace", () => {
      expect(obfuscateText("   ", defaultOpts)).toBe("   ");
    });

    it("should preserve line breaks when preserveLineBreaks is true", () => {
      const text = "Hello\nWorld";
      const result = obfuscateText(text, defaultOpts);
      expect(result).toContain("Hello");
      expect(result).toContain("\n");
      expect(result).toContain("World");
    });

    it("should add trailing spaces when preserveLineBreaks is false", () => {
      const opts = { ...defaultOpts, preserveLineBreaks: false };
      const result = obfuscateText("Hello", opts);
      expect(result.endsWith(" ")).toBe(true);
    });

    it("should not add trailing spaces when preserveLineBreaks is true", () => {
      const opts = { ...defaultOpts, preserveLineBreaks: true };
      const result = obfuscateText("Hello", opts);
      expect(result.endsWith(" ")).toBe(false);
    });
  });

  describe("invisible character injection", () => {
    it("should inject invisible characters when density > 0", () => {
      jest.spyOn(Math, "random").mockReturnValue(0);
      const opts: Required<ObfuscationOptions> = {
        ...defaultOpts,
        enabled: true,
        invisibleCharDensity: 1.0,
        dotReplaceRatio: 0,
        preservePunctuation: true,
        preserveLineBreaks: true,
      };
      const text = "AB";
      const result = obfuscateText(text, opts);
      expect(result.length).toBeGreaterThan(text.length);

      let foundInvisible = false;
      for (const char of INVISIBLE_CHARS) {
        if (result.includes(char)) {
          foundInvisible = true;
          break;
        }
      }
      expect(foundInvisible).toBe(true);
    });

    it("should not inject invisible characters when density is 0", () => {
      const opts: Required<ObfuscationOptions> = {
        ...defaultOpts,
        enabled: true,
        invisibleCharDensity: 0,
        dotReplaceRatio: 0,
      };
      const result = obfuscateText("Hello World", opts);
      expect(result).toBe("Hello World");
    });
  });

  describe("dot replacement", () => {
    it("should replace characters with bullet when dotReplaceRatio is 1.0", () => {
      jest.spyOn(Math, "random").mockReturnValue(0);
      const opts: Required<ObfuscationOptions> = {
        ...defaultOpts,
        enabled: true,
        invisibleCharDensity: 0,
        dotReplaceRatio: 1.0,
        preservePunctuation: true,
        preserveLineBreaks: true,
      };
      const text = "AB";
      const result = obfuscateText(text, opts);
      expect(result).toBe("\u2022\u2022");
    });

    it("should not replace punctuation when preservePunctuation is true", () => {
      jest.spyOn(Math, "random").mockReturnValue(0);
      const opts: Required<ObfuscationOptions> = {
        ...defaultOpts,
        enabled: true,
        invisibleCharDensity: 0,
        dotReplaceRatio: 1.0,
        preservePunctuation: true,
        preserveLineBreaks: true,
      };
      const text = "Hello, World!";
      const result = obfuscateText(text, opts);
      expect(result).toContain(",");
      expect(result).toContain("!");
    });

    it("should replace punctuation when preservePunctuation is false", () => {
      jest.spyOn(Math, "random").mockReturnValue(0);
      const opts: Required<ObfuscationOptions> = {
        ...defaultOpts,
        enabled: true,
        invisibleCharDensity: 0,
        dotReplaceRatio: 1.0,
        preservePunctuation: false,
        preserveLineBreaks: true,
      };
      const text = "Hello, World!";
      const result = obfuscateText(text, opts);
      expect(result).not.toContain(",");
      expect(result).not.toContain("!");
    });

    it("should not replace whitespace", () => {
      jest.spyOn(Math, "random").mockReturnValue(0);
      const opts: Required<ObfuscationOptions> = {
        ...defaultOpts,
        enabled: true,
        invisibleCharDensity: 0,
        dotReplaceRatio: 1.0,
        preservePunctuation: true,
        preserveLineBreaks: true,
      };
      const text = "A B";
      const result = obfuscateText(text, opts);
      expect(result).toContain(" ");
    });
  });

  describe("multi-line text", () => {
    it("should process each line independently", () => {
      const opts: Required<ObfuscationOptions> = {
        ...defaultOpts,
        enabled: true,
        invisibleCharDensity: 0,
        dotReplaceRatio: 0,
        preserveLineBreaks: true,
      };
      const text = "Line1\nLine2";
      expect(obfuscateText(text, opts)).toBe("Line1\nLine2");
    });
  });
});

describe("obfuscateLine", () => {
  const defaultOpts: Required<ObfuscationOptions> = { ...defaultObfuscationOptions };

  beforeEach(() => {
    jest.spyOn(Math, "random").mockReturnValue(1);
  });

  it("should return line unchanged for empty or whitespace-only lines", () => {
    expect(obfuscateLine("", defaultOpts)).toBe("");
    expect(obfuscateLine("   ", defaultOpts)).toBe("   ");
  });

  it("should apply dot replacement probabilistically", () => {
    const callCount = { count: 0 };
    jest.spyOn(Math, "random").mockImplementation(() => {
      callCount.count++;
      return callCount.count <= 13 ? 0 : 1;
    });
    const opts: Required<ObfuscationOptions> = {
      ...defaultOpts,
      enabled: true,
      invisibleCharDensity: 0,
      dotReplaceRatio: 0.5,
      preserveLineBreaks: true,
    };
    const text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const result = obfuscateLine(text, opts);

    const bulletCount = (result.match(/\u2022/g) || []).length;
    expect(bulletCount).toBeGreaterThan(0);
    expect(bulletCount).toBeLessThan(text.length);
  });
});
