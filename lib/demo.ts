/* eslint-disable @typescript-eslint/no-explicit-any */
// Modo demonstração: o painel inteiro com dados de exemplo, sem Supabase. Serve pra ver o
// visual, gravar aula e tirar print. Liga com `npm run demo` (ou DEMO=1) e NUNCA funciona em
// produção (a build de produção ignora). Nada é gravado: as ações só fingem que salvaram.

export const DEMO = (process.env.DEMO === "1" || process.env.npm_lifecycle_event === "demo") && process.env.NODE_ENV !== "production";

const agora = Date.now();
const ha = (min: number) => new Date(agora - min * 60_000).toISOString();
const daqui = (min: number) => new Date(agora + min * 60_000).toISOString();

const PERFIL = {
  nome: "Ana",
  usuario: "ana.cria",
  nicho: "finanças pra quem tá começando",
  publico: "jovens de 18 a 25 que querem a primeira renda extra",
  tom: "informal, animada, explico como amiga, sem palavrão",
  foto_url: null,
  cor: "contraste",
  legenda: "bangers",
  cores: { fundo: "#0b0b0c", texto: "#f5f4f0", destaque: "#ffc93c" },
};

const AUTOMACOES = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    nome: "Planilha de gastos",
    ativa: true,
    todas_as_midias: false,
    midias: ["m1"],
    palavras: ["planilha"],
    respostas_publicas: ["te mandei na dm 👀", "olha a dm 😉"],
    dm_abertura: "oi {nome}! vi que você comentou planilha, bora?",
    botao_abertura: "quero",
    modo: "agente",
    contexto: "planilha de controle de gastos em Google Sheets",
    exigir_seguir: true,
    dm_nao_segue: null,
    botao_seguir: "Já segui ✅",
    dm_entrega: null,
    link_entrega: "https://exemplo.com/planilha",
    entrega_mensagens: [{ texto: "tá aqui a planilha 👇", botao_titulo: "abrir a planilha", botao_url: "https://exemplo.com/planilha" }],
    followups: [{ horas: 12, texto: "{nome}?" }, { horas: 23, texto: "?" }],
    tag: "planilha",
    criado_em: ha(60 * 24 * 12),
    atualizado_em: ha(60 * 24 * 2),
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    nome: "Guia do primeiro investimento",
    ativa: true,
    todas_as_midias: true,
    midias: [],
    palavras: ["guia", "investir"],
    respostas_publicas: ["chegou na dm 🚀"],
    dm_abertura: "oi {nome}! quer o guia?",
    botao_abertura: "quero o guia",
    modo: "botao",
    contexto: null,
    exigir_seguir: false,
    dm_nao_segue: null,
    botao_seguir: "Já segui ✅",
    dm_entrega: null,
    link_entrega: "https://exemplo.com/guia",
    entrega_mensagens: [{ texto: "aqui o guia completo 👇", botao_titulo: "baixar", botao_url: "https://exemplo.com/guia" }],
    followups: [],
    tag: "guia",
    criado_em: ha(60 * 24 * 30),
    atualizado_em: ha(60 * 24 * 5),
  },
];

const nomes = [
  ["Julia Martins", "juliamartins"],
  ["Pedro Alves", "pedro.alvs"],
  ["Camila Rocha", "camirocha_"],
  ["Lucas Ferreira", "lu.ferreira"],
  ["Bia Santos", "biasantos"],
  ["Rafa Lima", "rafalima.fin"],
];
const CONTATOS = nomes.map(([nome, usuario], i) => ({
  id: `c1000000-0000-4000-8000-00000000000${i + 1}`,
  codigo: `AB${i}C${i}D`,
  nome,
  primeiro_nome: nome.split(" ")[0],
  instagram_id: `ig${i}`,
  instagram_usuario: usuario,
  tags: i % 2 ? ["guia"] : ["planilha", ...(i === 0 ? ["oferta_enviada", "clicou_oferta"] : [])],
  observacoes: i === 0 ? "quer começar a investir com pouco" : null,
  agente_pausado_ate: i === 2 ? "infinity" : null,
  agente_pausa_motivo: i === 2 ? "perguntou se é IA" : null,
  nao_contatar: i === 5,
  nao_contatar_em: i === 5 ? ha(60 * 30) : null,
  ultima_mensagem_em: ha(i * 47 + 3),
  criado_em: ha(60 * 24 * (i + 1)),
  atualizado_em: ha(i * 47 + 3),
}));
const resumo = (c: (typeof CONTATOS)[number]) => ({ id: c.id, nome: c.nome, instagram_usuario: c.instagram_usuario, instagram_id: c.instagram_id, primeiro_nome: c.primeiro_nome, tags: c.tags, nao_contatar: c.nao_contatar, agente_pausado_ate: c.agente_pausado_ate });
const auto = (i: number) => AUTOMACOES[i % 2];

