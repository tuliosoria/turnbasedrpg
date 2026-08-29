import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PENDENCIAS_VAZIAS } from "@ravenloft/content";
import { PainelDePendencias } from "./PainelDePendencias";

describe("a faixa do que está esperando", () => {
  // "To perdido como admin": o painel tem quatro grupos e treze seções, e a
  // única forma de achar trabalho parado era abrir aba por aba.
  it("diz quantas coisas esperam e o que são", () => {
    render(<PainelDePendencias pendencias={{ ...PENDENCIAS_VAZIAS, projetos: 2, canonico: 1 }} onIr={vi.fn()} />);
    expect(screen.getByText("3 coisas esperando por você")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2 projetos esperando despacho/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 verbete no cânone/i })).toBeInTheDocument();
  });

  it("leva direto à aba certa", async () => {
    const onIr = vi.fn();
    render(<PainelDePendencias pendencias={{ ...PENDENCIAS_VAZIAS, canonico: 1 }} onIr={onIr} />);
    await userEvent.click(screen.getByRole("button", { name: /verbete no cânone/i }));
    expect(onIr).toHaveBeenCalledWith("mundo", "canonico");
  });

  // Uma faixa permanentemente presente dizendo "0" ensina o olho a pular a
  // região onde o aviso de verdade vai aparecer.
  it("some por completo quando não há nada", () => {
    const { container } = render(<PainelDePendencias pendencias={PENDENCIAS_VAZIAS} onIr={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("fala no singular quando é uma coisa só", () => {
    render(<PainelDePendencias pendencias={{ ...PENDENCIAS_VAZIAS, rascunho: 1 }} onIr={vi.fn()} />);
    expect(screen.getByText("1 coisa esperando por você")).toBeInTheDocument();
  });
});
