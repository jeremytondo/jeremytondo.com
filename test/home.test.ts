import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { renderHome } from '../src/lib/home.ts';

const layouts = { 1: ['hero'], 2: ['work', 'now', 'contact'] };
const render = (md: string) => renderHome(md, { layouts });

test('real home.md fills every part of the page', async () => {
  const source = readFileSync('home.md', 'utf8');
  assert.ok(!source.includes('—'), 'home.md has an em dash');

  const home = await render(source);
  assert.equal(home.hero!.headlineHtml, 'Creative technologist and leader.');
  assert.deepEqual(home.hero!.lede, [
    'Turning ambitious ideas into products and experiences used by more than a billion people.',
  ]);
  assert.deepEqual(
    home.hero!.meta.map((m) => [m.key, m.valueHtml]),
    [
      ['loc', 'chicago'],
      ['at', 'google/sr-ux-eng-manager'],
      ['uptime', '25y+'],
    ],
  );
  assert.equal(home.hero!.restHtml, '');

  const entries = home.work!.entries;
  assert.equal(entries.length, 7);
  assert.deepEqual(entries.map((e) => e.titleHtml), [
    'Interactive Doodles',
    'Search easter eggs',
    'Google brand sites',
    'ARC: AI + Radical Creativity',
    'Doodles platform',
    'Marketing web standards',
    'Stealth startup',
  ]);
  assert.match(entries[0].bodyHtml, /^<p>Led the UX engineering team/);
  assert.deepEqual(entries[2].examples, [
    { href: 'https://about.google', labelHtml: 'about.google' },
    { href: 'https://blog.google', labelHtml: 'blog.google' },
  ]);
  assert.deepEqual(entries[3].examples, [{ href: null, labelHtml: 'internal only' }]);
  assert.deepEqual(entries[4].examples, []);
  assert.deepEqual(entries[6].examples, [{ href: null, labelHtml: 'coming soon' }]);

  assert.deepEqual(home.now!.items.map(({ bodyHtml, ...rest }) => rest), [
    { titleHtml: 'Atelier', href: 'https://github.com/jeremytondo/atelier', stack: 'go · fedora bootc · mise · tailscale · rex' },
  ]);
  assert.match(home.now!.items[0].bodyHtml, /^<p>My personal dev environment/);

  assert.equal(
    home.contactHtml,
    '<p>Working on something ambitious? <a href="mailto:jmargari@gmail.com">Let’s talk.</a></p>',
  );
  assert.deepEqual(home.extra, []);
});

test('sections map by position, not heading text, and entries follow markdown order', async () => {
  const home = await render(
    '# Hi\n\n## Anything\n\n### Second\n\none\n\n### First\n\ntwo\n\n## Whatever\n\n## Renamed\n\nBye.\n\n## Extra one\n\nMore.',
  );
  assert.deepEqual(home.work!.entries.map((e) => e.titleHtml), ['Second', 'First']);
  assert.deepEqual(home.now, { introHtml: '', items: [] });
  assert.equal(home.contactHtml, '<p>Bye.</p>');
  assert.deepEqual(home.extra, [{ headingHtml: 'Extra one', html: '<p>More.</p>' }]);
});

test('lines that do not match a pattern render as plain text', async () => {
  const home = await render(
    [
      '# Head *line*',
      '- role: x',
      '- just a line',
      '- **bold**: no',
      'After the list.',
      '## W',
      'Intro.',
      '### *Styled* title',
      '### Title (with parens)',
      '- plain [and a link](https://a.example) together',
      '- [solo](https://b.example)',
      '#### Deeper',
      'kept',
      '## N',
      '### Plain title (x · y)',
      'Body.',
      '### [Linked](https://c.example) trailing words',
      '### [Bare link](https://d.example)',
    ].join('\n\n'),
  );

  assert.equal(home.hero!.headlineHtml, 'Head <em>line</em>');
  assert.deepEqual(home.hero!.lede, []);
  assert.deepEqual(home.hero!.meta, [
    { key: 'role', valueHtml: 'x' },
    { key: null, valueHtml: 'just a line' },
    { key: null, valueHtml: '<strong>bold</strong>: no' },
  ]);
  assert.equal(home.hero!.restHtml, '<p>After the list.</p>');

  const [styled, parens] = home.work!.entries;
  assert.equal(home.work!.introHtml, '<p>Intro.</p>');
  assert.equal(styled.titleHtml, '<em>Styled</em> title');
  // Work titles render as written; parentheses are only special in the now panel.
  assert.equal(parens.titleHtml, 'Title (with parens)');
  assert.deepEqual(parens.examples, [
    { href: null, labelHtml: 'plain <a href="https://a.example">and a link</a> together' },
    { href: 'https://b.example', labelHtml: 'solo' },
  ]);
  assert.match(parens.bodyHtml, /<h4>Deeper<\/h4>\s*<p>kept<\/p>/);

  assert.deepEqual(
    home.now!.items.map(({ titleHtml, href, stack, bodyHtml }) => [titleHtml, href, stack, bodyHtml]),
    [
      ['Plain title', null, 'x · y', '<p>Body.</p>'],
      ['<a href="https://c.example">Linked</a> trailing words', null, null, ''],
      ['Bare link', 'https://d.example', null, ''],
    ],
  );
});

