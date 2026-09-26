import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as content from "../../shared/src/index.ts";
import { publicCodex } from "../../shared/src/npc/publicCodex.ts";
import { isChapterSource } from "./compile-book.mjs";

/**
 * Fórmulas que o jogador não pode ler como fato. O romance pode mostrar gente
 * chegando à Coroa antes da coroação; o que este teste barra é a frase de
 * cânone — Palius é a Coroa, destruí-la antes da coroação detém o Rei Branco —
 * e a psicologia definitiva de Alic (alma tocada, ouve o Rei Branco, sem empatia).
 */
const FORMULAS = [
  /sua alma foi tocada pelas brumas/i,
  /escuta a voz do rei branco/i,
  /não sente empatia/i,
  /sem empatia/i,
  /manipula sua mãe/i,
  /soberano absoluto/i,
  /destruí-la antes da coroação/i,
  /através do qual alic fala com o rei branco/i,
  /canonicamente é a própria coroa/i,
  /palius é a própria coroa/i,
  /presença que orienta alic/i,
];

const root = fileURLToPath(new URL("../../", import.meta.url));

async function markdowns(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await markdowns(child)));
    else if (entry.name.endsWith(".md")) out.push(child);
  }
  return out;
}

function textoDoBarrel(mod) {
  const partes = [];
  const vistos = new Set();
  const andar = (valor) => {
    if (typeof valor === "string") {
      partes.push(valor);
      return;
    }
    if (valor == null || typeof valor !== "object") return;
    if (vistos.has(valor)) return;
    vistos.add(valor);
    for (const item of Object.values(valor)) andar(item);
  };
  andar(mod);
  andar(publicCodex());
  return partes.join("\n");
}

function vazamentos(rotulo, texto) {
  return FORMULAS.filter((re) => re.test(texto)).map((re) => `${rotulo}: ${re}`);
}

describe("segredos de Alic e Palius fora do cânone do jogador", () => {
  it("PUBLICO, glossário público e barrel não trazem a fórmula", async () => {
    const publico = await markdowns(join(root, "valdren-context/PUBLICO"));
    const glossario = join(root, "valdren-context/17_GUIA_DE_ESTILO_GLOSSARIO_E_CONVENCOES.md");
    const arquivos = [...publico, glossario];
    const achados = [];
    for (const arquivo of arquivos) {
      const texto = await readFile(arquivo, "utf8");
      achados.push(...vazamentos(arquivo.slice(root.length), texto));
    }
    achados.push(...vazamentos("barrel público", textoDoBarrel(content)));
    expect(achados).toEqual([]);
  });

  it("MESTRE/15 continua com o que saiu do público", async () => {
    const mestre = await readFile(
      join(root, "valdren-context/MESTRE/15_SEGREDOS_CENTRAIS_E_CONSPIRACAO_DE_ASTERHALL.md"),
      "utf8",
    );
    expect(mestre).toMatch(/escuta a voz do Rei Branco/);
    expect(mestre).toMatch(/não sente empatia/);
    expect(mestre).toMatch(/destruí-la antes da coroação detém o Rei Branco/);
    expect(mestre).toMatch(/Canonicamente é a própria Coroa/);
    expect(mestre).toMatch(/presença que orienta Alic/);
  });

  it("DECISOES_E_PENDENCIAS não entra no compile-book nem repete a fórmula", async () => {
    const texto = await readFile(join(root, "livro/DECISOES_E_PENDENCIAS.md"), "utf8");
    expect(isChapterSource(texto)).toBe(false);
    expect(vazamentos("DECISOES_E_PENDENCIAS", texto)).toEqual([]);
  });
});
