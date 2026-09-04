import { calculateDelay } from "@/lib/sqliteQueue";

describe("calculateDelay", () => {
  describe("fixed delay", () => {
    it("should return the same delay for all contact indices", () => {
      const delayValue = 5000;
      expect(calculateDelay("fixed", delayValue, 0)).toBe(5000);
      expect(calculateDelay("fixed", delayValue, 1)).toBe(5000);
      expect(calculateDelay("fixed", delayValue, 5)).toBe(5000);
      expect(calculateDelay("fixed", delayValue, 100)).toBe(5000);
    });

    it("should return delayValue regardless of contact index", () => {
      const delayValue = 10000;
      expect(calculateDelay("fixed", delayValue, 0)).toBe(10000);
      expect(calculateDelay("fixed", delayValue, 999)).toBe(10000);
    });

    it("should handle delayValue of 0", () => {
      expect(calculateDelay("fixed", 0, 0)).toBe(0);
    });
  });

  describe("random delay", () => {
    it("should return a value between 0 and delayValue", () => {
      const delayValue = 5000;
      for (let i = 0; i < 100; i++) {
        const result = calculateDelay("random", delayValue, i);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(delayValue);
      }
    });

    it("should return 0 when delayValue is 0", () => {
      for (let i = 0; i < 10; i++) {
        expect(calculateDelay("random", 0, i)).toBe(0);
      }
    });
  });

  describe("progressive delay", () => {
    it("should increase delay based on contact index", () => {
      const delayValue = 5000;
      const delay0 = calculateDelay("progressive", delayValue, 0);
      const delay1 = calculateDelay("progressive", delayValue, 1);
      const delay2 = calculateDelay("progressive", delayValue, 2);
      const delay3 = calculateDelay("progressive", delayValue, 3);

      expect(delay0).toBe(5000);
      expect(delay1).toBe(10000);
      expect(delay2).toBe(15000);
      expect(delay3).toBe(20000);
    });

    it("should scale linearly with index", () => {
      const delayValue = 1000;
      for (let i = 0; i < 10; i++) {
        expect(calculateDelay("progressive", delayValue, i)).toBe(
          delayValue * (i + 1)
        );
      }
    });

    it("should handle index 0 correctly (first contact gets base delay)", () => {
      expect(calculateDelay("progressive", 3000, 0)).toBe(3000);
    });
  });

  describe("unknown delay type", () => {
    it("should return 0 for unknown delay type", () => {
      const result = calculateDelay("unknown" as never, 5000, 0);
      expect(result).toBe(0);
    });
  });
});
