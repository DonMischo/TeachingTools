"use client";
/**
 * Reiter »Weg«: Karte Erfurt → Tokio (Mercator, Küsten aus Natural Earth),
 * darunter die Leitungen. Eine Leitung wählen zeigt, was der Router davor am
 * Rahmen geändert hat — und was nicht.
 */
import { useMemo, useState } from "react";
import land from "@/lib/schichten/land.json";
import { rahmen, schicht, type Feld, type Reise } from "@/lib/schichten/kapselung";
import { KNOTEN, LEITUNGEN, MEDIEN, leitungsLaenge, linienzug, verzoegerung } from "@/lib/schichten/route";
import type { Modell } from "./Bausteine";

const B = 1000, H = 560;
const BOX = { w: -12, o: 150, s: -10, n: 58 };
const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const Y0 = merc(BOX.n), Y1 = merc(BOX.s);
const px = (lon: number) => ((lon - BOX.w) / (BOX.o - BOX.w)) * B;
const py = (lat: number) => ((Y0 - merc(Math.max(-80, Math.min(80, lat)))) / (Y0 - Y1)) * H;

const LAND = (land as { ringe: number[][] }).ringe.map(r => {
  let d = "";
  for (let i = 0; i < r.length; i += 2) d += `${i ? "L" : "M"}${px(r[i] / 10).toFixed(1)},${py(r[i + 1] / 10).toFixed(1)}`;
  return d + "Z";
});

const FARBE: Record<string, string> = { funk: "#a78bfa", kupfer: "#fbbf24", glas: "#22d3ee", see: "#38bdf8" };
const ms = (v: number) => v === 0 ? "0 ms" : v < 1 ? `${(v * 1000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} µs` : `${v.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ms`;
/** Beschriftung neben dem Punkt, damit Erfurt und Frankfurt sich nicht überdecken */
const LAGE: Record<string, { dx: number; dy: number; anker: "start" | "middle" | "end" }> = {
  Erfurt: { dx: 12, dy: -6, anker: "start" },
  "Frankfurt am Main": { dx: -12, dy: 4, anker: "end" },
  Marseille: { dx: -12, dy: 4, anker: "end" },
};