const FLUXOS = CONTATOS.map((c, i) => ({
  id: `f1000000-0000-4000-8000-00000000000${i + 1}`,
  contato_id: c.id,
  automacao_id: auto(i).id,
  etapa: ["com_agente", "entregue", "entregue", "abertura", "aguardando_seguir", "entregue"][i],
  comentario_id: `com${i}`,
  comentario_texto: auto(i).palavras[0],
  entregue_em: i === 3 || i === 4 ? null : ha(i * 50 + 10),
  followups_enviados: i === 1 ? 1 : 0,
  ultimo_followup_em: null,
  lembrete_em: i === 3 ? ha(30) : null,
  lembrete_texto: i === 3 ? "@lu.ferreira chegou lá? te mandei na dm 👀" : null,
  criado_em: ha(i * 60 + 20),
  atualizado_em: ha(i * 47 + 3),
  automacao: auto(i),
  contato: resumo(c),
}));

const CONVERSAS = CONTATOS.map((c, i) => ({
  id: `d1000000-0000-4000-8000-00000000000${i + 1}`,
  contato_id: c.id,
  agente_id: "e1000000-0000-4000-8000-000000000001",
  status: i === 2 ? "com_voce" : i === 5 ? "encerrada" : "aberta",
  mensagens_do_agente: i === 0 ? 4 : 1,
  janela_ate: daqui(60 * 20),
  aguardando_desde: null,
  responder_apos: null,
  ultima_mensagem_em: c.ultima_mensagem_em,
  processando_desde: null,
  status_motivo: i === 2 ? "perguntou se é IA" : null,
  status_em: null,
  criado_em: c.criado_em,
  atualizado_em: c.atualizado_em,
  contato: resumo(c),
}));

const falas: Array<[string, string, string]> = [
  ["entrada", "contato", "planilha"],
  ["saida", "agente", "oi julia! vi que você comentou planilha, bora?"],
  ["entrada", "contato", "bora!!"],
  ["saida", "agente", "tá aqui a planilha 👇\nhttps://exemplo.com/planilha"],
  ["entrada", "contato", "amei, mas eu nunca investi nada, por onde eu começo?"],
  ["saida", "agente", "começa pela reserva de emergência, sem pular etapa\n\nquanto você consegue guardar por mês hoje?"],
  ["entrada", "contato", "uns 200 por mês"],
  ["saida", "agente", "dá pra começar tranquilo com isso\n\nse quiser o passo a passo completo, tem o meu guia 👇\nhttps://exemplo.com/r/AB0C0D?ir=oferta-1"],
];
const MENSAGENS = falas.map(([direcao, autor, conteudo], i) => ({
  id: `b1000000-0000-4000-8000-0000000000${String(i + 10)}`,
  conversa_id: CONVERSAS[0].id,
  contato_id: CONTATOS[0].id,
  direcao,
  autor,
  tipo: "texto",
  conteudo,
  midia_url: null,
  midia_tipo: null,
  transcricao: null,
  externo_id: `mid${i}`,
  status: direcao === "entrada" ? "recebida" : "enviada",
  erro: null,
  metadados: autor === "agente" ? { turno: true } : {},
  enviada_em: ha(200 - i * 20),
  criado_em: ha(200 - i * 20),
}));

