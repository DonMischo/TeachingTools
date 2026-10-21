"use client";
/**
 * Spickzettel für den Code-Modus — für Schüler·innen geschrieben, nicht für
 * Informatiker·innen: jede Regel mit Beispiel (in denselben Farben wie im
 * Editor) und einem Satz, was im Bild passiert.
 */
import type { ReactNode } from "react";
import { CodeSchnipsel } from "./CodeFeld";

function Abschnitt({ icon, titel, children }: { icon: string; titel: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <span className="text-base">{icon}</span>{titel}
      </h3>
      {children}
    </section>
  );
}

function Beispiel({ code, children }: { code: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <CodeSchnipsel code={code} />
      <p className="text-xs text-muted leading-relaxed px-1">{children}</p>
    </div>
  );
}

const FORMEN_KURZ: [string, string][] = [
  ["rectangle", "Rechteck: ein Schritt, eine Tätigkeit (Standard)"],
  ["oval", "Oval: Start und Ende"],
  ["diamond", "Raute: eine Frage mit ja/nein"],
  ["parallelogram", "Parallelogramm: Eingabe oder Ausgabe"],
  ["circle", "Kreis"],
  ["hexagon", "Sechseck"],
  ["cylinder", "Zylinder: ein Speicher, eine Datenbank"],
  ["cloud", "Wolke: z. B. das Internet"],
  ["person", "Person: wer etwas tut"],
  ["document", "Dokument: ein Blatt Papier"],
];

