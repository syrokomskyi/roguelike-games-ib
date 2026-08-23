# Roguelike Games Knowledge Base

**An open, evidence-backed map of roguelike game design.**

Explore what roguelike games contain, how their mechanics and systems actually work, how those systems interact — and what reusable design structures can be discovered across them.

> **Don't copy a mechanic. Understand why it works.**

Roguelike Games Knowledge Base is being built for game designers, developers, researchers, AI agents, and anyone interested in studying roguelikes below the surface level.

It is not just a wiki.

It is not a collection of AI-written summaries.

It is not a folder of source-code embeddings.

It is a structured knowledge system in which facts can be traced back to evidence, mechanics can be connected to the systems around them, games can be compared structurally, and verified design knowledge can become raw material for new ideas.

---

## What can you explore?

The project aims to make several levels of game knowledge searchable and connected.

### Games

Explore a game as a system:

- creatures, items, spells, terrain, effects, factions and other content;
- mechanics and rules;
- interacting systems;
- procedural generation;
- AI and behaviours;
- algorithms and invariants;
- unusual constraints;
- emergent behaviour;
- negative space — what a game deliberately does *not* do.

### Mechanics

Go beyond a mechanic's name.

Follow it through:

```text
player experience
        ↓
rules and state
        ↓
triggers
        ↓
mechanics
        ↓
systems
        ↓
interactions
        ↓
implementation
        ↓
source evidence
```

### Cross-game design

Ask questions such as:

- How do different roguelikes create pressure without a timer?
- Which mechanics turn information into a resource?
- How do games create uncertainty without hiding everything from the player?
- Which creatures change space instead of merely dealing damage?
- What different systems solve the same design problem?
- Which apparently unrelated mechanics share the same causal structure?

The goal is to compare **design structures**, not just feature lists.

### Inspiration

The project also contains a non-authoritative **Laboratory** for creative exploration.

Instead of asking:

> Which mechanic should I copy?

you can ask:

> What experience am I trying to create?

The system can use verified design knowledge, structural analogies, design pressures, mutation vectors, tensions, knobs, synergies and failure modes to explore new directions.

For example:

```text
"I need exploration to create anxiety,
but I don't want darkness, sanity,
hunger or durability."
```

The Laboratory can search for relevant design structures and transform them without pretending that the resulting idea exists in any source game.

**Facts remain facts. Generated ideas remain hypotheses.**

---

## Why this project exists

A traditional game wiki is very good at answering:

> What does this item do?

Source search can answer:

> Where is this implemented?

An LLM can suggest:

> Here are ten ideas.

Those are useful, but they leave a large space in between.

We want to be able to ask:

> Why does this system work?

> What other systems make it work?

> What design pressure does it address?

> Which games solve the same problem differently?

> What happens if we preserve the structure but change one of its fundamental dimensions?

That requires more than documents.

It requires a knowledge model.

---

## Evidence first

The project distinguishes between what is present in source material and what has been reconstructed or inferred from it.

Canonical knowledge carries explicit epistemic state and provenance.

A claim can be traced through a chain such as:

```text
claim
  ↓
evidence
  ↓
source artifact
  ↓
current registered source
```

Where publication policy permits it, evidence may include:

- source repository;
- source version or commit;
- source-relative path;
- symbol or structured-data key;
- line or span coordinates;
- content hash;
- a permitted short excerpt.

This makes it possible to ask not only:

> What does the database say?

but also:

> Why does the database say that?

---

## Canonical knowledge, not canonical Markdown

There is one authority boundary:

```text
knowledge/
```

`knowledge/` is the canonical dataset.

Everything else is either a working area or a projection.

```text
                              ┌── Web
                              │
                              ├── Obsidian
                              │
Source → extraction → KNOWLEDGE ─┼── Search
                              │
                              ├── MCP
                              │
                              └── Open Dataset

                    Laboratory
                         │
                         └── creative, non-authoritative
```

A Markdown page does not become true because somebody wrote it.

