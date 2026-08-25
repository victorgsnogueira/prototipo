/* ========================================================================
   Ratio - comportamento do prototipo
   Sem dependencias. Abre direto do disco (file://) ou de um servidor.
   ===================================================================== */
(function () {
  'use strict';

  /* --------------------------------------------------------------- utils */

  var $ = function (s, raiz) { return (raiz || document).querySelector(s); };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function num(n) { return n.toLocaleString('pt-BR'); }

  function pct(parte, total) { return total ? Math.round((parte / total) * 100) : 0; }

  function semAcento(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /* Classificacao da forca - vocabulario que ja existe no meio juridico. */
  function grau(f) {
    if (f >= 90) return 'Consolidada';
    if (f >= 75) return 'Dominante';
    if (f >= 55) return 'Em formação';
    return 'Divergente';
  }

  /* ---------------------------------------------------------- o carimbo */

  var seloSeq = 0;

  function selo(forca, mini) {
    var rotulo = 'Força do entendimento: ' + forca + ' de 100, ' + grau(forca).toLowerCase();

    if (mini) {
      return '<svg class="carimbo-selo" viewBox="0 0 200 200" role="img" aria-label="' + esc(rotulo) + '">' +
        '<g>' +
        '<circle class="anel" cx="100" cy="100" r="91" stroke-width="5"/>' +
        '<text class="n" x="100" y="118" text-anchor="middle" font-size="84">' + forca + '</text>' +
        '<text class="cem" x="100" y="148" text-anchor="middle" font-size="20" letter-spacing="1">/100</text>' +
        '</g></svg>';
    }

    var arco = 'arco-' + (++seloSeq);
    return '<svg class="carimbo-selo" viewBox="0 0 200 200" role="img" aria-label="' + esc(rotulo) + '">' +
      '<g>' +
      '<circle class="anel" cx="100" cy="100" r="94" stroke-width="3"/>' +
      '<circle class="anel" cx="100" cy="100" r="74" stroke-width="1"/>' +
      '<path id="' + arco + '" d="M 20,100 A 80,80 0 0 1 180,100" fill="none"/>' +
      '<text class="curva" font-size="14" letter-spacing="1.4">' +
      '<textPath href="#' + arco + '" startOffset="50%" text-anchor="middle">FORÇA DO ENTENDIMENTO</textPath></text>' +
      '<text class="n" x="100" y="104" text-anchor="middle" font-size="54">' + forca + '</text>' +
      '<text class="cem" x="100" y="124" text-anchor="middle" font-size="13" letter-spacing="0.6">/100</text>' +
      '<text class="grau" x="100" y="147" text-anchor="middle" font-size="12" letter-spacing="1.2">' +
      esc(grau(forca).toUpperCase()) + '</text>' +
      '<rect class="losango" x="86.5" y="176.5" width="5" height="5" transform="rotate(45 89 179)"/>' +
      '<rect class="losango" x="97.5" y="177.5" width="5" height="5" transform="rotate(45 100 180)"/>' +
      '<rect class="losango" x="108.5" y="176.5" width="5" height="5" transform="rotate(45 111 179)"/>' +
      '</g></svg>';
  }

  /* ------------------------------------------------------------ graficos */

  function tetoBonito(v) {
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var passos = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < passos.length; i++) if (p * passos[i] >= v) return p * passos[i];
    return p * 10;
  }

  /* barra com as duas pontas de cima arredondadas (a ponta-de-dado) */
  function pontaDado(x, y, w, h, r) {
    if (h <= 0) return '';
    var rr = Math.min(r, h, w / 2);
    return 'M' + x + ',' + (y + h) +
      ' L' + x + ',' + (y + rr) +
      ' Q' + x + ',' + y + ' ' + (x + rr) + ',' + y +
      ' L' + (x + w - rr) + ',' + y +
      ' Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + rr) +
      ' L' + (x + w) + ',' + (y + h) + ' Z';
  }

  function legenda() {
    return '<div class="legenda">' +
      '<span><i style="background:var(--serie-fav)"></i>Favorável à tese</span>' +
      '<span><i style="background:var(--serie-desf)"></i>Contrária</span>' +
      '</div>';
  }

  function graficoEvolucao(t) {
    var W = 680, H = 250, ML = 44, MR = 6, MT = 16, MB = 34;
    var x0 = ML, x1 = W - MR, y0 = MT, y1 = H - MB;
    var d = t.serie;
    var teto = tetoBonito(Math.max.apply(null, d.map(function (a) { return a.fav + a.desf; })));
    var escY = function (v) { return y1 - (v / teto) * (y1 - y0); };

    var vao = (x1 - x0) / d.length;
    var lg = Math.min(42, vao * 0.56);

    var s = '';

    /* malha + eixo */
    for (var i = 0; i <= 4; i++) {
      var v = teto * i / 4, y = escY(v);
      s += '<line class="' + (i === 0 ? 'base' : 'malha') + '" x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '"/>';
      s += '<text x="' + (ML - 10) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10">' + num(v) + '</text>';
    }

    d.forEach(function (a, k) {
      var cx = x0 + vao * k + (vao - lg) / 2;
      var total = a.fav + a.desf;
      var hFav = y1 - escY(a.fav);
      var hDesf = (y1 - escY(total)) - hFav - 2;
      if (hDesf < 0) hDesf = 0;

      var dicaBase = a.ano + '<br><span class="k">total</span> <b>' + num(total) + '</b> decisões';

      if (hFav > 0) {
        s += '<rect data-seg fill="var(--serie-fav)" x="' + cx + '" y="' + (y1 - hFav) + '" width="' + lg + '" height="' + hFav + '"' +
          ' data-dica="' + esc(dicaBase + '<br><span class=&quot;k&quot;>favorável</span> <b>' + num(a.fav) + '</b> · ' + pct(a.fav, total) + '%') + '"/>';
      }
      if (hDesf > 0) {
        s += '<path data-seg fill="var(--serie-desf)" d="' + pontaDado(cx, y1 - hFav - 2 - hDesf, lg, hDesf, 4) + '"' +
          ' data-dica="' + esc(dicaBase + '<br><span class=&quot;k&quot;>contrária</span> <b>' + num(a.desf) + '</b> · ' + pct(a.desf, total) + '%') + '"/>';
      }
      s += '<text x="' + (cx + lg / 2) + '" y="' + (y1 + 20) + '" text-anchor="middle" font-size="10.5">' + a.ano + '</text>';
    });

    var tabela = '<div class="tabela-env"><table class="tabela-dados"><thead><tr>' +
      '<th>Ano</th><th>Favorável</th><th>Contrária</th><th>Total</th><th>% fav.</th></tr></thead><tbody>' +
      d.map(function (a) {
        var tt = a.fav + a.desf;
        return '<tr><td>' + a.ano + '</td><td>' + num(a.fav) + '</td><td>' + num(a.desf) +
          '</td><td>' + num(tt) + '</td><td>' + pct(a.fav, tt) + '%</td></tr>';
      }).join('') + '</tbody></table></div>';

    return '<figure class="painel">' +
      '<div class="painel-cabeca"><h3>Decisões por ano</h3>' + legenda() + '</div>' +
      '<figcaption class="painel-nota">Volume anual de decisões que discutiram a tese, separadas pelo resultado. ' +
      'O período de ' + t.periodo.split(' - ')[1] + ' está incompleto.</figcaption>' +
      '<svg class="grafico" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Decisões por ano, favoráveis e contrárias à tese">' + s + '</svg>' +
      '<button class="btn-tabela" type="button" data-tabela>Ver tabela</button>' +
      '<div hidden data-alvo-tabela>' + tabela + '</div>' +
      '</figure>';
  }

  function graficoTribunais(t) {
    var d = t.porTribunal.slice().sort(function (a, b) {
      return pct(b.fav, b.fav + b.desf) - pct(a.fav, a.fav + a.desf);
    });

    var linhas = d.map(function (a) {
      var tt = a.fav + a.desf, p = pct(a.fav, tt);
      var dica = esc(a.sigla + '<br><span class=&quot;k&quot;>favorável</span> <b>' + p + '%</b> · ' + num(a.fav) + ' de ' + num(tt));
      return '<div class="trib-linha">' +
        '<span class="trib-sigla">' + esc(a.sigla) + '</span>' +
        '<div class="trib-barra">' +
        '<span class="fav" data-seg style="flex:0 0 calc(' + p + '% - 1px)" data-dica="' + dica + '"></span>' +
        '<span class="desf" data-seg style="flex:0 0 calc(' + (100 - p) + '% - 1px)" data-dica="' + dica + '"></span>' +
        '</div>' +
        '<span class="trib-n">' + num(tt) + '</span>' +
        '</div>';
    }).join('');

    var tabela = '<div class="tabela-env"><table class="tabela-dados"><thead><tr>' +
      '<th>Tribunal</th><th>Favorável</th><th>Contrária</th><th>Total</th><th>% fav.</th></tr></thead><tbody>' +
      d.map(function (a) {
        var tt = a.fav + a.desf;
        return '<tr><td>' + esc(a.sigla) + '</td><td>' + num(a.fav) + '</td><td>' + num(a.desf) +
          '</td><td>' + num(tt) + '</td><td>' + pct(a.fav, tt) + '%</td></tr>';
      }).join('') + '</tbody></table></div>';

    return '<figure class="painel">' +
      '<div class="painel-cabeca"><h3>Como cada tribunal decide</h3>' + legenda() + '</div>' +
      '<figcaption class="painel-nota">Proporção de decisões favoráveis à tese, do tribunal mais aderente ao menos. ' +
      'O número à direita é o volume total julgado.</figcaption>' +
      '<div class="trib-lista">' + linhas + '</div>' +
      '<button class="btn-tabela" type="button" data-tabela>Ver tabela</button>' +
      '<div hidden data-alvo-tabela>' + tabela + '</div>' +
      '</figure>';
  }

  /* -------------------------------------------------------------- telas */

  function trocarTela(id) {
    document.querySelectorAll('.tela').forEach(function (t) {
      if (t.id === id) t.setAttribute('data-ativa', ''); else t.removeAttribute('data-ativa');
    });
    window.scrollTo(0, 0);
  }

  /* ---- tela 1 ---- */

  function montarCapa() {
    $('#capa-numeros').innerHTML =
      '<dt class="rotulo">Teses mapeadas</dt><dd>' + num(BASE.teses) + '</dd>' +
      '<dt class="rotulo">Processos na base</dt><dd>' + num(BASE.processos) + '</dd>' +
      '<dt class="rotulo">Tribunais</dt><dd>' + BASE.tribunais + '</dd>';

    $('#sugestoes').innerHTML = SUGESTOES_BUSCA.map(function (s) {
      return '<li><button class="sugestao" type="button" data-q="' + esc(s) + '">' + esc(s) + '</button></li>';
    }).join('');
  }

  /* ---- tela 2 ---- */

  function buscar(q) {
    var termo = semAcento(q.trim());
    if (!termo) return TESES.slice();
    var palavras = termo.split(/\s+/);
    return TESES.filter(function (t) {
      var alvo = semAcento([t.enunciado, t.resumo, t.area, t.id, t.tribunais.join(' ')].join(' '));
      return palavras.some(function (p) { return p.length > 2 && alvo.indexOf(p) !== -1; });
    });
  }

  function cartao(t) {
    return '<li><article class="cartao" data-tese="' + t.id + '">' +
      '<div class="cartao-selo">' + selo(t.forca, true) + '</div>' +
      '<div class="cartao-texto">' +
      '<div class="cartao-topo">' +
      '<span class="cartao-area">' + esc(t.area) + '</span>' +
      '<span class="rotulo">' + t.id + ' · ' + esc(grau(t.forca)) + '</span>' +
      '</div>' +
      '<h2><a href="#/t/' + t.id + '">' + esc(t.enunciado) + '</a></h2>' +
      '<p>' + esc(t.resumo) + '</p>' +
      '<div class="cartao-pe">' +
      '<span class="siglas">' + t.tribunais.slice(0, 4).map(function (s) {
        return '<span class="sigla">' + esc(s) + '</span>';
      }).join('') + (t.tribunais.length > 4 ? '<span class="sigla">+' + (t.tribunais.length - 4) + '</span>' : '') + '</span>' +
      '<span>' + num(t.processos) + ' processos</span>' +
      '<span>' + esc(t.periodo) + '</span>' +
      '<span class="tendencia">' +
      '<span class="tendencia-barra" role="img" aria-label="' + t.tendencia.fav + '% favorável">' +
      '<span class="fav" style="flex:0 0 calc(' + t.tendencia.fav + '% - 1px)"></span>' +
      '<span class="desf" style="flex:0 0 calc(' + t.tendencia.desf + '% - 1px)"></span>' +
      '</span>' + t.tendencia.fav + '% favorável</span>' +
      '</div></div></article></li>';
  }

  function montarResultados(q) {
    var achados = buscar(q).sort(function (a, b) { return b.forca - a.forca; });
    $('#q2').value = q;
    $('#q3').value = q;

    if (!achados.length) {
      $('#res-resumo').innerHTML = 'Nenhuma tese para <b>' + esc(q) + '</b>';
      $('#lista-teses').innerHTML = '<li class="vazio"><span class="rotulo">Sem resultados</span>' +
        '<h2>Essa consulta não encontrou tese.</h2>' +
        '<p>O protótipo carrega ' + TESES.length + ' teses de demonstração. Tente “atraso de voo”, ' +
        '“horas extras” ou “ICMS”.</p></li>';
      return;
    }

    $('#res-resumo').innerHTML = '<b>' + achados.length + '</b> tese' + (achados.length > 1 ? 's' : '') +
      (q.trim() ? ' para <b>' + esc(q.trim()) + '</b>' : ' na base') +
      ' · ' + num(achados.reduce(function (s, t) { return s + t.processos; }, 0)) + ' processos';
    $('#lista-teses').innerHTML = achados.map(cartao).join('');
  }

  /* ---- tela 3 ---- */

  function citacoes(t) {
    return '<ul class="citacoes">' + t.citacoes.map(function (c) {
      return '<li><blockquote>' + esc(c.trecho) + '</blockquote>' +
        '<div class="cit-fonte">' +
        '<span class="marcador ' + c.resultado + '">' + (c.resultado === 'procedente' ? 'Favorável' : 'Contrária') + '</span>' +
        '<span>' + esc(c.tribunal) + ' · ' + esc(c.orgao) + '</span>' +
        '<span class="num">' + esc(c.numero) + '</span>' +
        '<span>' + esc(c.data) + '</span>' +
        '</div></li>';
    }).join('') + '</ul>';
  }

  function doutrinas(t) {
    return '<ul class="doutrinas">' + t.doutrina.map(function (d) {
      return '<li><cite><b>' + esc(d.autor) + '</b> · ' + esc(d.obra) + ' · ' + esc(d.ano) + '</cite>' +
        '<p>' + esc(d.trecho) + '</p></li>';
    }).join('') + '</ul>';
  }

  function montarTese(id) {
    var t = TESES.filter(function (x) { return x.id === id; })[0];
    if (!t) { location.hash = '#/'; return; }

    var prosa = t.secoes.map(function (s) {
      var h = '<h2 id="s-' + s.id + '">' + esc(s.titulo) + '</h2>';
      h += s.paragrafos.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
      if (s.lista) {
        h += '<ul class="citacoes">' + s.lista.map(function (l) {
          return '<li><blockquote>' + esc(l) + '</blockquote></li>';
        }).join('') + '</ul>';
      }
      if (s.grafico) h += graficoEvolucao(t) + graficoTribunais(t);
      if (s.citacoes) h += citacoes(t);
      if (s.doutrina) h += doutrinas(t);
      (s.subsecoes || []).forEach(function (sub) {
        h += '<h3 id="s-' + sub.id + '">' + esc(sub.titulo) + '</h3>';
        h += sub.paragrafos.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
      });
      return h;
    }).join('');

    var sumario = '<ol>' + t.secoes.map(function (s) {
      var li = '<li><a href="#s-' + s.id + '">' + esc(s.titulo) + '</a>';
      if (s.subsecoes && s.subsecoes.length) {
        li += '<ol>' + s.subsecoes.map(function (sub) {
          return '<li><a href="#s-' + sub.id + '">' + esc(sub.titulo) + '</a></li>';
        }).join('') + '</ol>';
      }
      return li + '</li>';
    }).join('') + '</ol>';

    $('#tese').innerHTML =
      '<header class="tese-cabeca">' +
        '<div>' +
          '<div class="tese-id"><span class="barra-mini"></span>' +
            '<span class="rotulo">' + t.id + ' · ' + esc(t.area) + ' · ' + esc(t.periodo) + '</span></div>' +
          '<h1>' + esc(t.enunciado) + '</h1>' +
        '</div>' +
        '<div class="tese-nota">' + selo(t.forca, false) +
          '<ul class="contagens">' +
            '<li><span class="n">' + num(t.processos) + '</span><span class="rot">Processos<br>relacionados</span></li>' +
            '<li><span class="n">' + t.jurisprudencias + '</span><span class="rot">Jurisprudências<br>citando a tese</span></li>' +
            '<li><span class="n">' + t.doutrinas + '</span><span class="rot">Obras de<br>doutrina</span></li>' +
          '</ul>' +
        '</div>' +
      '</header>' +
      '<div class="tese-corpo">' +
        '<article class="prosa">' + prosa + '</article>' +
        '<nav class="sumario" aria-label="Sumário da tese"><span class="rotulo">Sumário</span>' + sumario + '</nav>' +
      '</div>';

    montarChat(t);
    espiarRolagem();
  }

  /* ---------------------------------------------------------- rolagem */

  var espia = null;

  function espiarRolagem() {
    if (espia) espia.disconnect();
    var alvos = document.querySelectorAll('#tese .prosa h2, #tese .prosa h3');
    if (!alvos.length || !('IntersectionObserver' in window)) return;

    espia = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        document.querySelectorAll('#tese .sumario a[data-atual]').forEach(function (a) {
          a.removeAttribute('data-atual');
        });
        var link = $('#tese .sumario a[href="#' + e.target.id + '"]');
        if (link) link.setAttribute('data-atual', '');
      });
    }, { rootMargin: '-110px 0px -70% 0px' });

    alvos.forEach(function (a) { espia.observe(a); });
  }

  /* ------------------------------------------------------------- dica */

  var dica = null;

  function ligarDica() {
    dica = $('#dica');

    document.addEventListener('mouseover', function (e) {
      var alvo = e.target.closest ? e.target.closest('[data-dica]') : null;
      if (!alvo) return;
      dica.innerHTML = alvo.getAttribute('data-dica');
      dica.setAttribute('data-on', '');
      alvo.setAttribute('data-on', '');
      var caixa = alvo.closest('.grafico') || alvo.closest('.trib-lista');
      if (caixa) caixa.setAttribute('data-realce', '');
    });

    document.addEventListener('mousemove', function (e) {
      if (!dica.hasAttribute('data-on')) return;
      dica.style.left = e.clientX + 'px';
      dica.style.top = (e.clientY - 14) + 'px';
    });

    document.addEventListener('mouseout', function (e) {
      var alvo = e.target.closest ? e.target.closest('[data-dica]') : null;
      if (!alvo) return;
      dica.removeAttribute('data-on');
      alvo.removeAttribute('data-on');
      document.querySelectorAll('[data-realce]').forEach(function (c) { c.removeAttribute('data-realce'); });
    });
  }

  /* ------------------------------------------------------------- chat */

  var teseAtual = null;

  function bolha(m) {
    if (m.de === 'eu') return '<div class="msg msg-eu">' + esc(m.texto) + '</div>';
    return '<div class="msg msg-ia"><span class="quem">Ratio</span>' +
      (m.paragrafos || [m.texto]).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
      (m.fonte ? '<span class="fonte">' + esc(m.fonte) + '</span>' : '') +
      '</div>';
  }

  var CHAT_ABERTURA = [
    {
      de: 'ia',
      paragrafos: [
        'Abra uma tese e eu respondo com os números dela: como os tribunais vêm decidindo, onde a tese é mais forte e o que costuma derrubá-la.',
        'Toda resposta cita a origem no rodapé.',
      ],
    },
  ];

  function montarChat(t) {
    teseAtual = t;
    var msgs = t ? t.chat : CHAT_ABERTURA;
    $('#chat-contexto').textContent = t ? t.id + ' · ' + t.area : 'Nenhuma tese aberta';
    $('#chat-fluxo').innerHTML = msgs.map(bolha).join('');
    $('#chat-sugere').innerHTML = (t ? t.chatSugestoes : SUGESTOES_BUSCA.slice(0, 2)).map(function (s) {
      return '<button type="button" data-pergunta="' + esc(s) + '">' + esc(s) + '</button>';
    }).join('');
  }

  function responder(pergunta) {
    var fluxo = $('#chat-fluxo');
    fluxo.insertAdjacentHTML('beforeend', bolha({ de: 'eu', texto: pergunta }));
    fluxo.scrollTop = fluxo.scrollHeight;

    setTimeout(function () {
      fluxo.insertAdjacentHTML('beforeend', bolha({
        de: 'ia',
        paragrafos: teseAtual
          ? ['Este protótipo não tem modelo conectado — as respostas acima são roteirizadas para demonstrar o formato.',
             'Na versão real, esta pergunta viraria uma consulta OLAP sobre a tese ' + teseAtual.id + ' e a resposta traria os números apurados.']
          : ['Este protótipo não tem modelo conectado. Abra uma tese para ver o formato de resposta.'],
        fonte: 'Resposta de demonstração',
      }));
      fluxo.scrollTop = fluxo.scrollHeight;
    }, 420);
  }

  function abrirChat(abrir) {
    var c = $('#chat');
    if (abrir) c.setAttribute('data-aberto', ''); else c.removeAttribute('data-aberto');
    $('#chat-abre').setAttribute('aria-expanded', abrir ? 'true' : 'false');
    if (abrir) setTimeout(function () { $('#chat-input').focus(); }, 320);
  }

  /* ----------------------------------------------------------- rotas */

  function irPara(hash) {
    if (location.hash === hash) rotear(); else location.hash = hash;
  }

  function rotear() {
    var h = location.hash.replace(/^#/, '');

    if (h.indexOf('/t/') === 0) {
      montarTese(h.slice(3));
      trocarTela('tela-tese');
      return;
    }
    if (h.indexOf('/b/') === 0) {
      montarResultados(decodeURIComponent(h.slice(3)));
      montarChat(null);
      trocarTela('tela-resultados');
      return;
    }
    montarChat(null);
    trocarTela('tela-busca');
  }

  /* ------------------------------------------------------------ ligar */

  function ligar() {
    montarCapa();
    ligarDica();

    ['#form-busca', '#form-busca-2', '#form-busca-3'].forEach(function (sel) {
      $(sel).addEventListener('submit', function (e) {
        e.preventDefault();
        var campo = this.querySelector('input');
        irPara('#/b/' + encodeURIComponent(campo.value));
      });
    });

    document.addEventListener('click', function (e) {
      var alvo = e.target.closest ? e.target : null;
      if (!alvo) return;

      /* links resolvem sozinhos pela hash - nao duplicar a rota */
      if (alvo.closest('a[href]')) return;

      var sug = alvo.closest('[data-q]');
      if (sug) { $('#q').value = sug.getAttribute('data-q'); irPara('#/b/' + encodeURIComponent(sug.getAttribute('data-q'))); return; }

      var cart = alvo.closest('[data-tese]');
      if (cart) { irPara('#/t/' + cart.getAttribute('data-tese')); return; }

      if (alvo.closest('[data-ir-inicio]')) { irPara('#/'); return; }

      var bt = alvo.closest('[data-tabela]');
      if (bt) {
        var caixa = bt.parentNode.querySelector('[data-alvo-tabela]');
        var aberto = !caixa.hasAttribute('hidden');
        if (aberto) caixa.setAttribute('hidden', ''); else caixa.removeAttribute('hidden');
        bt.textContent = aberto ? 'Ver tabela' : 'Ocultar tabela';
        return;
      }

      var perg = alvo.closest('[data-pergunta]');
      if (perg) { responder(perg.getAttribute('data-pergunta')); return; }
    });

    /* ancoras do sumario sem sujar o historico de rotas */
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('.sumario a[href^="#s-"]') : null;
      if (!a) return;
      e.preventDefault();
      var alvo = document.getElementById(a.getAttribute('href').slice(1));
      if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('#chat-abre').addEventListener('click', function () {
      abrirChat(!$('#chat').hasAttribute('data-aberto'));
    });
    $('#chat-fecha').addEventListener('click', function () { abrirChat(false); });
    $('#chat-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = $('#chat-input').value.trim();
      if (!v) return;
      $('#chat-input').value = '';
      responder(v);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('#chat').hasAttribute('data-aberto')) abrirChat(false);
    });

    window.addEventListener('hashchange', rotear);
    rotear();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
  else ligar();
})();
