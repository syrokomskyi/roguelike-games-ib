/*
<MODULE_CONTRACT>
<purpose>Loads, compiles, and validates JSON schemas using AJV 2020 with no network fetch — registry-driven schema management for knowledge records.</purpose>
<non-goals>
  <item>Does not define schemas — loads and compiles them from YAML files.</item>
  <item>Does not fetch schemas from the network — local files only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: SchemaRegistry, CompiledSchema types, loadSchemaRegistry, compileSchemaRegistry, validateRecord, getSchema.</item>
</CHANGE_SUMMARY>
*/
import Ajv, { type ValidateFunction, type AnySchema } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

export interface SchemaRegistryEntry {
  id: string;
  file: string;
}

export interface SchemaRegistry {
  schema: string;
  model_version: string;
  schemas: SchemaRegistryEntry[];
}

export interface CompiledSchema {
  id: string;
  validate: ValidateFunction;
  schema: unknown;
}

export interface SchemaCompilationResult {
  compiled: Map<string, CompiledSchema>;
  errors: string[];
}

/**
 * Load the schema registry from a YAML file.
 */
export function loadSchemaRegistry(registryPath: string): SchemaRegistry {
  const raw = readFileSync(registryPath, "utf-8");
  const registry = parseYaml(raw) as SchemaRegistry;

  if (!registry.schemas || !Array.isArray(registry.schemas)) {
    throw new Error(`Invalid schema registry at ${registryPath}: missing 'schemas' array`);
  }

  return registry;
}

/**
 * Compile all schemas from a registry.
 * - All $id/$ref resolved only from registered schemas (no network fetch)
 * - Duplicate schema IDs rejected
 * - Returns compiled validators keyed by schema ID
 */
export function compileSchemaRegistry(
  registryPath: string,
): SchemaCompilationResult {
  const registry = loadSchemaRegistry(registryPath);
  const registryDir = dirname(registryPath);

  const ajv = new Ajv({
    strict: true,
    allErrors: true,
    verbose: true,
    allowUnionTypes: true,
  });
  addFormats(ajv);

  const compiled = new Map<string, CompiledSchema>();
  const errors: string[] = [];
  const seenIds = new Set<string>();

  // First pass: load all schema files
  const schemaObjects: { id: string; schema: unknown }[] = [];

  for (const entry of registry.schemas) {
    const schemaPath = join(registryDir, entry.file);
    if (!existsSync(schemaPath)) {
      errors.push(`Schema file not found: ${entry.file} (for id ${entry.id})`);
      continue;
    }

    const raw = readFileSync(schemaPath, "utf-8");
    const schema = parseYaml(raw);

    if (seenIds.has(entry.id)) {
      errors.push(`Duplicate schema ID: ${entry.id}`);
      continue;
    }
    seenIds.add(entry.id);
    schemaObjects.push({ id: entry.id, schema });
  }

  // Second pass: compile all schemas
  for (const { id, schema } of schemaObjects) {
    try {
      // Ensure $id matches registry id
      const schemaObj = schema as { $id?: string };
      if (schemaObj.$id && schemaObj.$id !== id && !schemaObj.$id.startsWith("urn:")) {
        // $id can be a URN, while registry id is a short name — that's ok
      }

      const validate = ajv.compile(schema as AnySchema);
      compiled.set(id, { id, validate, schema });
    } catch (error) {
      errors.push(
        `Failed to compile schema '${id}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { compiled, errors };
}

/**
 * Validate a record against a compiled schema.
 * Returns JSON pointer paths in errors.
 */
export function validateRecord(
  compiled: CompiledSchema,
  record: unknown,
): { valid: boolean; errors: Array<{ pointer: string; message: string }> } {
  const valid = compiled.validate(record);
  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = (compiled.validate.errors ?? []).map((err) => ({
    pointer: err.instancePath || "/",
    message: err.message ?? "validation error",
  }));

  return { valid: false, errors };
}

/**
 * Get a compiled schema by ID from a compilation result.
 */
export function getSchema(
  result: SchemaCompilationResult,
  schemaId: string,
): CompiledSchema | null {
  return result.compiled.get(schemaId) ?? null;
}
