"use client";
import { SCHICHTEN } from "@/lib/schichten/kapselung";

const ZEILEN: Record<number, { protokolle: string; geraet: string; aufgabe: string }> = {
  7: { protokolle: "HTTP, DNS, SMTP", geraet: "—", aufgabe: "Dienste für Programme: Webseite laden, Namen nachschlagen, E-Mail" },
  6: { protokolle: "JPEG, UTF-8, TLS", geraet: "—", aufgabe: "Daten in eine gemeinsame Form bringen: codieren, komprimieren, verschlüsseln" },
  5: { protokolle: "TLS-Handschlag, Anmeldung", geraet: "—", aufgabe: "Gespräch aufbauen, halten, beenden" },
  4: { protokolle: "TCP, UDP", geraet: "—", aufgabe: "Zerlegen, nummerieren, Verlorenes neu schicken; Ports = welches Programm" },
  3: { protokolle: "IPv4, IPv6", geraet: "Router", aufgabe: "Weg durch viele Netze finden; IP-Adressen" },
  2: { protokolle: "Ethernet, WLAN", geraet: "Switch, WLAN-Zugangspunkt", aufgabe: "Rahmen zum nächsten Gerät; MAC-Adressen, Fehler erkennen" },
  1: { protokolle: "Funk, Kupfer, Glasfaser", geraet: "Kabel, Repeater, Antenne", aufgabe: "Bits als Signal übertragen" },
};

export default function Wissen() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <div className="card p-4 lg:col-span-2 overflow-x-auto">
        <h3 className="font-bold mb-2">Die Schichten auf einen Blick</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted"><th className="py-1">OSI</th><th>TCP/IP</th><th>Einheit</th><th>Beispiele</th><th>Gerät</th><th>Aufgabe</th></tr>
          </thead>
          <tbody>
            {SCHICHTEN.map((s, i) => {
              const erste = SCHICHTEN.findIndex(x => x.tcpip === s.tcpip) === i;
              const spanne = SCHICHTEN.filter(x => x.tcpip === s.tcpip).length;
              return (
                <tr key={s.nr} className="border-t border-line align-top">
                  <td className="py-1.5 pr-2 font-bold whitespace-nowrap" style={{ color: s.farbe }}>{s.nr} {s.name}</td>
                  {erste && <td rowSpan={spanne} className="pr-2 font-semibold border-l border-line pl-2 align-middle">{s.tcpip}</td>}
                  <td className="pr-2">{s.einheit}</td>
                  <td className="pr-2">{ZEILEN[s.nr].protokolle}</td>
                  <td className="pr-2">{ZEILEN[s.nr].geraet}</td>
                  <td className="text-muted">{ZEILEN[s.nr].aufgabe}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card p-4 flex flex-col gap-2">
        <h3 className="font-bold">🧠 Merksatz (von 7 nach 1)</h3>
        <p className="text-lg"><b>A</b>lle <b>D</b>eutschen <b>S</b>tudenten <b>T</b>rinken <b>V</b>erschiedene <b>S</b>orten <b>B</b>ier</p>
        <p className="text-sm text-muted">Anwendung · Darstellung · Sitzung · Transport · Vermittlung · Sicherung · Bitübertragung. Englisch von 1 nach 7: »Please Do Not Throw Sausage Pizza Away«.</p>
      </div>
      <div className="card p-4 flex flex-col gap-2">
        <h3 className="font-bold">📦 Kapselung</h3>
        <p className="text-sm">Jede Schicht setzt ihren eigenen Kopf vor die Daten der Schicht darüber und kümmert sich nicht darum, was drinsteckt — ein Paket im Paket im Paket. Beim Empfänger nimmt jede Schicht genau ihren Kopf wieder ab.</p>
        <p className="text-sm">Jede Schicht spricht nur mit ihrer Partnerschicht auf der anderen Seite: TCP in Erfurt mit TCP in Tokio, auch wenn dazwischen acht Router liegen, die nur bis Schicht 3 hineinschauen.</p>
      </div>
      <div className="card p-4 flex flex-col gap-2">
        <h3 className="font-bold">🤔 OSI oder TCP/IP?</h3>
        <p className="text-sm">Das OSI-Modell (ISO, 1984) ist ein Denkmodell mit sieben sauber getrennten Aufgaben. Das Internet selbst ist nach dem einfacheren TCP/IP-Modell gebaut: Was OSI auf die Schichten 5, 6 und 7 verteilt, erledigen dort die Programme selbst — TLS etwa sitzt zwischen TCP und HTTP.</p>
      </div>
      <div className="card p-4 flex flex-col gap-2">
        <h3 className="font-bold">✅ Was hier echt gerechnet ist</h3>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>JPEG-Komprimierung im Browser, UTF-8 für Text</li>
          <li>TLS-1.3-Datensätze mit ChaCha20-Poly1305 (geprüft an den Testwerten aus RFC 8439)</li>
          <li>TCP-Segmente, IPv4-Köpfe, Ethernet-Rahmen mit allen Prüfsummen — auf jeder Leitung neu</li>
          <li>Auspacken in Tokio aus allen Rahmen, Byte für Byte verglichen</li>
          <li>Vereinfacht: nur 8 Router, keine TCP-Optionen, WLAN als Ethernet-Rahmen, ausgedachte Adressen</li>
        </ul>
      </div>
      <div className="card p-4 flex flex-col gap-2 lg:col-span-2">
        <h3 className="font-bold">📚 Quellen und Dank</h3>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>Idee und Geschichte (Lenas Katzenfoto nach Tokio): <b>rick.theengineer</b> auf Instagram — <a className="underline" href="https://www.instagram.com/rick.theengineer/" target="_blank" rel="noreferrer">instagram.com/rick.theengineer</a>. Danke!</li>
          <li>ISO/IEC 7498-1 (OSI-Referenzmodell) · RFC 791 (IPv4) · RFC 9293 (TCP) · RFC 8446 (TLS 1.3) · RFC 8439 (ChaCha20-Poly1305) · RFC 1035 (DNS) · RFC 1071 (Internet-Prüfsumme) · RFC 5737 (Adressen für Beispiele) · IEEE 802.3 (Ethernet)</li>
          <li>Küstenlinien: Natural Earth (gemeinfrei)</li>
        </ul>
      </div>
    </div>
  );
}
