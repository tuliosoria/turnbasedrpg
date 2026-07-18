import type { KingdomState } from "@ravenloft/content";

const LABELS: { key: keyof KingdomState; label: string }[] = [
  { key: "provisions", label: "Provisões" },
  { key: "militaryStrength", label: "Força Militar" },
  { key: "unity", label: "Unidade" },
  { key: "publicOrder", label: "Ordem Pública" },
  { key: "enemyKnowledge", label: "Conhecimento sobre o Inimigo" },
  { key: "undeadAdvance", label: "Avanço dos Mortos" },
];

export function KingdomStats({ state }: { state: KingdomState }) {
  return (
    <section className="card" aria-label="Estado do reino">
      <h2>Estado do Reino</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {LABELS.map(({ key, label }) => (
          <li
            key={key}
            style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0" }}
          >
            <span>{label}</span>
            <span>{state[key]} / 10</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
