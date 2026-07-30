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
    expect(screen.getByRole("heading", { name: "Cultura", level: 3 })).toBeInTheDocument();
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

  it("renders h1 through h4 with their semantic heading levels", () => {
    render(
      <WikiMarkdown
        body={`# Fundação

## Casas

### Cultura

#### Costumes`}
      />,
    );

    expect(screen.getByRole("heading", { name: "Fundação", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Casas", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cultura", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Costumes", level: 4 })).toBeInTheDocument();
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
});
