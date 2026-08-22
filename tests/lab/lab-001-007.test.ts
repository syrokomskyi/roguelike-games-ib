import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createSeed,
  persistSeed,
  readSeeds,
  validateSeedRecord,
  isLaboratoryRecordId,
  isCanonicalRecordId,
  createLaboratoryRecordId,
  LABORATORY_AUTHORITY,
  assertNoLabRefInCanonical,
  assertNoCanonicalMutation,
  createAncestry,
  validateAncestry,
  computeAntiCopyPenalty,
  computeScores,
  rankSeeds,
  promoteSeed,
  runInspirationPipeline,
  NullGenerator,
  FailingGenerator,
  createMutationVector,
  normalizeConstraints,
  type SeedRecord,
} from "@roguelike-games-ib/laboratory-runtime";
import { createTempWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { join } from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const CANONICAL_ID_1 = "urn:roguelike-games-ib:record:11111111-1111-7111-8111-111111111111";
const CANONICAL_ID_2 = "urn:roguelike-games-ib:record:22222222-2222-7222-8222-222222222222";
const LAB_ID = "urn:roguelike-games-ib:lab:55555555-5555-7555-8555-555555555555";

function makeTestSeed(overrides?: Partial<SeedRecord>): SeedRecord {
  const baseScores = { novelty: 0.6, fit: 0.7, leverage: 0.5, cost: 0.3, anti_copy_penalty: 0, final_score: 1.5 };
  return {
    id: createLaboratoryRecordId(),
    key: "lab/seed/test-seed",
    schema: "rgkb/laboratory-seed@1",
    authority: LABORATORY_AUTHORITY,
    title: "Test Seed",
    description: "A test design seed",
    ancestry: {
      canonical_input_ids: [CANONICAL_ID_1],
      mutation_vector_ids: ["mv-001"],
      transformations: ["sensory_modality: sight → sound"],
      constraints_satisfied: ["must_have: stealth"],
      constraints_violated: [],
    },
    scores: baseScores,
    generator: {
      provider: null,
      model: null,
      template_version: null,
      prompt_version: null,
      generated_at: null,
    },
    session_id: "session-001",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("LAB-001: seed may reference canonical ancestry", () => {
  it("seed with canonical input ids passes validation", () => {
    const seed = makeTestSeed({
      ancestry: {
        canonical_input_ids: [CANONICAL_ID_1, CANONICAL_ID_2],
        mutation_vector_ids: ["mv-001"],
        transformations: ["sensory_modality: sight → sound"],
        constraints_satisfied: [],
        constraints_violated: [],
      },
    });
    const result = validateSeedRecord(seed);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("ancestry validation accepts canonical record ids", () => {
    const ancestry = createAncestry(
      [CANONICAL_ID_1, CANONICAL_ID_2],
      [{ vector_id: "mv-001", transformation: "test", is_cosmetic: false }],
      { satisfied: [], violated: [] },
      { provider: null, model: null, template_version: null, prompt_version: null, generated_at: null },
    );
    const result = validateAncestry(ancestry, "urn:roguelike-games-ib:lab:aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa");
    expect(result.valid).toBe(true);
  });

  it("isCanonicalRecordId distinguishes canonical from laboratory ids", () => {
    expect(isCanonicalRecordId(CANONICAL_ID_1)).toBe(true);
    expect(isCanonicalRecordId(LAB_ID)).toBe(false);
    expect(isLaboratoryRecordId(LAB_ID)).toBe(true);
    expect(isLaboratoryRecordId(CANONICAL_ID_1)).toBe(false);
  });
});

describe("LAB-002: canonical evidence cannot reference seed", () => {
  it("assertNoLabRefInCanonical detects lab id in evidence_refs", () => {
    const canonicalRecords = [
      { id: CANONICAL_ID_1, evidence_refs: [LAB_ID] },
    ];
    const result = assertNoLabRefInCanonical(canonicalRecords);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes("laboratory id"))).toBe(true);
  });

  it("assertNoLabRefInCanonical passes for clean canonical records", () => {
    const canonicalRecords = [
      { id: CANONICAL_ID_1, evidence_refs: [CANONICAL_ID_2] },
    ];
    const result = assertNoLabRefInCanonical(canonicalRecords);
    expect(result.valid).toBe(true);
  });

  it("assertNoLabRefInCanonical detects lab id in subject_id", () => {
    const canonicalRecords = [
      { id: CANONICAL_ID_1, subject_id: LAB_ID },
    ];
    const result = assertNoLabRefInCanonical(canonicalRecords);
    expect(result.valid).toBe(false);
  });

  it("seed validation rejects laboratory id in ancestry canonical_input_ids", () => {
    const seed = makeTestSeed({
      ancestry: {
        canonical_input_ids: [LAB_ID],
        mutation_vector_ids: ["mv-001"],
        transformations: [],
        constraints_satisfied: [],
        constraints_violated: [],
      },
    });
    const result = validateSeedRecord(seed);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("laboratory id"))).toBe(true);
  });
});

describe("LAB-003: seed carries authority=laboratory", () => {
  it("valid seed has authority=laboratory", () => {
    const seed = makeTestSeed();
    expect(seed.authority).toBe("laboratory");
  });

  it("validateSeedRecord rejects seed with wrong authority", () => {
    const seed = makeTestSeed({ authority: "canonical" as never });
    const result = validateSeedRecord(seed);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("authority"))).toBe(true);
  });

  it("validateSeedRecord rejects seed with wrong schema", () => {
    const seed = makeTestSeed({ schema: "wrong-schema" });
    const result = validateSeedRecord(seed);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("schema"))).toBe(true);
  });

  it("validateSeedRecord rejects seed with non-laboratory id format", () => {
    const seed = makeTestSeed({ id: CANONICAL_ID_1 });
    const result = validateSeedRecord(seed);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("id") && e.includes("laboratory"))).toBe(true);
  });
});

