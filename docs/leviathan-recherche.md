# Leviathan – Kunst des Regierens · Forschungsgrundlage & Spielentwurf

Name **»Leviathan – Kunst des Regierens«** (Slug `leviathan`). Der Name bezieht sich auf Hobbes (1651, gemeinfrei) und auf Acemoglu & Robinsons »gefesselten Leviathan« (The Narrow Corridor, 2019).
Eine vernetzte Regierungs-Simulation, *inspiriert von Frederic Vesters Vernetztem Denken (Ökolopoly, 1980)* –
aber mit eigenen Bereichen, eigenen Wirkungsfunktionen, eigenen Texten und auf den Stand der Forschung 2024–2026 gebracht.

Stand der Recherche: 30.09.2026.

---

## 0. Rechtslage (Kurzfassung)

- Ökolopoly/ecopolicy: alle Rechte bei **Malik Management Zentrum St. Gallen**; *ecopolicy®* ist eine eingetragene Marke und wird weiter vertrieben. Die DOS-Version auf goodolddays.net ist „Abandonware“ ohne erkennbare Lizenz → **nicht einbinden**.
- GitHub-Nachbauten (`WolfgangKonen/oekolopoly_v1`, `cherrisimo/oekolopoly`) haben **keine Lizenz** → nicht übernehmen.
- Spielmechanik ist nicht urheberrechtlich geschützt. Wir verwenden daher **keine** Namen, Tabellen, Texte oder Grafiken des Originals. Im Hilfetext genügt ein sachlicher Satz zur Inspiration.
- Beutelsbacher Konsens: Das Spielland ist **fiktiv**. Echte Länder erscheinen nur als *belegte Beispiele* für einen Ländertyp (Info-Panel), nie als Spielgegner oder mit Wertung. Ereignisse beschreiben Mechanismen, keine Parteien oder Personen.

---

## 1. Forschungsbefunde → Spielregeln

Jede Regel im Modell bekommt im Spiel einen **»Warum?«-Knopf** mit Kurzbefund und Quelle. Die Zahlen hier sind *Richtung und grobe Stärke*; im Spiel werden sie auf die 0–100-Skalen übersetzt, nicht 1:1 übernommen.

### 1.1 Demokratie, Populismus, Wirtschaft

| Befund | Stärke | Quelle | Regel im Spiel |
|---|---|---|---|
| Nach **Finanzkrisen** steigt der Stimmanteil der extremen Rechten im Schnitt um ca. **30 %**; nach *normalen* Rezessionen nicht. Polarisierung und Politik-Unsicherheit steigen. | stark, 20 Länder, 800+ Wahlen, 1870–2014 | Funke, Schularick & Trebesch 2016, *Eur. Econ. Rev.* | Schock »Bankenkrise« erhöht die Populismus-Wahrscheinlichkeit deutlich stärker als »Rezession«. |
| Anstieg der **Arbeitslosigkeit** → Misstrauen in nationale/europäische Institutionen und Stimmen für Anti-Establishment-Parteien; kaum Effekt auf zwischenmenschliches Vertrauen. | kausal identifiziert (Regionaldaten Europa) | Algan, Guriev, Papaioannou & Passari 2017, *Brookings Papers* | Wirtschaftliche Unsicherheit senkt **Institutionenvertrauen**, nicht »Zusammenhalt«. |
| Nach 15 Jahren populistischer Regierung liegt das BIP pro Kopf ca. **10 % unter** der Vergleichsentwicklung. | 51 populistische Regierungschefs, 60 Länder, 1900–2020 | Funke, Schularick & Trebesch 2023, *AER* 113(12) | Autokrat/Populist an der Macht: schleichender Wirtschafts-Malus, der sich über Runden aufsummiert. |
| **Demokratisierung** erhöht das BIP pro Kopf langfristig um ca. **20 %** (über ~25 Jahre). | 184 Länder, 1960–2010 | Acemoglu, Naidu, Restrepo & Robinson 2019, *JPE* 127(1) | Demokratiequalität wirkt langsam positiv auf Wirtschaft (Verzögerung mehrere Runden). |
| 2025: **74 %** der Weltbevölkerung leben in Autokratien, nur 7 % in liberalen Demokratien; 92 Autokratien vs. 87 Demokratien; 41 % leben in Ländern, die sich gerade autokratisieren; Meinungsfreiheit ist das am stärksten betroffene Merkmal. | Beschreibung | V-Dem Democracy Report 2026 (und 2025) | Kontext für Einleitung; »Pressefreiheit« ist das erste Opfer im Autokratie-Ereignis. |
| Weltweiter CPI-Durchschnitt 2025 auf **42/100** gefallen; 122 von 182 Ländern unter 50. | Beschreibung | Transparency International, CPI 2025 | Korruption ist ein Normalzustand, kein Sonderfall – Startwerte entsprechend. |

### 1.2 Vertrauen, Ungleichheit, Korruption

| Befund | Stärke | Quelle | Regel im Spiel |
|---|---|---|---|
| Hohe **Einkommensungleichheit** geht mit niedrigem allgemeinem Vertrauen einher; Wirkrichtung eher Ungleichheit → Misstrauen. Universelle Sozialleistungen stärken Vertrauen. | robust auf Länderebene, auf kleinerer Ebene schwächer | Rothstein & Uslaner 2005, *World Politics* („All for All“) | Gleichheit → Vertrauen (verzögert). **Universelle** Sozialinvestition wirkt stärker auf Vertrauen als gezielte. |
| Korruption, Ungleichheit und Misstrauen verstärken sich gegenseitig (»Ungleichheitsfalle«). | theoretisch + korrelativ | Rothstein & Uslaner 2005 | Verstärkende Schleife R4 (s. u.). |
| OECD 2023: **44 %** haben wenig/kein Vertrauen in die nationale Regierung, 39 % hohes/mittleres; seit 2021 gesunken. | 30 Länder, ~60 000 Befragte | OECD Trust Survey 2024 | Startwert Vertrauen in Industrieländern ≈ Mitte der Skala, nicht hoch. |

