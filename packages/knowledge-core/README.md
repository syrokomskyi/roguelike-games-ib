# @roguelike-games-ib/knowledge-core

Domain-independent authority/persistence logic for the Roguelike Games Inspiration Base.

## Responsibilities

- Path resolution and config reading
- Canonical JSON/YAML serialization
- SHA-256 hashing and canonical tree hash
- Source metadata, fingerprint, binding digest, drift detection
- Identity registry (UUIDv7, keys, aliases, refresh matching)
- Evidence resolution, fragment hashing, re-anchoring
- Graph integrity (claims, relations, contradictions, references)
- Coverage computation
- Transaction/promotion engine with crash recovery

## Forbidden Dependencies

- Astro/MCP/UI packages
- Roguelike ontology helpers
- Source-specific parsers
- LLM SDKs
- Network clients in core verification paths
