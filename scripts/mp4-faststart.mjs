import { readFileSync, writeFileSync } from "node:fs";

/**
 * Move o átomo `moov` de um MP4 para antes do `mdat`.
 *
 * Um MP4 gravado com o `moov` no fim obriga o navegador a baixar o arquivo
 * inteiro antes de pintar o primeiro quadro — num hero de fundo isso é a
 * diferença entre o vídeo entrar em um segundo ou depois de 2,9 MB. O remédio
 * usual é `ffmpeg -movflags +faststart`, mas a operação é só rearranjo de
 * bytes: nada é recodificado.
 *
 * O detalhe que faz isso funcionar são as tabelas de offset. `stco` e `co64`
 * guardam posições absolutas dentro do arquivo; ao empurrar o `mdat` para
 * frente, toda posição precisa andar junto, ou o vídeo aponta para o lugar
 * errado e não toca.
 *
 *   node scripts/mp4-faststart.mjs entrada.mp4 saida.mp4
 */

/** Percorre os átomos de um nível, devolvendo tipo, início e tamanho. */
function atoms(buf, start = 0, end = buf.length) {
  const out = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    let header = 8;
    if (size === 1) {
      // Tamanho de 64 bits: o valor real vem logo depois do tipo.
      size = Number(buf.readBigUInt64BE(pos + 8));
      header = 16;
    } else if (size === 0) {
      size = end - pos; // vai até o fim do arquivo
    }
    if (size < header) throw new Error(`átomo inválido em ${pos}: tamanho ${size}`);
    out.push({ type, start: pos, size, header });
    pos += size;
  }
  return out;
}

/** Soma `delta` a cada offset das tabelas stco/co64 dentro de um moov. */
function shiftChunkOffsets(moov, delta) {
  let patched = 0;

  const walk = (start, end) => {
    for (const a of atoms(moov, start, end)) {
      if (a.type === "stco" || a.type === "co64") {
        const body = a.start + a.header;
        const count = moov.readUInt32BE(body + 4); // pula version+flags
        for (let i = 0; i < count; i++) {
          if (a.type === "stco") {
            const at = body + 8 + i * 4;
            moov.writeUInt32BE(moov.readUInt32BE(at) + delta, at);
          } else {
            const at = body + 8 + i * 8;
            moov.writeBigUInt64BE(moov.readBigUInt64BE(at) + BigInt(delta), at);
          }
        }
        patched += count;
      } else if (["moov", "trak", "mdia", "minf", "stbl", "edts", "udta"].includes(a.type)) {
        walk(a.start + a.header, a.start + a.size);
      }
    }
  };

  walk(0, moov.length);
  return patched;
}

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("uso: node scripts/mp4-faststart.mjs entrada.mp4 saida.mp4");
  process.exit(1);
}

const buf = readFileSync(input);
const top = atoms(buf);
const moov = top.find((a) => a.type === "moov");
const mdat = top.find((a) => a.type === "mdat");
if (!moov || !mdat) throw new Error("arquivo sem moov ou mdat");

if (moov.start < mdat.start) {
  console.log("moov já está antes do mdat: nada a fazer.");
  writeFileSync(output, buf);
  process.exit(0);
}

const moovBuf = Buffer.from(buf.subarray(moov.start, moov.start + moov.size));
const patched = shiftChunkOffsets(moovBuf, moov.size);

// Remonta em três pedaços: o cabeçalho que já vinha antes do mdat (ftyp e
// afins), o moov inserido ali, e o resto do arquivo sem o moov original.
//
// O erro fácil aqui é cortar em moov.start: "tudo antes do moov" inclui o
// mdat, e reinserir o moov depois disso o devolve exatamente ao lugar de onde
// se queria tirá-lo.
const head = buf.subarray(0, mdat.start);
const middle = buf.subarray(mdat.start, moov.start);
const tail = buf.subarray(moov.start + moov.size);
writeFileSync(output, Buffer.concat([head, moovBuf, middle, tail]));

console.log(`moov (${moov.size} bytes) movido para o início; ${patched} offsets corrigidos.`);
console.log(`moov estava em ${moov.start}, mdat em ${mdat.start}.`);
