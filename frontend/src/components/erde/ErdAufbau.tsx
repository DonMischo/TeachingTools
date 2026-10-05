"use client";
/**
 * Aufbau der Erde — Schalenbau, Stoffe und Zustände, und woher wir das wissen.
 *
 * Reiter:
 *   Keilschnitt     — 3D-Erde mit herausgeschnittenem Keil, Schalen abziehen,
 *                     Farben nach Temperatur/Dichte/Zustand, Mantelkonvektion live
 *   Tiefenprofil    — Temperatur, Druck, Dichte, Wellen, Zähigkeit, Schwere
 *   Erdbebenwellen  — Strahlen durch die Erde, Schattenzonen, Entdeckung des Kerns
 *   Konvektion      — Strömungslöser für den Mantel zum Ausprobieren
 *   Wissen          — Zusammensetzung, Merksätze, Quellen
 */
import { lazy, Suspense, useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import Tiefenprofil from "./Tiefenprofil";
import Seismik from "./Seismik";
import KonvektionsAnsicht from "./KonvektionsAnsicht";
import { ELEMENTE, SCHICHTEN } from "@/lib/erde/schichten";

// three.js nur im Browser laden.
const Keil3D = lazy(() => import("./Keil3D"));

type Reiter = "keil" | "profil" | "wellen" | "konvektion" | "wissen";

const REITER: { id: Reiter; icon: string; label: string }[] = [
  { id: "keil", icon: "🌍", label: "Keilschnitt" },
  { id: "profil", icon: "📉", label: "Tiefenprofil" },
  { id: "wellen", icon: "〰️", label: "Erdbebenwellen" },
  { id: "konvektion", icon: "🔥", label: "Mantelkonvektion" },
  { id: "wissen", icon: "📘", label: "Wissen" },
];

/**
 * `vorgabe` (TaskCrawler-Station): `{ reiter: "keil" | "profil" | "wellen" | "konvektion" | "wissen" }`
 * legt den Reiter fest und blendet die Reiterleiste aus.
 */
export default function ErdAufbau({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const festerReiter = wahl(vorgabe, "reiter", ["keil", "profil", "wellen", "konvektion", "wissen"] as const);
  const [reiter, setReiter] = useState<Reiter>(festerReiter ?? "keil");
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-(--seite-breite) mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🌍 Aufbau der Erde</h1>
          <p className="text-(--text-muted) text-sm mt-1">
            Von der Kruste bis zum Kern: Schichten, Gesteine, Minerale, Temperatur, Druck, Zähigkeit — und wie man das ohne Bohrloch herausgefunden hat.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      {!festerReiter && <div className="inline-flex flex-wrap self-start rounded-xl border border-(--border) p-1 bg-(--surface)">
        {REITER.map(r => (
          <button key={r.id} onClick={() => setReiter(r.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              reiter === r.id ? "bg-(--accent) text-(--accent-text,#111)" : "text-(--text-muted) hover:text-(--text)"}`}>
            {r.icon} {r.label}
          </button>
        ))}
      </div>}

      {reiter === "keil" && (
        <Suspense fallback={<div className="h-[420px] flex items-center justify-center text-sm text-(--text-muted)">Lade 3D …</div>}>
          <Keil3D />
        </Suspense>
      )}
      {reiter === "profil" && <Tiefenprofil />}
      {reiter === "wellen" && <Seismik />}
      {reiter === "konvektion" && <KonvektionsAnsicht />}
      {reiter === "wissen" && <Wissen />}
    </div>
  );
}

function Karte({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-(--border) bg-(--surface) p-4 text-sm leading-relaxed flex flex-col gap-2">
      <h3 className="font-black text-base">{titel}</h3>
      {children}
    </section>
  );
}

function Wissen() {
  const max = Math.max(...ELEMENTE.map(e => Math.max(e.erde, e.kruste)));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Karte titel="🧅 Der Schalenbau in drei Sätzen">
        <p>Die Erde ist aufgebaut wie ein Pfirsich: dünne <b>Kruste</b> (Haut), dicker <b>Mantel</b> (Fruchtfleisch) und <b>Kern</b> (Stein). Nach unten wird es heißer, der Druck steigt und die Stoffe werden dichter — schweres Eisen ist nach innen gesunken, leichtes Gestein oben geblieben.</p>
        <p>Man kann nach dem <b>Stoff</b> einteilen (Kruste – Mantel – Kern) oder nach dem <b>Verhalten</b> (starre Lithosphäre – fließende Asthenosphäre – zäher Mantel – flüssiger äußerer Kern – fester innerer Kern). Beides steht in Schulbüchern.</p>
      </Karte>
      <Karte titel="🧪 Woraus besteht die Erde?">
        <div className="flex flex-col gap-1">
          {ELEMENTE.map(e => (
            <div key={e.symbol} className="grid grid-cols-[70px_1fr] items-center gap-2 text-xs">
              <span><b>{e.symbol}</b> {e.name}</span>
              <div className="flex flex-col gap-0.5">
                <div className="h-2 rounded-sm bg-amber-600" style={{ width: `${(e.erde / max) * 100}%` }} title={`ganze Erde ${e.erde} %`} />
                <div className="h-2 rounded-sm bg-slate-400" style={{ width: `${(e.kruste / max) * 100}%` }} title={`Kruste ${e.kruste} %`} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs"><span className="inline-block w-3 h-2 bg-amber-600 rounded-sm mr-1" />ganze Erde <span className="inline-block w-3 h-2 bg-slate-400 rounded-sm ml-3 mr-1" />Erdkruste (Massenprozent). Die Erde als Ganzes ist vor allem Eisen, die Kruste vor allem Sauerstoff und Silizium — Quarz und Feldspat.</p>
      </Karte>
      <Karte titel="🔎 Woher wissen wir das?">
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li><b>Erdbebenwellen</b> (Seismologie): Laufzeiten, Brechung, Schattenzonen — das wichtigste Werkzeug.</li>
          <li><b>Masse und Trägheit</b>: Die Erde ist im Mittel 5,5 g/cm³ dicht, Gestein nur 2,7 — also muss innen etwas viel Schwereres sein.</li>
          <li><b>Meteorite</b>: Eisenmeteorite sind Reste von Kernen zerbrochener Kleinplaneten.</li>
          <li><b>Mantelgestein an der Oberfläche</b>: Peridotit in Ophiolithen und als Einschluss in Vulkangestein, Diamanten mit Einschlüssen aus bis zu 660 km Tiefe.</li>
          <li><b>Hochdruck-Experimente</b>: In Diamantstempelzellen werden Kerndrücke nachgestellt.</li>
          <li><b>Magnetfeld</b>: Es verlangt einen flüssigen, strömenden Metallkern.</li>
        </ul>
        <p>Gebohrt hat man nur bis 12,3 km (Kola-Bohrung, Russland) — das sind 0,2 % des Wegs zum Mittelpunkt. In Deutschland: KTB Windischeschenbach, 9,1 km, 265 °C am Bohrlochgrund.</p>
      </Karte>
      <Karte titel="🌡️ Warum ist es innen so heiß?">
        <p>Ein Teil der Wärme stammt noch aus der Entstehung der Erde vor 4,6 Mrd. Jahren (Zusammenprall vieler Brocken, Absinken des Eisens). Der andere Teil entsteht laufend beim <b>Zerfall radioaktiver Stoffe</b> (Uran, Thorium, Kalium). Die Erde gibt heute etwa 47 Terawatt Wärme ab — dreimal so viel, wie die Menschheit an Energie verbraucht.</p>
        <p>Nach unten wird es pro Kilometer etwa 30 °C wärmer (<b>geothermischer Gradient</b>) — aber nur in der Kruste. Im Mantel mischt die Konvektion, dort steigt die Temperatur nur noch langsam.</p>
      </Karte>
      <Karte titel="🧲 Kern und Magnetfeld">
        <p>Im flüssigen äußeren Kern strömt Eisen, angetrieben von Wärme und vom wachsenden inneren Kern, der leichte Elemente abgibt. Die Erddrehung lenkt die Strömung zu Wirbeln — wie ein Fahrraddynamo erzeugen sie Strom und das <b>Magnetfeld</b>. Es schützt uns vor dem Sonnenwind und hat sich schon oft umgepolt (sichtbar in den Magnetstreifen des Meeresbodens).</p>
      </Karte>
      <Karte titel="📋 Alle Schichten im Überblick">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-(--text-muted)"><th className="pr-2">Schicht</th><th className="pr-2">Tiefe km</th><th className="pr-2">Zustand</th><th>Hauptmineral</th></tr></thead>
            <tbody className="align-top">
              {SCHICHTEN.map(s => (
                <tr key={s.id}>
                  <td className="pr-2 py-0.5"><span className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle" style={{ background: s.farbe }} />{s.name}</td>
                  <td className="pr-2">{s.von.toLocaleString("de-DE")}–{s.bis.toLocaleString("de-DE")}</td>
                  <td className="pr-2">{s.zustand}</td>
                  <td>{s.minerale[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Karte>
      <Karte titel="🔬 Wie genau ist das Modell?">
        <p>Dichte, Druck, Schwere und Wellengeschwindigkeiten folgen dem Referenzmodell PREM, das aus Tausenden Erdbeben und Eigenschwingungen der Erde berechnet wurde. Temperatur und Zähigkeit sind nicht messbar, sondern erschlossen — im Kern sind die Werte auf mehrere hundert Grad unsicher, die Zähigkeit des inneren Kerns auf viele Zehnerpotenzen.</p>
        <p>Die Konvektion ist eine echte Strömungsrechnung (Stokes-Gleichung, Boussinesq-Näherung), aber im Rechteck statt in der Kugel, mit gleichbleibender Zähigkeit und ohne Platten.</p>
      </Karte>
      <Karte titel="📚 Quellen">
        <ul className="list-disc pl-5 text-xs flex flex-col gap-1">
          <li>Dziewonski & Anderson (1981): Preliminary Reference Earth Model. Phys. Earth Planet. Inter. 25, 297–356.</li>
          <li>Turcotte & Schubert: Geodynamics (3. Aufl. 2014) — Konvektion, Rayleigh-Zahl, Mantelviskosität.</li>
          <li>Lehmann, I. (1936): P′. Publ. Bureau Central Séismologique International A14 — Entdeckung des inneren Kerns.</li>
          <li>Gutenberg, B. (1914): Über Erdbebenwellen VII A — Tiefe der Kerngrenze 2900 km.</li>
          <li>Tschauner et al. (2014), Science 346 — Bridgmanit benannt; Pearson et al. (2014), Nature 507 — wasserhaltiger Ringwoodit.</li>
          <li>McDonough & Sun (1995): The composition of the Earth. Chem. Geol. 120 — Elementhäufigkeiten.</li>
          <li>Davies & Davies (2010), Solid Earth 1 — Wärmefluss der Erde ≈ 47 TW.</li>
        </ul>
      </Karte>
    </div>
  );
}
