import { describe, expect, it } from "vitest";
import { ELENCO_ANTIGO, ELENCO_NOVO, blocoDoLider, trocarPeloFarao } from "./solarion-farao-wiki.mjs";

const PERSONA = {
  leaderName: "Faraó Gloriandur",
  title: "Soberano de Solarion",
  temperament: "Governa com a memória do pai.",
  refuses: "Nunca exporá seus habitantes.",
};

function verbete(elenco) {
  return [
    "### Personagens principais",
    "",
    elenco,
    "- **Issen Tal:** diretor do Observatório das Sete Sombras.",
    "",
    "## Dossiê",
    "",
    "155.000 habitantes",
    "",
    "## Quem responde pela Casa",
    "",
    "**Lady Samira Solarion**, Governante de Sahra-Lun. Orgulhosa.",
    "",
    "- **Recusa:** Nada que humilhe a Casa.",
  ].join("\n");
}

describe("trocarPeloFarao", () => {
  it("põe o Faraó no lugar da Lady e tira a Comandante Zahra", () => {
    const novo = trocarPeloFarao(verbete(ELENCO_ANTIGO), PERSONA);
    expect(novo).toContain("**Faraó Gloriandur:** soberano de Solarion");
    expect(novo).not.toContain("Lady Samira");
    expect(novo).not.toContain("Zahra al-Nur");
  });

  it("traz a corte que o Mestre aprovou", () => {
    const novo = trocarPeloFarao(verbete(ELENCO_ANTIGO), PERSONA);
    for (const nome of ["Princesa Akumon", "Príncipe Mithrakar", "General Atherion"]) {
      expect(novo).toContain(nome);
    }
  });

  // All Marifh continua no elenco: o jogador o reescreveu, não o apagou.
  it("mantém All Marifh, agora como amigo pessoal do Faraó", () => {
    const novo = trocarPeloFarao(verbete(ELENCO_ANTIGO), PERSONA);
    expect(novo).toContain("**All Marifh:** conselheiro e amigo pessoal do Faraó");
  });

  it("não mexe em quem o cânone do jogador não tocou", () => {
    const novo = trocarPeloFarao(verbete(ELENCO_ANTIGO), PERSONA);
    expect(novo).toContain("**Issen Tal:** diretor do Observatório das Sete Sombras.");
  });

  // O bloco final dizia que quem responde pela Casa era a Lady; deixá-lo faria o
  // verbete se contradizer três parágrafos depois da troca.
  it("passa a assinar o verbete com o Faraó", () => {
    const novo = trocarPeloFarao(verbete(ELENCO_ANTIGO), PERSONA);
    expect(novo).toContain("**Faraó Gloriandur**, Soberano de Solarion.");
    expect(novo).toContain("- **Recusa:** Nunca exporá seus habitantes.");
  });

  it("preserva o Dossiê, que fica antes do bloco do líder", () => {
    const novo = trocarPeloFarao(verbete(ELENCO_ANTIGO), PERSONA);
    expect(novo).toContain("155.000 habitantes");
  });

  it("escreve o bloco no formato que rewrite-house-wiki.mjs gera", () => {
    expect(blocoDoLider(PERSONA)).toBe(
      "## Quem responde pela Casa\n\n**Faraó Gloriandur**, Soberano de Solarion. Governa com a memória do pai.\n\n- **Recusa:** Nunca exporá seus habitantes.",
    );
  });

  it("rodar de novo não muda mais nada", () => {
    const uma = trocarPeloFarao(verbete(ELENCO_ANTIGO), PERSONA);
    expect(trocarPeloFarao(uma, PERSONA)).toBe(uma);
  });

  it("recusa um verbete cujo texto publicado mudou de forma", () => {
    expect(() => trocarPeloFarao("### Personagens principais\n\n- **Outro:** alguém.", PERSONA))
      .toThrow(/nem o elenco antigo nem o novo/);
  });

  it("recusa um verbete sem o bloco de quem responde pela Casa", () => {
    const semBloco = `### Personagens principais\n\n${ELENCO_NOVO}`;
    expect(() => trocarPeloFarao(semBloco, PERSONA)).toThrow(/quem responde pela Casa/);
  });
});
