"use client";
/**
 * Stufe 4: Selbst packen. Dein Wort (8 Byte) passt im Spiel in zwei Segmente
 * zu 4 Byte. Du füllst die wichtigen Felder von Schicht 4, 3 und 2 selbst
 * aus — danach siehst du deinen Rahmen mit echten Prüfsummen.
 */
import { useMemo, useState } from "react";
import { baueRahmen, schicht, type SchichtNr } from "@/lib/schichten/kapselung";
import { text } from "@/lib/schichten/bytes";
import { ADRESSEN, KNOTEN } from "@/lib/schichten/route";
import { DNS, type Ziel } from "@/lib/schichten/netz";
import { HexBild, Legende, type Modell } from "../Bausteine";

export const SPIEL_MSS = 4;
export const SPIEL_ISN = 1000;
const HANDY_MAC = KNOTEN[0].mac, ROUTER_MAC = KNOTEN[1].mac;

interface Frage {
  id: string;
  schicht: SchichtNr;
  frage: string;
  optionen?: { wert: string; label: string; warum: string }[];
  zahl?: { richtig: number; warum: string };
  richtig: string;
  merke: string;
}

function fragen(ziel: Ziel): Frage[] {
  const zone = DNS.find(d => d.art === "zone" && d.zone === ziel.domain)!;
  return [
    {
      id: "port", schicht: 4, frage: "Welcher Ziel-Port? Die Foto-App spricht verschlüsseltes HTTP.",
      optionen: [
        { wert: "25", label: "25 · E-Mail (SMTP)", warum: "Port 25 nimmt E-Mails entgegen — dort wartet keine Foto-App." },
        { wert: "53", label: "53 · DNS", warum: "Port 53 ist für Namensauflösung, die hast du schon erledigt." },
        { wert: "80", label: "80 · HTTP", warum: "Port 80 ist unverschlüsseltes HTTP — die App will aber verschlüsseln." },
        { wert: "443", label: "443 · HTTPS", warum: "" },
      ],
      richtig: "443",
      merke: "Der Port sagt, welches Programm auf dem Server die Daten bekommt — wie eine Zimmernummer im Haus.",
    },
    {
      id: "seq", schicht: 4, frage: `Segment 1 trägt die Folgenummer ${SPIEL_ISN} und die Bytes 1–4 deines Wortes. Welche Folgenummer bekommt Segment 2?`,
      zahl: { richtig: SPIEL_ISN + SPIEL_MSS, warum: `Die Folgenummer zählt Bytes, nicht Segmente: ${SPIEL_ISN} + ${SPIEL_MSS} Byte = ${SPIEL_ISN + SPIEL_MSS}.` },
      richtig: String(SPIEL_ISN + SPIEL_MSS),
      merke: "Mit den Folgenummern setzt der Empfänger die Stücke in der richtigen Reihenfolge zusammen und merkt, wenn eins fehlt.",
    },
    {
      id: "ip", schicht: 3, frage: `Welche Ziel-IP kommt in den IP-Kopf? Das Paket soll zu ${ziel.wer} nach ${ziel.ort}.`,
      optionen: [
        { wert: ADRESSEN.handy, label: ADRESSEN.handy, warum: "Das ist Lenas eigene Adresse — Absender, nicht Ziel." },
        { wert: "192.168.178.1", label: "192.168.178.1", warum: "Das ist der Heimrouter. Er ist nur die erste Station, nicht das Ziel." },
        { wert: zone.ip, label: zone.ip, warum: `Das ist der DNS-Server ${zone.name} — er hat dir nur die Adresse verraten.` },
        { wert: ziel.ip, label: ziel.ip, warum: "" },
      ],
      richtig: ziel.ip,
      merke: "Die IP-Zieladresse ist die echte Endadresse. Sie bleibt auf dem ganzen Weg gleich — alle Router lesen sie.",
    },
    {
      id: "mac", schicht: 2, frage: "Welche Ziel-MAC-Adresse kommt in den Rahmen?",
      optionen: [
        { wert: "server", label: `MAC des Servers in ${ziel.ort}`, warum: `MAC-Adressen gelten nur im eigenen Netz. Die Netzwerkkarte in ${ziel.ort} ist für Lena unerreichbar — sie kennt nicht einmal ihre MAC.` },
        { wert: ROUTER_MAC, label: `${ROUTER_MAC} (Heimrouter)`, warum: "" },
        { wert: HANDY_MAC, label: `${HANDY_MAC} (Lenas Handy)`, warum: "Das ist die eigene MAC — sie steht als Absender im Rahmen." },
        { wert: "ff:ff:ff:ff:ff:ff", label: "ff:ff:ff:ff:ff:ff (an alle)", warum: "Das ist die Rundruf-Adresse: Alle Geräte im WLAN würden den Rahmen lesen. Für Daten nimmt man sie nicht." },
      ],
      richtig: ROUTER_MAC,
      merke: "Der Rahmen reist nur bis zum nächsten Gerät. Jeder Router baut einen neuen — mit neuen MAC-Adressen. Die MAC des Routers fragt das Handy per ARP: »Wer hat 192.168.178.1?«",
    },
  ];
}

