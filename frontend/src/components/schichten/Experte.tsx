"use client";
/**
 * 🎓 Expertendetails je Schritt: Prüfsummen von Hand, Krypto-Bausteine,
 * Feinheiten aus den RFCs. Alle Zahlen kommen aus der laufenden Reise.
 */
import { hex, hex2, lies16 } from "@/lib/schichten/bytes";
import { MSS, type Reise, type SchichtNr, rahmen } from "@/lib/schichten/kapselung";
import { LEITUNGEN } from "@/lib/schichten/route";

const h4 = (v: number) => v.toString(16).padStart(4, "0");

function Box({ children }: { children: React.ReactNode }) {
  return (
    <details className="card p-4 border-l-4 border-l-[#6366f1]" open>
      <summary className="cursor-pointer font-bold">🎓 Für Experten</summary>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed">{children}</div>
    </details>
  );
}

/** RFC 1071 Schritt für Schritt über einen IPv4-Kopf */
export function PruefsummeVonHand({ kopf, pruefen }: { kopf: Uint8Array; pruefen: boolean }) {
  const k = kopf.slice();
  const echt = lies16(kopf, 10);
  if (!pruefen) { k[10] = 0; k[11] = 0; }
  const woerter = Array.from({ length: 10 }, (_, i) => lies16(k, i * 2));
  let summe = 0;
  const zwischen = woerter.map(w => (summe += w));
  const uebertrag = summe >>> 16, gefaltet = (summe & 0xffff) + uebertrag;
  const ergebnis = ~gefaltet & 0xffff;
  return (
    <div className="flex flex-col gap-1">
      <p>{pruefen
        ? "Der Empfänger addiert alle zehn 16-Bit-Wörter samt mitgeschickter Prüfsumme. Ist alles heil, kommt nach dem Falten 0xffff heraus — das Komplement ist 0."
        : "Der Absender setzt das Prüfsummenfeld auf 0, addiert die zehn 16-Bit-Wörter, faltet den Übertrag zurück und nimmt das Einerkomplement."}</p>
      <div className="font-mono text-xs grid grid-cols-[auto_auto_auto] gap-x-6 w-fit bg-[#060a14] text-slate-300 rounded-lg p-3">
        <span className="text-muted">Wort</span><span className="text-muted">Wert</span><span className="text-muted">Summe</span>
        {woerter.map((w, i) => (
          <span key={i} className="contents">
            <span>{i + 1}{i === 5 ? (pruefen ? " (Prüfsumme)" : " (0 gesetzt)") : ""}</span>
            <span>0x{h4(w)}</span>
            <span>0x{zwischen[i].toString(16)}</span>
          </span>
        ))}
      </div>
      <p className="font-mono text-xs">
        0x{summe.toString(16)} → Übertrag {uebertrag} zurückaddieren: 0x{h4(summe & 0xffff)} + {uebertrag} = 0x{h4(gefaltet)} → Komplement: <b>0x{h4(ergebnis)}</b>
        {pruefen ? (ergebnis === 0 ? " ✅ heil" : " ❌ beschädigt") : ergebnis === echt ? " ✅ = Feld im Kopf" : ""}
      </p>
    </div>
  );
}