### 1.3 Informationsraum

| Befund | Stärke | Quelle | Regel im Spiel |
|---|---|---|---|
| Falschmeldungen verbreiten sich weiter, schneller, tiefer; werden **70 % häufiger** geteilt; Treiber sind Menschen (Neuheit, Empörung), nicht Bots. | 126 000 Meldungen, Twitter 2006–2017 | Vosoughi, Roy & Aral 2018, *Science* | Desinformation wächst von selbst, wenn niemand gegensteuert (verstärkende Schleife). |
| **Prebunking** (kurze Videos zu Manipulationstechniken) verbessert das Erkennen – auch im Feldversuch auf YouTube, ca. 0,05 $ pro Aufruf. | experimentell, groß | Roozenbeek, van der Linden et al. 2022, *Science Advances* | Medienkompetenz-Investition ist billig und wirkt schnell, aber nur teilweise. |
| Medienkompetenz-Index: Finnland 74, Dänemark 73, Norwegen 72 (2023). Index-Bausteine: Bildungsqualität, Pressefreiheit, Vertrauen, Beteiligung. | Index | Open Society Institute Sofia, MLI 2023 (2026: Dänemark, Finnland, Irland, Niederlande vorn) | Widerstandskraft gegen Desinformation = f(Bildung, Pressefreiheit, Vertrauen). |
| Mis-/Desinformation ist das **größte kurzfristige Risiko** laut WEF, verstärkt durch KI-Fälschungen. | Expertenbefragung | WEF Global Risks Report 2025 | Deepfake-Ereignis ab mittlerer Spielzeit häufiger. |
| **Soziale Medien & psychische Gesundheit Jugendlicher**: stark umstritten. Viele Befunde korrelativ; Wirkrichtung teils umgekehrt. | **umstritten** | Haidt vs. Odgers (Debatte 2024), *Nature* 2024, *Science* 2024 | Nur kleiner, unsicherer Effekt; im Spiel ausdrücklich als »Forschung uneins« markiert – gutes Unterrichtsgespräch. |

### 1.4 Demografie

| Befund | Stärke | Quelle | Regel im Spiel |
|---|---|---|---|
| Weltbevölkerung erreicht den Höchststand von ca. **10,3 Mrd. Mitte der 2080er**; Geburtenrate weltweit von >5 (1960er) auf 2,3 gefallen. Europa hat schon >20 % über 65. | Projektion | UN World Population Prospects 2024 | Bevölkerung modelliert mit Geburtenrate **und** Altersstruktur, nicht nur als eine Zahl. |
| Weltweite Geburtenrate 1,83 (2050) und 1,59 (2100) erwartet; 2100 liegen nur noch 6 von 204 Ländern über 2,1 (Samoa, Somalia, Tonga, Niger, Tschad, Tadschikistan). | Projektion | GBD 2021 Fertility Collaborators 2024, *Lancet* | Ohne Zuwanderung schrumpfen fast alle Spielländer langfristig. |
| **Bildung von Frauen** ist der wichtigste Treiber sinkender Geburtenraten; grob **−0,26 Geburten pro zusätzlichem Schuljahr**. | robust, teils kausal (Schulreformen) | Lutz 2014; IZA World of Labor; Weltbank | Bildung senkt die Geburtenrate (verzögert) → erst »demografische Dividende« (viele Erwerbstätige), später Alterung. |

### 1.5 Soziales Leben, Gesundheit

| Befund | Stärke | Quelle | Regel im Spiel |
|---|---|---|---|
| **Einsamkeit** betrifft 1 von 6 Menschen; ca. **871 000 Todesfälle/Jahr**; Jugendliche am stärksten (21 %); in armen Ländern häufiger (24 % vs. 11 %). | Bericht | WHO Commission on Social Connection 2025 | Neue Größe **Zusammenhalt**: wirkt auf Gesundheit/Lebensqualität, nicht nur Stimmung. |
| **Gemeinsame Mahlzeiten** und Vertrauen in die Freundlichkeit anderer sagen Wohlbefinden stark vorher; 19 % junger Erwachsener haben niemanden, auf den sie zählen können (+39 % seit 2006). Menschen unterschätzen, wie freundlich andere sind. | Befragung | World Happiness Report 2025 | Lebensqualität hängt an Zusammenhalt + Vertrauen, nicht nur am Einkommen. |

### 1.6 Klima, Umwelt, Energie

| Befund | Stärke | Quelle | Regel im Spiel |
|---|---|---|---|
| Hitzebedingte Todesfälle ca. **546 000/Jahr**, +23 % seit den 1990ern. | Monitoring | Lancet Countdown 2025 | Klimalast wirkt direkt auf Gesundheit, besonders bei alter Bevölkerung. |
| Schon beim heutigen Erwärmungsniveau könnten **5 Kipppunkte** überschritten werden (Grönland, Westantarktis, Permafrost, Labradorsee, Korallen); Risiko steigt mit jedem Zehntelgrad. | Synthese aus 200+ Studien | Armstrong McKay et al. 2022, *Science* | **Unumkehrbare Schwellen**: Wird eine überschritten, sinkt die Klimalast nicht mehr darunter. |
| Kosten von Solar, Wind und Batterien fallen exponentiell mit der Menge (Lernkurve); schnelle Energiewende ist wahrscheinlich *billiger* als fossiles Weitermachen. | Prognose, an 50+ Techniken geprüft | Way, Ives, Mealy & Farmer 2022, *Joule* | Energiewende: anfangs teuer, jede Investition macht die nächste billiger. |
| ⚠️ *Kotz, Levermann & Wenz 2024 (Nature, „−19 % Einkommen bis 2049“)* wurde im **Dezember 2025 zurückgezogen**. | – | Retraction Note, *Nature* 2025 | **Nicht verwenden.** Klimaschäden nur qualitativ + nichtlinear ansetzen. |

