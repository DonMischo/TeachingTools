"use client";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Fragment, Slice } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Markdown } from "tiptap-markdown";
import Toolbar from "./Toolbar";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { SchreibraumParticipant } from "@/lib/api";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";

// Safe on client (loaded only with ssr:false)
const WS_BASE = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/schreibraum/ws`;

interface Props {
  roomId: string;
  roomCode: string;
  roomTitle?: string;
  participant: SchreibraumParticipant;
  mode: string;
  readOnly?: boolean;
  initialYdocState?: string | null;
  onKicked?: () => void;
  onModeChange?: (mode: string) => void;
}

// Icon map for non-image document types shown as download links
const DOC_ICONS: Record<string, string> = {
  pdf: "📄", docx: "📝", odt: "📝", pptx: "📊", odp: "📊",
  xlsx: "📈", ods: "📈", txt: "📃", csv: "📃", md: "📃",
};

async function uploadToRoom(roomId: string, file: File): Promise<{ url: string; filename: string; is_image: boolean }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/schreibraum/rooms/${roomId}/files`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Upload fehlgeschlagen (${res.status})`);
  }
  return res.json();
}

// ── Auto-colour: every character typed by a student gets their colour ────────

function applyStoredColor(view: any, color: string, isTeacher: boolean) {
  if (isTeacher) return;
  const { state } = view;
  const colorType = state.schema.marks.textStyle;
  if (!colorType) return;
  const current = state.storedMarks?.find((m: any) => m.type === colorType);
  if (current?.attrs.color === color) return;
  const tr = state.tr.setStoredMarks([colorType.create({ color })]);
  tr.setMeta("addToHistory", false);
  view.dispatch(tr);
}

function makeAutoColorExtension(color: string, isTeacher: boolean) {
  return Extension.create({
    name: "autoColor",
    onCreate() { applyStoredColor(this.editor.view, color, isTeacher); },
    onSelectionUpdate() {
      if (this.editor.state.selection.from !== this.editor.state.selection.to) return;
      applyStoredColor(this.editor.view, color, isTeacher);
    },
    onUpdate() {
      if (this.editor.state.selection.from !== this.editor.state.selection.to) return;
      applyStoredColor(this.editor.view, color, isTeacher);
    },
  });
}

// ── Ensure trailing empty lines ──────────────────────────────────────────────

function makeEnsureTrailingLinesExtension(count = 10) {
  return Extension.create({
    name: "ensureTrailingLines",
    addProseMirrorPlugins() {
      return [new Plugin({
        appendTransaction(transactions, _old, newState) {
          if (transactions.some((t) => t.getMeta("trailingLines"))) return null;
          if (transactions.some((t) => t.getMeta("y-sync$"))) return null;
          if (transactions.some((t) => t.getMeta("lineClaim"))) return null;
          if (!transactions.some((t) => t.docChanged)) return null;

          const doc = newState.doc;
          const paraType = newState.schema.nodes.paragraph;
          if (!paraType) return null;

          let trailing = 0;
          for (let i = doc.childCount - 1; i >= 0; i--) {
            const child = doc.child(i);
            if (child.type === paraType && !child.attrs.lineOwner && child.content.size === 0)
              trailing++;
            else break;
          }
          if (trailing >= count) return null;

          const tr = newState.tr;
          for (let i = 0; i < count - trailing; i++)
            tr.insert(tr.doc.content.size, paraType.create());
          tr.setMeta("trailingLines", true);
          return tr;
        },
      })];
    },
  });
}

// ── Line ownership + free blocks + locked blocks ─────────────────────────────

function makeLineOwnershipExtension(
  myColor: string,
  isTeacher: boolean,
  provider: WebsocketProvider,
) {
  return Extension.create({
    name: "lineOwnership",

    addGlobalAttributes() {
      return [{
        types: ["paragraph", "heading", "blockquote", "listItem", "codeBlock"],
        attributes: {
          lineOwner: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-line-owner") || null,
            renderHTML: (attrs) => {
              if (!attrs.lineOwner) return {};
              if (attrs.lineOwner === "teacher") return { "data-line-owner": attrs.lineOwner };
              return {
                "data-line-owner": attrs.lineOwner,
                style: `border-left: 3px solid ${attrs.lineOwner}; padding-left: 10px;`,
              };
            },
          },
          freeBlock: {
            default: false,
            parseHTML: (el) => el.getAttribute("data-free-block") === "true",
            renderHTML: (attrs) => attrs.freeBlock ? { "data-free-block": "true", style: "background: rgba(34,197,94,0.07); border-left: 3px solid #22c55e; padding-left: 10px;" } : {},
          },
          locked: {
            default: false,
            parseHTML: (el) => el.getAttribute("data-locked") === "true",
            renderHTML: (attrs) => attrs.locked ? { "data-locked": "true", style: "background: rgba(239,68,68,0.05); border-left: 3px solid #ef4444; padding-left: 10px; opacity: 0.7;" } : {},
          },
        },
      }];
    },

    addProseMirrorPlugins() {
      const ownerValue = isTeacher ? "teacher" : myColor;
      let hadLocalChange = false;

      return [
        // Track local edits
        new Plugin({
          filterTransaction(tr) {
            if (
              tr.docChanged &&
              !tr.getMeta("y-sync$") &&
              !tr.getMeta("lineClaim") &&
              !tr.getMeta("trailingLines")
            ) {
              hadLocalChange = true;
            }
            return true;
          },
        }),

        // Immediate claim for empty→non-empty unclaimed paragraphs (local edits only)
        new Plugin({
          appendTransaction(transactions, oldState, newState) {
            if (!transactions.some((t) => t.docChanged)) return null;
            if (!transactions.some((t) => !t.getMeta("y-sync$") && !t.getMeta("lineClaim") && !t.getMeta("trailingLines"))) return null;

            const claimTr = newState.tr;
            let changed = false;
            const done = new Set<number>();

            newState.doc.descendants((node: any, pos: number) => {
              if (!node.isBlock || node.isLeaf || done.has(pos)) return true;
              done.add(pos);
              if (!node.attrs?.lineOwner && !node.attrs?.freeBlock && node.content.size > 0) {
                // Check if this block was EMPTY in the old state
                const oldNode = oldState.doc.nodeAt(pos);
                if (oldNode && oldNode.content.size === 0) {
                  try {
                    claimTr.setNodeMarkup(pos, undefined, { ...node.attrs, lineOwner: ownerValue });
                    changed = true;
                  } catch {}
                }
              }
              return true;
            });

            if (changed) {
              claimTr.setMeta("lineClaim", true);
              return claimTr;
            }
            return null;
          },
        }),

        // Deferred claim (150ms) for existing non-empty unclaimed blocks
        new Plugin({
          view(editorView) {
            let timer: ReturnType<typeof setTimeout> | null = null;
            return {
              update(view, prevState) {
                if (prevState.doc === view.state.doc) return;
                if (!hadLocalChange) return;

                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                  timer = null;
                  hadLocalChange = false;
                  const state = view.state;
                  const claimTr = state.tr;
                  let changed = false;
                  const done = new Set<number>();

                  state.doc.descendants((node: any, pos: number) => {
                    if (!node.isBlock || node.isLeaf || done.has(pos)) return true;
                    done.add(pos);
                    if (!node.attrs?.lineOwner && !node.attrs?.freeBlock && node.content.size > 0) {
                      try {
                        claimTr.setNodeMarkup(pos, undefined, { ...node.attrs, lineOwner: ownerValue });
                        changed = true;
                      } catch {}
                    }
                    return true;
                  });

                  if (changed) {
                    claimTr.setMeta("lineClaim", true);
                    view.dispatch(claimTr);
                  }
                }, 150);
              },
              destroy() { if (timer) clearTimeout(timer); },
            };
          },
        }),

        // Click redirect: clicking a foreign block moves cursor to next free block (students only)
        ...(!isTeacher ? [new Plugin({
          props: {
            handleDOMEvents: {
              mousedown(view, event) {
                const coords = view.posAtCoords({ left: (event as MouseEvent).clientX, top: (event as MouseEvent).clientY });
                if (!coords) return false;
                const { doc } = view.state;
                const safePos = Math.max(0, Math.min(coords.pos, doc.content.size - 1));
                const $pos = doc.resolve(safePos);
                if ($pos.depth < 1) return false;
                const curIdx = $pos.index(0);
                const block = doc.child(curIdx);
                if (block.attrs?.freeBlock) return false;
                const owner = block.attrs?.lineOwner;
                if (!owner || owner === myColor) return false;

                let targetIdx = -1;
                for (let i = curIdx + 1; i < doc.childCount; i++) {
                  const n = doc.child(i);
                  if (n.attrs?.freeBlock || !n.attrs?.lineOwner || n.attrs.lineOwner === myColor) {
                    targetIdx = i;
                    break;
                  }
                }
                if (targetIdx === -1) targetIdx = doc.childCount - 1;

                let offset = 0;
                for (let i = 0; i < targetIdx; i++) offset += doc.child(i).nodeSize;
                const targetPos = offset + 1;

                (event as MouseEvent).preventDefault();
                view.dispatch(
                  view.state.tr.setSelection(
                    TextSelection.near(doc.resolve(Math.min(targetPos, doc.content.size)))
                  )
                );
                view.focus();
                return true;
              },
            },
          },
        })] : []),

        // Teacher presence broadcast via awareness
        ...(isTeacher ? [new Plugin({
          view() {
            return {
              update(view, prevState) {
                if (view.state.selection.eq(prevState.selection)) return;
                const { $from } = view.state.selection;
                if ($from.depth < 1) {
                  provider.awareness.setLocalStateField("teacherBlock", null);
                  return;
                }
                const block = $from.node(1);
                const owner = block?.attrs?.lineOwner;
                if (owner && owner !== "teacher") {
                  provider.awareness.setLocalStateField("teacherBlock", $from.before(1));
                } else {
                  provider.awareness.setLocalStateField("teacherBlock", null);
                }
              },
              destroy() { provider.awareness.setLocalStateField("teacherBlock", null); },
            };
          },
        })] : []),

        // Guard: students blocked from editing foreign/locked blocks; freeBlock bypasses ownership
        ...(!isTeacher ? [new Plugin({
          filterTransaction(tr, state) {
            if (tr.getMeta("y-sync$") || tr.getMeta("lineClaim") || tr.getMeta("trailingLines")) return true;
            if (!tr.docChanged) return true;

            const teacherBlocks = new Set<number>();
            provider.awareness.getStates().forEach((s: any) => {
              if (s.teacherBlock != null) teacherBlocks.add(s.teacherBlock);
            });

            for (const step of tr.steps) {
              const json = (step as any).toJSON();
              if (!["replace", "replaceAround", "addMark", "removeMark"].includes(json?.stepType)) continue;
              const from: number = json.from ?? 0;
              const to: number = json.to ?? from;

              let blocked = false;
              state.doc.nodesBetween(
                Math.max(0, from - 1),
                Math.min(state.doc.content.size, to + 1),
                (node: any, nodePos: number) => {
                  if (!node.isBlock || node.isLeaf) return true;
                  if (node.attrs?.locked) { blocked = true; return false; }
                  if (node.attrs?.freeBlock) return false; // free block — allow
                  const owner = node.attrs?.lineOwner;
                  if (owner && owner !== myColor) { blocked = true; return false; }
                  if (teacherBlocks.has(nodePos)) { blocked = true; return false; }
                }
              );
              if (blocked) return false;
            }
            return true;
          },
        })] : []),

        // Locked blocks: block ALL edits (including teacher) when locked=true
        new Plugin({
          filterTransaction(tr, state) {
            if (tr.getMeta("y-sync$") || tr.getMeta("lineClaim") || tr.getMeta("trailingLines")) return true;
            // Teacher can unlock, so allow setNodeMarkup for lineClaim-style ops from teacher
            if (isTeacher && tr.getMeta("blockControl")) return true;
            if (!tr.docChanged) return true;

            for (const step of tr.steps) {
              const json = (step as any).toJSON();
              if (!["replace", "replaceAround", "addMark", "removeMark"].includes(json?.stepType)) continue;
              const from: number = json.from ?? 0;
              const to: number = json.to ?? from;

              let blocked = false;
              state.doc.nodesBetween(
                Math.max(0, from - 1),
                Math.min(state.doc.content.size, to + 1),
                (node: any) => {
                  if (!node.isBlock || node.isLeaf) return true;
                  if (node.attrs?.locked) { blocked = true; return false; }
                }
              );
              if (blocked) return false;
            }
            return true;
          },
        }),
      ];
    },
  });
}

// ── Paste stamping ───────────────────────────────────────────────────────────

function stampSlice(slice: Slice, ownerValue: string): Slice {
  function stampFragment(fragment: Fragment): Fragment {
    const nodes: any[] = [];
    fragment.forEach((node: any) => {
      const newContent = node.content.size > 0 ? stampFragment(node.content) : node.content;
      if (node.isBlock && !node.isLeaf) {
        try {
          nodes.push(node.type.create({ ...node.attrs, lineOwner: ownerValue }, newContent, node.marks));
        } catch {
          nodes.push(node.copy(newContent));
        }
      } else {
        nodes.push(node.copy(newContent));
      }
    });
    return Fragment.from(nodes);
  }
  return new Slice(stampFragment(slice.content), slice.openStart, slice.openEnd);
}

// ── Public handle ────────────────────────────────────────────────────────────

export interface EditorHandle {
  getHTML(): string;
  getMarkdown(): string;
  getYdocState(): string;
}

// ── Main component ───────────────────────────────────────────────────────────

const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { roomId, roomCode, roomTitle, participant, mode, readOnly, initialYdocState, onKicked, onModeChange }: Props,
  ref,
) {
  const { toast } = useToast();

  const ydoc = useMemo(() => {
    const doc = new Y.Doc();
    if (initialYdocState)
      Y.applyUpdate(doc, Uint8Array.from(atob(initialYdocState), (c) => c.charCodeAt(0)));
    return doc;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const provider = useMemo(
    () =>
      new WebsocketProvider(WS_BASE, roomCode, ydoc, {
        params: { token: participant.session_token },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [connected, setConnected] = useState(false);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    provider.on("status", (e: any) => setConnected(e?.status === "connected"));
    provider.on("connection-close", (event: any) => {
      setConnected(false);
      if (event?.code === 4003) onKicked?.();
    });
    provider.awareness.setLocalStateField("user", { name: participant.name, color: participant.color });

    // Teacher sets room mode in awareness so students can react
    if (participant.is_teacher) {
      provider.awareness.setLocalStateField("roomMode", mode);
    }

    // Listen for mode changes broadcast by teacher
    const onAwareness = () => {
      if (participant.is_teacher) return;
      provider.awareness.getStates().forEach((s: any) => {
        if (s.roomMode && s.roomMode !== modeRef.current) {
          onModeChange?.(s.roomMode);
        }
      });
    };
    provider.awareness.on("change", onAwareness);

    return () => {
      provider.awareness.off("change", onAwareness);
      provider.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, participant]);

  // Broadcast mode change to peers via awareness
  useEffect(() => {
    if (participant.is_teacher) {
      provider.awareness.setLocalStateField("roomMode", mode);
    }
  }, [mode, provider, participant.is_teacher]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ history: false }),
      Image.configure({ allowBase64: false }),
      TextStyle,
      Color,
      Underline,
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Markdown.configure({ html: false, transformPastedText: true }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: { name: participant.name, color: participant.color },
      }),
      makeAutoColorExtension(participant.color, participant.is_teacher),
      makeLineOwnershipExtension(participant.color, participant.is_teacher, provider),
      makeEnsureTrailingLinesExtension(10),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function handleUploadFile(file: File) {
    try {
      const result = await uploadToRoom(roomId, file);
      if (result.is_image) {
        editorRef.current?.chain().focus().setImage({ src: result.url, alt: result.filename }).run();
      } else {
        const ext = result.filename.split(".").pop()?.toLowerCase() ?? "";
        const icon = DOC_ICONS[ext] ?? "📎";
        editorRef.current
          ?.chain()
          .focus()
          .insertContent(`<p><a href="${result.url}" target="_blank" rel="noopener">${icon} ${result.filename}</a></p>`)
          .run();
      }
    } catch (e: any) {
      toast(e.message ?? "Upload fehlgeschlagen", "error");
    }
  }

  async function handleExport(fmt: "docx" | "tex") {
    if (!editorRef.current) return;
    const html = editorRef.current.getHTML();
    const title = roomTitle || roomCode;
    try {
      const res = await fetch(`/api/schreibraum/rooms/${roomId}/export/${fmt}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, title }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.${fmt === "tex" ? "tex" : "docx"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast(e.message ?? "Export fehlgeschlagen", "error");
    }
  }

  function markCurrentBlock(attrs: Record<string, unknown>) {
    const editor = editorRef.current;
    if (!editor) return;
    const { state, dispatch } = editor.view;
    const { $from, $to } = state.selection;
    const tr = state.tr;
    let changed = false;
    state.doc.nodesBetween($from.before(1), $to.after(1), (node, pos) => {
      if (!node.isBlock || node.isLeaf) return true;
      try {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
        changed = true;
      } catch {}
      return false;
    });
    if (changed) {
      tr.setMeta("blockControl", true);
      dispatch(tr);
    }
  }

  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const editor = useEditor({
    extensions,
    editorProps: {
      attributes: {
        style:
          "min-height: 400px; outline: none; padding: 16px; font-size: 16px; line-height: 1.7; color: var(--text-primary);",
      },
      handleKeyDown(view, event) {
        // Bracket wrapping
        const PAIRS: Record<string, string> = { "[": "]", "{": "}", "(": ")" };
        const close = PAIRS[event.key];
        if (close) {
          const { state } = view;
          const { from, to, empty } = state.selection;
          if (!empty) {
            event.preventDefault();
            const tr = state.tr;
            tr.insertText(close, to);
            tr.insertText(event.key, from);
            view.dispatch(tr.setSelection(TextSelection.create(tr.doc, from + 1, to + 1)));
            return true;
          }
        }

        // Add-line mode: Enter in empty/unclaimed paragraph → insert new unclaimed line below
        if (event.key === "Enter" && !event.shiftKey && modeRef.current === "add-line") {
          const { state } = view;
          const { $from } = state.selection;
          if ($from.depth >= 1) {
            const curIdx = $from.index(0);
            const curBlock = state.doc.child(curIdx);
            const owner = curBlock.attrs?.lineOwner;
            const isMine = owner === (participant.is_teacher ? "teacher" : participant.color);
            const isFree = curBlock.attrs?.freeBlock;
            const isEmpty = curBlock.content.size === 0;
            if ((isEmpty || isFree || isMine || !owner) && !participant.is_teacher) {
              event.preventDefault();
              // Insert new paragraph after current block
              let offset = 0;
              for (let i = 0; i <= curIdx; i++) offset += state.doc.child(i).nodeSize;
              const paraType = state.schema.nodes.paragraph;
              const tr = state.tr.insert(offset, paraType.create());
              view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(offset + 1))));
              return true;
            }
          }
        }

        if (participant.is_teacher) return false;

        const { state } = view;
        const { $from } = state.selection;
        if ($from.depth < 1) return false;
        const myColor = participant.color;
        const curIdx = $from.index(0);

        if (event.key === "Backspace" && $from.pos === $from.start(1)) {
          if (curIdx > 0) {
            const prevOwner = state.doc.child(curIdx - 1).attrs?.lineOwner;
            if (prevOwner && prevOwner !== myColor) {
              event.preventDefault();
              return true;
            }
          }
        }

        if (event.key === "Delete" && $from.pos === $from.end(1)) {
          if (curIdx < state.doc.childCount - 1) {
            const nextOwner = state.doc.child(curIdx + 1).attrs?.lineOwner;
            if (nextOwner && nextOwner !== myColor) {
              event.preventDefault();
              return true;
            }
          }
        }

        if (
          event.key === "ArrowLeft" &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey &&
          $from.pos === $from.start(1)
        ) {
          if (curIdx > 0) {
            const prevOwner = state.doc.child(curIdx - 1).attrs?.lineOwner;
            if (prevOwner && prevOwner !== myColor) {
              event.preventDefault();
              return true;
            }
          }
        }

        return false;
      },
      transformPasted(slice) {
        const ownerValue = participant.is_teacher ? "teacher" : participant.color;
        return stampSlice(slice, ownerValue);
      },
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find((i) => i.type.startsWith("image/"));
        if (imageItem) {
          const file = imageItem.getAsFile();
          if (file) { event.preventDefault(); handleUploadFile(file); return true; }
        }
        return false;
      },
      handleDrop(view, event) {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((f) => handleUploadFile(f));
        return true;
      },
    },
  });

  // Store editor ref for use in markCurrentBlock
  (editorRef as any).current = editor;

  // Wortstaffel: toggle editability when turn changes
  useEffect(() => {
    if (editor) editor.setEditable(readOnly !== true);
  }, [editor, readOnly]);

  useImperativeHandle(ref, () => ({
    getHTML: () => editor?.getHTML() ?? "",
    getMarkdown: () => (editor?.storage as any)?.markdown?.getMarkdown?.() ?? editor?.getHTML() ?? "",
    getYdocState: () => btoa(String.fromCharCode(...Y.encodeStateAsUpdate(ydoc))),
  }), [editor, ydoc]);

  async function handleSave() {
    if (!editor) return;
    const state = btoa(String.fromCharCode(...Y.encodeStateAsUpdate(ydoc)));
    try {
      await fetch(`/api/schreibraum/rooms/${roomId}/document/save`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/octet-stream" },
        body: Uint8Array.from(atob(state), (c) => c.charCodeAt(0)),
      });
    } catch (e) {
      console.error("Save failed", e);
    }
  }

  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "1.5px solid var(--border)", overflow: "clip" }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        borderRadius: "10px 10px 0 0",
        boxShadow: "0 2px 6px var(--shadow)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 12px" }}>
          <span style={{ fontSize: 12, color: connected ? "#16a34a" : "#dc2626" }}>
            {connected ? "● Verbunden" : "● Getrennt"}
          </span>
          {participant.is_teacher && (
            <button
              onClick={handleSave}
              style={{ fontSize: 12, padding: "2px 10px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-subtle)", cursor: "pointer", color: "var(--text-secondary)" }}
            >
              💾 Speichern
            </button>
          )}
        </div>
        {editor && (
          <Toolbar
            editor={editor}
            isTeacher={participant.is_teacher}
            mode={mode}
            onModeChange={onModeChange}
            onMarkFree={() => markCurrentBlock({ freeBlock: true, locked: false })}
            onMarkLocked={() => markCurrentBlock({ locked: true, freeBlock: false })}
            onUnmarkBlock={() => markCurrentBlock({ freeBlock: false, locked: false })}
            onUploadFile={handleUploadFile}
            onExport={handleExport}
          />
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
});

export default Editor;
