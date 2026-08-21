/*
<MODULE_CONTRACT>
<purpose>Simple in-process file-based lock for transaction coordination to prevent concurrent promotions.</purpose>
<non-goals>
  <item>Does not implement distributed locking — single-process only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: TransactionLock class with acquire, release, isLocked.</item>
</CHANGE_SUMMARY>
*/
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { TransactionError } from "../errors.ts";

/**
 * Simple file-based lock for transaction coordination.
 */
export class TransactionLock {
  private locked = false;

  constructor(private readonly lockDir: string) {
    if (!existsSync(lockDir)) {
      mkdirSync(lockDir, { recursive: true });
    }
  }

  acquire(transactionId: string): void {
    if (this.locked) {
      throw new TransactionError(
        `Cannot acquire lock for transaction '${transactionId}': another transaction is in progress`,
      );
    }
    this.locked = true;
  }

  release(): void {
    this.locked = false;
  }

  isLocked(): boolean {
    return this.locked;
  }
}
