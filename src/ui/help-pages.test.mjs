import test from 'node:test';
import assert from 'node:assert/strict';
import { createHelpPages } from './help-pages.mjs';

test('how-to has three short screens and uses the supplied game rules', () => {
  const pages = createHelpPages(6, -70);
  assert.equal(pages.length, 3);
  assert(pages.every((page) => page.lines.length === 3));
  assert.match(pages[1].lines[0], /6 power cells/);
  assert.match(pages[1].lines[1], /-70°C/);
  assert.match(pages[2].lines[2], /returns to the dome/);
});