describe("LAB-004: promotion from seed creates new candidate, not direct canonical mutation", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("promoteSeed returns a candidate batch, not a direct canonical write", () => {
    const seed = makeTestSeed();
    const result = promoteSeed(seed, "test-source", "run-001", "test-extractor", "1.0.0", "concept");
    expect(result.promoted).toBe(true);
    expect(result.error).toBeNull();
    expect(result.candidate_batch.records).toHaveLength(1);
    expect(result.candidate_batch.records[0].id).toBe(seed.id);
    expect(result.candidate_batch.records[0].record_type).toBe("concept");
  });

  it("promoteSeed candidate has promoted_from_seed field", () => {
    const seed = makeTestSeed();
    const result = promoteSeed(seed, "test-source", "run-001", "test-extractor", "1.0.0", "concept");
    expect(result.candidate_batch.records[0]).toHaveProperty("promoted_from_seed", seed.id);
  });

  it("promoteSeed fails for invalid seed", () => {
    const seed = makeTestSeed({ authority: "canonical" as never });
    const result = promoteSeed(seed, "test-source", "run-001", "test-extractor", "1.0.0", "concept");
    expect(result.promoted).toBe(false);
    expect(result.error).not.toBeNull();
  });

  it("assertNoCanonicalMutation prevents writing to canonical root", () => {
    const canonicalRoot = join(workspace, "knowledge");
    const labRoot = join(workspace, "laboratory");
    const labWritePath = join(labRoot, "seeds", "test.json");
    expect(() => assertNoCanonicalMutation(labRoot, canonicalRoot, labWritePath)).not.toThrow();

    const canonicalWritePath = join(canonicalRoot, "seeds", "test.json");
    expect(() => assertNoCanonicalMutation(labRoot, canonicalRoot, canonicalWritePath)).toThrow();
  });

  it("persistSeed writes to laboratory root, not canonical root", () => {
    const seed = makeTestSeed();
    const labRoot = join(workspace, "laboratory");
    const canonicalRoot = join(workspace, "knowledge");
    persistSeed(seed, labRoot);

    const seedFile = join(labRoot, "seeds", `${seed.id.replace("urn:roguelike-games-ib:lab:", "")}.json`);
    expect(existsSync(seedFile)).toBe(true);

    const canonicalSeedFile = join(canonicalRoot, "seeds", `${seed.id}.json`);
    expect(existsSync(canonicalSeedFile)).toBe(false);
  });
});

