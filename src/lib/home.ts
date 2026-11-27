import type { Element, ElementContent, Root, RootContent } from 'hast';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { classes, isElement, meaningful, text } from './hast.ts';
import rehypeSectionize from './rehype-sectionize.ts';

/**
 * home.md → the data the home page components render.
 *
 * Sections come from rehype-sectionize, so layout is decided by heading
 * position (see `site.home.sectionLayouts`), never heading text. Inside each
 * section a pattern pass picks out what plain markdown already says:
 *
 * - hero: the `#` line is the headline; paragraphs right after it are the
 *   lede; a list right after those with `key: value` items is the meta lines.
 * - work: each `### Title` is an entry; its paragraphs are the one-liner
 *   and its list items are example pills (a link, or plain text).
 * - now: each `### [Title](url) (stack)` is a panel; its paragraphs are the body.
 * - contact: everything under the heading.
 *
 * Fields ending in `Html` hold serialized HTML. Anything that doesn't match a
 * pattern is kept as plain HTML in the nearest such field: parsing never
 * throws and never drops content.
 */

export interface MetaLine {
  /** `role` in `role: creative-technologist`; null when the item isn't `key: value`. */
  key: string | null;
  /** The value, or the whole item when `key` is null. */
  valueHtml: string;
}

export interface Hero {
  headlineHtml: string;
  /** Inner HTML of each paragraph right after the `#` line. */
  lede: string[];
  meta: MetaLine[];
  /** Anything else under the `#` line. */
  restHtml: string;
}

export interface Example {
  /** Set when the item is a single link; null renders a muted pill. */
  href: string | null;
  labelHtml: string;
}

export interface WorkEntry {
  titleHtml: string;
  /** The one-liner, plus any other non-list content. */
  bodyHtml: string;
  examples: Example[];
}

export interface Work {
  /** Content between the `##` and the first entry. */
  introHtml: string;
  entries: WorkEntry[];
}

export interface NowItem {
  titleHtml: string;
  href: string | null;
  stack: string | null;
  bodyHtml: string;
}

export interface Now {
  introHtml: string;
  items: NowItem[];
}

export interface ExtraSection {
  /** Inner HTML of the section's heading; null for content before the first heading. */
  headingHtml: string | null;
  html: string;
}

export interface HomeContent {
  hero: Hero | null;
  work: Work | null;
  now: Now | null;
  /** Everything under the contact heading. */
  contactHtml: string | null;
  /** Sections with no home layout (past the end of `sectionLayouts`, or repeats). */
  extra: ExtraSection[];
}

export interface HomeOptions {
  layouts: Record<number, readonly string[]>;
}

const stringifier = unified().use(rehypeStringify);
const toHtml = (nodes: ElementContent[]): string =>
  nodes.length ? stringifier.stringify({ type: 'root', children: nodes }).trim() : '';

const layoutOf = (section: Element): string =>
  classes(section).find((c) => c.startsWith('section--'))?.slice('section--'.length) ?? 'default';

const levelOf = (section: Element): number => Number(section.properties?.dataLevel ?? 0);

const isList = (node: ElementContent): node is Element => isElement(node, 'ul') || isElement(node, 'ol');

const BLOCK = /^(?:address|article|aside|blockquote|details|div|dl|figure|h[1-6]|hr|ol|p|pre|section|table|ul)$/;

/**
 * A list item's inline content, whitespace included, or null when it holds
 * blocks (a nested list, several paragraphs). Loose lists wrap it in one <p>.
 */
function inlineOf(item: Element): ElementContent[] | null {
  const kids = meaningful(item.children);
  const inline = kids.length === 1 && isElement(kids[0], 'p') ? kids[0].children : item.children;
  return inline.some((n) => isElement(n) && BLOCK.test(n.tagName)) ? null : inline;
}

/** Inline content trimmed of whitespace-only text at either end. */
function trimmed(nodes: ElementContent[]): ElementContent[] {
  let start = 0;
  let end = nodes.length;
  while (start < end && !meaningful([nodes[start]]).length) start++;
  while (end > start && !meaningful([nodes[end - 1]]).length) end--;
  return nodes.slice(start, end);
}

/** Splits a section into its heading, its own content and its nested sections. */
function parts(section: Element) {
  const [heading, ...rest] = section.children;
  const content = rest.filter((n) => !isElement(n, 'section'));
  const sections = rest.filter((n): n is Element => isElement(n, 'section'));
  return { heading: heading as Element, content, sections };
}

/**
 * A container's sub-sections one heading level down (its entries), and
 * everything else, kept in order as plain content. A deeper heading straight
 * under the container is plain content, not an entry.
 */
function children(section: Element) {
  const { content, sections } = parts(section);
  const level = levelOf(section) + 1;
  const entries = sections.filter((s) => levelOf(s) === level);
  const other = [...content, ...sections.filter((s) => levelOf(s) !== level)];
  const rest = section.children.slice(1).filter((n) => other.includes(n));
  return { entries, introHtml: toHtml(meaningful(rest)) };
}

const PAREN_END = /\s*\(([^()]+)\)\s*$/;

