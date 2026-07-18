import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import type { AdminChoiceRow } from "../types/api";

export function AdminChoiceTable({ rows }: { rows: AdminChoiceRow[] }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Casa</TableCell>
            <TableCell>Carta escolhida</TableCell>
            <TableCell>Horário</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.houseId} hover>
              <TableCell>
                {r.houseName}
                {r.claimed ? "" : " (sem jogador)"}
              </TableCell>
              <TableCell>
                {r.cardTitle ? (
                  <Chip size="small" color="secondary" variant="outlined" label={r.cardTitle} />
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {r.chosenAt ? new Date(r.chosenAt).toLocaleString("pt-BR") : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
