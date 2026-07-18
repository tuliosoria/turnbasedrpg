import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CardCategory } from "@ravenloft/content";
import { AdminChoiceTable } from "./AdminChoiceTable";

const rows = [
  {
    houseId: "vargen" as const, houseName: "Casa Vargen", claimed: true,
    displayName: "Elira", cardId: "vargen-defend-bridge",
    cardTitle: "Defender a Ponte", categories: ["military"] as CardCategory[],
    chosenAt: "2026-07-17T10:00:00.000Z",
  },
  {
    houseId: "ravens" as const, houseName: "Irmandade dos Corvos", claimed: false,
  },
];

describe("AdminChoiceTable", () => {
  it("shows each house's choice and a placeholder for missing ones", () => {
    render(<AdminChoiceTable rows={rows} />);
    expect(screen.getByText("Defender a Ponte")).toBeInTheDocument();
    expect(screen.getByText("Casa Vargen")).toBeInTheDocument();
    expect(screen.getAllByText(/—/).length).toBeGreaterThan(0);
  });
});
