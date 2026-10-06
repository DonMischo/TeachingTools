"use client";
/**
 * Stufe 5: Du bist der Router. Das Paket liegt bei dir; lies die Zieladresse,
 * such in deiner Tabelle den längsten passenden Eintrag und tippe den
 * Nachbarn an, zu dem er führt. Falsche Wahl: Das Paket bleibt, du bekommst
 * den Grund. Jeder Hop kostet 1 TTL.
 */
import { useState } from "react";
import {
  ROUTER, VERBINDUNGEN, begruendung, besterEintrag, ipBits, nachbarn, passt, router, zerlege, type Ziel,
} from "@/lib/schichten/netz";

export default function Routing({ ziel, fertig, fehler }: { ziel: Ziel; fertig: () => void; fehler: () => void }) {
  const [jetzt, setJetzt] = useState("heim");
  const [weg, setWeg] = useState<string[]>(["heim"]);
  const [ttl, setTtl] = useState(64);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [bitsZeigen, setBitsZeigen] = useState(false);
  const [angekommen, setAngekommen] = useState(false);
  const r = router(jetzt);
  const nb = nachbarn(jetzt);
  const lokal = r.tabelle.some(e => e.nach === "lokal");

  const waehle = (wahl: string) => {
    if (angekommen) return;
    const richtig = besterEintrag(r, ziel.ip)!;
    if (wahl !== richtig.nach) {
      fehler();
      setMeldung({ ok: false, text: begruendung(r, ziel.ip, wahl) });
      return;
    }
    if (wahl === "lokal") {
      setAngekommen(true);
      setMeldung({ ok: true, text: `Zugestellt! ${ziel.ip} liegt direkt an ${r.name} (${richtig.netz}). Das Paket kommt mit TTL ${ttl} an.` });
      fertig();
      return;
    }
    setMeldung({ ok: true, text: `${richtig.netz} passt — weiter nach ${router(wahl).name}.` });
    setJetzt(wahl);
    setWeg(w => [...w, wahl]);
    setTtl(t => t - 1);
  };

  const imWeg = (a: string, b: string) => weg.some((w, i) => i > 0 && ((weg[i - 1] === a && w === b) || (weg[i - 1] === b && w === a)));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm max-w-3xl">
        Du bist jetzt jeder Router auf dem Weg. Das Paket an <b className="font-mono">{ziel.ip}</b> ({ziel.ort}) liegt bei dir. Such in deiner Routingtabelle den
        <b> längsten passenden Eintrag</b> — die Zahl hinter dem Schrägstrich sagt, wie viele Bit vorn gleich sein müssen — und tippe den Router an, zu dem er führt.
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="rounded-xl bg-[#060a14] overflow-hidden">
          <svg viewBox="0 0 1000 480" className="w-full h-auto" role="img" aria-label="Router zum Anklicken">
            <style>{`@keyframes r-puls{0%,100%{opacity:.35}50%{opacity:.9}} .r-puls{animation:r-puls 1.4s ease-in-out infinite}`}</style>
            {VERBINDUNGEN.map(([a, b]) => {
              const A = router(a), B = router(b);
              const aktiv = (a === jetzt || b === jetzt) && !angekommen;
              return <line key={a + b} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={imWeg(a, b) ? "#22d3ee" : aktiv ? "#64748b" : "#1e293b"} strokeWidth={imWeg(a, b) ? 4 : 2} />;
            })}
            {ROUTER.map(x => {
              const istJetzt = x.id === jetzt;
              const waehlbar = nb.includes(x.id) && !angekommen;
              return (
                <g key={x.id} transform={`translate(${x.x},${x.y})`} onClick={() => waehlbar && waehle(x.id)} className={waehlbar ? "cursor-pointer" : ""}>
                  {istJetzt && <circle r={30} fill="#22d3ee" className="r-puls" />}
                  <circle r={18} fill="#0f172a" stroke={istJetzt ? "#22d3ee" : waehlbar ? "#a78bfa" : weg.includes(x.id) ? "#0e7490" : "#334155"} strokeWidth={waehlbar || istJetzt ? 3 : 2} />
                  <text y={5} textAnchor="middle" fontSize={14}>{istJetzt ? "📦" : x.id === ziel.router && angekommen ? "🎉" : "⇄"}</text>
                  <text y={36} textAnchor="middle" fill={waehlbar || istJetzt ? "#e2e8f0" : "#64748b"} fontSize={13} fontWeight={700}>{x.name}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex flex-col gap-3">
          <div className="card p-3 flex flex-col gap-1">
            <div className="flex justify-between text-sm"><b>📍 {r.name}</b><span className="tabular-nums">TTL <b>{ttl}</b></span></div>
            <div className="text-sm">Ziel: <b className="font-mono">{ziel.ip}</b></div>
            {bitsZeigen && <div className="font-mono text-[11px] text-cyan-500 break-all">{ipBits(ziel.ip)}</div>}
          </div>
          <div className="card p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="label">Routingtabelle</span>
              <button className={`chip text-xs ${bitsZeigen ? "chip-on" : ""}`} onClick={() => setBitsZeigen(!bitsZeigen)}>0101 Bits zeigen</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted text-left"><th>Netz</th><th>weiter an</th></tr></thead>
              <tbody>
                {r.tabelle.map(e => {
                  const { ip, laenge } = zerlege(e.netz);
                  return (
                    <tr key={e.netz} className="border-t border-line align-top">
                      <td className="py-1 font-mono">
                        {e.netz}
                        {bitsZeigen && (
                          <div className="text-[11px] break-all">
                            {Array.from(ipBits(ip)).map((c, i) => {
                              const bit = ipBits(ip).slice(0, i + 1).replace(/\./g, "").length;
                              const zaehlt = c !== "." && bit <= laenge;
                              const gleich = ipBits(ziel.ip)[i] === c;
                              return <span key={i} className={zaehlt ? (gleich ? "text-ok font-bold" : "text-bad font-bold") : "text-muted opacity-50"}>{c}</span>;
                            })}
                            <span className={passt(ziel.ip, e.netz) ? "text-ok" : "text-bad"}> {passt(ziel.ip, e.netz) ? "passt" : "passt nicht"}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-1">{e.nach === "lokal" ? "direkt hier" : router(e.nach).name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lokal && !angekommen && <button className="btn btn-primary w-full mt-2" onClick={() => waehle("lokal")}>📬 Hier direkt zustellen</button>}
          </div>
          {meldung && <div className={`rounded-lg p-3 text-sm ${meldung.ok ? "bg-ok/15" : "bg-bad/15"}`}>{meldung.ok ? "✅ " : "❌ "}{meldung.text}</div>}
          <p className="text-xs text-muted">Grün = Bit stimmt mit dem Ziel überein, rot = anders, grau = zählt nicht. 0.0.0.0/0 ist die Standardroute: Sie passt immer, aber am schwächsten.</p>
        </div>
      </div>
    </div>
  );
}
