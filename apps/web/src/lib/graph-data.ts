/*
<MODULE_CONTRACT>
<purpose>Build graph nodes and edges from ProjectionStore for the interactive D3 force-directed design-space graph.</purpose>
<non-goals>
  <item>Does not fetch or mutate data — pure projection over ProjectionStore.</item>
  <item>Does not render the graph — only produces serializable data for the client.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0015: Initial creation — buildGraphData returning { nodes, edges } for D3 force-directed graph.</item>
</CHANGE_SUMMARY>
*/
import type { ProjectionStore } from "@roguelike-games-ib/projection-sdk";
import { designRelationTypes } from "./design-data";

export interface GraphNode {
  id: string;
  key: string;
  label: string;
  type: string;
  qualityScore: number | null;
  gamesPresent: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export function buildGraphData(store: ProjectionStore): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const allConcepts = store.records.filter((r) => r.record_type === "concept");

  const nodes: GraphNode[] = allConcepts.map((r) => {
    const ra = r as Record<string, unknown>;
    const anc = ra["ancestry"] as Record<string, unknown> | undefined;
    const qs = ra["quality_score"] as { overall: number } | undefined;
    return {
      id: r.id,
      key: r.key,
      label: (ra["title"] as string | null) ?? r.key,
      type: (ra["concept_type"] as string) ?? "unknown",
      qualityScore: qs?.overall ?? null,
      gamesPresent: (anc?.["source_games"] as string[]) ?? [],
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));

  const designRelations = store.relations.filter(
    (r) =>
      (r.relation_scope === "design" || r.relation_scope === "cross_game") &&
      designRelationTypes.has(r.relation_type),
  );

  const edges: GraphEdge[] = designRelations
    .filter((rel) => nodeIds.has(rel.source_record_id) && nodeIds.has(rel.target_record_id))
    .map((rel) => ({
      source: rel.source_record_id,
      target: rel.target_record_id,
      type: rel.relation_type,
    }));

  return { nodes, edges };
}
