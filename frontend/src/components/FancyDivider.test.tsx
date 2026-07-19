import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { FancyDivider } from "./FancyDivider";
import { theme } from "../theme";

describe("FancyDivider", () => {
  it("renders a decorative divider hidden from assistive tech", () => {
    render(
      <ThemeProvider theme={theme}>
        <FancyDivider />
      </ThemeProvider>,
    );
    const divider = screen.getByTestId("fancy-divider");
    expect(divider).toBeInTheDocument();
    expect(divider).toHaveAttribute("aria-hidden");
  });
});
