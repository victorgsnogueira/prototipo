"""
Cálculo da "força do entendimento" — a nota 0–100 do selo.

Esta é a métrica-assinatura do produto, e por isso ela é PRESTADA DE CONTAS:
a API devolve não só o número, mas cada componente e o peso usado. Um juiz ou
advogado não cita estatística que não consegue auditar, e "a IA calculou 81"
é exatamente o tipo de número que um profissional descarta.

A nota combina quatro sinais, todos derivados do esquema estrela — nenhum é
opinião do modelo:

  concordância  o quanto as decisões apontam para o mesmo lado.
                É o sinal mais pesado: uma tese com 95% num sentido é forte
                mesmo com volume modesto.

  volume        quantos julgamentos sustentam a tese, em escala logarítmica.
                Log e não linear porque a diferença entre 10 e 100 decisões
                importa muito mais que entre 1.000 e 1.090.

  cobertura     em quantos tribunais diferentes a tese aparece. Uma tese
                firme em um único tribunal é local, não consolidada — foi
                exatamente essa a leitura do "T-0955" no protótipo.

  recência      se ainda há julgamento recente. Tese que parou de ser julgada
                pode ter sido superada, e superada é o pior caso possível
                para quem vai citar.
"""
from __future__ import annotations

import math
from datetime import date

# Somam 1.0. Concordância domina porque é o que a pergunta do usuário de fato
# faz: "isso costuma ser decidido de que jeito?"
PESOS = {
    "concordancia": 0.45,
    "volume": 0.25,
    "cobertura": 0.20,
    "recencia": 0.10,
}

# Volume a partir do qual o componente satura. Acima disso, mais decisões não
# tornam a tese mais consolidada — só mais litigada.
VOLUME_SATURACAO = 300

# Tribunais a partir dos quais consideramos cobertura nacional.
COBERTURA_SATURACAO = 6


def _concordancia(favoravel: int, desfavoravel: int) -> float:
    julgados = favoravel + desfavoravel
    if julgados == 0:
        return 0.0
    maioria = max(favoravel, desfavoravel) / julgados
    # Reescala de [0,5 .. 1,0] para [0 .. 1]: 50/50 é divergência total (0),
    # 100/0 é unanimidade (1). Sem isso, uma tese empatada já começaria em 0,5.
    return max(0.0, (maioria - 0.5) * 2)


def _volume(julgados: int) -> float:
    if julgados <= 0:
        return 0.0
    return min(1.0, math.log10(1 + julgados) / math.log10(1 + VOLUME_SATURACAO))


def _cobertura(tribunais: int) -> float:
    if tribunais <= 0:
        return 0.0
    return min(1.0, tribunais / COBERTURA_SATURACAO)


def _recencia(ano_fim: int | None, hoje: date | None = None) -> float:
    if not ano_fim:
        return 0.0
    ano_atual = (hoje or date.today()).year
    idade = ano_atual - ano_fim
    if idade <= 1:
        return 1.0
    if idade >= 6:      # sem julgamento há 6 anos: tese possivelmente parada
        return 0.0
    return 1.0 - (idade - 1) / 5


def calcular(
    favoravel: int,
    desfavoravel: int,
    tribunais: int,
    ano_fim: int | None,
    hoje: date | None = None,
) -> dict[str, object]:
    """Nota 0–100 com os componentes abertos para auditoria."""
    julgados = favoravel + desfavoravel
    componentes = {
        "concordancia": _concordancia(favoravel, desfavoravel),
        "volume": _volume(julgados),
        "cobertura": _cobertura(tribunais),
        "recencia": _recencia(ano_fim, hoje),
    }
    nota = sum(componentes[k] * PESOS[k] for k in PESOS)

    return {
        "nota": round(nota * 100),
        "grau": grau(round(nota * 100)),
        "componentes": {
            k: {"valor": round(v, 3), "peso": PESOS[k]} for k, v in componentes.items()
        },
        "base": {
            "julgados": julgados,
            "favoravel": favoravel,
            "desfavoravel": desfavoravel,
            "tribunais": tribunais,
            "ano_fim": ano_fim,
        },
    }


def grau(nota: int) -> str:
    """Vocabulário que já existe no meio jurídico, não escala inventada."""
    if nota >= 90:
        return "Consolidada"
    if nota >= 75:
        return "Dominante"
    if nota >= 55:
        return "Em formação"
    return "Divergente"
