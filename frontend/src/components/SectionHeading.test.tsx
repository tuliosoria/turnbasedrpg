import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { SectionHeading } from "./SectionHeading";
import { theme } from "../theme";

function renderWithTheme(node: React.ReactNode) {
  return render(<ThemeProvider theme={theme}>{node}</ThemeProvider>);
}

describe("SectionHeading", () => {
  it("renders the heading text as a level-2 heading", () => {
    renderWithTheme(<SectionHeading>As Grandes Casas</SectionHeading>);
    expect(screen.getByRole("heading", { level: 2, name: "As Grandes Casas" })).toBeInTheDocument();
  });

  it("renders the optional overline", () => {
    renderWithTheme(<SectionHeading overline="Valdren">Cidades</SectionHeading>);
    expect(screen.getByText("Valdren")).toBeInTheDocument();
  });
});
