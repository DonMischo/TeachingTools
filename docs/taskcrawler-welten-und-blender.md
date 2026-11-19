# TaskCrawler-Welten, Spielalgorithmen und Blender — Übergabe

Stand 2026-11-19. Gedacht für die nächste Claude-Sitzung auf dem Rechner mit Blender 5.3 und RTX 4090.

## 1. Blender per MCP

**Einrichtung (Windows):**

1. Installiere uv: `winget install --id=astral-sh.uv -e`. Das Installationsskript scheitert an der PowerShell-Ausführungsrichtlinie.
2. Führe `uvx mcp-for-blender setup` aus (Projekt ahujasid/blender-mcp). Das installiert das Add-on »Interface: MCP for Blender«, das beim Start von Blender auf `localhost:9876` lauscht.
3. Das Setup trägt sich nur in `claude_desktop_config.json` ein, also in den Chat der Desktop-App. Für Claude Code muss in `~/.claude.json` unter `mcpServers` dieser Eintrag stehen:
   `"blender": {"type": "stdio", "command": "<pfad>\\uvx.exe", "args": ["mcp-for-blender"], "env": {}}`
   Danach eine neue Sitzung starten. Dann gibt es Werkzeuge wie `look`, `execute_blender_code` und `get_scene_info`.
4. Ohne MCP-Werkzeuge geht es auch über den Port direkt: Sende `{"type": "execute_code", "params": {"code": "..."}}` als JSON per TCP an 9876 und bekomme JSON zurück.

**Die Bilder sind das Wichtigste.** Bauen, rendern, das PNG ansehen, korrigieren. Ohne diesen Kreislauf entstehen die »furchtbaren« Modelle.

- **Laptop (Snapdragon, Adreno, Vulkan):** Alle GPU-Bilder bleiben leer, also EEVEE, Workbench, `GPUOffScreen` und der Viewport-Screenshot des Add-ons. Nur Cycles auf der CPU funktioniert: `bpy.ops.render.render()`, dann `bpy.data.images["Render Result"].save_render(pfad)`.
- **4090-Rechner:** Zuerst prüfen, ob `look` bzw. EEVEE echte Bilder liefert.

**Skills:** Die Sammlung arjun988/blender-skills (94 Skills, MIT) gehört nicht ins TT-Repo, weil jede Sitzung ihre Beschreibungen mitlädt. Lege sie in einen eigenen Modell-Projektordner und übernimm nur Modeling, Production, Pipeline/Export und einen passenden Stil. Lies die SKILL.md vor dem Einsatz.

**Vorgehen für Gebäude:**

- Konzept- bzw. Stilbilder vom Nutzer anfordern: ein Stilziel und je Typ 2–3 Vorbilder.
- Aus RTS-Höhe zählen Silhouette, Dach und Farbe. Fensterdetails sieht man kaum.
- Erst einen Bauteil-Baukasten anlegen (Fachwerkbalken, Fenster, Türen, Dach-Trim-Sheet, Schornstein, Steinsockel), dann zusammensetzen.
- Bevel und Weighted Normals, gebackenes AO, leichte Unregelmäßigkeit (First durchhängend, Auskragung, minimal schiefe Wände). Varianten per Geometry Nodes.
- Optional Bild-zu-3D lokal auf der 4090 (Hunyuan3D, TRELLIS). Lizenz vorher prüfen, das Mesh danach aufräumen.
- Die Bauskripte liegen in `scripts/stadt` bzw. `scripts/avatare`, Export als glb.

**Offene Modelle (Stadt-Aufbau):** Diese Betriebe nutzen in `components/stadt/drei/modelle.ts` (MODELL_VON) noch geliehene Modelle:

| Betrieb | Modell |
|---|---|
| Holzfäller, Schäferei | kaserne |
| Sägemühle | muehle |
| Lehmgrube, Steinbruch | kran |
| Ziegelei | fabrik |
| Köhlerei, Hopfengarten | silo |

Sie sollen eigene Modelle bekommen.

## 2. TaskCrawler-Karten: spannender und organischer

