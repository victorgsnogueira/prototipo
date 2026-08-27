/* ========================================================================
   Reduz arte/justica.png para o que o gerador de fato usa.

   O gerador amostra a imagem numa grade de ~250 colunas (14px de origem
   por celula) e so le luminancia + alfa - cor nunca e usada. A origem
   estava em 4096x4096 RGB indexado (4,4 MB) para uma grade que enxerga
   no maximo umas 700 colunas de detalhe util. Isso e 12x mais pixel do
   que qualquer uso plausivel do script consome.

   Reamostra por caixa (media dos pixels cobertos, nao vizinho mais
   proximo - evita serrilhado) para um lado longo maximo, converte para
   cinza+alfa (color type 4, sem paleta) e recodifica com o mesmo zlib
   nativo usado no decodificador. Sem libs externas.

   Uso: node scripts/otimizar-justica.js [ladoMax]   (padrao 900)
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ORIGEM = path.join(__dirname, '..', 'arte', 'justica.png');
const LADO_MAX = parseInt(process.argv[2], 10) || 900;

/* ---- decodificador (mesmo de gerar-manto.js) ---- */
function lerPNG(arquivo) {
  const buf = fs.readFileSync(arquivo);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('nao e PNG');
  let pos = 8, larg = 0, alt = 0, prof = 0, tipo = 0, entrelace = 0;
  let paleta = null, transp = null;
  const pedacos = [];
  while (pos < buf.length) {
    const tam = buf.readUInt32BE(pos);
    const nome = buf.toString('ascii', pos + 4, pos + 8);
    const dados = buf.subarray(pos + 8, pos + 8 + tam);
    if (nome === 'IHDR') {
      larg = dados.readUInt32BE(0); alt = dados.readUInt32BE(4);
      prof = dados[8]; tipo = dados[9]; entrelace = dados[12];
    } else if (nome === 'PLTE') paleta = Buffer.from(dados);
    else if (nome === 'tRNS') transp = Buffer.from(dados);
    else if (nome === 'IDAT') pedacos.push(Buffer.from(dados));
    else if (nome === 'IEND') break;
    pos += 12 + tam;
  }
  if (prof !== 8) throw new Error('bit depth ' + prof + ' nao suportado');
  if (entrelace !== 0) throw new Error('PNG entrelacado nao suportado');
  const canais = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[tipo];
  if (!canais) throw new Error('color type ' + tipo + ' nao suportado');
  const bruto = zlib.inflateSync(Buffer.concat(pedacos));
  const bpp = canais, passo = larg * canais;
  const linhas = Buffer.alloc(alt * passo);
  let p = 0;
  for (let y = 0; y < alt; y++) {
    const filtro = bruto[p++], base = y * passo, baseAnt = (y - 1) * passo;
    for (let i = 0; i < passo; i++) {
      const x = bruto[p + i];
      const a = i >= bpp ? linhas[base + i - bpp] : 0;
      const b = y > 0 ? linhas[baseAnt + i] : 0;
      const c = (y > 0 && i >= bpp) ? linhas[baseAnt + i - bpp] : 0;
      let v;
      switch (filtro) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const pp = a + b - c;
          const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          v = x + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c));
          break;
        }
        default: throw new Error('filtro invalido');
      }
      linhas[base + i] = v & 0xff;
    }
    p += passo;
  }
  const lum = new Uint8Array(larg * alt), alfa = new Uint8Array(larg * alt);
  for (let i = 0, n = larg * alt; i < n; i++) {
    const o = i * canais;
    let r, g, b, a = 255;
    if (tipo === 0) { r = g = b = linhas[o]; }
    else if (tipo === 4) { r = g = b = linhas[o]; a = linhas[o + 1]; }
    else if (tipo === 2) { r = linhas[o]; g = linhas[o + 1]; b = linhas[o + 2]; }
    else if (tipo === 6) { r = linhas[o]; g = linhas[o + 1]; b = linhas[o + 2]; a = linhas[o + 3]; }
    else {
      const idx = linhas[o];
      r = paleta[idx * 3]; g = paleta[idx * 3 + 1]; b = paleta[idx * 3 + 2];
      if (transp && idx < transp.length) a = transp[idx];
    }
    lum[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0;
    alfa[i] = a;
  }
  return { larg, alt, lum, alfa };
}

