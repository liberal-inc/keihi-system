"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function ToolbarButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        disabled && "opacity-40",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-secondary/40 px-2 py-1.5">
      <ToolbarButton
        icon={Bold}
        label="太字"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={Italic}
        label="斜体"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={Strikethrough}
        label="打ち消し線"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <span className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        icon={Heading2}
        label="見出し"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      />
      <ToolbarButton
        icon={List}
        label="箇条書き"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrdered}
        label="番号付きリスト"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={Quote}
        label="引用"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />

      <span className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        icon={Undo2}
        label="元に戻す"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        icon={Redo2}
        label="やり直す"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 180,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? "入力してください" }),
    ],
    content: value,
    // SSR とクライアントの描画差分による hydration エラーを避ける
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "rich-text tiptap px-3 py-2.5 text-sm focus:outline-none font-sans",
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) {
    return (
      <div
        className="rounded-md border border-input bg-card"
        style={{ minHeight: minHeight + 40 }}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-input bg-card shadow-sm focus-within:ring-2 focus-within:ring-ring">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
