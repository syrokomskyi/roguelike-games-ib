/*
<MODULE_CONTRACT>
<purpose>Client-side dossier generation for the Laboratory page — maps sensations to design primitives, pressures, mutation vectors, concrete examples, ancestry trail, and design tensions using build-time concept data (RFC-0013).</purpose>
<non-goals>
  <item>Does not perform LLM enhancement — web app uses template fallback only.</item>
  <item>Does not perform embedding search — unknown sensations return an empty dossier with a message.</item>
  <item>Does not fetch data — receives concept data as input from the page.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0013: Initial creation — generateDossier, isExcluded, templateWhyRelevant.</item>
</CHANGE_SUMMARY>
*/
import { SENSATION_MAP } from "./sensation-map";

export interface ConceptData {
  key: string;
  title: string;
  definition: string;
  concept_type: string;
  quality_score: { coverage: number; evidence: number; richness: number; overall: number } | null;
  concrete_examples: { game: string; description: string }[] | null;
  ancestry: { source_games: string[]; derived_from: string[] } | null;
}

export interface RelationData {
  source_key: string;
  target_key: string;
  relation_type: string;
  rationale: string | null;
}

export interface DossierConcept {
  key: string;
  title: string;
  definition: string;
  quality_score: { coverage: number; evidence: number; richness: number; overall: number } | null;
  why_relevant: string;
}

export interface DossierMutationVector {
  key: string;
  title: string;
  definition: string;
  available_knobs: string[];
}

export interface DossierExample {
  game: string;
  primitive: string;
  example: string;
}

export interface DossierOutput {
  sensation: string;
  context: string | null;
  excluded: string[];
  dossier: {
    relevant_primitives: DossierConcept[];
    relevant_pressures: DossierConcept[];
    mutation_vectors: DossierMutationVector[];
    concrete_examples: DossierExample[];
    excluded_mechanics_filtered: { requested_exclusion: string; filtered_concepts: string[] }[];
    ancestry_trail: { step: number; type: "source_structure" | "mutation" | "possibility"; ref: string; description: string }[];
    design_tensions: { tension: string; description: string }[];
  };
}

function templateWhyRelevant(title: string, definition: string, sensation: string): string {
  return `${title} contributes to ${sensation} because it ${definition}`;
}

function isExcluded(concept: ConceptData, excluded: string[]): { excluded: boolean; matchedTerm: string | null } {
  if (excluded.length === 0) return { excluded: false, matchedTerm: null };
  const title = concept.title.toLowerCase();
  const definition = concept.definition.toLowerCase();
  const key = concept.key.toLowerCase();
  for (const term of excluded) {
    const lower = term.toLowerCase();
    if (title.includes(lower) || definition.includes(lower) || key.includes(lower)) {
      return { excluded: true, matchedTerm: term };
    }
  }
  return { excluded: false, matchedTerm: null };
}