const ANALISE = {
  resumo: "tutorial rápido de como montar uma reserva de emergência com R$ 100 por mês",
  duracao_seg: 34,
  gancho: { o_que_acontece: "ela segura uma nota de 100 e rasga ao meio", texto_ou_fala: "você tá jogando dinheiro fora todo mês", tipo: "choque", por_que_prende: "gesto inesperado + promessa de economia" },
  formato: "talking head com texto na tela",
  estrutura: [
    { trecho: "0-3s", o_que_acontece: "gancho com a nota rasgada" },
    { trecho: "3-20s", o_que_acontece: "3 passos com texto na tela" },
    { trecho: "20-34s", o_que_acontece: "prova com print do app do banco e CTA" },
  ],
  texto_na_tela: "reserva de emergência em 3 passos",
  audio: "voz + batida leve",
  cta: "comenta RESERVA que eu te mando a planilha",
  tema: "reserva de emergência",
  por_que_engajou: ["gancho visual forte", "promessa concreta com número", "CTA de comentário com material"],
  gatilhos: ["curiosidade", "prova"],
  esqueleto_do_formato: "gesto chocante 2s → promessa com número → 3 passos na tela → print de prova → CTA de comentário",
  transcricao: "você tá jogando dinheiro fora todo mês...",
};

const REFERENCIAS = [
  {
    id: "r1000000-0000-4000-8000-000000000001",
    origem: "link",
    tipo: "reel",
    url: "https://instagram.com/reel/EXEMPLO1",
    autor: "financas.exemplo",
    legenda: "reserva de emergência em 3 passos",
    notas: null,
    arquivo: "exemplo/reel.mp4",
    arquivo_tipo: "video/mp4",
    slides: [],
    aguardando_video: false,
    sem_video_motivo: null,
    metricas: { curtidas: 48210, comentarios: 3120, publicado_em: ha(60 * 24 * 9), fonte: "meta" },
    assistido: { duracao_seg: 34, fala: [{ t: "00:00", texto: "você tá jogando dinheiro fora todo mês" }], cenas: [{ t: "00:00", o_que_aparece: "nota de 100 rasgada", texto_na_tela: "PARA" }], audio: "voz" },
    analise: ANALISE,
    analisado_em: ha(60 * 5),
    roteiros: [
      {
        tipo: "educativo",
        palavra_cta: "RESERVA",
        titulo: "reserva com 200 por mês",
        duracao_seg: 32,
        gancho: { fala: "se você guarda 200 por mês, presta atenção", na_tela: "200 POR MÊS", visual: "eu segurando o celular com o saldo" },
        blocos: [
          { tempo: "3-10s", fala: "primeiro: separa o dinheiro no dia que cai o salário", na_tela: "1. separa no dia", visual: "print do app" },
          { tempo: "10-20s", fala: "segundo: deixa num lugar que rende e dá pra tirar na hora", na_tela: "2. rende e sai na hora", visual: "close" },
          { tempo: "20-32s", fala: "comenta RESERVA que eu te mando a planilha", na_tela: "comenta RESERVA", visual: "eu apontando" },
        ],
        legenda: "reserva de emergência sem mistério 👇 comenta RESERVA",
        gancho_continuidade: "parte 2: onde deixar o dinheiro",
        de_onde_veio: "o gancho de choque e os 3 passos na tela",
        pedido: null,
        gerado_em: ha(60 * 4),
        modelo: "anthropic/claude-sonnet-5",
        custo_usd: 0.03,
      },
    ],
    copia: null,
    tentativas: 1,
    erro: null,
    etapa: "vou_gravar",
    criado_em: ha(60 * 6),
    atualizado_em: ha(60 * 4),
  },
  {
    id: "r1000000-0000-4000-8000-000000000002",
    origem: "upload",
    tipo: "carrossel",
    url: null,
    autor: null,
    legenda: "5 erros de quem começa a investir",
    notas: "quero no meu visual",
    arquivo: "exemplo/capa.png",
    arquivo_tipo: "image/png",
    slides: ["exemplo/2.png", "exemplo/3.png"],
    aguardando_video: false,
    sem_video_motivo: null,
    metricas: null,
    assistido: null,
    analise: { ...ANALISE, resumo: "carrossel de lista com 5 erros", formato: "lista numerada", quantidade_slides: 7, slides_ref: [{ n: 1, texto: "5 erros de quem começa a investir", visual: "título gigante" }], estilo: { fundo: "#101010", texto: "#ffffff", destaque: "#ff5a36", fonte_titulo: "display", caixa_alta: true, descricao: "fundo preto, título branco, destaque laranja" } },
    analisado_em: ha(60 * 30),
    roteiros: [],
    copia: {
      titulo: "5 erros de quem começa",
      palavra_cta: "ERROS",
      slides: [
        { tipo: "capa", titulo: "5 erros que travam o seu primeiro investimento", subtitulo: "o 3º é o mais comum" },
        { tipo: "texto", kicker: "erro 1", titulo: "começar sem reserva", texto: "sem reserva, qualquer imprevisto te faz vender no pior momento." },
        { tipo: "cta", titulo: "salva e manda pra quem precisa", palavra: "ERROS" },
      ],
      legenda: "salva esse 👇 comenta ERROS",
      de_onde_veio: "a lista numerada com capa de curiosidade",
      estilo: { fundo: "#0b0b0c", texto: "#f5f4f0", destaque: "#ffc93c", fonte_titulo: "display", caixa_alta: true, descricao: "a sua marca" },
      visual: "marca",
      pedido: null,
      gerado_em: ha(60 * 20),
      modelo: "anthropic/claude-sonnet-5",
      custo_usd: 0.02,
    },
    tentativas: 1,
    erro: null,
    etapa: "analisada",
    criado_em: ha(60 * 40),
    atualizado_em: ha(60 * 20),
  },
  {
    id: "r1000000-0000-4000-8000-000000000003",
    origem: "link",
    tipo: "reel",
    url: "https://instagram.com/reel/EXEMPLO3",
    autor: "outra.conta",
    legenda: null,
    notas: null,
    arquivo: null,
    arquivo_tipo: null,
    slides: [],
    aguardando_video: true,
    sem_video_motivo: "o reel usa música licenciada: a Meta não libera o vídeo, suba o arquivo",
    metricas: null,
    assistido: null,
    analise: null,
    analisado_em: null,
    roteiros: [],
    copia: null,
    tentativas: 0,
    erro: null,
    etapa: "nova",
    criado_em: ha(15),
    atualizado_em: ha(15),
  },
];

