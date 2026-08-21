/*
<MODULE_CONTRACT>
<purpose>Defines transaction operation, plan, diagnostic, and status types, with a factory to prepare promotion plans.</purpose>
<non-goals>
  <item>Does not apply or recover transactions — plan preparation only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: TransactionOperation, TransactionPlan, TransactionDiagnostic, TransactionStatus types and preparePromotion factory.</item>
</CHANGE_SUMMARY>
*/
export interface TransactionOperation {
  type: "create" | "replace" | "delete";
  record_id: string;
  record_type: string;
  key: string;
  data: unknown;
}

export interface TransactionPlan {
  manifest: {
    transaction_id: string;
    source_id: string | null;
    created_at: string;
    operations_count: number;
  };
  operations: TransactionOperation[];
  pre_hashes: Record<string, string>;
  post_hashes: Record<string, string>;
  diagnostics: TransactionDiagnostic[];
  backup_path: string | null;
}

export interface TransactionDiagnostic {
  id: string;
  severity: "ERROR" | "WARN" | "INFO";
  message: string;
  record_id?: string;
  file?: string;
}

export type TransactionStatus = "PREPARED" | "APPLYING" | "COMMITTED" | "ROLLED_BACK" | "FAILED";

/**
 * Prepare a transaction plan.
 */
export function preparePromotion(
  transactionId: string,
  sourceId: string | null,
  operations: TransactionOperation[],
  preHashes: Record<string, string>,
): TransactionPlan {
  return {
    manifest: {
      transaction_id: transactionId,
      source_id: sourceId,
      created_at: new Date().toISOString(),
      operations_count: operations.length,
    },
    operations,
    pre_hashes: preHashes,
    post_hashes: {},
    diagnostics: [],
    backup_path: null,
  };
}
