import type { ComponentType } from "react";
import type { DemoId } from "@/lib/medien/medien";
import { HieroglyphenDemo, KeilschriftDemo, LeuchtfeuerDemo, QuipuDemo } from "./Antike";
import { BelichtungDemo, ChappeDemo, SetzkastenDemo } from "./Druck";
import { FaxDemo, MorseDemo, PlatteDemo, WaehlscheibeDemo } from "./Elektrisch";
import { KassetteDemo, ModemDemo, SmsDemo } from "./Modern";
import { SatellitDemo } from "./Satellit";
import { HoehlenwandDemo, PagerDemo } from "./Live";
import { DiaDemo } from "./Dia";
import { BotenDemo } from "./Boten";
import { RohrpostDemo } from "./Rohrpost";
import { LitfassDemo } from "./Litfass";
import { KinoDemo } from "./Kino";
import { RadioDemo } from "./Radio";
import { FernsehenDemo } from "./Fernsehen";
import { CdDemo } from "./CD";
import { VideotextDemo } from "./Videotext";
import { TonbandDemo } from "./Tonband";
import { OverheadDemo } from "./Overhead";
import { PolaroidDemo } from "./Polaroid";
import { EmailDemo } from "./Email";
import { DisketteStationDemo } from "./Diskette";
import { QrDemo } from "./Qr";

export const DEMOS: Record<DemoId, ComponentType> = {
  keilschrift: KeilschriftDemo, hieroglyphen: HieroglyphenDemo, quipu: QuipuDemo, leuchtfeuer: LeuchtfeuerDemo,
  setzkasten: SetzkastenDemo, chappe: ChappeDemo, belichtung: BelichtungDemo,
  morse: MorseDemo, fax: FaxDemo, waehlscheibe: WaehlscheibeDemo, platte: PlatteDemo,
  kassette: KassetteDemo, diskette: DisketteStationDemo, sms: SmsDemo,
  satellit: SatellitDemo, modem: ModemDemo, pager: PagerDemo, hoehlenwand: HoehlenwandDemo, dia: DiaDemo, boten: BotenDemo, qrcode: QrDemo,
  rohrpost: RohrpostDemo, litfass: LitfassDemo, kino: KinoDemo, radio: RadioDemo, fernsehen: FernsehenDemo, cd: CdDemo, videotext: VideotextDemo, tonband: TonbandDemo, overhead: OverheadDemo, polaroid: PolaroidDemo, email: EmailDemo,
};
