/** Insertable blocks shared by the slash menu, the "+" button and the toolbar. */
import type { Editor } from "@tiptap/react";
import {
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  ImageUp,
  Images,
  Code2,
  Pilcrow,
  type LucideIcon,
} from "lucide-react";

export type BlockContext = {
  /** open the file picker for a body image */
  pickImage: () => void;
  /** open the Unsplash picker for a body image */
  pickUnsplash: () => void;
};

export type BlockCommand = {
  id: string;
  label: string;
  hint: string;
  keywords: string[];
  icon: LucideIcon;
  run: (editor: Editor, ctx: BlockContext) => void;
};

export const BLOCK_COMMANDS: BlockCommand[] = [
  {
    id: "paragraph",
    label: "Текст",
    hint: "Обычный абзац",
    keywords: ["текст", "абзац", "text", "paragraph", "p"],
    icon: Pilcrow,
    run: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: "h2",
    label: "Заголовок",
    hint: "Большой подзаголовок раздела · ##",
    keywords: ["заголовок", "h2", "heading", "раздел", "title"],
    icon: Heading2,
    run: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Подзаголовок",
    hint: "Заголовок поменьше · ###",
    keywords: ["подзаголовок", "h3", "heading", "subheading"],
    icon: Heading3,
    run: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    id: "bullet",
    label: "Список",
    hint: "Маркированный список · -",
    keywords: ["список", "маркированный", "bullet", "list", "ul"],
    icon: List,
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ordered",
    label: "Нумерованный список",
    hint: "1. 2. 3.",
    keywords: ["нумерованный", "список", "ordered", "numbered", "ol", "1"],
    icon: ListOrdered,
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "quote",
    label: "Цитата",
    hint: "Выделенная цитата · >",
    keywords: ["цитата", "quote", "blockquote"],
    icon: Quote,
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "divider",
    label: "Разделитель",
    hint: "Горизонтальная линия · ---",
    keywords: ["разделитель", "линия", "divider", "hr", "line"],
    icon: Minus,
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "image",
    label: "Изображение",
    hint: "Загрузить с устройства",
    keywords: ["изображение", "картинка", "фото", "image", "photo", "upload", "загрузить"],
    icon: ImageUp,
    run: (_e, ctx) => ctx.pickImage(),
  },
  {
    id: "unsplash",
    label: "Фото из Unsplash",
    hint: "Бесплатные красивые фотографии",
    keywords: ["unsplash", "фото", "картинка", "photo", "стоки"],
    icon: Images,
    run: (_e, ctx) => ctx.pickUnsplash(),
  },
  {
    id: "code",
    label: "Код",
    hint: "Блок кода · ```",
    keywords: ["код", "code", "pre"],
    icon: Code2,
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
];

export function filterCommands(query: string, list: BlockCommand[] = BLOCK_COMMANDS): BlockCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((c) => c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.startsWith(q)));
}
