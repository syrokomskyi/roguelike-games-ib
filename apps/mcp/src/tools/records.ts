/*
<MODULE_CONTRACT>
<purpose>Resolves a record by id or key, and resolves a key-or-alias to the current canonical record.</purpose>
<non-goals>
  <item>Does not search or list records — single-record lookup only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: get_record and resolve_key tool handlers.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { resolveRecord, resolveRecordById, resolveRecordByKey, resolveRecordByAlias } from "@roguelike-games-ib/projection-sdk";
import { NotFoundError, ValidationError } from "../errors.ts";

export function getRecord(
  ctx: McpContext,
  input: { id?: string; key?: string },
) {
  if (!input.id && !input.key) {
    throw new ValidationError("Exactly one of id or key is required");
  }
  if (input.id && input.key) {
    throw new ValidationError("Only one of id or key is allowed");
  }

  let record;
  if (input.id) {
    record = resolveRecordById(ctx.store, input.id);
  } else {
    record = resolveRecordByKey(ctx.store, input.key!);
  }

  if (!record) {
    throw new NotFoundError(`Record not found: ${input.id ?? input.key}`);
  }

  return envelope(ctx, {
    record_id: record.id,
    record_key: record.key,
    record_type: record.record_type,
    record: record,
  });
}

export function resolveKey(
  ctx: McpContext,
  input: { key_or_alias: string },
) {
  const record = resolveRecord(ctx.store, input.key_or_alias);
  if (!record) {
    throw new NotFoundError(`Cannot resolve: ${input.key_or_alias}`);
  }

  const isAlias = !resolveRecordByKey(ctx.store, input.key_or_alias)
    && !resolveRecordById(ctx.store, input.key_or_alias);

  return envelope(ctx, {
    record_id: record.id,
    record_key: record.key,
    record_type: record.record_type,
    resolved_from: isAlias ? "alias" : "key",
  });
}