export default function Weg({ reise }: { reise: Reise; modell: Modell }) {
  const [wahl, setWahl] = useState(4);
  const pfad = useMemo(() => LEITUNGEN.map((_, i) => linienzug(i).map(([lo, la], k) => `${k ? "L" : "M"}${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join("")), []);
  const ganz = useMemo(() => {
    const p: [number, number][] = [];
    LEITUNGEN.forEach((_, i) => p.push(...linienzug(i).slice(i ? 1 : 0)));
    return p.map(([lo, la], k) => `${k ? "L" : "M"}${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join("");
  }, []);
  const orte = KNOTEN.filter((k, i) => i === 0 || i > 2);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm max-w-3xl">
        Rund {(Math.round(LEITUNGEN.reduce((s, _, i) => s + leitungsLaenge(i), 0) / 1000) * 1000).toLocaleString("de-DE")} km Kabel liegen zwischen Erfurt und Tokio — das meiste davon am Meeresboden.
        Jeder Knoten ist ein Router: Er liest nur die IP-Zieladresse und entscheidet, wohin es weitergeht. Leitung antippen zeigt, was sich am Rahmen ändert.
      </p>
      <div className="rounded-xl overflow-hidden bg-[#0b1324]">
        <svg viewBox={`0 0 ${B} ${H}`} className="w-full h-auto max-h-[60vh]" role="img" aria-label="Karte des Weges von Erfurt nach Tokio">
          {LAND.map((d, i) => <path key={i} d={d} fill="#1c2840" stroke="#2c3b5c" strokeWidth={0.6} />)}
          {pfad.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={FARBE[LEITUNGEN[i].medium]} strokeWidth={i === wahl ? 5 : 2.5}
              strokeLinecap="round" strokeLinejoin="round" opacity={i === wahl ? 1 : 0.75} className="cursor-pointer" onClick={() => setWahl(i)} />
          ))}
          <circle r={5} fill="#fff">
            <animateMotion dur="14s" repeatCount="indefinite" path={ganz} />
          </circle>
          {orte.map(k => (
            <g key={k.ort} transform={`translate(${px(k.lon)},${py(k.lat)})`}>
              <circle r={7} fill="#0b1324" stroke="#a78bfa" strokeWidth={2.5} />
              <circle r={3} fill="#a78bfa" />
              <text x={LAGE[k.ort]?.dx ?? 0} y={LAGE[k.ort]?.dy ?? (k.lat > 30 ? -13 : 22)} textAnchor={LAGE[k.ort]?.anker ?? "middle"}
                fill="#e2e8f0" fontSize={14} fontWeight={700} style={{ letterSpacing: "0.06em" }}>
                {k.ort.toUpperCase()}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
        <div className="card p-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1">Strecke</th><th>Leitung</th><th className="text-right">km</th><th className="text-right">Laufzeit</th></tr></thead>
            <tbody>
              {LEITUNGEN.map((l, i) => {
                const v = verzoegerung(i, 1514);
                return (
                  <tr key={i} onClick={() => setWahl(i)} className={`border-t border-line cursor-pointer ${i === wahl ? "bg-surface-hover font-semibold" : "hover:bg-surface-hover"}`}>
                    <td className="py-1.5">{KNOTEN[i].name === "Lenas Handy" ? "Handy" : KNOTEN[i].ort} → {KNOTEN[i + 1].name === "WLAN-Router" ? "WLAN-Router" : KNOTEN[i + 1].ort}</td>
                    <td><span style={{ color: FARBE[l.medium] }}>{MEDIEN[l.medium].icon}</span> {MEDIEN[l.medium].name}</td>
                    <td className="text-right tabular-nums">{i === 0 ? "0,01" : Math.round(leitungsLaenge(i)).toLocaleString("de-DE")}</td>
                    <td className="text-right tabular-nums">{ms(v.ausbreitung + v.senden + v.router)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Leitungsdetail reise={reise} i={wahl} />
      </div>
    </div>
  );
}

function Leitungsdetail({ reise, i }: { reise: Reise; i: number }) {
  const jetzt = useMemo(() => rahmen(reise, 1, i), [reise, i]);
  const vorher = useMemo(() => (i > 0 ? rahmen(reise, 1, i - 1) : null), [reise, i]);
  const l = LEITUNGEN[i];
  const v = verzoegerung(i, jetzt.bytes.length);
  const zeilen = (felder: Feld[], alt: Feld[] | undefined, nr: 2 | 3 | 4) =>
    felder.map(f => {
      const a = alt?.find(x => x.name === f.name);
      const neu = !!a && a.wert !== f.wert;
      return (
        <tr key={nr + f.name} className="border-t border-line">
          <td className="py-1 pr-2 whitespace-nowrap" style={{ color: schicht(nr).farbe }}>{f.name}</td>
          <td className={`py-1 pr-2 font-mono text-xs ${neu ? "font-bold" : "text-muted"}`}>
            {neu ? <><s className="opacity-60">{a!.wert}</s> → {f.wert}</> : f.wert}
          </td>
          <td>{neu ? "✏️" : ""}</td>
        </tr>
      );
    });
  return (
    <div className="card p-4 flex flex-col gap-3">
      <h3 className="font-bold">{KNOTEN[i].name} ({KNOTEN[i].ort}) → {KNOTEN[i + 1].name} ({KNOTEN[i + 1].ort})</h3>
      <p className="text-sm">{MEDIEN[l.medium].icon} <b>{MEDIEN[l.medium].name}</b> — {l.text}. {MEDIEN[l.medium].signal}.</p>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-surface-hover p-2"><div className="font-bold text-base tabular-nums">{ms(v.ausbreitung)}</div>Weg (Licht/Strom)</div>
        <div className="rounded-lg bg-surface-hover p-2"><div className="font-bold text-base tabular-nums">{ms(v.senden)}</div>alle Bits hinausschicken</div>
        <div className="rounded-lg bg-surface-hover p-2"><div className="font-bold text-base tabular-nums">{ms(v.router)}</div>Router liest und leitet weiter</div>
      </div>
      {vorher ? (
        <>
          <p className="text-sm">
            Was der Router in <b>{KNOTEN[i].ort}</b> am Rahmen von Segment #1 geändert hat (✏️):
            {i === 1 && " Hier sitzt der Heimrouter — er tauscht Lenas private Adresse und den Port gegen seine eigenen (NAT) und muss dafür auch die TCP-Prüfsumme neu rechnen."}
          </p>
          <table className="w-full text-sm">
            <tbody>
              {zeilen(jetzt.eth.slice(0, 2), vorher.eth, 2)}
              {zeilen(jetzt.ip.filter(f => ["TTL", "Kopfprüfsumme", "Absender", "Ziel"].includes(f.name)), vorher.ip, 3)}
              {zeilen(jetzt.tcp.filter(f => ["Absender-Port", "Prüfsumme"].includes(f.name)), vorher.tcp, 4)}
              <tr className="border-t border-line">
                <td className="py-1 pr-2" style={{ color: schicht(2).farbe }}>Rahmenprüfsumme</td>
                <td className="py-1 pr-2 font-mono text-xs font-bold"><s className="opacity-60">0x{vorher.fcs.toString(16).padStart(8, "0")}</s> → 0x{jetzt.fcs.toString(16).padStart(8, "0")}</td>
                <td>✏️</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted">Neu ist immer der Rahmen (Schicht 2): jede Strecke hat ihre eigenen MAC-Adressen. Die IP-Zieladresse bleibt vom ersten bis zum letzten Meter gleich, die Daten darin sowieso.</p>
        </>
      ) : (
        <p className="text-sm">Die erste Strecke: Lenas Handy schickt den Rahmen an die MAC-Adresse des WLAN-Routers. Mit dabei: TTL 64 und die private Adresse 192.168.178.23.</p>
      )}
    </div>
  );
}
