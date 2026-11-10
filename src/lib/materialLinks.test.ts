import { describe, expect, it } from "vitest";
import {
  materialLinks,
  markdownNote,
  noteFileName,
  obsidianNewNoteUri,
} from "./materialLinks";

describe("material links", () => {
  it("keeps Obsidian vaults, Chinese paths, headings and escaped query characters", () => {
    const href =
      "obsidian://open?vault=%E7%9F%A5%E8%AF%86%E5%BA%93&file=%E8%AE%BA%E6%96%87%2FA%26B%23%E6%96%B9%E6%B3%95";
    expect(materialLinks(`[笔记](${href})`)).toEqual([
      { href, kind: "obsidian", detail: "论文/A&B#方法" },
    ]);
  });

  it("keeps Zotero library/group references and exact page and annotation destinations", () => {
    const pdf =
      "zotero://open-pdf/library/items/ABCD2345?page=12&annotation=EFGH6789";
    const item = "zotero://select/groups/123/items/XYZ23456";
    const links = materialLinks(`“摘录” ([pdf](${pdf}))\n[文献](${item})`);
    expect(links.map((link) => link.href)).toEqual([pdf, item]);
    expect(links[0].detail).toBe("ABCD2345 · p. 12");
  });

  it("deduplicates repeated references and preserves links beyond the collapsed preview", () => {
    const href = "zotero://select/library/items/ABCD2345";
    expect(materialLinks(`${href}\n[again](${href})`)).toHaveLength(1);
    expect(
      materialLinks(
        Array.from({ length: 8 }, (_, i) => `https://example.com/${i}`).join(
          "\n",
        ),
      ),
    ).toHaveLength(8);
  });

  it("strips surrounding punctuation without truncating balanced URL parentheses", () => {
    expect(
      materialLinks("[资料](https://example.com/Paper_(2026)).")[0].href,
    ).toBe("https://example.com/Paper_(2026)");
    expect(
      materialLinks("（obsidian://open?vault=Notes&file=Example）。")[0].href,
    ).toBe("obsidian://open?vault=Notes&file=Example");
  });

  it("only exposes supported navigation actions, not arbitrary app commands", () => {
    const input = [
      "javascript:alert(1)",
      "data:text/html,hello",
      "file:///etc/passwd",
      "obsidian://new?vault=Notes&file=Existing&overwrite=true&content=replaced",
      "obsidian://advanced-uri?vault=Notes&commandid=run",
      "obsidian://open",
      "zotero://debug",
      "zotero://open-pdf/library/collections/ABCD2345",
      "https://user:password@example.com/",
      "obsidian://user@open?vault=Notes",
      "zotero://select/library/items/not-a-key",
      "https://[invalid",
    ];
    expect(materialLinks(input.join("\n"))).toEqual([]);
  });

  it("supports vault shorthand, absolute-path open and Zotero collections", () => {
    expect(
      materialLinks("obsidian://vault/Research/Some%20note")[0].detail,
    ).toBe("Research/Some note");
    expect(
      materialLinks("obsidian://open?path=%2Fnotes%2FA.md")[0].detail,
    ).toBe("/notes/A.md");
    expect(
      materialLinks("zotero://select/library/collections/ABCD2345")[0].kind,
    ).toBe("zotero");
  });
});

describe("Obsidian text handoff", () => {
  it("encodes text as content and cannot inject overwrite or other URI parameters", () => {
    const body =
      "想法 &overwrite=true\n[论文](zotero://open-pdf/library/items/ABCD2345?page=4)\n# 新标题 + 100%";
    const uri = new URL(
      obsidianNewNoteUri("My 知识库 & A", "阅读：A/B?", body)!,
    );
    expect(uri.searchParams.get("vault")).toBe("My 知识库 & A");
    expect(uri.searchParams.get("content")).toBe(
      markdownNote("阅读：A/B?", body),
    );
    expect([...uri.searchParams.keys()]).toEqual(["vault", "name", "content"]);
    expect(uri.searchParams.get("name")).not.toMatch(/[/?]/);
  });

  it("requires an explicit destination and title", () => {
    expect(obsidianNewNoteUri("  ", "标题", "正文")).toBeNull();
    expect(obsidianNewNoteUri("Notes", " ", "正文")).toBeNull();
  });

  it("falls back for long encoded notes without truncating Markdown", () => {
    const body = "知识 ".repeat(3000);
    expect(obsidianNewNoteUri("Notes", "长笔记", body)).toBeNull();
    expect(markdownNote("长笔记", body)).toBe(`# 长笔记\n\n${body.trim()}\n`);
  });

  it("preserves multiline Markdown and avoids a duplicated one-line capture", () => {
    expect(markdownNote("随手想法", "随手想法")).toBe("# 随手想法\n\n");
    expect(markdownNote("阅读记录", "- [ ] 理解方法\n\n> 原文摘录")).toBe(
      "# 阅读记录\n\n- [ ] 理解方法\n\n> 原文摘录\n",
    );
  });

  it("creates portable names without breaking Unicode or using directory traversal", () => {
    expect(noteFileName("../../CON")).not.toMatch(/[/\\]/);
    expect(noteFileName("CON")).toBe("Workspace note.md");
    expect(noteFileName("  论文笔记.md ")).toBe("论文笔记.md");
    const name = noteFileName("😀".repeat(101));
    expect(new TextEncoder().encode(name).length).toBeLessThan(255);
    expect(() => encodeURIComponent(name)).not.toThrow();
  });
});