/* ---- reamostragem por caixa (media das celulas cobertas) ---- */
function reamostra(im, larg2, alt2) {
  const lum2 = new Uint8Array(larg2 * alt2);
  const alfa2 = new Uint8Array(larg2 * alt2);
  for (let y2 = 0; y2 < alt2; y2++) {
    const y0 = Math.floor(y2 * im.alt / alt2);
    const y1 = Math.max(y0 + 1, Math.floor((y2 + 1) * im.alt / alt2));
    for (let x2 = 0; x2 < larg2; x2++) {
      const x0 = Math.floor(x2 * im.larg / larg2);
      const x1 = Math.max(x0 + 1, Math.floor((x2 + 1) * im.larg / larg2));
      let sl = 0, sa = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        const base = y * im.larg;
        for (let x = x0; x < x1; x++) {
          sl += im.lum[base + x]; sa += im.alfa[base + x]; n++;
        }
      }
      const k = y2 * larg2 + x2;
      lum2[k] = Math.round(sl / n);
      alfa2[k] = Math.round(sa / n);
    }
  }
  return { larg: larg2, alt: alt2, lum: lum2, alfa: alfa2 };
}

/* ---- codificador PNG cinza+alfa (color type 4, sem paleta) ---- */
function crc32(buf) {
  let c;
  const tabela = crc32.tabela || (crc32.tabela = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = tabela[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pedacoPNG(tipo, dados) {
  const tam = Buffer.alloc(4); tam.writeUInt32BE(dados.length, 0);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([tam, corpo, crc]);
}

function escrevePNG(im, destino) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(im.larg, 0);
  ihdr.writeUInt32BE(im.alt, 4);
  ihdr[8] = 8;   /* bit depth */
  ihdr[9] = 4;   /* color type 4 = cinza + alfa */
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  /* scanlines com filtro Paeth por linha - reduz bem sobre gradiente suave.
     O preditor usa os valores ORIGINAIS (nao filtrados) dos vizinhos - por
     isso guardamos a linha anterior a parte, em vez de reler do buffer de
     saida (que ja contem bytes filtrados e corromperia a predicao). */
  const passo = im.larg * 2;
  const bruto = Buffer.alloc(im.alt * (1 + passo));
  let linhaAnt = Buffer.alloc(passo);
  for (let y = 0; y < im.alt; y++) {
    const linha = Buffer.alloc(passo);
    for (let x = 0; x < im.larg; x++) {
      const i = y * im.larg + x;
      linha[x * 2] = im.lum[i];
      linha[x * 2 + 1] = im.alfa[i];
    }
    const dest = y * (1 + passo);
    bruto[dest] = 4; /* Paeth */
    for (let i = 0; i < passo; i++) {
      const x = linha[i];
      const a = i >= 2 ? linha[i - 2] : 0;
      const b = y > 0 ? linhaAnt[i] : 0;
      const c = (y > 0 && i >= 2) ? linhaAnt[i - 2] : 0;
      const pp = a + b - c;
      const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
      const pred = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      bruto[dest + 1 + i] = (x - pred) & 0xff;
    }
    linhaAnt = linha;
  }

  const idat = zlib.deflateSync(bruto, { level: 9 });
  const saida = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedacoPNG('IHDR', ihdr),
    pedacoPNG('IDAT', idat),
    pedacoPNG('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(destino, saida);
  return saida.length;
}

/* ---------------------------------------------------------------- main */

const original = lerPNG(ORIGEM);
const escala = LADO_MAX / Math.max(original.larg, original.alt);
const larg2 = Math.max(1, Math.round(original.larg * escala));
const alt2 = Math.max(1, Math.round(original.alt * escala));
const reduzida = reamostra(original, larg2, alt2);

const antesTam = fs.statSync(ORIGEM).size;

/* Sem backup local de proposito: o PNG de origem anterior a qualquer
   otimizacao ja fica preservado no historico do git (o commit em que
   foi adicionado). Gravar copia em disco so duplicaria o peso que este
   script existe para cortar - e um arquivo *.original.png esquecido no
   proximo commit anularia a otimizacao inteira. Ver README.md desta
   pasta para o comando de recuperacao via git caso precise do original. */
const depoisTam = escrevePNG(reduzida, ORIGEM);

console.log('antes:  ' + original.larg + 'x' + original.alt + '  ' + (antesTam / 1024 / 1024).toFixed(2) + ' MB (indexado RGB)');
console.log('depois: ' + larg2 + 'x' + alt2 + '  ' + (depoisTam / 1024).toFixed(1) + ' KB (cinza+alfa)');
console.log('reducao: ' + (100 - depoisTam / antesTam * 100).toFixed(1) + '%');
