import { ATTRIBUTE_KEYS, ATTR_MAX, ATTR_MIN, POINT_BUDGET, type Attributes } from "./types.js";

export interface ValidationResult { valid: boolean; error?: string; }

export function validateAttributes(attrs: Attributes): ValidationResult {
  let sum = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const v = attrs[key];
    if (typeof v !== "number" || !Number.isInteger(v)) return { valid: false, error: `${key} deve ser inteiro` };
    if (v < ATTR_MIN || v > ATTR_MAX) return { valid: false, error: `${key} fora do intervalo 0-5` };
    sum += v;
  }
  if (sum !== POINT_BUDGET) return { valid: false, error: `Total deve ser ${POINT_BUDGET}, obtido ${sum}` };
  return { valid: true };
}
