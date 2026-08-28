import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TextoComPessoas } from "./TextoComPessoas";
import { WikiMarkdown } from "./WikiMarkdown";

function mostrar(no: React.ReactNode) {
  return render(<MemoryRouter>{no}</MemoryRouter>);
}

describe("nome de gente vira link", () => {
  // A pergunta que originou tudo: "eu não lembrava quem era Dama Elara".
  it("leva o leitor até a ficha de quem ele não reconheceu", () => {
    mostrar(<TextoComPessoas texto="A Dama Elara Voss fechou os portões ao amanhecer." />);
    expect(screen.getByRole("link", { name: "Elara" })).toHaveAttribute(
      "href",
      "/personagens/dama-elara-voss",
    );
  });

  it("não altera uma vírgula do texto", () => {
    const texto = "Selma escreveu a Elara sobre Alic, e ninguém respondeu.";
    const { container } = mostrar(<TextoComPessoas texto={texto} />);
    expect(container.textContent).toBe(texto);
  });

  it("linka a primeira menção e deixa as outras em paz", () => {
    mostrar(<TextoComPessoas texto="Elara mandou aviso. Elara não esperou resposta." />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("não transforma o nome de uma Casa em pessoa", () => {
    mostrar(<TextoComPessoas texto="A Casa Karasoy recusou o tributo." />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("dentro do texto do turno", () => {
  it("linka nomes no meio de um parágrafo de markdown", () => {
    mostrar(<WikiMarkdown body="O conselho ouviu **em silêncio** quando Elara falou." />);
    expect(screen.getByRole("link", { name: "Elara" })).toHaveAttribute(
      "href",
      "/personagens/dama-elara-voss",
    );
  });

  it("não mexe no link que o autor escreveu", () => {
    mostrar(<WikiMarkdown body="Veja [o relatório de Elara](/valdren/cronica)." />);
    const link = screen.getByRole("link", { name: "o relatório de Elara" });
    expect(link).toHaveAttribute("href", "/valdren/cronica");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("deixa o título do verbete em paz", () => {
    mostrar(<WikiMarkdown body="# Elara Voss\n\nUm parágrafo qualquer." />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
