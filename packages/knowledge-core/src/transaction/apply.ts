/*
<MODULE_CONTRACT>
<purpose>Applies promotion transactions atomically with lock, backup, temp-write, and atomic rename, marking status as COMMITTED or FAILED.</purpose>
<non-goals>
  <item>Does not plan transactions — use plan module.</item>
  <item>Does not recover interrupted transactions — use recover module.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: applyPromotionTransaction with backup, atomic rename, and error diagnostics.</item>
</CHANGE_SUMMARY>
*/
import { existsSync, mkdirSync, renameSync, writeFileSync, readFileSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { TransactionPlan, TransactionStatus } from "./plan.ts";
import { TransactionLock } from "./lock.ts";
import { TransactionError } from "../errors.ts";
import { canonicalJsonStringify } from "../canonical-json.ts";

/**
 * Apply a promotion transaction atomically.
 *
 * Protocol:
 * 1. Acquire lock
 * 2. Write transaction plan to staging/transactions/<id>.json
 * 3. Backup affected files
 * 4. Write new files to temp locations
 * 5. Atomic rename temp -> final
 * 6. Mark transaction as COMMITTED
 * 7. Release lock
 *
 * On crash before COMMITTED: recoverInterruptedTransaction rolls back.
 */
export function applyPromotionTransaction(
  plan: TransactionPlan,
  canonicalRoot: string,
  stagingRoot: string,
): { status: TransactionStatus; plan: TransactionPlan } {
  const lock = new TransactionLock(join(stagingRoot, "transactions"));
    lock.acquire(plan.manifest.transaction_id);

  try {
    // Write transaction plan
    const txDir = join(stagingRoot, "transactions");
    if (!existsSync(txDir)) {
      mkdirSync(txDir, { recursive: true });
    }
    const planPath = join(txDir, `${plan.manifest.transaction_id}.json`);
    writeFileSync(planPath, canonicalJsonStringify({ ...plan, status: "APPLYING" as TransactionStatus }), "utf-8");

    // Backup and apply operations
    const backups: Record<string, string> = {};

    for (const op of plan.operations) {
      const targetPath = join(canonicalRoot, op.record_type, `${op.key}.jsonl`);
      const targetDir = dirname(targetPath);
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      // Backup if file exists
      if (op.type !== "create" && existsSync(targetPath)) {
        const backupPath = join(txDir, `${plan.manifest.transaction_id}.backup.${op.key}.jsonl`);
        copyFileSync(targetPath, backupPath);
        backups[op.key] = backupPath;
      }

      if (op.type === "delete") {
        if (existsSync(targetPath)) {
          rmSync(targetPath);
        }
      } else {
        // Write to temp then atomic rename
        const tempPath = `${targetPath}.tmp`;
        writeFileSync(tempPath, canonicalJsonStringify(op.data) + "\n", "utf-8");
        renameSync(tempPath, targetPath);
      }
    }

    // Mark as COMMITTED
    const committedPlan: TransactionPlan = {
      ...plan,
      backup_path: Object.keys(backups).length > 0
        ? join(txDir, `${plan.manifest.transaction_id}.backups`)
        : null,
    };
    writeFileSync(planPath, canonicalJsonStringify({ ...committedPlan, status: "COMMITTED" as TransactionStatus }), "utf-8");

    lock.release();
    return { status: "COMMITTED", plan: committedPlan };
  } catch (error) {
    lock.release();
    const failedPlan: TransactionPlan = {
      ...plan,
      diagnostics: [
        ...plan.diagnostics,
        {
          id: "TX_APPLY_ERROR",
          severity: "ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
    return { status: "FAILED", plan: failedPlan };
  }
}
