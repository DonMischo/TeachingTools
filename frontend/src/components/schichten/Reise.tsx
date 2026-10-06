"use client";
/**
 * Reiter »Reise«: 15 Schritte — bei Lena von 7 nach 1 hinunter, unterwegs,
 * in Tokio von 1 nach 7 hinauf. Oben der 3D-Stapel, darunter für jeden
 * Schritt die echten Bytes.
 */
import { useEffect, useMemo, useState } from "react";
import { bits, hex, ipText, lies16 } from "@/lib/schichten/bytes";
import {
  MSS, TLS_MAX, alleRahmenInTokio, auspacken, pruefe, rahmen, schicht, type Feld, type Reise as ReiseDaten, type SchichtNr,
} from "@/lib/schichten/kapselung";
import { ADRESSEN, KNOTEN, LEITUNGEN, MEDIEN, ttlAuf, zeitbedarf } from "@/lib/schichten/route";
import { PRAEAMBEL, VERFAHREN, bitsVon } from "@/lib/schichten/signal";
import { FelderTabelle, HexBild, Kasten, Legende, SignalBild, kb, schichtName, type Modell } from "./Bausteine";
import Stapel from "./Stapel";
import { SCHRITTE, schrittInfo } from "./stapelSzene";
import type { Inhalt } from "./inhalt";

const zahl = (n: number) => n.toLocaleString("de-DE");

