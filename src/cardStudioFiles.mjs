import { MAX_IMAGE_BYTES, MAX_PROJECT_BYTES, parseProject, serializeProject } from './cardStudioModel.mjs';

const RASTER_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function projectFileSize(project) {
  let artworkBytes = 0;
  // Raster URLs are ASCII. Count them without copying megabytes on every edit.
  const metadata = JSON.stringify(project, (key, value) => {
    if (key === 'data' && typeof value === 'string') {
      artworkBytes += value.length;
      return '';
    }
    return value;
  }, 2);
  return new TextEncoder().encode(metadata).length + artworkBytes;
}

export function assertProjectCapacity(project) {
  if (projectFileSize(project) > MAX_PROJECT_BYTES) {
    throw new Error('This change would exceed the 20 MB project-file limit. Your previous work is unchanged and can still be downloaded. Remove an image or split the collection into separate project files.');
  }
}

export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => {
      image.src = '';
      reject(new Error('The image took too long to open. Try a smaller PNG, JPEG, or WebP.'));
    }, 15000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('This image could not be decoded. Export it as PNG, JPEG, or WebP and try again.'));
    };
    image.src = source;
  });
}

export async function readArtwork(file) {
  if (!file || !RASTER_TYPES.has(file.type)) {
    throw new Error('Choose a PNG, JPEG, or WebP image. Convert SVG, GIF, or HEIC artwork before importing.');
  }
  if (file.size > MAX_PROJECT_BYTES) throw new Error('Choose an image smaller than 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (image.naturalWidth > 12000 || image.naturalHeight > 12000) {
      throw new Error('Images can be at most 12,000 pixels on either side. Resize this image first.');
    }
    const scale = Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not open an image canvas.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/webp', 0.92);
    if (Math.ceil(data.split(',')[1].length * 3 / 4) > MAX_IMAGE_BYTES) {
      throw new Error('This artwork is still larger than 2 MB after optimization. Use a smaller image.');
    }
    return { data, width: canvas.width, height: canvas.height, name: file.name.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, 200) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function readProjectFile(file) {
  if (file.size > MAX_PROJECT_BYTES) throw new Error('Project files must be smaller than 20 MB.');
  const project = parseProject(await file.text());
  serializeProject(project);
  const assets = [...project.cards.map(card => card.art), project.back.art, project.pack.art].filter(Boolean);
  const decoded = new Map();
  for (const asset of assets) {
    let dimensions = decoded.get(asset.data);
    if (!dimensions) {
      const image = await loadImage(asset.data);
      dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      decoded.set(asset.data, dimensions);
    }
    if (dimensions.width !== asset.width || dimensions.height !== asset.height) {
      throw new Error(`The stored dimensions for "${asset.name}" do not match its image. This project was not imported.`);
    }
  }
  return project;
}

export function fileName(name) {
  return (name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'card-studio');
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text, name, type = 'application/json') {
  downloadBlob(new Blob([text], { type }), name);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function setPngDpi(bytes, dpi) {
  if (![300, 600].includes(dpi)) throw new Error('PNG export supports 300 or 600 DPI.');
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((byte, index) => bytes[index] === byte)) throw new Error('The browser returned an invalid PNG.');
  const chunks = [bytes.slice(0, 8)];
  const density = new Uint8Array(21);
  const densityView = new DataView(density.buffer);
  densityView.setUint32(0, 9);
  density.set([112, 72, 89, 115], 4);
  densityView.setUint32(8, Math.round(dpi / 0.0254));
  densityView.setUint32(12, Math.round(dpi / 0.0254));
  density[16] = 1;
  densityView.setUint32(17, crc32(density.subarray(4, 17)));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let ended = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + length + 12;
    if (end > bytes.length) throw new Error('The browser returned an incomplete PNG.');
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type !== 'pHYs') chunks.push(bytes.slice(offset, end));
    if (type === 'IHDR') chunks.push(density);
    offset = end;
    if (type === 'IEND') {
      ended = true;
      break;
    }
  }
  if (!ended) throw new Error('The browser returned an incomplete PNG.');
  const result = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  let cursor = 0;
  for (const chunk of chunks) {
    result.set(chunk, cursor);
    cursor += chunk.length;
  }
  return result;
}

export async function downloadPng(svg, { width, height, dpi, name }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * dpi);
  canvas.height = Math.round(height * dpi);
  const svgDocument = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (svgDocument.querySelector('parsererror')) throw new Error('The card could not be converted to an image.');
  svgDocument.documentElement.setAttribute('width', String(canvas.width));
  svgDocument.documentElement.setAttribute('height', String(canvas.height));
  const source = new XMLSerializer().serializeToString(svgDocument.documentElement);
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not create the export canvas.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG export failed. Try the SVG download instead.')), 'image/png');
  });
  const bytes = setPngDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
  downloadBlob(new Blob([bytes], { type: 'image/png' }), name);
}