### 1.7 Technik & Arbeit

| Befund | Stärke | Quelle | Regel im Spiel |
|---|---|---|---|
| Ca. **40 %** der Jobs weltweit sind KI-exponiert, **60 %** in Industrieländern; etwa die Hälfte eher negativ betroffen; Ungleichheit kann steigen, wenn Gewinne bei Kapital/Hochqualifizierten landen. | Analyse | IMF Staff Discussion Note 2024/001 | Ereignis »KI-Welle«: Wirtschaft ↑, Ungleichheit ↑ – außer bei hoher Bildung/Sozialinvestition. |

---

## 2. Bereiche (Spielgrößen)

Vier bis sechs **Hebel** bekommen Aktionspunkte, der Rest reagiert. Alle Größen 0–100, außer Bevölkerung.

| # | Bereich | Art | Ersetzt im Original grob | Kurz |
|---|---|---|---|---|
| 1 | **Wirtschaft** | Hebel | Produktion | Wertschöpfung, Jobs, Steuerbasis |
| 2 | **Energiewende** | Hebel | Sanierung | Umbau mit Lernkurve |
| 3 | **Bildung & Medienkompetenz** | Hebel | Aufklärung | wirkt langsam, aber überall |
| 4 | **Soziales & Gesundheit** | Hebel | (Lebensqualität) | Umverteilung, Pflege, Wohnen |
| 5 | **Rechtsstaat & Transparenz** | Hebel | (Politik) | Justiz, Pressefreiheit, Korruptionsbekämpfung |
| 6 | **Familie & Zuwanderung** | Hebel (±) | Vermehrungsrate | Geburten, Integration, Fachkräfte |
| 7 | Umwelt- & Klimalast | Folge | Umweltbelastung | mit Kipppunkt-Schwellen |
| 8 | Gleichheit | Folge | – (neu) | Einkommen/Chancen |
| 9 | Vertrauen | Folge | Politik | in Institutionen |
| 10 | Zusammenhalt | Folge | – (neu) | Einsamkeit vs. Gemeinschaft |
| 11 | Informationsraum | Folge | – (neu) | Anteil Desinformation (hoch = schlecht) |
| 12 | Demokratiequalität | Folge | – (neu) | Wahlen, Gewaltenteilung, Pressefreiheit |
| 13 | Bevölkerung | Folge | Bevölkerung | Größe **und** Altersstruktur (jung/erwerbstätig/alt) |
| 14 | Lebensqualität | Folge | Lebensqualität | Sammelgröße, Hauptpunktzahl |
| 15 | Staatskapazität | Folge | – (neu) | kann der Staat durchsetzen, was er beschließt? (Rechtsstaat, Budget, Korruption) |

**Aktionspunkte je Runde** = Steuerbasis (Wirtschaft × Erwerbstätigenanteil) − Korruptionsverlust − Schuldendienst − Alterslast.
So spürt man Alterung und Korruption direkt im Budget.

### 2a. Leviathan-Anzeige (zweite Hauptanzeige)

Nach Acemoglu & Robinson (*The Narrow Corridor*, 2019): Freiheit und Wohlstand entstehen nur, wenn **Staat und Gesellschaft gleich stark** sind und sich gegenseitig in Schach halten – ein schmaler Korridor.

- **Staatsmacht** = Staatskapazität
- **Gesellschaftsmacht** = Mittel aus Demokratiequalität, Zusammenhalt und Informationsraum (freie Presse, wenig Desinformation)

Die Anzeige ist ein Zeiger auf einer Skala:

```
abwesend  ◄──────── [ gefesselt ] ────────►  despotisch
(Staat zu schwach)    (Korridor)          (Staat zu stark)
```

- **Position** = Staatsmacht − Gesellschaftsmacht. Der Korridor ist schmal (ca. ±15) und **wird enger**, je höher beide Werte sind: Ein starker Staat braucht eine ebenso starke Gesellschaft.
- **Im Korridor:** Bonus auf Wirtschaft und Vertrauen (B4 Demokratie-Dividende).
- **Despotisch:** Staat setzt schnell durch (Aktionspunkte wirken kurz stärker), aber Korruption bleibt verborgen und Schocks wirken länger (R4). Das Ereignis »Autoritärer Präsident« schiebt den Zeiger stark nach rechts.
- **Abwesend:** Aktionspunkte versickern, Schocks wirken ungebremst; Putsch und Gewalt werden wahrscheinlicher. »Staatsschuldenkrise« und »Putschversuch« schieben den Zeiger nach links.
- **Rote Königin:** Im Korridor müssen beide Seiten *mitwachsen*. Wer nur den Staat ausbaut (Rechtsstaat, Wirtschaft) und Bildung/Zusammenhalt vernachlässigt, rutscht langsam Richtung despotisch – und umgekehrt.
- **Startwerte je Ländertyp:** A nordisch → im Korridor; D Wahlautokratie, G autoritärer Entwicklungsstaat → despotisch; H junge, fragile Gesellschaft → abwesend; F Rohstoffstaat → despotisch mit schwacher Staatskapazität (nur Macht, wenig Leistung).
- **Nachbesprechung:** Verlauf des Zeigers über alle Runden als Linie, dazu die Ereignisse, die ihn verschoben haben.

---

## 3. Rückkopplungsschleifen

R = verstärkend, B = ausgleichend. Diese Schleifen zeigt die Nachbesprechung am Ende als Diagramm („Woran ist dein Land gekippt?“).

