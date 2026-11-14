import type { Element, ElementContent, Root, RootContent } from 'hast';

export interface SectionizeOptions {
  /**
   * Layout names by heading level, assigned by position: the Nth heading of a
   * level gets the Nth name. Missing entries fall back to `defaultLayout`.
   */
  layouts?: Record<number, readonly string[]>;
  defaultLayout?: string;
}

const HEADING = /^h([1-6])$/;

function headingLevel(node: RootContent | ElementContent): number | null {
  if (node.type !== 'element') return null;
  const match = HEADING.exec(node.tagName);
  return match ? Number(match[1]) : null;
}

/**
 * Wraps each heading and the content that follows it in a <section>, nested
 * by heading level (an h3 section sits inside the h2 section above it).
 *
 * Every section gets `class="section section--<layout>"` and
 * `data-level="<n>"`. Layouts come from heading position, never heading text.
 */
export default function rehypeSectionize(options: SectionizeOptions = {}) {
  const { layouts = {}, defaultLayout = 'default' } = options;

  return (tree: Root) => {
    const counts = new Map<number, number>();
    const output: RootContent[] = [];
    const stack: { level: number; section: Element }[] = [];

    for (const node of tree.children) {
      const level = headingLevel(node);

      if (level === null) {
        const parent = stack.at(-1)?.section;
        if (parent) parent.children.push(node as ElementContent);
        else output.push(node);
        continue;
      }

      while (stack.length && stack.at(-1)!.level >= level) stack.pop();

      const index = counts.get(level) ?? 0;
      counts.set(level, index + 1);
      const layout = layouts[level]?.[index] ?? defaultLayout;

      const section: Element = {
        type: 'element',
        tagName: 'section',
        properties: { className: ['section', `section--${layout}`], dataLevel: String(level) },
        children: [node as Element],
      };

      const parent = stack.at(-1)?.section;
      if (parent) parent.children.push(section);
      else output.push(section);
      stack.push({ level, section });
    }

    tree.children = output;
  };
}
