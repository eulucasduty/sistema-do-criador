import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pra rodar em Docker/VPS: a build gera uma pasta autocontida (.next/standalone).
  // Na Vercel isso não muda nada.
  output: "standalone",
  // A tela de instalação (e o Início e os Roteiros, quando falta o SQL de uma versão nova) oferece o
  // SQL pra copiar: os arquivos vão junto no servidor
  outputFileTracingIncludes: { "/login": ["./supabase/migrations/*.sql"], "/": ["./supabase/migrations/*.sql"], "/roteiros": ["./supabase/migrations/*.sql"] },
  // Arquivo grande (vídeo, prints) vai do navegador direto pro Storage: ação do servidor
  // só recebe texto e formulário.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
