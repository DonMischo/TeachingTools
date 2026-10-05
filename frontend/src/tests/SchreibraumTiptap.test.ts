// Schreibraum auf Tiptap v3: der echte Editor mit unseren Erweiterungen (yjs, Cursor, Markdown) lässt sich bauen
// und kann, was die Werkzeugleiste braucht. Schutz gegen den v2→v3-Umstieg (Sicherheitslücke in @tiptap/core 2).
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Markdown } from "tiptap-markdown";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";

describe("Schreibraum-Editor (Tiptap v3)", () => {
  it("baut mit Zusammenarbeit, formatiert, gibt Markdown aus und lässt __proto__ nicht durch", () => {
    const doc = new Y.Doc();
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Image.configure({ allowBase64: false }), TextStyle, Color, Highlight,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Markdown.configure({ html: false, transformPastedText: true }),
        Collaboration.configure({ document: doc }),
        CollaborationCaret.configure({ provider: { awareness: new Awareness(doc) }, user: { name: "Kim", color: "#f00" } }),
      ],
    });
    editor.commands.setContent("Hallo Welt"); // Markdown (html: false)
    editor.commands.selectAll();
    editor.chain().toggleBold().toggleUnderline().setColor("#ff0000").setTextAlign("center").run();
    expect(editor.isActive("bold") && editor.isActive("underline")).toBe(true);
    expect(editor.getHTML()).toContain("text-align: center");
    expect(editor.can().undo()).toBe(true); // Verlauf kommt aus yjs
    expect((editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()).toContain("**Hallo Welt**");
    expect(doc.getXmlFragment("default").length).toBeGreaterThan(0);

    // HTML von anderen wird nicht als Markup übernommen (Markdown mit html: false)
    editor.commands.setContent('<span __proto__="x" onclick="alert(1)">x</span>');
    expect(editor.view.dom.querySelector("[onclick]")).toBeNull();
    editor.destroy();
  });
});
