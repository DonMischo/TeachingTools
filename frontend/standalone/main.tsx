/**
 * Die Simulationen als eine Datei zum Mitnehmen.
 *
 * Genau dieselben Komponenten wie in der App — sie kennen weder Server noch
 * Anmeldung, deshalb läuft hier alles im Browser. Was fehlt, ist der
 * Beitritts-Code samt QR: dafür bräuchte es die App. Gebaut wird das über
 * `npm run build:standalone`.
 */
import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { WaageStyles } from "@/components/waage/Balance";
import Gleichungswaage from "@/components/waage/Gleichungswaage";
import Abakus from "@/components/simulationen/Abakus";
import Bildformate from "@/components/simulationen/Bildformate";
import Vierecke from "@/components/simulationen/Vierecke";
import Binaerrechner from "@/components/simulationen/Binaerrechner";
import Funktionen from "@/components/simulationen/Funktionen";
import Rechenregeln from "@/components/simulationen/Rechenregeln";
import KiWerkstatt from "@/components/ki/KiWerkstatt";

const TOOLS: { id: string; icon: string; label: string; node: ReactNode }[] = [
  { id: "waage", icon: "⚖️", label: "Gleichungswaage", node: <Gleichungswaage /> },
  { id: "abakus", icon: "🧮", label: "Abakus", node: <Abakus /> },
  { id: "bildformate", icon: "🖼️", label: "Bildformate", node: <Bildformate /> },
  { id: "vierecke", icon: "📐", label: "Vierecke", node: <Vierecke /> },
  { id: "binaer", icon: "◈", label: "Binär-Rechner", node: <Binaerrechner /> },
  { id: "funktionen", icon: "📈", label: "Funktionen", node: <Funktionen /> },
  { id: "rechenregeln", icon: "🍎", label: "Rechenregeln", node: <Rechenregeln /> },
  // Ohne Sitzung: der Vergleich mit der Klasse bleibt aus, alles andere rechnet im Browser.
  { id: "ki", icon: "🤖", label: "KI-Werkstatt", node: <KiWerkstatt /> },
];

function App() {
  const [active, setActive] = useState(TOOLS[0].id);
  const [hell, setHell] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = hell ? "hell" : "dunkel";
  }, [hell]);

  return (
    <div className="min-h-screen flex flex-col">
      <WaageStyles />

      <header className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
        <span className="font-black tracking-tight mr-2">🔬 Simulationen</span>
        <div className="inline-flex rounded-xl border border-[var(--border)] p-1">
          {TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                active === t.id
                  ? "bg-[var(--accent)] text-[var(--accent-text,#111)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {t.icon} <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setHell(v => !v)}
          title="Zwischen hell und dunkel wechseln"
          className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]"
        >
          {hell ? "🌙 Dunkel" : "☀️ Hell"}
        </button>
      </header>

      <main className="flex-1">
        {TOOLS.map(t => (
          // Alle Werkzeuge bleiben im Baum: wer zwischendurch umschaltet,
          // findet seine Gleichung hinterher noch vor.
          <div key={t.id} hidden={active !== t.id}>
            {t.node}
          </div>
        ))}
      </main>

      <footer className="px-4 sm:px-6 py-3 text-xs text-[var(--text-muted)] border-t border-[var(--border)]">
        Offline-Fassung der Simulationen aus TT - Teaching Tools — läuft ohne Internet und ohne Anmeldung.
        Nichts wird gespeichert oder verschickt.
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