export function Spickzettel() {
  return (
    <div className="flex flex-col gap-5 pt-3">
      <div className="rounded-lg border border-line bg-page p-3 text-sm leading-relaxed">
        <b>Die Grundregel:</b> Eine Zeile ist ein Befehl. Links vom Doppelpunkt steht der <b>Name</b> eines
        Kästchens — den brauchst du nur im Code, um es wiederzufinden. Rechts steht, was im Bild <b>zu lesen</b> ist.
        Groß- und Kleinschreibung beim Namen ist egal.
      </div>

      <Abschnitt icon="🟦" titel="Kästchen (Knoten)">
        <Beispiel code="hund">Ein Kästchen mit dem Namen »hund«. Im Bild steht dann auch »hund«.</Beispiel>
        <Beispiel code="hund: Mein Hund Bello">Name »hund«, aber im Bild steht »Mein Hund Bello«. So bleibt der Name kurz und der Text darf lang sein.</Beispiel>
      </Abschnitt>

      <Abschnitt icon="➡️" titel="Pfeile (Verbindungen)">
        <Beispiel code="hund -> futter">Pfeil von »hund« zu »futter«. Gibt es ein Kästchen noch nicht, entsteht es von selbst.</Beispiel>
        <Beispiel code="hund -> futter: frisst">Text am Pfeil — praktisch für »ja« und »nein« nach einer Frage.</Beispiel>
        <Beispiel code={"a <- b      # Pfeil zeigt nach links\na <-> b     # Pfeil in beide Richtungen\na -- b      # Linie ohne Pfeilspitze"}>
          Die Spitze zeigt immer dorthin, wo <code>&gt;</code> oder <code>&lt;</code> steht.
        </Beispiel>
        <Beispiel code="ei -> raupe -> puppe -> falter">Eine ganze Kette in einer Zeile.</Beispiel>
      </Abschnitt>

      <Abschnitt icon="🔷" titel="Formen">
        <Beispiel code={"frage: Hast du Hunger? {\n  shape: diamond\n}"}>
          Alles, was zu einem Kästchen gehört, kommt in geschweifte Klammern <code>{"{ }"}</code> dahinter.
          Jede öffnende Klammer braucht eine schließende!
        </Beispiel>
        <ul className="grid grid-cols-1 gap-1 text-xs px-1">
          {FORMEN_KURZ.map(([id, text]) => (
            <li key={id} className="flex gap-2">
              <code className="shrink-0 w-28 font-mono text-accent">{id}</code>
              <span className="text-muted">{text}</span>
            </li>
          ))}
        </ul>
      </Abschnitt>

      <Abschnitt icon="🎨" titel="Farben">
        <Beispiel code={"wichtig: Hausaufgaben {\n  style.fill: \"#fecaca\"\n  style.stroke: \"#dc2626\"\n  style.font-color: \"#7f1d1d\"\n}"}>
          <b>fill</b> = Füllung innen, <b>stroke</b> = Rahmen, <b>font-color</b> = Schrift.
          Die Farbe ist ein Farbcode mit <code>#</code> — und der muss in Anführungszeichen stehen,
          sonst hält D2 ihn für einen Kommentar. Farbcodes bekommst du im Bausteine-Modus: Farbe wählen, dann hier nachsehen.
        </Beispiel>
        <Beispiel code={"a: Ganz einfach {\n  style.fill: lightblue\n}"}>Englische Farbnamen gehen auch ohne <code>#</code>: red, green, blue, orange, yellow, pink, gray …</Beispiel>
        <Beispiel code={"a -> b {\n  style.stroke: red\n  style.stroke-dash: 3\n}"}>Pfeile kann man genauso färben. <b>stroke-dash</b> macht die Linie gestrichelt.</Beispiel>
        <Beispiel code={"a: Wichtig {\n  style.bold: true\n  style.font-size: 24\n  style.shadow: true\n}"}>Fett, größere Schrift und Schatten.</Beispiel>
      </Abschnitt>

      <Abschnitt icon="📦" titel="Gruppen (Kästchen in Kästchen)">
        <Beispiel code={"schule: Unsere Schule {\n  mensa: Mensa\n  hof: Schulhof\n  mensa -> hof\n}\nschule.hof -> bus: nach Hause"}>
          Was in den Klammern steht, liegt im großen Kästchen. Von außen erreichst du es mit einem Punkt:
          <code> schule.hof</code> heißt »der Hof in der Schule«.
        </Beispiel>
      </Abschnitt>

      <Abschnitt icon="🧭" titel="Richtung und Aussehen">
        <Beispiel code="direction: right">Das Diagramm wächst nach rechts. Geht auch: <b>down</b> (Standard), <b>up</b>, <b>left</b>. Für Mindmaps passt <b>right</b> gut.</Beispiel>
        <Beispiel code={"vars: {\n  d2-config: {\n    theme-id: 4\n    sketch: true\n  }\n}"}>
          Farbthema und Handzeichnungs-Stil. Am einfachsten stellst du das unten bei »Aussehen« ein — der Code hier oben ändert sich dann von selbst.
        </Beispiel>
      </Abschnitt>

      <Abschnitt icon="💬" titel="Kommentare und Anführungszeichen">
        <Beispiel code={"# Das ist eine Notiz nur für mich.\nhund -> futter   # auch am Zeilenende"}>
          Alles hinter <code>#</code> wird nicht gezeichnet — gut für Notizen und Erklärungen.
        </Beispiel>
        <Beispiel code={"platz: \"Platz #1\"\nmenge: \"Zahlen {1; 2; 3}\""}>
          Steckt in deinem Text eine Raute <code>#</code>, ein Semikolon <code>;</code> oder geschweifte
          Klammern <code>{"{ }"}</code>, setze ihn in Anführungszeichen. Sonst schneidet D2 den Text einfach ab —
          ohne Fehlermeldung. Doppelpunkte, Kommas und Fragezeichen im Text sind dagegen kein Problem.
        </Beispiel>
      </Abschnitt>

      <Abschnitt icon="🩹" titel="Es klappt nicht? Die häufigsten Fehler">
        <ul className="flex flex-col gap-1.5 text-xs leading-relaxed px-1 list-disc pl-5">
          <li><b>Klammer vergessen:</b> zu jedem <code>{"{"}</code> gehört ein <code>{"}"}</code>. Die Zeilennummer im Fehler zeigt oft auf die Zeile <i>danach</i>.</li>
          <li><b>Farbcode ohne Anführungszeichen:</b> <code>style.fill: #ff0000</code> geht nicht, <code>style.fill: &quot;#ff0000&quot;</code> schon.</li>
          <li><b>Text abgeschnitten?</b> Dann steckt ein <code>#</code>, <code>;</code> oder <code>{"{"}</code> darin. Anführungszeichen drum, z. B. <code>&quot;Platz #1&quot;</code>.</li>
          <li><b>Zwei Kästchen statt einem?</b> Dann hast du den Namen unterschiedlich geschrieben, z. B. <code>hund</code> und <code>hunde</code>.</li>
          <li><b>Rote Zeile:</b> Klick im Fehlerkasten auf »Zeile …« springt genau dorthin. Bis alles stimmt, zeigt das Bild die letzte funktionierende Fassung.</li>
          <li><b>Ganz verhauen?</b> Strg+Z macht Schritt für Schritt rückgängig.</li>
        </ul>
      </Abschnitt>

      <p className="text-xs text-muted">
        Noch mehr Möglichkeiten zeigt die <a className="underline" href="https://d2lang.com/tour/intro" target="_blank" rel="noreferrer">D2-Anleitung</a> (englisch).
      </p>
    </div>
  );
}
