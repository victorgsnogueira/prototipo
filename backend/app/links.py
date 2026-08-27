"""
Links para a fonte oficial do processo.

Por que isso é uma peça própria e não uma f-string na API: o público final é
juiz e advogado, e essa gente vai CITAR o que ler aqui numa peça ou decisão.
Número sem link verificável é dado que o profissional descarta. Mas também não
existe "o site do governo" — existem 91 tribunais em sistemas diferentes
(e-SAJ, PJe, Projudi, eproc), cada um com URL e parâmetro próprios.

A saída é honesta em CAMADAS, e a camada vai junto na resposta da API para a
interface poder rotular certo em vez de prometer o que não entrega:

    "direto"  consulta do tribunal com o número já preenchido
    "portal"  portal de consulta do tribunal, número precisa ser colado
    None      tribunal desconhecido — melhor não oferecer link nenhum do que
              mandar o usuário para uma página que não resolve

Aviso registrado de propósito: os links "direto" foram montados a partir do
padrão público de cada sistema, mas não é possível garantir por teste
automatizado que abram um processo específico — os portais do STJ e do STF
respondem 403 a cliente não-navegador, e processo em segredo de justiça não
abre para ninguém. Por isso a interface nunca deve afirmar "veja a decisão",
e sim "consultar no tribunal".
"""
from __future__ import annotations

from urllib.parse import urlencode

# Segmento do Judiciário — dígito J do número CNJ (posição 14).
SEGMENTO = {
    "1": "Supremo Tribunal Federal",
    "2": "Conselho Nacional de Justiça",
    "3": "Superior Tribunal de Justiça",
    "4": "Justiça Federal",
    "5": "Justiça do Trabalho",
    "6": "Justiça Eleitoral",
    "7": "Justiça Militar da União",
    "8": "Justiça Estadual",
    "9": "Justiça Militar Estadual",
}


def formatar_cnj(numero: str) -> str:
    """20 dígitos crus -> máscara CNJ.

    '00001333920258260334' -> '0000133-39.2025.8.26.0334'

    O DataJud entrega sem máscara; todo portal de tribunal espera com. A
    estrutura é fixa pela Resolução CNJ 65/2008:
    NNNNNNN(sequencial) DD(verificador) AAAA(ano) J(segmento) TR(tribunal) OOOO(origem)
    """
    d = "".join(c for c in numero if c.isdigit())
    if len(d) != 20:
        return numero
    return f"{d[0:7]}-{d[7:9]}.{d[9:13]}.{d[13]}.{d[14:16]}.{d[16:20]}"


def partes_cnj(numero: str) -> dict[str, str] | None:
    """Decompõe o número CNJ. None se não tiver 20 dígitos."""
    d = "".join(c for c in numero if c.isdigit())
    if len(d) != 20:
        return None
    return {
        "sequencial": d[0:7],
        "verificador": d[7:9],
        "ano": d[9:13],
        "segmento": d[13],
        "tribunal": d[14:16],
        "origem": d[16:20],
    }


def _esaj_tjsp(numero: str) -> str:
    """e-SAJ (TJ-SP) aceita o número unificado quebrado em duas partes."""
    p = partes_cnj(numero)
    mascarado = formatar_cnj(numero)
    if not p:
        return "https://esaj.tjsp.jus.br/cpopg/open.do"
    q = urlencode(
        {
            "cbPesquisa": "NUMPROC",
            "dadosConsulta.tipoNuProcesso": "UNIFICADO",
            "dadosConsulta.valorConsultaNuUnificado": mascarado,
            "numeroDigitoAnoUnificado": f"{p['sequencial']}-{p['verificador']}.{p['ano']}",
            "foroNumeroUnificado": p["origem"],
        }
    )
    return f"https://esaj.tjsp.jus.br/cpopg/search.do?{q}"


# Portais por tribunal. 'direto' recebe o número e devolve URL; quando não há
# padrão público confiável, fica só 'portal'.
TRIBUNAIS: dict[str, dict[str, object]] = {
    "TJSP": {"nome": "Tribunal de Justiça de São Paulo",
             "direto": _esaj_tjsp,
             "portal": "https://esaj.tjsp.jus.br/cpopg/open.do"},
    "TJRJ": {"nome": "Tribunal de Justiça do Rio de Janeiro",
             "portal": "https://www3.tjrj.jus.br/consultaprocessual/"},
    "TJMG": {"nome": "Tribunal de Justiça de Minas Gerais",
             "portal": "https://pje.tjmg.jus.br/pje/ConsultaPublica/listView.seam"},
    "STJ":  {"nome": "Superior Tribunal de Justiça",
             "direto": lambda n: "https://processo.stj.jus.br/processo/pesquisa/?"
                                 + urlencode({"aplicacao": "processos.ea",
                                              "termo": formatar_cnj(n)}),
             "portal": "https://processo.stj.jus.br/processo/pesquisa/"},
    "STF":  {"nome": "Supremo Tribunal Federal",
             "portal": "https://portal.stf.jus.br/processos/"},
}


def link_processo(tribunal: str, numero: str) -> dict[str, str] | None:
    """Melhor link disponível para consultar um processo na origem.

    Devolve {url, tipo, rotulo, numero_formatado} ou None quando o tribunal não
    é conhecido — nesse caso a interface mostra o número sem link, que é
    preferível a mandar o usuário para uma página que não resolve nada.
    """
    sigla = (tribunal or "").upper().strip()
    conf = TRIBUNAIS.get(sigla)
    formatado = formatar_cnj(numero)

    if not conf:
        return None

    direto = conf.get("direto")
    if callable(direto):
        return {
            "url": direto(numero),
            "tipo": "direto",
            "rotulo": f"Consultar no {sigla}",
            "numero_formatado": formatado,
        }

    portal = conf.get("portal")
    if isinstance(portal, str):
        return {
            "url": portal,
            "tipo": "portal",
            "rotulo": f"Abrir consulta do {sigla}",
            "numero_formatado": formatado,
        }
    return None
