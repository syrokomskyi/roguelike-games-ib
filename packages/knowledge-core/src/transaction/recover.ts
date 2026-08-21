/*
<MODULE_CONTRACT>
<purpose>Recovers interrupted transactions by rolling back uncommitted operations using stored backups.</purpose>
<non-goals>
  <item>Does not apply transactions — recovery and rollback only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: recoverInterruptedTransaction with backup restoration and rollback.</item>
</CHANGE_SUMMARY>
*/
import { existsSync, readFileSync, rmSync, renameSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { TransactionPlan, TransactionStatus } from "./plan.ts";
import { canonicalJsonParse } from "../canonical-json.ts";

/**
 * Recover an interrupted transaction.
 *
 * If the transaction status is not COMMITTED, roll back all operations
 * by restoring backups.
 */
export function recoverInterruptedTransaction(
  transactionId: string,
  stagingRoot: string,
  canonicalRoot: string,
): { status: TransactionStatus; recovered: boolean } {
  const txDir = join(stagingRoot, "transactions");
  const planPath = join(txDir, `${transactionId}.json`);

  if (!existsSync(planPath)) {
    return { status: "FAILED", recovered: false };
  }

  const raw = readFileSync(planPath, "utf-8");
  const stored = canonicalJsonParse(raw) as TransactionPlan & { status: TransactionStatus };

  if (stored.status === "COMMITTED") {
    return { status: "COMMITTED", recovered: false };
  }

  // Rollback: restore backups
  for (const op of stored.operations) {
    const targetPath = join(canonicalRoot, op.record_type, `${op.key}.jsonl`);
    const backupPath = join(txDir, `${transactionId}.backup.${op.key}.jsonl`);

    if (op.type === "create") {
      // Remove created file
      if (existsSync(targetPath)) {
        rmSync(targetPath);
      }
    } else if (op.type === "replace" || op.type === "delete") {
      // Restore backup
      if (existsSync(backupPath)) {
        copyFileSync(backupPath, targetPath);
        rmSync(backupPath);
      } else if (op.type === "delete" && existsSync(targetPath)) {
        // No backup means the file didn't exist before — remove it
        rmSync(targetPath);
      }
    }
  }

  // Mark as rolled back
  return { status: "ROLLED_BACK", recovered: true };
}
