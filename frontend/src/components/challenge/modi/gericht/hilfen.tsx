"use client";
/** Kleinkram des Gericht-Modus: Animationsstil. */
export function GerichtStil() {
  return (
    <style>{`
      @keyframes gr-schuettel{0%,100%{transform:translate(0,0)}15%{transform:translate(-9px,4px)}30%{transform:translate(8px,-5px)}45%{transform:translate(-7px,-3px)}60%{transform:translate(6px,5px)}80%{transform:translate(-3px,2px)}}
      @keyframes gr-burst{0%{transform:scale(.2) rotate(-12deg);opacity:0}30%{transform:scale(1.25) rotate(-6deg);opacity:1}100%{transform:scale(1) rotate(-6deg);opacity:1}}
      @keyframes gr-hammer{0%,100%{transform:rotate(-40deg)}50%{transform:rotate(25deg) translateY(6px)}}
      @keyframes gr-zittern{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
      @keyframes gr-tropf{0%{transform:translateY(0);opacity:1}100%{transform:translateY(20px);opacity:0}}
      .gr-schuettel{animation:gr-schuettel .55s 1}.gr-burst{animation:gr-burst .35s forwards}.gr-hammer{animation:gr-hammer .4s 3}
      .gr-zittern{animation:gr-zittern .15s infinite}.gr-tropf{animation:gr-tropf 1s infinite}
      @media (prefers-reduced-motion: reduce){.gr-schuettel,.gr-burst,.gr-hammer,.gr-zittern,.gr-tropf{animation:none!important}}
    `}</style>
  );
}
