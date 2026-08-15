// Envia um rascunho de turno para o backend, para o Mestre revisar no admin.
//   DRAFT_INGEST_TOKEN=... node push-turn-draft.mjs caminho/para/rascunho.json
// O JSON deve ter { publicEvent, privateInfo: {"Nome da Casa": "..."} , note }.
import { readFileSync } from "node:fs";

const API = process.env.API_BASE ?? "https://kzmeheg8d4.execute-api.us-east-1.amazonaws.com";
const token = process.env.DRAFT_INGEST_TOKEN;
if (!token) { console.error("Falta DRAFT_INGEST_TOKEN."); process.exit(1); }
const file = process.argv[2];
if (!file) { console.error("Uso: node push-turn-draft.mjs <rascunho.json>"); process.exit(1); }

const draft = JSON.parse(readFileSync(file, "utf-8"));
const body = {
  publicEvent: String(draft.publicEvent ?? ""),
  privateInfo: draft.privateInfo && typeof draft.privateInfo === "object" ? draft.privateInfo : {},
  note: String(draft.note ?? ""),
};

const res = await fetch(`${API}/api/admin/turn/draft`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", "x-draft-token": token },
  body: JSON.stringify(body),
});
if (!res.ok) { console.error("HTTP", res.status, (await res.text()).slice(0, 400)); process.exit(1); }
console.log("Rascunho enviado. O Mestre já pode revisar no admin → Turnos.");
console.log(await res.json());
