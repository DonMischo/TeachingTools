"use client";
/**
 * Arbeitsauftrag je Missionsstufe: was genau zu tun ist, woran man merkt,
 * dass man fertig ist — und das Wissen dazu zum Aufklappen, je nach Niveau.
 */
import type { ReactNode } from "react";
import type { Ziel } from "@/lib/schichten/netz";
import type { Niveau } from "../Bausteine";

export type StufeId = "auftrag" | "ascii" | "bits" | "dns" | "packen" | "routing" | "ankunft";

interface Auftrag {
  schritte: ReactNode[];
  fertig: ReactNode;
  wissen: { titel: string; inhalt: ReactNode }[];
}

function auftrag(stufe: StufeId, niveau: Niveau, ziel: Ziel): Auftrag {
  const einfach = niveau === "einsteiger", experte = niveau === "experte";
  switch (stufe) {
    case "auftrag":
      return {
        schritte: [
          "Wähle, an wen Lena schreibt.",
          <>Tippe ein Wort mit <b>genau 8 Zeichen</b> — Buchstaben, Ziffern, Leerzeichen oder Satzzeichen, aber keine Umlaute. Oder nimm einen Vorschlag.</>,
          <>Klicke auf <b>»Los geht's«</b>.</>,
        ],
        fertig: "der Knopf »Los geht's« hell wird.",
        wissen: [
          { titel: "Warum genau 8 Zeichen?", inhalt: "Jedes Zeichen wird zu genau einem Byte (8 Bit). 8 Zeichen = 8 Byte = 64 Bit — klein genug, um alles von Hand zu rechnen, und groß genug, dass es in zwei Stücke zerteilt werden muss." },
          { titel: "Warum keine Umlaute?", inhalt: "Der ASCII-Code von 1963 kennt nur 128 Zeichen: das englische Alphabet, Ziffern und Satzzeichen. ä, ö, ü und ß gibt es dort nicht — heute braucht man für sie in UTF-8 zwei Byte." },
        ],
      };
    case "ascii":
      return {
        schritte: [
          <>Klappe unten die <b>ASCII-Tabelle</b> auf{einfach ? " (sie ist schon offen)" : ""}.</>,
          <>Suche jedes Zeichen deines Wortes und trage die Zahl daneben in das Kästchen darunter ein{experte ? <> — als <b>Hex-Zahl</b> (zwei Zeichen, z. B. 41 für A)</> : ""}.</>,
          <>Klicke auf <b>»Prüfen«</b>. Rot umrandete Kästchen sind noch falsch — verbessern und noch einmal prüfen.</>,
        ],
        fertig: "alle 8 Kästchen stimmen — dann geht es von selbst weiter zu den Bits.",
        wissen: [
          { titel: "So ist die ASCII-Tabelle aufgebaut", inhalt: <>Großbuchstaben A–Z: 65–90. Kleinbuchstaben a–z: 97–122 — immer genau 32 mehr als der Großbuchstabe. Ziffern »0«–»9«: 48–57. Leerzeichen: 32.</> },
          { titel: "Achtung: Ziffer ist nicht Zahl", inhalt: <>Das Zeichen »4« hat den Code 52, nicht 4. Der Computer speichert das Schriftzeichen, nicht seinen Wert.</> },
          ...(einfach ? [] : [{ titel: "Hex", inhalt: <>Hex schreibt jedes Byte mit zwei Ziffern aus 0–9 und A–F: »A« = 65 = 4·16 + 1 = 41₁₆. Darum sieht man in Hex-Bildern ASCII-Text gut wieder: 41 = A, 61 = a.</> }]),
        ],
      };
    case "bits":
      return {
        schritte: [
          <>In jeder Zeile steht ein Zeichen und sein Code. Über den Kästchen stehen die <b>Stellenwerte</b> 128, 64, 32 … 1.</>,
          <>Klicke Kästchen an (1 = an), bis die Stellenwerte der eingeschalteten Kästchen zusammen genau den Code ergeben{einfach ? " — rechts siehst du die Summe" : ""}.</>,
          <>Klicke auf <b>»Prüfen«</b>.</>,
        ],
        fertig: <>alle 8 Zeilen ein ✅ haben. Dann oben bzw. unten auf <b>»Weiter zu DNS-Jagd«</b>.</>,
        wissen: [
          { titel: "Stellenwerte", inhalt: "Im Zweiersystem verdoppelt sich der Wert von rechts nach links: 1, 2, 4, 8, 16, 32, 64, 128. Mit 8 Bit kann man 256 verschiedene Zahlen bilden: 0 bis 255." },
          { titel: "Rechentrick", inhalt: "Fang links an: Passt der Stellenwert in die Zahl? Dann Bit an und abziehen. Sonst Bit aus. Weiter nach rechts, bis der Rest 0 ist." },
        ],
      };
    case "dns":
      return {
        schritte: [
          <>Klicke einen <b>Root-Server</b> an (oranger Rahmen, Spalte »Root«).</>,
          <>Lies rechts seine Antwort. Sie nennt eine <b>IP-Adresse</b> eines anderen Servers.</>,
          <>Klicke im Bild den Server mit <b>genau dieser IP-Adresse</b> an.</>,
          "Wiederhole das, bis ein Server die Adresse des Ziels verrät.",
        ],
        fertig: <>rechts »✅ Gefunden: {ziel.name} = …« steht. Dann <b>»Weiter zu Packen«</b>.</>,
        wissen: [
          { titel: "Namen liest man von rechts", inhalt: <><b>{ziel.name}</b>: ganz rechts die Endung (.example — wie .de oder .jp), davor die Domain ({ziel.domain}), ganz links der Rechner. Genau in dieser Reihenfolge fragst du nach.</> },
          { titel: "Wer weiß was?", inhalt: "Root-Server kennen nur die Server der Endungen. Der Endungs-Server kennt nur die Server der Domains. Erst der Domain-Server kennt die Adresse des Rechners. Keiner weiß alles — darum ist DNS so robust." },
          ...(einfach ? [] : [{ titel: "Cache", inhalt: "Der Resolver merkt sich jede Antwort eine Weile (TTL des Eintrags, hier 3600 s). Beim zweiten Foto fragt er niemanden mehr." }]),
        ],
      };
    case "packen":
      return {
        schritte: [
          "Beantworte die Fragen eine nach der anderen — der farbige Balken oben zeigt, wo du bist.",
          "Klicke die richtige Antwort an (oder tippe die Zahl ein und »Prüfen«).",
          <>Bei einer falschen Antwort steht der Grund darunter — lies ihn und versuch es noch einmal. Bei einer richtigen geht es mit <b>»Weiter ▶«</b> zur nächsten Frage.</>,
        ],
        fertig: <>du deine zwei fertigen Rahmen als Hex-Bild siehst. Dann <b>»Weiter zu Routing«</b>.</>,
        wissen: [
          {
            titel: "IP, Port, MAC — was ist was?",
            inhalt: (
              <ul className="list-disc pl-5 space-y-1">
                <li><b>IP-Adresse</b> = Hausadresse im ganzen Internet. Sie bleibt von Lena bis {ziel.ort} gleich.</li>
                <li><b>Port</b> = Zimmertür im Haus: welches Programm auf dem Server die Daten bekommt (443 = verschlüsselte Webdienste).</li>
                <li><b>MAC-Adresse</b> = Gerätenummer im eigenen Netz. Sie gilt nur bis zum nächsten Gerät und wird an jeder Station neu geschrieben.</li>
              </ul>
            ),
          },
          ...(einfach ? [] : [{ titel: "Folgenummer", inhalt: "TCP zählt Bytes, nicht Pakete: Segment 2 beginnt dort, wo Segment 1 aufhört. Startet Segment 1 bei 1000 und trägt 4 Byte, beginnt Segment 2 bei 1004." }]),
          ...(experte ? [{ titel: "Gesamtlänge", inhalt: "Das IP-Feld »Gesamtlänge« zählt IP-Kopf + alles darin, aber nicht den Ethernet-Rahmen." }] : []),
        ],
      };
    case "routing":
      return {
        schritte: [
          <>Lies oben rechts die <b>Zieladresse</b> und wo das Paket gerade liegt (📦 im Netz).</>,
          <>Gehe in der <b>Routingtabelle</b> die Zeilen durch: Welche passen zur Zieladresse?{einfach ? " (✅ = passt)" : ""}</>,
          <>Nimm von den passenden Zeilen die mit der <b>größten Zahl hinter dem »/«</b>.</>,
          <>Klicke im Netz den Router an, der in dieser Zeile steht (lila umrandet sind die Nachbarn). Steht dort »direkt hier«, klicke <b>»Hier direkt zustellen«</b>.</>,
          "Am nächsten Router geht es von vorn los.",
        ],
        fertig: <>»Zugestellt!« erscheint. Dann <b>»Weiter zu Ankunft«</b>.</>,
        wissen: [
          {
            titel: "Was heißt /24, /8, /0?",
            inhalt: (
              <ul className="list-disc pl-5 space-y-1">
                <li><b>/24</b>: die ersten 24 Bit müssen gleich sein — das sind die ersten <b>drei</b> Zahlen. 203.0.113.7 passt zu 203.0.113.0/24.</li>
                <li><b>/8</b>: nur die erste Zahl muss gleich sein. 203.0.113.7 passt zu 203.0.0.0/8.</li>
                <li><b>/25</b>: die ersten drei Zahlen und dazu, ob die vierte unter oder ab 128 liegt.</li>
                <li><b>/0</b>: passt immer — die Standardroute, der letzte Ausweg.</li>
              </ul>
            ),
          },
          { titel: "Warum die größte Zahl?", inhalt: "Je mehr Bit übereinstimmen müssen, desto genauer beschreibt die Zeile das Ziel. Eine genaue Angabe schlägt eine ungefähre — wie »Lindenstraße 5« gegen »irgendwo in Erfurt«." },
          ...(einfach ? [] : [{ titel: "TTL", inhalt: "Jeder Router zieht 1 von der Lebenszeit ab. So kann ein Paket nicht ewig im Kreis laufen, wenn Tabellen einmal falsch sind." }]),
        ],
      };
    default:
      return {
        schritte: [
          "Schau zu, wie der Server dein Wort zurückverwandelt: Bits → Zahlen → Zeichen.",
          "Sieh dir deine Sterne an — je weniger Fehlversuche, desto mehr.",
          <>Probier eine <b>neue Mission</b> mit einem anderen Ziel: Der Weg durchs Netz ist dann ein anderer.</>,
        ],
        fertig: "du alle vier Empfänger einmal erreicht hast.",
        wissen: [
          { titel: "Rückwärts durch die Schichten", inhalt: "Beim Empfänger nimmt jede Schicht genau ihren eigenen Umschlag ab: Rahmen (2), Paket (3), Segment (4) — dann setzt TCP die Stücke nach Folgenummer zusammen, und die App liest den Text." },
        ],
      };
  }
}

export default function AuftragsKasten({ stufe, niveau, ziel }: { stufe: StufeId; niveau: Niveau; ziel: Ziel }) {
  const a = auftrag(stufe, niveau, ziel);
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div className="card p-4 border-l-4 border-l-[var(--color-accent)]">
        <h3 className="font-bold mb-1">🎯 Deine Aufgabe</h3>
        <ol className="list-decimal pl-5 space-y-1 text-sm">
          {a.schritte.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
        <p className="text-sm mt-2"><b>✅ Fertig, wenn</b> {a.fertig}</p>
      </div>
      <details className="card p-4" open={niveau === "einsteiger"}>
        <summary className="cursor-pointer font-bold">📘 Wissen dazu</summary>
        <div className="flex flex-col gap-2 mt-2 text-sm">
          {a.wissen.map(w => (
            <div key={w.titel}>
              <div className="font-semibold">{w.titel}</div>
              <div className="text-muted leading-relaxed">{w.inhalt}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