/** `Title (stack)` → [title nodes, stack]. The parens must end the heading's last text. */
function splitParen(heading: Element): [ElementContent[], string | null] {
  const kids = trimmed(heading.children);
  const last = kids.at(-1);
  const match = last?.type === 'text' ? PAREN_END.exec(last.value) : null;
  if (!last || last.type !== 'text' || !match) return [kids, null];

  const before = last.value.slice(0, match.index);
  const title = [...kids.slice(0, -1), ...(before ? [text(before)] : [])];
  // `### (just parens)` has no title to split from.
  return meaningful(title).length ? [title, match[1].trim()] : [kids, null];
}

/** `key: value`, where the key is the start of the item's first text. */
const META = /^\s*([^\s:]+)\s*:\s*/;

function metaLine(inline: ElementContent[]): MetaLine {
  const [first, ...others] = trimmed(inline);
  const match = first?.type === 'text' ? META.exec(first.value) : null;
  if (first?.type === 'text' && match) {
    const value = trimmed([text(first.value.slice(match[0].length)), ...others]);
    if (meaningful(value).length) return { key: match[1], valueHtml: toHtml(value) };
  }
  return { key: null, valueHtml: toHtml(trimmed(inline)) };
}

function hero(section: Element): Hero {
  const { heading, content } = parts(section);
  let rest = meaningful(content);

  const ledeEnd = rest.findIndex((n) => !isElement(n, 'p'));
  const lede = rest.slice(0, ledeEnd === -1 ? undefined : ledeEnd).map((p) => toHtml((p as Element).children));
  rest = rest.slice(lede.length);

  // Every item must be inline; otherwise the list stays a plain list.
  const [first] = rest;
  const meta: MetaLine[] = [];
  const items = first && isList(first) ? first.children.filter((n) => isElement(n, 'li')).map(inlineOf) : [];
  if (items.length && items.every((i) => i !== null)) {
    rest = rest.slice(1);
    for (const inline of items) meta.push(metaLine(inline!));
  }

  return { headlineHtml: toHtml(heading.children), lede, meta, restHtml: toHtml(rest) };
}

function example(inline: ElementContent[]): Example {
  const kids = meaningful(inline);
  const [only] = kids;
  if (kids.length === 1 && isElement(only, 'a') && typeof only.properties?.href === 'string') {
    return { href: only.properties.href, labelHtml: toHtml(only.children) };
  }
  return { href: null, labelHtml: toHtml(trimmed(inline)) };
}

function workEntry(section: Element): WorkEntry {
  const { heading, content, sections } = parts(section);
  const body: ElementContent[] = [];
  const examples: Example[] = [];

  for (const node of meaningful(content)) {
    // A list with block content in any item isn't a row of pills: keep it as a list.
    const items = isList(node) ? node.children.filter((n) => isElement(n, 'li')).map(inlineOf) : [];
    if (items.length && items.every((i) => i !== null)) examples.push(...items.map((i) => example(i!)));
    else body.push(node);
  }

  return { titleHtml: toHtml(trimmed(heading.children)), bodyHtml: toHtml([...body, ...sections]), examples };
}

function work(section: Element): Work {
  const { entries, introHtml } = children(section);
  return { introHtml, entries: entries.map(workEntry) };
}

function nowItem(section: Element): NowItem {
  const { heading, content, sections } = parts(section);
  const bodyHtml = toHtml([...meaningful(content), ...sections]);
  const [title, stack] = splitParen(heading);
  const kids = meaningful(title);
  const [link] = kids;

  if (kids.length === 1 && isElement(link, 'a') && typeof link.properties?.href === 'string') {
    return { titleHtml: toHtml(link.children), href: link.properties.href, stack, bodyHtml };
  }
  return { titleHtml: toHtml(title), href: null, stack, bodyHtml };
}

function now(section: Element): Now {
  const { entries, introHtml } = children(section);
  return { introHtml, items: entries.map(nowItem) };
}

export async function renderHome(markdown: string, options: HomeOptions): Promise<HomeContent> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSectionize, { layouts: options.layouts });
  const tree = (await processor.run(processor.parse(markdown))) as Root;

  const home: HomeContent = { hero: null, work: null, now: null, contactHtml: null, extra: [] };
  const preamble: ElementContent[] = [];

  const visit = (section: Element) => {
    const { heading, content, sections } = parts(section);
    // A `#` section's nested `##` sections are laid out on their own; deeper
    // sections belong to the section they sit in.
    const own = toHtml(meaningful(levelOf(section) === 1 ? content : [...content, ...sections]));
    const layout = layoutOf(section);

    if (layout === 'hero' && !home.hero) home.hero = hero(section);
    else if (layout === 'work' && !home.work) home.work = work(section);
    else if (layout === 'now' && !home.now) home.now = now(section);
    else if (layout === 'contact' && home.contactHtml === null) home.contactHtml = own;
    else home.extra.push({ headingHtml: toHtml(heading.children), html: own });

    if (levelOf(section) === 1) sections.forEach(visit);
  };

  for (const node of tree.children as RootContent[]) {
    if (node.type === 'element' && node.tagName === 'section') visit(node);
    else if (node.type !== 'doctype') preamble.push(node as ElementContent);
  }

  if (meaningful(preamble).length) home.extra.unshift({ headingHtml: null, html: toHtml(meaningful(preamble)) });
  return home;
}
