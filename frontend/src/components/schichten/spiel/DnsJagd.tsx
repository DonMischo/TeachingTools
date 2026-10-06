"use client";
/**
 * Stufe 3: DNS-Jagd. Du bist der Resolver und kennst nur die Adressen der
 * Root-Server. Tippe an, wen du fragst — jede Antwort nennt die IP-Adresse
 * des nächsten Servers, bis einer die Adresse des Ziels weiß.
 */
import { useState } from "react";
import { DNS, frageDns, richtigerDns, type DnsServer, type Ziel } from "@/lib/schichten/netz";
import type { Niveau } from "../Bausteine";

const FARBE: Record<DnsServer["art"], string> = { resolver: "#94a3b8", root: "#f59e0b", tld: "#ec4899", zone: "#a855f7" };
const ART: Record<DnsServer["art"], string> = { resolver: "Resolver", root: "Root-Server", tld: "Top-Level-Domain", zone: "Domain-Server" };

interface Eintrag { server: DnsServer; text: string; ok: boolean }

export default function DnsJagd({ ziel, niveau = "fortgeschritten", fertig, fehler }: { ziel: Ziel; niveau?: Niveau; fertig: (ip: string) => void; fehler: () => void }) {
  const [fehlversuche, setFehlversuche] = useState(0);
  const [gefragt, setGefragt] = useState<DnsServer[]>([]);
  const [protokoll, setProtokoll] = useState<Eintrag[]>([]);
  const [ip, setIp] = useState<string | null>(null);
  const [wackel, setWackel] = useState<string | null>(null);

  const frage = (s: DnsServer) => {
    if (ip || s.art === "resolver") return;
    const erlaubt = richtigerDns(ziel, gefragt);
    const a = frageDns(s, ziel);
    if (!erlaubt.some(e => e.id === s.id)) {
      fehler();
      setFehlversuche(n => n + 1);
      setWackel(s.id);
      setTimeout(() => setWackel(null), 500);
      const grund = gefragt.length === 0 && s.art !== "root"
        ? "Am Anfang kennt der Resolver nur die Root-Server. Erst dort nachfragen!"
        : a.art === "falsch" ? a.text : `Diesen Server hat dir noch niemand genannt. Folge der IP-Adresse aus der letzten Antwort.`;
      setProtokoll(p => [...p, { server: s, text: grund, ok: false }]);
      return;
    }
    setGefragt(g => [...g, s]);
    setProtokoll(p => [...p, { server: s, text: a.text, ok: true }]);
    if (a.art === "antwort") { setIp(a.ip); fertig(a.ip); }
  };

  const linien: [DnsServer, DnsServer][] = [];
  let vorher = DNS[0];
  for (const g of gefragt) { linien.push([vorher, g]); vorher = g; }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm max-w-3xl">
        Lenas Handy kennt nur den Namen <b className="font-mono">{ziel.name}</b>. Du bist der <b>Resolver</b> im Heimrouter: Finde die IP-Adresse!
        Du kennst nur die Root-Server. Jeder Server nennt dir die <b>IP-Adresse</b> des nächsten, bis einer die Antwort weiß. Das ist <b>DNS</b>, ein Dienst der Anwendungsschicht (7).
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="rounded-xl bg-[#060a14] overflow-hidden">
          <svg viewBox="0 0 900 380" className="w-full h-auto" role="img" aria-label="DNS-Server zum Anklicken">
            <style>{`@keyframes dns-wackel{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}} .dns-wackel{animation:dns-wackel .25s 2}`}</style>
            {["Root", "Top-Level-Domains", "Domain-Server"].map((t, i) => (
              <text key={t} x={[270, 500, 760][i]} y={370} textAnchor="middle" fill="#475569" fontSize={12} fontWeight={700}>{t.toUpperCase()}</text>
            ))}
            {linien.map(([a, b], i) => (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#22d3ee" strokeWidth={2.5} strokeDasharray="6 4">
                <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.8s" repeatCount="indefinite" />
              </line>
            ))}
            {DNS.map(s => {
              const besucht = gefragt.some(g => g.id === s.id) || s.art === "resolver";
              // Einsteiger: nach einem Fehlversuch leuchtet der richtige nächste Server
              const tipp = niveau === "einsteiger" && fehlversuche > 0 && !ip && richtigerDns(ziel, gefragt).some(e => e.id === s.id);
              return (
                <g key={s.id} transform={`translate(${s.x},${s.y})`} className={s.art === "resolver" ? "" : "cursor-pointer"} onClick={() => frage(s)}>
                  <g className={wackel === s.id ? "dns-wackel" : ""}>
                    {tipp && <rect x={-100} y={-34} width={200} height={68} rx={16} fill="none" stroke="#facc15" strokeWidth={3}><animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite" /></rect>}
                    <rect x={-92} y={-26} width={184} height={52} rx={12} fill="#0f172a" stroke={FARBE[s.art]} strokeWidth={besucht ? 3 : 1.5} opacity={besucht ? 1 : 0.85} />
                    <text y={-4} textAnchor="middle" fill="#f8fafc" fontSize={16} fontWeight={800} fontFamily="ui-monospace,monospace">{s.ip}</text>
                    <text y={15} textAnchor="middle" fill="#94a3b8" fontSize={11}>{besucht ? s.name : ART[s.art]}</text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex flex-col gap-2">
          <span className="label">Gespräch</span>
          {protokoll.length === 0 && <p className="text-sm text-muted">Tippe einen Server an, um ihn zu fragen: »Welche Adresse hat {ziel.name}?«</p>}
          {protokoll.map((e, i) => (
            <div key={i} className={`card p-2 text-sm ${e.ok ? "" : "border-bad"}`}>
              <div className="font-mono text-xs text-muted">{e.ok ? "→" : "✗"} {e.server.ip}</div>
              <div>{e.text}</div>
            </div>
          ))}
          {ip && <div className="card p-3 border-2 border-ok font-bold">✅ Gefunden: {ziel.name} = <span className="font-mono">{ip}</span></div>}
        </div>
      </div>
      <p className="text-xs text-muted">
        In echt merkt sich der Resolver die Antworten eine Weile (Cache) — beim zweiten Foto fragt er niemanden mehr. Die Root-Server gibt es wirklich: 13 Namen (a bis m), verteilt auf weit über 1 000 Standorte weltweit.
      </p>
    </div>
  );
}
