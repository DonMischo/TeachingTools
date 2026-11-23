"use client";
/**
 * Übung für den Einstieg — in Leichter Sprache, eine Aufgabe nach der anderen.
 * Jede Aufgabe schaltet genau einen Knopf frei; alles andere bleibt versteckt,
 * bis die Übung vorbei ist. Der Stand liegt in s.flags.tutorial (Schrittnummer).
 */
import { klon } from "@/lib/leben/kern";
import type { Spielstand } from "@/lib/leben/typen";
import { Knopf } from "./ui";

/** Was die Aufgabe erledigt. »ok« = Knopf »Weiter« auf der Karte. */
export type Tat = "ok" | "haken" | "essen" | "duschen" | "spass" | "bank" | "kauf" | "jobs" | "schlafen" | "zeit";
/** Dinge, die man in einem Haken-Schritt anschauen muss (Maus drüber oder antippen). */
export type Haken = "uhr" | "geld";
/** Knöpfe, die die Übung nach und nach zeigt. »mehr« = erst nach der Übung. */
export type Frei = "essen" | "duschen" | "spass" | "bank" | "raus" | "jobs" | "schlafen" | "zeit" | "mehr";

type Schritt = { icon: string; titel: string; text: string[]; tat: Tat; neu?: Frei; tipp?: string; haken?: { id: Haken; text: string }[] };

export const SCHRITTE: Schritt[] = [
  { icon: "👋", titel: "Hallo!", tat: "ok", text: [
    "Das ist dein Leben im Spiel.",
    "Du bist mit der Schule fertig. Du wohnst noch bei deinen Eltern in Erfurt.",
    "Wir üben jetzt zusammen. Immer nur eine Sache.",
    "Oben auf dieser Karte siehst du, was noch kommt.",
  ] },
  { icon: "📊", titel: "Deine Balken", tat: "ok", text: [
    "Die Balken zeigen, wie es dir geht.",
    "🍽️ Hunger · ⚡ Kraft · 🚿 Sauber sein · 🎮 Spaß",
    "Voll und grün heißt: gut. Leer und rot heißt: schlecht.",
    "Pass gut auf deine Balken auf!",
  ] },
  { icon: "🕒", titel: "Uhr und Geld", tat: "haken", text: [
    "Oben siehst du die Uhr und dein Geld.",
    "Fahr mit der Maus darüber oder tippe darauf. Dann steht da, was es bedeutet.",
  ], haken: [
    { id: "uhr", text: "Fahr mit der Maus über die Uhr 🕒" },
    { id: "geld", text: "Fahr mit der Maus über dein Konto 💶" },
  ] },
  { icon: "🍳", titel: "Essen", tat: "essen", neu: "essen", text: [
    "Iss etwas. Drück unten auf den Knopf 🍳 Essen.",
    "Dann wird der Balken 🍽️ voller.",
  ] },
  { icon: "🚿", titel: "Duschen", tat: "duschen", neu: "duschen", text: [
    "Jetzt wirst du sauber. Drück auf 🚿 Duschen.",
  ] },
  { icon: "🎮", titel: "Spaß haben", tat: "spass", neu: "spass", text: [
    "Drück auf 🎮 Zocken oder auf 📺 Serie.",
    "Dann wird der Balken 🎮 voller.",
  ], tipp: "Jeder Knopf kostet Zeit. Schau mal oben auf die Uhr 🕒." },
  { icon: "🏦", titel: "Dein Geld", tat: "bank", neu: "bank", text: [
    "Rechts ist dein Handy.",
    "Drück im Handy auf 🏦 Bank. Da siehst du dein Geld.",
    "Danach machst du das Fenster mit ✕ wieder zu.",
  ] },
  { icon: "🛒", titel: "Einkaufen", tat: "kauf", neu: "raus", text: [
    "Kauf dir etwas Leckeres.",
    "1. Drück auf 🚪 Raus!",
    "2. Drück auf 🛒 Einkaufen und such dir einen Laden aus.",
    "3. Drück bei einer Sache auf den Knopf +.",
    "4. Drück unten auf »Zur Kasse«.",
  ], tipp: "Du bezahlst mit Bargeld. Du hast 40 € in der Tasche." },
  { icon: "💼", titel: "Arbeit", tat: "jobs", neu: "jobs", text: [
    "Später brauchst du eine Arbeit. Dann verdienst du Geld.",
    "Drück im Handy auf 💼 Jobs und schau dich um.",
    "Du musst dich noch nicht bewerben.",
  ] },
  { icon: "😴", titel: "Schlafen", tat: "schlafen", neu: "schlafen", text: [
    "Wenn du müde bist, musst du schlafen.",
    "Drück auf 😴 Schlafen. Dann ist es wieder Morgen.",
  ] },
  { icon: "⏩", titel: "Zeit vergehen lassen", tat: "zeit", neu: "zeit", text: [
    "Du musst nicht alles selbst drücken.",
    "Drück unten auf ⏩ 1 Tag.",
    "Dann isst, duscht und schläft dein Mensch von allein.",
    "Wenn etwas Wichtiges passiert, hält das Spiel an.",
  ] },
  { icon: "🏆", titel: "Geschafft!", tat: "ok", text: [
    "Super! Du kannst jetzt die wichtigsten Sachen.",
  ] },
];

