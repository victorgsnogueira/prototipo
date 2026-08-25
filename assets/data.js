/* ========================================================================
   Ratio — dados de demonstração
   ------------------------------------------------------------------------
   TUDO NESTE ARQUIVO É FICTÍCIO. Números de processo, trechos de decisão,
   citações de doutrina e estatísticas foram inventados para o protótipo.
   Nenhum deles corresponde a decisão real de tribunal brasileiro.

   Para trocar o conteúdo do protótipo, edite só este arquivo. O layout
   (index.html / assets/styles.css) não precisa ser tocado.

   Formato de uma tese:
     id            código interno exibido na interface
     enunciado     a tese em uma frase — vira o título da tela de detalhe
     area          ramo do direito (aparece como etiqueta)
     forca         0–100: quão consolidado está o entendimento
     processos     quantos processos sustentam a tese
     jurisprudencias / doutrinas   contagens exibidas no cabeçalho
     tribunais     siglas, em ordem de volume
     periodo       intervalo coberto pelos dados
     tendencia     { fav, desf } — soma 100
     resumo        duas linhas, aparece no cartão de resultado
     serie         [{ ano, fav, desf }] — gráfico de evolução
     porTribunal   [{ sigla, fav, desf }] — gráfico de distribuição
     secoes        [{ id, titulo, paragrafos[], subsecoes[], lista[],
                      grafico, citacoes, doutrina }]
     citacoes      [{ tribunal, orgao, numero, data, resultado, trecho }]
     doutrina      [{ autor, obra, ano, trecho }]
     chat          [{ de: 'eu'|'ia', texto | paragrafos, fonte? }]
     chatSugestoes [string]
   ===================================================================== */

const BASE = {
  teses: 4128,
  processos: 812440,
  tribunais: 91,
  atualizado: '25 AGO 2026',
};

const SUGESTOES_BUSCA = [
  'atraso de voo superior a quatro horas',
  'horas extras em regime de teletrabalho',
  'ICMS na base de cálculo do PIS e da COFINS',
  'extravio definitivo de bagagem',
  'devolução em dobro de cobrança indevida',
];

