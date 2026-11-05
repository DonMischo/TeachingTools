import type { ComponentType } from "react";
import type { DemoId } from "@/lib/medien/medien";
import { HieroglyphenDemo, KeilschriftDemo, LeuchtfeuerDemo, QuipuDemo } from "./Antike";
import { BelichtungDemo, ChappeDemo, SetzkastenDemo } from "./Druck";
import { FaxDemo, MorseDemo, PlatteDemo, WaehlscheibeDemo } from "./Elektrisch";
import { DisketteDemo, KassetteDemo, SmsDemo } from "./Modern";

export const DEMOS: Record<DemoId, ComponentType> = {
  keilschrift: KeilschriftDemo, hieroglyphen: HieroglyphenDemo, quipu: QuipuDemo, leuchtfeuer: LeuchtfeuerDemo,
  setzkasten: SetzkastenDemo, chappe: ChappeDemo, belichtung: BelichtungDemo,
  morse: MorseDemo, fax: FaxDemo, waehlscheibe: WaehlscheibeDemo, platte: PlatteDemo,
  kassette: KassetteDemo, diskette: DisketteDemo, sms: SmsDemo,
};