export default function Packen({ ziel, wort, ip, modell, fertig, fehler }: {
  ziel: Ziel;
  wort: string;
  ip: string;
  modell: Modell;
  fertig: () => void;
  fehler: () => void;
}) {
  const liste = useMemo(() => fragen(ziel), [ziel]);
  const [pos, setPos] = useState(0);
  const [eingabe, setEingabe] = useState("");
  const [rueck, setRueck] = useState<{ ok: boolean; text: string } | null>(null);
  const f = liste[pos];
  const alleFertig = pos >= liste.length;

  const antworte = (wert: string) => {
    if (rueck?.ok) return;
    if (wert === f.richtig) {
      setRueck({ ok: true, text: f.merke });
    } else {
      fehler();
      setRueck({ ok: false, text: f.optionen?.find(o => o.wert === wert)?.warum || f.zahl?.warum || "Noch nicht." });
    }
  };
  const weiter = () => {
    setRueck(null);
    setEingabe("");
    setPos(pos + 1);
    if (pos + 1 >= liste.length) fertig();
  };

  const bytes = text(wort);
  const rahmen = [0, 1].map(i => baueRahmen({
    nutzlast: bytes.subarray(i * SPIEL_MSS, (i + 1) * SPIEL_MSS), seq: SPIEL_ISN + i * SPIEL_MSS,
    quellIp: ADRESSEN.handy, zielIp: ip, quellPort: ADRESSEN.handyPort, zielPort: 443, ttl: 64,
    vonMac: HANDY_MAC, nachMac: ROUTER_MAC,
  }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm max-w-3xl">
        Jetzt bist du das Betriebssystem von Lenas Handy. Dein Wort hat 8 Byte — im Spiel passen nur {SPIEL_MSS} in ein Segment, es wird also zerteilt.
        Fülle die wichtigsten Felder aus, Schicht für Schicht nach unten.
      </p>
      <div className="flex gap-1.5">
        {liste.map((q, i) => (
          <span key={q.id} className={`h-2 flex-1 rounded-full ${i < pos ? "" : "opacity-25"}`} style={{ background: schicht(q.schicht).farbe }} />
        ))}
      </div>
      {!alleFertig ? (
        <div className="card p-4 flex flex-col gap-3" style={{ borderTop: `3px solid ${schicht(f.schicht).farbe}` }}>
          <span className="text-xs font-bold" style={{ color: schicht(f.schicht).farbe }}>
            {modell === "osi" ? `Schicht ${f.schicht} · ${schicht(f.schicht).name}` : schicht(f.schicht).tcpip}
          </span>
          <h3 className="font-bold">{f.frage}</h3>
          {f.optionen ? (
            <div className="grid sm:grid-cols-2 gap-2">
              {f.optionen.map(o => (
                <button key={o.wert} onClick={() => antworte(o.wert)} className="btn btn-secondary justify-start font-mono text-sm">{o.label}</button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              <input className="input w-40 font-mono" inputMode="numeric" value={eingabe} onChange={e => setEingabe(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => { if (e.key === "Enter") antworte(eingabe); }} aria-label="Folgenummer" />
              <button className="btn btn-primary" onClick={() => antworte(eingabe)}>✓ Prüfen</button>
            </div>
          )}
          {rueck && (
            <div className={`rounded-lg p-3 text-sm ${rueck.ok ? "bg-ok/15" : "bg-bad/15"}`}>
              <b>{rueck.ok ? "✅ Richtig. " : "❌ "}</b>{rueck.text}
              {rueck.ok && <div className="mt-2"><button className="btn btn-primary" onClick={weiter}>Weiter ▶</button></div>}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="font-bold">📦 Deine zwei Rahmen — fertig zum Abschicken</h3>
          {rahmen.map((r, i) => (
            <div key={i} className="flex flex-col gap-1">
              <span className="text-sm">Segment {i + 1}: »{wort.slice(i * SPIEL_MSS, (i + 1) * SPIEL_MSS)}«, Folgenummer {SPIEL_ISN + i * SPIEL_MSS}, {r.bytes.length} Byte</span>
              <HexBild bytes={r.bytes} bereiche={r.bereiche} bis={r.bytes.length} />
            </div>
          ))}
          <Legende bereiche={rahmen[0].bereiche} modell={modell} />
          <p className="text-xs text-muted">
            Von {rahmen[0].bytes.length} Byte sind nur {SPIEL_MSS} deine Daten — der Rest sind Umschläge. Prüfsummen (IP, TCP, Rahmen) sind echt nachgerechnet.
            Im Spiel bleibt das Wort unverschlüsselt, damit du es im Hex-Bild wiederfindest.
          </p>
        </div>
      )}
    </div>
  );
}
