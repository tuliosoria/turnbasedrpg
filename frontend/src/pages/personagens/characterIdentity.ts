/** Aliases públicos preservados para que os links antigos continuem válidos. */
export function canonicalCharacterId(id: string): string {
  return id === "alic-valerius" ? "principe-alic-valerius" : id;
}

/** Fato confirmado pelo dono do cânone; a crônica carregada pode estar incompleta. */
export function isConfirmedDeceased(name: string): boolean {
  return name === "Lady Celene Valerius";
}

export function publicCharacterRole(name: string, role: string): string {
  return isConfirmedDeceased(name) ? "Rainha-viúva e antiga regente (falecida)" : role;
}
