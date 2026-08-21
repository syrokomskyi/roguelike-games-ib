# Roguelike Games Inspiration Base

An evidence-backed, machine-verifiable inspiration system that draws creative inspiration from roguelike games and channels it toward artists.

## Authority Warning

**`knowledge/` is the only canonical knowledge authority.** All other directories (`staging/`, `laboratory/`, `projections/`, `.generated/`, Web, MCP, Obsidian) are non-authoritative projections or creative layers. Never edit canonical knowledge directly through projections.

## Quickstart

```bash
pnpm install
pnpm test
```

## Source Data

Source repositories live in `../roguelike-games-ib-source/` and are **read-only** to this project. The source root is derived from the canonical manifest id + `-source` suffix. Arbitrary source path overrides are forbidden in certified mode.

## License

The canonical dataset is published under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.

Source payload licenses are independent from the dataset license and are not re-licensed by this project.

## Documentation

- [Governance decisions](docs/adrs/)
- [RFC proposals](docs/rfcs/)
- [Implementation specifications](docs/specs/)
