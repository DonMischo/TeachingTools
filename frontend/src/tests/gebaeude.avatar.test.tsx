import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import * as THREE from "three";
import { FORMEN, HAUT, KLASSEN, STANDARD_AVATAR, baueAvatar, istAvatar, ladeAvatar, type Avatar } from "@/components/gebaeude/avatar";
import AvatarWahl from "@/components/gebaeude/AvatarWahl";

afterEach(() => localStorage.clear());

describe("Spielfiguren", () => {
  it("jede Klasse in jeder Form und jedem Hautton steht auf dem Boden und ist etwa 1,2–1,7 hoch", () => {
    for (const k of KLASSEN) for (const f of FORMEN) for (let h = 0; h < HAUT.length; h++) {
      const g = baueAvatar({ klasse: k.id, form: f.id, haut: h });
      const box = new THREE.Box3().setFromObject(g);
      expect(box.min.y, `${k.id}/${f.id}`).toBeGreaterThanOrEqual(-0.01);
      expect(box.max.y, `${k.id}/${f.id}`).toBeGreaterThan(1.2);
      expect(box.max.y, `${k.id}/${f.id}`).toBeLessThan(1.8);
    }
  });

  it("Hautton färbt den Kopf", () => {
    const farbeKopf = (haut: number) => {
      const g = baueAvatar({ klasse: "normal", form: "m", haut });
      const kopf = g.children.find(o => o instanceof THREE.Mesh && o.geometry instanceof THREE.SphereGeometry
        && (o.geometry as THREE.SphereGeometry).parameters.radius === 0.17) as THREE.Mesh;
      return (kopf.material as THREE.MeshLambertMaterial).color.getHex();
    };
    expect(farbeKopf(0)).toBe(HAUT[0]);
    expect(farbeKopf(3)).toBe(HAUT[3]);
  });

  it("gespeicherte Wahl wird geladen, Unsinn ergibt die Standardfigur", () => {
    expect(ladeAvatar()).toEqual(STANDARD_AVATAR);
    localStorage.setItem("hp_avatar", JSON.stringify({ klasse: "magier", form: "w", haut: 2 }));
    expect(ladeAvatar()).toEqual({ klasse: "magier", form: "w", haut: 2 });
    for (const falsch of ["{kaputt", JSON.stringify({ klasse: "drache", form: "m", haut: 0 }), JSON.stringify({ klasse: "rocker", form: "x", haut: 9 })]) {
      localStorage.setItem("hp_avatar", falsch);
      expect(ladeAvatar()).toEqual(STANDARD_AVATAR);
    }
    expect(istAvatar({ klasse: "priester", form: "m", haut: 1 })).toBe(true);
  });

  it("Auswahl speichert Klasse, Form und Hautton", () => {
    let aktuell: Avatar = STANDARD_AVATAR;
    const { rerender } = render(<AvatarWahl avatar={aktuell} onWahl={a => { aktuell = a; }} />);
    fireEvent.click(screen.getByRole("button", { name: /Figur/ }));
    fireEvent.click(screen.getByRole("button", { name: /Rocker/ }));
    rerender(<AvatarWahl avatar={aktuell} onWahl={a => { aktuell = a; }} />);
    fireEvent.click(screen.getByRole("button", { name: "weiblich" }));
    rerender(<AvatarWahl avatar={aktuell} onWahl={a => { aktuell = a; }} />);
    fireEvent.click(screen.getByRole("button", { name: "Hautton 3" }));
    expect(aktuell).toEqual({ klasse: "rocker", form: "w", haut: 2 });
    expect(JSON.parse(localStorage.getItem("hp_avatar")!)).toEqual(aktuell);
  });
});
