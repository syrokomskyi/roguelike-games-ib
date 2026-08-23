/*
<MODULE_CONTRACT>
<purpose>Advanced query tools: cross-record claim search, concept member resolution, design tension lookup, and structured attribute search.</purpose>
<non-goals>
  <item>Does not mutate or create records — all tools are read-only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: claim search, concept member resolution, design tensions, attribute search.</item>
  <item>RFC-0003: Extended getDesignTensions to return counterplay patterns via HAS_COUNTERPLAY relations.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { paginate } from "../pagination.ts";
import { NotFoundError, ValidationError } from "../errors.ts";

/**
 * Search claims across ALL records by predicate.
 * Optionally filter by source_id or assertion_state.
 */
export function getClaimsByPredicate(
  ctx: McpContext,
  input: {
    predicate: string;
    source_id?: string;
    assertion_state?: string;
    cursor?: string;
    limit?: number;
  },
) {
  if (!input.predicate) {
    throw new ValidationError("predicate is required");
  }

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const filters: Record<string, unknown> = { predicate: input.predicate };
  if (input.source_id) filters.source_id = input.source_id;
  if (input.assertion_state) filters.assertion_state = input.assertion_state;

  let claims = ctx.store.claims.filter((c) => c.predicate === input.predicate);

  if (input.source_id) {
    claims = claims.filter((c) => {
      const record = ctx.store.resolveRecordById(c.subject_id);
      if (!record) return false;
      const si = (record as unknown as Record<string, unknown>)["source_identity"] as
        Record<string, unknown> | undefined;
      return si?.["source_id"] === input.source_id;
    });
  }

  if (input.assertion_state) {
    claims = claims.filter((c) => c.assertion_state === input.assertion_state);
  }

  const sorted = [...claims].sort((a, b) => {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  const { items, nextCursor } = paginate(
    sorted.map((c) => ({ ...c, key: c.id, id: c.id })),
    ctx.canonicalHash,
    filters,
    input.cursor,
    limit,
  );

  return envelope(ctx, {
    predicate: input.predicate,
    total: sorted.length,
    claims: items.map((c) => {
      const record = ctx.store.resolveRecordById(c.subject_id);
      return {
        claim_id: c.id,
        subject_record_id: c.subject_id,
        subject_record_key: record?.key ?? null,
        subject_record_type: record?.record_type ?? null,
        predicate: c.predicate,
        object_ref: c.object_ref ?? null,
        value: c.value ?? null,
        assertion_state: c.assertion_state,
        evidence_refs: c.evidence_refs,
      };
    }),
    cursor: nextCursor,
  });
}

/**
 * Resolve member records of a cross-game concept via ancestry.derived_from.
 */
export function getConceptMembers(
  ctx: McpContext,
  input: { record_id?: string; key?: string; cursor?: string; limit?: number },
) {
  if (!input.record_id && !input.key) {
    throw new ValidationError("Exactly one of record_id or key is required");
  }
  if (input.record_id && input.key) {
    throw new ValidationError("Only one of record_id or key is allowed");
  }

  let concept;
  if (input.record_id) {
    concept = ctx.store.resolveRecordById(input.record_id);
  } else {
    concept = ctx.store.resolveRecordByKey(input.key!);
  }

  if (!concept) {
    throw new NotFoundError(`Concept not found: ${input.record_id ?? input.key}`);
  }
  if (concept.record_type !== "concept") {
    throw new ValidationError(`Record is not a concept: ${concept.record_type}`);
  }

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

  const ancestry = (concept as unknown as Record<string, unknown>)["ancestry"] as
    Record<string, unknown> | undefined;
  const derivedFrom = (ancestry?.["derived_from"] as string[]) ?? [];

  const members = derivedFrom
    .map((urn) => ctx.store.resolveRecordById(urn))
    .filter((r) => r !== undefined);

  const grouped: Record<string, { record_id: string; record_key: string; record_type: string; title: string | null }[]> = {};
  for (const m of members) {
    const si = (m as unknown as Record<string, unknown>)["source_identity"] as
      Record<string, unknown> | undefined;
    const sid = (si?.["source_id"] as string) ?? "unknown";
    if (!grouped[sid]) grouped[sid] = [];
    grouped[sid].push({
      record_id: m.id,
      record_key: m.key,
      record_type: m.record_type,
      title: typeof (m as unknown as Record<string, unknown>)["title"] === "string"
        ? (m as unknown as Record<string, unknown>)["title"] as string
        : null,
    });
  }

  const sortedMembers = [...members].sort((a, b) => {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  const { items, nextCursor } = paginate(
    sortedMembers.map((r) => ({ ...r, key: r.key, id: r.id })),
    ctx.canonicalHash,
    {},
    input.cursor,
    limit,
  );

  return envelope(ctx, {
    concept_id: concept.id,
    concept_key: concept.key,
    concept_title: (concept as unknown as Record<string, unknown>)["title"] ?? null,
    total_members: members.length,
    members_by_source: Object.fromEntries(
      Object.entries(grouped).map(([sid, recs]) => [sid, { count: recs.length, records: recs }]),
    ),
    members: items.map((r) => ({
      record_id: r.id,
      record_key: r.key,
      record_type: r.record_type,
      title: (r as unknown as Record<string, unknown>)["title"] ?? null,
    })),
    cursor: nextCursor,
  });
}

/**
 * Get tension pairs involving a specific design primitive or pressure.
 */
export function getDesignTensions(
  ctx: McpContext,
  input: { record_key?: string; record_id?: string; cursor?: string; limit?: number },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

  let tensions = ctx.store.relations.filter(
    (r) => r.relation_type === "tensions_with",
  );

  let targetId: string | null = null;
  if (input.record_id) {
    targetId = input.record_id;
  } else if (input.record_key) {
    const record = ctx.store.resolveRecordByKey(input.record_key);
    if (!record) {
      throw new NotFoundError(`Record not found: ${input.record_key}`);
    }
    targetId = record.id;
  }

  if (targetId) {
    tensions = tensions.filter(
      (r) => r.source_record_id === targetId || r.target_record_id === targetId,
    );
  }

  const sorted = [...tensions].sort((a, b) => {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  const { items, nextCursor } = paginate(
    sorted.map((r) => ({ ...r, key: r.id, id: r.id })),
    ctx.canonicalHash,
    {},
    input.cursor,
    limit,
  );

  return envelope(ctx, {
    total: sorted.length,
    tensions: items.map((r) => {
      const source = ctx.store.resolveRecordById(r.source_record_id);
      const target = ctx.store.resolveRecordById(r.target_record_id);

      const sourceCounterplay = ctx.store.relations
        .filter((cr) => cr.relation_type === "HAS_COUNTERPLAY" && cr.source_record_id === r.source_record_id)
        .map((cr) => {
          const cp = ctx.store.resolveRecordById(cr.target_record_id);
          return cp ? { record_id: cp.id, record_key: cp.key, title: (cp as unknown as Record<string, unknown>)["title"] ?? null } : null;
        })
        .filter(Boolean);

      const targetCounterplay = ctx.store.relations
        .filter((cr) => cr.relation_type === "HAS_COUNTERPLAY" && cr.source_record_id === r.target_record_id)
        .map((cr) => {
          const cp = ctx.store.resolveRecordById(cr.target_record_id);
          return cp ? { record_id: cp.id, record_key: cp.key, title: (cp as unknown as Record<string, unknown>)["title"] ?? null } : null;
        })
        .filter(Boolean);

      return {
        relation_id: r.id,
        source: source
          ? { record_id: source.id, record_key: source.key, title: (source as unknown as Record<string, unknown>)["title"] ?? null }
          : null,
        target: target
          ? { record_id: target.id, record_key: target.key, title: (target as unknown as Record<string, unknown>)["title"] ?? null }
          : null,
        counterplay: {
          source: sourceCounterplay,
          target: targetCounterplay,
        },
      };
    }),
    cursor: nextCursor,
  });
}

/**
 * Cross-game structured attribute search.
 * Find records where a specific attribute key matches a value (exact or contains).
 */
export function findByAttribute(
  ctx: McpContext,
  input: {
    attribute: string;
    value: string;
    match_mode?: "exact" | "contains";
    source_id?: string;
    record_type?: string;
    kind?: string;
    cursor?: string;
    limit?: number;
  },
) {
  if (!input.attribute) {
    throw new ValidationError("attribute is required");
  }
  if (!input.value) {
    throw new ValidationError("value is required");
  }

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const matchMode = input.match_mode ?? "exact";
  const filters: Record<string, unknown> = { attribute: input.attribute, value: input.value };
  if (input.source_id) filters.source_id = input.source_id;
  if (input.record_type) filters.record_type = input.record_type;
  if (input.kind) filters.kind = input.kind;

  const targetValue = input.value.toLowerCase();

  let records = ctx.store.records.filter((r) => {
    if (input.record_type && r.record_type !== input.record_type) return false;

    if (input.source_id) {
      const si = (r as unknown as Record<string, unknown>)["source_identity"] as
        Record<string, unknown> | undefined;
      if (si?.["source_id"] !== input.source_id) return false;
    }

    if (input.kind) {
      const k = (r as unknown as Record<string, unknown>)["kind"];
      if (k !== input.kind) return false;
    }

    const attrs = (r as unknown as Record<string, unknown>)["attributes"];
    if (!attrs || typeof attrs !== "object") return false;

    const attrObj = attrs as Record<string, unknown>;
    const attrVal = attrObj[input.attribute];
    if (attrVal === undefined || attrVal === null) return false;

    if (Array.isArray(attrVal)) {
      const matched = attrVal.some((v) => {
        const s = String(v).toLowerCase();
        return matchMode === "exact" ? s === targetValue : s.includes(targetValue);
      });
      if (!matched) return false;
    } else if (typeof attrVal === "string") {
      const parts = attrVal.split("|").map((s) => s.trim().toLowerCase());
      const matched = parts.some((p) =>
        matchMode === "exact" ? p === targetValue : p.includes(targetValue),
      );
      if (!matched) return false;
    } else {
      const s = String(attrVal).toLowerCase();
      if (matchMode === "exact" ? s !== targetValue : !s.includes(targetValue)) return false;
    }

    return true;
  });

  const { items, nextCursor } = paginate(
    records.map((r) => ({ ...r, key: r.key, id: r.id })),
    ctx.canonicalHash,
    filters,
    input.cursor,
    limit,
  );

  return envelope(ctx, {
    attribute: input.attribute,
    value: input.value,
    match_mode: matchMode,
    total: records.length,
    records: items.map((r) => {
      const si = (r as unknown as Record<string, unknown>)["source_identity"] as
        Record<string, unknown> | undefined;
      const attrs = (r as unknown as Record<string, unknown>)["attributes"] as
        Record<string, unknown> | undefined;
      return {
        record_id: r.id,
        record_key: r.key,
        record_type: r.record_type,
        source_id: si?.["source_id"] ?? null,
        title: (r as unknown as Record<string, unknown>)["title"] ?? null,
        matched_value: attrs?.[input.attribute] != null ? String(attrs[input.attribute]) : null,
      };
    }),
    cursor: nextCursor,
  });
}
