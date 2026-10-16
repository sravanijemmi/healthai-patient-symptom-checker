import { HomeClient } from "@/components/HomeClient";

export default function HomePage() {
  return (
    <main className="page">
      <header className="hero">
        <div className="hero-copy">
          <p className="brand">HealthAI</p>
          <h1>Preliminary guidance from the symptoms you describe.</h1>
          <p className="hero-sub">
            Enter how you feel. We clean common misspellings, ask a language
            model for possible conditions, and show a clear summary you can
            discuss with a clinician.
          </p>
          <p className="hero-note">
            Not a diagnosis. For emergencies, call local emergency services.
          </p>
        </div>
      </header>

      <HomeClient />

      <footer className="site-footer">
        <p>HealthAI · fictional telehealth demo for the AidenAI build round</p>
      </footer>
    </main>
  );
}