**Ist-Stand:**

- `lib/gebaeude/frei.ts` (freie 3D-Ansicht) läuft so: Regelmaschine-Punktgitter, dann Plätze stempeln, Backtracker-Wege mit einigen Durchbrüchen, Strecken, zuletzt Ränder per Zellautomat annagen.
- `lib/gebaeude/plan.ts` und `verlies.ts` erzeugen Stockwerke und Verliese aus Wachstumsregel und Backtracker.

**Problem:** Die Karten sind Bäume mit Gängen. Der Ablauf ist gleichförmig, es gibt kaum Schleifen mit Sinn, keine Ziele, die man sieht, bevor man sie erreicht, und kein Tempo.

**Vorschlag in drei Schichten:**

1. **Ablauf zuerst als Graph** (zyklische Generierung nach Joris Dormans, vgl. »Unexplored«):
   - Start und Ziel liegen auf einer Schleife.
   - Schlüssel und Schloss: Die Station gibt den Schlüssel bzw. die Antwort für ein späteres Tor.
   - Abkürzungen führen zurück zum Start.
   - Ein Ort ist sichtbar, aber noch unerreichbar (Balkon, Brücke, Gitter).
   - Tempo-Wechsel: Ruhe, Rätsel bzw. Station, Kampf bzw. Minispiel, Belohnung.
   - Die TaskCrawler-Stationen sind die Knoten.
2. **Form organisch auf den Graphen legen:**
   - Räume bzw. Lichtungen per Poisson-Disc oder Voronoi verteilen.
   - Höhlen per Zellautomat oder als Signed Distance Field mit Rauschen ausschneiden. Weiche Ränder per Marching Squares.
   - Wege als A* auf einem verrauschten Kostenfeld, dann als Spline glätten.
   - Höhenstufen statt flacher Ebene.
3. **Ausgestaltung:**
   - WFC (`lib/wfc`) bzw. die Regelmaschine für Detailstücke (Brücken, Ruinen, Zäune).
   - Gras, Steine und Pilze nach Dichtekarten streuen.
   - Lichtakzente an Stationen, Nebel, Schwebeteilchen (vgl. Memory »3D-Optik zählt«).

**Ergänzung:** Handgebaute Raumvorlagen, die der Generator anordnet (Spelunky-Prinzip), machen mehr Spaß als reiner Zufall.

**Erster Schritt:** ein Prototyp »Ablauf-Graph + Höhlenform« mit Vorschauseite und Seeds zum Durchklicken. Danach in `frei.ts` einhängen.

## 3. Idee: Simulation »Spielalgorithmen«

Eine eigene Sim mit Reitern, je Algorithmus Erklärung und interaktives Ausprobieren (Schritt für Schritt, Seed, Parameter). Diese Teile gibt es schon und sollen verlinkt bzw. wiederverwendet werden, nicht dupliziert:

- `regeln`: Regelmaschine (MarkovJunior), Labyrinthe, Gebäude
- `wfc`: Wellenkollaps, Textursynthese
- `dla`: fraktales Wachstum
- `algo`: Automat, Flussdiagramm

**Kandidaten für neue Reiter:**

| Gruppe | Algorithmen |
|---|---|
| Labyrinth | Backtracker, Prim, Kruskal, Wilson im Vergleich |
| Räume | BSP-Raumteilung, Räume und Gänge |
| Höhlen | Zellautomat (Geburt/Überleben einstellbar) |
| Ablauf | zyklische Generierung: Graph mit Schlüsseln und Schlössern, danach die Karte |
| Verteilen | Poisson-Disc vs. Zufall, Voronoi-Regionen |
| Gelände | Value/Perlin-Rauschen, Oktaven, Domain Warping, Inseln, Flüsse |
| Wege | A* vs. Dijkstra vs. Greedy, Flowfield für viele Einheiten |
| Natur | L-Systeme (Pflanzen), Boids (Schwärme) |

Anmelden wie jede Sim (6 Stellen, Memory »Simulationen anmelden«), dazu README und features.yml.
