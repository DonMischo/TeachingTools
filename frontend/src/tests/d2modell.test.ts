import { describe, expect, it } from "vitest";
import {
  alleKanten, alleKnoten, einstellen, findeKnoten, idZuKlasse, kanteLoeschen, kanteSetzen,
  kanteZuVerbindung, kindHinzufuegen, klasseZuId, knotenHinzufuegen, knotenLoeschen,
  knotenSetzen, parse, quote, serialize,
} from "@/lib/diagramm/d2modell";
import { KI_REGELN, VORLAGEN, kiPrompt } from "@/lib/diagramm/vorlagen";
import { codeAusAntwort, zeileHervorheben } from "@/lib/diagramm/hervorheben";

describe("D2-Modell: lesen", () => {
  it("liest Knoten, Kanten, Beschriftungen und Stile", () => {
    const m = parse([
      'start: "Los geht\'s" {',
      "  shape: oval",
      '  style.fill: "#fde68a"',
      "}",
      "start -> frage: weiter",
      "frage.shape: diamond",
    ].join("\n"));
    const start = findeKnoten(m, "start")!;
    expect(start.label).toBe("Los geht's");
    expect(start.shape).toBe("oval");
    expect(start.stil.fill).toBe("#fde68a");
    expect(findeKnoten(m, "frage")!.shape).toBe("diamond");
    const [k] = alleKanten(m);
    expect(k).toMatchObject({ von: "start", nach: "frage", pfeil: "->", label: "weiter" });
  });

  it("zerlegt Ketten und kennt alle Pfeilarten", () => {
    const m = parse("a -> b <- c\nc <-> d\nd -- e");
    expect(alleKanten(m).map(k => `${k.von}${k.pfeil}${k.nach}`)).toEqual(["a->b", "b<-c", "c<->d", "d--e"]);
  });

  it("liest Container mit vollen Pfaden", () => {
    const m = parse("g: Gruppe {\n  a -> b\n  b.shape: circle\n}");
    expect(alleKnoten(m).map(k => k.id)).toEqual(["g", "g.b"]);
    expect(alleKanten(m)[0]).toMatchObject({ von: "g.a", nach: "g.b" });
  });

  it("liest Einstellungen aus vars und direction", () => {
    const m = parse("vars: {\n  d2-config: {\n    theme-id: 4\n    sketch: true\n    layout-engine: elk\n  }\n}\ndirection: right\na");
    expect(m.einstellungen).toEqual({ theme: 4, sketch: true, layout: "elk", direction: "right" });
  });

  it("behält Unverstandenes als Rohtext", () => {
    const code = "classes: {\n  wichtig: { style.bold: true }\n}\na.class: wichtig\n*.style.font-size: 20\n(a -> b)[0].style.stroke: red";
    const m = parse(code);
    expect(m.eintraege.filter(e => e.art === "roh")).toHaveLength(4);
    expect(serialize(m)).toBe(code + "\n");
  });

  it("Groß-/Kleinschreibung zählt nicht, wie in D2", () => {
    const m = parse("Start: Anfang\nstart.shape: oval");
    expect(alleKnoten(m)).toHaveLength(1);
    expect(findeKnoten(m, "START")!.shape).toBe("oval");
  });
});

