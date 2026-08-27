# Ratio — backend

Data Warehouse jurídico sobre a API pública do DataJud (CNJ): ETL, esquema
estrela em Postgres e API de consultas OLAP.

## Subir

```bash
cd backend
cp .env.example .env
docker compose up -d
```

Sobe `db` (Postgres 16, porta 5433) e `api` (FastAPI, porta 8000). As
migrations rodam sozinhas na primeira subida do volume.

```bash
curl http://localhost:8000/api/saude
```

Documentação interativa da API em `http://localhost:8000/docs`.

## Carregar dados

O banco sobe vazio — o DataJud tem dezenas de milhões de processos por
tribunal, então a carga é sempre um recorte deliberado.

```bash
docker compose run --rm \
  -e ETL_TRIBUNAIS=tjsp,tjrj,tjmg \
  -e ETL_ASSUNTOS=7768,6017,899,5952 \
  -e ETL_LIMITE_POR_COMBINACAO=120 \
  api python -m etl.carga
```

`ETL_ASSUNTOS` são códigos de assunto da TPU — é o que vira **tema**, a
entidade central do produto. A carga é idempotente: rodar de novo não
duplica fato nem infla contagem.

Para agendar diariamente na VPS, via cron do host:

```cron
0 4 * * * cd /srv/ratio/backend && docker compose run --rm api python -m etl.carga >> /var/log/ratio-etl.log 2>&1
```

## Testes

```bash
python -m pytest tests/ -q
```

21 testes, sem precisar de banco nem rede. Quase todo caso do `test_etl.py`
saiu de uma falha real contra a API do DataJud, não de imaginação.

## Como o dado vira produto

```
DataJud (Elasticsearch, 1 índice por tribunal)
   │  filtra na origem: assunto + já julgado
   ▼
dim_processo · dim_tema · dim_tribunal · dim_orgao · dim_classe · dim_movimento
   │  ponte_processo_tema resolve o N:N de assuntos
   ▼
fato_movimentacao      grão: uma movimentação processual
   │  REFRESH ao fim da carga
   ▼
mv_resultado_processo → mv_tema_{resumo,ano,tribunal,orgao}
   ▼
API  →  front
```

### De onde sai "favorável" e "desfavorável"

O DataJud **não** publica resultado de julgamento como campo. Ele só existe
como movimentação, pelos códigos da TPU — verificados contra a API antes de
serem mapeados:

| Código | Nome (o que a própria API devolve) | Categoria |
|---|---|---|
| 219 | Procedência | `favoravel` |
| 220 | Improcedência | `desfavoravel` |
| 221 | Procedência em Parte | `parcial` |

`parcial` soma com `favoravel` nos agregados. Um processo pode ter vários
julgamentos (1ª instância, recurso); `mv_resultado_processo` toma o **mais
recente** como resultado vigente — é o entendimento que está de pé hoje.

Código de movimento não mapeado cai em `outro` e **não** entra na métrica.
Na dúvida, fora: um código mal classificado corromperia silenciosamente
todo o favorável/desfavorável do produto.

### A nota do selo

`app/forca.py` combina quatro sinais, todos derivados do DW:

| Componente | Peso | Por quê |
|---|---|---|
| concordância | 0,45 | é a pergunta que o usuário faz de verdade |
| volume (log) | 0,25 | 10→100 decisões importa mais que 1.000→1.090 |
| cobertura entre tribunais | 0,20 | tese firme em um tribunal só é local |
| recência | 0,10 | tese parada pode ter sido superada |

A API devolve a nota **e cada componente com seu peso**. Um profissional não
cita estatística que não consegue auditar.

## O que o DataJud não entrega

Registrado para ninguém prometer o que a fonte não tem:

- **Texto da decisão.** É metadado processual (capa + movimentações), não
  inteiro teor. Por isso a interface mostra órgão, classe, resultado e data
  — nunca um trecho citado.
- **Doutrina.** Nenhuma API pública de tribunal publica doutrina acadêmica.
- **Relator nominal**, de forma estruturada e consistente entre tribunais.
  Win rate por relator depende disso e não está no escopo.
- **Resultado como campo.** Só via código de movimento, como acima.

## Rotas

| Rota | O que devolve |
|---|---|
| `GET /api/saude` | prontidão real — responde se há dado utilizável |
| `GET /api/temas?q=` | busca full-text pt + trigrama |
| `GET /api/temas/{codigo}` | série anual, por tribunal, por órgão |
| `GET /api/temas/{codigo}/decisoes` | processos com link para a fonte |

## Links para a fonte oficial

`app/links.py`. Não existe "o site do governo" — são 91 tribunais em e-SAJ,
PJe, Projudi e eproc. A resposta carrega a camada junto:

- `direto` — consulta do tribunal com o número já preenchido
- `portal` — portal do tribunal; o número vai formatado para colar
- `null` — tribunal não mapeado; melhor sem link que link que não resolve

Não é possível garantir por teste que um link abra um processo específico:
STJ e STF respondem 403 a cliente não-navegador, e segredo de justiça não
abre para ninguém. Por isso o rótulo é "consultar no tribunal", nunca
"veja a decisão".
