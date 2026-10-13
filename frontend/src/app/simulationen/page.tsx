"use client";
import { useState } from "react";
import Link from "next/link";
import { useAvailability } from "@/hooks/useAvailability";
import HelpButton from "@/components/HelpButton";
import { ToolSuche, passtZurSuche } from "@/components/ToolSuche";
import { RequireAccount } from "@/components/RequireAccount";
import { StandaloneDownload } from "@/components/StandaloneDownload";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { FachEditor, FachFilter, FachSchild } from "@/components/Faecher";
import { alleFaecher, faecherFuer, istVonHand, passtZumFach } from "@/lib/faecher";

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
    title: "Funktionen und Koordinatensystem",
    description: "f(x) eingeben — von der Geraden bis Sinus, Wertetabelle und Graph hängen zusammen. Dazu der Koordinaten-Lauf: Punkte, Figuren, Spiegelbilder und Geraden im Jump'n'Run setzen.",
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
    slug: "leviathan",
    href: "/simulationen/leviathan",
    icon: "🐋",
    title: "Leviathan – Kunst des Regierens",
    description: "Regiere ein erfundenes Land durch Krisen, Wahlen und Rückkopplungen: Bildung, Vertrauen, Desinformation, Klima und Bevölkerung hängen zusammen. Neun Ländertypen, rund 70 Schocks, die Leviathan-Anzeige — und jede Regel mit Quelle.",
    color: "#0f766e",
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
    slug: "erdaufbau",
    href: "/simulationen/erdaufbau",
    icon: "🌍",
    title: "Aufbau der Erde",
    description: "Die Erde im Keilschnitt: Schalen abziehen, Temperatur, Druck, Dichte und Zähigkeit bis zum Kern, Erdbebenwellen mit Schattenzonen und ein echter Löser für die Mantelkonvektion.",
    color: "#ea580c",
  },
  {
    slug: "wilson",
    href: "/simulationen/wilson",
    icon: "🌋",
    title: "Wilson-Zyklus",
    description: "Ein Superkontinent zerbricht, ein Ozean öffnet sich mit Magnetstreifen, wird verschluckt und endet als Gebirge — ein ganzer Zyklus im Zeitraffer, mit Quiz.",
    color: "#7c3aed",
  },
  {
    slug: "wfc",
    href: "/simulationen/wfc",
    icon: "🧩",
    title: "Wellenfunktionskollaps",
    description: "Wave Function Collapse: Aus Nachbarschaftsregeln wächst ein Bild, das überall passt — mit Kacheln (Landschaft, Straßen & Flüsse, Rohre) oder aus einer selbst gemalten Vorlage. Zellen vorab festlegen, und WFC füllt den Rest.",
    color: "#0ea5e9",
  },
  {
    slug: "schichten",
    href: "/simulationen/schichten",
    icon: "📶",
    title: "Schichtenmodell",
    description: "Ein Katzenfoto reist von Erfurt nach Tokio: durch alle OSI- bzw. TCP/IP-Schichten hinunter, über Router und Seekabel, und wieder hinauf — mit echten Bytes, Prüfsummen und Verschlüsselung. Dazu eine Mission (Wort → ASCII → Bits → DNS → Routing) und Fehlersuche.",
    color: "#6366f1",
  },
  {
    slug: "dla",
    href: "/simulationen/dla",
    icon: "🪸",
    title: "Fraktales Wachstum",
    description: "Wandern, dann haften: Aus zufällig umherirrenden Teilchen wachsen Äste wie bei Korallen, Eisblumen und Blitzen — in 2D und 3D mit bis zu 500 000 Teilchen, Haftwahrscheinlichkeit zum Drehen und fraktaler Dimension live gemessen.",
    color: "#14b8a6",
  },
  {
    slug: "pse",
    href: "/simulationen/pse",
    icon: "🧪",
    title: "Periodensystem",
    description: "Alle 118 Elemente zum Anklicken: Steckbrief mit Foto der Stoffprobe, Kenndaten und Elektronenkonfiguration — dazu die typischen Reaktionen, die mit einem Klick in der Gleichungswaage landen.",
    color: "#22c55e",
  },
  {
    slug: "atommodelle",
    href: "/simulationen/atommodelle",
    icon: "⚛️",
    title: "Atommodelle",
    description: "Wie stellt man sich ein Atom vor? Fünf Modelle nacheinander — vom Teilchenmodell bis zu den Orbitalen, jedes erklärt mehr als das vorige. Dazu das Bindungslabor: bis zu acht Atome zusammenstecken und zusehen, wie die gemeinsamen Elektronen um beide Kerne laufen.",
    color: "#8b5cf6",
  },
  {
    slug: "strukturformeln",
    href: "/simulationen/strukturformeln",
    icon: "⬡",
    title: "Strukturformeln",
    description: "IUPAC-Namen eintippen und die Strukturformel entsteht beim Tippen: Skelett- oder Valenzstrichformel, alle H-Atome, freie Elektronenpaare, drehen und spiegeln — dazu Summenformel und molare Masse.",
    color: "#0ea5e9",
  },
  {
    slug: "algo",
    href: "/simulationen/algo",
    icon: "🔀",
    title: "Algorithmen-Werkstatt",
    description: "Einstieg in Algorithmen (Kl. 5/6): Schritte für Automaten ordnen, die ein Roboter wörtlich ausführt, Flussdiagramme bauen und ablaufen lassen, dann 23 Level Code-Abenteuer mit Kacheln oder Blöcken — Bug-Jagd, Verlies, Mars oder Labyrinthien.",
    color: "#06b6d4",
  },
  {
    slug: "regeln",
    href: "/simulationen/regeln",
    icon: "🧬",
    title: "Regel-Labor",
    description: "Ein paar Ersetzungsregeln auf einem Raster — und daraus wachsen Labyrinthe, Muster und Grundrisse. Lehrgang in fünf Stationen, Rätsel mit Regel-Limit und freies Labor.",
    color: "#e11d48",
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
  {
    slug: "groessen",
    href: "/simulationen/groessen",
    icon: "🪜",
    title: "Größen & Einheiten",
    description: "Länge, Fläche, Volumen, Gewicht, Zeit, Euro und Dollar umrechnen — Einheitenleiter wie auf dem Merkblatt, ein Tipp auf eine Einheit zeigt alle Wege. Dazu Alltagsbeispiele (wie lang ist 1 km?) und warum aus · 10 bei Flächen · 100 und bei Körpern · 1 000 wird.",
    color: "#0ea5e9",
  },
  {
    slug: "rechenzeichen",
    href: "/simulationen/rechenzeichen",
    icon: "➗",
    title: "Rechenzeichen",
    description: "Was heißen + − · : ² ³ √ < > ≤ ≥ — und ∫ und f′? Äpfel dazulegen und wegnehmen, Reihen legen, auf Teller verteilen, Quadrate und Würfel aus Kästchen, der Zahlenstrahl, Streifen unter der Kurve und die Tangente.",
    color: "#f43f5e",
  },
  {
    slug: "rechenregeln",
    href: "/simulationen/rechenregeln",
    icon: "🍎",
    title: "Rechenregeln",
    description: "Punkt vor Strich zum Ansehen: »3 · 4« sind drei Körbe mit je vier Äpfeln, Klammern sind Kisten. Dazu der Rechenzug zum Vertauschen und die Stufenzahl-Rutsche — mal wie geteilt, auch mit Komma. Eigenes Ergebnis eintippen, prüfen lassen, Treffer zählen.",
    color: "#e11d48",
  },
  {
    slug: "tippen",
    href: "/simulationen/tippen",
    icon: "⌨️",
    title: "Tippen",
    description: "Zehnfingersystem üben: Lektionen mit Fingeranzeige, Wortregen und Tastenjagd — dazu das Klassenrennen »Wettschreiben« über Code/QR.",
    color: "#38bdf8",
  },
  {
    slug: "maus",
    href: "/simulationen/maus",
    icon: "🐭",
    title: "Maus-Führerschein",
    description: "Grundkurs am Computer: Klicken, Doppelklick, Rechtsklick, Ziehen, Markieren, Kopieren und Speichern — in sieben Stufen mit Vorführung und Bestenliste.",
    color: "#fb7185",
  },
];

