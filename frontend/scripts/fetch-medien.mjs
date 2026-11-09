/**
 * Holt die Galerie-Bilder der Simulation »Geschichte der Medien« von Wikimedia
 * Commons nach public/medien/galerie/ und schreibt src/lib/medien/bilder.json
 * (Urheber, Lizenz, Commons-Seite). Die Bildtexte und welche Station ein Foto
 * freischaltet stehen in src/lib/medien/galerie.ts. Nur freie Lizenzen.
 *
 * Aufruf:  node scripts/fetch-medien.mjs  [--force]
 */
import { holeGalerie } from "./commons-galerie.mjs";

/** id → Dateiname auf Commons */
export const BILDER = {
  // ── Urzeit ──
  "lascaux": "Lascaux painting.jpg",
  "cueva-manos": "SantaCruz-CuevaManos-P2210651b.jpg",
  "sprechtrommel": "Talking Drum Vakpo.jpg",
  "rauchzeichen": "Frederic Remington smoke signal.jpg",
  // ── Antike ──
  "ea-nasir": "Complaint tablet to Ea-Nasir, 2023.jpg",
  "keilschrift": "Cuneiform Akkadian clay tablet 1.jpg",
  "uruk-tafel": "Uruk period administrative tablet.jpg",
  "papyrus-ani": "Papyrus Ani curs hiero.jpg",
  "rosetta": "The Rosetta Stone.jpg",
  "leuchtfeuer": "함안 파산 봉수대.jpg",
  "phoenizisch": "Hamakar's comparison of \"Phoenician\" inscriptions, 1828.jpg",
  "wachstafel": "Replica of roman wax writing tablet with stylus.jpg",
  "pheidippides": "Frank Moss Bennett The Athenian Messenger Pheidippides Delivers News of the Victory at Marathon ca 1913.jpg",
  "chaski": "Chaski.jpg",
  "taubenkapsel": "World War I Carrier Pigeon Message Capsule with Original Message.jpg",
  // ── Mittelalter ──
  "papier-cai-lun": "Five Steps of Papermaking - Step 3 - Casting the Paper Pulp - As described by Cai Lun in 105 CE.jpg",
  "moench": "Scriptorium-monk-at-work.jpg",
  "manesse": "Codex Manesse 127r.jpg",
  "diamant-sutra": "Diamond Sutra of 868 AD - The Diamond Sutra (868), frontispiece and text - BL Or. 8210-P.2.jpg",
  "quipu": "Inca. Quipu.jpg",
  "quipu-larco": "52 Quipu Inca Larco Museum Lima Peru 1840.jpg",
  "gutenberg-bibel": "Gutenberg Bible, New York Public Library, USA. Pic 01.jpg",
  "lettern": "Metal movable type.jpg",
  "druckerpresse": "Gutenberg press.png",
  // ── Frühe Neuzeit ──
  "postreiter": "Postreiter 1728.jpg",
  "postkutsche": "Georg Hemmrich Postkutsche in Tirol.jpg",
  "relation": "Relation Aller Fuernemmen und gedenckwuerdigen Historien (1609).jpg",
  "chappe": "Chappe semaphore.jpg",
  "chappe-saverne": "Tour du telegraphe Chappe Saverne 02.JPG",
  // ── 19. Jahrhundert ──
  "niepce": "View from the Window at Le Gras, Joseph Nicéphore Niépce.jpg",
  "boulevard-du-temple": "Boulevard du Temple by Daguerre.jpg",
  "erstes-telegramm": "The first telegram. Professor Samuel Morse sending the despatch as dictated by Miss Annie Ellsworth.jpg",
  "seekabel-1858": "H.M.S. Agamemnon Laying the Atlantic Telegraph Cable in 1858- a Whale Crosses the Line MET DP801262.jpg",
  "bain-fax": "Bain improved facsimile 1850.png",
  "fax-geraet": "Fax machine printing.jpg",
  "rohrpost-berlin": "Rohrpost Berlin 1885.jpg",
  "rohrpostbrief": "Ganzsache Rohrpostbrief Deutsches Reich RU5.jpg",
  "reis-telefon": "Nachbau des Telefons von Philipp Reis, Sprechseite.jpg",
  "vermittlung": "Photograph of Women Working at a Bell System Telephone Switchboard - NARA - 1633445.jpg",
  "phonograph": "Tinfoil phonograph, 1878, invented by Thomas Alva Edison - National Museum of American History - DSC06217.JPG",
  "grammophon": "Berliner Gramophone 3301Z.png",
  "skladanowsky": "Skladanowsky Brothers with the Bioskop - restored.jpg",
  "cinematographe": "Cinematographe Lumiere.jpg",
  "telharmonium": "Teleharmonium1897.jpg",
  // ── 20. Jahrhundert ──
  "radio-1920": "Early 1920s radio and horn speaker.png",
  "volksempfaenger": "Volksempfänger VE 301 Dyn, NG-2009-110.jpg",
  "nipkow-kamera": "Mechanical spinning disk television camera 1931.jpg",
  "fernseher-1950": "Television set from the early 1950s crop.jpg",
  "fernschreiber": "Der Fernschreiber - Siemens Blattschreiber M 1933.jpg",
  "magnetophon": "AEG Magnetophon K4 1939.jpg",
  "picturephone": "1969 AT&T Picturephone Model 2 at the Early Television Museum June 2022.jpg",
  "telstar": "Telstar 1 replica.jpg",
  "kassette": "2023 Kaseta magnetofonowa i minikaseta (1).jpg",
  "walkman": "Walkman TPS-L2.jpg",
  "disketten": "Floppy disks - 8 inch, 5.25 inch, 3.5 inch (17361863025).jpg",
  "tomlinson": "Ray Tomlinson (cropped).jpg",
  "vhs-betamax": "VHS vs Betamax size.jpg",
  "laserdisc": "LaserDisc.jpg",
  "cds": "CDs, Seitenansicht -- 2017 -- 2218.jpg",
  "btx": "BTX - Wir und unsere Polizei.jpg",
  "dynatac": "DynaTAC8000X.jpg",
  // ── Digital ──
  "erster-webserver": "First Web Server.jpg",
  "akustikkoppler": "Acoustic coupler-IMG 7282-7283.jpg",
  "nokia-3310": "Nokia 3310 blue.jpg",
  "minidisc": "Minidisc.jpeg",
  "pager": "Motorola Minicall Express Swedish 1990s pager.jpg",
  "zip": "Zip 100 drive and Zip 100 disk, lomega, US, 1994.jpg",
  "brandenburg": "Karlheinz Brandenburg cropped.jpg",
  "ipod": "IPod 1Gen.jpg",
  "glasfaser": "Optical fiber cable-06ASD.jpg",
  // ── Heute ──
  "ibm-simon": "IBM Simon Personal Communicator (1993) - the first smartphone - Computer History Museum.jpg",
  "iphone": "Original iPhone docked.jpg",
  "smartphone": "Black smartphone in hand (Unsplash).jpg",
  "hd-dvd": "HD-DVD player deeply discounted in 2008.jpg",
  "google-glass": "Google Glass Explorer Edition.jpeg",
  "rechenzentrum": "Datacenter Server Racks (22370909788).jpg",
  // ── nachgetragen aus dem TaskCrawler ──
  "griot": "Susu Griot, circa 1910, Conakry, Guinea.jpg",
  "orakelknochen": "Shang Ox Scapula Oracle Bones 1.jpg",
  "alexandria": "Ancientlibraryalex.jpg",
  "dresdner-kodex": "Dresden codex, page 2.jpg",
  "eniac": "Glen Beck and Betty Snyder program the ENIAC in building 328 at the Ballistic Research Laboratory.jpg",
  "arpanet-skizze": "Map of the 4 node arpanet, of 1969, drawn on a napkin.jpg",
  "imp-log": "The IMP Log The Very First Message Sent on the Internet (6293913865).jpg",
  "jeschow-original": "Nikolai Yezhov with Stalin and Molotov along the Volga–Don Canal, original.jpg",
  "jeschow-retusche": "Stalin and Molotov along the Volga–Don Canal, Nikolai Yezhov removed.jpg",
  "emoji-ballen": "Emoji bales (36765488293).jpg",
  "wikipedia-2001": "German Wikipedia MainPage (2001-11-29).png",
  "mpesa-nokia": "M-Pesa on Nokia 1100 20120430.jpg",
  "netflix-umschlag": "Netflix envelope (2655128664).jpg",
  "ipad-2010": "IPad-WiFi-1stGen.jpg",
  "digidoug": "DigiDoug DeepFake at TED2019.jpg",
  "papst-jacke": "Pope Francis in puffy winter jacket.jpg",
  "diffusion-schritte": "Stable Diffusion - Rhino X Y Plot to show different Steps.png",
  // ── Projektoren, Kuriositäten, jüngere Medien ──
  "laterna-projektion": "Neuenrade Laterna Magica Projektion.jpg",
  "laterna-glasbilder": "Laterna Magica slides.jpg",
  "litfasssaeule": "Düsseldorf, Litfaßsäule -- 2015 -- 8222.jpg",
  "phonautograph": "Phonautograph 1859.jpg",
  "hirmondo-stentor": "Telefon Hirmondo - Stentor reading the day's news.jpg",
  "hirmondo-zuhause": "Telefon Hirmondo - Home subscriber (1901).jpg",
  "polaroid-95": "Polaroid Land Camera Model 95 - MIT Museum - DSC03766.JPG",
  "carousel": "Kodak Carousel 4400 projector with 140-slide tray.jpg",
  "overhead": "Overhead Projector (Medium 2036).jpg",
  "sasson": "Kodak Sasson BL.jpg",
  "teletekst": "Start NOS Teletekst op VU Amsterdam Max Euwe (rechts) en prof RD vd Riet bij een beeldscherm.jpg",
  "qr-schild": "SaniSale.com Quick Response code, Groningen (2019) 01.jpg",
  "podcast-mikro": "Microphone in SPNN Podcast studio.jpg",
  "whatsapp": "Whatsapp texting.jpg",
  "echo-dot": "Amazon Echo Dot (virtual digital assistant) with normal coffee mug as size comparison.jpg",
  "3d-brillen": "Barack and Michelle Obama looking the 2009 Superbowl with 3-D glasses.jpg",
  "tiktok": "TikTok app.jpg",
  "onlineteacher": "Onlineteacher.jpg",
};

if (process.argv[1]?.endsWith("fetch-medien.mjs")) {
  await holeGalerie({
    bilder: BILDER,
    ziel: "public/medien/galerie",
    nachweise: "src/lib/medien/bilder.json",
    url: "/medien/galerie",
    force: process.argv.includes("--force"),
  });
}
