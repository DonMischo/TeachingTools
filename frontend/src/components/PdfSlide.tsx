"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";

// PDFs are drawn with pdf.js instead of an <iframe>: browsers without a built-in
// PDF viewer (kiosk/TV browsers, Android, some guest profiles) download an
// iframed PDF instead of showing it. The legacy build keeps older display
// browsers working. Pages advance every `pageMs`; after the last page the slide
// calls `onDone` (or starts over when `loop`).

let pdfjs: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

function loadPdfjs() {
  pdfjs ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    return lib;
  });
  return pdfjs;
}

export function PdfSlide({ url, pageMs, loop, onDone }: {
  url: string;
  pageMs: number;
  loop: boolean;
  onDone: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    loadPdfjs()
      .then((lib) => lib.getDocument(url).promise)
      .then((d) => {
        loaded = d;
        if (cancelled) d.destroy();
        else setDoc(d);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [url]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setBox({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !box.w || !box.h) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    doc.getPage(page).then((p) => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const base = p.getViewport({ scale: 1 });
      const fit = Math.min(box.w / base.width, box.h / base.height);
      const dpr = window.devicePixelRatio || 1;
      const viewport = p.getViewport({ scale: fit * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
      task = p.render({ canvasContext: canvas.getContext("2d")!, viewport });
      task.promise.catch(() => { /* cancelled by a newer render */ });
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, box.w, box.h]);

  useEffect(() => {
    if (!doc && !failed) return;
    const t = setTimeout(() => {
      if (doc && page < doc.numPages) setPage(page + 1);
      else if (loop) setPage(1);
      else onDoneRef.current();
    }, pageMs);
    return () => clearTimeout(t);
  }, [doc, failed, page, loop, pageMs]);

  return (
    <div ref={boxRef} className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {failed ? (
        <div className="text-(--text-muted)">PDF konnte nicht geladen werden</div>
      ) : (
        <canvas ref={canvasRef} className="bg-white shadow-lg" />
      )}
      {doc && doc.numPages > 1 && (
        <div className="absolute bottom-2 right-3 text-xs px-2 py-0.5 rounded-full bg-black/50 text-white tabular-nums">
          {page} / {doc.numPages}
        </div>
      )}
    </div>
  );
}
