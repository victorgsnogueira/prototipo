/* ========================================================================
   Ponte entre a API do Ratio e o formato que os renderizadores já esperam.

   Existe para NÃO reescrever app.js: as funções de gráfico, cartão e selo já
   estão prontas e afinadas, e continuam recebendo o mesmo formato de sempre.
   Aqui só traduzimos a resposta da API para esse formato.

   Duas diferenças de honestidade em relação aos dados de demonstração:

   1. NÃO existe "trecho" da decisão. O DataJud entrega metadado processual
      (capa + movimentações), não o inteiro teor. Onde antes havia citação
      literal, agora vai o que de fato temos — órgão julgador, classe,
      resultado, data — mais o link para consultar no tribunal.

   2. NÃO existe doutrina. Nenhuma API pública de tribunal entrega doutrina
      acadêmica. A seção mostra estado vazio explicando isso, em vez de
      preencher com obra inventada.
   ===================================================================== */
(function (global) {
  'use strict';

  var BASE = (global.RATIO_API || 'http://127.0.0.1:8099') + '/api';

  function pegar(caminho) {
    return fetch(BASE + caminho, { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('API ' + r.status + ' em ' + caminho);
        return r.json();
      });
  }

  /* A API fala 'favoravel/desfavoravel'; os gráficos falam 'fav/desf'. */
  function serie(linhas) {
    return (linhas || []).map(function (a) {
      return { ano: a.ano, fav: a.favoravel, desf: a.desfavoravel };
    });
  }

  function porTribunal(linhas) {
    return (linhas || []).map(function (a) {
      return { sigla: a.sigla, fav: a.favoravel, desf: a.desfavoravel };
    });
  }

  /* Categoria da TPU -> rótulo do marcador. 'parcial' (procedência em parte)
     conta como favorável nos agregados, então também aparece como favorável
     aqui — mas com rótulo próprio, para não achatar a nuance. */
  var ROTULO_RESULTADO = {
    favoravel: { classe: 'procedente', texto: 'Favorável' },
    parcial: { classe: 'procedente', texto: 'Parcialmente favorável' },
    desfavoravel: { classe: 'improcedente', texto: 'Contrária' }
  };

  function decisoes(lista) {
    return (lista || []).map(function (d) {
      var r = ROTULO_RESULTADO[d.resultado] || { classe: '', texto: d.resultado };
      return {
        tribunal: d.tribunal,
        orgao: d.orgao || '—',
        classe: d.classe || '',
        numero: (d.fonte && d.fonte.numero_formatado) || d.numero,
        data: d.decidido_em ? d.decidido_em.slice(0, 10).split('-').reverse().join('/') : '',
        resultadoClasse: r.classe,
        resultadoTexto: r.texto,
        fonte: d.fonte
      };
    });
  }

  function resumoDoTema(t) {
    var total = (t.favoravel || 0) + (t.desfavoravel || 0);
    var fav = total ? Math.round((t.favoravel / total) * 100) : 0;
    return {
      id: String(t.codigo),
      enunciado: t.nome,
      area: 'Assunto ' + t.codigo,
      forca: t.forca.nota,
      grau: t.forca.grau,
      componentes: t.forca.componentes,
      processos: t.processos,
      julgados: t.julgados,
      jurisprudencias: t.julgados,
      doutrinas: 0,
      tribunais: [],
      periodo: t.periodo.inicio && t.periodo.fim
        ? t.periodo.inicio + ' – ' + t.periodo.fim : '—',
      tendencia: { fav: fav, desf: 100 - fav },
      resumo: resumoTexto(t)
    };
  }

  /* Frase de resumo montada a partir dos números reais — nunca texto fixo,
     para não afirmar coisa que os dados não sustentam. */
  function resumoTexto(t) {
    var total = (t.favoravel || 0) + (t.desfavoravel || 0);
    if (!total) return 'Ainda sem julgamento com resultado registrado na base.';
    var fav = Math.round((t.favoravel / total) * 100);
    var onde = t.tribunais === 1 ? 'em 1 tribunal' : 'em ' + t.tribunais + ' tribunais';
    return fav + '% das ' + total + ' decisões apuradas ' + onde +
      ' acolheram o pedido, total ou parcialmente. Período de ' +
      (t.periodo.inicio || '—') + ' a ' + (t.periodo.fim || '—') + '.';
  }

  var Api = {
    buscar: function (q) {
      return pegar('/temas?limite=20&q=' + encodeURIComponent(q || ''))
        .then(function (d) { return d.temas.map(resumoDoTema); });
    },

    base: function () {
      return pegar('/saude');
    },

    /* Detalhe: junta o painel do tema com as decisões numa só estrutura,
       já no formato de seções que montarTese() percorre. */
    tema: function (codigo) {
      return Promise.all([
        pegar('/temas/' + encodeURIComponent(codigo)),
        pegar('/temas/' + encodeURIComponent(codigo) + '/decisoes?limite=12')
      ]).then(function (r) {
        var t = r[0], dec = r[1];
        var base = resumoDoTema(t);

        base.tribunais = (t.por_tribunal || []).map(function (x) { return x.sigla; });
        base.serie = serie(t.serie);
        base.porTribunal = porTribunal(t.por_tribunal);
        base.porOrgao = t.por_orgao || [];
        base.decisoes = decisoes(dec.decisoes);
        base.secoes = montarSecoes(t, base);
        return base;
      });
    }
  };

  function montarSecoes(t, base) {
    var secoes = [{
      id: 'entendimento',
      titulo: 'Entendimento apurado',
      paragrafos: [resumoTexto(t), metodologia(t)]
    }, {
      id: 'tribunais',
      titulo: 'Como os tribunais decidem',
      paragrafos: [
        base.porTribunal.length > 1
          ? 'Distribuição das decisões entre os tribunais cobertos pela base e evolução ano a ano.'
          : 'A base cobre um único tribunal para este tema, então a comparação entre cortes ainda não é possível.'
      ],
      grafico: true
    }];

    if ((t.por_orgao || []).length) {
      secoes.push({
        id: 'colegialidade',
        titulo: 'Divergência entre órgãos julgadores',
        paragrafos: [
          'Como cada vara, câmara ou turma vem decidindo. É o recorte que mostra ' +
          'se há conflito dentro do mesmo tribunal.'
        ],
        orgaos: true
      });
    }

    secoes.push({
      id: 'decisoes',
      titulo: 'Decisões que sustentam o número',
      paragrafos: [
        'Processos reais apurados pelo pipeline, com link para consulta na ' +
        'origem. O Ratio não reproduz o inteiro teor: o DataJud publica ' +
        'metadado processual, não o texto da decisão.'
      ],
      decisoes: true
    });

    return secoes;
  }

  function metodologia(t) {
    var c = t.forca.componentes;
    return 'Nota ' + t.forca.nota + '/100 (' + t.forca.grau.toLowerCase() + '), ' +
      'combinando concordância entre decisões (' + Math.round(c.concordancia.valor * 100) + '%), ' +
      'volume julgado (' + Math.round(c.volume.valor * 100) + '%), ' +
      'cobertura entre tribunais (' + Math.round(c.cobertura.valor * 100) + '%) e ' +
      'recência (' + Math.round(c.recencia.valor * 100) + '%).';
  }

  global.Api = Api;
})(window);
