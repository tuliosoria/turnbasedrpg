import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NarrativeCard } from "@ravenloft/content";
import { NarrativeCardEditor } from "./NarrativeCardEditor";

const baseCard: NarrativeCard = {
  id: "card-1",
  title: "Carta antiga",
  constraintText: "O que permite agir",
  narrativeQuestion: "O que a Casa fará?",
  consequenceText: "Toda escolha deixa marcas.",
};

async function chooseCardType(label: string) {
  await userEvent.click(screen.getByLabelText("Tipo da carta"));
  const listbox = within(screen.getByRole("listbox"));
  await userEvent.click(listbox.getByRole("option", { name: label }));
}

describe("NarrativeCardEditor", () => {
  it("editing the title emits an updated card", async () => {
    const onChange = vi.fn();
    function StatefulEditor() {
      const [card, setCard] = useState(baseCard);
      return (
        <NarrativeCardEditor
          card={card}
          onChange={(next) => {
            setCard(next);
            onChange(next);
          }}
          onRemove={vi.fn()}
        />
      );
    }
    render(<StatefulEditor />);

    await userEvent.clear(screen.getByLabelText("Título"));
    await userEvent.type(screen.getByLabelText("Título"), "Nova carta");

    expect(onChange).toHaveBeenLastCalledWith({ ...baseCard, title: "Nova carta" });
  });

  it("switching to spend emits a card with spend", async () => {
    const onChange = vi.fn();
    render(<NarrativeCardEditor card={baseCard} onChange={onChange} onRemove={vi.fn()} />);

    await chooseCardType("Gasto");

    expect(onChange).toHaveBeenCalledWith({
      ...baseCard,
      spend: { attribute: "riqueza", max: 1 },
      choice: undefined,
    });
  });

  it("switching to choice clears spend", async () => {
    const onChange = vi.fn();
    render(
      <NarrativeCardEditor
        card={{ ...baseCard, spend: { attribute: "soldados", max: 2 } }}
        onChange={onChange}
        onRemove={vi.fn()}
      />,
    );

    await chooseCardType("Escolha");

    expect(onChange).toHaveBeenCalledWith({
      ...baseCard,
      spend: undefined,
      choice: { attributes: ["riqueza"], amount: 1 },
    });
  });

  it("clicking remove calls onRemove", async () => {
    const onRemove = vi.fn();
    render(<NarrativeCardEditor card={baseCard} onChange={vi.fn()} onRemove={onRemove} />);

    await userEvent.click(screen.getByRole("button", { name: /remover/i }));

    expect(onRemove).toHaveBeenCalledOnce();
  });
});
