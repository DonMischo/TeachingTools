"use client";
import { useState } from "react";
import Link from "next/link";
import { useAvailability } from "@/hooks/useAvailability";
import HelpButton from "@/components/HelpButton";
import { ToolSuche, passtZurSuche } from "@/components/ToolSuche";
import { RequireAccount } from "@/components/RequireAccount";
import { StandaloneDownload } from "@/components/StandaloneDownload";

const ALL_CARDS: { slug: string; href: string; icon: string; title: string; description: string; color: string }[] = [
  {
    slug: "gleichungswaage",
    href: "/simulationen/gleichungswaage",
    icon: "⚖️",
    title: "Gleichungswaage",
    description: "Äquivalenzumformung zum Zusehen — mit x und Klammern, zum Umstellen physikalischer Formeln oder zum Ausgleichen von Reaktionsgleichungen, Atom für Atom.",
    color: "#14b8a6",
  },
  {
    slug: "bildformate",
    href: "/simulationen/bildformate",
    icon: "🖼️",
    title: "Bildformate",
    description: "PBM, PGM und PPM zum Anfassen — Zahlen tippen und das Bild live sehen oder ins Bild klicken und die Zahlen ändern.",
    color: "#f97316",
  },
  {
    slug: "vierecke",
    href: "/simulationen/vierecke",
    icon: "📐",
    title: "Vierecke",
    description: "Sechs Vierecke mit Formeln und Eigenschaften — dazu zwei Aufgaben zum Anfassen: die Weide einzäunen (Umfang) und die Fläche mit Einheitsquadraten auslegen.",
    color: "#8b5cf6",
  },
  {
    slug: "binaerrechner",
    href: "/simulationen/binaerrechner",
    icon: "◈",
    title: "Binär-Rechner",
    description: "Acht Bits zum Umschalten: Stellenwerte addieren sich zum Dezimalwert. Zeigt den Rechenweg und deckt 0 bis 255 ab.",
    color: "#00d4ff",
  },
  {
    slug: "funktionen",
    href: "/simulationen/funktionen",
    icon: "📈",
    title: "Funktionen",
    description: "f(x) eingeben — von der Geraden bis Sinus. Wertetabelle und Graph hängen zusammen: Zeile antippen zeigt den Punkt, und »?« zeigt, wie der Wert entsteht.",
    color: "#22c55e",
  },
  {
    slug: "ki",
    href: "/simulationen/ki",
    icon: "🤖",
    title: "KI-Werkstatt",
    description: "Wie ein Sprachmodell schreibt: Satz zerlegen, im Wortnetz Wort für Wort wählen, den eigenen Text mit der Klasse vergleichen. Dazu der Bilder-Reiter — ein Bild verrauschen und zusehen, wie eines aus Rauschen entsteht.",
    color: "#6366f1",
  },
  {
    slug: "sonnensystem",
    href: "/simulationen/sonnensystem",
    icon: "🪐",
    title: "Sonnensystem",
    description: "Planeten und Monde auf echten Bahnen in 3D, maßstabsgetreue Größen und Entfernungen, Bilder von Hubble, Webb und Raumsonden — und ein Flugmodus mit Pulsantrieb, Scanner und Forschungsaufträgen.",
    color: "#38bdf8",
  },
  {
    slug: "leben",
    href: "/simulationen/leben",
    icon: "🎸",
    title: "Rock your Life",
    description: "Fünf Jahre nach der 10. Klasse in Erfurt: bewerben, Ausbildung, eigene Wohnung, Lohnabrechnung, Steuern, Einkauf, Verträge, Anträge — und was am Monatsende übrig bleibt.",
    color: "#e11d48",
  },
  {
    slug: "kueste",
    href: "/simulationen/kueste",
    icon: "🌊",
    title: "Küstendynamik",
    description: "Steilküste, Flachküste und Deich im Querschnitt: Wellen, Sturmfluten, Kliffabbrüche und Küstenschutz im Zeitraffer. Dazu der Küstenlängsstrom mit Buhnen und Haken und die Gezeiten.",
    color: "#0ea5e9",
  },
  {
    slug: "verkehr",
    href: "/simulationen/verkehr",
    icon: "🚦",
    title: "GTA – Ganztagsaufmerksamkeit im Verkehr – zu Fuß",
    description: "Zu Fuß durchs echte Viertel um die Schule — Ampel, Zebrastreifen, Radweg, Bus und Bahn. Draufsicht wie in einem Spiel, mit Pfeiltasten oder WASD.",
    color: "#f59e0b",
  },
  {
    slug: "abacus",
    href: "/simulationen/abacus",
    icon: "🧮",
    title: "Abakus",
    description: "Rechenrahmen zum Schieben — dieselben Kugeln im Modus »Alle gleich« (bis 100) oder nach Stellenwert. Zeigt den Wert in Ziffern.",
    color: "#ef4444",
  },
];

export default function SimulationenPage() {
  const { can, ready } = useAvailability();
  const [suche, setSuche] = useState("");
  const ERLAUBT = ready ? ALL_CARDS.filter(c => can(c.slug, "use")) : [];
  const CARDS = ERLAUBT.filter(c => passtZurSuche(c, suche));
  return (
    <RequireAccount>
    <div className="flex flex-col gap-8 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-black tracking-tight">🔬 Simulationen</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Modelle zum Anfassen: ausprobieren, verstellen und zusehen, was passiert.
        </p>
      </div>

      <ToolSuche wert={suche} setzen={setSuche} treffer={CARDS.length} gesamt={ERLAUBT.length} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative flex flex-col gap-4 p-6 rounded-2xl border border-[var(--border)]
              bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-all
              hover:border-[var(--accent)] hover:shadow-lg"
          >
            <HelpButton slug={card.slug} className="absolute top-3 right-3" />
            <div className="flex items-center gap-3">
              <span style={{
                fontSize: 40, lineHeight: 1,
                filter: `drop-shadow(0 2px 6px ${card.color}66)`,
              }}>
                {card.icon}
              </span>
              <div>
                <div className="font-black text-lg" style={{ color: card.color }}>
                  {card.title}
                </div>
                <div className="text-xs text-[var(--text-muted)]">→ öffnen</div>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              {card.description}
            </p>
          </Link>
        ))}
      </div>

      <StandaloneDownload name="simulationen" />
    </div>
    </RequireAccount>
  );
}
