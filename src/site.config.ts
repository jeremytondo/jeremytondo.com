/**
 * Site-level settings. Everything about presentation lives here or in
 * templates/CSS — never in resume.md or home.md, which stay plain markdown.
 */
export const site = {
  url: 'https://jeremytondo.com',
  name: 'Jeremy Margaritondo',
  tagline: 'Creative Technologist & Leader',
  linkedin: 'https://www.linkedin.com/in/jeremytondo/',
  github: 'https://github.com/jeremytondo',
  email: 'jmargari@gmail.com',

  home: {
    title: 'Jeremy Margaritondo | Creative Technologist & Leader',
    description:
      'Creative technologist and leader. 25+ years turning ambitious ideas into products and experiences used by more than a billion people.',
    /** Same idea as `sectionLayouts` below, for home.md. */
    sectionLayouts: {
      1: ['hero'],
      2: ['work', 'now', 'contact'],
    } as Record<number, string[]>,
  },

  resume: {
    title: 'Jeremy Margaritondo — Resume',
    description:
      'Creative technologist and leader: 25+ years building teams and products, most recently as Senior UX Engineering Manager at Google.',
    // Published at /resume/<pdfFilename>. This URL is shared externally — never rename it.
    pdfFilename: 'jeremytondo-resume.pdf',
  },

  /**
   * How each heading-level section is laid out, by position (not by text), so
   * rewording a heading never breaks styling. Index 0 is the first heading of
   * that level in resume.md. Sections past the end of a list use the default
   * layout.
   */
  sectionLayouts: {
    1: ['masthead'],
    2: ['skills', 'timeline', 'experience'],
  } as Record<number, string[]>,
} as const;
