# Datenformat Curriculum-Abgleich

Eine Vorlage ist **eine JSON-Datei** mit allem, was das Tool `/tools/curriculum` braucht.
Teile davon (nur `lehrplaene`, nur `abgleich`, nur `curriculum`) dürfen einzeln hochgeladen
werden; das Tool ersetzt dann nur diesen Teil.

```jsonc
{
  "format": "tt-curriculum/1",
  "fach": "Mathematik",
  "niveaus": ["G", "R", "H", "LB", "GE"],      // Gymnasial-, Realschul-, Hauptschulniveau, Förderschwerpunkte
  "bloecke": ["5/6", "7/8", "9/10"],            // angezeigte Blöcke (Physik: 7/8, 9/10); H endet mit Klasse 9

  "lehrplaene": [ Lehrplan, … ],                // alt und neu, je Schulart einer
  "abgleich":   [ Paar, … ],                    // alte Karte ↔ neue Karte
  "curriculum": { "stand": "2025-09", "klassen": [ Klasse, … ] }
}
```

## Lehrplan

```jsonc
{
  "id": "rs2011",                 // rs2011 | gy2018 | rs2026 | gy2026
  "rolle": "alt",                 // alt | neu
  "schulart": "RS",               // RS | GY
  "titel": "Lehrplan Regelschule Mathematik 2011",
  "fassung": "Endfassung 28.08.2012",
  "quelle": "https://www.schulportal-thueringen.de/media/detail?tspi=1386",
  "inkraft": { "5": "2026/27", "8": "2027/28", … },  // nur neue Pläne: ab wann je Klassenstufe
  "karten": [ Karte, … ]
}
```

## Karte

Eine Karte = **ein Spiegelstrich (–) der Sach-(und Methoden-)kompetenz**, Unterpunkte (•) gehören dazu.
Selbst- und Sozialkompetenz, Lernausgangslage und Querschnittsaufgaben werden nicht übernommen.

```jsonc
{
  "id": "rs2011-56-zahl-03",      // <lehrplan>-<block ohne />-<kürzel bereich>-<laufende Nr.>
  "block": "5/6",                 // 5/6 | 7/8 | 9/10
  "klasse": 6,                    // Klassenstufe der Zielbeschreibung (6, 8, 9 oder 10)
  "bereich": "Zahl & Algebra",    // je Fach; Mathe: Zahl & Algebra | Funktionen | Geometrie | Stochastik | Größen,
                                  // Physik: Arbeitsweisen | Optik | Mechanik | Energie | Wärmelehre | Elektrizitätslehre
                                  //         | Astronomie | Kernphysik | Schwingungen und Wellen
  "lernbereich": "Natürliche Zahlen", // Überschrift im Lehrplan (bzw. Unterkapitel)
  "titel": "Natürliche Zahlen bis 1 Billion darstellen",  // ≤ 60 Zeichen, eigene Kurzform
  "niveaus": {                    // Wortlaut je Niveau; fehlt ein Niveau → Schlüssel weglassen
    "R": "natürliche Zahlen bis 1 Billion … darstellen und zwischen diesen wechseln",
    "H": "…"
  },
  "seite": 11                     // PDF-Seitenzahl (gedruckte Zahl)
}
```

Zuordnung der Niveaus:

| Lehrplan | Stelle | Niveau |
|---|---|---|
| RS 2011 | Kap. 2.1, 2.2 (Kl. 5–8) | `R` und `H` (gleicher Text) |
| RS 2011 | Kap. 2.3 Kl. 9 hauptschulabschlussbezogener Kurs | `H` |
| RS 2011 | Kap. 2.4 Kl. 9/10 realschulbezogen | `R` |
| RS 2026 | über beide Spalten / ohne Spalten | `R` und `H` |
| RS 2026 | Spalte bzw. Fußnote „Anspruchsebene I“ | `H` |
| RS 2026 | Spalte bzw. Fußnote „Anspruchsebene II“ | `R` |
| RS 2026 | Kl. 10 | `R` |
| GY 2018 / GY 2026 | Kl. 5–10 | `G` |

Unterscheiden sich AE I und AE II nur in einem Teil des Satzes, ist es **eine** Karte mit
beiden Wortlauten (`R` und `H` je vollständig ausformuliert).

## Paar (abgleich)

```jsonc
{
  "id": "rs-p001",                 // fehlt sie (KI-Antwort), vergibt der Server p1, p2, …
  "alt": ["rs2011-56-zahl-03"],    // 0..n alte Karten (leer = neu)
  "neu": ["rs2026-56-zahl-02"],    // 0..n neue Karten (leer = entfallen)
  "status": "geändert",            // identisch | geändert | verschoben | neu | entfallen
  "niveaus": ["R", "H"],           // betroffene Niveaus
  "unterschied": "Teilbarkeitsregeln für 9, 100, 1000 entfallen.",  // kurz, was sich ändert
  "von": "5/6", "nach": "7/8"      // nur bei verschoben
}
```

`verschoben` hat Vorrang: Wechselt eine Karte den Block **und** ändert sich der Inhalt, steht
`verschoben` mit Inhaltsänderung in `unterschied`.

## Klasse und Unterrichtseinheit (curriculum)

Im JSON heißt eine Unterrichtseinheit aus Kompatibilitätsgründen `thema` (Liste `themen`).

```jsonc
{
  "klasse": 5,
  "wochen_verfuegbar": 36,
  "themen": [
    {
      "id": "k5-t1",
      "titel": "Beispiel-Einheit",
      "wochen": 3,                  // eigene Schätzung; Bereich „2-4“ → Mittelwert
      "inhalte": { "G": "…", "R": "…", "H": "…", "LB": "…", "GE": "…" },
      "karten": ["rs2011-56-xxx-01", "gy2018-56-xxx-01"],       // passende ALTE Karten
      "zuordnung": {                // NEUE Karten je Kompetenzniveau
        "G": ["gy2026-56-xxx-01"],
        "R": ["rs2026-56-xxx-01"],
        "H": ["rs2026-56-xxx-01"]  // RS-Karte ohne H-Text: R-Text wird beim Zuordnen nach H kopiert
      },
      "notiz": ""
    }
  ]
}
```

## Zuordnung (nur zum Hochladen)

Antwort des KI-Prompts »Curriculum zuordnen«; fügt den genannten Unterrichtseinheiten Karten
hinzu (vorhandene bleiben). Alte Karten landen in `karten`, neue verteilen sich auf
`zuordnung`: GY → G, RS → R und H.

```jsonc
{ "format": "tt-curriculum/1", "zuordnung": [ { "thema": "k5-t1", "karten": ["rs2011-56-xxx-01"] } ] }
```

Das Tool leitet daraus ab:

- **Vorschläge**: Partner der alten Karten (über `abgleich`), die noch nicht zugeordnet sind.
- **Konflikt**: Eine Unterrichtseinheit hängt an einer alten Karte, die `entfällt`, oder ein
  Vorschlag bzw. eine zugeordnete Karte liegt neu in einer anderen Klasse (in 9/10 je Klassenstufe).
- **Offen**: Neue Karten des Blocks, die keine Einheit hat — weder zugeordnet noch als Vorschlag.
