"""Was ein TaskCrawler in 2.5D nutzen kann: Ansichten, Stile, Objekte, Werkzeuge.

Eine Quelle für beides: die Prüfung beim Hochladen (routers/exitgame.py) und
die Liste `_katalog` in der interaktiven Vorlage, die eine KI beim Ausfüllen liest.
Muss zum Frontend passen — ein Test dort vergleicht die Schlüssel:
  ansichten  → ANSICHTEN in frontend/src/app/play/taskcrawler/[code]/page.tsx
  stile      → STILE in frontend/src/components/gebaeude/szene.ts
  objekte    → OBJEKTE in frontend/src/lib/gebaeude/objekte.ts
  werkzeuge  → SIM_STATIONEN in frontend/src/components/exitgame/SimStation.tsx
"""

ANSICHTEN = {
    "folien": "Klassisch Folie für Folie.",
    "gebaeude": "Haus: jeder Abschnitt ein Stockwerk, die Tür wird die Treppe hinauf.",
    "verlies": "Verlies: Ebenen gehen hinab, nur die aktuelle ist zu sehen, dunkel mit Fackel; "
               "Monster in den Aufgabenräumen, ein Boss bewacht jede Treppe.",
    "ebene": "Ebene: die Abschnitte liegen nebeneinander, eine verschlossene Tür in der Wand führt weiter.",
}

STILE = {
    "klassisch": "Helles Haus mit braunen Wänden (Standard im Haus).",
    "beton": "Grauer Sichtbeton, flache Wände.",
    "neon": "Dunkles Glas, leuchtende Zimmer mit roten Lichtsäulen.",
    "garten": "Gartenpalast: helle Mauern mit Hecken obenauf, am Wasser.",
    "verlies": "Dunkler Stein (Standard im Verlies).",
    "burg": "Burg: hohe Steinmauern mit roten Zinnen, Steinfliesen.",
    "holz": "Holzhütte: Dielenboden, dunkle Balken.",
    "eis": "Eispalast: hellblaues Eis mit Schneekappen.",
    "wueste": "Wüstentempel: Sandstein, blaue Türen, gefliester Boden.",
    "raumstation": "Raumstation: dunkles Metall, türkis leuchtende Zimmer.",
    "lava": "Lavahöhle: schwarzer Fels, glühende Zimmer — passt zum Verlies.",
    # Epochen — gut für "stile" (ein Stil je Abschnitt), z.B. eine Reise durch die Geschichte
    "steinzeit": "Steinzeithöhle: Erdboden, grobe Felswände.",
    "antike": "Antiker Tempel: Marmorfliesen, weiße Säulenwände, Terrakotta.",
    "mittelalter": "Mittelalter: Fachwerk mit weißen Wänden und dunklen Balken.",
    "gotisch": "Gotik: hohe dunkle Steinmauern, Zimmer leuchten violett wie Kirchenfenster.",
    "viktorianisch": "Viktorianisch (19. Jh.): Parkett, grüne Tapete, Goldleisten, Gusseisen.",
    "retro": "Retro (1970er): oranger Teppich, cremefarbene Wände, olivgrüne Türen.",
}

OBJEKTE = {
    "pult": "Schreibtisch (Standard)",
    "computer": "Computer",
    "kuckucksuhr": "Kuckucksuhr",
    "globus": "Globus",
    "regal": "Bücherregal (Standard für 'example')",
    "mikroskop": "Mikroskop",
    "tafel": "Tafel (Standard für 'explanation')",
    "laborbank": "Labortisch",
    "tresor": "Tresor",
    "teleskop": "Teleskop",
    "kalender": "Wandkalender (Standard für kind 'timeline')",
    "waage": "Waage",
    "abakus": "Abakus",
    "monster": "Monster — liegt besiegt am Boden, sobald gelöst (Standard für Aufgaben im Verlies)",
    "boss": "Bossmonster (steht im Verlies ohnehin vor jeder Treppe)",
    # Medien durch die Zeit
    "hoehlenwand": "Felswand mit Höhlenmalerei (Tiere in Ocker, Handabdruck)",
    "tontafel": "Tontafel mit Keilschrift auf einem Holzblock",
    "schriftrolle": "Papyrusrolle auf dem Tisch, Rollen im Korb",
    "buch": "Handschrift mit bunter Initiale am Lesepult, Kerze",
    "druckerpresse": "Gutenbergs Druckerpresse",
    "zeitung": "Zeitungsständer mit Stapel und Schlagzeile",
    "telegraph": "Telegraf mit Morsetaste und Papierstreifen",
    "telefon": "Kurbeltelefon aus Holz an der Wand",
    "radio": "Röhrenradio",
    "filmprojektor": "Filmprojektor mit zwei Spulen und Lichtkegel",
    "fernseher": "Röhrenfernseher der 50er mit Zimmerantenne",
    "grossrechner": "Großrechner-Schränke mit Lämpchen (ENIAC-Zeit)",
    "laptop": "Laptop",
    "smartphone": "Smartphone mit App-Kacheln",
    "tablet": "Tablet",
    "kopfhoerer": "Kopfhörer auf einem Ständer (Musik, Streaming)",
    "grafiktablett": "Bildschirm mit Bildbearbeitung, Zeichenbrett und Stift",
    "kikern": "KI-Rechenzentrum: Server mit leuchtendem neuronalen Netz",
    "lagerfeuer": "Lagerfeuer im Steinkreis (Erzählen vor der Schrift)",
    "quipu": "Knotenschnüre der Inka an einem Stab",
    "orakelknochen": "Orakelknochen und Schildkrötenpanzer mit Zeichen (China)",
    "faltbuch": "Maya-Faltbuch (Codex) auf einem Steinsockel",
    "tastenhandy": "Tastenhandy der 2000er mit grünem Display",
    "retropc": "Röhren-PC der 70er/80er mit grüner Schrift",
}