test('inline markup around the patterns still matches', async () => {
  const home = await render(
    '# H\n\n- role: **creative** technologist\n- *em* first: no key\n\n## W\n\n## N\n\n### [**Atelier**](https://a.example) (go · mise)',
  );
  assert.deepEqual(home.hero!.meta, [
    { key: 'role', valueHtml: '<strong>creative</strong> technologist' },
    { key: null, valueHtml: '<em>em</em> first: no key' },
  ]);
  const [item] = home.now!.items;
  assert.deepEqual([item.titleHtml, item.href, item.stack], ['<strong>Atelier</strong>', 'https://a.example', 'go · mise']);
});

test('fallbacks keep spacing, deeper headings and block content as plain content', async () => {
  const home = await render(
    [
      '# H',
      '- **Alpha** **Beta**',
      '## W',
      '#### Notes (draft)',
      'Before any entry.',
      '### One (a)',
      '- [chip](https://a.example)',
      '- parent\n  - nested',
      '## N',
      '#### Aside',
      'Not a panel.',
    ].join('\n\n'),
  );

  assert.deepEqual(home.hero!.meta, [{ key: null, valueHtml: '<strong>Alpha</strong> <strong>Beta</strong>' }]);

  assert.equal(home.work!.entries.length, 1);
  assert.match(home.work!.introHtml, /^<section[^>]*><h4>Notes \(draft\)<\/h4>\s*<p>Before any entry.<\/p>\s*<\/section>$/);
  const [one] = home.work!.entries;
  assert.deepEqual(one.examples, []);
  assert.match(one.bodyHtml, /^<ul>[\s\S]*<a href="https:\/\/a.example">chip<\/a>[\s\S]*<ul>\s*<li>nested<\/li>/);

  assert.deepEqual(home.now!.items, []);
  assert.match(home.now!.introHtml, /<h4>Aside<\/h4>\s*<p>Not a panel.<\/p>/);
});

test('paragraphs right after the headline are the lede, then the meta list', async () => {
  const home = await render('# H\n\nOne *two*.\n\nThree.\n\n- at: x\n\nAfter.\n\n- not meta');
  assert.deepEqual(home.hero!.lede, ['One <em>two</em>.', 'Three.']);
  assert.deepEqual(home.hero!.meta, [{ key: 'at', valueHtml: 'x' }]);
  assert.match(home.hero!.restHtml, /^<p>After.<\/p>\s*<ul>/);

  const blockFirst = await render('# H\n\n> quote\n\nNot lede.');
  assert.deepEqual(blockFirst.hero!.lede, []);
  assert.match(blockFirst.hero!.restHtml, /^<blockquote>[\s\S]*<p>Not lede.<\/p>$/);
});

test('empty, heading-less or partial markdown does not throw', async () => {
  assert.deepEqual(await render(''), { hero: null, work: null, now: null, contactHtml: null, extra: [] });

  const loose = await render('Just a paragraph.');
  assert.deepEqual(loose.extra, [{ headingHtml: null, html: '<p>Just a paragraph.</p>' }]);

  const noHero = await render('## Work\n\n### Only one');
  assert.equal(noHero.hero, null);
  assert.equal(noHero.work!.entries.length, 1);
});
