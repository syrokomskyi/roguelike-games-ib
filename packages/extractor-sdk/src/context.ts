/*
<MODULE_CONTRACT>
<purpose>Creates a schema facade that validates records against compiled JSON schemas, with a null-implementation for schema-less contexts.</purpose>
<non-goals>
  <item>Does not compile schemas — receives pre-compiled schemas from the caller.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: schema facade with validate and hasSchema, plus null facade.</item>
</CHANGE_SUMMARY>
*/
import type { CompiledSchema } from "@roguelike-games-ib/knowledge-schemas";

export interface SchemaFacade {
  validate(recordKind: string, record: unknown): { valid: boolean; errors: Array<{ pointer: string; message: string }> };
  hasSchema(recordKind: string): boolean;
}

export function createSchemaFacade(
  schemas: Map<string, CompiledSchema>,
): SchemaFacade {
  return {
    validate(recordKind: string, record: unknown) {
      const compiled = schemas.get(recordKind);
      if (!compiled) {
        return {
          valid: false,
          errors: [{ pointer: "/", message: `No schema registered for kind: ${recordKind}` }],
        };
      }
      const valid = compiled.validate(record);
      if (valid) {
        return { valid: true, errors: [] };
      }
      const errors = (compiled.validate.errors ?? []).map((err) => ({
        pointer: err.instancePath || "/",
        message: err.message ?? "validation error",
      }));
      return { valid: false, errors };
    },
    hasSchema(recordKind: string) {
      return schemas.has(recordKind);
    },
  };
}

export function createNullSchemaFacade(): SchemaFacade {
  return {
    validate() {
      return { valid: true, errors: [] };
    },
    hasSchema() {
      return false;
    },
  };
}
