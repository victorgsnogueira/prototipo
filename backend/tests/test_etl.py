"""
Testes de regressão do ETL.

Quase todo caso aqui saiu de uma falha REAL observada rodando contra a API do
DataJud, não de imaginação: os 91 tribunais publicam o mesmo campo em formas
diferentes, e cada divergência dessas derrubou uma carga antes de virar teste.
"""
from datetime import date, datetime, timezone

from etl.carga import data_ajuizamento, data_hora, segmento_e_uf
from etl.datajud import achatar
from etl.tpu import categoria, codigos_de_resultado


# --------------------------------------------------------------- datas

def test_data_ajuizamento_no_formato_do_datajud():
    assert data_ajuizamento("20250312134505") == date(2025, 3, 12)


def test_data_ajuizamento_aceita_numero():
    # REGRESSÃO: o TJ-MG publica dataAjuizamento como número em ~3% dos
    # documentos. Antes de coagir para str, quebrava com
    # "object of type 'int' has no len()" e derrubava a combinação inteira.
    assert data_ajuizamento(20250312134505) == date(2025, 3, 12)


def test_data_ajuizamento_tolera_lixo():
    assert data_ajuizamento(None) is None
    assert data_ajuizamento("") is None
    assert data_ajuizamento("2025") is None          # curto demais
    assert data_ajuizamento("20259999999999") is None  # mês 99 não existe


def test_data_hora_iso_com_z():
    assert data_hora("2026-07-29T12:06:30.000Z") == datetime(
        2026, 7, 29, 12, 6, 30, tzinfo=timezone.utc
    )
    assert data_hora(None) is None
    assert data_hora("ontem") is None


# ------------------------------------------------------- forma variável

def _fonte(**extra):
    base = {
        "numeroProcesso": "00001333920258260334",
        "tribunal": "TJSP",
        "grau": "JE",
        "classe": {"codigo": 436, "nome": "Procedimento do Juizado Especial Cível"},
        "orgaoJulgador": {"codigo": 10879, "nome": "Vara X", "codigoMunicipioIBGE": 3528106},
        "assuntos": [{"codigo": 7768, "nome": "Rescisão do contrato"}],
        "movimentos": [{"codigo": 219, "dataHora": "2024-03-14T10:00:00.000Z", "nome": "Procedência"}],
    }
    base.update(extra)
    return base


def test_achatar_processo_normal():
    p = achatar(_fonte())
    assert p is not None
    assert p.numero == "00001333920258260334"
    assert p.classe_codigo == 436
    assert p.orgao_codigo == "10879"
    assert p.assuntos == [(7768, "Rescisão do contrato")]


def test_achatar_aceita_assunto_aninhado_em_lista():
    # REGRESSÃO: no TJ-MG, 1 item de assunto em 201 veio como lista aninhada.
    # Antes quebrava com "'list' object has no attribute 'get'".
    p = achatar(_fonte(assuntos=[[{"codigo": 899, "nome": "Dívida Ativa"}]]))
    assert p is not None
    assert p.assuntos == [(899, "Dívida Ativa")]


def test_achatar_aceita_classe_e_orgao_em_lista():
    p = achatar(_fonte(
        classe=[{"codigo": 12154, "nome": "Execução"}],
        orgaoJulgador=[{"codigo": 4327, "nome": "1ª Vara Cível"}],
    ))
    assert p is not None
    assert p.classe_codigo == 12154
    assert p.orgao_nome == "1ª Vara Cível"


def test_achatar_descarta_assunto_sem_nome():
    # Assunto sem nome viraria tema sem rótulo na interface.
    p = achatar(_fonte(assuntos=[{"codigo": 123}, {"codigo": 456, "nome": "Válido"}]))
    assert p is not None
    assert p.assuntos == [(456, "Válido")]


def test_achatar_sem_numero_devolve_none():
    # Número é a chave natural que liga fato e dimensão; sem ele a linha é
    # inútil e é melhor descartar do que gravar órfã.
    assert achatar({"tribunal": "TJSP"}) is None


def test_achatar_tolera_campos_ausentes():
    p = achatar({"numeroProcesso": "00001333920258260334"})
    assert p is not None
    assert p.classe_codigo is None
    assert p.assuntos == []
    assert p.movimentos == []


# ------------------------------------------------------------- TPU

def test_categorias_de_julgamento_verificadas_na_api():
    # Os três nomes foram conferidos contra a API pública antes de mapear.
    assert categoria(219) == "favoravel"      # Procedência
    assert categoria(220) == "desfavoravel"   # Improcedência
    assert categoria(221) == "parcial"        # Procedência em Parte


def test_codigo_desconhecido_nao_vira_resultado():
    # Na dúvida, 'outro': um código mal classificado corromperia silenciosamente
    # toda métrica de favorável/desfavorável do produto.
    assert categoria(999999) == "outro"
    assert categoria(51) == "outro"           # Conclusão, movimento de trâmite


def test_codigos_de_resultado_sao_exatamente_os_tres():
    assert sorted(codigos_de_resultado()) == [219, 220, 221]


# -------------------------------------------------------- dim_tribunal

def test_segmento_derivado_da_sigla():
    assert segmento_e_uf("TJSP") == ("estadual", "SP")
    assert segmento_e_uf("STJ") == ("superior", None)
    assert segmento_e_uf("TRF3") == ("federal", None)
    assert segmento_e_uf("TRT2") == ("trabalhista", None)
    assert segmento_e_uf("XPTO") == (None, None)