# Jedes Werkzeug: was es ist und welche Schlüssel "config" kennt. Ein "?" am
# Schlüssel heißt optional; "a|b|c" heißt: genau einer dieser Werte.
WERKZEUGE = {
    "gleichungswaage": {
        "name": "Gleichungswaage",
        "config": {
            "gleichung": "Zahlen: eine Gleichung, z.B. '3x + 4 = 19'",
            "formel": "Variablen: eine Formel, z.B. 'E = m·g·h' (dazu 'nach' und 'werte')",
            "nach": "Variablen: nach welcher Größe umgestellt wird, z.B. 'h'",
            "werte": "Variablen: bekannte Werte, z.B. {\"E\": 60, \"m\": 2, \"g\": 10} — der gesuchte bleibt verdeckt, bis die Größe allein steht",
            "reaktion": "Chemie: eine Reaktion zum Ausgleichen, z.B. 'H2 + O2 -> H2O'",
        },
        "hinweis": "Genau eines von gleichung, formel oder reaktion angeben.",
    },
    "funktionen": {
        "name": "Funktionen (Graph + Wertetabelle)",
        "config": {
            "term": "Funktionsterm, z.B. 'x^2 - 4'",
            "von?": "linker Rand der Wertetabelle (Zahl)",
            "bis?": "rechter Rand (Zahl)",
            "schritt?": "Schrittweite (Zahl)",
            "pi?": "true = Achse in Vielfachen von π",
        },
    },
    "vierecke": {
        "name": "Vierecke",
        "config": {
            "form": "quadrat|rechteck|parallelogramm|trapez|raute|drachen",
            "masse": "Maße als Zahlen, z.B. {\"a\": 8, \"c\": 4, \"h\": 3}",
            "blatt?": "formen|umfang|flaeche",
            "rechnung?": "true = Umfang und Fläche werden angezeigt (sonst verborgen)",
        },
    },
    "rechenregeln": {
        "name": "Rechenregeln",
        "config": {
            "term": "Term für Obstkorb oder Rechenzug, z.B. '2 + 3 · (4 − 1)'",
            "reiter?": "korb|zug|stufen (Standard: korb bzw. stufen bei a/b)",
            "a": "Stufenzahlen: Zahl, z.B. 3.5",
            "b": "Stufenzahlen: Stufenzahl, z.B. 100",
            "art?": "Stufenzahlen: '*' oder ':'",
        },
        "hinweis": "Entweder term oder a + b.",
    },
    "binaerrechner": {"name": "Binär-Rechner", "config": {"zahl": "Startzahl 0-255"}},
    "abacus": {"name": "Abakus", "config": {"reiter": "single|place"}},
    "bildformate": {"name": "Bildformate", "config": {"reiter": "P1|P2|P3"}},
    "tippen": {"name": "10-Finger-Trainer", "config": {"reiter": "lektionen|wortregen|tastenjagd"}},
    "maus": {
        "name": "Maus-Führerschein",
        "config": {"reiter": "klick|doppelklick|rechtsklick|ziehen|markieren|kopieren|scrollen|tastatur|"
                             "explorer|fenster|screenshot|suche|apps|aussehen|bedienhilfe|taskleiste|profil"},
    },
    "ki": {"name": "KI-Werkstatt", "config": {"reiter": "sprache|bilder|lernen|echt"}},
    "sonnensystem": {
        "name": "Sonnensystem",
        "config": {"reiter": "uebersicht|flug|groessen|entfernungen|kepler|galerie|kodex"},
    },
    "kueste": {"name": "Küstendynamik", "config": {"reiter": "profil|draufsicht|gezeiten|galerie|wissen"}},
    "erdaufbau": {"name": "Aufbau der Erde", "config": {"reiter": "keil|profil|wellen|konvektion|wissen"}},
    "wilson": {
        "name": "Wilson-Zyklus",
        "config": {
            "reiter": "schnitt|quiz|wissen",
            "phase?": "ruhe|graben|jung|ozean|subduktion|schliessen|kollision|abtragung",
        },
    },
    "regeln": {
        "name": "Regel-Labor (MarkovJunior)",
        "config": {
            "reiter": "lehrgang|raetsel|labor|beispiele|labyrinthe|gebaeude",
            "station?": "bei lehrgang: lauf|wachsen|backtracker|bloecke|grundriss",
            "raetsel?": "bei raetsel: alles|punkte|schach|labyrinth|rundwege",
        },
    },
    "wfc": {
        "name": "Wellenfunktionskollaps",
        "config": {
            "reiter": "kacheln|vorlage|textur|erklaerung",
            "satz?": "bei kacheln: landschaft|strassen|rohre",
            "vorlage?": "bei vorlage: hoehlen|mauer|wege|insel|stadt",
            "probe?": "bei textur: fels|erde|sand|eis|marmor|stein|holz|parkett|teppich|fachwerk|metall|tapete|beton|putz "
                      "oder eine Vorlage (hoehlen|mauer|wege|insel|stadt)",
        },
    },
}

KATALOG = {
    "_lies_mich": "Nachschlageliste für die 2.5D-Felder. Nur lesen — beim Hochladen wird sie ignoriert.",
    "gebaeude.ansicht": ANSICHTEN,
    "gebaeude.stil": STILE,
    "gebaeude.stile": "Liste mit einem Stil je Abschnitt (Werte wie gebaeude.stil), z.B. [\"steinzeit\", \"gotisch\", \"neon\"]; fehlt ein Eintrag, gilt gebaeude.stil.",
    "slide.station": OBJEKTE,
    "task.sim": WERKZEUGE,
}
