# Security and Source Safety

## Trust Levels

| Level | Description |
|---|---|
| Trusted | IB repository code, reviewed extractor code, Forge/Werkstatt packages |
| Untrusted | All source payloads, source filenames/content, external documents, archives |
| Non-authority | Generated projections, caches, Laboratory state |

## Source Parsing Safety

- Treat filenames and text as hostile input
- Prevent path traversal and symlink escape
- Impose configurable file-size/decompression limits
- Never evaluate JavaScript/Python/Lua/etc from source
- Use safe YAML loader with custom tags disabled
- Do not deserialize language-native object formats that execute constructors
- Do not expose process environment/secrets to source parsing code
- Network access is unnecessary for certified extraction

## Secret Handling

- `.env` and credential files are not committed
- Release gate scans canonical/projection/release artifacts for secrets
- Source publication policy and secret redaction apply even for public source repositories

## Hash Integrity

SHA-256 proves byte identity relative to scanned data. Authenticity of an upstream repository/version is a separate concern represented by repository metadata, VCS commit and source-bundle maintenance process.

## Reporting

Report security issues by contacting the project maintainer. Do not file public issues for security vulnerabilities.
