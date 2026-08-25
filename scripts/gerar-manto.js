/* ========================================================================
   Gera arte/manto-justica.svg a partir de arte/justica.png.

   Faz meio-tom por densidade: le os pixels reais da imagem, reamostra
   numa grade e escolhe um caractere por celula conforme a escuridao
   media. A borda inferior se dissolve em franja - o "manto".

   Decodificador PNG nativo (zlib do proprio Node), sem dependencias.
   Suporta color type 0/2/3/4/6 em bit depth 8.

   Uso:
     node scripts/gerar-manto.js --ascii   preview em texto, nao escreve
     node scripts/gerar-manto.js           escreve o SVG
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MODO_ASCII = process.argv.includes('--ascii');
const ORIGEM = path.join(__dirname, '..', 'arte', 'justica.png');
const DESTINO = path.join(__dirname, '..', 'arte', 'manto-justica.svg');

/* ==================================================== decodificador PNG */

function lerPNG(arquivo) {
  const buf = fs.readFileSync(arquivo);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('nao e PNG');

  let pos = 8;
  let larg = 0, alt = 0, prof = 0, tipo = 0, entrelace = 0;
  let paleta = null, transp = null;
  const pedacos = [];

  while (pos < buf.length) {
    const tam = buf.readUInt32BE(pos);
    const nome = buf.toString('ascii', pos + 4, pos + 8);
    const dados = buf.subarray(pos + 8, pos + 8 + tam);

    if (nome === 'IHDR') {
      larg = dados.readUInt32BE(0);
      alt = dados.readUInt32BE(4);
      prof = dados[8];
      tipo = dados[9];
      entrelace = dados[12];
    } else if (nome === 'PLTE') {
      paleta = Buffer.from(dados);
    } else if (nome === 'tRNS') {
      transp = Buffer.from(dados);
    } else if (nome === 'IDAT') {
      pedacos.push(Buffer.from(dados));
    } else if (nome === 'IEND') {
      break;
    }
    pos += 12 + tam;
  }

  if (prof !== 8) throw new Error('bit depth ' + prof + ' nao suportado (use 8)');
  if (entrelace !== 0) throw new Error('PNG entrelacado nao suportado');

  const canais = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[tipo];
  if (!canais) throw new Error('color type ' + tipo + ' nao suportado');

  const bruto = zlib.inflateSync(Buffer.concat(pedacos));
  const bpp = canais;
  const passo = larg * canais;

  /* desfiltra as scanlines */
  const linhas = Buffer.alloc(alt * passo);
  let p = 0;
  for (let y = 0; y < alt; y++) {
    const filtro = bruto[p++];
    const base = y * passo;
    const baseAnt = (y - 1) * passo;
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
        default: throw new Error('filtro ' + filtro + ' invalido');
      }
      linhas[base + i] = v & 0xff;
    }
    p += passo;
  }

  /* luminancia + alfa por pixel */
  const lum = new Uint8Array(larg * alt);
  const alfa = new Uint8Array(larg * alt);

  for (let i = 0, n = larg * alt; i < n; i++) {
    const o = i * canais;
    let r, g, b, a = 255;
    if (tipo === 0) { r = g = b = linhas[o]; }
    else if (tipo === 4) { r = g = b = linhas[o]; a = linhas[o + 1]; }
    else if (tipo === 2) { r = linhas[o]; g = linhas[o + 1]; b = linhas[o + 2]; }
    else if (tipo === 6) { r = linhas[o]; g = linhas[o + 1]; b = linhas[o + 2]; a = linhas[o + 3]; }
    else { /* tipo 3 */
      const idx = linhas[o];
      r = paleta[idx * 3]; g = paleta[idx * 3 + 1]; b = paleta[idx * 3 + 2];
      if (transp && idx < transp.length) a = transp[idx];
    }
    lum[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0;
    alfa[i] = a;
  }

  return { larg, alt, lum, alfa };
}

/* ======================================================== amostragem */

const img = lerPNG(ORIGEM);

