# Web App (Astro)

## Purpose

Static web application for the Roguelike Inspiration Base. Renders record pages, design explorer, concepts index, compare view, and game pages from materialized projection data.

## Conventions

- **`getSourceId`**: Always use `getSourceId` from `page-data.ts` to extract `source_id` from a record. Do not reimplement the `source_identity` → `scope` fallback pattern inline. This is the single source of truth for source ID extraction.
- **`designRelationTypes`**: Exported from `design-data.ts`. Import and reuse — do not duplicate the set in components.
- **Compass scaffolding**: New non-trivial `.astro` components and pages must carry `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments at the top of the frontmatter.
- **Progressive enhancement**: Pages must work without JS. Client-side enhancements (filters, hover effects) use vanilla JS in `<script>` tags. UI frameworks (React, Vue, Svelte) are not used. Visualization libraries (e.g. D3.js) are allowed when they provide significant value over hand-written code.
- **Prefer existing packages**: Always use well-maintained npm packages instead of writing custom implementations. Do not reinvent the wheel — if a package solves the problem, use it. This applies to visualization (D3.js), search UI, formatting, parsing, and all other domains.
