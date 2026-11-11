import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertProjectCapacity, fileName, loadImage, projectFileSize, readArtwork, readProjectFile, setPngDpi } from './cardStudioFiles.mjs';
import { createProject, MAX_PROJECT_BYTES, serializeProject } from './cardStudioModel.mjs';

const pixel = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));

function chunks(bytes) {
  const result = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    result.push({ type: String.fromCharCode(...bytes.slice(offset + 4, offset + 8)), data: bytes.slice(offset + 8, offset + 8 + length) });
    offset += length + 12;
  }
  return result;
}

test('PNG exports carry physical 300 and 600 DPI instead of browser-default 96 DPI', () => {
  for (const dpi of [300, 600]) {
    const result = chunks(setPngDpi(pixel, dpi));
    assert.deepEqual(result.map(chunk => chunk.type), ['IHDR', 'pHYs', 'IDAT', 'IEND']);
    const density = new DataView(result[1].data.buffer);
    assert.equal(density.getUint32(0), Math.round(dpi / 0.0254));
    assert.equal(density.getUint32(4), Math.round(dpi / 0.0254));
    assert.equal(density.getUint8(8), 1);
    assert.deepEqual(result[0].data, chunks(pixel)[0].data);
    assert.deepEqual(result[2].data, chunks(pixel)[1].data);
  }
});

test('replacing PNG resolution does not accumulate metadata chunks', () => {
  const result = chunks(setPngDpi(setPngDpi(pixel, 300), 600));
  assert.equal(result.filter(chunk => chunk.type === 'pHYs').length, 1);
  assert.equal(new DataView(result[1].data.buffer).getUint32(0), 23622);
});

test('invalid or incomplete PNG exports and unsupported DPI are rejected', () => {
  assert.throws(() => setPngDpi(new Uint8Array([0]), 300), /invalid PNG/);
  assert.throws(() => setPngDpi(pixel.slice(0, -4), 300), /incomplete PNG/);
  assert.throws(() => setPngDpi(pixel, 96), /300 or 600/);
});

test('download filenames cannot introduce paths or blank names', () => {
  assert.equal(fileName('My card collection!'), 'My-card-collection');
  assert.equal(fileName('../../cards/a'), '..-..-cards-a');
  assert.equal(fileName('   '), 'card-studio');
  assert.equal(fileName('x'.repeat(100)).length, 80);
});

test('unsupported and oversized artwork is rejected before decoding', async () => {
  for (const type of ['image/svg+xml', 'image/gif', 'image/heic', 'text/html', '']) {
    await assert.rejects(readArtwork({ type, size: 100 }), /PNG, JPEG, or WebP/);
  }
  await assert.rejects(readArtwork(null), /Choose a PNG/);
  await assert.rejects(readArtwork({ type: 'image/png', size: MAX_PROJECT_BYTES + 1 }), /smaller than 20 MB/);
});

test('portable project files are checked before changing the current project', async () => {
  const project = createProject();
  const json = serializeProject(project);
  assert.deepEqual(await readProjectFile({ size: json.length, text: async () => json }), project);
  await assert.rejects(readProjectFile({ size: 4, text: async () => '{bad' }), /Invalid project JSON/);
  let opened = false;
  await assert.rejects(readProjectFile({
    size: MAX_PROJECT_BYTES + 1,
    text: async () => { opened = true; return json; },
  }), /smaller than 20 MB/);
  assert.equal(opened, false);
});

test('browser image decoding errors are actionable rather than producing a blank image', async context => {
  const previous = globalThis.Image;
  globalThis.Image = class {
    set src(value) { if (value) queueMicrotask(() => this.onerror()); }
  };
  context.after(() => {
    if (previous === undefined) delete globalThis.Image;
    else globalThis.Image = previous;
  });
  await assert.rejects(loadImage('data:image/png;base64,invalid'), /could not be decoded/);
});

test('editing budget matches the portable JSON byte size, including Unicode and repeated images', () => {
  const project = createProject();
  project.name = 'A collection \u2014 \u661f';
  project.cards[0].art = { data: `data:image/png;base64,${Buffer.from(pixel).toString('base64')}`, width: 1, height: 1, name: 'tiny.png' };
  project.back.art = { ...project.cards[0].art };
  assert.equal(projectFileSize(project), Buffer.byteLength(serializeProject(project), 'utf8'));
  assert.doesNotThrow(() => assertProjectCapacity(project));
});

test('the exact 20 MiB editing boundary keeps every accepted project downloadable', () => {
  const project = { data: '' };
  project.data = 'a'.repeat(MAX_PROJECT_BYTES - projectFileSize(project));
  assert.equal(projectFileSize(project), MAX_PROJECT_BYTES);
  assert.doesNotThrow(() => assertProjectCapacity(project));
  project.data += 'a';
  assert.throws(() => assertProjectCapacity(project), /previous work is unchanged/);
});
