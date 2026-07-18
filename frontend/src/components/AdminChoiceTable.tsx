import type { AdminChoiceRow } from "../types/api";

export function AdminChoiceTable({ rows }: { rows: AdminChoiceRow[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left" }}>Casa</th>
          <th style={{ textAlign: "left" }}>Carta escolhida</th>
          <th style={{ textAlign: "left" }}>Horário</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.houseId}>
            <td>{r.houseName}{r.claimed ? "" : " (sem jogador)"}</td>
            <td>{r.cardTitle ?? "—"}</td>
            <td>{r.chosenAt ? new Date(r.chosenAt).toLocaleString("pt-BR") : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
