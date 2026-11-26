"use client";
/**
 * Main Character: Lebenssimulation bis zum Abschluss 2028.
 *
 * Schüler·innen und Gäste: Start → Fragebogen → Charakterbogen → Spiel (mit
 * Zeugnis am Ende). Lehrkräfte zusätzlich: Vorführung aller Klassen am Beamer
 * und die anonyme Klassenübersicht ihrer Sitzung.
 * Rechnung in lib/mainCharacter.ts, Fragebogen in lib/mainCharacterFragebogen.ts.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { auswerten } from "@/lib/mainCharacterFragebogen";
import { Charakterbogen } from "./Charakterbogen";
import { Demo } from "./Demo";
import { Fragebogen } from "./Fragebogen";
import { Spiel } from "./Spiel";
import { LEER, laden, loeschen, speichern, type Charakter } from "./speicher";
import { Uebersicht } from "./Uebersicht";
import { SimKopf } from "@/components/SimKopf";

type Reiter = "vorfuehren" | "uebersicht" | "selbst";

export default function MainCharacter({ zugang, speicherSchluessel, lehrkraft = false, action }: {
  /** Sitzung (Code + Gast-Token), in die der anonyme Stand geht */
  zugang?: { code: string; token: string | null } | null;
  speicherSchluessel: string;
  lehrkraft?: boolean;
  action?: ReactNode;
}) {
  const [reiter, setReiter] = useState<Reiter>(lehrkraft ? "vorfuehren" : "selbst");
  const { data: eigeneSitzung } = useQuery({
    queryKey: ["main-character-sitzung"],
    queryFn: () => api.toolSessions.create("main-character"),
    enabled: lehrkraft,
  });
  return (
    <div className="mx-auto w-full max-w-[var(--seite-breite)] flex flex-col gap-4 p-4">
      <SimKopf titel="👑 Main Character" action={action}>
        Du entscheidest, wo du beim Abschluss 2028 stehst. NPCs folgen einem Skript — du nicht.
      </SimKopf>
      {lehrkraft && (
        <nav className="flex flex-wrap gap-2 border-b border-line pb-2">
          {([["vorfuehren", "🎬 Vorführen"], ["uebersicht", "👥 Klassenübersicht"], ["selbst", "🧑 Selbst ausprobieren"]] as [Reiter, string][]).map(([id, l]) => (
            <button key={id} type="button" className={reiter === id ? "chip chip-on" : "chip"} onClick={() => setReiter(id)}>{l}</button>
          ))}
        </nav>
      )}
      {reiter === "vorfuehren" && <Demo />}
      {reiter === "uebersicht" && (eigeneSitzung
        ? <Uebersicht code={eigeneSitzung.code} />
        : <p className="card p-4 text-sm">Öffne »Zum Mitmachen« oben, damit deine Klasse über Code oder QR beitritt. Dann erscheint hier die Übersicht.</p>)}
      {reiter === "selbst" && <Spieler zugang={zugang} speicherSchluessel={speicherSchluessel} />}
    </div>
  );
}

function Spieler({ zugang, speicherSchluessel }: { zugang?: { code: string; token: string | null } | null; speicherSchluessel: string }) {
  const [c, setC] = useState<Charakter>(LEER);
  const [geladen, setGeladen] = useState(false);
  // Laden nach dem Einhängen (localStorage gibt es erst im Browser); Schlüssel als Abhängigkeit,
  // damit ein anderer Schlüssel nie den Stand eines anderen überschreibt.
  useEffect(() => { setC(laden(speicherSchluessel)); setGeladen(true); }, [speicherSchluessel]);
  const aendern = (neu: Charakter) => { setC(neu); speichern(speicherSchluessel, neu); };
  if (!geladen) return null;

  if (c.schritt === "fragebogen") {
    return (
      <Fragebogen
        antworten={c.antworten.map(a => a ?? undefined)}
        onAntworten={a => aendern({ ...c, antworten: a.map(x => x ?? null) })}
        onAbbrechen={() => aendern({ ...c, schritt: "start" })}
        onFertig={alle => {
          const e = auswerten(alle);
          aendern({
            ...c, antworten: alle.map(x => x ?? null), klasse: e.klasse, plan: null, schritt: "bogen",
            // vorgeschlagene Stärken sind angekreuzt, Baustellen nur markiert
            profil: { talente: e.talente, staerken: e.staerken, baustellen: c.profil.baustellen },
            vorschlag: { klasse: e.klasse, punkte: e.punkte, staerken: e.staerken, baustellen: e.baustellen },
          });
        }}
      />
    );
  }
  if (c.schritt === "bogen") {
    return <Charakterbogen c={c} onC={aendern} onLos={() => aendern({ ...c, schritt: "spiel" })}
      onFragebogen={() => aendern({ ...c, schritt: "fragebogen" })} />;
  }
  if (c.schritt === "spiel") {
    return <Spiel c={c} onC={aendern} zugang={zugang} onBogen={() => aendern({ ...c, schritt: "bogen" })} />;
  }
  return (
    <section className="card p-6 flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <h2 className="text-xl font-semibold text-balance">Wer bist du — und wer willst du sein?</h2>
      <p>
        Zwölf kurze Fragen aus deinem Alltag. Daraus entsteht dein Charakter: eine Klasse, deine Talente und Stärken.
        Dann spielst du die Wochen bis zum Abschluss 2028 — und entscheidest, wohin du deine Zeit steckst.
      </p>
      <p className="text-sm text-muted">
        Deine Antworten bleiben auf diesem Gerät. In die Klassenübersicht gehen nur deine Klasse und deine Werte, ohne Namen.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => aendern({ ...c, schritt: "fragebogen" })}>Fragebogen starten</button>
        <button type="button" className="btn-secondary" onClick={() => aendern({ ...c, schritt: "bogen" })}>Ohne Fragebogen zum Charakterbogen</button>
        {c.antworten.length > 0 && (
          <button type="button" className="btn-secondary" onClick={() => { loeschen(speicherSchluessel); setC(LEER); }}>Neu anfangen</button>
        )}
      </div>
    </section>
  );
}
