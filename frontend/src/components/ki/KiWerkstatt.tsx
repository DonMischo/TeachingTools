"use client";
/**
 * Die KI-Werkstatt — zwei Reiter, eine Aussage.
 *
 *   🔤 Sprachmodell  Ein Text entsteht Wort für Wort aus Wahrscheinlichkeiten.
 *   🖼️ Bilder        Ein Bild entsteht Schritt für Schritt aus Rauschen.
 *
 * Beide Hälften laufen auf denselben Kern hinaus: es wird gewürfelt, und der
 * Startwert des Würfels entscheidet über das Ergebnis. Deshalb teilen sie sich
 * auch einen: der Fingerabdruck des geschriebenen Textes wird zum Seed des
 * Rauschens. Und deshalb ist es *ein* Werkzeug mit einem Code — wer den QR
 * scannt, kommt in beide Hälften.
 */
import { useEffect, useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Sprachmodell } from "@/components/ki/Sprachmodell";
import { Bilder } from "@/components/ki/Bilder";
import { Lernen } from "@/components/ki/Lernen";
import { EchtOderKi } from "@/components/ki/EchtOderKi";
import { SimKopf } from "@/components/SimKopf";

/** Woran die Tafel hängt: der Sitzungscode und, bei Gästen, ihr Token. */
export type KiZugang = { code: string; token?: string | null; name?: string };

type Reiter = "sprache" | "bilder" | "lernen" | "echt";

/**
 * `vorgabe` (TaskCrawler-Station): `{ reiter: "sprache" | "bilder" | "lernen" | "echt" }`
 * legt den Reiter fest und blendet die Reiterleiste aus.
 */
export default function KiWerkstatt({ action, zugang, vorgabe }: {
  action?: ReactNode;
  vorgabe?: Vorgabe;
  zugang?: KiZugang;
}) {
  const { auth } = useAuth();
  const festerReiter = wahl(vorgabe, "reiter", ["sprache", "bilder", "lernen", "echt"] as const);
  const [reiter, setReiter] = useState<Reiter>(festerReiter ?? "sprache");
  const [signatur, setSignatur] = useState<string | null>(null);
  const [eigene, setEigene] = useState<KiZugang | undefined>(undefined);

  const istLehrkraft = auth?.role === "teacher" || auth?.role === "admin";
  const name = zugang?.name
    ?? auth?.student?.display_name
    ?? (auth?.teacher ? `${auth.teacher.first_name} ${auth.teacher.last_name}`.trim() : undefined);

  // Auf der eigenen Werkzeugseite gibt es keinen Code aus der Adresszeile. Für
  // die Tafel holt die Lehrkraft sich deshalb ihren eigenen — derselbe, den
  // auch »Zum Mitmachen« ausgibt, das Anlegen wiederholt sich nicht.
  useEffect(() => {
    if (zugang?.code || eigene || !istLehrkraft) return;
    let abbruch = false;
    api.toolSessions.create("ki")
      .then(s => { if (!abbruch) setEigene({ code: s.code }); })
      .catch(() => { /* ohne Code bleibt die Tafel eben aus */ });
    return () => { abbruch = true; };
  }, [zugang?.code, eigene, istLehrkraft]);

  // Der Name ist nur der Vorschlag im Feld: Gäste bringen ihn vom Beitritt mit,
  // Angemeldete aus ihrem Konto — geändert werden darf er trotzdem.
  const tafelZugang = zugang
    ? { ...zugang, name: zugang.name ?? name }
    : eigene ? { ...eigene, name } : undefined;

  return (
    <div className="flex flex-col gap-5 p-6 max-w-seite mx-auto w-full">
      <SimKopf titel="🤖 KI-Werkstatt" action={action}>
        Vier Reiter zum Anfassen: Wörter würfeln, Bilder aus Rauschen holen, eine Maschine
        anlernen — und zum Schluss die Probe aufs Exempel. Alle zeigen dasselbe: Es wird
        gerechnet, nicht gedacht.
      </SimKopf>

      {!festerReiter && <div className="flex gap-2 flex-wrap">
        <Knopf an={reiter === "sprache"} onClick={() => setReiter("sprache")}>🔤 Sprachmodell</Knopf>
        <Knopf an={reiter === "bilder"} onClick={() => setReiter("bilder")}>🖼️ Bilder</Knopf>
        <Knopf an={reiter === "lernen"} onClick={() => setReiter("lernen")}>🧠 Lernen</Knopf>
        <Knopf an={reiter === "echt"} onClick={() => setReiter("echt")}>🕵️ Echt oder KI</Knopf>
      </div>}

      {/* Beide Reiter bleiben montiert: ein Text, an dem zehn Minuten gewählt
          wurde, darf nicht verschwinden, weil jemand kurz zu den Bildern schaut. */}
      <div hidden={reiter !== "sprache"}>
        <Sprachmodell zugang={tafelZugang} onSignatur={setSignatur} />
      </div>
      <div hidden={reiter !== "bilder"}>
        <Bilder signatur={signatur} />
      </div>
      <div hidden={reiter !== "lernen"}>
        <Lernen />
      </div>
      <div hidden={reiter !== "echt"}>
        <EchtOderKi zugang={tafelZugang} />
      </div>
    </div>
  );
}

function Knopf({ an, onClick, children }: { an: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3.5 py-1.5 text-sm font-bold transition-colors ${
        an
          ? "border-accent bg-accent text-accent-fg"
          : "border-line bg-surface hover:bg-surface-hover"
      }`}
    >
      {children}
    </button>
  );
}
