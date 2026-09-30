import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pra rodar em Docker/VPS: a build gera uma pasta autocontida (.next/standalone).
  // Na Vercel isso não muda nada.
  output: "standalone",
  // Arquivo grande (vídeo, prints) vai do navegador direto pro Storage: ação do servidor
  // só recebe texto e formulário.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
