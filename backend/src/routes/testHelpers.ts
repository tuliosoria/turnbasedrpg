import { vi } from "vitest";
import type { ImageStore } from "../storage/images";

/**
 * Cria um fake completo de ImageStore para testes, permitindo sobrescrever
 * apenas os métodos relevantes para cada caso. Cada chamada gera novas instâncias
 * de vi.fn(), garantindo que testes distintos não compartilhem o mesmo spy.
 */
export function makeImageStoreFake(overrides: Partial<ImageStore> = {}): ImageStore {
  return {
    uploadTurnImage: vi.fn(),
    uploadHouseImage: vi.fn(),
    uploadVisualAsset: vi.fn(),
    uploadCanonImage: vi.fn().mockResolvedValue({ key: "", url: "" }),
    ...overrides,
  };
}
