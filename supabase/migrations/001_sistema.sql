-- Sistema do Criador · 001 · tudo
--
-- Cole este arquivo inteiro no SQL Editor do seu projeto Supabase e clique em Run.
-- Depois: Project Settings → Data API → Exposed schemas → adicione "criador" e salve.
--
-- Tudo mora no schema "criador" (o "public" fica livre pra você). O helper de acesso fica
-- em "criador_privado", que nunca é exposto. Só quem está na tabela equipe vê os dados;
-- o primeiro usuário criado vira o dono sozinho.

create schema if not exists criador;
create schema if not exists criador_privado;

grant usage on schema criador to authenticated, service_role;
revoke all on schema criador_privado from public;
grant usage on schema criador_privado to authenticated, service_role;
alter default privileges in schema criador grant all on tables to authenticated, service_role;
alter default privileges in schema criador grant all on sequences to authenticated, service_role;

-- atualizado_em automático em toda tabela que tem a coluna
create or replace function criador.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end
$$;

-- ── Quem usa o sistema ──────────────────────────────────────────
create table if not exists criador.equipe (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null unique references auth.users (id) on delete cascade,
  nome        text not null,
  papel       text not null default 'dono' check (papel in ('dono', 'equipe')),
  criado_em   timestamptz not null default now()
);
alter table criador.equipe enable row level security;

-- O portão: TODA policy do sistema chama esta função (dentro de select: avalia uma vez por consulta)
create or replace function criador_privado.eh_da_equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from criador.equipe e where e.usuario_id = (select auth.uid()));
$$;
revoke all on function criador_privado.eh_da_equipe() from public, anon;
grant execute on function criador_privado.eh_da_equipe() to authenticated, service_role;

drop policy if exists equipe_ve_a_si on criador.equipe;
create policy equipe_ve_a_si on criador.equipe
  for select to authenticated using (usuario_id = (select auth.uid()));

-- O primeiro usuário que se cadastra vira o dono (os seguintes não entram sozinhos)
create or replace function criador_privado.primeiro_usuario_vira_dono()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from criador.equipe) then
    insert into criador.equipe (usuario_id, nome, papel)
    values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(coalesce(new.email, 'dono'), '@', 1)), 'dono');
  end if;
  return new;
end
$$;
revoke all on function criador_privado.primeiro_usuario_vira_dono() from public, anon, authenticated;
drop trigger if exists criador_primeiro_usuario on auth.users;
create trigger criador_primeiro_usuario after insert on auth.users
  for each row execute function criador_privado.primeiro_usuario_vira_dono();

-- Quem já tinha conta no projeto antes desta migração: o mais antigo vira o dono
insert into criador.equipe (usuario_id, nome, papel)
select u.id, split_part(coalesce(u.email, 'dono'), '@', 1), 'dono'
from auth.users u
where not exists (select 1 from criador.equipe)
order by u.created_at
limit 1;

-- ── Configuração (chave → valor) ────────────────────────────────
create table if not exists criador.configuracao (
  id            uuid primary key default gen_random_uuid(),
  chave         text not null unique,
  valor         jsonb not null,
  descricao     text,
  atualizado_em timestamptz not null default now()
);

-- Travas entre chamadas do relógio (só o servidor usa)
create table if not exists criador.trava (
  nome  text primary key,
  ate   timestamptz not null default '1970-01-01'
);