export function generateDossier(
  sensation: string,
  context: string | null,
  excluded: string[],
  concepts: ConceptData[],
  relations: RelationData[],
): DossierOutput {
  const sensationEntry = SENSATION_MAP[sensation.toLowerCase()];

  const conceptByKey = new Map<string, ConceptData>();
  for (const c of concepts) conceptByKey.set(c.key, c);

  let primitiveKeys: string[] = [];
  let pressureKeys: string[] = [];

  if (sensationEntry) {
    primitiveKeys = sensationEntry.primitives;
    pressureKeys = sensationEntry.pressures;
  }

  const excludedMechanicsFiltered: { requested_exclusion: string; filtered_concepts: string[] }[] = [];
  const filterExcluded = (key: string): boolean => {
    const concept = conceptByKey.get(key);
    if (!concept) return false;
    const result = isExcluded(concept, excluded);
    if (result.excluded && result.matchedTerm) {
      const existing = excludedMechanicsFiltered.find((e) => e.requested_exclusion === result.matchedTerm);
      if (existing) {
        if (!existing.filtered_concepts.includes(key)) existing.filtered_concepts.push(key);
      } else {
        excludedMechanicsFiltered.push({ requested_exclusion: result.matchedTerm, filtered_concepts: [key] });
      }
      return false;
    }
    return true;
  };

  const activePrimitiveKeys = primitiveKeys.filter(filterExcluded);
  const activePressureKeys = pressureKeys.filter(filterExcluded);

  const buildDossierConcept = (key: string): DossierConcept | null => {
    const concept = conceptByKey.get(key);
    if (!concept) return null;
    return {
      key,
      title: concept.title,
      definition: concept.definition,
      quality_score: concept.quality_score,
      why_relevant: templateWhyRelevant(concept.title, concept.definition, sensation),
    };
  };

  const relevantPrimitives = activePrimitiveKeys
    .map(buildDossierConcept)
    .filter((c): c is DossierConcept => c !== null);

  const relevantPressures = activePressureKeys
    .map(buildDossierConcept)
    .filter((c): c is DossierConcept => c !== null);

  const mutationVectors: DossierMutationVector[] = [];
  const ancestryTrail: { step: number; type: "source_structure" | "mutation" | "possibility"; ref: string; description: string }[] = [];
  let stepCounter = 1;

  for (const primKey of activePrimitiveKeys) {
    const primConcept = conceptByKey.get(primKey);
    if (!primConcept) continue;

    ancestryTrail.push({
      step: stepCounter++,
      type: "source_structure",
      ref: primKey,
      description: `Canonical primitive: ${primConcept.title}`,
    });

    for (const rel of relations) {
      if (rel.relation_type !== "HAS_MUTATION_VECTOR" || rel.source_key !== primKey) continue;
      const mutConcept = conceptByKey.get(rel.target_key);
      if (!mutConcept) continue;

      if (!filterExcluded(mutConcept.key)) continue;

      const knobs: string[] = [];
      for (const knobRel of relations) {
        if (knobRel.relation_type !== "IMPLEMENTED_AS" || knobRel.source_key !== mutConcept.key) continue;
        knobs.push(knobRel.target_key);
      }

      mutationVectors.push({
        key: mutConcept.key,
        title: mutConcept.title,
        definition: mutConcept.definition,
        available_knobs: knobs,
      });

      ancestryTrail.push({
        step: stepCounter++,
        type: "mutation",
        ref: mutConcept.key,
        description: `Mutation axis: ${mutConcept.title}`,
      });

      for (const knobKey of knobs) {
        if (!filterExcluded(knobKey)) continue;
        const knobConcept = conceptByKey.get(knobKey);
        ancestryTrail.push({
          step: stepCounter++,
          type: "possibility",
          ref: knobKey,
          description: `Possibility: ${knobConcept?.title ?? knobKey}`,
        });
      }
    }
  }

  const concreteExamples: DossierExample[] = [];
  for (const primKey of activePrimitiveKeys) {
    const primConcept = conceptByKey.get(primKey);
    if (!primConcept?.concrete_examples) continue;
    for (const ex of primConcept.concrete_examples) {
      concreteExamples.push({
        game: ex.game,
        primitive: primKey,
        example: ex.description,
      });
    }
  }

  const designTensions: { tension: string; description: string }[] = [];
  const tensionPairs = new Set<string>();
  for (const pressureKey of activePressureKeys) {
    for (const rel of relations) {
      if (rel.relation_type !== "tensions_with") continue;
      if (rel.source_key !== pressureKey && rel.target_key !== pressureKey) continue;
      const sourceConcept = conceptByKey.get(rel.source_key);
      const targetConcept = conceptByKey.get(rel.target_key);
      if (!sourceConcept || !targetConcept) continue;
      const pairKey = [rel.source_key, rel.target_key].sort().join(" ↔ ");
      if (tensionPairs.has(pairKey)) continue;
      tensionPairs.add(pairKey);
      designTensions.push({
        tension: `${sourceConcept.title} ↔ ${targetConcept.title}`,
        description: rel.rationale || `${sourceConcept.title} and ${targetConcept.title} create a design tension`,
      });
    }
  }

  return {
    sensation,
    context,
    excluded,
    dossier: {
      relevant_primitives: relevantPrimitives,
      relevant_pressures: relevantPressures,
      mutation_vectors: mutationVectors,
      concrete_examples: concreteExamples,
      excluded_mechanics_filtered: excludedMechanicsFiltered,
      ancestry_trail: ancestryTrail,
      design_tensions: designTensions,
    },
  };
}
