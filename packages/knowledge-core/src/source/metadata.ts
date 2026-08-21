import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { SourceMetadataError } from "../errors.ts";

export interface SourceMetadata {
  declared_version: string;
  version_scheme: "semver" | "date" | "git-describe" | "document" | "other";
  metadata_origin: "readme" | "package_json" | "both";
  vcs?: {
    repository: string | null;
    commit: string | null;
    clean: boolean | null;
  } | null;
}

interface ReadmeFrontmatter {
  version?: string;
  version_scheme?: string;
  vcs_repository?: string;
  vcs_commit?: string;
}

interface PackageJsonMetadata {
  version?: string;
  repository?: string | { url?: string };
}

/**
 * Parse README.md frontmatter for source metadata.
 */
function parseReadmeFrontmatter(readmePath: string): ReadmeFrontmatter {
  const content = readFileSync(readmePath, "utf-8");
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    throw new SourceMetadataError(
      `README.md at ${readmePath} has no YAML frontmatter`,
    );
  }

  return parseYaml(fmMatch[1]) as ReadmeFrontmatter;
}

/**
 * Parse package.json for source metadata.
 */
function parsePackageJsonMetadata(pkgPath: string): PackageJsonMetadata {
  const content = readFileSync(pkgPath, "utf-8");
  return JSON.parse(content) as PackageJsonMetadata;
}

/**
 * Read source metadata from a source unit directory.
 * Checks README.md frontmatter and/or package.json.
 */
export function readSourceMetadata(
  unitPath: string,
): SourceMetadata {
  const readmePath = join(unitPath, "README.md");
  const pkgJsonPath = join(unitPath, "package.json");

  const hasReadme = existsSync(readmePath);
  const hasPkgJson = existsSync(pkgJsonPath);

  if (!hasReadme && !hasPkgJson) {
    throw new SourceMetadataError(
      `Source unit at ${unitPath} has neither README.md nor package.json`,
    );
  }

  let readmeData: ReadmeFrontmatter | null = null;
  let pkgData: PackageJsonMetadata | null = null;

  if (hasReadme) {
    try {
      readmeData = parseReadmeFrontmatter(readmePath);
    } catch (e) {
      if (e instanceof SourceMetadataError) throw e;
      // README exists but no frontmatter — that's ok, fall back to package.json
    }
  }

  if (hasPkgJson) {
    pkgData = parsePackageJsonMetadata(pkgJsonPath);
  }

  // Determine metadata origin
  const hasReadmeVersion = readmeData?.version != null;
  const hasPkgVersion = pkgData?.version != null;

  if (hasReadmeVersion && hasPkgVersion) {
    // Check for mismatch
    if (readmeData!.version !== pkgData!.version) {
      throw new SourceMetadataError(
        `Version mismatch between README.md (${readmeData!.version}) and package.json (${pkgData!.version})`,
        { readmeVersion: readmeData!.version, pkgVersion: pkgData!.version },
      );
    }
  }

  if (!hasReadmeVersion && !hasPkgVersion) {
    throw new SourceMetadataError(
      `No version found in README.md or package.json at ${unitPath}`,
    );
  }

  const version = readmeData?.version ?? pkgData!.version!;
  const versionScheme = (readmeData?.version_scheme ?? "other") as SourceMetadata["version_scheme"];
  const metadataOrigin: SourceMetadata["metadata_origin"] =
    hasReadmeVersion && hasPkgVersion
      ? "both"
      : hasReadmeVersion
        ? "readme"
        : "package_json";

  const vcsRepo = readmeData?.vcs_repository ??
    (typeof pkgData?.repository === "string"
      ? pkgData.repository
      : pkgData?.repository?.url ?? null);

  return {
    declared_version: version,
    version_scheme: versionScheme,
    metadata_origin: metadataOrigin,
    vcs: vcsRepo
      ? { repository: vcsRepo, commit: readmeData?.vcs_commit ?? null, clean: null }
      : null,
  };
}
