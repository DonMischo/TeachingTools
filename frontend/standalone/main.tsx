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
import FunktionenWerkzeug from "@/components/simulationen/FunktionenWerkzeug";
import Rechenregeln from "@/components/simulationen/Rechenregeln";
import KiWerkstatt from "@/components/ki/KiWerkstatt";
import RockYourLife from "@/components/leben/RockYourLife";
import Leviathan from "@/components/leviathan/Leviathan";
import Kueste from "@/components/kueste/Kueste";
import ErdAufbau from "@/components/erde/ErdAufbau";
import WilsonZyklus from "@/components/wilson/WilsonZyklus";
import RegelLabor from "@/components/regeln/RegelLabor";
import Wellenkollaps from "@/components/wfc/Wellenkollaps";
import Algorithmen from "@/components/algo/Algorithmen";
import Wachstum from "@/components/dla/Wachstum";
import Schichtenmodell from "@/components/schichten/Schichtenmodell";

const TOOLS: { id: string; icon: string; label: string; node: ReactNode }[] = [
  { id: "waage", icon: "⚖️", label: "Gleichungswaage", node: <Gleichungswaage /> },
  { id: "abakus", icon: "🧮", label: "Abakus", node: <Abakus /> },
  { id: "bildformate", icon: "🖼️", label: "Bildformate", node: <Bildformate /> },
  { id: "vierecke", icon: "📐", label: "Vierecke", node: <Vierecke /> },
  { id: "binaer", icon: "◈", label: "Binär-Rechner", node: <Binaerrechner /> },
  { id: "funktionen", icon: "📈", label: "Funktionen und Koordinatensystem", node: <FunktionenWerkzeug /> },
  { id: "rechenregeln", icon: "🍎", label: "Rechenregeln", node: <Rechenregeln /> },
  // Ohne Sitzung: der Vergleich mit der Klasse bleibt aus, alles andere rechnet im Browser.
  { id: "ki", icon: "🤖", label: "KI-Werkstatt", node: <KiWerkstatt /> },
  // Ohne Sitzung keine Lehrer-Übersicht; Spielstand im Browser bzw. als JSON-Datei.
  { id: "leben", icon: "🎸", label: "Rock your Life", node: <RockYourLife speicherSchluessel="standalone" /> },
  // Ohne Sitzung keine Vorgabe der Lehrkraft; die Krisenstufe ist frei wählbar.
  { id: "leviathan", icon: "🐋", label: "Leviathan", node: <Leviathan speicherSchluessel="standalone" /> },
  { id: "kueste", icon: "🌊", label: "Küstendynamik", node: <Kueste /> },
  { id: "erdaufbau", icon: "🌍", label: "Aufbau der Erde", node: <ErdAufbau /> },
  { id: "wilson", icon: "🌋", label: "Wilson-Zyklus", node: <WilsonZyklus /> },
  { id: "regeln", icon: "🧬", label: "Regel-Labor", node: <RegelLabor /> },
  { id: "wfc", icon: "🧩", label: "Wellenfunktionskollaps", node: <Wellenkollaps /> },
  { id: "algo", icon: "🔀", label: "Algorithmen", node: <Algorithmen /> },
  { id: "dla", icon: "🪸", label: "Fraktales Wachstum", node: <Wachstum /> },
  { id: "schichten", icon: "📶", label: "Schichtenmodell", node: <Schichtenmodell /> },
];

function App() {
  const [active, setActive] = useState(TOOLS[0].id);
  const [hell, setHell] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = hell ? "ege" : "default";
  }, [hell]);

  return (
    <div className="min-h-screen flex flex-col">
      <WaageStyles />

      <header className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-line bg-surface">
        <span className="font-black tracking-tight mr-2">🔬 Simulationen</span>
        <div className="inline-flex flex-wrap max-w-full rounded-xl border border-line p-1">
          {TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                active === t.id
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:text-fg"
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
          className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent"
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

      <footer className="px-4 sm:px-6 py-3 text-xs text-muted border-t border-line">
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