| Schleife | Ablauf | Beleg |
|---|---|---|
| **R1 Krisen-Populismus** | Finanzkrise → Arbeitslosigkeit → Vertrauen ↓ → Populist gewählt → Wirtschaft ↓ (langsam) → neue Unsicherheit | Funke et al. 2016, 2023; Algan et al. 2017 |
| **R2 Ungleichheitsfalle** | Ungleichheit ↑ → Vertrauen ↓ → Korruption ↑, weniger Zustimmung zu Sozialpolitik → Ungleichheit ↑ | Rothstein & Uslaner 2005 |
| **R3 Desinformationsspirale** | Vertrauen ↓ → alternative Quellen → Desinformation ↑ → Vertrauen ↓ | Vosoughi et al. 2018; WEF 2025 |
| **R4 Autokratie-Einrasten** | Demokratiequalität ↓ → Pressefreiheit ↓ → Korruption unentdeckt → Kontrolle schwerer zurückzuholen | V-Dem 2026 |
| **R5 Energiewende-Lernkurve** (gut) | Investition → Kosten ↓ → mehr Ausbau pro Punkt → Klimalast ↓, Energiepreise ↓ | Way et al. 2022 |
| **R6 Klimakaskade** | Klimalast ↑ → Kipppunkt → Hitze/Dürre → Gesundheit & Wirtschaft ↓ → weniger Budget für Wende | Armstrong McKay 2022; Lancet Countdown 2025 |
| **B1 Bildungs-Demografie** | Bildung ↑ → Geburtenrate ↓ → erst Dividende (Budget ↑), 30+ Runden-Jahre später Alterung (Budget ↓) | Lutz 2014; UN WPP 2024; Lancet 2024 |
| **B2 Medienkompetenz-Bremse** | Bildung & Medienkompetenz ↑ → Desinformation wirkt schwächer | Roozenbeek 2022; MLI |
| **B3 Zusammenhalt-Puffer** | Zusammenhalt ↑ → Schocks treffen Gesundheit/Vertrauen schwächer | WHO 2025; WHR 2025 |
| **B4 Demokratie-Dividende** | Demokratiequalität ↑ → langsam Wirtschaft ↑ | Acemoglu et al. 2019 |

---

## 4. Ländertypen (Startszenarien)

Das Spielland ist immer **fiktiv**; der Typ bestimmt Startwerte und typische Schocks. Das Info-Panel nennt reale Beispiele mit Quelle.
**Alle neun Typen sind schon in der ersten Version spielbar** (mindestens acht gefordert).
Zahlen gerundet, Stand ca. 2024/25.

### A · Nordisches Vertrauensmodell — *leicht*
- **Profil:** hohes Vertrauen, wenig Korruption, hohe Medienkompetenz, hohe Gleichheit; Geburtenrate niedrig, Bevölkerung altert.
- **Beispiele:** Dänemark (CPI 89), Finnland (CPI 88, Medienkompetenz-Index Platz 1), Norwegen.
- **Gefahr:** Alterslast frisst das Budget; Wohnkosten; Einsamkeit im Alter.
- **Typische Schocks:** Pflegenotstand, Energiepreisschock, Cyberangriff.

### B · Alternde Industrienation
- **Profil:** starke Wirtschaft, sehr niedrige Geburtenrate, hohes Durchschnittsalter, mittleres Vertrauen, hohe Emissionen aus der Vergangenheit.
- **Beispiele:** Deutschland (Geburtenrate ca. 1,35), Japan (ca. 1,2), Italien (ca. 1,2), Südkorea (ca. 0,7 – weltweit am niedrigsten).
- **Gefahr:** Fachkräftemangel, Rentenlast, Populismus nach Wirtschaftsschocks.
- **Typische Schocks:** Energiepreisschock, Lieferkettenbruch, Automatisierungswelle, Fachkräftemangel.

### C · Polarisierte Großdemokratie
- **Profil:** hohe Innovation und Wirtschaftskraft, hohe Ungleichheit, stark polarisierter und zersplitterter Informationsraum, Vertrauen niedrig.
- **Beispiele:** USA (laut V-Dem 2026 im Autokratisierungsprozess), Brasilien.
- **Gefahr:** Desinformationsspirale (R3) + Ungleichheitsfalle (R2).
- **Typische Schocks:** Deepfake-Wahl, Algorithmus-Änderung, Bankenkrise, politische Gewalt.

### D · Wahlautokratie / hybrides Regime
- **Profil:** Es gibt Wahlen, aber eingeschränkte Pressefreiheit, besetzte Gerichte, Korruption; Wirtschaft mittel.
- **Beispiele (V-Dem-Einstufung „electoral autocracy“):** Ungarn, Türkei, Serbien.
- **Ziel:** Demokratie zurückgewinnen, ohne dass das Land instabil wird.
- **Typische Schocks:** Massenproteste, Korruptionsskandal, Whistleblower, Medien werden aufgekauft.

### E · Aufstrebendes Schwellenland (demografische Dividende)
- **Profil:** viele Menschen im Erwerbsalter, schnelles Wachstum, steigende Emissionen, große Hitzebelastung, Bildung im Aufbau.
- **Beispiele:** Indien (Geburtenrate ca. 2,0), Indonesien, Vietnam, Mexiko.
- **Gefahr:** Klimakaskade (R6) trifft gerade die Wachstumsjahre; Ungleichheit steigt mit dem Wachstum.
- **Typische Schocks:** Hitzewelle, Monsun-Hochwasser, KI-Welle (Auslagerungs-Jobs), Landflucht.

### F · Rohstoffstaat (Rentierstaat)
- **Profil:** Einnahmen hängen an Öl/Gas/Metallen; niedrige Steuern → wenig Rechenschaft; Korruption; Wirtschaft kaum vielfältig (»Ressourcenfluch«).
- **Beispiele:** Saudi-Arabien, Nigeria, Venezuela.
- **Gefahr:** Preis-Crash, Energiewende der anderen (Nachfrage sinkt).
- **Typische Schocks:** Rohstoffpreis-Crash, Rohstofffund (verlockend, aber Fluch), Korruptionsskandal.

