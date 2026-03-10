import { GoogleLoginButton } from "../components/google-login-button";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-6 sm:px-6 sm:py-8">
      <section className="grid w-full max-w-[560px] gap-5 rounded-3xl border border-slate-700/80 bg-slate-900/95 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.55)] sm:p-8">
        <div className="mx-auto grid w-full max-w-[380px] grid-cols-[72px_1fr] items-center gap-3">
          <div className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-xl bg-gradient-to-b from-slate-800/70 to-slate-900/70 ring-1 ring-slate-700/70">
            <img
              src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png"
              alt="Pokemon"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] font-semibold tracking-[0.1em] text-slate-400">BATTLELEAGUE</span>
            <small className="text-slate-400">Acesso rapido do perfil</small>
          </div>
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

        <div className="mx-auto grid w-full max-w-[380px] gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100">BattleLeague</h1>
          <p className="text-sm text-slate-400">Duelo competitivo com progressao e historico do time.</p>
        </div>

        <div className="mx-auto flex w-full max-w-[380px] flex-wrap items-center gap-2 text-[11px] font-medium tracking-wide text-slate-400">
          <span>Duelos 1v1</span>
          <span className="text-slate-600">/</span>
          <span>Evolucao</span>
          <span className="text-slate-600">/</span>
          <span>Historico</span>
        </div>

        <div className="mx-auto w-full max-w-[380px]">
          <GoogleLoginButton />
        </div>

        <div className="mx-auto w-full max-w-[380px] text-xs text-slate-500">
          Login rapido com Google para continuar de onde parou.
        </div>
      </section>
    </main>
  );
}
