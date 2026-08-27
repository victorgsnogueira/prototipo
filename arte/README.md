# arte/

Fontes e saídas do gerador de meio-tom em caracteres.

| arquivo | o que é |
|---|---|
| `justica.png` | imagem de origem (PNG, 8 bits, não entrelaçado) |
| `manto-justica.svg` | saída consumida por `assets/styles.css` na regra `.manto` |

## Regerar

```bash
node scripts/gerar-manto.js --ascii
```

Imprime uma prévia em texto no terminal e **não escreve nada em disco** — use
para calibrar antes de gastar a geração.

```bash
node scripts/gerar-manto.js
```

Escreve `manto-justica.svg`.

## Calibração

Os três parâmetros ficam no topo de [`../scripts/gerar-manto.js`](../scripts/gerar-manto.js):

| parâmetro | atual | efeito |
|---|---|---|
| `COLS` | 250 | colunas da grade — mais colunas, mais detalhe e arquivo maior |
| `GAMA` | 0.70 | abaixo de 1 escurece o meio-tom; quanto menor, mais peso |
| `FRANJA_INICIO` | 0.84 | fração da altura em que a base começa a se dissolver |

A rampa de caracteres (`RAMPA`) usa só glifos redondos e compactos. Evite
`-` e `=`: são traços horizontais e, quando células vizinhas caem no mesmo
tom, emendam num risco atravessando a figura.

## Trocar a imagem

Substitua `justica.png` e rode o gerador. O recorte é automático — o script
acha a caixa do conteúdo real e descarta o fundo branco/transparente, então
não precisa enquadrar a imagem antes.

Só PNG de 8 bits por canal, sem entrelace. Aceita color type 0, 2, 3, 4 e 6
(o decodificador é próprio, usando o `zlib` nativo do Node — sem dependências).

Depois de trocar, rode o otimizador (abaixo) antes de gerar o SVG final —
imagem de câmera/banco de imagem costuma vir em resolução muito acima do
que a grade de caracteres consegue usar.

## Otimizar a imagem de origem

```bash
node scripts/otimizar-justica.js [ladoMax]   # padrão: 900
```

O gerador amostra `justica.png` numa grade de `COLS` colunas (250 hoje) e só
lê luminância + alfa — cor nunca é usada. Uma foto de 4096×4096 dá ~14px de
origem por célula: 12× mais pixel do que qualquer valor plausível de `COLS`
consegue enxergar.

O otimizador reamostra por caixa (média dos pixels cobertos, não vizinho
mais próximo — sem serrilhado) até `ladoMax` no lado longo, converte para
cinza + alfa (descarta cor, que o gerador nunca lê) e recodifica com o mesmo
`zlib` nativo do decodificador. Sem dependências, sem ImageMagick, sem PIL.

No `arte/justica.png` deste projeto: **4,39 MB → 313 KB (−93%)**, com saída
do `--ascii` idêntica byte a byte a menos de meia dúzia de caracteres na
fronteira de nível — arredondamento de reamostragem, imperceptível.

`ladoMax` tem folga: com `COLS: 250` cada célula já recebe só ~3 px de
origem a 900px de lado. Se um dia `COLS` subir muito além de 250, rode o
otimizador de novo com um `ladoMax` maior *a partir do PNG grande original*
— reamostrar uma imagem já reduzida perde detalhe que não volta.

**O arquivo original de antes da otimização não fica em disco** (o script
não grava mais backup local — o commit anterior no git já preserva o PNG
de origem inteiro). Para recuperá-lo:
```bash
git log --oneline -- arte/justica.png   # ache o commit anterior à otimização
git show <hash>:arte/justica.png > arte/justica.png
```