### G · Autoritärer Entwicklungsstaat
- **Profil:** hohe Staatskapazität, schneller Infrastrukturausbau, wenig Meinungsfreiheit, Vertrauen schwer messbar (Angst vs. Zustimmung).
- **Beispiele:** China, Vietnam, Ruanda.
- **Spielidee:** Kurzfristig effizient – aber ohne Pressefreiheit werden Fehler spät bemerkt (Schocks wirken länger, Korruption bleibt verborgen). Belegt durch B4 (Acemoglu).
- **Typische Schocks:** Immobilienblase, Pandemie-Vertuschung, Handelskrieg, Alterung (China: Geburtenrate ca. 1,0).

### H · Junge, fragile Gesellschaft — *schwer*
- **Profil:** sehr junge Bevölkerung (Median-Alter ca. 15), hohe Geburtenrate (ca. 6), schwacher Staat, stark klimaexponiert, wenig Budget.
- **Beispiele:** Niger, Tschad, Somalia (laut Lancet 2024 auch 2100 noch über 2,1).
- **Ziel:** Bildung (v. a. Mädchen) → Dividende nutzen, bevor Klima und Konflikte zuschlagen.
- **Typische Schocks:** Dürre/Missernte, Putschversuch, Flucht aus dem Nachbarland, Heuschrecken.

### I · Klimaexponierter Küsten-/Inselstaat — *Sonderszenario*
- **Profil:** existenzielle Bedrohung durch den Meeresspiegel, die man selbst kaum verursacht hat → Außenpolitik und Anpassung wichtiger als eigene Emissionen.
- **Beispiele:** Bangladesch, Tuvalu, Kiribati; als reiches Gegenbeispiel die Niederlande (Deichbau als Staatsaufgabe).
- **Typische Schocks:** Sturmflut, Versalzung des Grundwassers, Klimaflucht, internationaler Klimafonds (positiv).

---

## 5. Schocks & Ereignisse

**Grundsatz:** Die Wahrscheinlichkeit hängt vom Zustand des Landes ab (in der Spalte „Wahrscheinlicher wenn …“). Echter Zufall nur bei Naturereignissen und beim Ausland.
Jeder Schock hat eine **Abfederung**: Welche Größe den Schaden dämpft. So lernt man Vorsorge statt Pech.

### 5.1 Politik & Macht

| Ereignis | Wahrscheinlicher wenn … | Wirkung | Abfederung |
|---|---|---|---|
| **Autoritärer Präsident gewählt** | Vertrauen niedrig + Ungleichheit hoch + Krise in den letzten 3 Runden | Demokratiequalität ↓↓, Pressefreiheit sofort ↓; »Rechtsstaat« für 3 Runden gesperrt; langsamer Wirtschafts-Malus | nur vorher: Vertrauen, Gleichheit |
| Amtszeit per Verfassungsänderung verlängert | Autokrat an der Macht | Wahlen fallen aus, Demokratie ↓ | Zusammenhalt (Proteste) |
| Gerichte werden neu besetzt | Autokrat oder Demokratie < 40 | Korruption bleibt unentdeckt | – |
| Medien werden aufgekauft | Demokratie < 50 | Informationsraum ↓, Vertrauen scheinbar ↑ (geschönt!) | Medienkompetenz |
| **Korruptionsskandal** | Transparenz niedrig | 10–25 % der Aktionspunkte versickern unbemerkt, bis aufgedeckt | Rechtsstaat & Transparenz |
| Whistleblower-Enthüllung | Korruption hoch + freie Presse vorhanden | kurzfristig Vertrauen ↓, danach Korruption ↓ | – (eigentlich gut) |
| Lobbygesetz durchgewunken | Ungleichheit hoch | Gleichheit ↓, Wirtschaft kurz ↑ | Transparenz |
| Koalitionsbruch / Regierungskrise | Polarisierung hoch | 1 Runde nur halbe Aktionspunkte | Vertrauen |
| Putschversuch | Demokratie mittel + Wirtschaft schwach + Typ H/F | alles gesperrt 1–2 Runden; bei Erfolg Autokratie | Demokratiequalität, Zusammenhalt |
| Politisch motivierte Gewalt / Attentat | Informationsraum schlecht + Polarisierung hoch | Vertrauen ↓, Zusammenhalt ↓ | Zusammenhalt |
| Massenproteste | Vertrauen niedrig *oder* Autokrat | Demokratie ↑ oder Repression (je nach Zustand) | – |
| Generalstreik | Gleichheit niedrig + Inflation | Wirtschaft ↓ 1 Runde, Gleichheit ↑ | Soziales |

### 5.2 Informationsraum

| Ereignis | Wahrscheinlicher wenn … | Wirkung | Abfederung |
|---|---|---|---|
| **Fake-News-Kampagne** | Medienkompetenz niedrig, Vertrauen niedrig | Vertrauen ↓, Desinformation ↑ (wächst selbst weiter) | Bildung & Medienkompetenz |
| **Deepfake kurz vor der Wahl** | ab Spielmitte häufiger (KI) | Wahl kippt eher zum Populisten | Medienkompetenz, freie Presse |
| Ausländische Einflussnahme (Bot-Netz) | Informationsraum schwach | Polarisierung ↑ | Transparenz |
| Plattform ändert Algorithmus (Empörung wird belohnt) | Zufall | Desinformation wächst schneller | – (Forschung uneins → kleiner Effekt) |
| Verschwörungsmythos geht viral | nach Pandemie/Katastrophe | Impfquote ↓, Vertrauen ↓ | Vertrauen, Bildung |
| Faktencheck-Netzwerk gegründet *(positiv)* | freie Presse + Bildung ≥ 50 | Desinformation ↓ | – |
| Prebunking-Kampagne wirkt *(positiv)* | nach Investition in Medienkompetenz | Informationsraum ↑ | – |

### 5.3 Wirtschaft & Finanzen

