import type { ChatFn } from "../ai/openai";
import type { VisualStyleBible, ConsistencyReport } from "@ravenloft/content";
import { EVALUATOR_SYSTEM_PROMPT, parseConsistencyReport } from "../ai/visual/evaluator";

export async function runEvaluator(chat: ChatFn, _image: Buffer, _references: Buffer[], prompt: string, styleBible: VisualStyleBible): Promise<ConsistencyReport> {
  const user = `Bíblia Visual: ${styleBible.renderingStyle}; ${styleBible.lightingRules}; paleta ${styleBible.colorPalette}.\nPrompt usado:\n${prompt}\n\nAvalie a consistência e responda em JSON.`;
  const raw = await chat(EVALUATOR_SYSTEM_PROMPT, user, true, 800);
  return parseConsistencyReport(raw);
}
