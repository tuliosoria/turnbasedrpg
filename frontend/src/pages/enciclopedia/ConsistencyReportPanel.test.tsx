import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsistencyReportPanel } from "./ConsistencyReportPanel";
import type { ConsistencyReport } from "@ravenloft/content";

const report: ConsistencyReport = {
  overallScore: 72,
  styleScore: 88,
  characterIdentityScore: 54,
  architectureScore: 70,
  paletteScore: 91,
  violations: [
    { severity: "HIGH", category: "identidade", description: "O rosto não corresponde ao retrato canônico de Alic." },
    { severity: "LOW", category: "paleta", description: "Tons ligeiramente quentes demais." },
  ],
  recommendedAction: "CORRECTIVE_EDIT",
  correctionInstructions: ["Preservar o formato do queixo e a cor dos olhos."],
};

describe("ConsistencyReportPanel", () => {
  it("lists each violation with its severity and category", () => {
    render(<ConsistencyReportPanel report={report} referenceCount={3} needsReview={false} />);
    expect(screen.getByText("O rosto não corresponde ao retrato canônico de Alic.")).toBeInTheDocument();
    expect(screen.getByText("Tons ligeiramente quentes demais.")).toBeInTheDocument();
    expect(screen.getByText(/identidade/)).toBeInTheDocument();
  });

  it("shows the four sub-scores", () => {
    render(<ConsistencyReportPanel report={report} referenceCount={3} needsReview={false} />);
    expect(screen.getByText(/Estilo 88/)).toBeInTheDocument();
    expect(screen.getByText(/Identidade 54/)).toBeInTheDocument();
    expect(screen.getByText(/Arquitetura 70/)).toBeInTheDocument();
    expect(screen.getByText(/Paleta 91/)).toBeInTheDocument();
  });

  it("shows the correction instructions", () => {
    render(<ConsistencyReportPanel report={report} referenceCount={3} needsReview={false} />);
    expect(screen.getByText("Preservar o formato do queixo e a cor dos olhos.")).toBeInTheDocument();
  });

  it("reports how many references were attached", () => {
    render(<ConsistencyReportPanel report={report} referenceCount={3} needsReview={false} />);
    expect(screen.getByText(/3 referências anexadas/)).toBeInTheDocument();
  });

  it("renders a clean state when there are no violations and the pipeline accepted it", () => {
    render(
      <ConsistencyReportPanel
        report={{ ...report, violations: [], correctionInstructions: [], overallScore: 96 }}
        referenceCount={2}
        needsReview={false}
      />,
    );
    expect(screen.getByText(/Nenhuma divergência detectada \(score 96\)/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass(/MuiAlert-standardSuccess/);
  });

  /**
   * The verifier can reject on the overall score alone and still return an empty
   * violations list (the model omits it, or parseConsistencyReport defaults it).
   * Reassuring the author that nothing diverged, next to an enabled "Adicionar ao
   * cânone", is worse than the bare warning this feature was built to replace.
   */
  it("warns instead of reassuring when the pipeline flagged the image with no violations", () => {
    render(
      <ConsistencyReportPanel
        report={{ ...report, violations: [], correctionInstructions: [], overallScore: 55 }}
        referenceCount={2}
        needsReview
      />,
    );
    expect(screen.queryByText(/Nenhuma divergência/)).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass(/MuiAlert-standardWarning/);
    expect(
      screen.getByText(
        "O verificador reprovou esta imagem pelo placar geral, sem listar divergências específicas.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps listing the violations when the pipeline flagged the image and itemised why", () => {
    render(<ConsistencyReportPanel report={report} referenceCount={3} needsReview />);
    expect(screen.getByRole("alert")).toHaveClass(/MuiAlert-standardWarning/);
    expect(
      screen.getByText("O rosto não corresponde ao retrato canônico de Alic."),
    ).toBeInTheDocument();
    expect(screen.getByText("Tons ligeiramente quentes demais.")).toBeInTheDocument();
    // The itemised reasons are the explanation; the generic fallback would be noise.
    expect(screen.queryByText(/sem listar divergências específicas/)).not.toBeInTheDocument();
  });
});
