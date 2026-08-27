"""
Tradução de código da TPU (Tabela Processual Unificada, CNJ) para a categoria
analítica que o produto usa.

Só entram aqui códigos cujo nome foi CONFERIDO contra a API pública do DataJud
(ver docstring de cada grupo). O DataJud não expõe "resultado do julgamento"
como campo — ele só existe como movimentação, e é daqui que o favorável /
desfavorável do produto tira lastro. Errar este mapa corrompe silenciosamente
toda métrica da aplicação, então a regra é: na dúvida, 'outro'.

Categorias:
    favoravel     pedido acolhido
    desfavoravel  pedido rejeitado
    parcial       acolhido em parte — somado ao favorável nos agregados
    extincao      processo encerrado sem julgar o mérito
    outro         movimentação de trâmite, sem valor de resultado
"""

# Verificados na API pública (api_publica_tjsp), consultando o nome que o
# próprio DataJud devolve para cada código:
#   219 -> "Procedência"
#   220 -> "Improcedência"
#   221 -> "Procedência em Parte"
CATEGORIA_POR_CODIGO: dict[int, str] = {
    219: "favoravel",
    220: "desfavoravel",
    221: "parcial",
    # 196 -> "Extinção da execução ou do cumprimento da sentença"
    196: "extincao",
    # 471 -> "Pronúncia de Decadência ou Prescrição". Encerra com mérito, mas
    # classificar como desfavorável inflaria a métrica com um resultado que é
    # processual, não de tese. Fica fora do cálculo de propósito.
    471: "extincao",
}

# Movimentações que confirmam encerramento, úteis para medir duração mas sem
# valor de resultado. Mapeadas explicitamente para não caírem em 'outro' por
# omissão — deixa claro que foram consideradas.
#   22  -> "Baixa Definitiva"
#   246 -> "Definitivo"
CATEGORIA_POR_CODIGO.update({22: "outro", 246: "outro"})

CATEGORIAS_DE_RESULTADO = frozenset({"favoravel", "desfavoravel", "parcial"})


def categoria(codigo: int) -> str:
    """Categoria analítica de um código de movimento da TPU."""
    return CATEGORIA_POR_CODIGO.get(codigo, "outro")


def codigos_de_resultado() -> list[int]:
    """Códigos que representam resultado de julgamento.

    Usado pelo extrator para filtrar, na origem, só processos que já foram
    julgados — puxar processo sem julgamento gastaria cota da API para carregar
    linha que nenhum agregado consegue usar.
    """
    return [c for c, cat in CATEGORIA_POR_CODIGO.items() if cat in CATEGORIAS_DE_RESULTADO]