const EDICOES = [
  { id: "ed100000-0000-4000-8000-000000000001", titulo: "reserva com 200 por mês", status: "pronto", etapa: null, versao: 2, origem_id: null, roteiro: null, ajuste: "legenda um pouco maior", opcoes: { legenda: "bangers", cor: "contraste" }, video: { partes: [], nome: "cru.mp4", tamanho: 84_000_000, tipo: "video/mp4" }, resultado: { caminho: "exemplo/final.mp4", tamanho: 21_000_000, duracao: 32 }, resumo: "cortei as pausas, legenda palavra por palavra, 2 motions em tela cheia e o CTA no fim.", log: [{ em: ha(70), texto: "preparando o vídeo" }, { em: ha(62), texto: "a IA está montando a edição" }, { em: ha(55), texto: "renderizando" }, { em: ha(50), texto: "pronto" }], erro: null, uso: { turnos: 38, segundos: 540, motor: "claude" }, estacao: "PC-da-Ana", criado_por: "demo", criado_em: ha(80), atualizado_em: ha(50), iniciado_em: ha(78), concluido_em: ha(50) },
  { id: "ed100000-0000-4000-8000-000000000002", titulo: "5 erros de quem começa", status: "editando", etapa: "a IA está montando a edição", versao: 1, origem_id: null, roteiro: null, ajuste: null, opcoes: { legenda: "limpa", cor: "natural" }, video: { partes: [], nome: "erros.mp4", tamanho: 120_000_000, tipo: "video/mp4" }, resultado: null, resumo: null, log: [{ em: ha(6), texto: "preparando o vídeo" }, { em: ha(2), texto: "a IA está montando a edição" }], erro: null, uso: null, estacao: "PC-da-Ana", criado_por: "demo", criado_em: ha(8), atualizado_em: ha(2), iniciado_em: ha(7), concluido_em: null },
  { id: "ed100000-0000-4000-8000-000000000003", titulo: "bastidor do app", status: "na_fila", etapa: null, versao: 1, origem_id: null, roteiro: null, ajuste: null, opcoes: { legenda: "bangers", cor: "quente" }, video: { partes: [], nome: "bastidor.mov", tamanho: 60_000_000, tipo: "video/quicktime" }, resultado: null, resumo: null, log: [], erro: null, uso: null, estacao: null, criado_por: "demo", criado_em: ha(1), atualizado_em: ha(1), iniciado_em: null, concluido_em: null },
];

