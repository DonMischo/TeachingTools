"use client";
/**
 * Textfeld, das Markdown beim Tippen formatiert und weiter Markdown speichert:
 * »## « wird Überschrift, »1. « und »- « Listen, »[ ] « eine Aufgabe, **fett**
 * und *kursiv* sofort. Eingefügtes Markdown wird übernommen. Über »Markdown«
 * lässt sich der Quelltext direkt bearbeiten.
 *
 * Tiptap (wie im Schreibraum) mit tiptap-markdown; HTML bleibt aus.
 */
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "tiptap-markdown";

const STIL = [
  "input min-h-[160px] max-h-[50vh] overflow-y-auto text-sm leading-relaxed focus:outline-none",
  "[&_p]:my-1 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2",
  "[&_h3]:font-semibold [&_h3]:mt-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0",
  "[&_ul[data-type=taskList]>li]:flex [&_ul[data-type=taskList]>li]:gap-2 [&_ul[data-type=taskList]_p]:my-0",
  "[&_code]:font-mono [&_code]:text-[0.9em] [&_code]:bg-surface-hover [&_code]:px-1 [&_code]:rounded",
  "[&_pre]:bg-surface-hover [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-xs [&_pre]:overflow-x-auto",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-2 [&_blockquote]:italic",
  "[&_a]:text-accent [&_a]:underline [&_hr]:border-line [&_hr]:my-2",
].join(" ");

const md = (e: Editor) => ((e.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown());

function Knopf({ an, titel, onClick, children }: { an?: boolean; titel: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={titel} aria-label={titel} onMouseDown={e => e.preventDefault()} onClick={onClick}
      className={`px-2 py-0.5 rounded text-xs ${an ? "bg-accent/20 text-accent" : "text-muted hover:bg-surface-hover hover:text-fg"}`}>
      {children}
    </button>
  );
}

export function MarkdownFeld({ wert, onChange, id, label }: {
  wert: string;
  onChange: (markdown: string) => void;
  id?: string;
  /** Name für Screenreader und Tests */
  label: string;
}) {
  const [quelle, setQuelle] = useState(false);
  const [, neuZeichnen] = useState(0);
  const letzter = useRef(wert);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ underline: false, link: { openOnClick: false } }),
      TaskList, TaskItem.configure({ nested: true }),
      Markdown.configure({ html: false, transformPastedText: true, tightLists: true }),
    ],
    content: wert,
    editorProps: { attributes: { class: STIL, "aria-label": label, ...(id ? { id } : {}) } },
    onUpdate: ({ editor: e }) => { letzter.current = md(e); onChange(letzter.current); },
    onSelectionUpdate: () => neuZeichnen(n => n + 1),
    onTransaction: () => neuZeichnen(n => n + 1),
  });

  // Von außen geänderter Text (z. B. aus der Quelltext-Ansicht) → in den Editor
  useEffect(() => {
    if (editor && !quelle && wert !== letzter.current) {
      letzter.current = wert;
      editor.commands.setContent(wert);
    }
  }, [editor, wert, quelle]);

  const e = editor;
  const kette = () => e!.chain().focus();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Formatierung">
        {!quelle && e && (
          <>
            <Knopf titel="Überschrift" an={e.isActive("heading", { level: 2 })} onClick={() => kette().toggleHeading({ level: 2 }).run()}>H</Knopf>
            <Knopf titel="Fett" an={e.isActive("bold")} onClick={() => kette().toggleBold().run()}><b>B</b></Knopf>
            <Knopf titel="Kursiv" an={e.isActive("italic")} onClick={() => kette().toggleItalic().run()}><i>I</i></Knopf>
            <Knopf titel="Nummerierte Schritte" an={e.isActive("orderedList")} onClick={() => kette().toggleOrderedList().run()}>1.</Knopf>
            <Knopf titel="Aufzählung" an={e.isActive("bulletList")} onClick={() => kette().toggleBulletList().run()}>•</Knopf>
            <Knopf titel="Aufgabenliste" an={e.isActive("taskList")} onClick={() => kette().toggleTaskList().run()}>☐</Knopf>
            <Knopf titel="Codeblock" an={e.isActive("codeBlock")} onClick={() => kette().toggleCodeBlock().run()}>{"</>"}</Knopf>
          </>
        )}
        <span className="flex-1" />
        <Knopf titel={quelle ? "Formatiert bearbeiten" : "Markdown-Quelltext bearbeiten"} an={quelle} onClick={() => setQuelle(q => !q)}>
          {quelle ? "✎ Formatiert" : "Markdown"}
        </Knopf>
      </div>
      {quelle
        ? <textarea id={id} aria-label={label} className="input min-h-[160px] resize-y font-mono text-sm" value={wert}
            onChange={ev => onChange(ev.target.value)} />
        : <EditorContent editor={editor} />}
    </div>
  );
}
