import { GoogleLoginButton } from "../components/google-login-button";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 py-8">
      <section className="grid w-full max-w-2xl gap-4 rounded-3xl border border-blue-500/30 bg-slate-900/80 p-8 shadow-2xl">
        <div className="grid gap-2">
          <span className="w-fit rounded-full border border-blue-400/50 bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-200">
            TemporadaKantoAberta
          </span>
          <h1>Pokemon Duel Men</h1>
          <p className="text-slate-300">Monte seu time, desafie geral e acompanhe sua subida no ranking.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold">Duelos 1v1</span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold">Evolucao com tempo</span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold">Historico completo</span>
        </div>

        <div className="grid gap-1 rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
          <strong>Sua conta, seu progresso</strong>
          <small className="text-slate-400">Login rapido com Google para continuar de onde parou.</small>
        </div>

        <GoogleLoginButton />

        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span>Drop em caixa</span>
          <span>Missoes diarias</span>
          <span>Ranking semanal</span>
        </div>
      </section>
    </main>
  );
}