| Ereignis | Wahrscheinlicher wenn … | Wirkung | Abfederung |
|---|---|---|---|
| **Bankenkrise** (≠ normale Rezession) | Wirtschaft lange schnell gewachsen, Kredit-Boom | Wirtschaft ↓↓, Arbeitslosigkeit ↑, **Populismus-Chance stark ↑** | Rechtsstaat (Aufsicht), Soziales |
| Normale Rezession | Zufall | Wirtschaft ↓ | Soziales |
| Staatsschuldenkrise | Budget oft überzogen | Aktionspunkte ↓ für mehrere Runden | – |
| Inflationsschock | Energiepreisschock oder Überhitzung | Gleichheit ↓, Vertrauen ↓ | Soziales |
| **Energiepreisschock** | fossile Abhängigkeit hoch | Wirtschaft ↓, Gleichheit ↓ | Energiewende |
| Handelskrieg / Zölle | Zufall (Ausland) | Wirtschaft ↓ | Vielfalt der Wirtschaft |
| Lieferkettenbruch (Chips, seltene Erden) | Typ B/C | Wirtschaft ↓, Energiewende gebremst | – |
| Immobilienblase platzt | Typ G, Wohnkosten hoch | Wirtschaft ↓, Vertrauen ↓ | Rechtsstaat |
| Rohstoffpreis-Crash | Typ F | Budget ↓↓ | Vielfalt (Bildung) |
| Rohstofffund *(zweischneidig)* | Zufall | Budget ↑, Korruption ↑, Energiewende-Anreiz ↓ | Transparenz |
| **KI-Welle** | ab Spielmitte | Wirtschaft ↑, Ungleichheit ↑, Jobs weg | Bildung, Soziales |
| Automatisierungswelle | Typ B | Wirtschaft ↑, Arbeitslosigkeit ↑ | Bildung |
| Fachkräftemangel | Alterung | Wirtschaft ↓ | Zuwanderung, Bildung |
| Großkonzern wandert ab | Energiepreise hoch oder Steuern hoch | Wirtschaft ↓ | Energiewende |

### 5.4 Klima & Umwelt

| Ereignis | Wahrscheinlicher wenn … | Wirkung | Abfederung |
|---|---|---|---|
| **Hitzewelle** | Klimalast hoch; alte Bevölkerung trifft es härter | Gesundheit ↓, Wirtschaft ↓ | Soziales & Gesundheit, Zusammenhalt |
| Dürre / Missernte | Klimalast hoch; Typ E/H | Lebensqualität ↓, Flucht ↑ | Energiewende (langfristig) |
| Jahrhunderthochwasser | Klimalast hoch | Wirtschaft ↓, Budget für Wiederaufbau | Rechtsstaat (Planung) |
| Waldbrände | Hitze + Dürre | Gesundheit ↓ | – |
| Sturmflut / Meeresspiegel | Typ I | Bevölkerung wandert ab | Deichbau (Budget) |
| **Kipppunkt überschritten** | Klimalast über Schwelle | Klimalast kann nicht mehr unter die Schwelle sinken (dauerhaft) | nur vorher |
| Wasserknappheit | Hitze + Wachstum | Wirtschaft ↓, Konflikte ↑ | Energiewende |
| Bestäuber- / Artensterben | Umweltlast hoch | Ernte ↓ | – |
| Chemie- oder Ölunfall | Rechtsstaat schwach | Umwelt ↓, Vertrauen ↓ | Transparenz |
| Heuschreckenplage | Typ H | Ernte ↓ | – |

### 5.5 Gesundheit & Soziales

| Ereignis | Wahrscheinlicher wenn … | Wirkung | Abfederung |
|---|---|---|---|
| **Pandemie** | Zufall | Gesundheit ↓, Wirtschaft ↓, Zusammenhalt ↓; später Verschwörungsmythen | Vertrauen (Regeln werden befolgt), Gesundheit |
| Antibiotikaresistenz | Gesundheit lange vernachlässigt | Gesundheit ↓ schleichend | Gesundheit |
| **Einsamkeitswelle** | Zusammenhalt niedrig, Alterung | Gesundheit ↓, Vertrauen ↓ | Soziales, Zusammenhalt |
| Psychische Krise bei Jugendlichen | Zusammenhalt niedrig | Bildung ↓ | Soziales (Forschung zu Ursachen uneins!) |
| Pflegenotstand | Alterung + Fachkräftemangel | Lebensqualität ↓ | Zuwanderung, Soziales |
| Wohnungskrise | Wachstum + Städte | Gleichheit ↓, Zusammenhalt ↓ | Soziales |
| Drogenkrise | Ungleichheit hoch, Zusammenhalt niedrig | Gesundheit ↓ | Soziales |
| Ehrenamts-Boom *(positiv)* | Zusammenhalt ≥ 60 | Schocks gedämpft | – |
| Großes Sportereignis / Gemeinschaftsgefühl *(positiv)* | Zufall | Zusammenhalt ↑ kurz | – |

### 5.6 Demografie & Migration

| Ereignis | Wahrscheinlicher wenn … | Wirkung | Abfederung |
|---|---|---|---|
| Geburtenknick | Wohnkosten hoch, Unsicherheit | Alterung schneller | Familie |
| Babyboom | Nachkrise, Familienförderung | später mehr Erwerbstätige | – |
| **Fluchtbewegung aus dem Nachbarland** (Krieg/Klima) | Zufall, Typ H/E häufiger | Bevölkerung ↑, kurz Budget ↓; Integration entscheidet, ob später Fachkräfte oder Spannungen | Zuwanderung/Integration, Zusammenhalt, Medienkompetenz (Hetze) |
| Abwanderung junger Fachkräfte (Brain Drain) | Wirtschaft schwach oder Autokrat | Bildung wirkt weniger | Wirtschaft, Demokratie |
| Rückkehrwelle *(positiv)* | Wirtschaft + Demokratie steigen | Fachkräfte ↑ | – |
| Landflucht | Typ E/H | Städte überlastet, Land leert sich | Soziales |

