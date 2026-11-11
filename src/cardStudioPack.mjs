import { getPackLayout, PAPER_SIZES } from './cardStudioModel.mjs';
import { wrapText } from './cardStudioRender.mjs';

const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[character]));

function textLines(text, x, y, width, size, { fill = '#f5f0d7', weight = 400, spacing = 0, anchor = 'start' } = {}) {
  return wrapText(text, width, size, weight).map((line, index) =>
    `<text x="${x}" y="${y + index * size * 1.3}" fill="${fill}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" text-anchor="${anchor}">${escape(line)}</text>`,
  ).join('');
}

function packPanel(pack, width, height, front) {
  const center = width / 2;
  const titleSize = pack.name.length > 22 ? 46 : 66;
  const title = textLines(pack.name, center, front ? height * 0.2 : 125, width - 100, titleSize, { weight: 700, anchor: 'middle' });
  const image = pack.art && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(pack.art.data)
    ? `<image href="${escape(pack.art.data)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/><rect width="${width}" height="${height}" fill="#071d20" opacity=".58"/>`
    : '';
  const stars = Array.from({ length: 28 }, (_, index) => {
    const x = 20 + ((index * 157) % Math.floor(width - 40));
    const y = 30 + ((index * 227) % Math.floor(height - 60));
    return `<circle cx="${x}" cy="${y}" r="${index % 4 === 0 ? 2.4 : 1.3}" fill="#e2e8c1" opacity=".4"/>`;
  }).join('');
  const centerArt = front
    ? `<g transform="translate(${center} ${height * 0.5})"><circle r="160" fill="none" stroke="#d4dab1" stroke-width="1.5" opacity=".65"/><circle r="145" fill="none" stroke="#d4dab1" stroke-width="1" stroke-dasharray="2 13" opacity=".6"/><path d="M0-110 26-26 110 0 26 26 0 110-26 26-110 0-26-26Z" fill="#e2ddaf"/><path d="M0-65 16-16 65 0 16 16 0 65-16 16-65 0-16-16Z" fill="${escape(pack.color)}"/><circle r="9" fill="#e2ddaf"/></g>`
    : `<g transform="translate(${center} ${height * 0.39})"><path d="M0-50 13-13 50 0 13 13 0 50-13 13-50 0-13-13Z" fill="#d4dab1"/></g>`;
  const description = front
    ? textLines(pack.subtitle, center, height * 0.76, width - 100, 25, { anchor: 'middle' })
    : textLines('A custom collection, built by you. Open carefully. Keep a little wonder.', center, height * 0.52, width - 140, 27, { anchor: 'middle' });
  const footer = front
    ? `${textLines(pack.series, center, height - 122, width - 100, 22, { anchor: 'middle' })}<text x="${center}" y="${height - 62}" fill="#e2ddaf" font-size="26" font-family="Arial, sans-serif" text-anchor="middle" font-weight="700">${pack.cardCount} ORIGINAL CARDS</text>`
    : `<path d="M60 ${height - 155}H${width - 60}" stroke="#d4dab1" opacity=".4"/><text x="${center}" y="${height - 108}" fill="#d4dab1" font-size="19" font-family="Arial, sans-serif" text-anchor="middle">MADE, NOT MASS-PRODUCED.</text><text x="${center}" y="${height - 65}" fill="#d4dab1" font-size="15" font-family="Arial, sans-serif" text-anchor="middle">CUSTOM / NOT AN OFFICIAL PRODUCT</text>`;
  return `<rect width="${width}" height="${height}" fill="${escape(pack.color)}"/>${image}${stars}<rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="7" fill="none" stroke="#d4dab1" stroke-width="1.5" opacity=".5"/>${title}${centerArt}${description}${footer}`;
}

export function getPackPlacement(pack, settings) {
  const net = getPackLayout(pack);
  const paper = PAPER_SIZES[settings.paper];
  if (!paper) throw new Error('Choose a supported paper size.');
  const width = settings.orientation === 'landscape' ? paper.height : paper.width;
  const height = settings.orientation === 'landscape' ? paper.width : paper.height;
  if (net.width > width - settings.margin * 2 + 1e-8 || net.height > height - settings.margin * 2 + 1e-8) {
    throw new Error('This wrapper does not fit the selected paper and margins at actual size. Try landscape, reduce the stack size or clearance, or choose smaller margins.');
  }
  return { width, height, x: (width - net.width) / 2, y: (height - net.height) / 2, net };
}

export function renderPackSvg(pack, { guides = pack.showGuides, frontOnly = false } = {}) {
  const net = getPackLayout(pack);
  const bodyWidth = net.bodyWidth * 300;
  const bodyHeight = net.bodyHeight * 300;
  if (frontOnly) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${net.bodyWidth}in" height="${net.bodyHeight}in" viewBox="0 0 ${bodyWidth} ${bodyHeight}">${packPanel(pack, bodyWidth, bodyHeight, true)}</svg>`;
  }
  const width = net.width * 300;
  const height = net.height * 300;
  const seal = net.seal * 300;
  const panels = net.panels.map(panel => {
    const panelWidth = panel.width * 300;
    const x = panel.x * 300;
    if (panel.id === 'glue') {
      return `<rect x="${x}" width="${panelWidth}" height="${height}" fill="#f3efdf"/>${guides ? `<rect x="${x}" width="${panelWidth}" height="${height}" fill="url(#glue-hatch)"/><text transform="translate(${x + panelWidth / 2} ${height / 2}) rotate(-90)" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#68675b">GLUE TAB - KEEP INK-FREE</text>` : ''}`;
    }
    if (panel.id === 'front' || panel.id === 'back') {
      return `<svg x="${x}" y="${seal}" width="${panelWidth}" height="${bodyHeight}" viewBox="0 0 ${panelWidth} ${bodyHeight}">${packPanel(pack, panelWidth, bodyHeight, panel.id === 'front')}</svg>`;
    }
    return `<rect x="${x}" y="${seal}" width="${panelWidth}" height="${bodyHeight}" fill="#071d20" opacity=".35"/>`;
  }).join('');
  const seams = [0, height - seal].map(y =>
    `<rect x="${net.glue * 300}" y="${y}" width="${width - net.glue * 300}" height="${seal}" fill="url(#seal-lines)"/>${guides ? `<text x="${(width + net.glue * 300) / 2}" y="${y + seal / 2 + 7}" fill="#e3e3ce" font-family="Arial, sans-serif" font-size="20" text-anchor="middle">FOLD &amp; SEAL</text>` : ''}`,
  ).join('');
  const lines = guides
    ? `<g fill="none" stroke="#7ee0ea" stroke-width="2" stroke-dasharray="12 9">${net.folds.map(x => `<path d="M${x * 300} 0V${height}"/>`).join('')}<path d="M0 ${seal}H${width}M0 ${height - seal}H${width}"/></g><rect width="${width}" height="${height}" fill="none" stroke="#e882aa" stroke-width="4"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${net.width}in" height="${net.height}in" viewBox="0 0 ${width} ${height}"><defs><pattern id="glue-hatch" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M-5 5 5-5M0 18 18 0M13 23 23 13" stroke="#d6d3c5" stroke-width="2"/></pattern><pattern id="seal-lines" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0V12" stroke="#e3e3ce" opacity=".15" stroke-width="2"/></pattern></defs><rect width="${width}" height="${height}" fill="${escape(pack.color)}"/>${panels}${seams}${lines}</svg>`;
}
