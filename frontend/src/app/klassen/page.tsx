"use client";
import { KlassenHaeuserView } from "../haeuser/page";

// Klassenverwaltung — the class grid + per-class detail (roles, Dienste,
// Tracker, Sitzplan, Klassensprecher-Freigabe). Shares the view with /haeuser;
// see KlassenHaeuserView for the mode split.
export default function KlassenPage() {
  return <KlassenHaeuserView mode="klassen" />;
}
