import { describe, it, expect } from "vitest";
import { computeQualityScores, DEFAULT_QUALITY_SCORING_CONFIG } from "@roguelike-games-ib/materializer";
import type { CanonicalState } from "@roguelike-games-ib/materializer";
import type { RelationRecord, ClaimRecord, ContradictionRecord, EvidenceAnchor, KeyEntry, AliasEntry, SourceBinding, CoverageRecord, RelationTypeDefinition } from "@roguelike-games-ib/knowledge-core";

function makeState(records: Record<string, unknown>[], relations: RelationRecord[] = [], bindings: SourceBinding[] = []): CanonicalState {
  return {
    records: records as CanonicalState["records"],
    claims: [] as ClaimRecord[],
    relations,
    contradictions: [] as ContradictionRecord[],
    evidence: [] as EvidenceAnchor[],
    keys: [] as KeyEntry[],
    aliases: [] as AliasEntry[],
    bindings,
    coverage: [] as CoverageRecord[],
    relationTypes: new Map<string, RelationTypeDefinition>(),
  };
}

function makeBinding(sourceId: string): SourceBinding {
  return {
    source_id: sourceId,
    source_root: "",
    fingerprint: "",
    binding_digest: "",
    payload_root: "",
    schema: "rgkb/source-binding@2",
  } as unknown as SourceBinding;
}

function makeConcept(id: string, key: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    key,
    record_type: "concept",
    ...extra,
  };
}

describe("computeQualityScores — coverage", () => {
  it("returns 1.0 when concept covers all source bindings", () => {
    const state = makeState(
      [makeConcept("c1", "concept:full", {
        ancestry: { source_games: ["crawl", "broguece"] },
      })],
      [],
      [makeBinding("crawl"), makeBinding("broguece")],
    );
    const scores = computeQualityScores(state);
    expect(scores.get("c1")?.coverage).toBe(1.0);
  });

  it("returns 0.5 when concept covers half the source bindings", () => {
    const state = makeState(
      [makeConcept("c1", "concept:half", {
        ancestry: { source_games: ["crawl"] },
      })],
      [],
      [makeBinding("crawl"), makeBinding("broguece")],
    );
    const scores = computeQualityScores(state);
    expect(scores.get("c1")?.coverage).toBe(0.5);
  });

  it("returns 0 when concept has no source_games", () => {
    const state = makeState(
      [makeConcept("c1", "concept:none", {})],
      [],
      [makeBinding("crawl")],
    );
    const scores = computeQualityScores(state);
    expect(scores.get("c1")?.coverage).toBe(0);
  });

  it("returns 0 when no bindings exist", () => {
    const state = makeState(
      [makeConcept("c1", "concept:nobind", {
        ancestry: { source_games: ["crawl"] },
      })],
    );
    const scores = computeQualityScores(state);
    expect(scores.get("c1")?.coverage).toBe(0);
  });
});

describe("computeQualityScores — evidence", () => {
  it("returns 1.0 when concept has >= evidence_target valid refs", () => {
    const refs = Array.from({ length: 10 }, (_, i) => `rec-${i}`);
    const records = [
      makeConcept("c1", "concept:ev", { implementation_refs: refs }),
      ...refs.map((id) => ({ id, key: id, record_type: "creature" })),
    ];
    const state = makeState(records);
    const scores = computeQualityScores(state);
    expect(scores.get("c1")?.evidence).toBe(1.0);
  });

  it("returns 0 when concept has no implementation_refs", () => {
    const state = makeState([makeConcept("c1", "concept:noev", {})]);
    const scores = computeQualityScores(state);
    expect(scores.get("c1")?.evidence).toBe(0);
  });

  it("caps at 1.0 even with more than target refs", () => {
    const refs = Array.from({ length: 20 }, (_, i) => `rec-${i}`);
    const records = [
      makeConcept("c1", "concept:over", { implementation_refs: refs }),
      ...refs.map((id) => ({ id, key: id, record_type: "creature" })),
    ];
    const state = makeState(records);
    const scores = computeQualityScores(state);
    expect(scores.get("c1")?.evidence).toBe(1.0);
  });

  it("only counts refs that resolve to existing records", () => {
    const state = makeState([
      makeConcept("c1", "concept:partial", { implementation_refs: ["real-1", "fake-1", "fake-2"] }),
      { id: "real-1", key: "real-1", record_type: "creature" },
    ]);
    const scores = computeQualityScores(state);
    expect(scores.get("c1")?.evidence).toBeCloseTo(0.1, 2);
  });
});

