import type { Element, ElementContent, Root, Text } from 'hast';
import { toString } from 'hast-util-to-string';

/**
 * Resume-specific touches on top of rehype-sectionize. Each one matches a
 * pattern that already exists in plain markdown and splits it into elements
 * the CSS can place. Anything that doesn't match is left as it was: these
 * transforms never throw and never drop content.
 *
 * - Masthead: first bold-only paragraph → tagline; a `a | b | c` paragraph →
 *   contact list; remaining paragraphs → summary.
 * - Headings ending in `(…)` → `<header>` with the title and a dates element.
 * - Timeline items `**Org** - Role; Role (dates)` → org / roles / dates.
 * - Bold-only paragraphs elsewhere → role labels.
 * - Sections listed in `pageBreaks` → a print-only running head.
 */
export interface ResumeOptions {
  /** Layouts (from rehype-sectionize) that start a new printed page. */
  pageBreaks?: readonly string[];
}

const el = (
  tagName: string,
  className: string | string[] | null,
  children: ElementContent[] = [],
  properties: Element['properties'] = {},
): Element => ({
  type: 'element',
  tagName,
  properties: className ? { ...properties, className: Array.isArray(className) ? className : [className] } : properties,
  children,
});

const text = (value: string): Text => ({ type: 'text', value });

const isBlank = (node: ElementContent) => node.type === 'text' && !node.value.trim();
const meaningful = (nodes: ElementContent[]) => nodes.filter((n) => !isBlank(n) && n.type !== 'comment');

const classes = (node: Element): string[] => {
  const value = node.properties?.className;
  if (Array.isArray(value)) return value.map(String);
  return typeof value === 'string' ? (value as string).split(' ') : [];
};
const hasClass = (node: Element, name: string) => classes(node).includes(name);
const addClass = (node: Element, name: string) => {
  node.properties = { ...node.properties, className: [...classes(node), name] };
};

const isElement = (node: ElementContent | undefined, tagName?: string): node is Element =>
  node?.type === 'element' && (!tagName || node.tagName === tagName);

/** A paragraph whose only content is one <strong>. */
const boldOnly = (node: ElementContent): Element | null => {
  if (!isElement(node, 'p')) return null;
  const kids = meaningful(node.children);
  return kids.length === 1 && isElement(kids[0], 'strong') ? kids[0] : null;
};

const allText = (nodes: ElementContent[]): nodes is Text[] => nodes.every((n) => n.type === 'text');

/** `Title (dates)` → [title, dates]. */
const TRAILING_PAREN = /^(.*?\S)\s*\(([^()]+)\)\s*$/;
/** ` - Role; Role (dates)` after the bold org name. */
const TIMELINE_REST = /^\s*[-–—:]\s*(.*?)\s*(?:\(([^()]+)\))?\s*$/;

function masthead(section: Element) {
  const heading = section.children.find((n) => isElement(n, 'h1'));
  if (!heading) return;

  // Only paragraphs between the h1 and the first nested section are intro.
  const firstSection = section.children.findIndex((n) => isElement(n, 'section'));
  const intro = section.children.slice(0, firstSection === -1 ? undefined : firstSection);
  const sections = firstSection === -1 ? [] : section.children.slice(firstSection);

  let tagline: Element | null = null;
  let contact: Element | null = null;
  const rest: ElementContent[] = [];

  for (const node of intro) {
    if (node === heading) continue;
    const strong = boldOnly(node);
    if (!tagline && !contact && strong) {
      tagline = el('p', 'masthead__tagline', strong.children);
      continue;
    }
    if (!contact && isElement(node, 'p')) {
      const kids = meaningful(node.children);
      const value = allText(kids) ? kids.map((k) => k.value).join('') : '';
      if (value.includes('|')) {
        const parts = value.split('|').map((s) => s.trim()).filter(Boolean);
        contact = el('p', 'masthead__contact', parts.map((part) => el('span', null, [text(part)])));
        continue;
      }
    }
    if (isElement(node, 'p')) addClass(node, 'masthead__summary');
    rest.push(node);
  }

  const identity = el('div', 'masthead__identity', tagline ? [heading, tagline] : [heading]);
  const head = el('header', 'masthead__head', contact ? [identity, contact] : [identity]);
  section.children = [head, ...rest, ...sections];
}

function headingWithDates(parent: Element) {
  parent.children = parent.children.map((node) => {
    if (!isElement(node) || !/^h[2-6]$/.test(node.tagName)) return node;
    const kids = meaningful(node.children);
    if (!allText(kids)) return node;
    const match = TRAILING_PAREN.exec(kids.map((k) => k.value).join(''));
    if (!match) return node;
    node.children = [text(match[1])];
    return el('header', 'entry-head', [node, el('span', 'dates', [text(match[2])])]);
  });
}

function timeline(section: Element) {
  for (const list of section.children) {
    if (!isElement(list, 'ul') && !isElement(list, 'ol')) continue;
    addClass(list, 'timeline');
    for (const item of list.children) {
      if (!isElement(item, 'li')) continue;
      // Tight lists put inline content straight in <li>; loose ones wrap it in <p>.
      let inline = meaningful(item.children);
      if (inline.length === 1 && isElement(inline[0], 'p')) inline = meaningful(inline[0].children);

      const [org, ...rest] = inline;
      const match = isElement(org, 'strong') && allText(rest)
        ? TIMELINE_REST.exec(rest.map((r) => r.value).join(''))
        : null;
      if (!match || !isElement(org)) {
        addClass(item, 'timeline__plain');
        continue;
      }

      const roles = match[1].split(/\s*;\s*/).filter(Boolean);
      item.children = [
        el('strong', 'timeline__org', org.children),
        el('span', 'timeline__roles', roles.map((role) => el('span', 'timeline__role', [text(role)]))),
        el('span', ['dates', 'timeline__dates'], match[2] ? [text(match[2])] : []),
      ];
    }
  }
}

function roleLabels(parent: Element) {
  parent.children = parent.children.map((node) => {
    const strong = boldOnly(node);
    return strong ? el('p', 'role', strong.children) : node;
  });
}

export default function rehypeResume(options: ResumeOptions = {}) {
  const { pageBreaks = [] } = options;

  return (tree: Root) => {
    let name = '';
    let page = 1;

    const visit = (section: Element) => {
      if (hasClass(section, 'section--masthead')) {
        name = toString(section.children.find((n) => isElement(n, 'h1')) ?? el('span', null));
        masthead(section);
      } else {
        roleLabels(section);
      }
      if (hasClass(section, 'section--timeline')) timeline(section);
      headingWithDates(section);

      if (pageBreaks.some((layout) => hasClass(section, `section--${layout}`))) {
        page += 1;
        addClass(section, 'section--page-break');
        section.children.unshift(
          el(
            'div',
            'running-head',
            [
              el('span', 'running-head__name', [text(name)]),
              el('span', 'running-head__page', [text(`Page ${page}`)]),
            ],
            { ariaHidden: 'true' },
          ),
        );
      }

      for (const child of section.children) {
        if (isElement(child, 'section')) visit(child);
      }
    };

    for (const node of tree.children) {
      if (node.type === 'element' && node.tagName === 'section') visit(node);
    }
  };
}
