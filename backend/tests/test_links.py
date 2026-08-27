"""Testes do formatador CNJ e da montagem de link.

O formatador é o ponto que mais merece teste do módulo: se ele errar, o link
leva o usuário a um processo que não é o dele — falha silenciosa e pior que
link quebrado, porque parece que funcionou.
"""
from app.links import formatar_cnj, link_processo, partes_cnj


def test_formata_numero_cnj_real():
    # Número real vindo do DataJud (TJ-SP), sem máscara.
    assert formatar_cnj("00001333920258260334") == "0000133-39.2025.8.26.0334"


def test_formatar_ignora_mascara_ja_existente():
    # Idempotente: formatar duas vezes não corrompe.
    uma = formatar_cnj("00001333920258260334")
    assert formatar_cnj(uma) == uma


def test_formatar_devolve_entrada_quando_nao_tem_20_digitos():
    # Sem 20 dígitos não dá para afirmar a estrutura; devolver como veio é
    # melhor do que gerar uma máscara inventada.
    assert formatar_cnj("123") == "123"


def test_partes_cnj_decompoe_segmento_e_tribunal():
    p = partes_cnj("00001333920258260334")
    assert p is not None
    assert p["ano"] == "2025"
    assert p["segmento"] == "8"    # Justiça Estadual
    assert p["tribunal"] == "26"   # TJ-SP
    assert p["origem"] == "0334"


def test_link_direto_para_tjsp_carrega_o_numero():
    link = link_processo("TJSP", "00001333920258260334")
    assert link is not None
    assert link["tipo"] == "direto"
    assert "esaj.tjsp.jus.br" in link["url"]
    # O número precisa ir na URL, senão o "direto" não é direto.
    assert "0000133-39.2025" in link["url"]


def test_link_de_portal_quando_nao_ha_padrao_direto():
    link = link_processo("TJRJ", "00001333920258260334")
    assert link is not None
    assert link["tipo"] == "portal"
    # Mesmo sem link direto, o número formatado vai junto para o usuário colar.
    assert link["numero_formatado"] == "0000133-39.2025.8.26.0334"


def test_tribunal_desconhecido_nao_inventa_link():
    # Preferimos número sem link a mandar o usuário para página que não resolve.
    assert link_processo("TJXX", "00001333920258260334") is None
