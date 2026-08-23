/*
<MODULE_CONTRACT>
<purpose>Creates a dataset release — bumps version, updates manifest, creates git tag, optionally creates GitHub release.</purpose>
<non-goals>
  <item>Does not run automatically in CI — manual operator action only.</item>
  <item>Does not publish to external registries.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: RFC-0014 release script with version bump, tag creation, GitHub release.</item>
</CHANGE_SUMMARY>
*/
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { execSync } from "node:child_process";

const WORKSPACE = resolve(__dirname, "..");
const MANIFEST_PATH = join(WORKSPACE, "knowledge", "manifest.yaml");

interface VersionHistoryEntry {
  version: string;
  date: string;
  commit: string;
  record_count: number;
  concept_count: number;
  changes: string;
}

interface Manifest {
  dataset_version: string;
  version_history?: VersionHistoryEntry[];
  [key: string]: unknown;
}

interface ReleaseOptions {
  bump: "major" | "minor" | "patch";
  dryRun?: boolean;
}

function parseArgs(): ReleaseOptions {
  const args = process.argv.slice(2);
  let bump: "major" | "minor" | "patch" | null = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--bump" && args[i + 1]) {
      bump = args[i + 1] as "major" | "minor" | "patch";
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  if (!bump) {
    console.error("Usage: pnpm exec tsx scripts/create-release.ts --bump <major|minor|patch> [--dry-run]");
    process.exit(1);
  }

  return { bump, dryRun };
}

function bumpVersion(current: string, type: "major" | "minor" | "patch"): string {
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Current version "${current}" is not valid SemVer`);
  }
  const [, major, minor, patch] = match;
  if (type === "major") return `${Number(major) + 1}.0.0`;
  if (type === "minor") return `${major}.${Number(minor) + 1}.0`;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

function checkWorkingTreeClean(): void {
  const status = execSync("git status --porcelain", { cwd: WORKSPACE, encoding: "utf-8" }).trim();
  if (status) {
    console.error("ERROR: Working tree is dirty. Commit or stash changes first.");
    console.error(status);
    process.exit(1);
  }
}

function checkTagExists(version: string): void {
  const tag = `v${version}`;
  try {
    execSync(`git rev-parse ${tag}`, { cwd: WORKSPACE, encoding: "utf-8", stdio: "pipe" });
    console.error(`ERROR: Tag ${tag} already exists.`);
    process.exit(1);
  } catch {
    // Tag doesn't exist — good
  }
}

function getShortCommit(): string {
  return execSync("git rev-parse --short HEAD", { cwd: WORKSPACE, encoding: "utf-8" }).trim();
}

function getRecordCount(): number {
  const distManifest = join(WORKSPACE, ".generated", "knowledge", "dist", "manifest.json");
  if (!existsSync(distManifest)) {
    console.warn("WARNING: dist/manifest.json not found. Record count will be 0. Run `pnpm materialize` first.");
    return 0;
  }
  const dist = JSON.parse(readFileSync(distManifest, "utf-8"));
  return (dist.recordCounts?.records ?? 0) as number;
}

function getConceptCount(): number {
  const distManifest = join(WORKSPACE, ".generated", "knowledge", "dist", "manifest.json");
  if (!existsSync(distManifest)) return 0;
  const dist = JSON.parse(readFileSync(distManifest, "utf-8"));
  return (dist.recordCounts?.coverage ?? 0) as number;
}

function generateReleaseNotes(lastTag: string | null): string {
  const range = lastTag ? `${lastTag}..HEAD` : "HEAD~20..HEAD";
  try {
    const log = execSync(`git log ${range} --oneline --no-decorate`, { cwd: WORKSPACE, encoding: "utf-8" }).trim();
    return log || "No commits since last release.";
  } catch {
    return "No commits since last release.";
  }
}

function checkGhAvailable(): boolean {
  try {
    execSync("gh auth status", { encoding: "utf-8", stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function main(): void {
  const opts = parseArgs();
  const raw = readFileSync(MANIFEST_PATH, "utf-8");
  const manifest = parseYaml(raw) as Manifest;
  const currentVersion = manifest.dataset_version;
  const newVersion = bumpVersion(currentVersion, opts.bump);
  const history = manifest.version_history ?? [];
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  const lastTag = lastEntry ? `v${lastEntry.version}` : null;

  console.log("=== Dataset Release ===");
  console.log(`Current version: ${currentVersion}`);
  console.log(`New version:     ${newVersion}`);
  console.log(`Bump type:       ${opts.bump}`);
  console.log(`Dry run:         ${opts.dryRun ?? false}`);
  console.log();

  if (lastEntry) {
    const currentRecords = getRecordCount();
    const delta = currentRecords - lastEntry.record_count;
    console.log(`Last release:    ${lastEntry.version} (${lastEntry.date}, ${lastEntry.record_count.toLocaleString()} records)`);
    console.log(`Record delta:    ${delta >= 0 ? "+" : ""}${delta}`);
    console.log();
  }

  const releaseNotes = generateReleaseNotes(lastTag);
  console.log("Release notes:");
  console.log(releaseNotes);
  console.log();

  if (opts.dryRun) {
    console.log("DRY RUN — no changes will be made.");
    console.log(`Would update: ${MANIFEST_PATH}`);
    console.log(`Would create tag: v${newVersion}`);
    if (checkGhAvailable()) {
      console.log("Would create GitHub release via gh CLI.");
    } else {
      console.log("gh CLI not available — would skip GitHub release.");
    }
    return;
  }

  checkWorkingTreeClean();
  checkTagExists(newVersion);

  const shortCommit = getShortCommit();
  const recordCount = getRecordCount();
  const conceptCount = getConceptCount();
  const today = new Date().toISOString().slice(0, 10);

  const newEntry: VersionHistoryEntry = {
    version: newVersion,
    date: today,
    commit: shortCommit,
    record_count: recordCount,
    concept_count: conceptCount,
    changes: `Release ${newVersion}`,
  };

  manifest.dataset_version = newVersion;
  manifest.version_history = [...history, newEntry];

  const updated = stringifyYaml(manifest);
  writeFileSync(MANIFEST_PATH, updated, "utf-8");
  console.log(`Updated manifest: ${MANIFEST_PATH}`);

  execSync(`git add ${MANIFEST_PATH}`, { cwd: WORKSPACE });
  execSync(`git commit -m "release: dataset v${newVersion}"`, { cwd: WORKSPACE });
  console.log(`Committed manifest update.`);

  const tag = `v${newVersion}`;
  execSync(`git tag ${tag}`, { cwd: WORKSPACE });
  console.log(`Created tag: ${tag}`);

  if (checkGhAvailable()) {
    try {
      const notesFile = join(WORKSPACE, ".generated", "release-notes.txt");
      writeFileSync(notesFile, releaseNotes, "utf-8");
      execSync(`gh release create ${tag} --title "Dataset ${newVersion}" --notes-file ${notesFile}`, { cwd: WORKSPACE });
      console.log(`Created GitHub release: ${tag}`);
    } catch (err) {
      console.warn(`WARNING: Failed to create GitHub release: ${err}`);
      console.warn("You can create it manually: gh release create v{version} --title 'Dataset {version}' --notes '...'");
    }
  } else {
    console.log("gh CLI not available or not authenticated.");
    console.log(`To create a GitHub release manually:`);
    console.log(`  gh release create ${tag} --title "Dataset ${newVersion}" --notes "..."`);
  }

  console.log();
  console.log(`Release ${newVersion} complete.`);
}

main();
