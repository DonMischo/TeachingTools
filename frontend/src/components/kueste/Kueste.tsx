"use client";
/**
 * Küstendynamik — wie bewegtes Wasser unsere Küsten formt, und was
 * Menschen dagegen (und damit) tun.
 *
 * Vier Reiter:
 *   Querschnitt — Flachküste, Steilküste, Marsch mit Deich; Wellen,
 *                 Sturmfluten, Erosion und Schutzmaßnahmen im Zeitraffer
 *   Draufsicht  — Küstenlängsstrom, Buhnen, Haken (Ausgleichsküste)
 *   Gezeiten    — Mond, Flutberge, Pegelkurve, Watt
 *   Wissen      — Begriffe, Küstenschutz im Überblick, Quellen
 *
 * Grundlage sind die Geografie-Materialien Klasse 5/6 (Steil- und
 * Flachküste, Ebbe/Flut-Stationen, Küstenschutz).
 */
import { useState, type ReactNode } from "react";
import ProfilAnsicht from "./ProfilAnsicht";
import Draufsicht from "./Draufsicht";
import Gezeiten from "./Gezeiten";

type Reiter = "profil" | "draufsicht" | "gezeiten" | "wissen";

const REITER: { id: Reiter; icon: string; label: string }[] = [
  { id: "profil", icon: "🏖️", label: "Querschnitt" },
  { id: "draufsicht", icon: "🧭", label: "Draufsicht" },
  { id: "gezeiten", icon: "🌙", label: "Gezeiten" },
  { id: "wissen", icon: "📘", label: "Wissen" },
];