describe("LAB-005: anti-copy ranking penalizes cosmetic-only mutation", () => {
  it("cosmetic-only mutations with single ancestry get high penalty", () => {
    const cosmeticResults = [
      { vector_id: "mv-1", transformation: "sensory_modality: scent → heat", is_cosmetic: true },
      { vector_id: "mv-2", transformation: "sensory_modality: heat → cold", is_cosmetic: true },
    ];
    const penalty = computeAntiCopyPenalty(cosmeticResults, 1);
    expect(penalty).toBe(0.5);
  });

  it("structural mutations get no penalty", () => {
    const structuralResults = [
      { vector_id: "mv-1", transformation: "topology: grid → graph", is_cosmetic: false },
      { vector_id: "mv-2", transformation: "propagation: local → global", is_cosmetic: false },
    ];
    const penalty = computeAntiCopyPenalty(structuralResults, 1);
    expect(penalty).toBe(0);
  });

  it("mixed mutations with single ancestry get partial penalty when cosmetic dominates", () => {
    const mixedResults = [
      { vector_id: "mv-1", transformation: "topology: grid → graph", is_cosmetic: false },
      { vector_id: "mv-2", transformation: "sensory_modality: scent → heat", is_cosmetic: true },
      { vector_id: "mv-3", transformation: "sensory_modality: heat → cold", is_cosmetic: true },
    ];
    const penalty = computeAntiCopyPenalty(mixedResults, 1);
    expect(penalty).toBe(0.5);
  });

  it("cosmetic-heavy mutations with diverse ancestry get lower penalty", () => {
    const cosmeticResults = [
      { vector_id: "mv-1", transformation: "sensory_modality: scent → heat", is_cosmetic: true },
      { vector_id: "mv-2", transformation: "sensory_modality: heat → cold", is_cosmetic: true },
      { vector_id: "mv-3", transformation: "sensory_modality: cold → light", is_cosmetic: true },
    ];
    const penalty = computeAntiCopyPenalty(cosmeticResults, 3);
    expect(penalty).toBe(0.3);
  });

  it("penalty reduces final score", () => {
    const scoresNoPenalty = computeScores(0.6, 0.7, 0.5, 0.3, 0);
    const scoresWithPenalty = computeScores(0.6, 0.7, 0.5, 0.3, 0.5);
    expect(scoresWithPenalty.final_score).toBeLessThan(scoresNoPenalty.final_score);
  });

  it("rankSeeds ranks structural seeds above cosmetic seeds", () => {
    const structuralSeed = makeTestSeed({
      key: "lab/seed/structural",
      scores: computeScores(0.6, 0.7, 0.5, 0.3, 0),
    });
    const cosmeticSeed = makeTestSeed({
      key: "lab/seed/cosmetic",
      scores: computeScores(0.6, 0.7, 0.5, 0.3, 0.5),
    });
    const ranked = rankSeeds([cosmeticSeed, structuralSeed]);
    expect(ranked[0].key).toBe("lab/seed/structural");
  });
});

describe("LAB-006: generator/provider failure cannot mutate canonical state", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("failing generator returns no seeds and does not mutate canonical state", async () => {
    const canonicalRoot = join(workspace, "knowledge");
    const labRoot = join(workspace, "laboratory");
    const canonicalFilesBefore = existsSync(canonicalRoot) ? readdirSync(canonicalRoot) : [];

    const result = await runInspirationPipeline({
      sessionId: "session-fail",
      constraints: normalizeConstraints({}),
      canonicalIngredients: [
        { id: CANONICAL_ID_1, key: "a/creature/goblin", record_type: "definition", title: "Goblin", description: "A creature" },
      ],
      mutationVectors: [
        createMutationVector("mv-1", "sensory_modality", "sight", "sound", "Change sensory modality"),
      ],
      generator: new FailingGenerator(),
      laboratoryRoot: labRoot,
      canonicalRoot,
      persistResults: true,
    });

    expect(result.seeds).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("Generator failure"))).toBe(true);
    expect(result.canonical_state_mutated).toBe(false);

    const canonicalFilesAfter = existsSync(canonicalRoot) ? readdirSync(canonicalRoot) : [];
    expect(canonicalFilesAfter).toEqual(canonicalFilesBefore);
  });

  it("null generator works without provider and does not mutate canonical state", async () => {
    const canonicalRoot = join(workspace, "knowledge");
    const labRoot = join(workspace, "laboratory");

    const result = await runInspirationPipeline({
      sessionId: "session-null",
      constraints: normalizeConstraints({}),
      canonicalIngredients: [
        { id: CANONICAL_ID_1, key: "a/creature/goblin", record_type: "definition", title: "Goblin", description: "A creature" },
      ],
      mutationVectors: [
        createMutationVector("mv-1", "sensory_modality", "sight", "sound", "Change sensory modality"),
      ],
      generator: new NullGenerator(),
      laboratoryRoot: labRoot,
      canonicalRoot,
      persistResults: true,
    });

    expect(result.seeds.length).toBeGreaterThan(0);
    expect(result.canonical_state_mutated).toBe(false);

    const canonicalFilesAfter = existsSync(canonicalRoot) ? readdirSync(canonicalRoot) : [];
    expect(canonicalFilesAfter).toEqual([]);
  });
});