describe("computeQualityScores — richness (design primitive)", () => {
  it("counts design-space relations from the concept", () => {
    const concept = makeConcept("c1", "concept:rich", { concept_type: "design_primitive" });
    const relations: RelationRecord[] = [
      { id: "r1", relation_type: "HAS_MUTATION_VECTOR", source_record_id: "c1", target_record_id: "t1", relation_scope: "design", evidence_refs: [] },
      { id: "r2", relation_type: "IMPLEMENTED_AS", source_record_id: "c1", target_record_id: "t2", relation_scope: "design", evidence_refs: [] },
      { id: "r3", relation_type: "HAS_COUNTERPLAY", source_record_id: "c1", target_record_id: "t3", relation_scope: "design", evidence_refs: [] },
      { id: "r4", relation_type: "CAN_FAIL_AS", source_record_id: "c1", target_record_id: "t4", relation_scope: "design", evidence_refs: [] },
    ];
    const state = makeState([concept], relations);
    const scores = computeQualityScores(state);
    expect(scores.get("c1")?.richness).toBe(4 / DEFAULT_QUALITY_SCORING_CONFIG.richness_target);
  });

  it("returns 0 for design primitive with no relations", () => {
    const state = makeState([makeConcept("c1", "concept:norel", { concept_type: "design_primitive" })]);
    const scores = computeQualityScores(state);
    expect(scores.get("c1")?.richness).toBe(0);
  });
});

describe("computeQualityScores — richness (non-primitive)", () => {
  it("counts distinct connected records via design/cross_game scope", () => {
    const concept = makeConcept("c1", "concept:conn", { concept_type: "cross_game_mechanic" });
    const relations: RelationRecord[] = [
      { id: "r1", relation_type: "CREATES_PRESSURE", source_record_id: "c1", target_record_id: "t1", relation_scope: "design", evidence_refs: [] },
      { id: "r2", relation_type: "synergizes_with", source_record_id: "t2", target_record_id: "c1", relation_scope: "cross_game", evidence_refs: [] },
    ];
    const state = makeState([concept], relations);
    const scores = computeQualityScores(state);
    expect(scores.get("c1")?.richness).toBe(2 / DEFAULT_QUALITY_SCORING_CONFIG.richness_other_target);
  });

  it("ignores game-scope relations", () => {
    const concept = makeConcept("c1", "concept:gamescope", { concept_type: "cross_game_mechanic" });
    const relations: RelationRecord[] = [
      { id: "r1", relation_type: "related_to", source_record_id: "c1", target_record_id: "t1", relation_scope: "game", evidence_refs: [] },
    ];
    const state = makeState([concept], relations);
    const scores = computeQualityScores(state);
    expect(scores.get("c1")?.richness).toBe(0);
  });
});

describe("computeQualityScores — overall", () => {
  it("computes weighted overall score", () => {
    const concept = makeConcept("c1", "concept:overall", {
      ancestry: { source_games: ["crawl", "broguece"] },
      implementation_refs: ["r1", "r2", "r3", "r4", "r5"],
      concept_type: "cross_game_mechanic",
    });
    const records = [
      concept,
      ...["r1", "r2", "r3", "r4", "r5"].map((id) => ({ id, key: id, record_type: "creature" })),
    ];
    const state = makeState(records, [], [makeBinding("crawl"), makeBinding("broguece")]);
    const scores = computeQualityScores(state);
    const score = scores.get("c1")!;
    const expectedOverall = Math.round(
      (score.coverage * 0.4 + score.evidence * 0.3 + score.richness * 0.3) * 100,
    ) / 100;
    expect(score.overall).toBe(expectedOverall);
  });
});

describe("computeQualityScores — edge cases", () => {
  it("skips non-concept records", () => {
    const state = makeState([
      { id: "r1", key: "r1", record_type: "creature" },
    ]);
    const scores = computeQualityScores(state);
    expect(scores.size).toBe(0);
  });

  it("returns empty map for empty state", () => {
    const state = makeState([]);
    const scores = computeQualityScores(state);
    expect(scores.size).toBe(0);
  });

  it("uses custom config when provided", () => {
    const concept = makeConcept("c1", "concept:custom", {
      implementation_refs: ["r1"],
    });
    const records = [concept, { id: "r1", key: "r1", record_type: "creature" }];
    const state = makeState(records);
    const scores = computeQualityScores(state, {
      evidence_target: 1,
      richness_target: 1,
      richness_other_target: 1,
      weights: { coverage: 0.5, evidence: 0.5, richness: 0 },
    });
    expect(scores.get("c1")?.evidence).toBe(1.0);
  });
});