export default function Kueste({ action }: { action?: ReactNode }) {
  const [reiter, setReiter] = useState<Reiter>("profil");
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🌊 Küstendynamik</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Wie Wellen, Strömung, Wind und Gezeiten unsere Küsten formen — und wie Menschen sie schützen.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      <div className="inline-flex flex-wrap self-start rounded-xl border border-[var(--border)] p-1 bg-[var(--surface)]">
        {REITER.map(r => (
          <button key={r.id} onClick={() => setReiter(r.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              reiter === r.id ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            {r.icon} {r.label}
          </button>
        ))}
      </div>

      {reiter === "profil" && <ProfilAnsicht />}
      {reiter === "draufsicht" && <Draufsicht />}
      {reiter === "gezeiten" && <Gezeiten />}
      {reiter === "wissen" && <Wissen />}
    </div>
  );
}

function Karte({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed flex flex-col gap-2">
      <h3 className="font-black text-base">{titel}</h3>
      {children}
    </section>
  );
}

function Wissen() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Karte titel="🪨 Steilküste und 🏖️ Flachküste">
        <p><b>Steilküste:</b> Das Land endet mit einer steilen Wand, dem <b>Kliff</b>. Die Brandung frisst unten eine <b>Brandungshohlkehle</b> hinein; Regen, Frost und Wurzeln lockern die Wand. Irgendwann stürzt sie ab. Das Material bleibt als <b>Kliffhalde</b> liegen, bis das Meer es fortspült — nur große Steine bleiben als <b>Blockstrand</b>. Übrig bleibt die flach abgeschliffene <b>Abrasionsplattform</b>. Beispiel: Kap Arkona und Jasmund auf Rügen.</p>
        <p><b>Flachküste:</b> Das Land geht flach ins Meer über. Unter Wasser liegen <b>Sandriffe</b>, an denen die Wellen brechen (<b>Brecherzone</b>), dann rollen sie als Schaumwalzen an den Strand (<b>Rollerzone</b>) und laufen im <b>Spülsaum</b> aus. Der Wind weht Sand zu <b>Dünen</b> auf. Beispiel: Sylt, Usedom.</p>
      </Karte>
      <Karte titel="💧 Erosion — was trägt ab?">
        <p><b>Erosion</b> ist die natürliche Abtragung durch Wasser, Wind, Frost und Eis. An der Küste arbeiten:</p>
        <ul className="list-disc pl-5">
          <li><b>Brandung</b>: Wellen schlagen gegen Kliff, Düne oder Deich.</li>
          <li><b>Strömung</b>: Der Küstenlängsstrom trägt Sand an der Küste entlang fort.</li>
          <li><b>Sturmfluten</b>: Der Sturm drückt das Wasser meterhoch gegen die Küste — dann erreichen die Wellen Stellen, die sonst sicher sind.</li>
          <li><b>Wind</b>: weht trockenen Sand landeinwärts.</li>
          <li><b>Frost und Regen</b>: sprengen und weichen die Kliffwand auf.</li>
        </ul>
        <p>Was an einer Stelle abgetragen wird, lagert sich woanders ab: im Sandriff, am Haken, in der Düne.</p>
      </Karte>
      <Karte titel="🌙 Gezeiten in Kürze">
        <p>Der Mond zieht am Wasser der Erde: Es entstehen zwei <b>Flutberge</b>. Die Erde dreht sich darunter hindurch — deshalb kommt an der Nordsee etwa alle 12 Stunden 25 Minuten Hochwasser. <b>Flut</b> = das Wasser steigt, <b>Ebbe</b> = es fällt; der Unterschied zwischen Hoch- und Niedrigwasser ist der <b>Tidenhub</b> (Nordsee 2–4 m, Ostsee nur wenige Zentimeter).</p>
        <p>Bei Ebbe fällt an der Nordsee das <b>Watt</b> trocken. Durch die <b>Priele</b> kommt die Flut zuerst zurück — Wattwanderungen nur mit Führung!</p>
      </Karte>
      <Karte titel="🏗️ Küstenschutz im Überblick">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[var(--text-muted)]"><th className="pr-2">Maßnahme</th><th className="pr-2">schützt vor</th><th>Nachteil</th></tr></thead>
            <tbody className="align-top">
              <tr><td className="pr-2 py-1"><b>Deich</b></td><td className="pr-2">Überflutung bei Sturmflut</td><td>teuer, muss mit dem Meeresspiegel wachsen</td></tr>
              <tr><td className="pr-2 py-1"><b>Sandaufspülung</b></td><td className="pr-2">Strandverlust</td><td>muss regelmäßig wiederholt werden</td></tr>
              <tr><td className="pr-2 py-1"><b>Dünen + Strandhafer</b></td><td className="pr-2">Wind, Überflutung</td><td>empfindlich gegen Betreten</td></tr>
              <tr><td className="pr-2 py-1"><b>Buhnen</b></td><td className="pr-2">Sandverlust durch Längsstrom</td><td>Lee-Erosion dahinter</td></tr>
              <tr><td className="pr-2 py-1"><b>Deckwerk, Tetrapoden</b></td><td className="pr-2">Brandung am Fuß</td><td>Strand davor verschwindet</td></tr>
              <tr><td className="pr-2 py-1"><b>Lahnungen</b></td><td className="pr-2">Wellen am Deich (Vorland)</td><td>langsam, Pflege nötig</td></tr>
            </tbody>
          </table>
        </div>
        <p>Der Meeresspiegel steigt. Deshalb bekommen neue Deiche an der Nordsee einen Klimazuschlag und eine breite Krone, damit man sie später erhöhen kann.</p>
      </Karte>
      <Karte titel="🔎 Wie genau ist das Modell?">
        <p>Die Simulation ist ein Schulmodell. Sie zeigt die Zusammenhänge richtig und rechnet mit echten Größenordnungen (Tidenhub, Deichmaße, Sandmengen), aber nicht für einen bestimmten Strand. Höhen sind im Querschnitt stark überzeichnet.</p>
        <p>Im Modell stecken bekannte Faustregeln: Wellen brechen, wenn das Wasser etwa so tief ist wie die Welle hoch; gebrochene Wellen verlieren weiter Kraft (Dally-Modell); ein Strand strebt ein Gleichgewichtsprofil an (Dean-Profil); der Längstransport wächst mit Wellenhöhe und Einfallswinkel (CERC-Formel).</p>
      </Karte>
      <Karte titel="📚 Quellen">
        <ul className="list-disc pl-5 text-xs flex flex-col gap-1">
          <li>Land Schleswig-Holstein: Sandvorspülungen auf Sylt (Pressemitteilung 18.02.2025) — 61,3 Mio. m³ und rund 289 Mio. € seit 1972.</li>
          <li>Wikipedia: Deich; Bundesanstalt für Wasserbau: Außenböschungen von Seedeichen — Regelprofil 1:6 / 1:3, Kleidecke 1–1,5 m.</li>
          <li>hamburg.de: Hamburger Sturmflut 1962 — 5,70 m über NN am Pegel St. Pauli.</li>
          <li>Presseberichte zum Kliffabbruch am Kap Arkona nach der Sturmflut im Oktober 2023.</li>
          <li>Lebensraum Wattenmeer: Landgewinnung und Deichbau (Lahnungen, Salzwiese).</li>
          <li>Unterrichtsmaterial Geografie Klasse 5/6: Steilküste, Flachküste, Stationsarbeit Ebbe, Flut und Watt.</li>
        </ul>
      </Karte>
    </div>
  );
}
