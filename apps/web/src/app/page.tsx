import { GoogleLoginButton } from "../components/google-login-button";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--SurfaceDark)",
          border: "1px solid var(--SurfaceLight)",
          borderRadius: 16,
          padding: 28,
          display: "grid",
          gap: 18
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28 }}>Pokemon Duel Men</h1>
        <p style={{ margin: 0, color: "var(--TextSecondary)" }}>
          Login e registro por Google para iniciar suas batalhas.
        </p>
        <GoogleLoginButton />
      </section>
    </main>
  );
}
