"use client";
/** Der Friedhof der Medien: Was sich nicht durchgesetzt hat — und warum. */
import { MEDIEN, epoche } from "@/lib/medien/medien";

export default function FlopMuseum({ geschafft }: { geschafft: string[] }) {
  const flops = MEDIEN.filter(m => m.flop);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted max-w-3xl">
        Nicht jedes Medium gewinnt. Oft war die Technik gut — aber zu teuer, zu früh, zu geschlossen, oder ein anderes Medium transportierte die Information einfacher.
        Lerne aus ihren Fehlern. Und lies die Grabsprüche.
      </p>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))" }}>
        {flops.map(m => (
          <article key={m.id} className="relative flex flex-col items-center text-center gap-2 p-4 pt-6 border-2 border-line bg-surface shadow-sm"
            style={{ borderRadius: "7rem 7rem 0.75rem 0.75rem" }}>
            <div className="text-[11px] font-black uppercase tracking-widest text-muted">R.I.P.</div>
            <div className="text-5xl" aria-hidden>{m.icon}</div>
            <h3 className="font-black text-lg leading-tight">{m.name}</h3>
            <div className="text-xs font-bold" style={{ color: epoche(m.epoche).farbe }}>{m.flop!.lebte}</div>
            <p className="italic text-sm">»{m.flop!.grabspruch}«</p>
            <p className="text-xs text-muted leading-relaxed"><b className="text-fg">Warum?</b> {m.flop!.warum}</p>
            {geschafft.includes(m.id) && <span className="text-[11px] text-ok font-bold">✓ in der Zeitreise besucht</span>}
            <div className="w-full h-3 mt-auto rounded" style={{ background: "repeating-linear-gradient(90deg, #65a30d 0 4px, #4d7c0f 4px 8px)" }} aria-hidden />
          </article>
        ))}
      </div>
      <section className="card p-4 text-sm">
        <h3 className="font-black mb-1">🧠 Was haben die Flops gemeinsam?</h3>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li><b>Zu früh:</b> Das Netz war zu dünn für die Idee (Bildtelefon, Telharmonium).</li>
          <li><b>Zu geschlossen:</b> Einer bestimmte alles, ein offenes System war billiger (BTX gegen das Internet).</li>
          <li><b>Keine Inhalte:</b> Ein Format ohne Filme oder Partner bleibt leer (Betamax, HD DVD).</li>
          <li><b>Nicht überall lesbar:</b> Eigene Geräte verlieren gegen Standards, die überall passen (MiniDisc, Zip).</li>
          <li><b>Nicht akzeptiert:</b> Die Menschen drumherum wollten nicht mitmachen (Google Glass).</li>
        </ul>
      </section>
    </div>
  );
}
