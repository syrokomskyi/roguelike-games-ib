import { describe, it, expect } from "vitest";
import { checkRecordLoss } from "@roguelike-games-ib/extractor-sdk";

describe("EXT-010: unexpected record loss creates blocking diagnostic", () => {
  it("detects record loss when current count < previous count beyond threshold", () => {
    const result = checkRecordLoss(100, 80, 5);
    expect(result.lossDetected).toBe(true);
    expect(result.lostCount).toBe(20);
  });

  it("does not flag loss within threshold", () => {
    const result = checkRecordLoss(100, 98, 5);
    expect(result.lossDetected).toBe(false);
    expect(result.lostCount).toBe(2);
  });

  it("does not flag when count increased", () => {
    const result = checkRecordLoss(50, 60, 0);
    expect(result.lossDetected).toBe(false);
    expect(result.lostCount).toBe(0);
  });

  it("detects any loss when threshold is 0", () => {
    const result = checkRecordLoss(10, 9, 0);
    expect(result.lossDetected).toBe(true);
    expect(result.lostCount).toBe(1);
  });

  it("creates blocking diagnostic with ERROR severity on loss", () => {
    const prevCount = 50;
    const currCount = 40;
    const result = checkRecordLoss(prevCount, currCount, 5);

    expect(result.lossDetected).toBe(true);

    // The diagnostic should be blocking (ERROR severity)
    const diagnostic = {
      id: "record-loss-detected",
      severity: "ERROR" as const,
      message: `Unexpected record loss: ${result.lostCount} records lost (previous: ${prevCount}, current: ${currCount})`,
    };
    expect(diagnostic.severity).toBe("ERROR");
    expect(diagnostic.message).toContain("10 records lost");
  });
});
