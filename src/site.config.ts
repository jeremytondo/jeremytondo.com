/**
 * Site-level settings. Everything about presentation lives here or in
 * templates/CSS — never in resume.md, which stays plain markdown.
 */
export const site = {
  url: 'https://jeremytondo.com',
  name: 'Jeremy Margaritondo',
  tagline: 'Creative Technologist & Leader',
  linkedin: 'https://www.linkedin.com/in/jeremytondo/',

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
