# Roguelike Games Inspiration Base — Dataset Card

## Overview

- **Name**: Roguelike Games Inspiration Base
- **Version**: 1.0.0
- **License**: CC-BY-4.0
- **Repository**: https://github.com/syrokomskyi/roguelike-games-ib

## Composition

- **Games**: 4 (BrogueCE, Cataclysm-BN, Dungeon Crawl Stone Soup, NetHack)
- **Records**: 22,476 definitions, 469 concepts, 113,291 claims, 35,839 relations
- **Data types**: creatures, items, spells, abilities, species, professions, vaults, branches, traps, skills, artifacts, gods, brands, effects, martial arts, forms, bionics, recipes, factions, roles, races, dungeon branches

## Collection method

- **Extractors**: TypeScript adapters parsing game source files (YAML, JSON, C headers)
- **Methodology**: RFC-0001 — one source object = one record, factual extraction without loss
- **Evidence**: Every record has source file + line range evidence anchor
- **Coverage**: All dimensions exhaustive_for_binding (see coverage files in `knowledge/coverage/`)

## Quality

- **Coverage**: All dimensions exhaustive_for_binding (see coverage files)
- **Concepts**: 469 cross-game concepts with quality scores (RFC-0009)
- **Conformance**: 688 tests, 94 test files
- **Canonical hash**: SHA-256 of all records, claims, relations, and contradictions

## Limitations

- 4 games only (no ToME4, Caves of Qud, etc.)
- No balance data (damage numbers are extracted but not normalized)
- No playtest data (design analysis is structural, not experiential)
- English-only record text

## Citation

See `CITATION.bib` for BibTeX citation format.