A search result does not become canonical because it is similar to another document.

An AI-generated design seed does not become evidence about a game.

These boundaries are enforced by the architecture and verifier.

---

## How knowledge enters the system

The project deliberately separates **extraction** from **understanding**.

### 1. Deterministic extraction

Enumerable facts should be extracted by deterministic adapters wherever the source permits it.

Examples include:

- creatures;
- items;
- terrain;
- spells;
- effects;
- recipes;
- classes;
- abilities;
- spawn definitions;
- structured generation data.

The extractor finds what exists.

### 2. Semantic reconstruction

Higher-level knowledge may require reconstruction across multiple parts of an implementation:

- mechanics;
- systems;
- interactions;
- algorithms;
- generators;
- invariants;
- emergence;
- cross-game concepts.

AI can assist with this work, but AI output is not automatically canonical.

It enters staging, retains evidence and epistemic metadata, and must pass the project's promotion and verification rules.

> **Parsers extract. AI understands. The verifier decides what is admissible.**

---

## Knowledge graph

Relationships are explicit and typed rather than inferred from document similarity alone.

Examples include relations such as:

```text
PART_OF
IMPLEMENTS
USES
REQUIRES
TRIGGERS
APPLIES_EFFECT
CONSUMES
PRODUCES
SPAWNS
MODIFIES
COUNTERS
SYNERGIZES_WITH
INHIBITS
GENERATED_BY
GOVERNED_BY
VARIANT_OF
MAPS_TO
```

This allows the project to reason over connected structures instead of treating knowledge as isolated notes.

---

## Repository architecture

The target repository is a TypeScript/pnpm Turborepo.

At a high level:

```text
roguelike-games-ib/
├── knowledge/                 # canonical knowledge authority
│   ├── sources/
│   ├── ontology/
│   ├── identity/
│   ├── games/
│   ├── cross-game/
│   └── design/
│
├── staging/                   # non-canonical candidates and transactions
├── laboratory/                # creative, non-authoritative state
│
├── packages/
│   ├── knowledge-core/
│   ├── knowledge-schemas/
│   ├── ontology-roguelike/
│   ├── extractor-sdk/
│   ├── extractors/
│   ├── materializer/
│   ├── projection-sdk/
│   ├── search/
│   ├── obsidian-builder/
│   └── laboratory-runtime/
│
├── apps/
│   ├── web/
│   └── mcp/
│
├── projections/
│   └── obsidian/              # generated
│
├── .generated/knowledge/      # generated, rebuildable artifacts
├── docs/
├── tests/
├── AGENTS.md
└── README.md
```

Generated projections are never knowledge authority.

---

## Source repositories

Third-party game sources do **not** live inside the knowledge-base repository as canonical data.

The expected local layout is:

```text
<parent>/
├── roguelike-games-ib/
└── roguelike-games-ib-source/
```

The source corpus is maintained independently and treated as **read-only evidence** by KB tooling.

```text
../roguelike-games-ib-source
```

Source-controlled code is not executed merely because it is present in the corpus.

Each source project retains its own license.

The KB dataset license does **not** re-license upstream game code, assets, documentation, screenshots or other third-party material.

---

## Technology

The current implementation contract uses:

- **TypeScript**
- **Node.js 22+**
- **pnpm**
- **Turborepo**
- **@warpgogol/forge / Werkstatt**
- **@warpgogol/werkstatt-knowledge**
- **JSON Schema 2020-12**
- **YAML + canonical JSONL**
- **SQLite + FTS5**
- typed graph relations
- optional derived vector search
- **Astro** for the Web projection
- official TypeScript **MCP SDK**
- **Vitest** for the reference test stack

Canonical data does not depend on a vector database, embedding provider, LLM provider or Web deployment platform.

Those are replaceable derived technologies.

---

## Quick start

### Requirements

You will need:

- Git;
- Node.js 22 or newer within the currently supported Forge/Werkstatt range;
- pnpm;
- a compatible Forge/Werkstatt installation;
- `werkstatt-knowledge` when required by the current project stage.

