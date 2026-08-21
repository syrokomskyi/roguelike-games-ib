import { describe, it, expect } from "vitest";
import {
  computeDimensionState,
  computeCoverage,
  assertNoCompleteBoolean,
  type CoverageDimension,
  type CoverageRecord,
} from "@roguelike-games-ib/knowledge-core";

describe("COV-001: exhaustive state requires exact denominator equality", () => {
  it("returns exhaustive_for_binding when expected === extracted === validated and unresolved === 0", () => {
    const state = computeDimensionState(
      "extractor_population",
      100,
      100,
      100,
      0,
      false,
    );
    expect(state).toBe("exhaustive_for_binding");
  });

  it("does not return exhaustive when extracted < expected", () => {
    const state = computeDimensionState(
      "extractor_population",
      100,
      99,
      99,
      0,
      false,
    );
    expect(state).not.toBe("exhaustive_for_binding");
  });

  it("does not return exhaustive when validated < extracted", () => {
    const state = computeDimensionState(
      "extractor_population",
      100,
      100,
      95,
      0,
      false,
    );
    expect(state).not.toBe("exhaustive_for_binding");
  });

  it("does not return exhaustive when unresolved > 0", () => {
    const state = computeDimensionState(
      "extractor_population",
      100,
      100,
      100,
      5,
      false,
    );
    expect(state).not.toBe("exhaustive_for_binding");
  });

  it("does not return exhaustive when expected is null", () => {
    const state = computeDimensionState(
      "extractor_population",
      null,
      100,
      100,
      0,
      false,
    );
    expect(state).not.toBe("exhaustive_for_binding");
  });
});

describe("COV-002: qualitative dimension cannot be exhaustive", () => {
  it("qualitative with validated records returns substantially_covered, not exhaustive", () => {
    const state = computeDimensionState(
      "qualitative",
      100,
      100,
      100,
      0,
      false,
    );
    expect(state).toBe("substantially_covered");
    expect(state).not.toBe("exhaustive_for_binding");
  });

  it("qualitative with unresolved returns blocked", () => {
    const state = computeDimensionState(
      "qualitative",
      null,
      10,
      5,
      3,
      false,
    );
    expect(state).toBe("blocked");
  });

  it("qualitative with no validated returns partial", () => {
    const state = computeDimensionState(
      "qualitative",
      null,
      0,
      0,
      0,
      false,
    );
    expect(state).toBe("partial");
  });
});

describe("COV-003: source drift invalidates exhaustive certification", () => {
  it("drifted binding with exhaustive dimension returns partial, not exhaustive", () => {
    const state = computeDimensionState(
      "extractor_population",
      100,
      100,
      100,
      0,
      true,
    );
    expect(state).toBe("partial");
    expect(state).not.toBe("exhaustive_for_binding");
  });

  it("drifted binding with no extracted returns not_assessed", () => {
    const state = computeDimensionState(
      "extractor_population",
      100,
      0,
      0,
      0,
      true,
    );
    expect(state).toBe("not_assessed");
  });

  it("computeCoverage downgrades exhaustive dimensions to partial on drift", () => {
    const dimensions: CoverageDimension[] = [
      {
        id: "creatures",
        state: "exhaustive_for_binding",
        basis: "extractor_population",
        expected: 67,
        extracted: 67,
        validated: 67,
        unresolved: 0,
        notes: null,
      },
      {
        id: "items",
        state: "partial",
        basis: "extractor_population",
        expected: 46,
        extracted: 20,
        validated: 20,
        unresolved: 0,
        notes: null,
      },
    ];

    const record = computeCoverage("broguece", "abc123", dimensions, true);

    const creaturesDim = record.dimensions.find((d) => d.id === "creatures")!;
    expect(creaturesDim.state).toBe("partial");
    expect(creaturesDim.state).not.toBe("exhaustive_for_binding");

    const itemsDim = record.dimensions.find((d) => d.id === "items")!;
    expect(itemsDim.state).toBe("partial");
  });

  it("computeCoverage preserves exhaustive when not drifted", () => {
    const dimensions: CoverageDimension[] = [
      {
        id: "creatures",
        state: "exhaustive_for_binding",
        basis: "extractor_population",
        expected: 67,
        extracted: 67,
        validated: 67,
        unresolved: 0,
        notes: null,
      },
    ];

    const record = computeCoverage("broguece", "abc123", dimensions, false);
    expect(record.dimensions[0].state).toBe("exhaustive_for_binding");
  });
});

describe("COV-004: no universal complete boolean exported", () => {
  it("assertNoCompleteBoolean flags record with complete: true", () => {
    const errors = assertNoCompleteBoolean({ complete: true, source_id: "x" });
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("complete");
  });

  it("assertNoCompleteBoolean flags record with complete: false", () => {
    const errors = assertNoCompleteBoolean({ complete: false, source_id: "x" });
    expect(errors.length).toBe(1);
  });

  it("assertNoCompleteBoolean passes for record without complete field", () => {
    const errors = assertNoCompleteBoolean({ source_id: "x", dimensions: [] });
    expect(errors.length).toBe(0);
  });

  it("computeCoverage output does not contain complete boolean", () => {
    const record: CoverageRecord = computeCoverage("broguece", "abc123", [], false);
    expect("complete" in record).toBe(false);
  });
});

describe("COV-005: coverage unresolved count propagates to status", () => {
  it("unresolved > 0 returns blocked for extractor_population", () => {
    const state = computeDimensionState(
      "extractor_population",
      100,
      50,
      40,
      10,
      false,
    );
    expect(state).toBe("blocked");
  });

  it("unresolved > 0 returns blocked even if extracted === expected", () => {
    const state = computeDimensionState(
      "extractor_population",
      100,
      100,
      90,
      10,
      false,
    );
    expect(state).toBe("blocked");
  });

  it("unresolved === 0 with sufficient coverage returns substantially_covered", () => {
    const state = computeDimensionState(
      "extractor_population",
      100,
      85,
      85,
      0,
      false,
    );
    expect(state).toBe("substantially_covered");
  });

  it("computeCoverage preserves blocked state from dimensions", () => {
    const dimensions: CoverageDimension[] = [
      {
        id: "creatures",
        state: "blocked",
        basis: "extractor_population",
        expected: 67,
        extracted: 40,
        validated: 30,
        unresolved: 10,
        notes: null,
      },
    ];

    const record = computeCoverage("broguece", "abc123", dimensions, false);
    expect(record.dimensions[0].state).toBe("blocked");
  });
});
