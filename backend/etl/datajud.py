"""
Cliente da API pública do DataJud (CNJ).

A API é um Elasticsearch exposto por trás de um proxy: cada tribunal tem seu
próprio índice/endpoint, e a consulta vai como corpo JSON num POST. Não existe
endpoint único agregando os 91 tribunais — coletar de vários é fazer N chamadas.

Referência: https://datajud-wiki.cnj.jus.br/api-publica/
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Iterator

import httpx

log = logging.getLogger(__name__)

BASE = "https://api-publica.datajud.cnj.jus.br"

# Chave pública, divulgada pelo próprio CNJ na documentação da API. Não é
# segredo — está no wiki público. Fica sobrescritível por ambiente para o caso
# de o CNJ rotacionar a chave sem que precisemos alterar código.
CHAVE_PADRAO = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="

# Teto do Elasticsearch por página. Acima disso é preciso paginar com
# search_after, que é o que fazemos.
PAGINA_MAX = 100


@dataclass
class Processo:
    """Um processo como o DataJud devolve, já achatado no que usamos."""

    numero: str
    tribunal: str
    grau: str | None
    classe_codigo: int | None
    classe_nome: str | None
    orgao_codigo: str | None
    orgao_nome: str | None
    municipio_ibge: int | None
    data_ajuizamento: str | None
    nivel_sigilo: int
    assuntos: list[tuple[int, str]] = field(default_factory=list)
    movimentos: list[dict[str, Any]] = field(default_factory=list)


def _texto(v: Any) -> str | None:
    return str(v) if v is not None else None


def achatar(fonte: dict[str, Any]) -> Processo | None:
    """Converte o _source cru do Elasticsearch no nosso formato.

    Devolve None quando falta o número do processo — é a chave natural que
    liga fato e dimensão, e sem ela a linha é inútil.
    """
    numero = fonte.get("numeroProcesso")
    if not numero:
        return None

    classe = fonte.get("classe") or {}
    orgao = fonte.get("orgaoJulgador") or {}

    assuntos: list[tuple[int, str]] = []
    for a in fonte.get("assuntos") or []:
        cod, nome = a.get("codigo"), a.get("nome")
        # Assunto sem nome vira tema sem rótulo na interface; descartamos.
        if cod is not None and nome:
            assuntos.append((int(cod), nome.strip()))

    return Processo(
        numero=str(numero),
        tribunal=(fonte.get("tribunal") or "").upper(),
        grau=fonte.get("grau"),
        classe_codigo=classe.get("codigo"),
        classe_nome=classe.get("nome"),
        orgao_codigo=_texto(orgao.get("codigo")),
        orgao_nome=orgao.get("nome"),
        municipio_ibge=orgao.get("codigoMunicipioIBGE"),
        data_ajuizamento=fonte.get("dataAjuizamento"),
        nivel_sigilo=int(fonte.get("nivelSigilo") or 0),
        assuntos=assuntos,
        movimentos=fonte.get("movimentos") or [],
    )


class DataJud:
    def __init__(self, chave: str | None = None, timeout: float = 60.0):
        self.chave = chave or os.getenv("DATAJUD_API_KEY") or CHAVE_PADRAO
        self._cli = httpx.Client(
            timeout=timeout,
            headers={
                "Authorization": f"APIKey {self.chave}",
                "Content-Type": "application/json",
            },
        )

    def close(self) -> None:
        self._cli.close()

    def __enter__(self) -> "DataJud":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def _post(self, tribunal: str, corpo: dict[str, Any], tentativas: int = 4) -> dict[str, Any]:
        """POST com repetição apenas em falha TRANSITÓRIA.

        A API devolve 429 (cota) e 5xx (timeout do proxy) sob consulta pesada —
        recuperáveis esperando, tratados com recuo exponencial.

        Erro 4xx que não seja 429 é permanente (consulta malformada): repetir
        só gasta tempo e esconde o erro real atrás de tentativas. Sobe na hora,
        com o corpo da resposta, que é onde o Elasticsearch explica o motivo.
        """
        url = f"{BASE}/api_publica_{tribunal.lower()}/_search"
        atraso = 2.0
        for tentativa in range(1, tentativas + 1):
            try:
                r = self._cli.post(url, json=corpo)
                if 400 <= r.status_code < 500 and r.status_code != 429:
                    raise ValueError(
                        f"consulta rejeitada pelo DataJud ({tribunal}, HTTP "
                        f"{r.status_code}): {r.text[:400]}"
                    )
                if r.status_code in (429, 502, 503, 504):
                    raise httpx.HTTPStatusError(
                        f"HTTP {r.status_code}", request=r.request, response=r
                    )
                r.raise_for_status()
                return r.json()
            except (httpx.HTTPStatusError, httpx.TransportError) as e:
                if tentativa == tentativas:
                    raise
                log.warning(
                    "%s tentativa %d/%d falhou (%s); aguardando %.0fs",
                    tribunal, tentativa, tentativas, e, atraso,
                )
                time.sleep(atraso)
                atraso *= 2
        raise RuntimeError("inalcançável")

    def buscar_por_assunto(
        self,
        tribunal: str,
        assunto: int,
        codigos_movimento: list[int],
        limite: int,
    ) -> Iterator[Processo]:
        """Processos de um tribunal que tratam de um assunto E já foram julgados.

        Os dois filtros são aplicados na ORIGEM, não depois: puxar processo sem
        julgamento gastaria cota da API para trazer linha que nenhum agregado
        consegue usar.

        Pagina com search_after em vez de from/size porque o Elasticsearch corta
        paginação profunda em 10.000 documentos, e alguns assuntos passam disso.
        """
        corpo: dict[str, Any] = {
            "size": min(PAGINA_MAX, limite),
            "query": {
                "bool": {
                    "filter": [
                        {"term": {"assuntos.codigo": assunto}},
                        {"terms": {"movimentos.codigo": codigos_movimento}},
                    ]
                }
            },
            # Ordenação estável é requisito do search_after, e o desempate
            # evita pular/repetir documento quando há empate de data.
            #
            # O desempate NÃO pode ser _id nem numeroProcesso puro: o índice do
            # DataJud proíbe fielddata em _id e mapeia numeroProcesso como text
            # (ambos devolvem 400). O subcampo .keyword é o que aceita
            # ordenação, e é o desempate correto por ser a chave natural.
            "sort": [{"@timestamp": "asc"}, {"numeroProcesso.keyword": "asc"}],
        }

        trazidos = 0
        while trazidos < limite:
            corpo["size"] = min(PAGINA_MAX, limite - trazidos)
            dados = self._post(tribunal, corpo)
            hits = (dados.get("hits") or {}).get("hits") or []
            if not hits:
                return

            for h in hits:
                p = achatar(h.get("_source") or {})
                if p is None:
                    continue
                # O índice sabe o tribunal mesmo quando o documento não repete.
                if not p.tribunal:
                    p.tribunal = tribunal.upper()
                yield p
                trazidos += 1
                if trazidos >= limite:
                    return

            ultimo = hits[-1].get("sort")
            if not ultimo:
                return
            corpo["search_after"] = ultimo
