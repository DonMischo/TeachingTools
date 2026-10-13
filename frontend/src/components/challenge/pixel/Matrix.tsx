/** Eigenes Pixelbild aus Zeichen: "." = transparent, sonst Schlüssel in `palette` (Hex). */
export function PixelMatrix({ bild, palette, scale = 4, label }: {
  bild: string[]; palette: Record<string, string>; scale?: number; label?: string;
}) {
  const w = Math.max(...bild.map((z) => z.length));
  return (
    <svg width={w * scale} height={bild.length * scale} viewBox={`0 0 ${w} ${bild.length}`} shapeRendering="crispEdges"
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {bild.flatMap((zeile, y) =>
        [...zeile].map((c, x) => (c === "." || !palette[c] ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={palette[c]} />)))}
    </svg>
  );
}
