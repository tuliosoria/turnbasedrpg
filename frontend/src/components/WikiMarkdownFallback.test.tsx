import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WikiMarkdown } from "./WikiMarkdown";

vi.mock("react-markdown", () => ({
  default: () => {
    throw new Error("Unexpected markdown render failure");
  },
}));

describe("WikiMarkdown fallback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the raw body when markdown rendering fails unexpectedly", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<WikiMarkdown body={"# Fundação\n\nTexto **importante**"} />);

    expect(screen.getByText("# Fundação", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Texto \*\*importante\*\*/)).toBeInTheDocument();
  });
});
