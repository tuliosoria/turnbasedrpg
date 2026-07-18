import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardChoice } from "./CardChoice";

const card = {
  id: "vargen-defend-bridge",
  title: "Defender a Ponte",
  categories: ["military"] as const,
  description: "Envie soldados para manter a ponte aberta.",
  contribution: "aumenta a Proteção da Retirada.",
  risk: "a Casa Vargen perde tropas.",
};

describe("CardChoice", () => {
  it("renders card details and fires onChoose", async () => {
    const onChoose = vi.fn();
    render(<CardChoice card={card} selected={false} disabled={false} onChoose={onChoose} />);
    expect(screen.getByText("Defender a Ponte")).toBeInTheDocument();
    expect(screen.getByText(/Proteção da Retirada/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /escolher esta carta/i }));
    expect(onChoose).toHaveBeenCalledWith("vargen-defend-bridge");
  });

  it("shows a selected state and disables the button when locked", () => {
    render(<CardChoice card={card} selected disabled onChoose={vi.fn()} />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByText(/carta escolhida/i)).toBeInTheDocument();
  });
});