export default function Expertendetails({ seite, nr, reise, seg }: { seite: "lena" | "unterwegs" | "tokio"; nr: SchichtNr | null; reise: Reise; seg: number }) {
  const letzte = LEITUNGEN.length - 1;
  const f = rahmen(reise, seg, seite === "tokio" ? letzte : 0);

  if (seite === "unterwegs") {
    return (
      <Box>
        <p>Jeder Router zieht die TTL um 1 ab und muss die IP-Kopfprüfsumme anpassen — meist nicht neu, sondern inkrementell (RFC 1624): HC′ = ~(~HC + ~m + m′). Die TCP-Prüfsumme bleibt unberührt, außer beim Heimrouter: NAT ändert Adresse und Port, beide stecken über den Pseudo-Kopf in der TCP-Summe.</p>
        <p>Welche Leitung ein Router nimmt, steht in seiner Weiterleitungstabelle (längster Präfix). Zwischen Netzbetreibern verteilt BGP diese Wege. <code>tracert</code> nutzt die TTL: Pakete mit TTL 1, 2, 3 … sterben am ersten, zweiten, dritten Router, und jeder meldet per ICMP »Time Exceeded« zurück.</p>
        <p>Laufzeit im Glas: Brechungsindex ≈ 1,47 → rund 204 000 km/s. Die reine Sendezeit eines 1514-Byte-Rahmens bei 100 Gbit/s sind ~0,12 µs, am 40-Mbit/s-Upload ~0,3 ms — der Engpass ist die letzte Meile.</p>
      </Box>
    );
  }
  const ip = f.bytes.subarray(14, 34);
  switch (nr) {
    case 7:
      return seite === "lena" ? (
        <Box>
          <p>DNS-Nachricht (RFC 1035), hier {reise.dns.length} Byte, über UDP an Port 53:</p>
          <ul className="font-mono text-xs space-y-0.5">
            <li>{hex(reise.dns.subarray(0, 2))} — ID, damit die Antwort zur Frage passt</li>
            <li>{hex(reise.dns.subarray(2, 4))} — Flags: RD = 1 (»frag rekursiv für mich weiter«)</li>
            <li>{hex(reise.dns.subarray(4, 12))} — je eine Frage, keine Antworten/Autoritäten/Zusätze</li>
            <li>{hex(reise.dns.subarray(12, reise.dns.length - 4))} — Name als Labels: Längenbyte + ASCII, 00 am Ende</li>
            <li>{hex(reise.dns.subarray(reise.dns.length - 4))} — Typ A (IPv4), Klasse IN</li>
          </ul>
          <p>HTTP läuft hier innerhalb von TLS über TCP 443. Welches Protokoll (HTTP/1.1 oder HTTP/2) gesprochen wird, handeln Client und Server schon im TLS-Handschlag aus (ALPN).</p>
        </Box>
      ) : (
        <Box><p>Antwort <code>201 Created</code> mit <code>Location: /v1/fotos/…</code>. Der Server bestätigt erst, wenn alle Bytes laut <code>Content-Length</code> da sind. Die Empfänger-App holt das Foto später per <code>GET</code> — oder bekommt eine Push-Nachricht.</p></Box>
      );
    case 6: {
      const d = reise.datensaetze[0];
      const nonce1 = reise.iv.slice();
      nonce1[11] ^= 1;
      return (
        <Box>
          <p>TLS 1.3 (RFC 8446), AEAD ChaCha20-Poly1305 (RFC 8439). Je Datensatz:</p>
          <ul className="font-mono text-xs space-y-0.5">
            <li>Kopf {hex(d.kopf)} — Typ 0x17, »Version« 03 03 (aus Kompatibilität), Länge {lies16(d.kopf, 3)}</li>
            <li>Klartext innen = Daten ‖ 0x17 (der wahre Inhaltstyp steckt verschlüsselt drin)</li>
            <li>Nonce = IV ⊕ Folgenummer: {hex(reise.iv, "")} (Satz 0), {hex(nonce1, "")} (Satz 1)</li>
            <li>AAD = der 5-Byte-Kopf — er wird mitgesiegelt, aber nicht verschlüsselt</li>
            <li>Siegel (Poly1305) von Satz 0: {hex(d.versiegelt.subarray(d.versiegelt.length - 16), "")}</li>
          </ul>
          <p>Schlüssel und IV stammen aus dem Handschlag: X25519-Schlüsseltausch, dann HKDF-Ableitungen (Key Schedule). Jede Richtung hat eigene Schlüssel; nach genug Daten kann neu abgeleitet werden (KeyUpdate).</p>
          <p className="text-xs text-muted">ChaCha20: 20 Runden aus Addition, Rotation, XOR auf 16 Wörtern. Poly1305: Polynom über dem Körper mod 2¹³⁰ − 5. Beides hier in TypeScript nachgebaut und gegen die Testwerte aus RFC 8439 geprüft.</p>
        </Box>
      );
    }
    case 5:
      return (
        <Box>
          <p>TLS 1.3 braucht für den Handschlag nur einen Hin- und Rückweg (1-RTT): ClientHello trägt schon den X25519-Schlüsselanteil. Mit einem Sitzungsticket (PSK) geht die Wiederaufnahme schneller, mit 0-RTT dürfen erste Daten sogar gleich mit — aber wiederholbar (Replay), deshalb nur für harmlose Anfragen.</p>
          <p>Im OSI-Modell gehört das zur Sitzungsschicht; im Internet gibt es dafür keinen eigenen Kopf.</p>
        </Box>
      );
    case 4: {
      const tcp = f.bytes.subarray(34, 54);
      return (
        <Box>
          <p>MSS = MTU 1500 − 20 (IP) − 20 (TCP) = {MSS}. Folgenummer = ISN + 1 + Byte-Versatz; die ISN ist zufällig (Schutz gegen eingeschleuste Segmente).</p>
          <p>Prüfsumme über Pseudo-Kopf (Absender-IP, Ziel-IP, 0, Protokoll 6, TCP-Länge) + TCP-Kopf + Daten:</p>
          <ul className="font-mono text-xs space-y-0.5">
            <li>Pseudo: {hex(ip.subarray(12, 20))} 00 06 {h4(f.bytes.length - 4 - 34).replace(/(..)(..)/, "$1 $2")}</li>
            <li>Kopf:   {hex(tcp)}</li>
            <li>Feld:   0x{h4(lies16(tcp, 16))}</li>
          </ul>
          <p>Byte 12: obere 4 Bit = Kopflänge in 32-Bit-Wörtern (5 → 20 Byte). Byte 13 = Flags: 0x10 ACK, 0x08 PSH, 0x02 SYN, 0x01 FIN.{seite === "tokio" ? " Der Empfänger bestätigt kumulativ; mit SACK kann er Lücken genau benennen." : ""}</p>
        </Box>
      );
    }
    case 3:
      return (
        <Box>
          <PruefsummeVonHand kopf={ip} pruefen={seite === "tokio"} />
          <p className="text-xs text-muted">Byte 6–7: Flags + Fragment-Offset (0x4000 = DF). Kennung {lies16(ip, 4)} — bei Fragmentierung hielte sie die Teile zusammen.</p>
        </Box>
      );
    case 2:
      return (
        <Box>
          <p>FCS = CRC-32 mit dem Polynom 0x04C11DB7 (bitgespiegelt 0xEDB88320), Startwert 0xFFFFFFFF, am Ende invertiert, über Ziel-MAC bis Ende der Nutzlast. Gesendet wird sie niedrigstes Byte zuerst: {hex(f.bytes.subarray(f.bytes.length - 4))}.</p>
          <p>Die CRC findet jeden Fehlerblock bis 32 Bit Länge; zufällige Fehler rutschen nur etwa einmal in 4 Milliarden Fällen durch (2⁻³²). Korrigieren kann sie nichts; der Rahmen wird verworfen und TCP sorgt für Ersatz.</p>
          <p>Die MAC des Routers holt sich das Handy per ARP (»Wer hat 192.168.178.1?«). In echt ist der erste Rahmen ein 802.11-Funkrahmen mit drei Adressfeldern; der Zugangspunkt übersetzt ins Ethernet-Format.</p>
        </Box>
      );
    default:
      return (
        <Box>
          <p>Vor dem Rahmen: 7 × 0x55 (10101010 — ein Takt zum Einschwingen) und 0xD5 (Start Frame Delimiter). Jedes Byte geht mit dem niedrigsten Bit zuerst auf die Leitung: 0x{hex2(f.bytes[0])} = {f.bytes[0].toString(2).padStart(8, "0")} wird als {f.bytes[0].toString(2).padStart(8, "0").split("").reverse().join("")} gesendet.</p>
          <p>WLAN (802.11ax) nutzt OFDM mit bis zu 1024-QAM: 10 Bit pro Symbol und Unterträger, hunderte Unterträger parallel. Glasfaser im Backbone: kohärente Übertragung mit Phase und Polarisation, viele Wellenlängen pro Faser (DWDM).</p>
        </Box>
      );
  }
}