describe("D2-Modell: schreiben", () => {
  it("lässt unberührten Code stehen (Einstellungen wandern nach oben)", () => {
    const code = [
      "# Mein Ablauf",
      "direction: down",
      "",
      "start: Start {shape: oval}",
      "start -> ende   # Kommentar",
      "",
      "ende: Ende",
    ].join("\n");
    expect(serialize(parse(code))).toBe([
      "direction: down",
      "",
      "# Mein Ablauf",
      "",
      "start: Start {shape: oval}",
      "start -> ende",
      "# Kommentar",
      "",
      "ende: Ende",
      "",
    ].join("\n"));
  });

  it("schreibt nur den bearbeiteten Knoten neu", () => {
    const code = "a: Eins {shape: oval}\nb: Zwei\na -> b";
    const neu = serialize(knotenSetzen(parse(code), "b", "style.fill", "#ff0000"));
    expect(neu).toBe('a: Eins {shape: oval}\nb: Zwei {\n  style.fill: "#ff0000"\n}\na -> b\n');
  });

  it("legt eine Deklaration an, wenn der Knoten nur in einer Kante steht", () => {
    const m = knotenSetzen(parse("a -> b"), "b", "label", "Ziel");
    expect(serialize(m)).toBe("a -> b\nb: Ziel\n");
  });

  it("schreibt Container mit relativen Pfaden zurück", () => {
    const m = knotenSetzen(parse("g: {\n  a -> b\n}"), "g", "label", "Gruppe");
    expect(serialize(m)).toBe("g: Gruppe {\n  a -> b\n}\n");
  });

  it("Mindmap-Ast: neuer Knoten samt Verbindung", () => {
    const { modell, id } = kindHinzufuegen(parse("thema: Wasser"), "thema", "Kreislauf");
    expect(id).toBe("k1");
    expect(serialize(modell)).toBe("thema: Wasser\nk1: Kreislauf\nthema -> k1\n");
  });

  it("vergibt keine Id doppelt, auch nicht gegen Namen aus dem Diagramm", () => {
    const { id } = knotenHinzufuegen(parse("k1 -> k2"), "Neu", ["k3"]);
    expect(id).toBe("k4");
  });

  it("Kanten bearbeiten und löschen", () => {
    let m = parse("a -> b\na -> b");
    const [, zweite] = alleKanten(m);
    m = kanteSetzen(m, zweite.uid, "label", "nein");
    m = kanteSetzen(m, zweite.uid, "pfeil", "<->");
    m = kanteSetzen(m, zweite.uid, "style.stroke-dash", "3");
    expect(serialize(m)).toBe("a -> b\na <-> b: nein {\n  style.stroke-dash: 3\n}\n");
    expect(serialize(kanteLoeschen(m, zweite.uid))).toBe("a -> b\n");
  });

  it("Knoten löschen nimmt Kinder und Kanten mit", () => {
    const m = knotenLoeschen(parse("g: {\n  a\n}\nx -> g.a\nx -> y\ng -> y"), "g");
    expect(serialize(m)).toBe("x -> y\n");
  });

  it("Einstellungen landen als vars-Block oben", () => {
    let m = parse("a -> b");
    m = einstellen(m, "theme", 300);
    m = einstellen(m, "sketch", true);
    m = einstellen(m, "direction", "right");
    expect(serialize(m)).toBe("vars: {\n  d2-config: {\n    theme-id: 300\n    sketch: true\n  }\n}\ndirection: right\n\na -> b\n");
  });

  it("setzt Anführungszeichen nur wo nötig", () => {
    expect(quote("Hallo Welt")).toBe("Hallo Welt");
    expect(quote("Größe?")).toBe("Größe?");
    expect(quote("#ff0000")).toBe('"#ff0000"');
    expect(quote('Sag "hi": jetzt')).toBe('"Sag \\"hi\\": jetzt"');
    expect(quote("null")).toBe('"null"');
    // gelesen wie geschrieben
    const m = knotenSetzen(parse("a"), "a", "label", 'Sag "hi": jetzt');
    expect(findeKnoten(parse(serialize(m)), "a")!.label).toBe('Sag "hi": jetzt');
  });
});

describe("D2-Modell: Vorlagen", () => {
  it.each(VORLAGEN.filter(v => v.code))("$name ist vollständig im Bausteine-Modus bearbeitbar", ({ code }) => {
    const m = parse(code);
    expect(m.eintraege.filter(e => e.art === "roh" && !e.raw.startsWith("#"))).toEqual([]);
    const einmal = serialize(m);
    expect(serialize(parse(einmal))).toBe(einmal);
    if (!code.includes("#")) expect(einmal).toBe(code);
  });
});

