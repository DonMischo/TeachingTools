# Workshop: TT – Teaching Tools (online)

Alles für den Online-Workshop an einem Ort. Die Übungsinstanz läuft auf diesem Rechner und ist über einen
Cloudflare-Quick-Tunnel aus dem Internet erreichbar. Sie hat eine eigene Datenbank und nur erfundene Daten;
die Schulinstanz (Port 1339) läuft unberührt weiter. Nicht für den Produktivbetrieb.

| Datei | Was | Im Repo |
|---|---|---|
| `workshop.bat` | Start, Stopp, Zurücksetzen (ruft `workshop.ps1` auf) | ja |
| `beschreibung.md` | Kurzbeschreibung für die Anmeldung | ja |
| `docker-compose.workshop.yml` | Overlay für die zweite Instanz (Port 1340) | ja |
| `TT-Workshop-Pitch.pptx` | Folien, gebaut von `presentations/create-workshop-pitch.js` | nein |
| `qr-handout.png`, `begleitseite.html` | QR und Kopie der Begleitseite | nein |
| `zugaenge/` | Zugänge und fertige Nachrichten, bei jedem Start neu | nein |
| `instanz/` | Zustand der Übungsinstanz (Daten, Schlüssel, Tunnel-Log) | nein |

Begleitseite (vorher über »Teilen« auf »jeder mit dem Link« stellen):
https://claude.ai/artifact/45iY9BVaE1CfivcxnUoBfq

## Bedienung

```bat
workshop\workshop.bat start -Anzahl 30
workshop\workshop.bat stop
workshop\workshop.bat reset
```

- `start` fährt die Instanz hoch, öffnet den Tunnel, legt `moderation` und `ws01` … `ws30` an, importiert
  360 erfundene Schüler·innen (5a–10c) und die Beispiele und schreibt `zugaenge/`. Die Adresse landet in
  der Zwischenablage. Der erste Start baut das Frontend und dauert einige Minuten.
- `stop` schließt den Tunnel, die Daten bleiben. Beim nächsten `start` gibt es eine neue Adresse,
  `zugaenge/` wird dann neu geschrieben (Passwörter bleiben gleich).
- `reset` löscht Datenbank, Zugänge und Uploads.

## Checkliste

1. Am Vortag: `start` einmal laufen lassen (Frontend gebaut, Beispiele da), dann `stop`.
2. Begleitseite teilen, Folien öffnen.
3. 15 Minuten vorher: `start`. TT selbst über die Tunnel-Adresse öffnen (nicht über localhost),
   dann zeigen alle Beitritts-QRs auf den Tunnel. Als `moderation` anmelden (Passwort in `zugaenge/zugaenge.txt`).
4. Demo »Zeitreise der Medien«: Sitzung starten, »Gäste erlauben«, Code zeigen.
5. Danach `stop`, nach dem Workshop `reset`.

## Zugänge verteilen

Zum **Mitspielen** braucht niemand ein Konto: Adresse und Code im Chat posten, Text liegt fertig in
`zugaenge/chat-nachricht.txt`. Gäste kommen per Code für genau eine Sitzung hinein.

Zum **Selberbauen** (Vorlage, KI, Hochladen) braucht jede·r einen Lehrkraft-Zugang `wsNN`. Möglichkeiten:

- **Privatnachricht (empfohlen):** Teilnehmerliste im Videotool durchnummerieren und jeder Person ihre
  Zeile aus `zugaenge/privat-nachrichten.txt` privat schicken. Eine Zeile enthält Adresse, Benutzer und Passwort.
- **Breakout-Räume:** Je Raum ein Zugang für die Gruppe; dann reichen wenige Privatnachrichten, und
  in Gruppen zu bauen ist im Workshop ohnehin angenehmer.
- **Zugangskarten:** `zugaenge/Zugangskarten.html` hat je Zugang eine Karte mit QR-Code. Für Präsenz drucken
  und schneiden; online lässt sich eine Karte als Bildschirmfoto schicken.
- **Gemeinsame Liste:** Alle Zeilen in ein Pad stellen und jede·r trägt den eigenen Namen hinter einen
  Zugang ein. Am schnellsten, aber alle sehen alle Passwörter. Vertretbar, weil die Instanz nur erfundene
  Daten hat und nach dem Workshop gelöscht wird.

Nicht im öffentlichen Chat posten: das Passwort von `moderation` (Admin).