-- ── Leads (quem falou com você no Instagram) ────────────────────
create table if not exists criador.contato (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  nome                text,
  primeiro_nome       text,            -- null quando o nome parece marca ou lixo
  instagram_id        text unique,     -- IGSID
  instagram_usuario   text,
  tags                text[] not null default '{}',
  observacoes         text,            -- a sua anotação
  agente_pausado_ate  timestamptz,     -- 'infinity' = pausa sem data pra voltar
  agente_pausa_motivo text,
  nao_contatar        boolean not null default false,
  nao_contatar_em     timestamptz,
  ultima_mensagem_em  timestamptz,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create index if not exists contato_tags_idx on criador.contato using gin (tags);
create index if not exists contato_instagram_usuario_idx on criador.contato (instagram_usuario);
create index if not exists contato_ultima_idx on criador.contato (ultima_mensagem_em desc nulls last);

-- ── Agente de IA (opcional; começa desligado) ───────────────────
create table if not exists criador.agente (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  ativo             boolean not null default false,
  modelo            text not null default 'openai/gpt-6-luna',
  temperatura       numeric(3, 2) not null default 0.70 check (temperatura between 0 and 2),
  prompt            text not null default '',
  limite_mensagens  integer not null default 30 check (limite_mensagens between 1 and 50),
  espera_segundos   integer not null default 90 check (espera_segundos between 0 and 900),
  horario_inicio    time not null default '08:00',
  horario_fim       time not null default '23:30',
  pausado_ate       timestamptz,       -- pausa geral do agente
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create table if not exists criador.agente_versao (
  id           uuid primary key default gen_random_uuid(),
  agente_id    uuid not null references criador.agente (id) on delete cascade,
  prompt       text not null,
  modelo       text not null,
  temperatura  numeric(3, 2) not null,
  nota         text,
  criado_por   uuid references auth.users (id) on delete set null,
  criado_em    timestamptz not null default now()
);
create index if not exists agente_versao_agente_idx on criador.agente_versao (agente_id, criado_em desc);

create table if not exists criador.conhecimento (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  conteudo      text not null,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ── Conversas e mensagens (direct) ──────────────────────────────
create table if not exists criador.conversa (
  id                   uuid primary key default gen_random_uuid(),
  contato_id           uuid not null unique references criador.contato (id) on delete cascade,
  agente_id            uuid references criador.agente (id) on delete set null,
  status               text not null default 'aberta' check (status in ('aberta', 'com_voce', 'encerrada')),
  mensagens_do_agente  integer not null default 0,
  janela_ate           timestamptz,    -- fim da janela de 24 h da Meta
  aguardando_desde     timestamptz,    -- mensagem da pessoa ainda sem resposta
  responder_apos       timestamptz,    -- a espera do agente (junta mensagens picadas)
  ultima_mensagem_em   timestamptz,
  processando_desde    timestamptz,    -- trava do turno; vence sozinha em 5 min
  status_motivo        text,
  status_em            timestamptz,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);
create index if not exists conversa_responder_idx on criador.conversa (responder_apos) where responder_apos is not null;
create index if not exists conversa_agente_idx on criador.conversa (agente_id);
create index if not exists conversa_ultima_idx on criador.conversa (ultima_mensagem_em desc nulls last);

create table if not exists criador.mensagem (
  id           uuid primary key default gen_random_uuid(),
  conversa_id  uuid not null references criador.conversa (id) on delete cascade,
  contato_id   uuid not null references criador.contato (id) on delete cascade,
  direcao      text not null check (direcao in ('entrada', 'saida')),
  autor        text not null check (autor in ('contato', 'agente', 'criador', 'sistema')),
  tipo         text not null default 'texto'
                 check (tipo in ('texto', 'audio', 'imagem', 'video', 'documento', 'figurinha', 'reacao', 'botao', 'outro')),
  conteudo     text,
  midia_url    text,
  midia_tipo   text,
  transcricao  text,                   -- áudio transcrito ou imagem descrita
  externo_id   text unique,            -- mid do Instagram
  status       text check (status in ('recebida', 'enviada', 'entregue', 'lida', 'falhou')),
  erro         text,
  metadados    jsonb not null default '{}',
  enviada_em   timestamptz not null default now(),
  criado_em    timestamptz not null default now()
);
create index if not exists mensagem_conversa_idx on criador.mensagem (conversa_id, enviada_em);
create index if not exists mensagem_contato_idx on criador.mensagem (contato_id, enviada_em);

create table if not exists criador.agente_turno (
  id              uuid primary key default gen_random_uuid(),
  agente_id       uuid references criador.agente (id) on delete set null,
  conversa_id     uuid references criador.conversa (id) on delete cascade,
  contato_id      uuid references criador.contato (id) on delete cascade,
  simulacao       boolean not null default false,
  entrada         text,
  resposta        text[],
  resultado       text not null check (resultado in ('respondeu', 'escalou', 'encerrou', 'bloqueado', 'pulou', 'erro')),
  motivo          text,
  ferramentas     jsonb not null default '[]',
  auditoria       jsonb,
  modelo          text,
  tokens_entrada  integer,
  tokens_saida    integer,
  custo_usd       numeric(10, 6),
  duracao_ms      integer,
  criado_em       timestamptz not null default now()
);
create index if not exists agente_turno_conversa_idx on criador.agente_turno (conversa_id, criado_em desc);
create index if not exists agente_turno_contato_idx on criador.agente_turno (contato_id);
create index if not exists agente_turno_agente_idx on criador.agente_turno (agente_id);
create index if not exists agente_turno_criado_idx on criador.agente_turno (criado_em desc);

-- O que precisa de você (aparece no Início e em Leads)
create table if not exists criador.alerta (
  id            uuid primary key default gen_random_uuid(),
  contato_id    uuid references criador.contato (id) on delete cascade,
  tipo          text not null check (tipo in ('precisa_de_voce', 'quer_comprar', 'perguntou_se_e_ia', 'nao_contatar', 'erro')),
  motivo        text,
  resolvido     boolean not null default false,
  resolvido_em  timestamptz,
  criado_em     timestamptz not null default now()
);
create index if not exists alerta_abertos_idx on criador.alerta (criado_em desc) where not resolvido;
create index if not exists alerta_contato_idx on criador.alerta (contato_id);

-- Eventos do webhook da Meta (ficam 30 dias pra investigar)
create table if not exists criador.evento_recebido (
  id             uuid primary key default gen_random_uuid(),
  evento_id      text not null unique,
  tipo           text not null,
  corpo          jsonb not null,
  processado_em  timestamptz,
  erro           text,
  recebido_em    timestamptz not null default now()
);
create index if not exists evento_recebido_em_idx on criador.evento_recebido (recebido_em desc);

-- ── Automações do Instagram (o "ManyChat" grátis) ───────────────
create table if not exists criador.ig_automacao (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  ativa               boolean not null default false,
  todas_as_midias     boolean not null default false,
  midias              text[] not null default '{}',     -- ids das mídias (reels/posts) onde vale
  palavras            text[] not null default '{}',     -- vazio = qualquer comentário
  respostas_publicas  text[] not null default '{}',     -- sorteia uma
  dm_abertura         text not null,                    -- a 1ª DM (resposta privada ao comentário)
  botao_abertura      text not null default 'quero',
  modo                text not null default 'botao' check (modo in ('agente', 'botao')),
  contexto            text,                             -- o que tem no material (o agente usa)
  exigir_seguir       boolean not null default false,
  dm_nao_segue        text,
  botao_seguir        text not null default 'Já segui ✅',
  dm_entrega          text,
  link_entrega        text,
  entrega_mensagens   jsonb not null default '[]',      -- [{texto, botao_titulo?, botao_url?}]
  followups           jsonb not null default '[{"horas": 12, "texto": "{nome}?"}, {"horas": 23, "texto": "?"}]',
  tag                 text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

create table if not exists criador.ig_comentario (
  id                uuid primary key default gen_random_uuid(),
  comentario_id     text not null unique,
  midia_id          text,
  automacao_id      uuid references criador.ig_automacao (id) on delete set null,
  contato_id        uuid references criador.contato (id) on delete cascade,
  igsid             text,
  usuario           text,
  texto             text,
  resposta_publica  text,
  status            text not null default 'recebido' check (status in ('recebido', 'ignorado', 'respondido', 'erro')),
  erro              text,
  criado_em         timestamptz not null default now()
);
create index if not exists ig_comentario_automacao_idx on criador.ig_comentario (automacao_id, criado_em desc);
create index if not exists ig_comentario_contato_idx on criador.ig_comentario (contato_id);
create index if not exists ig_comentario_midia_idx on criador.ig_comentario (midia_id);

create table if not exists criador.ig_fluxo (
  id                   uuid primary key default gen_random_uuid(),
  contato_id           uuid not null references criador.contato (id) on delete cascade,
  automacao_id         uuid not null references criador.ig_automacao (id) on delete cascade,
  etapa                text not null check (etapa in ('abertura', 'com_agente', 'aguardando_seguir', 'entregue')),
  comentario_id        text,
  comentario_texto     text,
  entregue_em          timestamptz,
  followups_enviados   integer not null default 0,
  ultimo_followup_em   timestamptz,
  lembrete_em          timestamptz,     -- quando o lembrete no comentário saiu
  lembrete_texto       text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  unique (contato_id, automacao_id)
);
create index if not exists ig_fluxo_automacao_idx on criador.ig_fluxo (automacao_id);
create index if not exists ig_fluxo_etapa_idx on criador.ig_fluxo (etapa, criado_em);

-- Clique no link com código (/r/<código>): quem clicou em quê
create table if not exists criador.clique (
  id             uuid primary key default gen_random_uuid(),
  contato_id     uuid references criador.contato (id) on delete cascade,
  automacao_id   uuid references criador.ig_automacao (id) on delete set null,
  destino        text,
  criado_em      timestamptz not null default now()
);
create index if not exists clique_contato_idx on criador.clique (contato_id);
create index if not exists clique_automacao_idx on criador.clique (automacao_id);

-- ── Esteira: referências, roteiros e carrosséis ─────────────────
create table if not exists criador.referencia (
  id                uuid primary key default gen_random_uuid(),
  origem            text not null default 'upload' check (origem in ('link', 'upload')),
  tipo              text not null default 'reel' check (tipo in ('reel', 'carrossel', 'post', 'outro')),
  url               text,
  autor             text,
  legenda           text,
  notas             text,
  arquivo           text,                          -- caminho no bucket esteira (vídeo ou capa)
  arquivo_tipo      text,
  slides            text[] not null default '{}',  -- os outros slides do carrossel
  aguardando_video  boolean not null default false,
  sem_video_motivo  text,
  metricas          jsonb,
  assistido         jsonb,                         -- a IA assistindo: fala com tempo, cenas
  analise           jsonb,
  analisado_em      timestamptz,
  roteiros          jsonb not null default '[]',   -- o mais novo primeiro
  copia             jsonb,                         -- a cópia do carrossel (slides + legenda)
  tentativas        integer not null default 0,
  erro              text,
  etapa             text not null default 'nova' check (etapa in ('nova', 'analisada', 'vou_gravar', 'gravado', 'postado', 'descartada')),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index if not exists referencia_etapa_idx on criador.referencia (etapa, criado_em desc);

-- Os seus reels (a persona sai deles)
create table if not exists criador.meu_reel (
  id            uuid primary key default gen_random_uuid(),
  midia_id      text not null unique,
  permalink     text,
  legenda       text,
  publicado_em  timestamptz,
  duracao_seg   integer,
  assistido     jsonb,
  erro          text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ── Editor de vídeo ─────────────────────────────────────────────
create table if not exists criador.edicao (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  status        text not null default 'subindo'
                check (status in ('subindo', 'na_fila', 'preparando', 'editando', 'renderizando', 'enviando', 'pronto', 'erro', 'cancelada')),
  etapa         text,
  versao        integer not null default 1,
  origem_id     uuid references criador.edicao (id) on delete set null,
  roteiro       text,
  ajuste        text,
  opcoes        jsonb not null default '{}',
  video         jsonb,     -- {partes: [caminhos no bucket edicao], nome, tamanho, tipo}
  resultado     jsonb,     -- {caminho, tamanho, duracao}
  resumo        text,
  log           jsonb not null default '[]',
  erro          text,
  uso           jsonb,     -- turnos, tempo e tokens do Claude (roda no seu plano, sem custo de API)
  estacao       text,
  criado_por    uuid,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  iniciado_em   timestamptz,
  concluido_em  timestamptz
);
create index if not exists edicao_status_idx on criador.edicao (status, criado_em);

create table if not exists criador.edicao_material (
  id         uuid primary key default gen_random_uuid(),
  edicao_id  uuid not null references criador.edicao (id) on delete cascade,
  ordem      integer not null default 0,
  tipo       text not null check (tipo in ('imagem', 'video', 'link')),
  descricao  text not null default '',
  arquivo    jsonb,
  url        text,
  criado_em  timestamptz not null default now()
);
create index if not exists edicao_material_edicao_idx on criador.edicao_material (edicao_id, ordem);

-- "Meus sons": cada som tem uma FUNÇÃO no padrão de edição; o principal de cada função entra sozinho
create table if not exists criador.edicao_som (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null unique check (nome ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  funcao        text check (funcao in ('obturador', 'ding', 'teclado', 'tecla', 'whoosh', 'riser', 'pop', 'click', 'impacto', 'notificacao')),
  principal     boolean not null default false,
  descricao     text not null default '',
  origem        text not null default 'criador' check (origem in ('criador', 'kit', '99hud')),
  arquivo       text not null,
  tipo          text,
  tamanho       integer,
  volume        numeric(3, 2) not null default 1 check (volume > 0 and volume <= 2),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists edicao_som_principal_idx on criador.edicao_som (funcao) where principal and ativo;

-- ── Segurança: RLS em tudo, uma regra só ────────────────────────
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'criador' loop
    execute format('alter table criador.%I enable row level security', t);
    if t not in ('equipe', 'trava') then
      execute format('drop policy if exists equipe_tudo on criador.%I', t);
      execute format(
        'create policy equipe_tudo on criador.%I for all to authenticated '
        'using ((select criador_privado.eh_da_equipe())) '
        'with check ((select criador_privado.eh_da_equipe()))', t);
    end if;
  end loop;
  for t in select c.table_name from information_schema.columns c
           where c.table_schema = 'criador' and c.column_name = 'atualizado_em' loop
    execute format('drop trigger if exists tocar_atualizado_em on criador.%I', t);
    execute format('create trigger tocar_atualizado_em before update on criador.%I '
                   'for each row execute function criador.tocar_atualizado_em()', t);
  end loop;
end
$$;

grant all on all tables in schema criador to authenticated, service_role;
grant all on all sequences in schema criador to authenticated, service_role;

-- ── Arquivos (Storage) ──────────────────────────────────────────
-- edicao e esteira: privados (o sistema gera links assinados). perfil: a sua foto, pública.
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('edicao', 'edicao', false, 52428800),
  ('esteira', 'esteira', false, 52428800),
  ('perfil', 'perfil', true, 5242880)
on conflict (id) do nothing;

-- ── O relógio (pg_cron + pg_net): o Supabase chama /api/relogio a cada minuto ──
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron não foi ligado aqui (%): ligue em Database → Extensions', sqlerrm;
end
$$;
do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net não foi ligado aqui (%): ligue em Database → Extensions', sqlerrm;
end
$$;

-- O botão "Ligar o relógio" do passo a passo chama isto (só o servidor pode)
create or replace function criador.ligar_relogio(p_url text, p_segredo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  comando text;
begin
  if p_url !~ '^https://' then
    raise exception 'o endereço do sistema precisa começar com https://';
  end if;
  begin
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'sistema-do-criador';
  exception when undefined_table or invalid_schema_name then
    raise exception 'ligue a extensão pg_cron (Database → Extensions) e tente de novo';
  end;
  comando := format(
    'select net.http_get(url := %L, headers := jsonb_build_object(%L, %L), timeout_milliseconds := 10000)',
    rtrim(p_url, '/') || '/api/relogio', 'Authorization', 'Bearer ' || p_segredo);
  perform cron.schedule('sistema-do-criador', '* * * * *', comando);
  return 'ligado';
end
$$;

create or replace function criador.desligar_relogio()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'sistema-do-criador';
  return 'desligado';
exception when undefined_table or invalid_schema_name then
  return 'sem pg_cron';
end
$$;

create or replace function criador.relogio_agendado()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (select 1 from cron.job j where j.jobname = 'sistema-do-criador' and j.active);
exception when undefined_table or invalid_schema_name then
  return false;
end
$$;

revoke all on function criador.ligar_relogio(text, text) from public, anon, authenticated;
revoke all on function criador.desligar_relogio() from public, anon, authenticated;
revoke all on function criador.relogio_agendado() from public, anon, authenticated;
grant execute on function criador.ligar_relogio(text, text) to service_role;
grant execute on function criador.desligar_relogio() to service_role;
grant execute on function criador.relogio_agendado() to service_role;

-- ── Dados iniciais ──────────────────────────────────────────────
insert into criador.agente (nome)
select 'Agente do Instagram'
where not exists (select 1 from criador.agente);

insert into criador.configuracao (chave, valor, descricao) values
  ('perfil', '{}', 'Quem é você: nome, @, nicho, público, jeito de falar, look do vídeo, cores da marca'),
  ('persona', '{}', 'O guia da sua voz, tirado dos seus reels (Esteira → Minha persona)'),
  ('ofertas', '[]', 'Os links que o agente pode oferecer no fim da conversa'),
  ('instagram', '{}', 'Conta do Instagram: token (renovado sozinho), id e @; o token nunca aparece na tela'),
  ('facebook', '{}', 'Página do Facebook ligada ao seu Instagram (pra Esteira buscar reels públicos pela API oficial)'),
  ('perfis_teste', '[]', 'Com o agente desligado, ele responde só estes @ (pra testar)'),
  ('pausa_por_eco_horas', '48', 'Você respondeu pelo app do Instagram: o agente sai da conversa por estas horas'),
  ('followup_agente', '{"horas": 23, "antes_da_oferta": "{nome}?", "depois_da_oferta": "conseguiu abrir o link?"}', 'O toque de quem sumiu no meio da conversa com o agente'),
  ('lembrete_comentario', '{"ativo": true, "horas": 12, "por_minuto": 5, "textos": ["{arroba} chegou lá? te mandei na dm 👀", "{arroba} te mandei o material na dm, confere lá 👀", "{arroba} olha a dm 👀 se não aparecer, dá uma olhada nas solicitações de mensagem"]}', 'Quem não respondeu a 1ª DM: lembrete público no comentário'),
  ('estacao_edicao', '{"visto_em": null, "maquina": null, "ocupada": false}', 'Batida da estação de edição de vídeo (o seu PC)'),
  ('relogio', '{}', 'Batida do relógio (o que o sistema faz sozinho)')
on conflict (chave) do nothing;
