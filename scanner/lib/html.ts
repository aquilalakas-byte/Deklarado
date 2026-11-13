// Turns article HTML into clean text lines the classifier can read.

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", ntilde: "ñ", Ntilde: "Ñ", rsquo: "'", lsquo: "'",
  rdquo: '"', ldquo: '"', hellip: "…", eacute: "é", oacute: "ó",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name] ?? m);
}

export type Line = {
  text: string;        // plain text of the line
  link: string | null; // first link in the line (often the LGU's Facebook post)
  isListItem: boolean; // true for <li> bullets (usually individual schools)
};

/** Split an article body into lines, one per paragraph / list item / line break. */
export function htmlToLines(html: string): Line[] {
  const parts = html.split(/<\/p>|<\/li>|<br\s*\/?>|<\/h[1-6]>|<\/div>/i);
  const lines: Line[] = [];
  for (const part of parts) {
    const isListItem = /<li[\s>]/i.test(part);
    const href = part.match(/<a\s[^>]*href="([^"]+)"/i)?.[1] ?? null;
    const text = decodeEntities(part.replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (text) lines.push({ text, link: href ? decodeEntities(href) : null, isListItem });
  }
  return lines;
}
