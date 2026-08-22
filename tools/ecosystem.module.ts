/*
<MODULE_CONTRACT>
<purpose>Provides the local ecosystem.commit bridge until the upstream Werkstatt command is published.</purpose>
<non-goals>
  <item>Does not stage files or alter the commit message supplied by the caller.</item>
</non-goals>
<CHANGE_SUMMARY>
  <item>Initial local bridge for the documented ecosystem.commit workflow.</item>
</CHANGE_SUMMARY>
*/
import { execFileSync } from "node:child_process";
import type { KernelModule } from "@warpgogol/werkstatt/kernel/types";

export const ecosystemModule: KernelModule = {
  name: "ecosystem",
  version: "0.1.0",
  register(registry) {
    registry.registerCommand({
      name: "ecosystem.commit",
      description: "Commits the files already staged in the workspace.",
      scope: "workspace",
      mutatesState: true,
      cacheable: false,
      flags: {
        message: { kind: "string", required: true, description: "Conventional commit message." },
      },
      execute(input, context) {
        const message = input.flags.message;
        if (typeof message !== "string") throw new Error("--message must be a single commit message.");
        if (context.dryRun) return { summary: `Would commit staged files: ${message}` };

        execFileSync("git", ["commit", "-m", message], {
          cwd: context.workspaceRoot,
          encoding: "utf8",
          stdio: "pipe",
        });
        return { summary: `Committed staged files: ${message}` };
      },
    });
  },
};