describe("D2-Code einfärben", () => {
  const arten = (zeile: string) => zeileHervorheben(zeile).filter(s => s.art !== "leer").map(s => `${s.art}:${s.text}`);

  it("unterscheidet Schlüssel, reservierte Wörter, Werte, Pfeile und Kommentare", () => {
    expect(arten('a.style.fill: "#ff0000" # rot')).toEqual([
      "schluessel:a", "satzzeichen:.", "reserviert:style", "satzzeichen:.", "reserviert:fill",
      "satzzeichen::", 'text:"#ff0000"', "kommentar:# rot",
    ]);
    expect(arten("start -> mitte-teil: ja {")).toEqual([
      "schluessel:start", "pfeil:->", "schluessel:mitte-teil", "satzzeichen::", "wert:ja", "klammer:{",
    ]);
    expect(arten("theme-id: 4")).toEqual(["reserviert:theme-id", "satzzeichen::", "zahl:4"]);
  });

  it("merkt sich Farbwerte für die Farbunterstreichung", () => {
    expect(zeileHervorheben('style.fill: "#bbf7d0"').find(s => s.art === "text")!.farbe).toBe("#bbf7d0");
  });

  it("verliert kein Zeichen", () => {
    for (const z of ['a <-> "b c": x;y {', "  # nur Kommentar", 'kaputt: "offen', "x<-y--z"]) {
      expect(zeileHervorheben(z).map(s => s.text).join("")).toBe(z);
    }
  });

  it("nimmt aus einer KI-Antwort nur den Codeblock", () => {
    expect(codeAusAntwort("Hier ist dein Diagramm:\n```d2\na -> b\n```\nViel Spaß!")).toBe("a -> b\n");
    expect(codeAusAntwort("a -> b")).toBe("a -> b");
  });
});

describe("D2-Modell: Diagramm-Zuordnung", () => {
  it("entschlüsselt die Klassen der SVG-Ausgabe", () => {
    // echte Klasse aus der D2-Ausgabe für (k1 -> g.a)[0]
    expect(klasseZuId("KGsxIC0mZ3Q7IGcuYSlbMF0=")).toBe("(k1 -> g.a)[0]");
    expect(klasseZuId(idZuKlasse("Ärger <-> Glück"))).toBe("Ärger <-> Glück");
    expect(klasseZuId("shape")).toBeNull();
  });

  it("ordnet doppelte Verbindungen der Reihe nach zu", () => {
    const m = parse("a -> b: eins\nb -> c\na -> b: zwei");
    const verbindungen = [
      { id: "(a -> b)[0]", src: "a", dst: "b" },
      { id: "(b -> c)[0]", src: "b", dst: "c" },
      { id: "(a -> b)[1]", src: "a", dst: "b" },
    ];
    expect(kanteZuVerbindung(m, verbindungen, "(a -> b)[1]")!.label).toBe("zwei");
    expect(kanteZuVerbindung(m, verbindungen, "(b -> c)[0]")!.von).toBe("b");
  });
});

describe("Prompt für eine KI", () => {
  it("enthält Thema, Wunschliste, alle Regeln und nur die Regeln der gewählten Art", () => {
    const p = kiPrompt({ art: "ablauf", thema: "Brot backen", zusatz: "Teig, Ofen" });
    expect(p).toContain("ein Ablaufdiagramm");
    expect(p).toContain("Thema: Brot backen");
    expect(p).toContain("Das soll vorkommen: Teig, Ofen");
    for (const r of KI_REGELN) expect(p).toContain(`- ${r}`);
    expect(p).toContain("Entscheidungen als diamond");
    expect(p).not.toContain("Mindmap:");
  });

  it("schickt das bisherige Diagramm als Codeblock mit", () => {
    const p = kiPrompt({ art: "mindmap", thema: "", bisher: "a -> b\n" });
    expect(p).toContain("Baue auf diesem Diagramm auf");
    expect(p.endsWith("```d2\na -> b\n```")).toBe(true);
    expect(kiPrompt({ art: "mindmap", thema: "x" })).not.toContain("Baue auf");
  });
});
