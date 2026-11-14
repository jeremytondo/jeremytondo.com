import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import rehypeResume from './rehype-resume.ts';
import rehypeSectionize from './rehype-sectionize.ts';

export interface RenderOptions {
  layouts: Record<number, readonly string[]>;
  pageBreaks?: readonly string[];
}

/** resume.md → HTML, with sections and layout hooks for the d3 design. */
export async function renderResume(markdown: string, options: RenderOptions): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSectionize, { layouts: options.layouts })
    .use(rehypeResume, { pageBreaks: options.pageBreaks })
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}
