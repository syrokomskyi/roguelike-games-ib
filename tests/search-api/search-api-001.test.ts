import { describe, it, expect } from "vitest";
import {
  buildEmbeddingText,
  normalizeIndexRecord,
  toVectorMetadata,
} from "../../apps/search-api/src/index.ts";
import type { IndexRecord, VectorMetadata } from "../../apps/search-api/src/types.ts";

function makeRecord(overrides: Partial<IndexRecord> = {}): IndexRecord {
  return {
    vector_id: "abc123_-",
    canonical_id: "urn:test:record:001",
    key: "goblin",
    record_type: "definition",
    source_id: "broguece",
    content_language: "en",
    title: "Goblin",
    summary: "A small green creature",
    ...overrides,
  };
}

describe("SEARCH-API-001: buildEmbeddingText includes all fields", () => {
  it("includes record_type and key", () => {
    const text = buildEmbeddingText(makeRecord());
    expect(text).toContain("type: definition");
    expect(text).toContain("key: goblin");
  });

  it("includes kind when present", () => {
    const text = buildEmbeddingText(makeRecord({ kind: "creature" }));
    expect(text).toContain("kind: creature");
  });

  it("includes semantic_type when present", () => {
    const text = buildEmbeddingText(makeRecord({ record_type: "semantic_record", semantic_type: "mechanic_summary" }));
    expect(text).toContain("semantic_type: mechanic_summary");
  });

  it("includes title and summary", () => {
    const text = buildEmbeddingText(makeRecord());
    expect(text).toContain("title: Goblin");
    expect(text).toContain("description: A small green creature");
  });

  it("includes concept_type for concept records", () => {
    const text = buildEmbeddingText(makeRecord({
      record_type: "concept",
      concept_type: "cross_game_mechanic",
      title: "Fire Resistance",
      summary: "Resistance to fire damage",
    }));
    expect(text).toContain("concept: cross_game_mechanic");
  });

  it("includes source_games for cross-game concepts", () => {
    const text = buildEmbeddingText(makeRecord({
      record_type: "concept",
      source_games: ["broguece", "nethack", "cataclysm-bn"],
    }));
    expect(text).toContain("games: broguece, nethack, cataclysm-bn");
  });

  it("includes mutation_dimensions when present", () => {
    const text = buildEmbeddingText(makeRecord({
      mutation_dimensions: ["resistance_magnitude", "stacking_rules"],
    }));
    expect(text).toContain("dimensions: resistance_magnitude, stacking_rules");
  });

  it("omits kind line when kind is absent", () => {
    const text = buildEmbeddingText(makeRecord());
    expect(text).not.toContain("kind:");
  });

  it("omits semantic_type line when absent", () => {
    const text = buildEmbeddingText(makeRecord());
    expect(text).not.toContain("semantic_type:");
  });
});

describe("SEARCH-API-002: normalizeIndexRecord validates and truncates", () => {
  it("returns undefined for missing vector_id", () => {
    const result = normalizeIndexRecord(makeRecord({ vector_id: "" }));
    expect(result).toBeUndefined();
  });

  it("returns undefined for invalid vector_id characters", () => {
    const result = normalizeIndexRecord(makeRecord({ vector_id: "has spaces!" }));
    expect(result).toBeUndefined();
  });

  it("returns undefined for missing canonical_id", () => {
    const result = normalizeIndexRecord(makeRecord({ canonical_id: "" }));
    expect(result).toBeUndefined();
  });

  it("preserves kind and semantic_type", () => {
    const result = normalizeIndexRecord(makeRecord({ kind: "item", semantic_type: "mechanic" }));
    expect(result).toBeDefined();
    expect(result!.kind).toBe("item");
    expect(result!.semantic_type).toBe("mechanic");
  });

  it("truncates kind to 80 chars", () => {
    const longKind = "a".repeat(100);
    const result = normalizeIndexRecord(makeRecord({ kind: longKind }));
    expect(result!.kind).toHaveLength(80);
  });

  it("truncates semantic_type to 80 chars", () => {
    const longType = "b".repeat(100);
    const result = normalizeIndexRecord(makeRecord({ semantic_type: longType }));
    expect(result!.semantic_type).toHaveLength(80);
  });

  it("sets kind to undefined when absent", () => {
    const result = normalizeIndexRecord(makeRecord());
    expect(result!.kind).toBeUndefined();
  });

  it("sets semantic_type to undefined when absent", () => {
    const result = normalizeIndexRecord(makeRecord());
    expect(result!.semantic_type).toBeUndefined();
  });
});

describe("SEARCH-API-003: toVectorMetadata maps all fields", () => {
  it("includes kind and semantic_type in metadata", () => {
    const meta = toVectorMetadata(makeRecord({ kind: "creature", semantic_type: "summary" }));
    expect(meta.kind).toBe("creature");
    expect(meta.semantic_type).toBe("summary");
  });

  it("defaults kind to empty string when absent", () => {
    const meta = toVectorMetadata(makeRecord());
    expect(meta.kind).toBe("");
  });

  it("defaults semantic_type to empty string when absent", () => {
    const meta = toVectorMetadata(makeRecord());
    expect(meta.semantic_type).toBe("");
  });

  it("serializes source_games as JSON string", () => {
    const meta = toVectorMetadata(makeRecord({ source_games: ["broguece", "nethack"] }));
    expect(meta.source_games).toBe('["broguece","nethack"]');
  });

  it("serializes mutation_dimensions as JSON string", () => {
    const meta = toVectorMetadata(makeRecord({ mutation_dimensions: ["dim1", "dim2"] }));
    expect(meta.mutation_dimensions).toBe('["dim1","dim2"]');
  });

  it("defaults source_games to empty string when absent", () => {
    const meta = toVectorMetadata(makeRecord());
    expect(meta.source_games).toBe("");
  });

  it("produces all required VectorMetadata fields", () => {
    const meta = toVectorMetadata(makeRecord());
    const required: string[] = [
      "canonical_id", "key", "record_type", "source_id",
      "content_language", "title", "summary", "concept_type",
      "source_games", "mutation_dimensions", "kind", "semantic_type",
    ];
    for (const field of required) {
      expect(meta).toHaveProperty(field);
    }
  });
});
