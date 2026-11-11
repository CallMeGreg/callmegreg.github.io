import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProject, getPackLayout } from './cardStudioModel.mjs';
import { getPackPlacement, renderPackSvg } from './cardStudioPack.mjs';

test('pack printing centers the full-size net without scaling its dimensions', () => {
  const { pack, print } = createProject();
  for (const paper of ['letter', 'a4']) {
    for (const orientation of ['portrait', 'landscape']) {
      const placement = getPackPlacement(pack, { ...print, paper, orientation });
      assert.deepEqual(placement.net, getPackLayout(pack));
      assert.equal(placement.x * 2 + placement.net.width, placement.width);
      assert.equal(placement.y * 2 + placement.net.height, placement.height);
    }
  }
});

test('oversized wrappers explicitly fail rather than scaling to fit', () => {
  const { pack, print } = createProject();
  assert.throws(() => getPackPlacement({ ...pack, cardCount: 40, thickness: 0.03, allowance: 0.5, glue: 0.75 }, print), /does not fit/);
});

test('pack SVG is physical-size, escapes labels, and can hide manufacturing guides', () => {
  const { pack } = createProject();
  const net = getPackLayout(pack);
  const svg = renderPackSvg({ ...pack, name: '<custom & unique>' });
  assert.ok(svg.includes(`width="${net.width}in"`));
  assert.ok(svg.includes(`height="${net.height}in"`));
  assert.ok(svg.includes('&lt;custom &amp; unique&gt;'));
  assert.ok(svg.includes('GLUE TAB'));
  assert.ok(svg.includes('NOT AN OFFICIAL PRODUCT'));
  assert.ok(!renderPackSvg(pack, { guides: false }).includes('GLUE TAB'));
  assert.ok(!renderPackSvg(pack, { frontOnly: true }).includes('FOLD &amp; SEAL'));
});
