import type { ComponentType } from "react";
import type { DemoId } from "@/lib/medien/medien";
import { HieroglyphenDemo, KeilschriftDemo, LeuchtfeuerDemo, QuipuDemo } from "./Antike";
import { BelichtungDemo, ChappeDemo, SetzkastenDemo } from "./Druck";
import { FaxDemo, MorseDemo, PlatteDemo, WaehlscheibeDemo } from "./Elektrisch";
import { DisketteDemo, KassetteDemo, ModemDemo, SmsDemo } from "./Modern";
import { SatellitDemo } from "./Satellit";
import { HoehlenwandDemo, PagerDemo } from "./Live";
import { DiaDemo } from "./Dia";
import { BotenDemo } from "./Boten";

export const DEMOS: Record<DemoId, ComponentType> = {
  keilschrift: KeilschriftDemo, hieroglyphen: HieroglyphenDemo, quipu: QuipuDemo, leuchtfeuer: LeuchtfeuerDemo,
  setzkasten: SetzkastenDemo, chappe: ChappeDemo, belichtung: BelichtungDemo,
  morse: MorseDemo, fax: FaxDemo, waehlscheibe: WaehlscheibeDemo, platte: PlatteDemo,
  kassette: KassetteDemo, diskette: DisketteDemo, sms: SmsDemo,
  satellit: SatellitDemo, modem: ModemDemo, pager: PagerDemo, hoehlenwand: HoehlenwandDemo, dia: DiaDemo, boten: BotenDemo,
};
