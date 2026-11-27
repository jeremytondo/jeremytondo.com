import type { Element, ElementContent, Text } from 'hast';

/** Small hast helpers shared by the resume and home page pattern passes. */

export const text = (value: string): Text => ({ type: 'text', value });

const isBlank = (node: ElementContent) => node.type === 'text' && !node.value.trim();

/** Children minus whitespace-only text and comments. */
export const meaningful = (nodes: ElementContent[]) => nodes.filter((n) => !isBlank(n) && n.type !== 'comment');

export const classes = (node: Element): string[] => {
  const value = node.properties?.className;
  if (Array.isArray(value)) return value.map(String);
  return typeof value === 'string' ? (value as string).split(' ') : [];
};
export const hasClass = (node: Element, name: string) => classes(node).includes(name);

export const isElement = (node: ElementContent | undefined, tagName?: string): node is Element =>
  node?.type === 'element' && (!tagName || node.tagName === tagName);

export const allText = (nodes: ElementContent[]): nodes is Text[] => nodes.every((n) => n.type === 'text');

/** A list item's inline content. Tight lists put it straight in <li>; loose ones wrap it in <p>. */
export const listItemContent = (item: Element): ElementContent[] => {
  const inline = meaningful(item.children);
  return inline.length === 1 && isElement(inline[0], 'p') ? meaningful(inline[0].children) : inline;
};

/** `Title (dates)` → [title, dates]. */
export const TRAILING_PAREN = /^(.*?\S)\s*\(([^()]+)\)\s*$/;
