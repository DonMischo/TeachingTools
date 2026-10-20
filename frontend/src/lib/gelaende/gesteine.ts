/** Steckbriefe der Gesteine im Reiter »Gesteine & Verwitterung« */
import type { Gestein, Kraft } from "./verwitterung";

export interface Steckbrief {
  gruppe: "Magmatit" | "Sediment (fest)" | "Sediment (locker)" | "Metamorphit";
  entstehung: string;
  eigenschaften: string;
  formen: string;
  beispiele: string;
  /** am stärksten wirkende Kräfte */
  stark: Kraft[];
  /** passendes Klima zum Ausprobieren */
  klima: string;
}

export const STECKBRIEFE: Record<Gestein, Steckbrief> = {
  granit: {
    gruppe: "Magmatit",
    entstehung: "Tiefengestein: Magma erstarrt langsam tief in der Erdkruste, große Kristalle aus Quarz, Feldspat und Glimmer.",
    eigenschaften: "Sehr hart, kaum porös, aber von Klüften durchzogen (beim Abkühlen und Heben entstanden).",
    formen: "Wollsackverwitterung: Wasser dringt in die Klüfte, die Ecken der Blöcke werden von mehreren Seiten zersetzt und runden sich. Der Feldspat zerfällt zu Ton, übrig bleibt Grus. Felsburgen, Blockmeere.",
    beispiele: "Brocken (Harz), Luisenburg im Fichtelgebirge, Greifensteine (Erzgebirge).",
    stark: ["chemie", "frost", "wasser"],
    klima: "harz",
  },
  sandstein: {
    gruppe: "Sediment (fest)",
    entstehung: "Sandkörner, die von Wasser oder Wind abgelagert und durch Bindemittel (Kalk, Kieselsäure, Ton) verkittet wurden.",
    eigenschaften: "Porös und wasserdurchlässig, Bänke unterschiedlich fest, senkrechte Klüfte.",
    formen: "Weiche Schichten wittern zurück, harte stehen vor: Simse, Tafelberge, Felstürme entlang der Klüfte. In der Wüste schleift der Sand den Fuß ab (Pilzfelsen).",
    beispiele: "Elbsandsteingebirge (Bastei), Buntsandstein in Ost- und Südthüringen, Tafelberge der Sahara.",
    stark: ["frost", "wind", "sonne"],
    klima: "wueste",
  },
  kalk: {
    gruppe: "Sediment (fest)",
    entstehung: "Aus Kalkschalen und -skeletten von Meerestieren oder Ausfällung im Meer.",
    eigenschaften: "Selbst kaum durchlässig, aber klüftig — Wasser verschwindet in den Klüften. Löslich in kohlensäurehaltigem Wasser: CaCO₃ + H₂O + CO₂ ⇌ Ca(HCO₃)₂.",
    formen: "Karst: Karren an der Oberfläche, Dolinen (Einsturztrichter), Höhlen entlang von Klüften und Schichtfugen, Tropfsteine (das Wasser gibt in der Höhle CO₂ ab, Kalk fällt aus), Karstquellen über undurchlässigem Ton.",
    beispiele: "Muschelkalk im Saaletal bei Jena und im Hainich, Schwäbische Alb, Fränkische Schweiz.",
    stark: ["chemie", "frost"],
    klima: "mittel",
  },
  gips: {
    gruppe: "Sediment (fest)",
    entstehung: "Ausgefällt beim Eindunsten von Meerwasser (Zechstein-Meer vor etwa 255 Mio. Jahren).",
    eigenschaften: "Weich (mit dem Fingernagel ritzbar) und löst sich viel schneller als Kalk — schon in reinem Wasser.",
    formen: "Gipskarst: schnell wachsende Höhlen, Erdfälle, die plötzlich einbrechen, Bachschwinden.",
    beispiele: "Barbarossahöhle am Kyffhäuser, Südharz.",
    stark: ["chemie", "wasser"],
    klima: "mittel",
  },
  schiefer: {
    gruppe: "Metamorphit",
    entstehung: "Tonstein, der unter Druck und Hitze umgewandelt wurde; die Minerale richten sich parallel aus (Schieferung).",
    eigenschaften: "Spaltet in dünne Platten, nimmt in den Fugen Wasser auf.",
    formen: "Frost spaltet entlang der Schieferung: Plattenschutt, steile, scharfe Grate. Chemisch zerfällt er langsam zu Ton.",
    beispiele: "Thüringer Schiefergebirge (Dachschiefer aus Lehesten), Rheinisches Schiefergebirge.",
    stark: ["frost"],
    klima: "gebirge",
  },
  basalt: {
    gruppe: "Magmatit",
    entstehung: "Ergussgestein: Lava erstarrt schnell an der Oberfläche; beim Abkühlen zieht sie sich zusammen und zerfällt in Säulen.",
    eigenschaften: "Dunkel, sehr hart, feinkörnig; senkrechte Säulenklüfte.",
    formen: "Säulen brechen an den Fugen: Blockhalden und Blockmeere am Hang. Dunkle Oberflächen heizen sich stark auf.",
    beispiele: "Rhön (Thüringen, Hessen, Bayern), Hoher Meißner, Giant's Causeway (Nordirland).",
    stark: ["frost", "sonne"],
    klima: "gebirge",
  },
  loess: {
    gruppe: "Sediment (locker)",
    entstehung: "Feiner Staub, den der Wind in der Eiszeit aus vegetationslosen Ebenen vor dem Eis ausblies und ablagerte.",
    eigenschaften: "Gelblich, kalkhaltig, sehr fruchtbar; trocken standfest, nass weich.",
    formen: "Hohlwege mit senkrechten Wänden, Lössterrassen; bei Starkregen schnelle Abspülung (Erosionsrinnen).",
    beispiele: "Magdeburger Börde, Kaiserstuhl, Lössgebiete Chinas.",
    stark: ["wasser", "wind"],
    klima: "mittel",
  },
  ton: {
    gruppe: "Sediment (locker)",
    entstehung: "Feinste Teilchen (kleiner als 0,002 mm), oft das Endprodukt chemischer Verwitterung.",
    eigenschaften: "Quillt bei Nässe, kaum durchlässig: Wasser staut sich darauf (Staunässe) und über ihm treten Quellen aus.",
    formen: "Rutschungen und Bodenfließen an nassen Hängen, Rinnen durch Oberflächenabfluss.",
    beispiele: "Tonhänge im Keuper des Thüringer Beckens, Rutschungen an Steilufern.",
    stark: ["wasser", "frost"],
    klima: "tropen",
  },
  sand: {
    gruppe: "Sediment (locker)",
    entstehung: "Körner von 0,06 bis 2 mm, meist Quarz — übrig, wenn andere Minerale verwittert sind.",
    eigenschaften: "Locker, sehr durchlässig: Regen versickert sofort. Trocken wird er vom Wind verweht.",
    formen: "Dünen mit flacher Luv- und steiler Leeseite (Rutschhang), Deflationsmulden.",
    beispiele: "Dünen an Nord- und Ostsee, Binnendünen in Brandenburg, Sahara.",
    stark: ["wind", "wasser"],
    klima: "wueste",
  },
};
