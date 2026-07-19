import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Crest } from "./Crest";

describe("Crest", () => {
  it("renders the deterministic icon glyph for the emblem", () => {
    render(<Crest emblem={{ icon: "corvo", color1: "#111111", color2: "#eeeeee" }} name="Casa Corvo" />);

    expect(screen.getByText("🐦‍⬛")).toBeInTheDocument();
  });
});