describe("LAB-007: persisted generated seed records provider/model/template and ancestry", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("persisted seed with provider contains generator metadata", async () => {
    const labRoot = join(workspace, "laboratory");
    const canonicalRoot = join(workspace, "knowledge");

    const customGenerator = {
      async generate() {
        return [{
          title: "Test Idea",
          description: "A test generated idea",
          selected_ingredient_ids: [CANONICAL_ID_1],
          applied_mutations: [
            { vector_id: "mv-1", transformation: "sensory_modality: sight → sound", is_cosmetic: false },
          ],
          base_scores: { novelty: 0.7, fit: 0.8, leverage: 0.6, cost: 0.2 },
        }];
      },
    };

    const result = await runInspirationPipeline({
      sessionId: "session-meta",
      constraints: normalizeConstraints({}),
      canonicalIngredients: [
        { id: CANONICAL_ID_1, key: "a/creature/goblin", record_type: "definition", title: "Goblin", description: "A creature" },
      ],
      mutationVectors: [
        createMutationVector("mv-1", "sensory_modality", "sight", "sound", "Change sensory modality"),
      ],
      generator: customGenerator,
      laboratoryRoot: labRoot,
      canonicalRoot,
      persistResults: true,
    });

    expect(result.seeds.length).toBe(1);
    const seed = result.seeds[0];

    expect(seed.generator.provider).not.toBeNull();
    expect(seed.generator.model).not.toBeNull();
    expect(seed.generator.template_version).not.toBeNull();
    expect(seed.generator.generated_at).not.toBeNull();

    expect(seed.ancestry.canonical_input_ids).toContain(CANONICAL_ID_1);
    expect(seed.ancestry.mutation_vector_ids).toContain("mv-1");
    expect(seed.ancestry.transformations).toContain("sensory_modality: sight → sound");

    const seedFile = join(labRoot, "seeds", `${seed.id.replace("urn:roguelike-games-ib:lab:", "")}.json`);
    expect(existsSync(seedFile)).toBe(true);
    const raw = readFileSync(seedFile, "utf-8");
    const persisted = JSON.parse(raw);
    expect(persisted.generator.provider).not.toBeNull();
    expect(persisted.ancestry.canonical_input_ids).toContain(CANONICAL_ID_1);
    expect(persisted.ancestry.mutation_vector_ids).toContain("mv-1");
  });

  it("persisted seed with null generator records null provider and ancestry", async () => {
    const labRoot = join(workspace, "laboratory");
    const canonicalRoot = join(workspace, "knowledge");

    const result = await runInspirationPipeline({
      sessionId: "session-null-meta",
      constraints: normalizeConstraints({}),
      canonicalIngredients: [
        { id: CANONICAL_ID_1, key: "a/creature/goblin", record_type: "definition", title: "Goblin", description: "A creature" },
      ],
      mutationVectors: [
        createMutationVector("mv-1", "sensory_modality", "sight", "sound", "Change sensory modality"),
      ],
      generator: null,
      laboratoryRoot: labRoot,
      canonicalRoot,
      persistResults: true,
    });

    expect(result.seeds.length).toBe(1);
    const seed = result.seeds[0];

    expect(seed.generator.provider).toBeNull();
    expect(seed.generator.model).toBeNull();
    expect(seed.ancestry.canonical_input_ids).toContain(CANONICAL_ID_1);
    expect(seed.ancestry.mutation_vector_ids).toContain("mv-1");
    expect(seed.ancestry.transformations.length).toBeGreaterThan(0);
  });

  it("readSeeds returns persisted seeds with full metadata", async () => {
    const labRoot = join(workspace, "laboratory");
    const canonicalRoot = join(workspace, "knowledge");

    await runInspirationPipeline({
      sessionId: "session-readback",
      constraints: normalizeConstraints({}),
      canonicalIngredients: [
        { id: CANONICAL_ID_1, key: "a/creature/goblin", record_type: "definition", title: "Goblin", description: "A creature" },
      ],
      mutationVectors: [
        createMutationVector("mv-1", "sensory_modality", "sight", "sound", "Change sensory modality"),
      ],
      generator: null,
      laboratoryRoot: labRoot,
      canonicalRoot,
      persistResults: true,
    });

    const seeds = readSeeds(labRoot);
    expect(seeds.length).toBe(1);
    expect(seeds[0].ancestry.canonical_input_ids).toContain(CANONICAL_ID_1);
    expect(seeds[0].ancestry.mutation_vector_ids).toContain("mv-1");
  });
});
