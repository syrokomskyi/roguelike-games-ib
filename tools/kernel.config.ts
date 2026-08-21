import { defineKernelConfig } from "@warpgogol/werkstatt/kernel/types";
import { werkstattKnowledgePlugin } from "@warpgogol/werkstatt-knowledge";

export default defineKernelConfig({
  name: "roguelike-games-ib",
  moduleLoaders: {
    "forge-core": async () =>
      (await import("@warpgogol/forge/os/core")).forgeCoreModule,
    ...werkstattKnowledgePlugin.moduleLoaders,
  },
});

// Compatibility note:
// Stage 0 MUST compile this against the currently installed Forge/Werkstatt.
// If certified component wiring supersedes plugin@1, adapt this thin file only
// under ADR; do not reintroduce a second source of knowledge semantics.
// Adaptation: werkstattKnowledgePlugin.moduleLoaders spread into kernel config
// because WerkstattPlugin is not itself a KernelModule — it contributes moduleLoaders.
