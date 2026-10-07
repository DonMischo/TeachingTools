"use client";
/**
 * Alle Erfolge aller Werkzeuge, wie sie auf diesem Gerät stehen.
 *
 * Gelesen wird erst nach dem Einhängen: auf dem Server gibt es kein
 * localStorage, und ein Unterschied zwischen Server- und Browser-Fassung
 * würde React beim Abgleich stören. Vorher ist `geladen` false.
 */
import { useEffect, useState } from "react";
import { lieseAlle, type WerkzeugSchau } from "@/lib/erfolge/register";

export interface Erfolgsschau {
  werkzeuge: WerkzeugSchau[];
  erreicht: number;
  gesamt: number;
  geladen: boolean;
  /** Noch einmal nachsehen — etwa nachdem woanders gespielt wurde. */
  neuLesen: () => void;
}

export function useErfolge(): Erfolgsschau {
  const [werkzeuge, setWerkzeuge] = useState<WerkzeugSchau[]>([]);
  const [geladen, setGeladen] = useState(false);

  const neuLesen = () => { setWerkzeuge(lieseAlle()); setGeladen(true); };
  useEffect(() => { neuLesen(); }, []);

  return {
    werkzeuge,
    erreicht: werkzeuge.reduce((a, w) => a + w.erreicht, 0),
    gesamt: werkzeuge.reduce((a, w) => a + w.gesamt, 0),
    geladen,
    neuLesen,
  };
}
