/**
 * Beiträge mit echten Bildern aus den anderen Sims: Fotos aus Weltall- und
 * Vulkan-Galerie, PC-Teile aus der PC-Werkstatt, 3D-Clips mit den Avataren,
 * Monstern und Zaubern der Plattform — dazu Memes, Umfragen und Nachrichten.
 *
 * Die Nachrichten über schwere Unfälle bei Challenges sind erfunden (wie alles in Klikk),
 * die Fakten darin stimmen.
 */
import type { Medien, Post } from "./posts";
import type { Thema } from "./typen";

const m = (id: string, thema: Thema, stufe: 1 | 2 | 3, von: string, text: string, likes: number, medien: Medien, extra: Partial<Post> = {}): Post =>
  ({ id, thema, stufe, von, emoji: "", farben: ["#000", "#000"], text, likes, medien, ...extra });

const foto = (quelle: "weltall" | "vulkan", id: string): Medien => ({ art: "foto", quelle, id });
const tanz = (klasse: string, form: "m" | "w", hintergrund: number, tier?: string): Medien =>
  ({ art: "clip", clip: { art: "tanz", figur: { klasse, form, tier }, hintergrund } });
const zauber = (klasse: string, form: "m" | "w", element: string, gegner: string, hintergrund: number): Medien =>
  ({ art: "clip", clip: { art: "zauber", figur: { klasse, form }, element, gegner, hintergrund } });
const news = (quelle: string, schlagzeile: string, unterzeile: string, eilmeldung = false): Medien =>
  ({ art: "news", quelle, schlagzeile, unterzeile, eilmeldung });

