export interface MaterialLink {
  href: string;
  kind: "web" | "obsidian" | "zotero";
  detail: string;
}

function trimLink(value: string) {
  let result = value.replace(/[.,;!，。；！：]+$/, "");
  // Markdown and surrounding prose add closing brackets; preserve balanced URL brackets.
  for (const [open, close] of [
    ["(", ")"],
    ["[", "]"],
    ["（", "）"],
  ]) {
    while (
      result.endsWith(close) &&
      result.split(close).length > result.split(open).length
    ) {
      result = result.slice(0, -1).replace(/[.,;!，。；！：]+$/, "");
    }
  }
  return result;
}

export function materialLinks(text: string): MaterialLink[] {
  const found = new Map<string, MaterialLink>();
  for (const match of text.matchAll(
    /\b(?:https?|obsidian|zotero):\/\/[^\s<>"'`]+/gi,
  )) {
    try {
      const url = new URL(trimLink(match[0]));
      if (
        url.username ||
        url.password ||
        (url.port && !url.protocol.startsWith("http"))
      )
        continue;
      const action = url.hostname.toLowerCase();
      let link: MaterialLink;
      if (url.protocol === "http:" || url.protocol === "https:") {
        link = { href: url.href, kind: "web", detail: url.href };
      } else if (url.protocol === "obsidian:") {
        // Pasted links navigate only. Creating notes has a separate explicit action.
        if (action !== "open" && action !== "vault") continue;
        if (
          action === "open" &&
          !url.searchParams.get("vault") &&
          !url.searchParams.get("path")
        )
          continue;
        if (action === "vault" && url.pathname === "/") continue;
        link = {
          href: url.href,
          kind: "obsidian",
          detail:
            url.searchParams.get("file") ||
            url.searchParams.get("path") ||
            url.searchParams.get("vault") ||
            decodeURIComponent(url.pathname.slice(1)),
        };
      } else if (url.protocol === "zotero:") {
        if (action !== "select" && action !== "open-pdf") continue;
        const path =
          /^\/(?:library|groups\/\d+)\/(items|collections)\/([A-Z0-9]{8})\/?$/i.exec(
            url.pathname,
          );
        if (!path || (action === "open-pdf" && path[1] !== "items")) continue;
        const page = url.searchParams.get("page");
        link = {
          href: url.href,
          kind: "zotero",
          detail: `${path[2]}${page && /^\d+$/.test(page) ? ` · p. ${page}` : ""}`,
        };
      } else continue;
      found.set(link.href, link);
    } catch {
      // Malformed links remain editable text.
    }
  }
  return [...found.values()];
}

export function markdownNote(title: string, body: string) {
  const heading = title.trim().replace(/[\r\n]+/g, " ");
  const content = body.trim();
  return `# ${heading}\n\n${content === heading ? "" : content + "\n"}`;
}

export function noteFileName(title: string) {
  const cleaned = title
    .trim()
    .replace(/\.md$/i, "")
    .replace(/[\\/:*?"<>|#[\]\r\n]/g, "-");
  const name = Array.from(cleaned)
    .filter(
      (character) =>
        character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
    )
    .slice(0, 60)
    .join("")
    .replace(/^[. ]+|[. ]+$/g, "");
  return (
    (name && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
      ? name
      : "Workspace note") + ".md"
  );
}

// Keep handoff links short; long notes can always be downloaded as Markdown.
export const MAX_OBSIDIAN_URI_LENGTH = 6000;

export function obsidianNewNoteUri(vault: string, title: string, body: string) {
  if (!vault.trim() || !title.trim()) return null;
  const params = [
    ["vault", vault.trim()],
    ["name", noteFileName(title).slice(0, -3)],
    ["content", markdownNote(title, body)],
  ];
  const uri = `obsidian://new?${params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`;
  return uri.length <= MAX_OBSIDIAN_URI_LENGTH ? uri : null;
}