### 5.7 Sicherheit & Technik

| Ereignis | Wahrscheinlicher wenn … | Wirkung | Abfederung |
|---|---|---|---|
| **Cyberangriff** auf Krankenhäuser/Stromnetz | Digitalisierung hoch, Schutz niedrig | Gesundheit ↓, Vertrauen ↓ | Rechtsstaat (Behörden), Bildung |
| Sabotage an Unterseekabeln/Pipelines | Zufall (Ausland) | Wirtschaft ↓, Energiepreise ↑ | Energiewende (dezentral) |
| Großer Stromausfall | Netz alt, Hitze | Wirtschaft ↓ | Energiewende (Speicher) |
| Sonnensturm | sehr selten, Zufall | Technik fällt aus | – |
| Krieg im Nachbarland | Zufall | Energiepreise ↑, Flucht ↑, Rüstung frisst Budget | Vertrauen, Energiewende |

### 5.8 Positive Wendungen

| Ereignis | Wahrscheinlicher wenn … | Wirkung |
|---|---|---|
| Durchbruch bei Batteriespeichern | Energiewende ≥ 40 | Lernkurve springt |
| Medizinischer Durchbruch | Bildung ≥ 60 | Gesundheit ↑ |
| **Bürgerrat** löst einen festgefahrenen Streit | Demokratie ≥ 50 | Vertrauen ↑, Polarisierung ↓ |
| Friedensabkommen in der Region | Zufall | Budget ↑ |
| Internationaler Klimafonds | Typ H/I, Transparenz ≥ 40 | Budget ↑ (nur wenn nicht versickert) |
| Unabhängige Presse deckt auf | Demokratie ≥ 50 | Korruption ↓ |

---

## 6. Ziel, Ende, Nachbesprechung

- **Laufzeit:** 10–15 Runden (1 Runde ≈ 2 Jahre, Spielbeginn 2026).
- **Verloren**, wenn Lebensqualität, Vertrauen oder Demokratie dauerhaft auf 0 fallen oder die Bevölkerung kollabiert.
- **Zwei Hauptanzeigen:** Lebensqualität und die Leviathan-Anzeige (Abschnitt 2a). Runden im Korridor geben Bonuspunkte.
- **Punkte:** Lebensqualität × Nachhaltigkeit (Klimalast, Schuldenstand, Altersstruktur am Ende) – wer das Land »ausplündert«, verliert Punkte in den Folgejahren.
- **Nachbesprechung:** Diagramm der aktivierten Schleifen, »Wendepunkt-Runde«, Vergleich mit dem Ländertyp und die Quellen hinter den Regeln.
- **Klassenmodus (später):** jede Gruppe regiert ein Land desselben Typs → Vergleich der Strategien.

---

## 6a. Krisenstufe (Einstellung der Lehrkraft)

Die Lehrkraft legt beim Start der Sitzung die **Krisenstufe** fest. Scheitern kann ausdrücklich gewollt sein: Ein Zusammenbruch, den man selbst erlebt hat, macht die Rückkopplungsschleifen oft besser verständlich als ein geglückter Durchlauf.

| Stufe | Schocks | Gedacht für |
|---|---|---|
| **Ruhige Zeiten** | nur zustandsabhängige Schocks, halbe Häufigkeit, keine Kipppunkte | Einstieg, Regeln kennenlernen |
| **Normal** (Standard) | wie in Abschnitt 5 beschrieben | normaler Unterricht |
| **Stürmisch** | doppelte Häufigkeit, Auslandsschocks häufen sich, Kipppunkte liegen niedriger | Fortgeschrittene, Wettbewerb im Klassenmodus |
| **Zusammenbruch** | Eine Krisenkaskade läuft nach Drehbuch ab und ist kaum abzuwenden, z. B. Bankenkrise → Arbeitslosigkeit → Deepfake-Wahl → Autokrat. Es zählt, **wie lange** man durchhält und was man rettet. | Scheitern als Lernziel, Stoff für die Nachbesprechung |

Zusätzliche Schalter für die Lehrkraft:

- **Drehbuch:** bestimmte Ereignisse fest auf eine Runde legen, z. B. »Runde 4: Pandemie« für alle Gruppen gleich (gut für den Vergleich im Klassenmodus).
- **Heikle Ereignisse abschalten:** einzelne Gruppen oder Ereignisse ausblenden, z. B. Krieg, Flucht, politische Gewalt, wenn es in der Klasse Betroffene gibt.
- **Stufe sichtbar/verdeckt:** Die Schüler:innen sehen die Krisenstufe, oder sie erfahren erst in der Nachbesprechung, dass das Scheitern angelegt war (»Ihr hattet keine Chance – oder doch?«).
- **Weiterspielen nach dem Zusammenbruch:** Statt »Game over« folgt eine **Wiederaufbauphase** mit wenigen Aktionspunkten. Kann man die Demokratie zurückholen? Anknüpfung an den Leviathan-Korridor.

Ohne Lehrkraft (freies Üben mit Gastcode oder allein) gilt **Normal**; die Stufe ist dann frei wählbar, aber »Zusammenbruch« ist als Szenario gekennzeichnet.

Umsetzung: Die Krisenstufe ist ein Faktor auf die Schockwahrscheinlichkeiten und die Schwellenwerte. »Zusammenbruch« ist ein festes Ereignis-Drehbuch mit demselben Seed für alle Gruppen. Die Einstellung wird zusammen mit der Sitzung gespeichert (ToolSession-Konfiguration).

---

## 7. Umsetzung (Stand 30.09.2026)

