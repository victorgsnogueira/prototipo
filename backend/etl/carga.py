"""
Carga: DataJud -> esquema estrela.

Roda como script:  python -m etl.carga
Configuração por ambiente (ver .env.example).

A carga é IDEMPOTENTE: rodar duas vezes com os mesmos dados não duplica linha
nem infla contagem. Isso é requisito, não conforto — o agendamento diário vai
reprocessar janelas que se sobrepõem, e um fato duplicado apareceria como
decisão a mais nos gráficos.
"""
from __future__ import annotations

import logging
import os
import sys
from datetime import date, datetime, timezone

import psycopg

from .datajud import DataJud, Processo
from .tpu import categoria, codigos_de_resultado

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("carga")


def dsn() -> str:
    return os.getenv(
        "DATABASE_URL",
        "postgresql://ratio:ratio@localhost:5433/ratio",
    )


def _tribunais() -> list[str]:
    return [t.strip().lower() for t in os.getenv("ETL_TRIBUNAIS", "tjsp,tjrj,tjmg").split(",") if t.strip()]


def _assuntos() -> list[int]:
    bruto = os.getenv("ETL_ASSUNTOS", "")
    return [int(a) for a in bruto.replace(" ", "").split(",") if a]


def _limite() -> int:
    return int(os.getenv("ETL_LIMITE_POR_COMBINACAO", "400"))


# ------------------------------------------------------------------ parsers

def data_ajuizamento(bruto: str | None) -> date | None:
    """'20250312134505' -> date(2025, 3, 12). Formato próprio do DataJud."""
    if not bruto or len(bruto) < 8:
        return None
    try:
        return date(int(bruto[0:4]), int(bruto[4:6]), int(bruto[6:8]))
    except ValueError:
        return None


def data_hora(bruto: str | None) -> datetime | None:
    """ISO-8601 com 'Z' -> datetime com fuso. Formato dos movimentos."""
    if not bruto:
        return None
    try:
        return datetime.fromisoformat(bruto.replace("Z", "+00:00"))
    except ValueError:
        return None


def segmento_e_uf(sigla: str) -> tuple[str | None, str | None]:
    """Deriva segmento e UF da sigla do tribunal.

    A sigla já carrega essa informação de forma regular ('TJSP' = estadual/SP,
    'TRF3' = federal), então não precisamos de tabela externa para popular a
    dimensão com algo útil de filtrar.
    """
    s = sigla.upper()
    if s in {"STF", "STJ", "TST", "TSE", "STM"}:
        return "superior", None
    if s.startswith("TJ") and len(s) == 4:
        return "estadual", s[2:]
    if s.startswith("TRF"):
        return "federal", None
    if s.startswith("TRT"):
        return "trabalhista", None
    if s.startswith("TRE") and len(s) == 5:
        return "eleitoral", s[3:]
    return None, None


# --------------------------------------------------------------- carregador

