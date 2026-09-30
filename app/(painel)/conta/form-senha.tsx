"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Troca a senha do próprio usuário (a sessão do navegador é quem autoriza).
export function FormSenha() {
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function trocar(formData: FormData) {
    const nova = String(formData.get("nova") ?? "");
    const repetida = String(formData.get("repetida") ?? "");
    setMsg(null);
    if (nova.length < 10) return setMsg({ ok: false, texto: "Use pelo menos 10 caracteres." });
    if (nova !== repetida) return setMsg({ ok: false, texto: "As duas senhas não são iguais." });
    setEnviando(true);
    const { error } = await createClient().auth.updateUser({ password: nova });
    setEnviando(false);
    setMsg(error ? { ok: false, texto: `Não trocou: ${error.message}` } : { ok: true, texto: "Senha trocada. Use a nova no próximo login." });
  }

  const campo = "mt-1 w-full rounded-lg border border-borda bg-superficie px-3 py-2.5 text-sm outline-none focus:border-marca";
  return (
    <form action={trocar} className="max-w-sm space-y-3">
      <label className="block">
        <span className="text-xs text-suave">Nova senha</span>
        <input name="nova" type="password" required autoComplete="new-password" className={campo} />
      </label>
      <label className="block">
        <span className="text-xs text-suave">Repete a nova senha</span>
        <input name="repetida" type="password" required autoComplete="new-password" className={campo} />
      </label>
      {msg && <p className={`text-sm ${msg.ok ? "text-ok" : "text-quente"}`}>{msg.texto}</p>}
      <button
        type="submit"
        disabled={enviando}
        className="btn btn-sm disabled:opacity-60"
      >
        {enviando ? "Trocando…" : "Trocar senha"}
      </button>
    </form>
  );
}