- **Modell:** `frontend/src/lib/leviathan/` – `typen.ts`, `laender.ts` (9 Typen), `regeln.ts` (Wirkungsgefüge, Eigendynamik, Schleifen), `ereignisse.ts` (~70 Schocks), `motor.ts` (Runde, Budget, Bevölkerung, Wahl, Leviathan, Auswertung), `quellen.ts`. Tests: `src/tests/leviathan.test.ts`.
- **Oberfläche:** `frontend/src/components/leviathan/` (Start, Spiel, Nachbesprechung, LehrkraftPanel, Anzeigen).
- **Sitzung:** `ToolSession.settings` (JSON) + `PUT /api/tool-sessions/{code}/settings` (nur die Lehrkraft der Sitzung); Schüler:innen lesen die Einstellungen über `GET /api/tool-sessions/{code}`.
- **Abgestimmt** per Simulationslauf (9 Typen × 4 Krisenstufen × mehrere Strategien, je 40 Seeds): Nordisch bricht nie zusammen, die junge fragile Gesellschaft bei »stürmisch« fast immer; »Zusammenbruch« lässt die meisten Typen kippen, starke Länder überstehen ihn angeschlagen.
- **Offen:** Klassenmodus (Gruppen vergleichen, Bestenliste), Feinabstimmung nach ersten Unterrichtsrunden, Zahlen der Länderbeispiele gegen UN WPP 2024 / V-Dem gegenprüfen.

---

## Quellen

- Acemoglu, D., Naidu, S., Restrepo, P., Robinson, J. A. (2019): Democracy Does Cause Growth. *Journal of Political Economy* 127(1). https://www.nber.org/papers/w20004
- Acemoglu, D., Robinson, J. A. (2019): *The Narrow Corridor: States, Societies, and the Fate of Liberty*. Penguin Press. (dt.: *Gleichgewicht der Macht*, S. Fischer 2019)
- Hobbes, T. (1651): *Leviathan* (gemeinfrei).
- Algan, Y., Guriev, S., Papaioannou, E., Passari, E. (2017): The European Trust Crisis and the Rise of Populism. *Brookings Papers on Economic Activity*. https://www.brookings.edu/wp-content/uploads/2018/02/algantextfa17bpea.pdf
- Armstrong McKay, D. I. et al. (2022): Exceeding 1.5 °C global warming could trigger multiple climate tipping points. *Science*. https://pubmed.ncbi.nlm.nih.gov/36074831/
- Funke, M., Schularick, M., Trebesch, C. (2016): Going to extremes: Politics after financial crises, 1870–2014. *European Economic Review* 88. https://www.sciencedirect.com/science/article/abs/pii/S0014292116300587
- Funke, M., Schularick, M., Trebesch, C. (2023): Populist Leaders and the Economy. *American Economic Review* 113(12). https://www.aeaweb.org/articles?id=10.1257%2Faer.20202045
- GBD 2021 Fertility Collaborators (2024): Global fertility in 204 countries and territories, 1950–2021, with forecasts to 2100. *The Lancet*. https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(24)00550-6/fulltext
- IMF (2024): Gen-AI: Artificial Intelligence and the Future of Work. Staff Discussion Note SDN/2024/001. https://www.imf.org/-/media/files/publications/sdn/2024/english/sdnea2024001.pdf
- IZA World of Labor: Female education and its impact on fertility. https://wol.iza.org/articles/female-education-and-its-impact-on-fertility/long
- Kotz, M., Levermann, A., Wenz, L. (2024): The economic commitment of climate change. *Nature* – **zurückgezogen 12/2025**. https://www.nature.com/articles/s41586-025-09726-0
- Lancet Countdown (2025): Report on health and climate change. https://lancetcountdown.org/2025-report/
- Nature (2024): The great rewiring – is social media really behind an epidemic of teenage mental illness? https://www.nature.com/articles/d41586-024-00902-2
- OECD (2024): Survey on Drivers of Trust in Public Institutions – 2024 Results. https://www.oecd.org/en/publications/oecd-survey-on-drivers-of-trust-in-public-institutions-2024-results_9a20554b-en.html
- Open Society Institute Sofia: Media Literacy Index 2023 / 2026. https://osis.bg/?p=4450&lang=en · https://osis.bg/?p=5747&lang=en
- Roozenbeek, J., van der Linden, S. et al. (2022): Psychological inoculation improves resilience against misinformation on social media. *Science Advances*. https://www.science.org/doi/10.1126/sciadv.abo6254
- Rothstein, B., Uslaner, E. (2005): All for All: Equality, Corruption, and Social Trust. *World Politics*. http://www.gvptsites.umd.edu/uslaner/rothsteinuslanerworldpolitics.pdf
- Science (2024): Unsettled science on social media. https://www.science.org/doi/10.1126/science.adr1730
- Transparency International (2026): Corruption Perceptions Index 2025. https://www.transparency.org/en/cpi/2025
- UN DESA (2024): World Population Prospects 2024 – Summary of Results. https://population.un.org/wpp/
- V-Dem Institute (2026): Democracy Report 2026 – Unraveling the Democratic Era? https://www.v-dem.net/documents/75/V-Dem_Institute_Democracy_Report_2026_lowres.pdf
- Vosoughi, S., Roy, D., Aral, S. (2018): The spread of true and false news online. *Science* 359. https://www.science.org/doi/10.1126/science.aap9559
- Way, R., Ives, M., Mealy, P., Farmer, J. D. (2022): Empirically grounded technology forecasts and the energy transition. *Joule*. https://www.cell.com/joule/fulltext/S2542-4351(22)00410-X
- WEF (2025): Global Risks Report 2025. https://www.weforum.org/publications/global-risks-report-2025/
- WHO Commission on Social Connection (2025): From loneliness to social connection. https://who.int/news/item/30-06-2025-social-connection-linked-to-improved-heath-and-reduced-risk-of-early-death
- World Happiness Report (2025): Sharing meals with others. https://www.worldhappiness.report/ed/2025/sharing-meals-with-others-how-sharing-meals-supports-happiness-and-social-connections/
- Ökolopoly (Wikipedia) – Entstehung und Rechte. https://de.wikipedia.org/wiki/%C3%96kolopoly
