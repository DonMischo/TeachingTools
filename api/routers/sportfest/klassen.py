"""Welcher Klasse ein Sportfest-Ergebnis zugerechnet wird.

``Student.klasse`` ist ein Textfeld und wandert beim Jahrgangssprung mit: aus
»7a« wird »8a«. Als Schluessel taugt es damit nur innerhalb eines Schuljahres —
laeuft die Auswertung ueber den 1. August hinweg oder hinkt ein Import
hinterher, zeigt der Text auf die falsche oder auf gar keine Klasse, und die
Hauspokal-Punkte landen daneben.

``ak_code`` ist genau dafuer da (siehe api/schoolyear.py): »AK2034a« bleibt
dieselbe Klasse, egal in welcher Jahrgangsstufe sie gerade steht. Sowohl
``Student`` als auch ``Class`` tragen ihn, ein Abgleich darueber ist also ein
Schluesselvergleich statt eines Textvergleichs.

Nicht jeder Datensatz hat einen — von 515 aktiven Schuelern waren es zuletzt
425. Deshalb bleibt das Kuerzel als zweiter Weg stehen: erst der stabile
Schluessel, dann der Text, und wer ueber keinen von beiden zu einer Klasse
findet, taucht in der Auswertung ohne ``class_id`` auf (sichtbar, aber ohne
Punktevergabe) statt still zu verschwinden.

**Nicht** hierfuer zustaendig: die Wertungstabellen. ``scoring.calculate_points``
liest aus ``klasse`` die Jahrgangsnummer und damit die Altersnorm — das ist
eine Aussage ueber das Kind heute, nicht ueber die Zugehoerigkeit zu einer
Klasse, und bleibt am aktuellen Kuerzel.
"""
from dataclasses import dataclass

from sqlalchemy.orm import Session

from ...models import Class, Student
from ...utils import grade_of_class_code


@dataclass
class ClassIndex:
    """Nachschlagewerk fuer einen Request: einmal bauen, oft fragen."""
    by_ak: dict[str, Class]
    by_code: dict[str, Class]

    def of(self, s: Student) -> Class | None:
        """Die Klasse dieses Schuelers — erst ueber den AK-Code, dann ueber das Kuerzel."""
        if s.ak_code:
            cls = self.by_ak.get(s.ak_code)
            if cls is not None:
                return cls
        return self.by_code.get(s.klasse or "")

    def label(self, s: Student) -> str:
        """Wie die Klasse dieses Schuelers *heute* heisst."""
        cls = self.of(s)
        return cls.code if cls is not None else (s.klasse or "—")

    def grade(self, s: Student) -> int | None:
        """Jahrgangsstufe der Klasse; ersatzweise die am Schueler vermerkte."""
        cls = self.of(s)
        if cls is not None:
            stufe = grade_of_class_code(cls.code)
            if stufe is not None:
                return stufe
        return s.jahrgang


def class_index(db: Session) -> ClassIndex:
    klassen = db.query(Class).all()
    return ClassIndex(
        by_ak={c.ak_code: c for c in klassen if c.ak_code},
        by_code={c.code: c for c in klassen},
    )