const TABELAS: Record<string, any[]> = {
  equipe: [{ id: "q1", usuario_id: "demo", nome: "Ana", papel: "dono", criado_em: ha(60 * 24 * 40) }],
  configuracao: Object.entries({
    perfil: PERFIL,
    persona: { guia: "1. Como abre: pergunta direta ou número chocante (\"você tá jogando 200 reais fora\").\n2. Bordões: \"bora\", \"sem mistério\".\n3. Ritmo: frases curtas, fala rápido.", reels: 12, de: ha(60 * 24 * 60), ate: ha(60 * 24 * 2), atualizado_em: ha(60 * 24), status: "ok", custo_usd: 0.41 },
    ofertas: [{ nome: "Guia do primeiro investimento", link: "https://exemplo.com/guia", para_quem: "quem nunca investiu e quer começar com pouco" }],
    perfis_teste: ["ana.teste"],
    followup_agente: { horas: 23, antes_da_oferta: "{nome}?", depois_da_oferta: "conseguiu abrir o link?" },
    lembrete_comentario: { ativo: true, horas: 12, por_minuto: 5, textos: ["{arroba} chegou lá? te mandei na dm 👀"] },
    pausa_por_eco_horas: 48,
    estacao_edicao: { visto_em: ha(0.2), maquina: "PC-da-Ana", ocupada: true, edicao_id: EDICOES[1].id, motor: "claude", motor_ok: true, motor_conferido_em: ha(1) },
    relogio: { visto_em: ha(0.5), modo: "cron" },
    editor: { motor: "claude", modelo: null },
  }).map(([chave, valor], i) => ({ id: `cfg${i}`, chave, valor, atualizado_em: ha(i) })),
  segredo: Object.entries({
    instagram: { token: "demo", ig_user_id: "1", username: "ana.cria", renovado_em: ha(60 * 24 * 3), expira_em: daqui(60 * 24 * 57), inscrito_em: ha(60 * 24 * 20), erro: null },
    facebook: { page_token: "demo", page_nome: "Ana Cria", ig_business_id: "1", ig_username: "ana.cria", expira_em: null, conectado_em: ha(60 * 24 * 10) },
    ia: { openrouter_key: "sk-or-demo" },
    meta_app: { app_secret: "demo" },
  }).map(([chave, valor]) => ({ chave, valor, atualizado_em: ha(10) })),
  trava: [],
  contato: CONTATOS.map((c, i) => ({ ...c, ig_fluxo: [{ criado_em: FLUXOS[i].criado_em, automacao: { nome: auto(i).nome } }] })),
  agente: [{ id: "e1000000-0000-4000-8000-000000000001", nome: "Agente do Instagram", ativo: true, modelo: "openai/gpt-6-luna", temperatura: 0.7, prompt: "", limite_mensagens: 30, espera_segundos: 90, horario_inicio: "08:00", horario_fim: "23:30", pausado_ate: null, criado_em: ha(60 * 24 * 40), atualizado_em: ha(60 * 24) }],
  agente_versao: [{ id: "v1", agente_id: "e1000000-0000-4000-8000-000000000001", prompt: "", modelo: "openai/gpt-6-luna", temperatura: 0.7, nota: "primeira versão", criado_por: "demo", criado_em: ha(60 * 24 * 10) }],
  conhecimento: [
    { id: "k1", titulo: "O guia", conteudo: "Guia em PDF com o passo a passo do primeiro investimento. Custa R$ 27.", ativo: true, criado_em: ha(60 * 24 * 9), atualizado_em: ha(60 * 24 * 9) },
    { id: "k2", titulo: "Quem é a Ana", conteudo: "Criadora de finanças pra jovens, começou investindo com R$ 50 por mês.", ativo: true, criado_em: ha(60 * 24 * 9), atualizado_em: ha(60 * 24 * 9) },
  ],
  conversa: CONVERSAS,
  mensagem: MENSAGENS,
  agente_turno: CONTATOS.slice(0, 4).map((c, i) => ({ id: `t${i}`, agente_id: "e1000000-0000-4000-8000-000000000001", conversa_id: CONVERSAS[i].id, contato_id: c.id, simulacao: false, entrada: "uns 200 por mês", resposta: ["dá pra começar tranquilo com isso"], resultado: ["respondeu", "respondeu", "escalou", "respondeu"][i], motivo: i === 2 ? "perguntou_se_e_ia: vc é robô?" : i === 0 ? "oferta Guia do primeiro investimento: quer começar com pouco" : null, ferramentas: [], auditoria: { ok: true, motivos: [], avisos: [], tentativas: 1 }, modelo: "openai/gpt-6-luna", tokens_entrada: 2100, tokens_saida: 80, custo_usd: 0.0004, duracao_ms: 5200, criado_em: ha(i * 40 + 5), contato: resumo(c) })),
  alerta: [
    { id: "al1", contato_id: CONTATOS[2].id, tipo: "perguntou_se_e_ia", motivo: "perguntou se é IA: “vc é robô?”", resolvido: false, resolvido_em: null, criado_em: ha(90), contato: resumo(CONTATOS[2]) },
    { id: "al2", contato_id: CONTATOS[0].id, tipo: "quer_comprar", motivo: "quer comprar a mentoria (não está nas ofertas)", resolvido: false, resolvido_em: null, criado_em: ha(30), contato: resumo(CONTATOS[0]) },
  ],
  evento_recebido: [{ id: "ev1", evento_id: "x", tipo: "ig_comentario", corpo: {}, processado_em: ha(3), erro: null, recebido_em: ha(3) }],
  ig_automacao: AUTOMACOES,
  ig_comentario: CONTATOS.map((c, i) => ({ id: `ic${i}`, comentario_id: `com${i}`, midia_id: "m1", automacao_id: auto(i).id, contato_id: c.id, igsid: c.instagram_id, usuario: c.instagram_usuario, texto: auto(i).palavras[0], resposta_publica: auto(i).respostas_publicas[0], status: "respondido", erro: null, criado_em: ha(i * 60 + 20), automacao: { id: auto(i).id, nome: auto(i).nome }, contato: resumo(c) })),
  ig_fluxo: FLUXOS,
  clique: CONTATOS.slice(0, 3).map((c, i) => ({ id: `cl${i}`, contato_id: c.id, automacao_id: auto(i).id, destino: auto(i).link_entrega, criado_em: ha(i * 30 + 12), automacao: { id: auto(i).id, nome: auto(i).nome } })),
  referencia: REFERENCIAS,
  meu_reel: [],
  edicao: EDICOES,
  edicao_material: [{ id: "em1", edicao_id: EDICOES[0].id, ordem: 0, tipo: "imagem", descricao: "print do app do banco que eu cito aos 20s", arquivo: { partes: [], nome: "print.png", tamanho: 300_000, tipo: "image/png" }, url: null, criado_em: ha(80) }],
  edicao_som: [
    { id: "s1", nome: "meu-click", funcao: "obturador", principal: true, descricao: "click seco que eu uso nas emendas", origem: "criador", arquivo: "sons/meu-click.mp3", tipo: "audio/mpeg", tamanho: 20_000, volume: 1, ativo: true, criado_em: ha(60 * 24), atualizado_em: ha(60 * 24) },
    { id: "s2", nome: "tchan", funcao: null, principal: false, descricao: "revelação engraçada", origem: "criador", arquivo: "sons/tchan.mp3", tipo: "audio/mpeg", tamanho: 40_000, volume: 0.8, ativo: true, criado_em: ha(60 * 24), atualizado_em: ha(60 * 24) },
  ],
};