/** Was nach der Übung dazukommt — damit niemand überrascht wird. */
const DANACH: [string, string][] = [
  ["💼", "Dich bewerben und eine Ausbildung anfangen"],
  ["📬", "Briefe bekommen und Rechnungen bezahlen"],
  ["🏠", "Eine eigene Wohnung suchen und einrichten"],
  ["📄", "Verträge: Handy, Strom, Versicherung"],
  ["🏛️", "Zum Amt gehen und Anträge stellen"],
  ["🧮", "Steuern — da gibt es oft Geld zurück"],
  ["🎉", "Ausgehen, Freunde treffen, Sport machen"],
];

export function tutorialSchritt(s: Spielstand): number | null {
  const t = s.flags.tutorial;
  return typeof t === "number" ? Math.min(t, SCHRITTE.length - 1) : null;
}

/** Ist der Knopf zu sehen? Ohne Übung immer. */
export function frei(s: Spielstand, was: Frei): boolean {
  const i = tutorialSchritt(s);
  if (i === null) return true;
  return SCHRITTE.slice(0, i + 1).some((x) => x.neu === was);
}

/** Ist dieser Haken im aktuellen Schritt gefragt und noch offen? */
export function hakenOffen(s: Spielstand, id: Haken): boolean {
  const i = tutorialSchritt(s);
  return i !== null && !!SCHRITTE[i].haken?.some((h) => h.id === id) && !s.flags[`tut_${id}`];
}

/** Haken setzen; sind alle Haken des Schritts da, geht es weiter. null = nichts zu tun. */
export function tutorialHaken(s: Spielstand, id: Haken): Spielstand | null {
  if (!hakenOffen(s, id)) return null;
  const i = tutorialSchritt(s)!;
  const neu = klon(s);
  neu.flags[`tut_${id}`] = true;
  if (SCHRITTE[i].haken!.every((h) => neu.flags[`tut_${h.id}`])) {
    for (const h of SCHRITTE[i].haken!) delete neu.flags[`tut_${h.id}`];
    neu.flags.tutorial = i + 1;
  }
  return neu;
}

/** Soll der Knopf blinken, weil die Aufgabe ihn gerade braucht? */
export function hervor(s: Spielstand, was: Frei): boolean {
  const i = tutorialSchritt(s);
  return i !== null && SCHRITTE[i].neu === was;
}