export const MEHR: Post[] = [
  // ── Weltall & Natur (echte Fotos) ──
  m("wi1", "wissen", 1, "weltall.wow", "Saturn im Infrarot – so hat ihn das Webb-Teleskop gesehen 🤯", 41000, foto("weltall", "saturn-webb")),
  m("wi2", "wissen", 1, "space.facts.de", "1968: Zum ersten Mal sieht ein Mensch die Erde aufgehen 🌍", 28000, foto("weltall", "earthrise")),
  m("wi3", "wissen", 1, "mars.daily", "Ein Sonnenuntergang auf dem Mars ist BLAU 💙", 35000, foto("weltall", "mars-sonnenuntergang")),
  m("wi4", "wissen", 1, "weltall.wow", "Dieser winzige Punkt bist du. Und alle, die du kennst. 🥹", 52000, foto("weltall", "pale-blue-dot")),
  m("wi5", "wissen", 1, "astro.anna", "Aussicht aus dem Fenster der ISS. Hausaufgaben machen sich hier sicher besser 😅", 19000, foto("weltall", "iss-cupola")),
  m("wi6", "wissen", 1, "lava.lukas", "Lavafontäne auf Hawaii – über 1100 °C 🌋", 33000, foto("vulkan", "lavafontaene")),
  m("wi7", "wissen", 2, "katastrophen.kanal", "Hunga Tonga 2022 aus dem All – die größte Explosion seit über 100 Jahren 💥", 61000, foto("vulkan", "hunga-tonga")),
  m("wi8", "wissen", 1, "vulkan.vibes", "Mayon bei Nacht. Würdet ihr hier wohnen? 👇", 24000, foto("vulkan", "mayon-nacht")),
  m("wi9", "wissen", 2, "geschichte.gruselig", "Pompeji: Sie hatten keine Warnung … 😳 (Teil 1/7)", 77000, foto("vulkan", "pompeji")),
  m("wi10", "wissen", 1, "erde.von.oben", "Eyjafjallajökull 2010 – dieser Vulkan legte ganz Europa lahm ✈️", 18000, foto("vulkan", "eyjafjallajoekull")),
  m("wi11", "news", 3, "die.wahrheit.jetzt", "Webb-Foto BEWEIST: Das Weltall ist nur eine Kuppel!!! Teilen bevor es gelöscht wird 👁️", 94000, foto("weltall", "webb-deep-field"), { fake: true }),

  // ── PC und Gaming (PC-Werkstatt, Avatare, Zauber) ──
  m("ga5", "gaming", 1, "pixel.paul", "Mein erster selbstgebauter Gaming-PC 🔥 RGB an!", 14000, { art: "pc", teile: ["pc-mainboard", "pc-gpu", "pc-ram", "pc-kuehler"], rgb: true }),
  m("ga6", "gaming", 1, "retro.ruben", "Raspberry Pi als Retro-Konsole – für 80 € 🕹️", 9100, { art: "pc", teile: ["pi-platine", "pi-kuehler", "pi-sdkarte"] }),
  m("ga7", "gaming", 1, "opa.zockt", "Opas PC von 1990 läuft noch 😳 386er, 4 MB RAM", 22000, { art: "pc", teile: ["386-mainboard", "386-cpu", "386-simm"] }),
  m("ga8", "gaming", 1, "zauber.zone", "Neuer Feuer-Zauber im Update 🔥🐉", 31000, zauber("magier", "w", "feuer", "dragon_evolved", 0x1e1b4b)),
  m("ga9", "gaming", 1, "blitz.bene", "Blitz-Combo, ein Treffer 😎⚡", 18000, zauber("krieger", "m", "blitz", "ghost", 0x0f172a)),
  m("ga10", "gaming", 1, "frost.fee", "Eis gegen Yeti – wer gewinnt? ❄️", 12000, zauber("priester", "w", "eis", "yeti", 0x164e63)),
  m("ga11", "gaming", 2, "loot.lord", "Nur 2 % schaffen diesen Boss. Mit dem Sternen-Set aus der Lootbox schon 💎 Code in Bio", 58000,
    zauber("metalhead", "m", "sterne", "demon", 0x2e1065), { schleich: "Lootbox-Shop" }),
  m("ga12", "gaming", 2, "streamer.sven", "12 Stunden Stream ohne Pause – dank VOLT ⚡ (nicht gesponsert 😉)", 44000,
    { art: "pc", teile: ["pc-gpu", "pc-luefter"], rgb: true }, { schleich: "VOLT Energy" }),

  // ── Tanz, Tiere, Musik (Avatar-Clips) ──
  m("mu4", "musik", 1, "dance.dani", "Neuer Dance-Trend 🕺 wer schafft's? #KlikkDance", 39000, tanz("rapper", "m", 0xdb2777)),
  m("mu5", "musik", 1, "metal.mia", "Wenn der Bass droppt 🤘", 21000, tanz("metalhead", "w", 0x18181b)),
  m("mu6", "musik", 1, "rock.robin", "Erster Auftritt mit der Schulband 🎸 seid nett", 4300, tanz("rocker", "m", 0x7f1d1d)),
  m("ti5", "tiere", 1, "katze.karl", "Karl hat den Dance-Trend besser drauf als ich 😹", 46000, tanz("normal", "m", 0xfb923c, "cat")),
  m("ti6", "tiere", 1, "pinguin.paula", "Pinguin-Walk 🐧 ich kann nicht mehr", 37000, tanz("normal", "w", 0x0ea5e9, "penguin")),
  m("ti7", "tiere", 1, "axolotl.alex", "Mein Axolotl freut sich, dass ich da bin 🥹", 29000, tanz("normal", "w", 0xf472b6, "axolotl")),
  m("ti8", "tiere", 2, "komische.haustiere", "Mein Haustier ist … anders 😂", 52000, { art: "clip", clip: { art: "monster", monster: "birb", hintergrund: 0x65a30d } }),
  m("co10", "comedy", 1, "blob.boys", "POV: Montag, 7:15 Uhr 🫠", 33000, { art: "clip", clip: { art: "monster", monster: "greenblob", hintergrund: 0x4d7c0f } }),

  // ── Memes ──
  m("co6", "comedy", 1, "schul.memes", "💀💀💀", 26000, { art: "meme", oben: "Wenn die Mathe-HA fertig ist", unten: "und es war die falsche Seite" }),
  m("co7", "comedy", 1, "relatable.ron", "Jeden. Abend.", 48000, { art: "meme", oben: "Ich um 23:59:", unten: "nur noch ein Video" }),
  m("co8", "comedy", 1, "schul.memes", "Wer kennt's 😭", 19000, { art: "meme", oben: "Lehrer: »Ihr habt 5 Minuten«", unten: "Die Klasse nach 30 Sekunden:" }),
  m("co11", "comedy", 2, "roast.room", "Taggt jemanden, der so aussieht 😂👇", 61000, { art: "meme", oben: "Wenn du im Bus einschläfst", unten: "und die ganze Klasse filmt" }),
  // Memes, die gerade überall sind — mit den Kommentaren, die immer drunter stehen
  m("me1", "comedy", 1, "schul.memes", "6️⃣7️⃣ 🤲 ich kann nicht mehr", 87000, { art: "meme", oben: "Lehrerin: »Schlagt Seite 67 auf«", unten: "Die ganze Klasse:" },
    { emoji: "🤲", kommentare: [["noah.zockt", "SIX SEVEN 🤲🤲"], ["lena.lacht", "67 😭😭"], ["mathe.mia", "Die Lehrerin hat's extra gemacht 💀"], ["ben.chillt", "Nicht schon wieder bitte"]] }),
  m("me2", "comedy", 1, "brainrot.base", "Erklär das mal deinen Eltern 🫠", 64000, { art: "meme", oben: "Ich: erkläre Oma »Tung Tung Tung Sahur«", unten: "Oma:" },
    { emoji: "🥁", kommentare: [["tralala.tim", "Tralalero Tralala 🦈👟"], ["cappu.cleo", "Ballerina Cappuccina ☕🩰"], ["krokodil.kai", "Bombardiro Crocodilo 🐊✈️"], ["oma.erna", "Brainrot pur 🧠🫠"]] }),
  m("me3", "comedy", 2, "aura.points", "+1000 Aura … −5000 Aura 💀", 52000, { art: "meme", oben: "Ich steig cool aus dem Bus", unten: "und stolpere über die Stufe" },
    { emoji: "😎", kommentare: [["aura.adam", "Aura farming fail 😭"], ["paul.pov", "−1000 Aura 💀"], ["sina.sagt", "Er dachte, keiner sieht's 😂"]] }),
  m("me4", "comedy", 1, "relatable.ron", "Der Vibe vor jeder Arbeit", 71000, { art: "meme", oben: "Ich, null gelernt, vor der Mathearbeit:", unten: "Just a chill guy 😌" },
    { emoji: "🐶", kommentare: [["lowkey.lara", "lowkey ich 😭"], ["chill.chris", "Chill guy 🧍‍♂️"], ["finn.fragt", "Real. Note 5 kommt trotzdem"]] }),
  m("me5", "comedy", 1, "schul.memes", "🤫🧏‍♂️", 43000, { art: "meme", oben: "Wenn der Lehrer dich drannimmt", unten: "Ich: *mewing*" },
    { emoji: "🗿", kommentare: [["mew.max", "Mewing-Streak 🗿"], ["ella.eh", "🤫🧏‍♀️"], ["jonas.j", "Kieferlinie on point 😂"]] }),
  m("me6", "comedy", 1, "eltern.cringe", "Mama hat »Skibidi« in die Familiengruppe geschrieben 💀", 58000, { art: "meme", oben: "Wenn Mama fragt, was »Skibidi« heißt", unten: "Ich:" },
    { emoji: "🧍", kommentare: [["ohio.oli", "Ohio-Moment 🌽"], ["skibidi.sam", "Skibidi 🚽"], ["aylin.a", "Erklär's ihr NIE 😭"]] }),
  m("me7", "comedy", 2, "rizz.report", "W oder L? 👇", 39000, { art: "meme", oben: "Er: hat null Rizz", unten: "Auch er: schreibt »wyd« um 2 Uhr nachts" },
    { emoji: "🙃", kommentare: [["rizz.ronny", "L Rizz 💀"], ["mila.m", "No cap 🧢"], ["kim.k", "Geh schlafen, bro 😴"]] }),
  m("me8", "mode", 2, "blindbox.queen", "Ich brauch nur noch den Geheimen 😩", 66000, { art: "meme", oben: "Mein Taschengeld", unten: "nach 5 Labubu-Blindboxen" },
    { emoji: "🧸", kommentare: [["sammel.sara", "Ich hab 3 doppelt 😭"], ["wo.kaufen", "Wo kriegt man die noch?? 😩"], ["papa.peter", "Überraschungskisten = Glücksspiel für Kinder, oder?"]] }),
  m("me9", "comedy", 1, "delulu.daily", "Delulu ist auch eine Lösung 🫠", 47000, { art: "meme", oben: "Ich um 22 Uhr: »morgen lerne ich bestimmt«", unten: "Ich morgen:" },
    { emoji: "🫠", kommentare: [["tara.t", "Delulu 🫠"], ["it.s.giving", "It's giving Prokrastination 💅"], ["leo.l", "Ich fühl mich angegriffen 😭"]] }),

  // ── Umfragen: jede Antwort landet im Profil ──
  m("um1", "essen", 1, "umfrage.ulf", "Ehrlich jetzt 👇", 12000, { art: "umfrage", frage: "Pizza mit Ananas?", optionen: ["Ja 🍍", "Niemals ❌"] }),
  m("um2", "beauty", 2, "selfcare.sina", "100 % anonym 😇 stimmt ab!", 23000, { art: "umfrage", frage: "Wie zufrieden bist du mit deinem Aussehen?", optionen: ["Sehr 😊", "Geht so 😐", "Gar nicht 😔"] }),
  m("um3", "gaming", 1, "konsolen.krieg", "Die Wahrheit ist …", 31000, { art: "umfrage", frage: "Was zockst du am meisten?", optionen: ["Handy 📱", "Konsole 🎮", "PC 🖥️", "Gar nicht"] }),
  m("um4", "news", 1, "jugend.fragt", "Wir wollen's wissen!", 8000, { art: "umfrage", frage: "Wie viele Stunden bist du am Tag am Handy?", optionen: ["< 2", "2–4", "4–6", "> 6"] }),

  // ── Versteckte Werbung ──
  m("be7", "beauty", 2, "glow.lina", "Meine Lieblings-Shakes für den Sommerbody 😍 mit LINA20 spart ihr 20 %", 72000,
    { art: "meme", oben: "Vorher 😩", unten: "Nachher 😍" }, { schleich: "SlimFast Pro" }),
  { id: "mo5", thema: "mode", stufe: 2, von: "sneaker.sam", emoji: "📦", farben: ["#f97316", "#0f172a"],
    text: "Unboxing!!! Die neuen Jumpman Retro 🥹 einfach so bekommen", likes: 41000, schleich: "Sneakr" },

  // ── Nachrichten: was Challenges anrichten ──
  m("ne5", "news", 1, "news.kompakt", "Bitte teilt das. 🙏", 64000, news("Klikk News", "Polizei warnt vor #DachSprung", "15-Jähriger nach Sturz von Garagendach schwer verletzt. Die Polizei bittet Eltern, mit ihren Kindern zu sprechen."), { ab: 1 }),
  m("ne6", "news", 1, "news.kompakt", "😢", 120000, news("Klikk News", "14-Jähriger an Bahnstrecke schwer verletzt", "Freunde filmten für ein #GleisSelfie. Stromschlag an der Oberleitung, schwere Verbrennungen, monatelange Reha. Die Bundespolizei: Oberleitungen führen 15.000 Volt – ein Stromschlag ist schon ohne Berührung möglich, wenn man näher als 1,5 Meter kommt.", true), { ab: 3 }),
  m("ne7", "news", 1, "gesund.kurz", "Kinderärzt·innen schlagen Alarm", 27000, news("Klikk News", "#HotChip: Jugendliche in der Notaufnahme", "Extrem scharfe Chips können Atemnot, Krämpfe und Herzprobleme auslösen. Ein 14-Jähriger musste nach so einer Challenge auf der Intensivstation behandelt werden."), { ab: 2 }),
  m("ne8", "news", 1, "wissen.wow", "Lest das, bevor ihr mitmacht.", 38000, news("Klikk News", "Warum Challenges immer krasser werden", "Videos mit Risiko bekommen mehr Aufrufe – also zeigen Apps sie öfter. Wer mitmacht, wird belohnt. Bis etwas passiert."), { ab: 1 }),
];
