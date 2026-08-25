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