/** Nächster Schritt, wenn `tat` die aktuelle Aufgabe erfüllt — sonst null. */
export function tutorialWeiter(s: Spielstand, tat: Tat): Spielstand | null {
  const i = tutorialSchritt(s);
  if (i === null || SCHRITTE[i].tat !== tat || i >= SCHRITTE.length - 1) return null;
  const neu = klon(s);
  neu.flags.tutorial = i + 1;
  return neu;
}

export function tutorialEnde(s: Spielstand): Spielstand {
  const neu = klon(s);
  delete neu.flags.tutorial;
  return neu;
}

export const BLINKEN = "ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-950 animate-pulse";

export function TutorialKarte({ s, onWeiter, onEnde, onNeu }: {
  s: Spielstand; onWeiter: () => void; onEnde: () => void; onNeu: () => void;
}) {
  const i = tutorialSchritt(s);
  if (i === null) return null;
  const x = SCHRITTE[i];
  const letzter = i === SCHRITTE.length - 1;
  const naechster = SCHRITTE[i + 1];
  return (
    <div className="rounded-2xl bg-amber-50 p-3 text-slate-900 shadow-lg ring-4 ring-amber-400 sm:p-4" role="region" aria-label="Übung">
      <ol className="mb-2 flex flex-wrap items-center gap-1" aria-label="Alle Aufgaben">
        {SCHRITTE.map((y, j) => (
          <li key={y.titel} title={y.titel}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-lg ${j < i ? "bg-emerald-500" : j === i ? "bg-amber-400 ring-2 ring-amber-700" : "bg-slate-200 opacity-80"}`}>
            {j < i ? "✓" : y.icon}
          </li>
        ))}
        <li className="ml-auto text-sm font-bold text-slate-600">Aufgabe {i + 1} von {SCHRITTE.length}</li>
      </ol>
      <h2 className="text-2xl font-black">{x.icon} {x.titel}</h2>
      <div className="mt-1 space-y-1 text-lg leading-snug">
        {x.text.map((t) => <p key={t}>{t}</p>)}
      </div>
      {x.haken && (
        <ul className="mt-2 space-y-1" aria-label="Zu erledigen">
          {x.haken.map((h) => {
            const ok = !!s.flags[`tut_${h.id}`];
            return (
              <li key={h.id} className="flex items-center gap-2 text-lg" data-haken={h.id} data-erledigt={ok || undefined}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-md border-2 ${ok ? "border-emerald-600 bg-emerald-500 text-white" : "border-slate-400 bg-white"}`}>{ok ? "✓" : ""}</span>
                <span className={ok ? "text-slate-500 line-through" : ""}>{h.text}</span>
              </li>
            );
          })}
        </ul>
      )}
      {x.tipp && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-base">💡 {x.tipp}</p>}
      {letzter && (
        <div className="mt-3 rounded-xl bg-white p-3">
          <div className="mb-1 text-lg font-black">Im richtigen Spiel kommt noch dazu:</div>
          <ul className="space-y-1 text-base">
            {DANACH.map(([icon, t]) => <li key={t}><span className="mr-2 text-xl">{icon}</span>{t}</li>)}
          </ul>
          <p className="mt-2 text-base">Keine Angst: Im Handy steht immer <b>📋 Nächste Schritte</b>. Da steht, was du als Nächstes machen sollst.</p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {x.tat === "ok" && !letzter && <Knopf art="haupt" onClick={onWeiter}>Weiter ▶</Knopf>}
        {letzter && <Knopf art="haupt" onClick={onEnde}>▶ Weiterspielen — mit allen Knöpfen</Knopf>}
        {letzter && <Knopf onClick={onNeu}>🔄 Echtes Leben neu anfangen</Knopf>}
        {naechster && <span className="text-base text-slate-600">Danach kommt: {naechster.icon} {naechster.titel}</span>}
        {!letzter && <button type="button" onClick={onEnde} className="ml-auto text-sm text-slate-500 underline hover:text-slate-800">Übung beenden</button>}
      </div>
    </div>
  );
}
