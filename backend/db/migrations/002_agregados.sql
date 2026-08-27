-- ============================================================================
-- Agregados OLAP — as consultas que o produto realmente faz.
--
-- São VIEWS MATERIALIZADAS de propósito: a tela de tema abre com três
-- agregações sobre milhões de linhas de fato, e rodar isso a cada request
-- deixaria a página lenta. O ETL as atualiza ao final da carga.
--
-- Toda a régua de "favorável/desfavorável" sai de dim_movimento.categoria,
-- que traduz código da TPU em resultado. Procedência em parte conta como
-- favorável parcial e é somada à metade favorável — decisão registrada aqui
-- para ficar auditável, não escondida no código da API.
-- ============================================================================

BEGIN;

-- Um processo pode ter várias movimentações de julgamento (1ª instância,
-- recurso, embargos). Tomamos a MAIS RECENTE como resultado vigente daquele
-- processo — é o entendimento que está de pé hoje, que é o que juiz e
-- advogado precisam saber.
DROP MATERIALIZED VIEW IF EXISTS mv_resultado_processo CASCADE;
CREATE MATERIALIZED VIEW mv_resultado_processo AS
SELECT DISTINCT ON (f.processo_sk)
  f.processo_sk,
  f.tribunal_sk,
  f.orgao_sk,
  m.categoria,
  f.data_hora,
  EXTRACT(YEAR FROM f.data_hora)::SMALLINT AS ano
FROM fato_movimentacao f
JOIN dim_movimento m ON m.movimento_sk = f.movimento_sk
WHERE m.categoria IN ('favoravel', 'desfavoravel', 'parcial')
ORDER BY f.processo_sk, f.data_hora DESC;

CREATE UNIQUE INDEX ix_mv_resultado_processo ON mv_resultado_processo (processo_sk);

-- Resumo por tema: alimenta o selo de força e o cabeçalho da tela.
DROP MATERIALIZED VIEW IF EXISTS mv_tema_resumo CASCADE;
CREATE MATERIALIZED VIEW mv_tema_resumo AS
SELECT
  t.tema_sk,
  t.codigo_tpu,
  t.nome,
  COUNT(DISTINCT p.processo_sk)                                          AS processos,
  COUNT(DISTINCT p.tribunal_sk)                                          AS tribunais,
  COUNT(r.processo_sk)                                                   AS julgados,
  COUNT(*) FILTER (WHERE r.categoria IN ('favoravel', 'parcial'))        AS favoravel,
  COUNT(*) FILTER (WHERE r.categoria = 'desfavoravel')                   AS desfavoravel,
  MIN(r.ano)                                                             AS ano_inicio,
  MAX(r.ano)                                                             AS ano_fim
FROM dim_tema t
JOIN ponte_processo_tema pt ON pt.tema_sk = t.tema_sk
JOIN dim_processo p         ON p.processo_sk = pt.processo_sk
LEFT JOIN mv_resultado_processo r ON r.processo_sk = p.processo_sk
GROUP BY t.tema_sk, t.codigo_tpu, t.nome;

CREATE UNIQUE INDEX ix_mv_tema_resumo ON mv_tema_resumo (tema_sk);

-- Série anual: alimenta o gráfico de evolução.
DROP MATERIALIZED VIEW IF EXISTS mv_tema_ano CASCADE;
CREATE MATERIALIZED VIEW mv_tema_ano AS
SELECT
  pt.tema_sk,
  r.ano,
  COUNT(*) FILTER (WHERE r.categoria IN ('favoravel', 'parcial')) AS favoravel,
  COUNT(*) FILTER (WHERE r.categoria = 'desfavoravel')            AS desfavoravel
FROM ponte_processo_tema pt
JOIN mv_resultado_processo r ON r.processo_sk = pt.processo_sk
WHERE r.ano IS NOT NULL
GROUP BY pt.tema_sk, r.ano;

CREATE INDEX ix_mv_tema_ano ON mv_tema_ano (tema_sk, ano);

-- Distribuição por tribunal: alimenta o gráfico de barras 100% e o filtro.
DROP MATERIALIZED VIEW IF EXISTS mv_tema_tribunal CASCADE;
CREATE MATERIALIZED VIEW mv_tema_tribunal AS
SELECT
  pt.tema_sk,
  r.tribunal_sk,
  tb.sigla,
  COUNT(*) FILTER (WHERE r.categoria IN ('favoravel', 'parcial')) AS favoravel,
  COUNT(*) FILTER (WHERE r.categoria = 'desfavoravel')            AS desfavoravel
FROM ponte_processo_tema pt
JOIN mv_resultado_processo r ON r.processo_sk = pt.processo_sk
JOIN dim_tribunal tb        ON tb.tribunal_sk = r.tribunal_sk
GROUP BY pt.tema_sk, r.tribunal_sk, tb.sigla;

CREATE INDEX ix_mv_tema_tribunal ON mv_tema_tribunal (tema_sk);

-- Colegialidade: como cada órgão julgador do MESMO tribunal decide. É a
-- pergunta de 2ª instância ("as câmaras estão conflitando entre si?").
DROP MATERIALIZED VIEW IF EXISTS mv_tema_orgao CASCADE;
CREATE MATERIALIZED VIEW mv_tema_orgao AS
SELECT
  pt.tema_sk,
  r.tribunal_sk,
  tb.sigla,
  o.orgao_sk,
  o.nome AS orgao,
  COUNT(*) FILTER (WHERE r.categoria IN ('favoravel', 'parcial')) AS favoravel,
  COUNT(*) FILTER (WHERE r.categoria = 'desfavoravel')            AS desfavoravel
FROM ponte_processo_tema pt
JOIN mv_resultado_processo r ON r.processo_sk = pt.processo_sk
JOIN dim_orgao o            ON o.orgao_sk = r.orgao_sk
JOIN dim_tribunal tb        ON tb.tribunal_sk = r.tribunal_sk
GROUP BY pt.tema_sk, r.tribunal_sk, tb.sigla, o.orgao_sk, o.nome;

CREATE INDEX ix_mv_tema_orgao ON mv_tema_orgao (tema_sk, tribunal_sk);

COMMIT;