class Carregador:
    """Grava no esquema estrela, com cache de dimensões em memória.

    O cache existe porque uma carga de milhares de processos repete os mesmos
    poucos tribunais, classes e órgãos — sem ele seria uma ida ao banco por
    atributo por linha.
    """

    def __init__(self, con: psycopg.Connection):
        self.con = con
        self._tribunais: dict[str, int] = {}
        self._temas: dict[int, int] = {}
        self._classes: dict[int, int] = {}
        self._orgaos: dict[tuple[int, str], int] = {}
        self._movimentos: dict[int, int] = {}
        self._tempos: set[int] = set()

    # -- dimensões (upsert com cache) --------------------------------------

    def tribunal(self, sigla: str) -> int:
        sigla = sigla.upper()
        if sigla in self._tribunais:
            return self._tribunais[sigla]
        segmento, uf = segmento_e_uf(sigla)
        sk = self.con.execute(
            """
            INSERT INTO dim_tribunal (sigla, nome, segmento, uf)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (sigla) DO UPDATE SET segmento = EXCLUDED.segmento
            RETURNING tribunal_sk
            """,
            (sigla, sigla, segmento, uf),
        ).fetchone()[0]
        self._tribunais[sigla] = sk
        return sk

    def tema(self, codigo: int, nome: str) -> int:
        if codigo in self._temas:
            return self._temas[codigo]
        sk = self.con.execute(
            """
            INSERT INTO dim_tema (codigo_tpu, nome)
            VALUES (%s, %s)
            ON CONFLICT (codigo_tpu) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING tema_sk
            """,
            (codigo, nome),
        ).fetchone()[0]
        self._temas[codigo] = sk
        return sk

    def classe(self, codigo: int | None, nome: str | None) -> int | None:
        if codigo is None:
            return None
        if codigo in self._classes:
            return self._classes[codigo]
        sk = self.con.execute(
            """
            INSERT INTO dim_classe (codigo_tpu, nome)
            VALUES (%s, %s)
            ON CONFLICT (codigo_tpu) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING classe_sk
            """,
            (codigo, nome or str(codigo)),
        ).fetchone()[0]
        self._classes[codigo] = sk
        return sk

    def orgao(self, tribunal_sk: int, codigo: str | None, nome: str | None,
              municipio: int | None) -> int | None:
        if not codigo:
            return None
        chave = (tribunal_sk, codigo)
        if chave in self._orgaos:
            return self._orgaos[chave]
        sk = self.con.execute(
            """
            INSERT INTO dim_orgao (codigo, nome, tribunal_sk, municipio_ibge)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (tribunal_sk, codigo) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING orgao_sk
            """,
            (codigo, nome, tribunal_sk, municipio),
        ).fetchone()[0]
        self._orgaos[chave] = sk
        return sk

    def movimento(self, codigo: int, nome: str | None) -> int:
        if codigo in self._movimentos:
            return self._movimentos[codigo]
        sk = self.con.execute(
            """
            INSERT INTO dim_movimento (codigo_tpu, nome, categoria)
            VALUES (%s, %s, %s)
            ON CONFLICT (codigo_tpu) DO UPDATE
              SET nome = COALESCE(EXCLUDED.nome, dim_movimento.nome),
                  categoria = EXCLUDED.categoria
            RETURNING movimento_sk
            """,
            (codigo, nome, categoria(codigo)),
        ).fetchone()[0]
        self._movimentos[codigo] = sk
        return sk

    def tempo(self, quando: datetime | None) -> int | None:
        if quando is None:
            return None
        d = quando.astimezone(timezone.utc).date()
        sk = d.year * 10000 + d.month * 100 + d.day
        if sk in self._tempos:
            return sk
        self.con.execute(
            """
            INSERT INTO dim_tempo (tempo_sk, data, ano, mes, trimestre, dia)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (tempo_sk) DO NOTHING
            """,
            (sk, d, d.year, d.month, (d.month - 1) // 3 + 1, d.day),
        )
        self._tempos.add(sk)
        return sk

    # -- processo + fatos ---------------------------------------------------

    def gravar(self, p: Processo) -> int:
        """Grava um processo com seus temas e movimentações. Devolve nº de fatos."""
        tribunal_sk = self.tribunal(p.tribunal)
        classe_sk = self.classe(p.classe_codigo, p.classe_nome)
        orgao_sk = self.orgao(tribunal_sk, p.orgao_codigo, p.orgao_nome, p.municipio_ibge)

        processo_sk = self.con.execute(
            """
            INSERT INTO dim_processo
              (numero, tribunal_sk, classe_sk, orgao_sk, grau, data_ajuizamento, nivel_sigilo)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (numero) DO UPDATE
              SET orgao_sk = COALESCE(EXCLUDED.orgao_sk, dim_processo.orgao_sk),
                  classe_sk = COALESCE(EXCLUDED.classe_sk, dim_processo.classe_sk)
            RETURNING processo_sk
            """,
            (p.numero, tribunal_sk, classe_sk, orgao_sk, p.grau,
             data_ajuizamento(p.data_ajuizamento), p.nivel_sigilo),
        ).fetchone()[0]

        for codigo, nome in p.assuntos:
            tema_sk = self.tema(codigo, nome)
            self.con.execute(
                """
                INSERT INTO ponte_processo_tema (processo_sk, tema_sk)
                VALUES (%s, %s) ON CONFLICT DO NOTHING
                """,
                (processo_sk, tema_sk),
            )

        fatos = 0
        for m in p.movimentos:
            codigo = m.get("codigo")
            if codigo is None:
                continue
            quando = data_hora(m.get("dataHora"))
            movimento_sk = self.movimento(int(codigo), m.get("nome"))
            mov_orgao = m.get("orgaoJulgador") or {}
            fato_orgao_sk = self.orgao(
                tribunal_sk, _str_ou_nada(mov_orgao.get("codigo")), mov_orgao.get("nome"), None
            ) or orgao_sk

            # ON CONFLICT sobre (processo, movimento, data_hora) é o que torna
            # a carga idempotente — reprocessar a mesma janela não duplica fato.
            self.con.execute(
                """
                INSERT INTO fato_movimentacao
                  (processo_sk, movimento_sk, tempo_sk, tribunal_sk, orgao_sk, data_hora)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (processo_sk, movimento_sk, data_hora) DO NOTHING
                """,
                (processo_sk, movimento_sk, self.tempo(quando), tribunal_sk,
                 fato_orgao_sk, quando),
            )
            fatos += 1
        return fatos

    def atualizar_agregados(self) -> None:
        """Recalcula as views materializadas na ordem de dependência."""
        for mv in ("mv_resultado_processo", "mv_tema_resumo", "mv_tema_ano",
                   "mv_tema_tribunal", "mv_tema_orgao"):
            log.info("atualizando %s", mv)
            self.con.execute(f"REFRESH MATERIALIZED VIEW {mv}")


def _str_ou_nada(v: object) -> str | None:
    return str(v) if v is not None else None


# --------------------------------------------------------------------- main

def main() -> int:
    tribunais = _tribunais()
    assuntos = _assuntos()
    limite = _limite()

    if not assuntos:
        log.error(
            "ETL_ASSUNTOS vazio. Informe códigos de assunto da TPU separados por "
            "vírgula, ex.: ETL_ASSUNTOS=7768,6017"
        )
        return 2

    log.info("tribunais=%s assuntos=%s limite/combinação=%d",
             ",".join(tribunais), assuntos, limite)

    codigos_mov = codigos_de_resultado()
    total_proc = total_fato = 0

    with psycopg.connect(dsn(), autocommit=False) as con, DataJud() as api:
        carregador = Carregador(con)
        for tribunal in tribunais:
            for assunto in assuntos:
                n = 0
                try:
                    for p in api.buscar_por_assunto(tribunal, assunto, codigos_mov, limite):
                        total_fato += carregador.gravar(p)
                        n += 1
                        total_proc += 1
                except Exception as e:  # noqa: BLE001
                    # Um tribunal fora do ar não pode derrubar a carga inteira;
                    # o que já entrou continua válido.
                    log.warning("%s/assunto %s interrompido: %s", tribunal, assunto, e)
                con.commit()
                log.info("%s assunto %s -> %d processos", tribunal, assunto, n)

        carregador.atualizar_agregados()
        con.commit()

    log.info("concluído: %d processos, %d movimentações", total_proc, total_fato)
    return 0


if __name__ == "__main__":
    sys.exit(main())
