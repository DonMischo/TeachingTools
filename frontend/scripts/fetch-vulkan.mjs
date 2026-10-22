/**
 * Holt die Galerie-Bilder der Simulation »Vulkane« von Wikimedia Commons
 * nach public/vulkan/galerie/ und schreibt src/lib/vulkan/bilder.json
 * (Urheber, Lizenz, Commons-Seite). Die Bildtexte stehen in
 * src/lib/vulkan/galerie.ts. Nur freie Lizenzen (gemeinfrei, CC0, CC BY, CC BY-SA).
 *
 * Aufruf:  node scripts/fetch-vulkan.mjs  [--force]
 */
import { holeGalerie } from "./commons-galerie.mjs";

/** id → Dateiname auf Commons */
export const BILDER = {
  // ── Schichtvulkane ──
  "fuji": "Mount Fuji from Lake Kawaguchi 20170206.jpg",
  "mayon": "Mayon Volcano and the rice paddies.jpg",
  "vesuv": "Evening view on the bay of Naples, overlooking Mount Vesuvius.jpg",
  "teide": "El Teide and Pico Viejo.jpg",
  "stromboli-sciara": "Stromboli sciara del fuoco 2014-09-19.jpg",
  // ── Ausbruch: Säule, Asche, Glutwolken, Bomben ──
  "st-helens-1980": "MSH80 eruption mount st helens 05-18-80-dramatic-edit.jpg",
  "pinatubo-1991": "Pinatubo 1991-06-12 (USGS).jpg",
  "pinatubo-glutwolke": "Pinatubo 1991-06-29 Pyroclastic flow deposits of Marella River Valley.jpg",
  "eyjafjallajoekull": "Eyjafjallajokull volcano plume 2010 04 17.jpg",
  "aetna-iss": "Etna eruption seen from the International Space Station.jpg",
  "mayon-nacht": "Mayon Volcano Eruption at Night.jpg",
  "stromboli-1979": "Stromboli Eruption 1979-08-18 (02).jpg",
  "aetna-asche": "Volcanic ash & lapilli (16 February 2021 eruption of Mt. Etna, eastern Sicily).jpg",
  "lapilli": "Lapilli Lipari.jpg",
  "bombe": "Lava-bomb-01.jpg",
  // ── Schildvulkane und Lava ──
  "skjaldbreidur": "Skjaldbreiður @ Uxahryggir.jpg",
  "mauna-loa": "Mauna Loa from Mauna Kea - Flickr - Joe Parks.jpg",
  "lavafontaene": "Lava fountaining (5 June 2018) (Kilauea Volcano, Hawaii) (52030467811).jpg",
  "pahoehoe": "Pāhoehoe Lava flow.JPG",
  "pahoehoe-aa": "Pāhoehoe and Aa flows at Hawaii.jpg",
  "mauna-loa-2022": "Lava flow front of the 2022 Mauna Loa eruption.jpg",
  "lavaroehre": "Thurston Lava Tube (Nāhuku) (34451623741).jpg",
  "lava-meer": "Pāhoehoe lava meets Pacific.jpg",
  // ── Hotspots ──
  "hawaii-iss": "ISS-38 Hawaiian Island chain.jpg",
  "hawaii-emperor": "Hawaii-Emperor dt.png",
  "hawaii-hotspot": "Hawaii hotspot.jpg",
  "halemaumau": "HAVO 20211219 Halemaumau lava lake from Keanakakoi J Wei (51759578453).jpg",
  "kissenlava": "Nur05018-Pillow lavas off Hawaii.jpg",
  "loihi-kissenlava": "Pillow Lava from Loihi Seamount in Hawaii USA.jpg",
  "yellowstone": "Grand Prismatic Spring (22755808179).jpg",
  "fernandina": "Fernandina view.jpg",
  // ── Formen: Caldera, Maar, Dom, Kegel, Säulen ──
  "crater-lake": "Crater Lake winter pano2.jpg",
  "santorin": "Caldera of Santorini - Nea Kameni - seen from Fira Thira.jpg",
  "st-helens-dom": "Mount St. Helens lava dome panorama July 2014.jpg",
  "paricutin": "Paricutin.jpg",
  "basaltsaeulen": "Antrim Coast - Giant's Causeway - Port Granny - Basalt Columns - geograph.org.uk - 3719380.jpg",
  // ── Vulkane in Deutschland ──
  "laacher-see": "Laacher See - Luftaufnahme.jpg",
  "weinfelder-maar": "Weinfelder Maar, Bild 1.jpg",
  "vogelsberg": "Vogelsberg bei Lautertal im Vogelsberg, Hessen, von Osten betrachtet.jpg",
  "rhoen-basalt": "Gersfeld Gersfeld Simmelsberg Basaltformation NO.png",
};

if (process.argv[1] && process.argv[1].endsWith("fetch-vulkan.mjs")) {
  await holeGalerie({
    bilder: BILDER, ziel: "public/vulkan/galerie", nachweise: "src/lib/vulkan/bilder.json",
    url: "/vulkan/galerie", force: process.argv.includes("--force"),
  });
}
