import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { renderResume } from '../src/lib/resume.ts';

const layouts = { 1: ['masthead'], 2: ['skills', 'timeline', 'experience'] };
const render = (md: string) => renderResume(md, { layouts, pageBreaks: ['experience'] });

test('real resume.md renders every layout hook', async () => {
  const html = await render(readFileSync('resume.md', 'utf8'));
  for (const hook of [
    'section--masthead',
    'masthead__tagline',
    'masthead__contact',
    'masthead__summary',
    'section--skills',
    'section--timeline',
    'timeline__org',
    'section--experience',
    'entry-head',
    'class="role"',
    'running-head',
  ]) {
    assert.ok(html.includes(hook), `missing ${hook}`);
  }
  assert.match(html, /<span class="dates">2014-present<\/span>/);
  assert.match(html, /<span class="timeline__role">Global Agency Technical Liaison Lead<\/span>/);
});

test('sections nest by heading level and map by position, not text', async () => {
  const html = await render('# A\n\n## Renamed one\n\n### Sub\n\ntext\n\n## Renamed two\n\n## Renamed three\n\n## Extra');
  assert.match(html, /section--skills" data-level="2"><h2>Renamed one<\/h2>\s*<section class="section section--default" data-level="3">/);
  assert.match(html, /section--timeline" data-level="2"><h2>Renamed two/);
  assert.match(html, /section--experience section--page-break" data-level="2">/);
  assert.match(html, /section--default" data-level="2"><h2>Extra/);
});

test('lines that do not match a pattern render as plain text', async () => {
  const html = await render(
    '# A\n\n## S\n\n## T\n\n- just a line\n- **Org** with no separator\n- **Org** - Role\n\n## E\n\n### No dates here\n\n### Has (parens) in the middle\n',
  );
  assert.match(html, /<li class="timeline__plain">just a line<\/li>/);
  assert.match(html, /<li class="timeline__plain"><strong>Org<\/strong> with no separator<\/li>/);
  assert.match(html, /timeline__role">Role<\/span><\/span><span class="dates timeline__dates"><\/span>/);
  assert.match(html, /<h3>No dates here<\/h3>/);
  assert.match(html, /<h3>Has \(parens\) in the middle<\/h3>/);
});

test('empty or heading-less markdown does not throw', async () => {
  assert.equal(await render(''), '');
  assert.match(await render('Just a paragraph.'), /<p>Just a paragraph.<\/p>/);
});
