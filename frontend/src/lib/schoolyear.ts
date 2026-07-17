/** Mirrors api/schoolyear.py — Stichtag 1. August starts a new school year. */
export function getSchoolYearStart(d: Date = new Date()): number {
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; // getMonth() is 0-indexed, 7 = August
}

export function getSchoolYearLabel(d: Date = new Date()): string {
  const start = getSchoolYearStart(d);
  return `${start}/${start + 1}`;
}