type Resultado = { data: any; error: null; count: number | null };

class Consulta implements PromiseLike<Resultado> {
  private linhas: any[];
  private contar = false;
  private cabeca = false;
  private uma: "single" | "maybe" | null = null;
  private escrita: any = null;

  constructor(tabela: string) {
    this.linhas = [...(TABELAS[tabela] ?? [])];
  }
  private filtrar(fn: (l: any) => boolean) {
    this.linhas = this.linhas.filter(fn);
    return this;
  }
  select(_c?: string, opcoes?: { count?: string; head?: boolean }) {
    if (opcoes?.count) this.contar = true;
    if (opcoes?.head) this.cabeca = true;
    return this;
  }
  eq(c: string, v: unknown) {
    return this.filtrar((l) => c.includes(".") || !(c in l) || l[c] === v);
  }
  neq(c: string, v: unknown) {
    return this.filtrar((l) => !(c in l) || l[c] !== v);
  }
  in(c: string, vs: unknown[]) {
    return this.filtrar((l) => !(c in l) || vs.includes(l[c]));
  }
  is(c: string, v: unknown) {
    return this.filtrar((l) => !(c in l) || (v === null ? l[c] === null || l[c] === undefined : l[c] === v));
  }
  limit(n: number) {
    this.linhas = this.linhas.slice(0, n);
    return this;
  }
  range(de: number, ate: number) {
    this.linhas = this.linhas.slice(de, ate + 1);
    return this;
  }
  single() {
    this.uma = "single";
    return this;
  }
  maybeSingle() {
    this.uma = "maybe";
    return this;
  }
  insert(v: any) {
    this.escrita = Array.isArray(v) ? v : [v];
    return this;
  }
  upsert(v: any) {
    return this.insert(v);
  }
  update(v: any) {
    this.escrita = [v];
    return this;
  }
  delete() {
    this.escrita = [];
    return this;
  }
  then<A = Resultado, B = never>(ok?: ((r: Resultado) => A | PromiseLike<A>) | null, erro?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    const linhas = this.escrita ? this.escrita.map((l: any, i: number) => ({ id: `demo-${i}`, ...l })) : this.linhas;
    const count = this.contar ? linhas.length : null;
    const data = this.cabeca ? null : this.uma ? (linhas[0] ?? null) : linhas;
    return Promise.resolve({ data, error: null, count }).then(ok, erro);
  }
}
// Qualquer outro filtro (order, gte, not, or, ilike…) é aceito e ignorado
for (const nome of ["order", "gt", "gte", "lt", "lte", "not", "or", "like", "ilike", "contains", "overlaps", "filter", "match", "textSearch", "abortSignal"]) {
  (Consulta.prototype as any)[nome] = function (this: Consulta) {
    return this;
  };
}

const ok = (data: any) => Promise.resolve({ data, error: null });

export function clienteDemo(): any {
  return {
    from: (tabela: string) => new Consulta(tabela),
    rpc: (fn: string) => ok(fn === "relogio_agendado" ? true : null),
    auth: {
      getClaims: () => ok({ claims: { sub: "demo", email: "ana@exemplo.com" } }),
      getUser: () => ok({ user: { id: "demo", email: "ana@exemplo.com" } }),
      signOut: () => ok(null),
      signInWithPassword: () => ok({ user: { id: "demo" } }),
      admin: { createUser: () => ok({ user: { id: "demo" } }), deleteUser: () => ok(null) },
    },
    storage: {
      from: () => ({
        createSignedUrls: (caminhos: string[]) => ok(caminhos.map((path) => ({ path, signedUrl: "#" }))),
        createSignedUrl: () => ok({ signedUrl: "#" }),
        createSignedUploadUrl: (path: string) => ok({ signedUrl: "#", token: "demo", path }),
        upload: () => ok({ path: "demo" }),
        download: () => Promise.resolve({ data: null, error: { message: "modo demonstração" } }),
        remove: () => ok([]),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  };
}
