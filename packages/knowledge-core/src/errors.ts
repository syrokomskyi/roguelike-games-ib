/*
<MODULE_CONTRACT>
<purpose>Defines typed error classes for knowledge-core domains — source root, metadata, identity, evidence, graph, transaction, and schema validation.</purpose>
<non-goals>
  <item>Does not handle error recovery — error classes only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: KnowledgeCoreError base and domain-specific subclasses with error codes.</item>
</CHANGE_SUMMARY>
*/
export class KnowledgeCoreError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "KnowledgeCoreError";
  }
}

export class SourceRootError extends KnowledgeCoreError {
  constructor(message: string, details?: unknown) {
    super(message, "SOURCE_ROOT_ERROR", details);
    this.name = "SourceRootError";
  }
}

export class SourceMetadataError extends KnowledgeCoreError {
  constructor(message: string, details?: unknown) {
    super(message, "SOURCE_METADATA_ERROR", details);
    this.name = "SourceMetadataError";
  }
}

export class IdentityError extends KnowledgeCoreError {
  constructor(message: string, details?: unknown) {
    super(message, "IDENTITY_ERROR", details);
    this.name = "IdentityError";
  }
}

export class EvidenceError extends KnowledgeCoreError {
  constructor(message: string, details?: unknown) {
    super(message, "EVIDENCE_ERROR", details);
    this.name = "EvidenceError";
  }
}

export class GraphIntegrityError extends KnowledgeCoreError {
  constructor(message: string, details?: unknown) {
    super(message, "GRAPH_INTEGRITY_ERROR", details);
    this.name = "GraphIntegrityError";
  }
}

export class TransactionError extends KnowledgeCoreError {
  constructor(message: string, details?: unknown) {
    super(message, "TRANSACTION_ERROR", details);
    this.name = "TransactionError";
  }
}

export class SchemaValidationError extends KnowledgeCoreError {
  constructor(message: string, details?: unknown) {
    super(message, "SCHEMA_VALIDATION_ERROR", details);
    this.name = "SchemaValidationError";
  }
}
