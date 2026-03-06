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
          <span>Duelos 1v1</span>
          <span>Evolucao com tempo</span>
          <span>Historico completo</span>
        </div>

        <div className="LoginActionPanel">
          <strong>Sua conta, seu progresso</strong>
          <small>Login rapido com Google para continuar de onde parou.</small>
        </div>

        <GoogleLoginButton />

        <div className="LoginFootNote">
          <span>Drop em caixa</span>
          <span>Missoes diarias</span>
          <span>Ranking semanal</span>
        </div>
      </section>
    </main>
  );
}