export default function SimulationenPage() {
  const { can, ready } = useAvailability();
  const { isAdmin } = useAdminAccess();
  const qc = useQueryClient();
  const [suche, setSuche] = useState("");
  const [faecherFilter, setFaecherFilter] = useState<string[]>([]);
  const [bearbeiten, setBearbeiten] = useState(false);
  const { data: vonHandDaten } = useQuery({ queryKey: ["tool-faecher"], queryFn: api.school.toolFaecher, staleTime: 60_000 });
  const vonHand = vonHandDaten?.faecher;
  const setzen = useMutation({
    mutationFn: ({ slug, faecher }: { slug: string; faecher: string[] | null }) => api.school.setToolFaecher(slug, faecher),
    onSuccess: d => qc.setQueryData(["tool-faecher"], d),
  });

  const ERLAUBT = (ready ? ALL_CARDS.filter(c => can(c.slug, "use")) : [])
    .map(c => ({ ...c, faecher: faecherFuer(c.slug, vonHand) }));
  const ALLE_FAECHER = alleFaecher(ERLAUBT.map(c => c.faecher));
  // Die Suche findet auch das Fach; der Filter wählt eines oder mehrere.
  const CARDS = ERLAUBT.filter(c =>
    passtZurSuche({ title: c.title, description: `${c.description} ${c.faecher.join(" ")}` }, suche)
    && passtZumFach(c.faecher, faecherFilter));
  const nurDieses = (f: string) => setFaecherFilter(alt => alt.length === 1 && alt[0] === f ? [] : [f]);

  return (
    <RequireAccount>
    <div className="flex flex-col gap-8 p-6 max-w-seite mx-auto w-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🔬 Simulationen</h1>
          <p className="text-muted text-sm mt-1">
            Modelle zum Anfassen: ausprobieren, verstellen und zusehen, was passiert.
          </p>
        </div>
        {isAdmin && (
          <button type="button" onClick={() => setBearbeiten(b => !b)}
            className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg border ${bearbeiten
              ? "bg-accent text-accent-fg border-transparent"
              : "border-line text-muted hover:text-fg"}`}>
            {bearbeiten ? "✓ Fertig" : "🏷️ Fächer bearbeiten"}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <ToolSuche wert={suche} setzen={setSuche} treffer={CARDS.length} gesamt={ERLAUBT.length} />
        <FachFilter faecher={ALLE_FAECHER} gewaehlt={faecherFilter} setzen={setFaecherFilter} />
        {bearbeiten && (
          <p className="text-xs text-muted">
            Fächer gelten für die ganze Schule. Eigene Fächer einfach eintippen; ↺ stellt die Voreinstellung wieder her.
          </p>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
        {CARDS.map(card => {
          const inhalt = (
            <>
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
                  <div className="text-xs text-muted">→ öffnen</div>
                </div>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                {card.description}
              </p>
              {bearbeiten ? (
                <FachEditor faecher={card.faecher} vonHand={istVonHand(card.slug, vonHand)} vorschlaege={ALLE_FAECHER}
                  beschaeftigt={setzen.isPending}
                  speichern={f => setzen.mutate({ slug: card.slug, faecher: f })}
                  zuruecksetzen={() => setzen.mutate({ slug: card.slug, faecher: null })} />
              ) : card.faecher.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {card.faecher.map(f => (
                    <FachSchild key={f} name={f} aktiv={faecherFilter.includes(f)} onClick={() => nurDieses(f)} />
                  ))}
                </div>
              )}
            </>
          );
          const stil = `group relative flex flex-col gap-4 p-6 rounded-2xl border border-line
              bg-surface transition-all`;
          // Beim Bearbeiten keine Links — sonst öffnet jeder Klick ins Eingabefeld die Simulation.
          return bearbeiten ? (
            <div key={card.href} className={stil}>{inhalt}</div>
          ) : (
            <Link key={card.href} href={card.href}
              className={`${stil} hover:bg-surface-hover hover:border-accent hover:shadow-lg`}>
              {inhalt}
            </Link>
          );
        })}
      </div>

      <StandaloneDownload name="simulationen" />
    </div>
    </RequireAccount>
  );
}
