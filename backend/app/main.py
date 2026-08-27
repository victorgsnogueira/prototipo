"""
API do Ratio — consultas OLAP sobre o DW jurídico.

Cada rota abaixo é uma consulta agregada no esquema estrela; nenhuma inventa
número. Onde o dado não existe (texto integral do acórdão, doutrina), a API
devolve vazio em vez de preencher — é preferível a interface mostrar "sem
dado" a mostrar dado que o DataJud não entrega.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from . import forca
from .links import link_processo

DSN = os.getenv("DATABASE_URL", "postgresql://ratio:ratio@localhost:5433/ratio")

pool = ConnectionPool(DSN, min_size=1, max_size=8, open=False, kwargs={"row_factory": dict_row})


@asynccontextmanager
async def ciclo(_: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(
    title="Ratio — API",
    description="Consultas OLAP sobre o Data Warehouse jurídico (fonte: DataJud/CNJ).",
    version="0.1.0",
    lifespan=ciclo,
)

# O front roda em outra origem (Vite em dev, Caddy em produção). Lista explícita
# em vez de "*" porque a API vai para VPS pública.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv(
        "CORS_ORIGENS", "http://localhost:5173,http://localhost:5500,http://127.0.0.1:5500"
    ).split(",")],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def consulta(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    with pool.connection() as con:
        return con.execute(sql, params).fetchall()


# ------------------------------------------------------------------- rotas

@app.get("/api/saude", tags=["infra"])
def saude() -> dict[str, Any]:
    """Prontidão real: responde se o banco tem dado utilizável, não só se sobe."""
    try:
        r = consulta("SELECT COUNT(*) AS n FROM mv_tema_resumo WHERE julgados > 0")
        temas = r[0]["n"]
    except Exception as e:  # noqa: BLE001
        raise HTTPException(503, f"banco indisponível: {e}") from e
    return {"ok": True, "temas_com_julgamento": temas}


@app.get("/api/temas", tags=["temas"])
def buscar_temas(
    q: str = Query("", description="Termo livre. Vazio devolve os temas de maior volume."),
    limite: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """Busca de temas.

    Full-text em português com unaccent (o usuário digita sem acento e precisa
    achar), e trigrama como rede para erro de digitação. Sem termo, devolve os
    temas de maior volume — a tela inicial precisa mostrar algo útil.
    """
    termo = q.strip()
    if not termo:
        linhas = consulta(
            """
            SELECT r.*, NULL::real AS relevancia
            FROM mv_tema_resumo r
            WHERE r.julgados > 0
            ORDER BY r.processos DESC
            LIMIT %s
            """,
            (limite,),
        )
    else:
        linhas = consulta(
            """
            SELECT r.*,
                   GREATEST(
                     ts_rank(t.busca, plainto_tsquery('portuguese', unaccent(%s))),
                     similarity(unaccent(t.nome), unaccent(%s))
                   ) AS relevancia
            FROM mv_tema_resumo r
            JOIN dim_tema t ON t.tema_sk = r.tema_sk
            WHERE r.julgados > 0
              AND (t.busca @@ plainto_tsquery('portuguese', unaccent(%s))
                   OR unaccent(t.nome) %% unaccent(%s))
            ORDER BY relevancia DESC, r.processos DESC
            LIMIT %s
            """,
            (termo, termo, termo, termo, limite),
        )

    return {
        "termo": termo,
        "total": len(linhas),
        "temas": [_resumo_tema(l) for l in linhas],
    }


@app.get("/api/temas/{codigo}", tags=["temas"])
def detalhar_tema(codigo: int) -> dict[str, Any]:
    """Painel completo de um tema: nota auditável, série anual e recortes."""
    base = consulta("SELECT * FROM mv_tema_resumo WHERE codigo_tpu = %s", (codigo,))
    if not base:
        raise HTTPException(404, f"tema {codigo} não encontrado")
    r = base[0]
    tema_sk = r["tema_sk"]

    serie = consulta(
        "SELECT ano, favoravel, desfavoravel FROM mv_tema_ano WHERE tema_sk = %s ORDER BY ano",
        (tema_sk,),
    )
    tribunais = consulta(
        """
        SELECT sigla, favoravel, desfavoravel
        FROM mv_tema_tribunal WHERE tema_sk = %s
        ORDER BY (favoravel + desfavoravel) DESC
        """,
        (tema_sk,),
    )
    # Colegialidade: só faz sentido mostrar órgão que julgou mais de uma vez,
    # senão a lista vira ruído de vara com um processo só.
    orgaos = consulta(
        """
        SELECT sigla, orgao, favoravel, desfavoravel
        FROM mv_tema_orgao
        WHERE tema_sk = %s AND (favoravel + desfavoravel) > 1
        ORDER BY (favoravel + desfavoravel) DESC
        LIMIT 20
        """,
        (tema_sk,),
    )

    return {
        **_resumo_tema(r),
        "serie": [dict(s) for s in serie],
        "por_tribunal": [dict(t) for t in tribunais],
        "por_orgao": [dict(o) for o in orgaos],
    }


@app.get("/api/temas/{codigo}/decisoes", tags=["temas"])
def decisoes_do_tema(
    codigo: int,
    tribunal: str | None = Query(None, description="Sigla, ex.: TJSP"),
    resultado: str | None = Query(None, pattern="^(favoravel|desfavoravel|parcial)$"),
    limite: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """Processos que sustentam o tema, com link para a fonte oficial.

    É a camada de verificação do produto: sem poder abrir o processo no
    tribunal, o número é dado que o profissional não cita.
    """
    base = consulta("SELECT tema_sk FROM mv_tema_resumo WHERE codigo_tpu = %s", (codigo,))
    if not base:
        raise HTTPException(404, f"tema {codigo} não encontrado")

    filtros = ["pt.tema_sk = %s"]
    params: list[Any] = [base[0]["tema_sk"]]
    if tribunal:
        filtros.append("tb.sigla = %s")
        params.append(tribunal.upper())
    if resultado:
        filtros.append("res.categoria = %s")
        params.append(resultado)
    params.append(limite)

    linhas = consulta(
        f"""
        SELECT p.numero, tb.sigla AS tribunal, o.nome AS orgao, c.nome AS classe,
               p.grau, res.categoria AS resultado, res.data_hora AS decidido_em
        FROM ponte_processo_tema pt
        JOIN dim_processo p          ON p.processo_sk = pt.processo_sk
        JOIN mv_resultado_processo res ON res.processo_sk = p.processo_sk
        JOIN dim_tribunal tb         ON tb.tribunal_sk = p.tribunal_sk
        LEFT JOIN dim_orgao o        ON o.orgao_sk = res.orgao_sk
        LEFT JOIN dim_classe c       ON c.classe_sk = p.classe_sk
        WHERE {' AND '.join(filtros)}
        ORDER BY res.data_hora DESC
        LIMIT %s
        """,
        tuple(params),
    )

    return {
        "total": len(linhas),
        "decisoes": [
            {
                "numero": l["numero"],
                "tribunal": l["tribunal"],
                "orgao": l["orgao"],
                "classe": l["classe"],
                "grau": l["grau"],
                "resultado": l["resultado"],
                "decidido_em": l["decidido_em"].isoformat() if l["decidido_em"] else None,
                "fonte": link_processo(l["tribunal"], l["numero"]),
            }
            for l in linhas
        ],
    }


# ------------------------------------------------------------------ auxiliar

def _resumo_tema(l: dict[str, Any]) -> dict[str, Any]:
    fav, desf = l["favoravel"] or 0, l["desfavoravel"] or 0
    nota = forca.calcular(fav, desf, l["tribunais"] or 0, l["ano_fim"])
    return {
        "codigo": l["codigo_tpu"],
        "nome": l["nome"],
        "processos": l["processos"],
        "julgados": l["julgados"],
        "tribunais": l["tribunais"],
        "favoravel": fav,
        "desfavoravel": desf,
        "periodo": {"inicio": l["ano_inicio"], "fim": l["ano_fim"]},
        "forca": nota,
        "relevancia": l.get("relevancia"),
    }
