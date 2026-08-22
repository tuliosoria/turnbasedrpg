import { SEATS } from "../diplomacy/geography.js";
import { fold } from "./mortality.js";

/**
 * Descobre quais imagens do acervo pertencem a uma Casa.
 *
 * O acervo não guarda "esta imagem é da Casa Vargen": guarda a entidade
 * retratada, que tanto pode ser a Casa quanto a cidade-sede dela. A página da
 * Casa precisa das duas — a muralha de Rimewatch é o que Rimerberg tem de mais
 * reconhecível, e o verbete da cidade é o único lugar onde ela é descrita.
 */

/** O nome distintivo da Casa, sem o prefixo que ela divide com as outras. */
export function houseShortName(name: string): string {
  const f = fold(name).trim();
  const stripped = f.replace(/^(casa do|casa da|casa de|casa|cla|grande casa)\s+/, "");
  // "Ordem do Sino" e "Irmandade dos Corvos" não sobrevivem à poda: o que
  // distingue as duas é justamente o nome inteiro.
  return stripped.length >= 4 ? stripped : f;
}

/** Termos que identificam uma Casa numa string livre. */
export function houseTerms(houseKey: string): string[] {
  const seat = SEATS.find((s) => s.key === houseKey);
  if (!seat) return [];
  const cidades = [seat.seat, ...(seat.otherCities ?? [])].map(fold);
  return [houseShortName(seat.name), ...cidades].filter((t) => t.length >= 4);
}

/**
 * Se um texto — nome de entidade, título de verbete — se refere a esta Casa.
 *
 * Casar por chave não basta: as entidades do acervo foram batizadas à mão e
 * usam nomes como "Solarion (Sahra-Lun)" ou "Khar-Durak", nunca "casa-solarion".
 */
export function mentionsHouse(text: string | null | undefined, houseKey: string): boolean {
  if (!text) return false;
  const f = fold(text);
  return houseTerms(houseKey).some((term) => f.includes(term));
}
