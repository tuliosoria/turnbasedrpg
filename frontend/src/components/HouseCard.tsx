import type { HouseSummary } from "../types/api";
import type { HouseId } from "@ravenloft/content";

export function HouseCard({
  house,
  onSelect,
}: {
  house: HouseSummary;
  onSelect: (id: HouseId) => void;
}) {
  return (
    <article className="card">
      <h3>{house.name}</h3>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>{house.subtitle}</p>
      <p><em>{house.motto}</em></p>
      <p>{house.strength}</p>
      <button
        disabled={!house.available}
        onClick={() => onSelect(house.id)}
      >
        {house.available ? "Disponível — escolher" : "Escolhida"}
      </button>
    </article>
  );
}
