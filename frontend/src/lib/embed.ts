// Verwandelt eine Medien-URL in eine einbettbare Form: YouTube/Vimeo-Links
// werden zu iframe-Embeds, alles andere bleibt ein <video>-Tag.
export function toVideoEmbed(src: string): { kind: "iframe" | "video"; url: string } {
  const yt = src.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([\w-]+)/);
  if (yt) return { kind: "iframe", url: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = src.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: "iframe", url: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { kind: "video", url: src };
}
