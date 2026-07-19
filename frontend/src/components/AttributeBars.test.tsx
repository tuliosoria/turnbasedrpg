import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AttributeBars } from "./AttributeBars";

describe("AttributeBars", () => {
  it("renders the four Portuguese attribute labels and values", () => {
    render(<AttributeBars attributes={{ riqueza: 1, recursos: 2, soldados: 3, controle: 4 }} />);

    expect(screen.getByText("Riqueza")).toBeInTheDocument();
    expect(screen.getByText("Recursos")).toBeInTheDocument();
    expect(screen.getByText("Soldados")).toBeInTheDocument();
    expect(screen.getByText("Controle")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});
