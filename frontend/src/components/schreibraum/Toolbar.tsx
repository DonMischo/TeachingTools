"use client";
import { useRef } from "react";
import type { Editor } from "@tiptap/react";

interface Props {
  editor: Editor;
  isTeacher?: boolean;
  mode?: string;
  onModeChange?: (mode: string) => void;
  onMarkFree?: () => void;
  onMarkLocked?: () => void;
  onUnmarkBlock?: () => void;
  onUploadFile?: (file: File) => Promise<void>;
  onExport?: (fmt: "docx" | "tex") => void;
}

const sep = (
  <div
    style={{
      width: 1,
      background: "var(--border)",
      margin: "0 4px",
      alignSelf: "stretch",
    }}
  />
);

function AlignIcon({ type }: { type: "left" | "center" | "right" | "justify" }) {
  const w = 14, h = 12, lh = 2, gap = 3;
  const lines = {
    left: [[0, w], [0, w * 0.6], [0, w * 0.8]],
    center: [[w * 0.1, w * 0.9], [w * 0.2, w * 0.8], [w * 0.05, w * 0.95]],
    right: [[0, w], [w * 0.4, w], [w * 0.2, w]],
    justify: [[0, w], [0, w], [0, w * 0.6]],
  }[type];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="currentColor">
      {lines.map(([x1, x2], i) => (
        <rect key={i} x={x1} y={i * (lh + gap)} width={x2 - x1} height={lh} rx={0.5} />
      ))}
    </svg>
  );
}

function Btn({
  onClick, active, title, disabled, children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      disabled={disabled}
      style={{
        padding: "3px 7px",
        borderRadius: 5,
        border: "none",
        background: active ? "rgba(255,235,59,0.18)" : "transparent",
        color: active ? "#c8a000" : disabled ? "var(--text-muted)" : "var(--text-muted)",
        cursor: disabled ? "default" : "pointer",
        fontWeight: active ? 700 : 400,
        fontSize: 13,
        lineHeight: "1.4",
      }}
    >
      {children}
    </button>
  );
}

const ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.docx,.odt,.pptx,.odp,.xlsx,.ods,.txt,.csv,.md";

export default function Toolbar({ editor, isTeacher, mode, onModeChange, onMarkFree, onMarkLocked, onUnmarkBlock, onUploadFile, onExport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onUploadFile) return;
    e.target.value = "";
    await onUploadFile(file);
  }

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 2, padding: "6px 10px",
      borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)", alignItems: "center",
    }}>
      <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)"><b>B</b></Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)"><i>I</i></Btn>
      <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline (Ctrl+U)"><u>U</u></Btn>
      <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough"><s>S</s></Btn>
      <Btn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="Highlight">🖊</Btn>

      {sep}

      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">H1</Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">H2</Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">H3</Btn>

      {sep}

      <Btn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Linksbündig"><AlignIcon type="left" /></Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Zentriert"><AlignIcon type="center" /></Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Rechtsbündig"><AlignIcon type="right" /></Btn>

      {sep}

      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">•≡</Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Ordered list">1≡</Btn>
      <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">"</Btn>
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Trennlinie">—</Btn>

      {sep}

      <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Rückgängig">↩</Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Wiederholen">↪</Btn>

      {sep}

      {/* File upload — available to all participants */}
      <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: "none" }} onChange={handleFileChange} />
      <Btn onClick={() => fileRef.current?.click()} title="Bild oder Dokument einfügen" disabled={!onUploadFile}>📎</Btn>

      {onExport && (<>
        {sep}
        <Btn onClick={() => onExport("docx")} title="Als DOCX exportieren">⬇ DOCX</Btn>
        <Btn onClick={() => onExport("tex")} title="Als LaTeX exportieren">⬇ TeX</Btn>
      </>)}

      {isTeacher && (<>
        {sep}
        <Btn onClick={() => onMarkFree?.()} title="Als Freie Zone markieren (alle können bearbeiten)">🔓 Frei</Btn>
        <Btn onClick={() => onMarkLocked?.()} title="Sperren (nur lesen)">🔒 Sperren</Btn>
        <Btn onClick={() => onUnmarkBlock?.()} title="Markierung entfernen">✕ Frei/Sperre aufheben</Btn>
        {sep}
        <Btn
          onClick={() => onModeChange?.(mode === "add-line" ? "next-free-line" : "add-line")}
          active={mode === "add-line"}
          title={mode === "add-line" ? "Modus: Zeile hinzufügen (Enter = neue Zeile)" : "Modus: Nächste freie Zeile (Enter = normal)"}
        >
          {mode === "add-line" ? "↵+Zeile" : "↵ normal"}
        </Btn>
      </>)}
    </div>
  );
}
