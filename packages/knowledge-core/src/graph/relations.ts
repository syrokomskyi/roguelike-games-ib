import { GraphIntegrityError } from "../errors.ts";

export interface RelationRecord {
  id: string;
  relation_type: string;
  source_record_id: string;
  target_record_id: string;
  relation_scope: "game" | "cross_game" | "design";
  evidence_refs: string[];
}

export interface RelationTypeDefinition {
  id: string;
  semantics: string;
  direction: "directed" | "symmetric";
  inverse?: string;
  evidence_required: boolean;
  domain: string[];
  range: string[];
}

/**
 * Validate that all relation endpoints exist and relation types are registered.
 */
export function validateRelations(
  relations: RelationRecord[],
  knownIds: Set<string>,
  knownRecordTypes: Map<string, string>,
  relationTypes: Map<string, RelationTypeDefinition>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const rel of relations) {
    // Check relation type is registered
    const typeDef = relationTypes.get(rel.relation_type);
    if (!typeDef) {
      errors.push(`Relation ${rel.id}: unknown relation type '${rel.relation_type}'`);
      continue;
    }

    // Check endpoints exist
    if (!knownIds.has(rel.source_record_id)) {
      errors.push(`Relation ${rel.id}: dangling source_record_id '${rel.source_record_id}'`);
    }
    if (!knownIds.has(rel.target_record_id)) {
      errors.push(`Relation ${rel.id}: dangling target_record_id '${rel.target_record_id}'`);
    }

    // Check domain/range
    const sourceType = knownRecordTypes.get(rel.source_record_id);
    const targetType = knownRecordTypes.get(rel.target_record_id);

    if (sourceType && !typeDef.domain.includes(sourceType)) {
      errors.push(
        `Relation ${rel.id}: domain violation — source record_type '${sourceType}' not in [${typeDef.domain.join(", ")}]`,
      );
    }
    if (targetType && !typeDef.range.includes(targetType)) {
      errors.push(
        `Relation ${rel.id}: range violation — target record_type '${targetType}' not in [${typeDef.range.join(", ")}]`,
      );
    }

    // Check evidence requirement
    if (typeDef.evidence_required && rel.evidence_refs.length === 0) {
      errors.push(`Relation ${rel.id}: relation type '${rel.relation_type}' requires evidence`);
    }

    // Check evidence refs exist
    for (const evidenceRef of rel.evidence_refs) {
      if (!knownIds.has(evidenceRef)) {
        errors.push(`Relation ${rel.id}: dangling evidence_ref '${evidenceRef}'`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
