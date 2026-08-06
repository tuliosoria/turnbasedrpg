import type { VisualStyleBible, VisualEntity } from "@ravenloft/content";

export interface VisualContextPackage {
  styleBible: VisualStyleBible;
  entity: VisualEntity | null;
  entityName: string;
  entityType: string;
  immutableTraits: string[];
  flexibleTraits: string[];
  prohibitedChanges: string[];
  visualKeywords: string[];
  negativeInstructions: string[];
  scaleDescription: string;
  canonicalCanon: string;
  userRequest: string;
  isLocked: boolean;
}

export interface CompileContextInput {
  styleBible: VisualStyleBible;
  entity: VisualEntity | null;
  canonicalCanon: string;
  userRequest: string;
}

export function compileVisualContext(input: CompileContextInput): VisualContextPackage {
  const e = input.entity;
  return {
    styleBible: input.styleBible,
    entity: e,
    entityName: e?.canonicalName ?? "",
    entityType: e?.entityType ?? "SCENE",
    immutableTraits: e?.immutableTraits ?? [],
    flexibleTraits: e?.flexibleTraits ?? [],
    prohibitedChanges: e?.prohibitedChanges ?? [],
    visualKeywords: e?.visualKeywords ?? [],
    negativeInstructions: [...(input.styleBible.globalNegativeInstructions ?? []), ...(e?.negativeInstructions ?? [])],
    scaleDescription: e?.scaleDescription ?? "",
    canonicalCanon: input.canonicalCanon,
    userRequest: input.userRequest,
    isLocked: e?.status === "LOCKED",
  };
}
