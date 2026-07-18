import type { CardView } from "../types/api";

const CATEGORY_LABELS: Record<string, string> = {
  military: "Militar",
  logistics: "Logística",
  politics: "Política",
  administration: "Administração",
  investigation: "Investigação",
  religion: "Religião",
  engineering: "Engenharia",
  "popular-support": "Apoio Popular",
  sacrifice: "Sacrifício",
};

export function CardChoice({
  card,
  selected,
  disabled,
  onChoose,
}: {
  card: CardView;
  selected: boolean;
  disabled: boolean;
  onChoose: (cardId: string) => void;
}) {
  return (
    <article
      className="card"
      style={selected ? { borderColor: "var(--accent-red)" } : undefined}
      aria-current={selected}
    >
      <h3>{card.title}</h3>
      <p style={{ color: "var(--text-muted)" }}>
        {card.categories.map((c) => CATEGORY_LABELS[c] ?? c).join(" · ")}
      </p>
      <p>{card.description}</p>
      <p><strong>Contribuição:</strong> {card.contribution}</p>
      {card.risk && <p><strong>Risco:</strong> {card.risk}</p>}
      {card.cost && <p><strong>Custo:</strong> {card.cost}</p>}
      <button disabled={disabled} onClick={() => onChoose(card.id)}>
        Escolher esta carta
      </button>
      {selected && <p aria-live="polite">✓ Carta escolhida</p>}
    </article>
  );
}
