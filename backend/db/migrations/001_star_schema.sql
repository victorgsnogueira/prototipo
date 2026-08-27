-- ============================================================================
-- Ratio — Data Warehouse jurídico · esquema estrela
--
-- Grão do fato: UMA movimentação processual (um evento dentro de um processo).
-- É o menor evento que o DataJud entrega e é o que permite medir tempo entre
-- etapas, taxa de recurso e — o mais importante para o produto — o RESULTADO
-- do julgamento, via os códigos da TPU (219 procedência, 220 improcedência,
-- 221 procedência em parte).
--
-- Assuntos são N:N com processo (um processo pode ter vários), então entram
-- por tabela-ponte em vez de coluna no fato. Sem isso, contagem por tema
-- duplicaria linhas de fato e inflaria toda métrica.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------- dimensões

CREATE TABLE IF NOT EXISTS dim_tribunal (
  tribunal_sk   SERIAL PRIMARY KEY,
  sigla         TEXT NOT NULL UNIQUE,
  nome          TEXT,
  segmento      TEXT,              -- estadual, federal, trabalhista, superior...
  uf            TEXT
);

-- Tema = "assunto" da TPU. É a entidade central do produto: o usuário busca
-- por tema, não por processo.
CREATE TABLE IF NOT EXISTS dim_tema (
  tema_sk       SERIAL PRIMARY KEY,
  codigo_tpu    INTEGER NOT NULL UNIQUE,
  nome          TEXT NOT NULL,
  busca         TSVECTOR           -- preenchido por trigger; índice GIN abaixo
);

CREATE TABLE IF NOT EXISTS dim_classe (
  classe_sk     SERIAL PRIMARY KEY,
  codigo_tpu    INTEGER NOT NULL UNIQUE,
  nome          TEXT NOT NULL
);

-- Órgão julgador (vara, câmara, turma). É o nível que permite responder à
-- colegialidade — "câmaras do mesmo tribunal decidem igual entre si?" — que
-- é dor declarada de desembargador em 2ª instância.
CREATE TABLE IF NOT EXISTS dim_orgao (
  orgao_sk        SERIAL PRIMARY KEY,
  codigo          TEXT NOT NULL,
  nome            TEXT,
  tribunal_sk     INTEGER NOT NULL REFERENCES dim_tribunal(tribunal_sk),
  municipio_ibge  INTEGER,
  UNIQUE (tribunal_sk, codigo)
);

CREATE TABLE IF NOT EXISTS dim_tempo (
  tempo_sk    INTEGER PRIMARY KEY,     -- AAAAMMDD
  data        DATE NOT NULL UNIQUE,
  ano         SMALLINT NOT NULL,
  mes         SMALLINT NOT NULL,
  trimestre   SMALLINT NOT NULL,
  dia         SMALLINT NOT NULL
);

-- Tipo de movimentação, com a classificação que dá sentido analítico ao fato.
-- 'categoria' é o que traduz código da TPU em resultado utilizável:
--   favoravel | desfavoravel | parcial | extincao | recurso | outro
CREATE TABLE IF NOT EXISTS dim_movimento (
  movimento_sk  SERIAL PRIMARY KEY,
  codigo_tpu    INTEGER NOT NULL UNIQUE,
  nome          TEXT,
  categoria     TEXT NOT NULL DEFAULT 'outro'
);

CREATE TABLE IF NOT EXISTS dim_processo (
  processo_sk       SERIAL PRIMARY KEY,
  numero            TEXT NOT NULL UNIQUE,   -- número CNJ, 20 dígitos, sem máscara
  tribunal_sk       INTEGER NOT NULL REFERENCES dim_tribunal(tribunal_sk),
  classe_sk         INTEGER REFERENCES dim_classe(classe_sk),
  orgao_sk          INTEGER REFERENCES dim_orgao(orgao_sk),
  grau              TEXT,
  data_ajuizamento  DATE,
  nivel_sigilo      SMALLINT DEFAULT 0
);

-- Ponte N:N processo <-> tema
CREATE TABLE IF NOT EXISTS ponte_processo_tema (
  processo_sk  INTEGER NOT NULL REFERENCES dim_processo(processo_sk) ON DELETE CASCADE,
  tema_sk      INTEGER NOT NULL REFERENCES dim_tema(tema_sk),
  PRIMARY KEY (processo_sk, tema_sk)
);

-- -------------------------------------------------------------------- fato

CREATE TABLE IF NOT EXISTS fato_movimentacao (
  fato_sk       BIGSERIAL PRIMARY KEY,
  processo_sk   INTEGER NOT NULL REFERENCES dim_processo(processo_sk) ON DELETE CASCADE,
  movimento_sk  INTEGER NOT NULL REFERENCES dim_movimento(movimento_sk),
  tempo_sk      INTEGER REFERENCES dim_tempo(tempo_sk),
  tribunal_sk   INTEGER NOT NULL REFERENCES dim_tribunal(tribunal_sk),
  orgao_sk      INTEGER REFERENCES dim_orgao(orgao_sk),
  data_hora     TIMESTAMPTZ,
  -- Um mesmo movimento pode repetir no processo (ex.: várias conclusões).
  -- A chave natural inclui data_hora para o carregamento ser idempotente.
  UNIQUE (processo_sk, movimento_sk, data_hora)
);

-- ------------------------------------------------------------------ índices

CREATE INDEX IF NOT EXISTS ix_fato_tema_lookup   ON fato_movimentacao (movimento_sk, tribunal_sk);
CREATE INDEX IF NOT EXISTS ix_fato_processo      ON fato_movimentacao (processo_sk);
CREATE INDEX IF NOT EXISTS ix_fato_tempo         ON fato_movimentacao (tempo_sk);
CREATE INDEX IF NOT EXISTS ix_ponte_tema         ON ponte_processo_tema (tema_sk);
CREATE INDEX IF NOT EXISTS ix_processo_tribunal  ON dim_processo (tribunal_sk);
CREATE INDEX IF NOT EXISTS ix_movimento_categoria ON dim_movimento (categoria);

-- Busca full-text em português direto no Postgres — evita subir Elasticsearch
-- só para o campo de busca do produto.
CREATE INDEX IF NOT EXISTS ix_tema_busca ON dim_tema USING GIN (busca);
CREATE INDEX IF NOT EXISTS ix_tema_trgm  ON dim_tema USING GIN (nome gin_trgm_ops);

CREATE OR REPLACE FUNCTION trg_dim_tema_busca() RETURNS trigger AS $$
BEGIN
  NEW.busca := to_tsvector('portuguese', unaccent(COALESCE(NEW.nome, '')));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dim_tema_busca ON dim_tema;
CREATE TRIGGER dim_tema_busca
  BEFORE INSERT OR UPDATE OF nome ON dim_tema
  FOR EACH ROW EXECUTE FUNCTION trg_dim_tema_busca();

COMMIT;
