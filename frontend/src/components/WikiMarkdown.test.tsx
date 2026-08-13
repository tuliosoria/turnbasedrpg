import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WikiMarkdown } from "./WikiMarkdown";

describe("WikiMarkdown", () => {
  it("renders emphasis, headings, blockquotes and lists without raw markdown markers", () => {
    render(
      <WikiMarkdown
        body={`> **Lema:** O céu observa.

### Cultura

O **valdreno comum** preserva *juramentos* antigos.

- Vale da Coroa
- Campos Dourados`}
      />,
    );

    expect(screen.getByText("Lema:").tagName.toLowerCase()).toBe("strong");
    expect(screen.getByRole("heading", { name: "Cultura", level: 4 })).toBeInTheDocument();
    expect(screen.getByText("valdreno comum").tagName.toLowerCase()).toBe("strong");
    expect(screen.getByText("juramentos").tagName.toLowerCase()).toBe("em");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Vale da Coroa",
      "Campos Dourados",
    ]);
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^- /)).not.toBeInTheDocument();
  });

  it("renders safe links and disables unsafe links", () => {
    render(
      <WikiMarkdown
        body={`[Porto seguro](https://example.com/porto) e [armadilha](javascript:alert(1)).`}
      />,
    );

    expect(screen.getByRole("link", { name: "Porto seguro" })).toHaveAttribute(
      "href",
      "https://example.com/porto",
    );
    expect(screen.getByText("armadilha").closest("a")).toBeNull();
  });

  it("renders markdown headings below the wiki entry title hierarchy", () => {
    render(
      <WikiMarkdown
        body={`# Fundação

## Casas

### Cultura

#### Costumes

##### Rituais

###### Canções`}
      />,
    );

    expect(screen.getByRole("heading", { name: "Fundação", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Casas", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cultura", level: 4 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Costumes", level: 4 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rituais", level: 4 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Canções", level: 4 })).toBeInTheDocument();
  });

  it("renders wiki body headings below the entry title heading level", () => {
    render(
      <WikiMarkdown
        body={`# Título nível 1

## Título nível 2

### Título nível 3`}
      />,
    );

    expect(screen.queryAllByRole("heading", { level: 1 })).toEqual([]);
    expect(screen.queryAllByRole("heading", { level: 2 })).toEqual([]);
    expect(screen.getByRole("heading", { name: "Título nível 1", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Título nível 2", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Título nível 3", level: 4 })).toBeInTheDocument();
  });

  it("allows expected relative links and disables protocol-relative links", () => {
    render(
      <WikiMarkdown
        body={`[Âncora](#cultura) [Raiz](/valdren) [Atual](./casa) [Acima](../casas) [Email](mailto:contato@example.com) [Externo](//evil.example/path)`}
      />,
    );

    expect(screen.getByRole("link", { name: "Âncora" })).toHaveAttribute("href", "#cultura");
    expect(screen.getByRole("link", { name: "Raiz" })).toHaveAttribute("href", "/valdren");
    expect(screen.getByRole("link", { name: "Atual" })).toHaveAttribute("href", "./casa");
    expect(screen.getByRole("link", { name: "Acima" })).toHaveAttribute("href", "../casas");
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:contato@example.com");
    expect(screen.getByText("Externo").closest("a")).toBeNull();
  });

  it("does not render embedded HTML as executable HTML", () => {
    const { container } = render(<WikiMarkdown body={`Texto <script>alert("x")</script>`} />);

    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(/<script>alert/)).toBeInTheDocument();
  });

  it("does not render markdown images as external image requests", () => {
    const { container } = render(<WikiMarkdown body={`Antes ![Sino oculto](https://tracker.example/pixel.png) depois.`} />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Sino oculto")).toBeInTheDocument();
  });

  // A tabela de classes do guia de campanha depende disto: react-markdown puro
  // é CommonMark e cospe os pipes como texto.
  it("renders a GFM table as a real table", () => {
    render(
      <WikiMarkdown
        body={`| Classe | Como aparece em Valdren |
| --- | --- |
| Wizard | A Ordem dos Três |
| Warlock | Pactos |`}
      />,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Classe" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "A Ordem dos Três" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.queryByText(/\| --- \|/)).toBeNull();
  });
});
