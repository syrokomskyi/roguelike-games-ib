#!/usr/bin/env bash
# Pre-commit hook: run extractor quality tests when extractor files change.
# Installed automatically via `pnpm prepare` (see package.json).

set -euo pipefail

# --install mode: copy this script into .git/hooks/pre-commit
if [ "${1:-}" = "--install" ]; then
  HOOK_DIR="$(git rev-parse --git-dir)/hooks"
  mkdir -p "$HOOK_DIR"
  cp "$0" "$HOOK_DIR/pre-commit"
  chmod +x "$HOOK_DIR/pre-commit"
  echo "✅ Pre-commit hook installed to $HOOK_DIR/pre-commit"
  exit 0
fi

# Detect changes in extractor packages or quality test directory
CHANGED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '^(packages/extractors/|tests/extractor-quality/)' || true)

if [ -z "$CHANGED" ]; then
  exit 0
fi

echo "🔍 Extractor files changed — running quality tests..."
echo ""

# Run guard test + all quality tests
pnpm exec vitest run tests/extractor-quality/ --reporter=verbose

RESULT=$?

if [ $RESULT -ne 0 ]; then
  echo ""
  echo "❌ Extractor quality tests failed. Commit blocked."
  echo "   Fix the failures above, then re-stage and commit."
  echo "   To bypass temporarily: git commit --no-verify"
  exit 1
fi

echo ""
echo "✅ Extractor quality tests passed."
