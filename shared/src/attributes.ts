import { ATTRIBUTE_KEYS, ATTR_MAX, ATTR_MIN, POINT_BUDGET, type Attributes } from "./types.js";

export interface ValidationResult { valid: boolean; error?: string; }

export function validateAttributes(attrs: Attributes): ValidationResult {
  const ranges = validateAttributeRanges(attrs);
  if (!ranges.valid) return ranges;
  let sum = 0;
  for (const key of ATTRIBUTE_KEYS) sum += attrs[key];
  if (sum !== POINT_BUDGET) return { valid: false, error: `Total deve ser ${POINT_BUDGET}, obtido ${sum}` };
  return { valid: true };
}

export function validateAttributeRanges(attrs: Attributes): ValidationResult {
  for (const key of ATTRIBUTE_KEYS) {
    const v = attrs[key];
    if (typeof v !== "number" || !Number.isInteger(v)) return { valid: false, error: `${key} deve ser inteiro` };
    if (v < ATTR_MIN || v > ATTR_MAX) return { valid: false, error: `${key} fora do intervalo ${ATTR_MIN}-${ATTR_MAX}` };
  }
  return { valid: true };
}
