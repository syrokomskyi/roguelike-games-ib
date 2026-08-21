# @roguelike-games-ib/knowledge-schemas

Loads/compiles the canonical schema registry and exposes runtime validators + TypeScript types.

## Responsibilities

- Load schema registry from `knowledge/ontology/schema-registry.yaml`
- Compile JSON Schema Draft 2020-12 schemas using AJV
- Resolve `$id`/`$ref` only from registered schemas
- Reject duplicate schema IDs
- Expose validation functions

## Schema Truth

Schema truth lives in `knowledge/ontology/schema-registry.yaml` and the referenced schema files. Generated artifacts are derived.
