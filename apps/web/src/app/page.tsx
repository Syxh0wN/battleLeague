import { GoogleLoginButton } from "../components/google-login-button";

export default function LoginPage() {
  return (
    <main className="LoginScreen">
      <section className="LoginShell">
        <div className="LoginHeader">
          <span className="LoginKicker">LigaRankedOnline</span>
          <h1>Pokemon Duel Men</h1>
          <p>Entre com Google para desbloquear seus pokemons, duelos e ranking.</p>
        </div>

        <div className="LoginHighlights">
          <span>1v1 TurnoAssincrono</span>
          <span>EvolucaoComCooldown</span>
          <span>HistoricoDeBatalha</span>
        </div>

        <div className="LoginActionPanel">
          <strong>ProntoParaSuaPrimeiraBatalha</strong>
          <small>Conta unica, progresso salvo e social ativo com amigos.</small>
        </div>

        <GoogleLoginButton />
      </section>
    </main>
  );
}