/* recorta na caixa do conteudo real (ignora fundo branco/transparente) */
function caixaConteudo(im) {
  let x0 = im.larg, y0 = im.alt, x1 = -1, y1 = -1;
  for (let y = 0; y < im.alt; y++) {
    for (let x = 0; x < im.larg; x++) {
      const i = y * im.larg + x;
      if (im.alfa[i] > 128 && im.lum[i] < 238) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x0: 0, y0: 0, x1: im.larg - 1, y1: im.alt - 1 };
  return { x0, y0, x1, y1 };
}

const cx = caixaConteudo(img);
const recLarg = cx.x1 - cx.x0 + 1;
const recAlt = cx.y1 - cx.y0 + 1;

/* grade: mantem a proporcao do recorte; celula de caractere e mais alta
   que larga, entao usamos passos diferentes em x e y. */
/* metrica da celula: monospace tem avanco ~0.6em e linha ~1.02em, entao
   a celula e bem mais alta que larga. Manter isso e o que faz a grade
   parecer terminal de verdade, com os caracteres se encostando. */
const FS = 10;          /* corpo do glifo */
const CW = FS * 0.6;    /* largura da celula = avanco do monospace */
/* Passo vertical MENOR que a altura da tinta, de proposito: os glifos
   altos ('0 8 @') passam a se sobrepor de leve entre linhas, fechando
   a canaleta. Com passo >= altura da tinta sobrava sempre uma faixa
   vazia na mesma posicao em toda linha, e isso virava listra - pior
   ainda nos tons medios, onde mandam glifos de altura-x ('o c'), que
   pintam menos ainda que os altos. */
const CH = FS * 0.60;

/* Linhas impares deslocadas meia celula. Grade escalonada (como favo)
   nao consegue alinhar canaleta nenhuma nem na horizontal nem na
   vertical - e a garantia de que listra nao volta. */
const DEFASAGEM = 0.5;

const COLS = MODO_ASCII ? 96 : 250;
const RAZAO_CEL = MODO_ASCII ? 2.1 : CH / CW;
const ROWS = Math.max(1, Math.round(COLS * (recAlt / recLarg) / RAZAO_CEL));

function amostra() {
  const soma = new Float64Array(COLS * ROWS);
  const cont = new Uint32Array(COLS * ROWS);

  for (let y = cx.y0; y <= cx.y1; y++) {
    const gr = Math.min(ROWS - 1, ((y - cx.y0) / recAlt * ROWS) | 0);
    for (let x = cx.x0; x <= cx.x1; x++) {
      const gc = Math.min(COLS - 1, ((x - cx.x0) / recLarg * COLS) | 0);
      const i = y * img.larg + x;
      const k = gr * COLS + gc;
      /* densidade = escuridao, zerada onde e transparente */
      const vis = img.alfa[i] / 255;
      soma[k] += (1 - img.lum[i] / 255) * vis;
      cont[k]++;
    }
  }

  const g = [];
  for (let r = 0; r < ROWS; r++) {
    const linha = [];
    for (let c = 0; c < COLS; c++) {
      const k = r * COLS + c;
      linha.push(cont[k] ? soma[k] / cont[k] : 0);
    }
    g.push(linha);
  }
  return g;
}

let grade = amostra();

let semente = 20260825;
function rnd() {
  semente = (semente * 1103515245 + 12345) & 0x7fffffff;
  return semente / 0x7fffffff;
}

/* Estica o contraste por percentil (nao pelo maximo: um unico pixel
   preto achatava todo o resto num tom so) e clareia o meio-tom com
   gama < 1, que e onde mora o detalhe do drapeado. */
const GAMA = 0.70;
(function contraste(g) {
  const vals = [];
  for (const l of g) for (const v of l) if (v > 0.02) vals.push(v);
  if (!vals.length) return;
  vals.sort((a, b) => a - b);
  const lo = vals[Math.floor(vals.length * 0.02)];
  const hi = vals[Math.floor(vals.length * 0.985)];
  const faixa = Math.max(1e-6, hi - lo);
  for (const l of g) {
    for (let i = 0; i < l.length; i++) {
      if (l[i] <= 0) continue;
      const t = Math.min(1, Math.max(0, (l[i] - lo) / faixa));
      l[i] = Math.pow(t, GAMA);
    }
  }
})(grade);

/* Franja do manto: so no finzinho, e por SUMICO de caractere (dropout),
   nunca deslocando os que ficam. Deslocar borra a imagem inteira; sumir
   preserva o alinhamento e ainda da o efeito de dissolver. */
const FRANJA_INICIO = 0.84;

for (let r = 0; r < ROWS; r++) {
  const t = r / (ROWS - 1);
  if (t <= FRANJA_INICIO) continue;
  const q = (t - FRANJA_INICIO) / (1 - FRANJA_INICIO);
  const manter = Math.pow(1 - q, 1.25);
  for (let c = 0; c < COLS; c++) {
    if (rnd() > manter) grade[r][c] = 0;
  }
}

/* ========================================================== saidas */

/* Rampa de meio-tom, do mais claro ao mais cheio. So glifos REDONDOS e
   compactos: '-' e '=' sao tracos horizontais e, quando celulas vizinhas
   caem no mesmo tom, emendam num risco continuo atravessando a figura.
   So ASCII - caractere exotico falta em muita monoespacada e vira caixa. */
const RAMPA = ['.', ':', '*', 'c', 'o', 'O', '0', '8', '@'];
const OPACIDADE = [0.42, 0.53, 0.63, 0.71, 0.78, 0.85, 0.91, 0.96, 1];
const LIMIAR = 0.05;

function nivel(v) {
  const n = Math.floor(v * RAMPA.length);
  return Math.min(RAMPA.length - 1, Math.max(0, n));
}

if (MODO_ASCII) {
  let out = '';
  for (let r = 0; r < ROWS; r++) {
    let linha = '';
    for (let c = 0; c < COLS; c++) {
      const v = grade[r][c];
      linha += v < LIMIAR ? ' ' : RAMPA[nivel(v)];
    }
    out += linha.replace(/\s+$/, '') + '\n';
  }
  console.log(out);
  console.log('grade ' + COLS + 'x' + ROWS + '  recorte ' + recLarg + 'x' + recAlt +
    ' de ' + img.larg + 'x' + img.alt);
  process.exit(0);
}

const W = +(COLS * CW + DEFASAGEM * CW).toFixed(1);
const H = +(ROWS * CH).toFixed(1);

/* Emite uma <text> por (linha, nivel), com a lista de x em um unico
   atributo: <text class="n3" y="..." x="6 18 24">===</text>.
   Isso mantem a grade perfeitamente alinhada e deixa o arquivo uma
   ordem de grandeza menor do que um <text> por caractere. */
let formas = '';
let total = 0;

for (let r = 0; r < ROWS; r++) {
  const y = ((r + 0.5) * CH).toFixed(1);
  const desloca = (r % 2) * DEFASAGEM;
  const porNivel = new Map();

  for (let c = 0; c < COLS; c++) {
    const v = grade[r][c];
    if (v < LIMIAR) continue;
    const n = nivel(v);
    if (!porNivel.has(n)) porNivel.set(n, []);
    porNivel.get(n).push(+((c + 0.5 + desloca) * CW).toFixed(1));
    total++;
  }

  for (const [n, xs] of porNivel) {
    formas += '<text class="n' + n + '" y="' + y + '" x="' + xs.join(' ') + '">' +
      RAMPA[n].repeat(xs.length) + '</text>';
  }
}

const estilos = OPACIDADE
  .map((o, i) => '.n' + i + '{opacity:' + o + '}')
  .join('');

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" ' +
  'preserveAspectRatio="xMidYMid meet" role="presentation" aria-hidden="true">' +
  '<style>text{font-family:ui-monospace,"DejaVu Sans Mono","Liberation Mono",Consolas,monospace;' +
  'font-size:' + FS + 'px;text-anchor:middle;dominant-baseline:central;white-space:pre}' +
  estilos + '</style>' +
  '<g fill="#14161C">' + formas + '</g></svg>';

fs.writeFileSync(DESTINO, svg, 'utf8');
console.log('OK: ' + total + ' glifos em ' + (formas.match(/<text/g) || []).length +
  ' elementos, grade ' + COLS + 'x' + ROWS + ', ' +
  (svg.length / 1024).toFixed(1) + ' KB -> ' + DESTINO);