Clone the project and install dependencies:

```bash
git clone <repository-url> roguelike-games-ib
cd roguelike-games-ib
pnpm install --frozen-lockfile
```

Run the local verification suite:

```bash
pnpm verify
```

Run the full project checks:

```bash
pnpm check
```

Materialize canonical knowledge into the derived read model:

```bash
pnpm materialize
```

Build projections:

```bash
pnpm build:obsidian
pnpm build:web
pnpm build:mcp
```

Or build all configured projections:

```bash
pnpm build
```

Useful project commands include:

```text
pnpm check
pnpm verify
pnpm source:status
pnpm materialize
pnpm build:obsidian
pnpm build:web
pnpm build:mcp
pnpm build
pnpm coverage
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:conformance
pnpm release:check
pnpm release:evidence
```

Some source-enabled commands require the sibling `roguelike-games-ib-source` corpus.

---

## Web, Obsidian and MCP are projections

The same verified canonical knowledge is intended to power several interfaces.

### Web

The public Web application provides:

- Game Atlas;
- definition and mechanic explorers;
- evidence views;
- cross-game comparison;
- design-space exploration;
- Inspiration Laboratory;
- dataset and methodology pages.

### Obsidian

The Obsidian vault is generated for human exploration, backlinks and graph navigation.

It is a view of canonical knowledge, not an alternative place to maintain facts.

### MCP

The MCP application exposes a read-only semantic interface for AI agents and compatible tools.

Agents should query records, relations, evidence and structured search results rather than scrape generated Markdown as their primary data interface.

---

## Search

Search is designed as a hybrid retrieval system:

```text
query
  ↓
structured filters
  +
full-text search
  +
typed graph traversal
  +
optional vector retrieval
  ↓
evidence-aware results
```

Vector similarity is useful for discovery.

It is not itself a semantic relation and never becomes canonical evidence.

---

## Open dataset

The canonical knowledge dataset is intended to be downloadable and reusable independently of the website.

Public releases include machine-readable canonical and materialized data, version information, coverage, source bindings, verification evidence and checksums.

A release may contain:

```text
canonical knowledge
materialized records
claims
relations
public evidence metadata
coverage
source metadata
dataset manifest
release evidence
SHA-256 checksums
```

Third-party source payloads are excluded from dataset releases unless redistribution rights explicitly permit them.

For structured dataset metadata, see [`DATASET_CARD.md`](DATASET_CARD.md). For academic citation, see [`CITATION.bib`](CITATION.bib).

---

## Licensing

The project uses a clean dual-license separation:

| What | License |
| --- | --- |
| Source code of `roguelike-games-ib` itself | **Apache License 2.0** |
| Authored knowledge dataset | **CC BY 4.0** |
| Source code of studied games | Their own upstream licenses |
| Assets / screenshots / excerpts | Upstream license + publication policy |

### Source-code license

The repository's own software is licensed under:

**Apache License, Version 2.0**

- SPDX Identifier: Apache-2.0
- License URI: https://www.apache.org/licenses/LICENSE-2.0/

See `LICENSES/Apache-2.0.txt` for the full license text.

Apache 2.0 was chosen over MIT because the project involves substantial infrastructure, plugins, MCP integrations, extractors and third-party reuse — Apache 2.0 provides an explicit patent grant in addition to permissive reuse terms.

### Dataset license

The **canonical knowledge dataset** is licensed under:

**Creative Commons Attribution 4.0 International — CC BY 4.0**

- SPDX Identifier: CC-BY-4.0
- License URI: https://creativecommons.org/licenses/by/4.0/

This license applies to the project's authored knowledge dataset.

It does **not** change or replace the licenses of upstream games, source repositories, assets, documentation or other evidence material.

See `LICENSES/CC-BY-4.0.txt` and `NOTICE.dataset.md` for the complete dataset licensing and attribution information.

---

## Contributing

Contributions are welcome, but the project treats knowledge changes differently from ordinary documentation edits.

