import { useState } from "react";
import { ArrowUpRight, BookOpen, FileText } from "lucide-react";
import { materialLinks } from "../lib/materialLinks";
import { useTodoStore } from "../store/todoStore";

export function MaterialLinks({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  const zh = useTodoStore((state) => state.locale) === "zh";
  const [expanded, setExpanded] = useState(false);
  const links = materialLinks(text);
  if (!links.length) return null;
  return (
    <div className="min-w-0" aria-label={zh ? "资料链接" : "Material links"}>
      {(expanded ? links : links.slice(0, compact ? 2 : 5)).map((link) => {
        const Icon =
          link.kind === "obsidian"
            ? FileText
            : link.kind === "zotero"
              ? BookOpen
              : ArrowUpRight;
        const label =
          compact && link.kind !== "web"
            ? link.kind === "obsidian"
              ? "Obsidian"
              : "Zotero"
            : link.kind === "web"
              ? ""
              : zh
                ? `在 ${link.kind === "obsidian" ? "Obsidian" : "Zotero"} 打开`
                : `Open in ${link.kind === "obsidian" ? "Obsidian" : "Zotero"}`;
        return (
          <a
            key={link.href}
            href={link.href}
            target={link.kind === "web" ? "_blank" : undefined}
            rel="noreferrer"
            title={link.href}
            className="mt-1 flex min-h-10 max-w-full items-center gap-2 rounded-[var(--radius-small)] text-sm text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <Icon className="size-4 shrink-0" />
            <span className="min-w-0 truncate">
              {label ? `${label} · ` : ""}
              {compact && link.kind === "web"
                ? new URL(link.href).hostname
                : link.detail}
            </span>
          </a>
        );
      })}
      {links.length > (compact ? 2 : 5) ? (
        <button
          type="button"
          className="min-h-10 text-xs text-[var(--muted)]"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? zh
              ? "收起链接"
              : "Show fewer links"
            : zh
              ? `显示全部 ${links.length} 个链接`
              : `Show all ${links.length} links`}
        </button>
      ) : null}
    </div>
  );
}