export default function Reise({ reise, inhalt, modell, zurKarte }: {
  reise: ReiseDaten;
  inhalt: Inhalt;
  modell: Modell;
  zurKarte: () => void;
}) {
  const [schritt, setSchritt] = useState(0);
  const [spielt, setSpielt] = useState(false);
  const [nr, setNr] = useState(1);
  const n = reise.segmente.length;
  const segNr = Math.min(nr, n);

  useEffect(() => {
    if (!spielt) return;
    if (schritt >= SCHRITTE - 1) { setSpielt(false); return; }
    const id = setTimeout(() => setSchritt(schritt + 1), 6000);
    return () => clearTimeout(id);
  }, [spielt, schritt]);

  const { seite, schicht: nrSchicht } = schrittInfo(schritt);
  const titel = seite === "unterwegs" ? "Unterwegs · Hop für Hop" : `${seite === "lena" ? "Lena" : "Tokio"} · ${schichtName(nrSchicht!, modell)}`;
  const farbe = nrSchicht ? schicht(nrSchicht).farbe : "#94a3b8";

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Stapel schritt={schritt} modell={modell} bild={inhalt.url} />
        <div className="absolute top-2 left-2 right-2 flex items-center gap-3 rounded-lg bg-[#060a14]/80 px-3 py-2 text-slate-200 text-xs pointer-events-none">
          <span className="font-bold">LENA</span>
          <div className="relative flex-1 h-1 rounded-full bg-slate-700">
            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white transition-all duration-700" style={{ left: `calc(${(schritt / (SCHRITTE - 1)) * 100}% - 6px)` }} />
          </div>
          <span className="font-bold">TOKIO</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-secondary" disabled={schritt === 0} onClick={() => { setSpielt(false); setSchritt(s => s - 1); }}>◀ Zurück</button>
        <button className="btn btn-primary" disabled={schritt === SCHRITTE - 1} onClick={() => { setSpielt(false); setSchritt(s => s + 1); }}>Weiter ▶</button>
        <button className="btn btn-secondary" onClick={() => { if (schritt === SCHRITTE - 1) setSchritt(0); setSpielt(!spielt); }}>{spielt ? "⏸ Anhalten" : "⏵ Abspielen"}</button>
        <div className="flex gap-1 ml-auto">
          {Array.from({ length: SCHRITTE }, (_, s) => {
            const i = schrittInfo(s);
            return (
              <button key={s} onClick={() => { setSpielt(false); setSchritt(s); }} title={i.schicht ? schichtName(i.schicht, modell) : "unterwegs"}
                className={`w-6 h-6 rounded-md text-[10px] font-bold text-white transition-transform ${s === schritt ? "scale-125 ring-2 ring-fg" : "opacity-70"}`}
                style={{ background: i.schicht ? schicht(i.schicht).farbe : "#64748b" }}>
                {i.schicht ?? "⇢"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-black" style={{ color: farbe }}>{titel}</h2>
        {seite === "lena" && <Sender nr={nrSchicht!} reise={reise} inhalt={inhalt} modell={modell} seg={segNr} setSeg={setNr} />}
        {seite === "unterwegs" && <Unterwegs reise={reise} zurKarte={zurKarte} />}
        {seite === "tokio" && <Empfaenger nr={nrSchicht!} reise={reise} inhalt={inhalt} modell={modell} seg={segNr} setSeg={setNr} />}
      </div>
    </div>
  );
}

function Segmentwahl({ seg, setSeg, n }: { seg: number; setSeg: (n: number) => void; n: number }) {
  if (n < 2) return null;
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="label">Segment</span>
      <input type="range" min={1} max={n} value={seg} onChange={e => setSeg(+e.target.value)} className="w-48" />
      <span className="tabular-nums font-mono">#{seg} von {n}</span>
    </label>
  );
}

function Erzaehlt({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed max-w-3xl">{children}</p>;
}

/** Feldtabelle + Hex-Ausschnitt, Hover markiert die Bytes */
function KopfAnsicht({ felder, bytes, nr, von, laenge, bereiche, modell }: {
  felder: Feld[];
  bytes: Uint8Array;
  nr: SchichtNr;
  von: number;
  laenge: number;
  bereiche: ReturnType<typeof rahmen>["bereiche"];
  modell: Modell;
}) {
  const [feld, setFeld] = useState<Feld | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <div className="card p-3 overflow-x-auto"><FelderTabelle felder={felder} farbe={schicht(nr).farbe} onZeige={setFeld} /></div>
      <div className="flex flex-col gap-2">
        <HexBild bytes={bytes} bereiche={bereiche} bis={Math.max(64, von + laenge + 16)} markiert={feld} />
        <Legende bereiche={bereiche} modell={modell} />
        <p className="text-xs text-muted">Über ein Feld fahren zeigt seine Bytes. Farben = Schichten: so steckt jede Hülle in der nächsten.</p>
      </div>
    </div>
  );
}

// ── Lena: hinunter ──────────────────────────────────────────────────────────

function Sender({ nr, reise, inhalt, modell, seg, setSeg }: { nr: SchichtNr; reise: ReiseDaten; inhalt: Inhalt; modell: Modell; seg: number; setSeg: (n: number) => void }) {
  const f = useMemo(() => rahmen(reise, seg, 0), [reise, seg]);
  const n = reise.segmente.length;

  if (nr === 7) {
    return (
      <>
        <Erzaehlt>
          Lena tippt auf <b>Senden</b>. Die App kennt nur den Namen des Servers: <code>{ADRESSEN.name}</code>. Zuerst fragt sie das
          Telefonbuch des Internets (<b>DNS</b>) nach der Nummer, dann schreibt sie eine <b>HTTP</b>-Anfrage: »Nimm dieses {inhalt.art === "jpeg" ? "Foto" : "Text"}«.
        </Erzaehlt>
        <div className="grid gap-4 lg:grid-cols-2">
          <Kasten titel="1. DNS-Frage" farbe={schicht(7).farbe}>
            <HexBild bytes={reise.dns} bereiche={[{ schicht: 7, name: "DNS-Anfrage", von: 0, laenge: reise.dns.length }]} />
            <p className="text-sm">Antwort: <code>{ADRESSEN.name}</code> → <b className="font-mono">{ADRESSEN.server}</b></p>
          </Kasten>
          <Kasten titel="2. HTTP-Anfrage" farbe={schicht(7).farbe}>
            <pre className="font-mono text-xs bg-[#060a14] text-amber-200 rounded-lg p-3 overflow-x-auto">{reise.httpKopf.replace(/\r\n/g, "↵\n")}{`[${kb(inhalt.bytes.length)} ${inhalt.art === "jpeg" ? "Foto" : "Text"}]`}</pre>
            <p className="text-xs text-muted">Kopf {reise.httpKopf.length} Byte + Inhalt {zahl(inhalt.bytes.length)} Byte = {zahl(reise.http.length)} Byte</p>
          </Kasten>
        </div>
      </>
    );
  }

  if (nr === 6) {
    const d = reise.datensaetze[0];
    const ersterDatensatz = new Uint8Array([...d.kopf, ...d.versiegelt.subarray(0, 59)]);
    return (
      <>
        <Erzaehlt>
          Die Darstellungsschicht bringt die Daten in eine Form, die beide Seiten verstehen — und die niemand unterwegs lesen kann.
          {inhalt.art === "jpeg"
            ? <> Das Foto wird als <b>JPEG</b> komprimiert: aus {kb(inhalt.roh)} Rohpixeln werden {kb(inhalt.bytes.length)} — nur noch {Math.max(0.1, (inhalt.bytes.length / inhalt.roh) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %.</>
            : <> Der Text wird als <b>UTF-8</b> codiert: {zahl(inhalt.roh)} Zeichen werden zu {zahl(inhalt.bytes.length)} Byte (Umlaute und Emojis brauchen mehrere Byte).</>}
          {" "}Dann wird alles <b>verschlüsselt</b> (TLS 1.3 mit ChaCha20-Poly1305): in Datensätze zu höchstens {zahl(TLS_MAX)} Byte, jeder mit 5 Byte Kopf und 16 Byte Siegel.
        </Erzaehlt>
        <div className="grid gap-4 lg:grid-cols-2">
          <Kasten titel="Vorher: lesbar" farbe={schicht(6).farbe}>
            <HexBild bytes={reise.http} bis={64} bereiche={[{ schicht: 7, name: "HTTP", von: 0, laenge: reise.http.length }]} />
            <p className="text-xs text-muted font-mono truncate">{new TextDecoder().decode(reise.http.subarray(0, 48)).replace(/\r\n/g, "↵")}</p>
          </Kasten>
          <Kasten titel={`Nachher: ${reise.datensaetze.length} verschlüsselte${reise.datensaetze.length === 1 ? "r" : ""} Datensatz${reise.datensaetze.length === 1 ? "" : "e"}`} farbe={schicht(6).farbe}>
            <HexBild bytes={ersterDatensatz} bereiche={[{ schicht: 6, name: "TLS-Kopf: 17 = Anwendungsdaten, 03 03 = TLS, Länge", von: 0, laenge: 5 }, { schicht: 7, name: "verschlüsselt", von: 5, laenge: 59 }]} />
            <p className="text-xs text-muted">Schlüssel (nur Lena und der Server kennen ihn): <span className="font-mono">{hex(reise.schluessel.subarray(0, 8), "")}…</span></p>
          </Kasten>
        </div>
        <p className="text-xs text-muted">Im echten Internet gibt es keine eigene Schicht 6: Komprimieren erledigt die App, Verschlüsseln TLS zwischen Transport und Anwendung.</p>
      </>
    );
  }

  if (nr === 5) {
    const schritte: [string, string, string][] = [
      ["→", "ClientHello", "»Hallo, ich kann ChaCha20 und AES — hier mein Teil des Schlüssels.«"],
      ["←", "ServerHello", "»Wir nehmen ChaCha20-Poly1305 — hier mein Teil.« Aus beiden Teilen rechnen beide denselben Schlüssel (Diffie-Hellman), ohne ihn je zu verschicken."],
      ["←", "Zertifikat + Finished", "»Ich bin wirklich tokio.katzenpost.example« — beglaubigt von einer Zertifizierungsstelle."],
      ["→", "Finished", "Lena bestätigt. Die Sitzung steht; ab jetzt ist alles verschlüsselt."],
    ];
    return (
      <>
        <Erzaehlt>
          Bevor Daten fließen, verabreden Handy und Server ein <b>Gespräch</b>: Wer bin ich, wer bist du, welcher Schlüssel gilt?
          Die Sitzung bleibt bestehen, auch wenn mehrere Fotos hintereinander kommen — und kann später ohne neuen Handschlag fortgesetzt werden.
        </Erzaehlt>
        <div className="card p-3">
          {schritte.map(([r, name, erkl]) => (
            <div key={name} className="flex gap-3 py-2 border-t border-line first:border-0 items-start">
              <span className="font-mono w-28 shrink-0 text-xs pt-0.5">{r === "→" ? "Lena ──→ Tokio" : "Lena ←── Tokio"}</span>
              <span className="font-bold w-44 shrink-0" style={{ color: schicht(5).farbe }}>{name}</span>
              <span className="text-sm text-muted">{erkl}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">Im Internet hat die Sitzungsschicht keinen eigenen Kopf im Paket. Ihre Aufgaben übernehmen der TLS-Handschlag und die Anmeldung in der App.</p>
      </>
    );
  }

  if (nr === 4) {
    return (
      <>
        <Erzaehlt>
          TCP zerschneidet den Datenstrom ({zahl(reise.strom.length)} Byte) in <b>{zahl(n)} Segmente</b> zu höchstens {zahl(MSS)} Byte — so viel passt in einen Rahmen.
          Jedes bekommt eine <b>Folgenummer</b>: Tokio kann sie so sortieren und merkt, wenn eins fehlt. Vorher ein Handschlag: SYN → SYN-ACK → ACK.
        </Erzaehlt>
        <Segmentwahl seg={seg} setSeg={setSeg} n={n} />
        <KopfAnsicht felder={f.tcp} bytes={f.bytes.subarray(34)} nr={4} von={0} laenge={20} modell={modell}
          bereiche={f.bereiche.filter(b => b.von >= 34).map(b => ({ ...b, von: b.von - 34 }))} />
      </>
    );
  }

  if (nr === 3) {
    return (
      <>
        <Erzaehlt>
          Jedes Segment bekommt einen <b>IP-Kopf</b> mit Absender und Ziel — wie ein Briefumschlag. Die Zieladresse <b className="font-mono">{ADRESSEN.server}</b> lesen
          alle Router auf dem Weg. Lenas Adresse <span className="font-mono">{ADRESSEN.handy}</span> ist privat: Erst der Heimrouter tauscht sie gegen eine öffentliche (NAT).
        </Erzaehlt>
        <Segmentwahl seg={seg} setSeg={setSeg} n={n} />
        <KopfAnsicht felder={f.ip} bytes={f.bytes.subarray(14)} nr={3} von={0} laenge={20} modell={modell}
          bereiche={f.bereiche.filter(b => b.von >= 14).map(b => ({ ...b, von: b.von - 14 }))} />
      </>
    );
  }

  if (nr === 2) {
    return (
      <>
        <Erzaehlt>
          Für die nächste Strecke — nur bis zum WLAN-Router — kommt ein <b>Rahmen</b> drumherum: MAC-Adresse des Routers, eigene MAC-Adresse und hinten eine <b>Prüfsumme (CRC-32)</b>.
          Hier sieht man die ganze Kapselung: Paket im Rahmen, Segment im Paket, verschlüsselte Daten im Segment.
        </Erzaehlt>
        <Segmentwahl seg={seg} setSeg={setSeg} n={n} />
        <KopfAnsicht felder={[...f.eth, { name: "Prüfsumme (FCS)", wert: `0x${f.fcs.toString(16).padStart(8, "0")}`, von: f.bytes.length - 4, laenge: 4, erkl: "CRC-32 über den ganzen Rahmen — der Empfänger rechnet nach" }]}
          bytes={f.bytes} nr={2} von={0} laenge={14} modell={modell} bereiche={f.bereiche} />
        <p className="text-xs text-muted">Rahmen #{seg}: {zahl(f.bytes.length)} Byte, davon {zahl(f.bytes.length - 58)} Byte Nutzlast. Die Prüfsumme steht ganz am Ende (im Hex-Bild nach »…«).</p>
      </>
    );
  }

  // Schicht 1
  const zwoelf = f.bytes.subarray(0, 12);
  return (
    <>
      <Erzaehlt>
        Jetzt hört das Foto auf, ein Foto zu sein: Der Rahmen wird zu <b>Bits</b>, die Bits zu <b>Funkwellen</b>. Davor kommen 8 Byte Präambel — ein Takt zum Einschwingen,
        damit der Router weiß, wann ein Bit beginnt. Insgesamt reisen {zahl(reise.segmente.reduce((s, x) => s + x.nutzlast.length + 58 + 8, 0) * 8)} Bits.
      </Erzaehlt>
      <Kasten titel="Die ersten 12 Byte des Rahmens als Bits" farbe={schicht(1).farbe}>
        <div className="font-mono text-sm text-cyan-300 bg-[#060a14] rounded-lg p-3 grid grid-cols-4 gap-x-4 gap-y-1 w-fit">
          {Array.from(zwoelf, (b, i) => <span key={i}>{bits(b)}</span>)}
        </div>
      </Kasten>
      <Kasten titel={`${MEDIEN.funk.icon} ${MEDIEN.funk.name}: ${VERFAHREN.funk.name}`} farbe={schicht(1).farbe}>
        <SignalBild bits={bitsVon(new Uint8Array([...PRAEAMBEL.subarray(6), ...zwoelf.subarray(0, 4)]), 6, true)} medium="funk" />
        <p className="text-xs text-muted">{VERFAHREN.funk.text} Gezeigt: Ende der Präambel (55 D5) und die ersten 4 Byte, jedes Byte mit dem niedrigsten Bit zuerst — so schickt es Ethernet.</p>
      </Kasten>
    </>
  );
}

// ── Unterwegs ───────────────────────────────────────────────────────────────

function Unterwegs({ reise, zurKarte }: { reise: ReiseDaten; zurKarte: () => void }) {
  const z = zeitbedarf(reise.segmente.length, reise.strom.length);
  const ms = (v: number) => `${v.toLocaleString("de-DE", { maximumFractionDigits: 0 })} ms`;
  return (
    <>
      <Erzaehlt>
        Jetzt reist jedes Segment über {LEITUNGEN.length} Leitungen und {KNOTEN.filter(k => k.router).length} Router bis Tokio — durch Funk, Kupfer, Glasfaser an Land und Seekabel
        unter dem Meer. Jeder Router packt den Rahmen aus, liest die <b>IP-Zieladresse</b>, zieht 1 von der TTL ab und packt in einen <b>neuen Rahmen</b> für die nächste Strecke.
      </Erzaehlt>
      <div className="card p-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted text-xs"><th className="py-1">Von → nach</th><th>Leitung</th><th>TTL</th></tr></thead>
          <tbody>
            {LEITUNGEN.map((l, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1.5">{KNOTEN[i].ort} → {KNOTEN[i + 1].ort}</td>
                <td>{MEDIEN[l.medium].icon} {MEDIEN[l.medium].name}</td>
                <td className="font-mono">{ttlAuf(i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Kasten titel="⏱ Wie lange dauert das?">
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>Einmal bis Tokio: <b>{ms(z.einwegMs)}</b> — fast nur die Laufzeit des Lichts im Kabel (rund 200 000 km/s).</li>
          <li>Vorher zwei Handschläge (TCP und TLS), je einmal hin und zurück: {ms(2 * z.rttMs)}.</li>
          <li>TCP schickt erst 10 Segmente und wartet auf Bestätigung, dann 20, 40 … — für {zahl(reise.segmente.length)} Segmente {z.runden} Runde{z.runden === 1 ? "" : "n"}.</li>
          <li>Engpass ist Lenas Upload (40 Mbit/s): {ms(z.engpassMs)} reine Sendezeit.</li>
          <li className="font-bold">Zusammen etwa {(z.gesamtMs / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s.</li>
        </ul>
      </Kasten>
      <button className="btn btn-primary self-start" onClick={zurKarte}>🗺️ Den Weg auf der Karte ansehen</button>
    </>
  );
}

// ── Tokio: hinauf ───────────────────────────────────────────────────────────

function Haken({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <div className={`flex items-start gap-2 text-sm ${ok ? "" : "text-bad"}`}><span>{ok ? "✅" : "❌"}</span><span>{children}</span></div>;
}

function Empfaenger({ nr, reise, inhalt, modell, seg, setSeg }: { nr: SchichtNr; reise: ReiseDaten; inhalt: Inhalt; modell: Modell; seg: number; setSeg: (n: number) => void }) {
  const letzte = LEITUNGEN.length - 1;
  const f = useMemo(() => rahmen(reise, seg, letzte), [reise, seg, letzte]);
  const p = useMemo(() => pruefe(f.bytes), [f]);
  const n = reise.segmente.length;

  if (nr === 1) {
    return (
      <>
        <Erzaehlt>In Tokio kommt das letzte Stück per Glasfaser an: Lichtpulse. Der Empfänger erkennt an der Präambel den Takt und macht daraus wieder Bits und Bytes.</Erzaehlt>
        <Kasten titel={`${MEDIEN.glas.icon} ${VERFAHREN.glas.name}`} farbe={schicht(1).farbe}>
          <SignalBild bits={bitsVon(new Uint8Array([...PRAEAMBEL.subarray(6), ...f.bytes.subarray(0, 4)]), 6, true)} medium="glas" />
          <p className="text-xs text-muted">{VERFAHREN.glas.text}</p>
        </Kasten>
      </>
    );
  }
  if (nr === 2) {
    const empfangen = (f.bytes[f.bytes.length - 4] | (f.bytes[f.bytes.length - 3] << 8) | (f.bytes[f.bytes.length - 2] << 16) | (f.bytes[f.bytes.length - 1] << 24)) >>> 0;
    return (
      <>
        <Erzaehlt>Der Server rechnet die CRC-32 über den Rahmen selbst nach und vergleicht sie mit der mitgeschickten. Stimmt sie, und ist die Ziel-MAC seine eigene, wirft er den Rahmen weg und behält das Paket.</Erzaehlt>
        <Segmentwahl seg={seg} setSeg={setSeg} n={n} />
        <div className="card p-3 flex flex-col gap-1">
          <Haken ok={p.fcs}>Prüfsumme: mitgeschickt <span className="font-mono">0x{empfangen.toString(16).padStart(8, "0")}</span>, nachgerechnet <span className="font-mono">0x{f.fcs.toString(16).padStart(8, "0")}</span></Haken>
          <Haken ok>Ziel-MAC <span className="font-mono">{hex(f.bytes.subarray(0, 6), ":")}</span> = eigene Netzwerkkarte</Haken>
        </div>
        <p className="text-xs text-muted">Wäre unterwegs auch nur ein Bit gekippt, stimmte die Summe nicht: Der Rahmen würde verworfen, TCP schickt das Stück neu (Reiter »Pakete«).</p>
      </>
    );
  }
  if (nr === 3) {
    return (
      <>
        <Erzaehlt>Der IP-Kopf: Ist das Paket für mich? Ist der Kopf heil?</Erzaehlt>
        <Segmentwahl seg={seg} setSeg={setSeg} n={n} />
        <div className="card p-3 flex flex-col gap-1">
          <Haken ok={p.ip}>Kopfprüfsumme <span className="font-mono">0x{lies16(f.bytes, 24).toString(16).padStart(4, "0")}</span> stimmt</Haken>
          <Haken ok>Ziel <span className="font-mono">{ipText(f.bytes.subarray(30, 34))}</span> = eigene Adresse</Haken>
          <Haken ok>TTL ist jetzt <b>{f.bytes[22]}</b> — gestartet mit 64, also haben {64 - f.bytes[22]} Router weitergereicht</Haken>
          <Haken ok>Absender <span className="font-mono">{ipText(f.bytes.subarray(26, 30))}</span> — Lenas Heimrouter, nicht ihr Handy (NAT)</Haken>
        </div>
      </>
    );
  }
  if (nr === 4) {
    return (
      <>
        <Erzaehlt>
          TCP prüft jedes Segment, sortiert alle {zahl(n)} nach der Folgenummer und schickt Bestätigungen zurück: »Bis Byte so-und-so habe ich alles.« Fehlt eins, wird es nachgefordert.
        </Erzaehlt>
        <Segmentwahl seg={seg} setSeg={setSeg} n={n} />
        <div className="card p-3 flex flex-col gap-1">
          <Haken ok={p.tcp}>TCP-Prüfsumme von Segment #{seg} stimmt (über Kopf, Daten und IP-Adressen)</Haken>
          <Haken ok>Folgenummer {zahl(reise.segmente[seg - 1].seq)} → Byte {zahl(reise.segmente[seg - 1].von)} im Strom</Haken>
          <Haken ok>Alle {zahl(n)} Segmente da und in Reihenfolge — {zahl(reise.strom.length)} Byte</Haken>
        </div>
      </>
    );
  }
  return <TokioOben nr={nr} reise={reise} inhalt={inhalt} modell={modell} />;
}

/** Schicht 5–7 in Tokio: wirklich auspacken, entschlüsseln, Foto zusammensetzen */
function TokioOben({ nr, reise, inhalt }: { nr: SchichtNr; reise: ReiseDaten; inhalt: Inhalt; modell: Modell }) {
  const a = useMemo(() => auspacken(reise, alleRahmenInTokio(reise)), [reise]);
  const gleich = !!a.inhalt && a.inhalt.length === reise.inhalt.length && a.inhalt.every((v, i) => v === reise.inhalt[i]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!a.inhalt || inhalt.art !== "jpeg") return;
    const u = URL.createObjectURL(new Blob([a.inhalt.slice()], { type: "image/jpeg" }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [a, inhalt.art]);

  if (nr === 5) {
    return (
      <>
        <Erzaehlt>Die Daten gehören zu der Sitzung, die Lena vorhin aufgebaut hat — der Server weiß dadurch, mit welchem Schlüssel er öffnen muss und wer angemeldet ist.</Erzaehlt>
        <div className="card p-3"><Haken ok>Sitzung bekannt: Lena, Schlüssel aus dem Handschlag (ChaCha20-Poly1305)</Haken></div>
      </>
    );
  }
  if (nr === 6) {
    return (
      <>
        <Erzaehlt>Jetzt wird entschlüsselt: Für jeden Datensatz prüft der Server zuerst das <b>Siegel</b> (Poly1305). Hätte unterwegs jemand ein Bit verändert, ginge das Siegel kaputt — der Server würde ablehnen.</Erzaehlt>
        <div className="card p-3 flex flex-col gap-1">
          <Haken ok={!!a.http}>{a.datensaetze} Datensatz{a.datensaetze === 1 ? "" : "e"} entsiegelt und entschlüsselt</Haken>
          {a.http && <Haken ok>{inhalt.art === "jpeg" ? "JPEG erkannt (beginnt mit FF D8)" : "Text als UTF-8 gelesen"}</Haken>}
        </div>
        {a.http && <HexBild bytes={a.http} bis={48} bereiche={[{ schicht: 7, name: "HTTP (wieder lesbar)", von: 0, laenge: a.http.length }]} />}
      </>
    );
  }
  return (
    <>
      <Erzaehlt>
        Die Anwendung bekommt die HTTP-Anfrage, speichert {inhalt.art === "jpeg" ? "das Foto" : "die Nachricht"} und antwortet <code>HTTP/1.1 201 Created</code>.
        Die App von Lenas Bruder holt es dort ab — wieder durch alle Schichten, nur in die andere Richtung.
      </Erzaehlt>
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <Kasten titel="Angekommen" farbe={schicht(7).farbe}>
          {inhalt.art === "jpeg"
            ? url && <img src={url} alt="Das in Tokio zusammengesetzte Foto" className="rounded-lg max-h-72 object-contain" />
            : a.inhalt && <p className="text-lg">{new TextDecoder().decode(a.inhalt)}</p>}
          <Haken ok={gleich}>Aus {zahl(reise.segmente.length)} Rahmen zusammengesetzt — Byte für Byte gleich mit dem Original ({zahl(reise.inhalt.length)} Byte)</Haken>
        </Kasten>
        <Kasten titel="Anfrage und Antwort" farbe={schicht(7).farbe}>
          <pre className="font-mono text-xs bg-[#060a14] text-amber-200 rounded-lg p-3 overflow-x-auto">{a.kopf}{"\n\n"}{"→ HTTP/1.1 201 Created"}</pre>
        </Kasten>
      </div>
    </>
  );
}

