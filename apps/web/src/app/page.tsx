import { GoogleLoginButton } from "../components/google-login-button";

export default function LoginPage() {
  return (
    <main className="LoginScreen">
      <section className="LoginShell">
        <div className="LoginHeader">
          <span className="LoginKicker">TemporadaKantoAberta</span>
          <h1>Pokemon Duel Men</h1>
          <p>Monte seu time, desafie geral e acompanhe sua subida no ranking.</p>
        </div>

        <div className="LoginHighlights">
          <span>Duelos1v1</span>
          <span>EvolucaoComTempo</span>
          <span>HistoricoCompleto</span>
        </div>

        <div className="LoginActionPanel">
          <strong>SuaContaSeuProgresso</strong>
          <small>Login rapido com Google para continuar de onde parou.</small>
        </div>

        <GoogleLoginButton />

        <div className="LoginFootNote">
          <span>DropEmCaixa</span>
          <span>MissoesDiarias</span>
          <span>RankingSemanal</span>
        </div>
      </section>
    </main>
  );
}
