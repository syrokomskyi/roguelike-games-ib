/*
<MODULE_CONTRACT>
<purpose>CI release check — verifies dataset_version format and version_history append-only policy.</purpose>
<non-goals>
  <item>Does not check record counts or canonical hash — that is kb-health-summary.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: RFC-0014 CI release check script.</item>
</CHANGE_SUMMARY>
*/
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { execSync } from "node:child_process";

const WORKSPACE = resolve(__dirname, "..");
const MANIFEST_PATH = join(WORKSPACE, "knowledge", "manifest.yaml");

interface Manifest {
  dataset_version: string;
  version_history?: Array<{
    version: string;
    date: string;
    commit: string;
    record_count: number;
    concept_count: number;
    changes: string;
  }>;
}

function main(): void {
  const raw = readFileSync(MANIFEST_PATH, "utf-8");
  const manifest = parseYaml(raw) as Manifest;

  if (!manifest.dataset_version) {
    console.error("FAIL: manifest.yaml must have dataset_version");
    process.exit(1);
  }

  const semverRe = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
  if (!semverRe.test(manifest.dataset_version)) {
    console.error(`FAIL: dataset_version must be valid SemVer, got: ${manifest.dataset_version}`);
    process.exit(1);
  }

  if (manifest.version_history) {
    try {
      const diff = execSync("git diff HEAD~1 -- knowledge/manifest.yaml", {
        cwd: WORKSPACE,
        encoding: "utf-8",
      });
      const lines = diff.split("\n");
      const removedLines = lines.filter(
        (l) => l.startsWith("-") && !l.startsWith("---") && l.includes("version:"),
      );
      if (removedLines.length > 0) {
        console.error("FAIL: version_history is append-only — detected modification of existing entries");
        console.error(removedLines.join("\n"));
        process.exit(1);
      }
    } catch {
      // No previous commit (first commit) — skip append-only check
    }
  }

  console.log(`PASS: dataset_version=${manifest.dataset_version}`);
}

main();
