import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bootstrap = html.match(/<script id="site-theme-init">([\s\S]*?)<\/script>/)[1];

function loadTheme(saved, unavailable = false) {
  const document = { documentElement: { dataset: { theme: 'dark' } } };
  const warnings = [];
  runInNewContext(bootstrap, {
    document,
    localStorage: {
      getItem(key) {
        assert.equal(key, 'site.theme');
        if (unavailable) throw new Error('Storage is unavailable');
        return saved;
      },
    },
    console: { warn: (...args) => warnings.push(args) },
  });
  return { theme: document.documentElement.dataset.theme, warnings };
}

test('dark is the default before the app and styles load', () => {
  assert.match(html, /<html[^>]*data-theme="dark"/);
  assert.ok(html.indexOf('site-theme-init') < html.indexOf('/src/index.jsx'));
  assert.equal(loadTheme(null).theme, 'dark');
});

test('both explicit theme choices are restored', () => {
  for (const theme of ['light', 'dark']) {
    assert.equal(loadTheme(theme).theme, theme);
  }
});

test('invalid preferences fall back to dark', () => {
  for (const saved of ['', 'system', 'LIGHT', 'null', '{"theme":"light"}']) {
    assert.equal(loadTheme(saved).theme, 'dark');
  }
});

test('unavailable storage keeps dark mode and reports the problem', () => {
  const { theme, warnings } = loadTheme(null, true);
  assert.equal(theme, 'dark');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /Unable to read/);
});
