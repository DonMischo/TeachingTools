# Plan: Simulation »Druck & Strömung« (Slug `stroemung`)

Stand 2026-11-11. Folgeprojekt zum Reiter »💧 Wassermodell« in `stromkreis`.
Entschieden: alle drei Stufen (Kl. 7/8 Druck, Kl. 9/10 Strömung, Technik/Beruf),
**Stationen + Baukasten**, **Umschalter Flüssigkeit/Gas** auf denselben Netzen,
elektrische Überblendung wie im Wassermodell.

## Kernidee

Ein Rohrnetz ist ein Stromkreis: Druck p ≙ Potenzial, Volumenstrom Q ≙ Strom,
Strömungswiderstand ≙ R, Pumpe ≙ Quelle, Behälter ≙ Kondensator,
Rückschlagventil ≙ Diode. Ein Löser rechnet alle Stationen und den Baukasten;
die Stationen sind nur fest gebaute Netze mit eigenem Bild.

Was über den Stromkreis hinausgeht und deshalb eigens modelliert wird:

| Physik | Umsetzung |
|---|---|
| Schweredruck p = ρ·g·h | Jeder Knoten hat eine Höhe; gerechnet wird mit dem Gesamtdruck p + ρgh (bei Gas ρ ≈ 0 ⇒ Höhe egal — selbst ein Lerninhalt) |
| Offener Behälter | Kapazität C = A/(ρg): Zufluss hebt den Spiegel, der Druck am Boden folgt |
| Gas im Druckkessel | Boyle (isotherm): p·V = const, C = V/p hängt vom Druck ab ⇒ je Zeitschritt linearisiert |
| Rohrreibung | Laminar R = 8ηL/(πr⁴) (Hagen-Poiseuille) als Standard; turbulent Δp ∝ Q² als Schalter ab Kl. 9/10 (Newton wie bei den Dioden im Stromkreis) |
| Kontinuität, Bernoulli | Fließgeschwindigkeit v = Q/A je Rohrstück; Venturi-Station rechnet p + ½ρv² entlang der Engstelle (nicht im Netzlöser, eigene Formel) |
| Pascal | Hydraulikzylinder: Kraft F = p·A, Kolbenweg aus verdrängtem Volumen |

Elektrische Überblendung überall dieselbe: Regler »Wasser/Luft ↔ Strom«,
Bauteile bekommen ihr Schaltzeichen, Werte in V/A/Ω (Maßstab je Station
angegeben, z. B. 1 bar ≙ 1 V). Grenzen der Analogie stehen an der Station
(Schweredruck und Gas-Kompression haben kein sauberes elektrisches Gegenstück).

## Stationen

**Kl. 7/8 — Druck**
1. *Tauchen* — Schweredruck mit der Tiefe, Wasser/Salzwasser/Öl, Bodendruck-Paradoxon (Gefäßformen).
2. *Kommunizierende Röhren & Wasserturm* — Spiegel gleichen sich aus; Haus mit Stockwerken: oben weniger Druck.
3. *Hydraulische Presse / Bremse* — Pascal: F₁/A₁ = F₂/A₂, Kraft gegen Weg; Luftblase in der Bremsleitung (Gas-Schalter) macht die Bremse weich.
4. *Luftdruck* — Strohhalm, Saugheber, Höhe der Wassersäule (10 m-Grenze); Link zum Teilchenmodell in `atommodelle`.

**Kl. 9/10 — Strömung**
5. *Rohrnetz* — das Wassermodell verallgemeinert: Reihe, parallel, Knotenregel, Rohrdicke (r⁴!).
6. *Venturi* — Engstelle: schneller ⇒ weniger Druck; Wasserstrahlpumpe, Zerstäuber.

**Technik / Beruf**
7. *Heizkreis* — Umwälzpumpe, Kessel, drei Heizkörper parallel, Thermostatventile, **hydraulischer Abgleich** (fernster Heizkörper bleibt kalt, bis abgeglichen).
8. *Hausanschluss* — Versorgungsdruck, Druckminderer, Stockwerke, gleichzeitiges Zapfen: Dusche wird schwach, wenn unten jemand spült.
9. *Druckluft* — Kompressor, Kessel (lädt wie ein Kondensator), Druckregler, Zylinder einfach/doppelt wirkend, 5/2-Wegeventil (Pneumatik-Schaltzeichen nach DIN ISO 1219).

Jede Station: Bild + Regler + Messwerte-Tabelle (Fluid | Strom) + 2–4 Versuche
mit Leitfrage, wie im Wassermodell.

## Baukasten

Raster-Editor wie `stromkreis`. Teile: offener Behälter, Druckkessel, Pumpe
(Kennlinie Δp(Q) linear fallend), Rohr (Länge, Durchmesser), Ventil,
Rückschlagventil, Druckminderer, Zylinder, Zapfstelle/Heizkörper,
Manometer, Durchflussmesser. Umschalter Flüssigkeit/Gas für das ganze Netz.
Speichern/Öffnen als JSON, Vorgabe der Lehrkraft per Sitzung (kompakt, ≤ 4 kB)
wie im Stromkreis.

**Wiederverwendung:** `lib/stromkreis/editor.ts` hängt nur an `modell.ts`
(Typ `BauteilArt` + `anschluesse`). Er wird generisch über die Teileart und
eine übergebene `anschluesse`-Funktion; `lgs.ts` (Gauß + Knotenzähler) wird
direkt benutzt. Sicherheitsnetz: `stromkreisEditor.test.ts` muss danach grün
bleiben. Die Zeichenfläche wird nicht geteilt (anderes Bild), nur ihr
Bedienmuster.

## Phasen (jede mit Prüfschritt)

1. **Löser** `lib/stroemung/` — Netz mit Knotenhöhen, Rohr laminar/turbulent,
   Pumpe, offener Behälter, Gaskessel, Rückschlagventil, Zylinder.
   *Prüfen:* Tests — kommunizierende Röhren gleichen aus, Pascal-Kräfte,
   Kontinuität (Σ Q = 0 je Knoten), Energiebilanz, Kessel lädt exponentiell,
   r⁴-Gesetz, bei Gas ist die Höhe egal.
2. **Gerüst + Anmeldung** — Seite, Reiterleiste, alle Pflichtstellen
   (tool_catalog, SESSION_TOOLS, Play-Map, Karte, featureHelp, faecher:
   Physik + Technik/WAT, standalone, README, features.yml).
   *Prüfen:* `test_every_joinable_tool_can_open_a_session`, `faecher.test.tsx`.
3. **Stationen 1–4** (Kl. 7/8). *Prüfen:* Vorschau im Pane, Werte gegen Hand-Rechnung.
4. **Stationen 5–6** (Kl. 9/10) inkl. Überblendung. *Prüfen:* wie 3.
5. **Stationen 7–9** (Technik). *Prüfen:* Abgleich-Szenario kippt erst nach Abgleich.
6. **Baukasten** — Editor generisch machen, Teile, Gas-Schalter, Dateien, Vorgabe.
   *Prüfen:* Stromkreis-Tests grün, neue Editor-/Datei-Tests, Vorgabe passt in 4 kB.
7. Optional: TaskCrawler-Station, Quellen-Register.

Phasen 3–5 hängen nur an 1 und 2 und könnten danach parallel laufen
(getrennte Dateien je Station).

## Offen

- Einheiten in den Stationen: bar oder hPa/kPa? Vorschlag: Kl. 7/8 in bar und
  m Wassersäule, Kl. 9/10 und Technik in bar und L/min.
- Fächer-Zuordnung: Physik sicher; Technik/WAT und Berufsorientierung prüfen.
