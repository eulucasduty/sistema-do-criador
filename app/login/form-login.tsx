"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { criarConta } from "./acoes";

export function FormLogin({ criar = false }: { criar?: boolean }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(formData: FormData) {
    setEnviando(true);
    setErro(null);
    const email = String(formData.get("email") ?? "").trim();
    const senha = String(formData.get("senha") ?? "");
    if (criar) {
      const r = await criarConta({ email, senha, nome: String(formData.get("nome") ?? "") });
      if (r.erro) {
        setErro(r.erro);
        setEnviando(false);
        return;
      }
    }
    const { error } = await createClient().auth.signInWithPassword({ email, password: senha });
    if (error) {
      setErro("E-mail ou senha não conferem.");
      setEnviando(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form action={entrar} className="space-y-4">
      {criar && (
        <label className="block">
          <span className="rotulo">Seu nome</span>
          <input name="nome" required autoComplete="given-name" className="campo mt-1 py-2.5" />
        </label>
      )}
      <label className="block">
        <span className="rotulo">E-mail</span>
        <input name="email" type="email" required autoComplete="email" className="campo mt-1 py-2.5" />
      </label>
      <label className="block">
        <span className="rotulo">Senha{criar ? " (8+ caracteres)" : ""}</span>
        <input
          name="senha"
          type="password"
          required
          minLength={criar ? 8 : undefined}
          autoComplete={criar ? "new-password" : "current-password"}
          className="campo mt-1 py-2.5"
        />
      </label>
      {erro && <p className="text-sm text-quente">{erro}</p>}
      <button type="submit" disabled={enviando} className="btn mt-2 w-full">
        {enviando ? (criar ? "Criando…" : "Entrando…") : criar ? "Criar minha conta" : "Entrar"}
      </button>
    </form>
  );
}