Please read:

```text
CONTRIBUTING.md
AGENTS.md
```

before making substantive changes.

### Documentation

- [Architecture Decision Records](docs/adrs/)
- [RFC proposals](docs/rfcs/)
- [Implementation specifications](docs/specs/)

In particular:

- do not edit generated projections as canonical knowledge;
- do not mutate source repositories through KB tooling;
- use deterministic extraction for enumerable source facts where possible;
- AI-generated semantic knowledge must enter through the governed candidate/promotion path;
- provide evidence for source-derived claims;
- preserve the distinction between canonical knowledge and Laboratory output;
- do not introduce global ontology changes without the required RFC/ADR;
- run the relevant verification and conformance gates before submitting a change.

A contribution should make the knowledge system **more trustworthy**, not merely larger.

---

## Working with AI agents

This repository is designed to be maintainable with AI-assisted engineering and research.

`AGENTS.md` defines the operational contract for agents working on the project.

Agents are expected to:

1. inspect source and canonical status;
2. determine the current implementation or migration stage;
3. extract enumerable facts deterministically;
4. reconstruct semantic knowledge with explicit evidence;
5. keep unverified work outside canonical authority;
6. promote changes only through verified transactions;
7. recompute coverage;
8. rebuild affected projections;
9. run the relevant gates;
10. report diagnostics, hashes, coverage changes and unresolved issues.

The repository should not depend on an agent being careful enough to remember every rule.

Where possible, invalid work should be structurally impossible or verifier-detectable.

---

## Project status

The project is under active development.

The implementation is intentionally proceeding through certified vertical slices rather than importing every game immediately.

The planned sequence includes:

1. canonical core and verifier;
2. deterministic extractor SDK;
3. materialization and projection contracts;
4. structured / full-text / graph / vector retrieval;
5. Obsidian projection;
6. read-only MCP;
7. Creator-facing Web application;
8. Laboratory runtime;
9. a real **BrogueCE** vertical slice;
10. a **Cataclysm-BN** scale trial;
11. implementation-contract freeze;
12. incremental migration of remaining sources.

Coverage is reported explicitly.

“Processed” is not treated as equivalent to “understood”, and incomplete knowledge should remain visibly incomplete.

---

## Principles

A few principles define the project:

**Evidence over recollection.**  
Claims about games should be traceable.

**Structure over summaries.**  
We want connected mechanics and systems, not only prose descriptions.

**Extraction before interpretation.**  
Machines should enumerate what machines can enumerate reliably.

**AI for understanding, not authority.**  
AI can reconstruct and explore; verification controls promotion.

**One canonical authority.**  
Web pages, search indexes and Obsidian notes are rebuildable projections.

**Creativity without epistemic confusion.**  
A new design idea can have ancestry without becoming a historical fact.

**Open knowledge without relicensing upstream work.**  
The dataset is open; third-party sources remain governed by their own licenses.

**Completeness must be measurable.**  
Unknowns and gaps are data, not embarrassing prose to hide.

---

## The long-term idea

A large enough collection of games should eventually become more than a collection of games.

It should expose recurring design primitives, alternative solutions, structural analogies, interactions, tensions and unexplored combinations.

```text
games
  ↓
facts
  ↓
mechanics
  ↓
systems
  ↓
interactions
  ↓
design structures
  ↓
cross-game design space
  ↓
new directions
```

The ambition is to build a machine-readable map of roguelike design that remains useful both when you want to know **exactly what a game does** and when you have no idea **what your own game should do next**.

---

## Security

Do not commit:

- credentials;
- API keys;
- local `.env` files;
- private source material;
- unlicensed third-party payloads.

Please follow `SECURITY.md` for reporting security or source-publication issues.

---

## Acknowledgements

Roguelikes have decades of accumulated design knowledge hidden in source code, data files, mechanics, experiments and interactions.

This project exists to study that body of work without flattening it into a list of features — and to make it more useful to the people creating what comes next.