const TESES = [
  /* ------------------------------------------------------------------ */
  {
    id: 'T-0431',
    enunciado: 'Atraso de voo superior a quatro horas gera dano moral presumido',
    area: 'Consumidor',
    forca: 94,
    processos: 1284,
    jurisprudencias: 47,
    doutrinas: 12,
    tribunais: ['STJ', 'TJ-SP', 'TJ-RJ', 'TJ-MG', 'TJ-RS', 'TJ-PR'],
    periodo: '2019 – 2026',
    tendencia: { fav: 78, desf: 22 },
    resumo: 'Passado o limite de quatro horas, os tribunais dispensam a prova do abalo psíquico e presumem o dano. Abaixo desse marco, a maioria ainda exige demonstração concreta do prejuízo.',
    serie: [
      { ano: 2019, fav: 51, desf: 27 },
      { ano: 2020, fav: 38, desf: 19 },
      { ano: 2021, fav: 74, desf: 31 },
      { ano: 2022, fav: 119, desf: 38 },
      { ano: 2023, fav: 163, desf: 44 },
      { ano: 2024, fav: 201, desf: 49 },
      { ano: 2025, fav: 244, desf: 52 },
      { ano: 2026, fav: 118, desf: 24 },
    ],
    porTribunal: [
      { sigla: 'TJ-SP', fav: 348, desf: 64 },
      { sigla: 'TJ-RJ', fav: 211, desf: 52 },
      { sigla: 'STJ',   fav: 106, desf: 21 },
      { sigla: 'TJ-MG', fav: 142, desf: 55 },
      { sigla: 'TJ-PR', fav: 88,  desf: 41 },
      { sigla: 'TJ-RS', fav: 113, desf: 84 },
    ],
    secoes: [
      {
        id: 'entendimento',
        titulo: 'Entendimento consolidado',
        paragrafos: [
          'Quando o atraso de um voo passa de quatro horas, a maior parte dos tribunais brasileiros deixa de exigir que o passageiro prove ter sofrido abalo psíquico. O dano moral passa a ser presumido: basta comprovar o atraso e a condição de passageiro. A discussão no processo migra do “houve dano?” para o “quanto vale o dano?”.',
          'Esse limite de quatro horas não está escrito em lei. Ele se formou por repetição nos julgados a partir de 2021 e hoje aparece como marco em 78% das decisões desta base. Abaixo dele, o quadro se inverte: a maioria das turmas trata o atraso como mero aborrecimento e exige prova concreta do prejuízo — compromisso perdido, tratamento médico interrompido, evento intransferível.',
        ],
        subsecoes: [
          {
            id: 'origem',
            titulo: 'De onde veio o marco de quatro horas',
            paragrafos: [
              'O número vem por empréstimo da regulação aérea, que fixa em quatro horas o prazo a partir do qual a companhia deve oferecer reacomodação ou reembolso integral. Os tribunais passaram a ler esse prazo como a fronteira entre o transtorno tolerável e a falha de serviço, e a jurisprudência acompanhou.',
            ],
          },
          {
            id: 'excludentes',
            titulo: 'O que ainda afasta a responsabilidade',
            paragrafos: [
              'Duas defesas continuam funcionando: condição meteorológica documentada por boletim oficial e fechamento de aeroporto por ordem da autoridade aeronáutica. Reestruturação de malha aérea, ao contrário, foi rejeitada como excludente em 91% dos casos em que a companhia a invocou — os tribunais a tratam como risco próprio da atividade.',
            ],
          },
        ],
      },
      {
        id: 'tribunais',
        titulo: 'Como os tribunais decidem',
        paragrafos: [
          'A tese é majoritária em todos os tribunais com volume relevante, mas a margem varia bastante. TJ-SP e TJ-RJ aplicam a presunção de forma quase automática. O TJ-RS é o mais resistente da amostra: em 43% dos casos a corte ainda exige prova do abalo, mesmo acima de quatro horas.',
          'O valor da indenização segue caminho próprio e não acompanha a força da tese. A mediana dos últimos doze meses ficou em R$ 8.000, com dispersão larga entre R$ 3.000 e R$ 15.000 conforme a duração do atraso e a existência de pernoite.',
        ],
        grafico: true,
      },
      {
        id: 'divergencias',
        titulo: 'Divergências abertas',
        paragrafos: [
          'Três pontos seguem sem resposta uniforme. São eles que decidem se a tese pode ser atacada ou defendida em um caso concreto.',
        ],
        lista: [
          'Se a Convenção de Montreal, que limita valores em voo internacional, afasta a presunção no trecho internacional.',
          'Se o atraso somado de conexões conta como um único evento ou como eventos separados no cálculo das quatro horas.',
          'Se a assistência material prestada pela companhia — hotel, alimentação, transporte — reduz o valor da indenização ou apenas afasta o pedido de danos materiais.',
        ],
      },
      {
        id: 'decisoes',
        titulo: 'Decisões representativas',
        paragrafos: [
          'Cinco julgados que carregam a fundamentação central da tese, incluindo os dois que divergem dela.',
        ],
        citacoes: true,
      },
      {
        id: 'doutrina',
        titulo: 'Fundamentos doutrinários',
        paragrafos: [
          'A doutrina de consumo sustenta a presunção pelo argumento da hipossuficiência probatória: exigir do passageiro a prova de um estado psíquico é exigir uma prova que ele não tem como produzir.',
        ],
        doutrina: true,
      },
    ],
    citacoes: [
      {
        tribunal: 'STJ', orgao: '3ª Turma', numero: '1987654-22.2024.3.00.0000', data: '14 MAR 2024', resultado: 'procedente',
        trecho: 'O atraso que ultrapassa quatro horas desborda do mero dissabor e atinge a esfera da personalidade, sendo desnecessária a demonstração de abalo psíquico concreto.',
      },
      {
        tribunal: 'TJ-SP', orgao: '24ª Câmara de Direito Privado', numero: '1023845-17.2023.8.26.0100', data: '02 SET 2023', resultado: 'procedente',
        trecho: 'A reestruturação da malha aérea constitui risco inerente à atividade empresarial e não se equipara a caso fortuito externo apto a romper o nexo causal.',
      },
      {
        tribunal: 'TJ-RJ', orgao: '13ª Câmara Cível', numero: '0044219-88.2025.8.19.0001', data: '19 JUN 2025', resultado: 'procedente',
        trecho: 'A assistência material prestada pela transportadora atenua o quantum, mas não elide o dever de indenizar o dano moral presumido.',
      },
      {
        tribunal: 'TJ-RS', orgao: '11ª Câmara Cível', numero: '5009873-45.2024.8.21.0001', data: '08 NOV 2024', resultado: 'improcedente',
        trecho: 'A presunção de dano moral não pode ser automática: cabe ao autor indicar, ainda que minimamente, a repercussão concreta do atraso em sua esfera pessoal.',
      },
      {
        tribunal: 'TJ-PR', orgao: '9ª Câmara Cível', numero: '0002211-63.2025.8.16.0014', data: '27 FEV 2025', resultado: 'improcedente',
        trecho: 'Em transporte internacional, os limites indenizatórios da Convenção de Montreal prevalecem sobre a sistemática do Código de Defesa do Consumidor.',
      },
    ],
    doutrina: [
      {
        autor: 'Marcela Andrade Vieira', obra: 'Responsabilidade civil no transporte aéreo', ano: '2023',
        trecho: 'Exigir do passageiro a prova do abalo psíquico é transferir a ele um ônus que a relação de consumo justamente pretendeu deslocar. A presunção não cria responsabilidade nova: apenas reconhece que o dano, nesse contexto, é ordinário e verificável pela própria duração do atraso.',
      },
      {
        autor: 'Rogério Peixoto Lima', obra: 'Dano moral e o limiar do mero aborrecimento', ano: '2021',
        trecho: 'O risco da presunção é a banalização. Um critério temporal objetivo, ainda que arbitrário na origem, oferece previsibilidade tanto ao passageiro quanto à transportadora, e por isso vem se firmando apesar da crítica.',
      },
    ],
    chat: [
      { de: 'eu', texto: 'Meu voo atrasou 5h30 e perdi uma reunião. Vale a pena entrar com ação?' },
      {
        de: 'ia',
        paragrafos: [
          'Seu caso cai acima do marco de quatro horas, que é onde essa tese é mais forte: nesta base, 78% das decisões nessa faixa reconheceram dano moral sem exigir prova do abalo.',
          'A reunião perdida ajuda, mas por outro caminho — ela sustenta um pedido de dano material separado, se você conseguir demonstrar o prejuízo financeiro.',
          'A mediana das indenizações por dano moral nos últimos doze meses foi de R$ 8.000.',
        ],
        fonte: 'Base: 1.284 processos · T-0431',
      },
      { de: 'eu', texto: 'E se a companhia alegar reestruturação da malha aérea?' },
      {
        de: 'ia',
        paragrafos: [
          'Essa defesa tem funcionado mal. Em 91% dos casos em que foi invocada, os tribunais a rejeitaram por entender que reestruturar a malha é risco próprio da atividade, e não caso fortuito externo.',
          'As duas excludentes que ainda funcionam são meteorologia comprovada por boletim oficial e fechamento de aeroporto por ordem da autoridade aeronáutica.',
        ],
        fonte: 'TJ-SP, 24ª Câmara · 1023845-17.2023.8.26.0100',
      },
    ],
    chatSugestoes: ['Qual o valor típico?', 'Como o TJ-RS decide?', 'Serve para voo internacional?'],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'T-0117',
    enunciado: 'Teletrabalho com controle telemático de jornada gera direito a horas extras',
    area: 'Trabalhista',
    forca: 81,
    processos: 936,
    jurisprudencias: 33,
    doutrinas: 9,
    tribunais: ['TST', 'TRT-2', 'TRT-15', 'TRT-1', 'TRT-4'],
    periodo: '2021 – 2026',
    tendencia: { fav: 69, desf: 31 },
    resumo: 'A exclusão do teletrabalho do controle de jornada deixa de valer quando o empregador monitora o trabalho por meios telemáticos. Metas, logs de sistema e exigência de resposta imediata vêm sendo lidos como controle.',
    serie: [
      { ano: 2021, fav: 22, desf: 18 },
      { ano: 2022, fav: 61, desf: 34 },
      { ano: 2023, fav: 104, desf: 51 },
      { ano: 2024, fav: 148, desf: 62 },
      { ano: 2025, fav: 181, desf: 78 },
      { ano: 2026, fav: 92, desf: 41 },
    ],
    porTribunal: [
      { sigla: 'TRT-2',  fav: 214, desf: 71 },
      { sigla: 'TRT-15', fav: 158, desf: 66 },
      { sigla: 'TST',    fav: 74,  desf: 39 },
      { sigla: 'TRT-1',  fav: 92,  desf: 58 },
      { sigla: 'TRT-4',  fav: 71,  desf: 50 },
    ],
    secoes: [
      {
        id: 'entendimento',
        titulo: 'Entendimento consolidado',
        paragrafos: [
          'A regra geral exclui o teletrabalho do controle de jornada, e portanto do pagamento de horas extras. Os tribunais vêm construindo uma exceção ampla: se o empregador controla o trabalho por meios telemáticos, a exclusão cai e a jornada volta a ser controlada.',
          'O que conta como controle é o ponto disputado. Logs de sistema, obrigação de resposta em prazo curto, reuniões fixas diárias e metas com apuração horária já foram aceitos. A simples disponibilidade de um canal de mensagens, isoladamente, não foi.',
        ],
        subsecoes: [
          {
            id: 'prova',
            titulo: 'Como o controle é provado',
            paragrafos: [
              'A prova que mais convence é o registro do próprio sistema do empregador: horários de login, histórico de mensagens com carimbo de tempo, relatórios de produtividade. Prova exclusivamente testemunhal sustentou o pedido em menos de um terço dos casos.',
            ],
          },
        ],
      },
      {
        id: 'tribunais',
        titulo: 'Como os tribunais decidem',
        paragrafos: [
          'O TRT-2 é o mais receptivo à tese, com 75% de acolhimento. O TST é mais restritivo e tem exigido demonstração de controle efetivo, não apenas potencial — a diferença entre poder monitorar e de fato monitorar.',
        ],
        grafico: true,
      },
      {
        id: 'decisoes',
        titulo: 'Decisões representativas',
        paragrafos: ['Julgados que delimitam a fronteira entre autonomia e controle.'],
        citacoes: true,
      },
      {
        id: 'doutrina',
        titulo: 'Fundamentos doutrinários',
        paragrafos: ['A doutrina trabalhista discute se o critério deve ser a possibilidade técnica de controle ou o seu exercício concreto.'],
        doutrina: true,
      },
    ],
    citacoes: [
      {
        tribunal: 'TST', orgao: '6ª Turma', numero: '1000432-19.2023.5.00.0000', data: '11 ABR 2024', resultado: 'procedente',
        trecho: 'A exigência de resposta imediata em canal corporativo, aliada a relatórios diários de produtividade, configura controle de jornada por meios telemáticos.',
      },
      {
        tribunal: 'TRT-2', orgao: '4ª Turma', numero: '1001887-52.2024.5.02.0071', data: '30 JAN 2025', resultado: 'procedente',
        trecho: 'Os registros de login e logout mantidos pela própria empregadora constituem prova suficiente da jornada efetivamente cumprida.',
      },
      {
        tribunal: 'TRT-4', orgao: '9ª Turma', numero: '0020551-77.2024.5.04.0022', data: '18 SET 2024', resultado: 'improcedente',
        trecho: 'A mera disponibilização de ferramentas de comunicação instantânea não implica controle de jornada, sob pena de tornar a exceção legal letra morta.',
      },
    ],
    doutrina: [
      {
        autor: 'Helena Barreto Nunes', obra: 'Jornada e tecnologia no contrato de trabalho', ano: '2024',
        trecho: 'A pergunta útil não é se o empregador podia monitorar, mas se a organização do trabalho tornava impossível ao empregado dispor livremente do próprio tempo. Controle, aqui, é sinônimo de indisponibilidade.',
      },
    ],
    chat: [
      { de: 'eu', texto: 'Trabalho de casa e tenho reunião fixa todo dia às 9h. Isso conta como controle?' },
      {
        de: 'ia',
        paragrafos: [
          'Reunião diária em horário fixo aparece nesta base como um dos indícios aceitos, mas raramente sozinha. Nos casos acolhidos, ela vinha acompanhada de pelo menos mais um elemento — log de sistema, meta com apuração horária ou exigência de resposta em prazo curto.',
          'Se o seu empregador mantém registro de login, esse é o documento que mais pesa: sustentou o pedido em 71% dos casos procedentes.',
        ],
        fonte: 'Base: 936 processos · T-0117',
      },
    ],
    chatSugestoes: ['Que provas eu preciso?', 'Como o TST decide?', 'Vale para PJ?'],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'T-0009',
    enunciado: 'O ICMS não compõe a base de cálculo do PIS e da COFINS',
    area: 'Tributário',
    forca: 98,
    processos: 3417,
    jurisprudencias: 88,
    doutrinas: 24,
    tribunais: ['STF', 'STJ', 'TRF-3', 'TRF-4', 'TRF-1'],
    periodo: '2021 – 2026',
    tendencia: { fav: 96, desf: 4 },
    resumo: 'Tese pacificada em repercussão geral. A discussão remanescente não é mais sobre o mérito, e sim sobre o alcance temporal da restituição e sobre qual ICMS deve ser excluído.',
    serie: [
      { ano: 2021, fav: 402, desf: 31 },
      { ano: 2022, fav: 588, desf: 24 },
      { ano: 2023, fav: 641, desf: 19 },
      { ano: 2024, fav: 703, desf: 22 },
      { ano: 2025, fav: 612, desf: 14 },
      { ano: 2026, fav: 328, desf: 9 },
    ],
    porTribunal: [
      { sigla: 'TRF-3', fav: 981, desf: 28 },
      { sigla: 'TRF-4', fav: 874, desf: 31 },
      { sigla: 'TRF-1', fav: 702, desf: 26 },
      { sigla: 'STJ',   fav: 411, desf: 18 },
      { sigla: 'STF',   fav: 306, desf: 12 },
    ],
    secoes: [
      {
        id: 'entendimento',
        titulo: 'Entendimento consolidado',
        paragrafos: [
          'O ICMS transita pelo caixa da empresa mas pertence ao Estado. Por isso não é receita, e não pode compor a base de cálculo de contribuições que incidem sobre receita. A tese está fixada em repercussão geral e é aplicada de forma praticamente uniforme.',
          'Com força 98, é a tese mais consolidada desta base. O litígio migrou para as bordas: a partir de quando cabe restituir, e se o valor a excluir é o ICMS destacado na nota ou o efetivamente recolhido.',
        ],
      },
      {
        id: 'tribunais',
        titulo: 'Como os tribunais decidem',
        paragrafos: [
          'Não há divergência relevante sobre o mérito em nenhum dos tribunais com volume. Os 4% de decisões desfavoráveis concentram-se em questões processuais — falta de comprovação do recolhimento, ilegitimidade ativa — e não em rejeição da tese.',
        ],
        grafico: true,
      },
      {
        id: 'decisoes',
        titulo: 'Decisões representativas',
        paragrafos: ['Os julgados que fixam a tese e os que tratam do alcance temporal.'],
        citacoes: true,
      },
      {
        id: 'doutrina',
        titulo: 'Fundamentos doutrinários',
        paragrafos: ['O conceito constitucional de receita é o eixo de toda a construção.'],
        doutrina: true,
      },
    ],
    citacoes: [
      {
        tribunal: 'STF', orgao: 'Tribunal Pleno', numero: '0000069-11.2021.1.00.0000', data: '13 MAI 2021', resultado: 'procedente',
        trecho: 'O valor do ICMS destacado na nota fiscal não se incorpora ao patrimônio do contribuinte e, por não constituir receita, não integra a base de cálculo das contribuições.',
      },
      {
        tribunal: 'TRF-3', orgao: '3ª Turma', numero: '5008812-40.2024.4.03.6100', data: '22 AGO 2024', resultado: 'procedente',
        trecho: 'A exclusão alcança o ICMS destacado, e não o efetivamente recolhido, conforme modulação fixada pela Corte Suprema.',
      },
      {
        tribunal: 'TRF-4', orgao: '2ª Turma', numero: '5003119-72.2025.4.04.7100', data: '06 MAR 2025', resultado: 'improcedente',
        trecho: 'Ausente comprovação do efetivo recolhimento no período pleiteado, inviabiliza-se a repetição do indébito, ainda que reconhecida a tese de fundo.',
      },
    ],
    doutrina: [
      {
        autor: 'Ana Clara Bittencourt', obra: 'O conceito constitucional de receita', ano: '2022',
        trecho: 'Receita pressupõe acréscimo patrimonial definitivo. O tributo que a empresa apenas arrecada para repassar ao ente competente nunca ingressa em seu patrimônio, e chamá-lo de receita é confundir fluxo de caixa com riqueza própria.',
      },
    ],
    chat: [
      { de: 'eu', texto: 'Minha empresa pode pedir de volta o que pagou a mais?' },
      {
        de: 'ia',
        paragrafos: [
          'Sim, mas o alcance temporal é onde está a briga. A modulação fixou um marco a partir do qual a restituição é devida, com ressalva para quem já tinha ação ajuizada antes disso.',
          'O ponto prático que mais derruba pedido nesta base não é o mérito: é falta de comprovação do recolhimento no período. Foi a razão de improcedência em 61% dos 4% de casos desfavoráveis.',
        ],
        fonte: 'Base: 3.417 processos · T-0009',
      },
    ],
    chatSugestoes: ['Qual o marco temporal?', 'Destacado ou recolhido?', 'Que documentos preciso?'],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'T-0288',
    enunciado: 'Extravio definitivo de bagagem gera dano moral independentemente de prova',
    area: 'Consumidor',
    forca: 72,
    processos: 604,
    jurisprudencias: 21,
    doutrinas: 6,
    tribunais: ['STJ', 'TJ-SP', 'TJ-DF', 'TJ-BA'],
    periodo: '2020 – 2026',
    tendencia: { fav: 64, desf: 36 },
    resumo: 'A perda definitiva da bagagem é tratada como dano presumido pela maioria. A divergência está no voo internacional, onde os limites da Convenção de Montreal ainda dividem os tribunais.',
    serie: [
      { ano: 2020, fav: 24, desf: 16 },
      { ano: 2021, fav: 41, desf: 27 },
      { ano: 2022, fav: 58, desf: 33 },
      { ano: 2023, fav: 77, desf: 42 },
      { ano: 2024, fav: 91, desf: 48 },
      { ano: 2025, fav: 84, desf: 39 },
      { ano: 2026, fav: 12, desf: 12 },
    ],
    porTribunal: [
      { sigla: 'TJ-SP', fav: 152, desf: 61 },
      { sigla: 'TJ-DF', fav: 98,  desf: 44 },
      { sigla: 'STJ',   fav: 71,  desf: 33 },
      { sigla: 'TJ-BA', fav: 66,  desf: 79 },
    ],
    secoes: [
      {
        id: 'entendimento',
        titulo: 'Entendimento consolidado',
        paragrafos: [
          'Extravio temporário e extravio definitivo recebem tratamentos diferentes. Quando a bagagem nunca aparece, a maioria dos tribunais presume o dano moral. Quando ela retorna com atraso, a análise volta a ser caso a caso, ponderando a duração e o conteúdo perdido.',
          'A força de 72 reflete essa fronteira instável: a tese é majoritária, mas não pacificada. O TJ-BA é o único da amostra em que ela é minoritária.',
        ],
      },
      {
        id: 'tribunais',
        titulo: 'Como os tribunais decidem',
        paragrafos: [
          'A divisão acompanha a natureza do voo. Em trecho doméstico a tese é aplicada com folga. Em trecho internacional, os limites indenizatórios da Convenção de Montreal reduzem os valores e, em parte dos casos, afastam a presunção.',
        ],
        grafico: true,
      },
      {
        id: 'decisoes',
        titulo: 'Decisões representativas',
        paragrafos: ['Julgados dos dois lados da divergência.'],
        citacoes: true,
      },
      {
        id: 'doutrina',
        titulo: 'Fundamentos doutrinários',
        paragrafos: ['O debate doutrinário gira em torno do conflito entre tratado internacional e norma de consumo.'],
        doutrina: true,
      },
    ],
    citacoes: [
      {
        tribunal: 'STJ', orgao: '4ª Turma', numero: '1876543-90.2023.3.00.0000', data: '09 OUT 2023', resultado: 'procedente',
        trecho: 'A perda definitiva dos bens pessoais do passageiro dispensa prova de sofrimento, por decorrer da própria natureza do evento.',
      },
      {
        tribunal: 'TJ-BA', orgao: '5ª Câmara Cível', numero: '0511234-28.2025.8.05.0001', data: '21 MAI 2025', resultado: 'improcedente',
        trecho: 'Reparado integralmente o valor declarado da bagagem, o dano moral demanda demonstração de repercussão que exceda o prejuízo patrimonial já indenizado.',
      },
    ],
    doutrina: [
      {
        autor: 'Paulo Serra Machado', obra: 'Consumo e tratados internacionais', ano: '2020',
        trecho: 'A Convenção de Montreal fixa teto para dano material. Estendê-la ao dano moral é ampliar por analogia uma norma restritiva de direito, movimento que a hermenêutica consumerista não autoriza.',
      },
    ],
    chat: [
      { de: 'eu', texto: 'Perdi minha mala num voo internacional. Muda alguma coisa?' },
      {
        de: 'ia',
        paragrafos: [
          'Muda o valor, e às vezes a própria presunção. Em trecho internacional os tribunais desta base aplicaram os limites da Convenção de Montreal em 58% dos casos, o que costuma reduzir bastante a indenização.',
          'A tese de fundo continua majoritária mesmo assim — o extravio definitivo foi reconhecido como dano presumido em 64% do total.',
        ],
        fonte: 'Base: 604 processos · T-0288',
      },
    ],
    chatSugestoes: ['Temporário conta igual?', 'Preciso declarar valor?', 'Qual o teto de Montreal?'],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'T-0642',
    enunciado: 'A devolução em dobro de cobrança indevida independe de má-fé do fornecedor',
    area: 'Consumidor',
    forca: 88,
    processos: 2109,
    jurisprudencias: 56,
    doutrinas: 15,
    tribunais: ['STJ', 'TJ-SP', 'TJ-MG', 'TJ-RJ', 'TJ-SC'],
    periodo: '2021 – 2026',
    tendencia: { fav: 84, desf: 16 },
    resumo: 'Basta a cobrança indevida e o pagamento pelo consumidor. A análise migrou da intenção do fornecedor para a existência de engano justificável, apurado objetivamente.',
    serie: [
      { ano: 2021, fav: 118, desf: 44 },
      { ano: 2022, fav: 241, desf: 51 },
      { ano: 2023, fav: 358, desf: 62 },
      { ano: 2024, fav: 421, desf: 71 },
      { ano: 2025, fav: 456, desf: 66 },
      { ano: 2026, fav: 178, desf: 43 },
    ],
    porTribunal: [
      { sigla: 'TJ-SP', fav: 612, desf: 88 },
      { sigla: 'TJ-MG', fav: 388, desf: 61 },
      { sigla: 'TJ-RJ', fav: 341, desf: 74 },
      { sigla: 'STJ',   fav: 229, desf: 38 },
      { sigla: 'TJ-SC', fav: 202, desf: 76 },
    ],
    secoes: [
      {
        id: 'entendimento',
        titulo: 'Entendimento consolidado',
        paragrafos: [
          'A má-fé deixou de ser requisito. O que afasta a devolução em dobro hoje é o engano justificável, e a jurisprudência o apura por critério objetivo: houve erro escusável na cobrança, ou houve falha organizacional do fornecedor?',
          'Falha de sistema, cobrança recorrente após cancelamento e tarifa aplicada fora do contrato foram enquadradas como falha organizacional, e portanto não justificam o engano.',
        ],
      },
      {
        id: 'tribunais',
        titulo: 'Como os tribunais decidem',
        paragrafos: [
          'A tese é majoritária em todos os tribunais da amostra. O TJ-SC é o mais reticente, com 27% de rejeição, geralmente por reconhecer engano justificável em cobrança de serviço continuado.',
        ],
        grafico: true,
      },
      {
        id: 'decisoes',
        titulo: 'Decisões representativas',
        paragrafos: ['Julgados que definem o que é engano justificável.'],
        citacoes: true,
      },
      {
        id: 'doutrina',
        titulo: 'Fundamentos doutrinários',
        paragrafos: ['A doutrina discute a função da dobra: reparação ou sanção.'],
        doutrina: true,
      },
    ],
    citacoes: [
      {
        tribunal: 'STJ', orgao: 'Corte Especial', numero: '0006766-08.2021.3.00.0000', data: '21 OUT 2021', resultado: 'procedente',
        trecho: 'A restituição em dobro independe da natureza do elemento volitivo do fornecedor, bastando a cobrança indevida e a ausência de engano justificável.',
      },
      {
        tribunal: 'TJ-SC', orgao: '3ª Câmara de Direito Civil', numero: '5004417-19.2025.8.24.0023', data: '14 ABR 2025', resultado: 'improcedente',
        trecho: 'Cobrança decorrente de reajuste contratual comunicado previamente ao consumidor caracteriza engano justificável, autorizando apenas a devolução simples.',
      },
    ],
    doutrina: [
      {
        autor: 'Ricardo Vilanova Teixeira', obra: 'A sanção no direito do consumidor', ano: '2022',
        trecho: 'A dobra não repara: ela desestimula. Condicioná-la à prova da má-fé seria esvaziar seu propósito, já que a intenção do fornecedor é, por definição, inacessível ao consumidor.',
      },
    ],
    chat: [
      { de: 'eu', texto: 'A operadora me cobrou por um serviço que eu cancelei. Tenho direito ao dobro?' },
      {
        de: 'ia',
        paragrafos: [
          'Cobrança recorrente após cancelamento é um dos casos em que os tribunais desta base rejeitaram o engano justificável com mais frequência — foi enquadrada como falha organizacional em 84% das decisões.',
          'O que você precisa demonstrar é o pedido de cancelamento e o pagamento posterior. A intenção da operadora não entra na análise.',
        ],
        fonte: 'Base: 2.109 processos · T-0642',
      },
    ],
    chatSugestoes: ['O que é engano justificável?', 'Preciso ter pago?', 'Vale para banco?'],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'T-0955',
    enunciado: 'Reestruturação de malha aérea não é excludente de responsabilidade',
    area: 'Consumidor',
    forca: 57,
    processos: 312,
    jurisprudencias: 11,
    doutrinas: 3,
    tribunais: ['TJ-SP', 'TJ-RJ', 'TJ-GO'],
    periodo: '2022 – 2026',
    tendencia: { fav: 91, desf: 9 },
    resumo: 'A tese quase nunca perde quando é invocada, mas o volume de decisões ainda é pequeno e concentrado em três tribunais. Força baixa por cobertura, não por divergência.',
    serie: [
      { ano: 2022, fav: 18, desf: 4 },
      { ano: 2023, fav: 41, desf: 5 },
      { ano: 2024, fav: 68, desf: 6 },
      { ano: 2025, fav: 94, desf: 8 },
      { ano: 2026, fav: 63, desf: 5 },
    ],
    porTribunal: [
      { sigla: 'TJ-SP', fav: 148, desf: 11 },
      { sigla: 'TJ-RJ', fav: 92,  desf: 9 },
      { sigla: 'TJ-GO', fav: 44,  desf: 8 },
    ],
    secoes: [
      {
        id: 'entendimento',
        titulo: 'Entendimento consolidado',
        paragrafos: [
          'Quando invocada, a tese é acolhida em 91% dos casos: reestruturar a malha é decisão de negócio da companhia, e o risco dessa decisão não se transfere ao passageiro.',
          'A força de 57 não vem de divergência — vem de cobertura. São 312 processos em três tribunais, contra os 1.284 em seis tribunais da tese principal de atraso. O entendimento é firme onde existe, mas ainda não foi testado no resto do país.',
        ],
      },
      {
        id: 'tribunais',
        titulo: 'Como os tribunais decidem',
        paragrafos: [
          'Sem divergência relevante entre os três tribunais. A ausência de julgados em cortes superiores é o que mantém a tese em território incerto para uso fora de SP, RJ e GO.',
        ],
        grafico: true,
      },
      {
        id: 'decisoes',
        titulo: 'Decisões representativas',
        paragrafos: ['O julgado que fixa o argumento central.'],
        citacoes: true,
      },
      {
        id: 'doutrina',
        titulo: 'Fundamentos doutrinários',
        paragrafos: ['Cobertura doutrinária ainda escassa — três obras tratam do tema de forma direta.'],
        doutrina: true,
      },
    ],
    citacoes: [
      {
        tribunal: 'TJ-SP', orgao: '11ª Câmara de Direito Privado', numero: '1044901-73.2024.8.26.0100', data: '05 JUL 2024', resultado: 'procedente',
        trecho: 'A reorganização de rotas é ato de gestão empresarial. O fortuito interno daí decorrente não rompe o nexo de causalidade nem transfere ao consumidor o ônus da escolha da transportadora.',
      },
    ],
    doutrina: [
      {
        autor: 'Camila Ferraz Doria', obra: 'Fortuito interno e risco da atividade', ano: '2023',
        trecho: 'O critério útil é a previsibilidade para quem organiza a atividade. A companhia que remaneja sua própria malha conhece o efeito da decisão antes do passageiro, e por isso responde por ele.',
      },
    ],
    chat: [
      { de: 'eu', texto: 'Essa tese é confiável? A nota é só 57.' },
      {
        de: 'ia',
        paragrafos: [
          'A nota baixa não significa que a tese perde — ela ganha em 91% dos casos. Significa que a base tem pouco material: 312 processos em três tribunais, sem julgado de corte superior.',
          'Na prática: forte para usar em SP, RJ ou GO. Fora desses estados, você estaria pedindo ao tribunal algo que ele ainda não decidiu.',
        ],
        fonte: 'Base: 312 processos · T-0955',
      },
    ],
    chatSugestoes: ['Como a nota é calculada?', 'Existe tese parecida?', 'Há julgado do STJ?'],
  },
];
