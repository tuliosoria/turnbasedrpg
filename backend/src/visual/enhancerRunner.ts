import type { ChatFn } from "../ai/openai";
import type { VisualContextPackage } from "../ai/visual/contextCompiler";
import { ENHANCER_SYSTEM_PROMPT, buildEnhancerUser, parseEnhancedBrief } from "../ai/visual/promptEnhancer";

/** Rewrites the author's request as a concrete visual brief. 400 tokens is
 *  ample for the 120-word paragraph the system prompt asks for. */
export async function runEnhancer(chat: ChatFn, pkg: VisualContextPackage): Promise<string> {
  const raw = await chat(ENHANCER_SYSTEM_PROMPT, buildEnhancerUser(pkg), false, 400);
  return parseEnhancedBrief(raw);
}
