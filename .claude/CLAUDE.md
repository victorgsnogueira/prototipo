# Projeto: Data Warehouse Jurídico

## Contexto do projeto
Projeto de curso (duração de meses) com o desafio de projetar e implementar uma
arquitetura de Data Warehouse que integre dados de fontes jurídicas variadas,
transformando informações não estruturadas em inteligência analítica.

Requisitos centrais do desafio:
- Pipelines de ETL (extração, tratamento, carga).
- Modelagem dimensional (fatos e dimensões) para permitir consultas OLAP que
  revelem padrões de jurisprudência e correlações doutrinárias.
- Boas práticas de DevOps: testes automatizados validando integridade dos dados
  e consistência das consultas, CI/CD.

Stack de dados: ainda em aberto (não decidido).

## Glossário jurídico (para quem não é da área)
- **Processo**: a "ação judicial" em si, identificada por um número único. É a
  entidade principal rastreada, análoga a um "contrato"/"empréstimo" em outros domínios.
- **Decisão judicial**: quando um juiz/tribunal decide algo dentro de um processo.
  Um processo pode ter várias ao longo do tempo. É o evento mensurável (fato).
- **Jurisprudência**: padrão que emerge quando várias decisões sobre um mesmo tema
  seguem a mesma linha. É descoberta via agregação/OLAP, não é um dado bruto em si.
- **Doutrina**: opinião/interpretação de juristas acadêmicos sobre a lei (livros,
  artigos). Não vem de tribunal; funciona como dado de enriquecimento/contexto.
- **Tribunal**: instituição que julga (STF, STJ, TJ-SP, TRF etc.) — vira dimensão.
- **Tema jurídico / Assunto**: assunto da causa (ex: trabalhista, tributário) — vira dimensão.

## Fonte de dados principal: API pública do DataJud (CNJ)
- Base nacional mantida pelo CNJ, com mais de 80 milhões de processos judiciais,
  cobrindo movimentações processuais em 91 tribunais brasileiros.
- Tecnicamente baseada em Elasticsearch: consultas via POST com corpo JSON;
  cada tribunal tem seu próprio índice/endpoint (não é uma API única centralizada).
- Não é tempo real — atualização varia de horas a dias conforme o tribunal.
  Implica que o ETL deve rodar em batch (ex: diário), não streaming.
- Entrega **metadados processuais** (capa do processo + movimentações), não o
  texto integral da decisão.
- Não indexa CPF/CNPJ nos campos pesquisáveis (restrição de LGPD).
- Requer cadastro e chave de API (Authorization: APIKey ...).

### Campos disponíveis (nível "capa do processo")
- Número do processo (20 dígitos: sequencial + dígito verificador + ano +
  segmento de justiça + tribunal + unidade de origem — já carrega info útil).
- Classe processual (código da TPU — Tabela Processual Unificada, precisa de
  tabela de tradução código → nome).
- Órgão julgador (vara/câmara/turma).
- Assuntos (também codificados por tabela padronizada — vira DIM_TEMA).
- Datas: distribuição (quando foi atribuído a um juiz/vara) e arquivamento
  (quando o processo foi concluído).
- Status do processo (em andamento, arquivado, etc.).
- Movimentações: lista cronológica de eventos dentro do processo (ex:
  "recebido", "sentença proferida", "recurso interposto"), cada uma com data
  e código de tipo. Principal candidato a granularidade do FATO.

### O que o DataJud NÃO cobre (precisa de outra fonte)
- Texto integral da decisão/acórdão → repositórios de jurisprudência específicos
  de cada tribunal (ex: banco de jurisprudência do STJ/STF).
- Doutrina acadêmica → fora do escopo de qualquer API jurídica; para o protótipo,
  cogitar um conjunto curado manualmente (poucos PDFs de artigos).

## Modelagem dimensional proposta
**Fato**: `FATO_MOVIMENTACAO` (ou `FATO_DECISAO`, filtrando movimentações do
tipo sentença/decisão) — uma linha por evento processual. Métricas possíveis:
tempo entre movimentações, contagem de recursos, tempo total até arquivamento.

**Dimensões**:
- `DIM_TRIBUNAL` — nome, sigla, segmento de justiça, UF.
- `DIM_TEMA` — a partir do campo "assuntos".
- `DIM_CLASSE_PROCESSUAL` — traduzida a partir da TPU.
- `DIM_ORGAO_JULGADOR` — vara/câmara.
- `DIM_TEMPO` — data, mês, ano, trimestre.
- `DIM_TIPO_MOVIMENTACAO` — tipo do evento (sentença, recurso, despacho etc.).
- `DIM_PROCESSO` — atributos que não mudam por processo (classe, assuntos, órgão).

Chave de ligação entre fato e processo: número do processo.

## Arquitetura em camadas (visão geral)
1. **Ingestão (Extract)**: conectores para DataJud (por tribunal) e,
   futuramente, repositórios de jurisprudência/diários oficiais (PDF/HTML).
   Scheduler (Airflow ou cron + scripts) orquestrando extração periódica.
2. **Processamento (Transform)**: normalização/limpeza; NLP para extrair
   tema/entidades de texto livre (fase 2, não obrigatória no MVP).
3. **Modelagem (Load)**: star schema no Data Warehouse (fato + dimensões acima).
4. **Consulta/OLAP**: Athena/Presto sobre S3 (Parquet particionado) ou stack
   equivalente; BI por cima (Metabase/Superset) para explorar padrões.
5. **DevOps**: testes automatizados (schema/consistência), CI/CD, versionamento.

## Ideia de produto final (camada de apresentação, não o núcleo do desafio)
Ideia original do usuário: um "mecanismo de busca" onde a pessoa digita o que
procura, o sistema retorna resultados (como um Google, mas com dados do DW
próprio) e, ao abrir um resultado, mostra os dados da decisão. Além disso, um
chatbot ajudaria a pessoa a entender o conteúdo para o caso dela.

Conclusão da conversa: essa ideia não substitui o núcleo exigido pelo desafio
(DW dimensional + ETL + OLAP + testes), mas pode ser construída **em cima** dele
como camada de interface/produto:
- Busca full-text sobre as decisões indexadas, usando as dimensões para
  filtrar/rankear resultados.
- Ao abrir um resultado, exibir os dados da decisão já presentes no DW.
- O chatbot pode responder perguntas usando consultas OLAP por trás dos panos
  (ex.: "como esse tema costuma ser decidido nesse tribunal?").

## Recomendação de MVP (escopo inicial sugerido)
Começar só com o DataJud (dado estruturado, sem precisar de parsing de PDF nem
NLP) para ter o pipeline ETL → DW → OLAP funcionando ponta a ponta. Depois,
numa segunda fase, agregar um repositório de jurisprudência com texto integral
para alimentar busca e chatbot.

## O que é ETL (para referência)
- **Extract**: buscar o dado na fonte original (ex.: chamar a API do DataJud
  e pegar o JSON bruto).
- **Transform**: limpar, traduzir códigos (ex.: código da TPU → nome legível),
  separar campos, padronizar formatos, remover duplicatas.
- **Load**: gravar o dado transformado no destino final (tabelas fato/dimensão
  do Data Warehouse).

## Decisões ainda em aberto
- Stack de dados (AWS/S3+Athena, Spark/Databricks, ou stack local Python+Postgres/DuckDB).
- Se e quando incorporar NLP para extrair tema/resultado de texto livre.
- Fonte específica para jurisprudência consolidada e doutrina.
- Ferramenta de orquestração do ETL (Airflow vs. scripts agendados).