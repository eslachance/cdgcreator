/**
 * CDG (CD+Graphics) File Generator
 *
 * Based on specifications from:
 * - https://jbum.com/cdg_revealed.html
 * - https://goughlui.com/2019/03/31/tech-flashback-the-cdgraphics-format-cdg/
 */
import sharp from 'sharp';
const CDG_COMMAND = 0x09;
const CDG_WIDTH = 300;
const CDG_HEIGHT = 216;
const PACKETS_PER_SECOND = 300;
const TILES_ACROSS = 50;
const TILES_DOWN = 18;
const CHAR_TILE_WIDTH = 2;
const CHAR_TILE_HEIGHT = 2;
const MAX_CHARS_PER_LINE = Math.floor((TILES_ACROSS - 4) / CHAR_TILE_WIDTH);
const CDG_INST_MEMORY_PRESET = 1;
const CDG_INST_TILE_BLOCK = 6;
const CDG_INST_LOAD_CLUT_LOW = 30;
const CDG_INST_LOAD_CLUT_HIGH = 31;
const FONT_6x12 = {
    ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    '!': [0x00, 0x0C, 0x1E, 0x1E, 0x1E, 0x0C, 0x0C, 0x00, 0x0C, 0x0C, 0x00, 0x00],
    '"': [0x00, 0x36, 0x36, 0x36, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    '#': [0x00, 0x36, 0x36, 0x3F, 0x36, 0x3F, 0x36, 0x36, 0x00, 0x00, 0x00, 0x00],
    '$': [0x0C, 0x1E, 0x30, 0x1C, 0x06, 0x3C, 0x0C, 0x00, 0x00, 0x00, 0x00, 0x00],
    '%': [0x00, 0x33, 0x36, 0x0C, 0x18, 0x36, 0x33, 0x00, 0x00, 0x00, 0x00, 0x00],
    '&': [0x00, 0x1C, 0x36, 0x1C, 0x3B, 0x36, 0x1F, 0x00, 0x00, 0x00, 0x00, 0x00],
    "'": [0x00, 0x0C, 0x0C, 0x18, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    '(': [0x00, 0x06, 0x0C, 0x18, 0x18, 0x18, 0x0C, 0x06, 0x00, 0x00, 0x00, 0x00],
    ')': [0x00, 0x18, 0x0C, 0x06, 0x06, 0x06, 0x0C, 0x18, 0x00, 0x00, 0x00, 0x00],
    '*': [0x00, 0x00, 0x36, 0x1C, 0x3F, 0x1C, 0x36, 0x00, 0x00, 0x00, 0x00, 0x00],
    '+': [0x00, 0x00, 0x0C, 0x0C, 0x3F, 0x0C, 0x0C, 0x00, 0x00, 0x00, 0x00, 0x00],
    ',': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C, 0x18, 0x00, 0x00, 0x00],
    '-': [0x00, 0x00, 0x00, 0x00, 0x3F, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C, 0x00, 0x00, 0x00, 0x00],
    '/': [0x00, 0x03, 0x06, 0x0C, 0x18, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    '0': [0x00, 0x1E, 0x33, 0x37, 0x3F, 0x3B, 0x33, 0x1E, 0x00, 0x00, 0x00, 0x00],
    '1': [0x00, 0x0C, 0x1C, 0x0C, 0x0C, 0x0C, 0x0C, 0x3F, 0x00, 0x00, 0x00, 0x00],
    '2': [0x00, 0x1E, 0x33, 0x03, 0x0E, 0x18, 0x33, 0x3F, 0x00, 0x00, 0x00, 0x00],
    '3': [0x00, 0x1E, 0x33, 0x03, 0x0E, 0x03, 0x33, 0x1E, 0x00, 0x00, 0x00, 0x00],
    '4': [0x00, 0x06, 0x0E, 0x16, 0x26, 0x3F, 0x06, 0x06, 0x00, 0x00, 0x00, 0x00],
    '5': [0x00, 0x3F, 0x30, 0x3E, 0x03, 0x03, 0x33, 0x1E, 0x00, 0x00, 0x00, 0x00],
    '6': [0x00, 0x0E, 0x18, 0x30, 0x3E, 0x33, 0x33, 0x1E, 0x00, 0x00, 0x00, 0x00],
    '7': [0x00, 0x3F, 0x33, 0x03, 0x06, 0x0C, 0x0C, 0x0C, 0x00, 0x00, 0x00, 0x00],
    '8': [0x00, 0x1E, 0x33, 0x33, 0x1E, 0x33, 0x33, 0x1E, 0x00, 0x00, 0x00, 0x00],
    '9': [0x00, 0x1E, 0x33, 0x33, 0x1F, 0x03, 0x06, 0x1C, 0x00, 0x00, 0x00, 0x00],
    ':': [0x00, 0x00, 0x0C, 0x0C, 0x00, 0x00, 0x0C, 0x0C, 0x00, 0x00, 0x00, 0x00],
    ';': [0x00, 0x00, 0x0C, 0x0C, 0x00, 0x00, 0x0C, 0x0C, 0x18, 0x00, 0x00, 0x00],
    '<': [0x00, 0x06, 0x0C, 0x18, 0x30, 0x18, 0x0C, 0x06, 0x00, 0x00, 0x00, 0x00],
    '=': [0x00, 0x00, 0x00, 0x3F, 0x00, 0x3F, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    '>': [0x00, 0x18, 0x0C, 0x06, 0x03, 0x06, 0x0C, 0x18, 0x00, 0x00, 0x00, 0x00],
    '?': [0x00, 0x1E, 0x33, 0x03, 0x06, 0x0C, 0x00, 0x0C, 0x00, 0x00, 0x00, 0x00],
    '@': [0x00, 0x1E, 0x33, 0x3B, 0x3B, 0x3B, 0x30, 0x1E, 0x00, 0x00, 0x00, 0x00],
    'A': [0x00, 0x0C, 0x1E, 0x33, 0x33, 0x3F, 0x33, 0x33, 0x00, 0x00, 0x00, 0x00],
    'B': [0x00, 0x3E, 0x33, 0x33, 0x3E, 0x33, 0x33, 0x3E, 0x00, 0x00, 0x00, 0x00],
    'C': [0x00, 0x1E, 0x33, 0x30, 0x30, 0x30, 0x33, 0x1E, 0x00, 0x00, 0x00, 0x00],
    'D': [0x00, 0x3C, 0x36, 0x33, 0x33, 0x33, 0x36, 0x3C, 0x00, 0x00, 0x00, 0x00],
    'E': [0x00, 0x3F, 0x30, 0x30, 0x3E, 0x30, 0x30, 0x3F, 0x00, 0x00, 0x00, 0x00],
    'F': [0x00, 0x3F, 0x30, 0x30, 0x3E, 0x30, 0x30, 0x30, 0x00, 0x00, 0x00, 0x00],
    'G': [0x00, 0x1E, 0x33, 0x30, 0x37, 0x33, 0x33, 0x1F, 0x00, 0x00, 0x00, 0x00],
    'H': [0x00, 0x33, 0x33, 0x33, 0x3F, 0x33, 0x33, 0x33, 0x00, 0x00, 0x00, 0x00],
    'I': [0x00, 0x3F, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x3F, 0x00, 0x00, 0x00, 0x00],
    'J': [0x00, 0x0F, 0x06, 0x06, 0x06, 0x06, 0x36, 0x1C, 0x00, 0x00, 0x00, 0x00],
    'K': [0x00, 0x33, 0x36, 0x3C, 0x38, 0x3C, 0x36, 0x33, 0x00, 0x00, 0x00, 0x00],
    'L': [0x00, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x3F, 0x00, 0x00, 0x00, 0x00],
    'M': [0x00, 0x33, 0x3F, 0x3F, 0x3F, 0x33, 0x33, 0x33, 0x00, 0x00, 0x00, 0x00],
    'N': [0x00, 0x33, 0x3B, 0x3F, 0x37, 0x33, 0x33, 0x33, 0x00, 0x00, 0x00, 0x00],
    'O': [0x00, 0x1E, 0x33, 0x33, 0x33, 0x33, 0x33, 0x1E, 0x00, 0x00, 0x00, 0x00],
    'P': [0x00, 0x3E, 0x33, 0x33, 0x3E, 0x30, 0x30, 0x30, 0x00, 0x00, 0x00, 0x00],
    'Q': [0x00, 0x1E, 0x33, 0x33, 0x33, 0x3B, 0x1E, 0x07, 0x00, 0x00, 0x00, 0x00],
    'R': [0x00, 0x3E, 0x33, 0x33, 0x3E, 0x36, 0x33, 0x33, 0x00, 0x00, 0x00, 0x00],
    'S': [0x00, 0x1E, 0x33, 0x30, 0x1E, 0x03, 0x33, 0x1E, 0x00, 0x00, 0x00, 0x00],
    'T': [0x00, 0x3F, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x00, 0x00, 0x00, 0x00],
    'U': [0x00, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x1E, 0x00, 0x00, 0x00, 0x00],
    'V': [0x00, 0x33, 0x33, 0x33, 0x33, 0x1E, 0x0C, 0x0C, 0x00, 0x00, 0x00, 0x00],
    'W': [0x00, 0x33, 0x33, 0x33, 0x3F, 0x3F, 0x3F, 0x33, 0x00, 0x00, 0x00, 0x00],
    'X': [0x00, 0x33, 0x33, 0x1E, 0x0C, 0x1E, 0x33, 0x33, 0x00, 0x00, 0x00, 0x00],
    'Y': [0x00, 0x33, 0x33, 0x1E, 0x0C, 0x0C, 0x0C, 0x0C, 0x00, 0x00, 0x00, 0x00],
    'Z': [0x00, 0x3F, 0x03, 0x06, 0x0C, 0x18, 0x30, 0x3F, 0x00, 0x00, 0x00, 0x00],
    '[': [0x00, 0x1E, 0x18, 0x18, 0x18, 0x18, 0x18, 0x1E, 0x00, 0x00, 0x00, 0x00],
    '\\': [0x00, 0x30, 0x18, 0x0C, 0x06, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    ']': [0x00, 0x1E, 0x06, 0x06, 0x06, 0x06, 0x06, 0x1E, 0x00, 0x00, 0x00, 0x00],
    '^': [0x00, 0x0C, 0x1E, 0x33, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    '_': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3F, 0x00, 0x00, 0x00, 0x00],
    '`': [0x00, 0x18, 0x0C, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    'a': [0x00, 0x00, 0x00, 0x1E, 0x03, 0x1F, 0x33, 0x1F, 0x00, 0x00, 0x00, 0x00],
    'b': [0x00, 0x30, 0x30, 0x3E, 0x33, 0x33, 0x33, 0x3E, 0x00, 0x00, 0x00, 0x00],
    'c': [0x00, 0x00, 0x00, 0x1E, 0x33, 0x30, 0x33, 0x1E, 0x00, 0x00, 0x00, 0x00],
    'd': [0x00, 0x03, 0x03, 0x1F, 0x33, 0x33, 0x33, 0x1F, 0x00, 0x00, 0x00, 0x00],
    'e': [0x00, 0x00, 0x00, 0x1E, 0x33, 0x3F, 0x30, 0x1E, 0x00, 0x00, 0x00, 0x00],
    'f': [0x00, 0x0E, 0x1B, 0x18, 0x3E, 0x18, 0x18, 0x18, 0x00, 0x00, 0x00, 0x00],
    'g': [0x00, 0x00, 0x00, 0x1F, 0x33, 0x33, 0x1F, 0x03, 0x1E, 0x00, 0x00, 0x00],
    'h': [0x00, 0x30, 0x30, 0x3E, 0x33, 0x33, 0x33, 0x33, 0x00, 0x00, 0x00, 0x00],
    'i': [0x00, 0x0C, 0x00, 0x1C, 0x0C, 0x0C, 0x0C, 0x3F, 0x00, 0x00, 0x00, 0x00],
    'j': [0x00, 0x06, 0x00, 0x0E, 0x06, 0x06, 0x36, 0x36, 0x1C, 0x00, 0x00, 0x00],
    'k': [0x00, 0x30, 0x30, 0x33, 0x36, 0x3C, 0x36, 0x33, 0x00, 0x00, 0x00, 0x00],
    'l': [0x00, 0x1C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x3F, 0x00, 0x00, 0x00, 0x00],
    'm': [0x00, 0x00, 0x00, 0x36, 0x3F, 0x3F, 0x33, 0x33, 0x00, 0x00, 0x00, 0x00],
    'n': [0x00, 0x00, 0x00, 0x3E, 0x33, 0x33, 0x33, 0x33, 0x00, 0x00, 0x00, 0x00],
    'o': [0x00, 0x00, 0x00, 0x1E, 0x33, 0x33, 0x33, 0x1E, 0x00, 0x00, 0x00, 0x00],
    'p': [0x00, 0x00, 0x00, 0x3E, 0x33, 0x33, 0x3E, 0x30, 0x30, 0x00, 0x00, 0x00],
    'q': [0x00, 0x00, 0x00, 0x1F, 0x33, 0x33, 0x1F, 0x03, 0x03, 0x00, 0x00, 0x00],
    'r': [0x00, 0x00, 0x00, 0x3B, 0x36, 0x30, 0x30, 0x30, 0x00, 0x00, 0x00, 0x00],
    's': [0x00, 0x00, 0x00, 0x1F, 0x30, 0x1E, 0x03, 0x3E, 0x00, 0x00, 0x00, 0x00],
    't': [0x00, 0x18, 0x18, 0x3E, 0x18, 0x18, 0x1B, 0x0E, 0x00, 0x00, 0x00, 0x00],
    'u': [0x00, 0x00, 0x00, 0x33, 0x33, 0x33, 0x33, 0x1F, 0x00, 0x00, 0x00, 0x00],
    'v': [0x00, 0x00, 0x00, 0x33, 0x33, 0x33, 0x1E, 0x0C, 0x00, 0x00, 0x00, 0x00],
    'w': [0x00, 0x00, 0x00, 0x33, 0x33, 0x3F, 0x3F, 0x36, 0x00, 0x00, 0x00, 0x00],
    'x': [0x00, 0x00, 0x00, 0x33, 0x1E, 0x0C, 0x1E, 0x33, 0x00, 0x00, 0x00, 0x00],
    'y': [0x00, 0x00, 0x00, 0x33, 0x33, 0x33, 0x1F, 0x03, 0x1E, 0x00, 0x00, 0x00],
    'z': [0x00, 0x00, 0x00, 0x3F, 0x06, 0x0C, 0x18, 0x3F, 0x00, 0x00, 0x00, 0x00],
    '{': [0x00, 0x07, 0x0C, 0x0C, 0x18, 0x0C, 0x0C, 0x07, 0x00, 0x00, 0x00, 0x00],
    '|': [0x00, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x00, 0x00, 0x00, 0x00],
    '}': [0x00, 0x38, 0x0C, 0x0C, 0x06, 0x0C, 0x0C, 0x38, 0x00, 0x00, 0x00, 0x00],
    '~': [0x00, 0x00, 0x00, 0x1B, 0x36, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    '♪': [0x00, 0x06, 0x07, 0x06, 0x06, 0x3E, 0x3E, 0x1C, 0x00, 0x00, 0x00, 0x00],
};
function cdgColorToHex(color) {
    const toByte = (value) => Math.min(255, Math.max(0, value * 17));
    const r = toByte(color.r).toString(16).padStart(2, '0');
    const g = toByte(color.g).toString(16).padStart(2, '0');
    const b = toByte(color.b).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}
function cdgColorDistance(c1, c2) {
    const dr = (c1.r - c2.r) * 17;
    const dg = (c1.g - c2.g) * 17;
    const db = (c1.b - c2.b) * 17;
    return dr * dr + dg * dg + db * db;
}
function findClosestColorIndex(color, palette) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < palette.length; i++) {
        const dist = cdgColorDistance(color, palette[i]);
        if (dist < bestDistance) {
            bestDistance = dist;
            bestIndex = i;
        }
    }
    return bestIndex;
}
function rgbToCdgColor(r, g, b) {
    return {
        r: Math.round(r / 17),
        g: Math.round(g / 17),
        b: Math.round(b / 17),
    };
}
async function renderSvgToRawBuffer(svg) {
    return sharp(Buffer.from(svg))
        .resize(CDG_WIDTH, CDG_HEIGHT, { kernel: sharp.kernel.nearest })
        .removeAlpha()
        .toColorspace('srgb')
        .raw()
        .toBuffer();
}
async function generateTitleCardImage(text, textColor = '#FFFFFF', bgColor = '#000000') {
    const lines = text.split('\n').filter(l => l.trim());
    const lineHeight = lines.length > 2 ? 36 : 44;
    const fontSize = lines.length > 2 ? 32 : 38;
    const totalTextHeight = lines.length * lineHeight;
    const startY = Math.floor((CDG_HEIGHT - totalTextHeight) / 2) + fontSize * 0.8;
    const textElements = lines.map((line, idx) => {
        const y = startY + idx * lineHeight;
        return `<text x="50%" y="${y}" text-anchor="middle" 
      font-family="Arial Black, Arial, Helvetica, sans-serif" 
      font-size="${fontSize}" 
      font-weight="900"
      fill="${textColor}"
      stroke="${bgColor}"
      stroke-width="2"
      paint-order="stroke"
      shape-rendering="crispEdges">${escapeXml(line)}</text>`;
    }).join('\n');
    const svg = `<svg width="${CDG_WIDTH}" height="${CDG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${bgColor}"/>
    <rect x="10" y="10" width="${CDG_WIDTH - 20}" height="${CDG_HEIGHT - 20}" 
      fill="none" stroke="${textColor}" stroke-width="3" rx="8"/>
    <rect x="16" y="16" width="${CDG_WIDTH - 32}" height="${CDG_HEIGHT - 32}" 
      fill="none" stroke="${textColor}" stroke-width="1" rx="6"/>
    ${textElements}
  </svg>`;
    return renderSvgToRawBuffer(svg);
}
function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
async function imageToTiles(imageBuffer, fixedPalette) {
    const palette = fixedPalette
        ? fixedPalette.slice(0, 16).map((color) => ({ ...color }))
        : [{ r: 0, g: 0, b: 0 }];
    const colorIndexMap = new Map();
    for (let i = 0; i < palette.length; i++) {
        const color = palette[i];
        colorIndexMap.set(`${color.r}-${color.g}-${color.b}`, i);
    }
    if (!fixedPalette) {
        colorIndexMap.set('0-0-0', 0);
    }
    const indexedPixels = [];
    for (let y = 0; y < CDG_HEIGHT; y++) {
        indexedPixels[y] = [];
        for (let x = 0; x < CDG_WIDTH; x++) {
            const idx = (y * CDG_WIDTH + x) * 3;
            const r = imageBuffer[idx] ?? 0;
            const g = imageBuffer[idx + 1] ?? 0;
            const b = imageBuffer[idx + 2] ?? 0;
            const cdgColor = rgbToCdgColor(r, g, b);
            const colorKey = `${cdgColor.r}-${cdgColor.g}-${cdgColor.b}`;
            let colorIndex;
            if (colorIndexMap.has(colorKey)) {
                colorIndex = colorIndexMap.get(colorKey);
            }
            else if (!fixedPalette && palette.length < 16) {
                colorIndex = palette.length;
                palette.push(cdgColor);
                colorIndexMap.set(colorKey, colorIndex);
            }
            else {
                colorIndex = findClosestColorIndex(cdgColor, palette);
            }
            indexedPixels[y][x] = colorIndex;
        }
    }
    while (palette.length < 16) {
        palette.push({ r: 0, g: 0, b: 0 });
    }
    const tiles = [];
    for (let tileRow = 0; tileRow < TILES_DOWN; tileRow++) {
        for (let tileCol = 0; tileCol < TILES_ACROSS; tileCol++) {
            const colorCounts = new Map();
            for (let py = 0; py < 12; py++) {
                const y = tileRow * 12 + py;
                for (let px = 0; px < 6; px++) {
                    const x = tileCol * 6 + px;
                    const colorIdx = indexedPixels[y]?.[x] ?? 0;
                    colorCounts.set(colorIdx, (colorCounts.get(colorIdx) ?? 0) + 1);
                }
            }
            const sortedColors = Array.from(colorCounts.entries())
                .sort((a, b) => b[1] - a[1]);
            const color0 = sortedColors[0]?.[0] ?? 0;
            const color1 = sortedColors[1]?.[0] ?? color0;
            const tilePixels = [];
            for (let py = 0; py < 12; py++) {
                const y = tileRow * 12 + py;
                let rowBits = 0;
                for (let px = 0; px < 6; px++) {
                    const x = tileCol * 6 + px;
                    const colorIdx = indexedPixels[y]?.[x] ?? 0;
                    if (colorIdx !== color0) {
                        rowBits |= (1 << (5 - px));
                    }
                }
                tilePixels.push(rowBits);
            }
            tiles.push({
                row: tileRow,
                col: tileCol,
                color0,
                color1,
                pixels: tilePixels,
            });
        }
    }
    return { tiles, colors: palette };
}
class CDGGenerator {
    packets = [];
    screenState = new Map();
    createPacket(instruction, data) {
        const packet = Buffer.alloc(24);
        packet[0] = CDG_COMMAND;
        packet[1] = instruction & 0x3F;
        for (let i = 0; i < 16 && i < data.length; i++) {
            packet[4 + i] = data[i] & 0x3F;
        }
        return packet;
    }
    createEmptyPacket() {
        return Buffer.alloc(24);
    }
    createColorTablePackets(colors) {
        const packets = [];
        const lowData = [];
        for (let i = 0; i < 8; i++) {
            const color = colors[i] || { r: 0, g: 0, b: 0 };
            lowData.push((color.r << 2) | ((color.g >> 2) & 0x03));
            lowData.push(((color.g & 0x03) << 4) | color.b);
        }
        packets.push(this.createPacket(CDG_INST_LOAD_CLUT_LOW, lowData));
        const highData = [];
        for (let i = 8; i < 16; i++) {
            const color = colors[i] || { r: 0, g: 0, b: 0 };
            highData.push((color.r << 2) | ((color.g >> 2) & 0x03));
            highData.push(((color.g & 0x03) << 4) | color.b);
        }
        packets.push(this.createPacket(CDG_INST_LOAD_CLUT_HIGH, highData));
        return packets;
    }
    createMemoryPresetPackets(colorIndex) {
        const packets = [];
        for (let i = 0; i < 16; i++) {
            const data = [colorIndex & 0x0F, i, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            packets.push(this.createPacket(CDG_INST_MEMORY_PRESET, data));
        }
        this.screenState.clear();
        return packets;
    }
    createTilePacket(row, col, color0, color1, pixels) {
        if (row < 0 || row >= TILES_DOWN || col < 0 || col >= TILES_ACROSS)
            return null;
        const key = `${row},${col}`;
        const pixelsStr = pixels.join(',');
        const currentState = this.screenState.get(key);
        if (currentState &&
            currentState.color0 === color0 &&
            currentState.color1 === color1 &&
            currentState.pixels === pixelsStr) {
            return null;
        }
        this.screenState.set(key, { color0, color1, pixels: pixelsStr });
        const data = [
            color0 & 0x0F,
            color1 & 0x0F,
            row & 0x1F,
            col & 0x3F,
            ...pixels.slice(0, 12).map(p => p & 0x3F)
        ];
        return this.createPacket(CDG_INST_TILE_BLOCK, data);
    }
    expandFontRowToTwoTiles(byte) {
        const b = byte & 0x3F;
        let left = 0;
        let right = 0;
        for (let i = 5; i >= 3; i--) {
            const bit = (b >> i) & 1;
            left = ((left << 1) | bit) << 1 | bit;
        }
        for (let i = 2; i >= 0; i--) {
            const bit = (b >> i) & 1;
            right = ((right << 1) | bit) << 1 | bit;
        }
        return [left & 0x3F, right & 0x3F];
    }
    getScaledCharTiles(char, tileCol, tileRow, fgColor, bgColor) {
        const baseFontData = FONT_6x12[char] || FONT_6x12[char.toUpperCase()] || FONT_6x12[' '];
        const tiles = [];
        for (let tileY = 0; tileY < CHAR_TILE_HEIGHT; tileY++) {
            for (let tileX = 0; tileX < CHAR_TILE_WIDTH; tileX++) {
                const pixels = [];
                for (let py = 0; py < 12; py++) {
                    const fontRowIdx = Math.floor(py / 2) + tileY * 6;
                    const fontByte = baseFontData[fontRowIdx] & 0x3F;
                    const [left, right] = this.expandFontRowToTwoTiles(fontByte);
                    pixels.push(tileX === 0 ? left : right);
                }
                tiles.push({
                    row: tileRow + tileY,
                    col: tileCol + tileX,
                    color0: bgColor,
                    color1: fgColor,
                    pixels,
                });
            }
        }
        return tiles;
    }
    getCharTileWidth() {
        return CHAR_TILE_WIDTH;
    }
    getCharTileHeight() {
        return CHAR_TILE_HEIGHT;
    }
    getLineStartRow(lineNumber, linesCount) {
        const usableRows = TILES_DOWN - 2;
        const rowsPerLine = Math.floor(usableRows / linesCount);
        return 1 + lineNumber * rowsPerLine + Math.floor((rowsPerLine - CHAR_TILE_HEIGHT) / 2);
    }
    getLineStartCol(text) {
        const displayText = text.length > MAX_CHARS_PER_LINE
            ? text.substring(0, MAX_CHARS_PER_LINE)
            : text;
        const textTileWidth = displayText.length * CHAR_TILE_WIDTH;
        return Math.max(1, Math.floor((TILES_ACROSS - textTileWidth) / 2));
    }
    getLineHighlightChars(lyric, time) {
        let highlightProgress = 0;
        if (time >= lyric.highlightStartTime && time <= lyric.highlightEndTime) {
            highlightProgress =
                (time - lyric.highlightStartTime) / (lyric.highlightEndTime - lyric.highlightStartTime);
        }
        else if (time > lyric.highlightEndTime) {
            highlightProgress = 1;
        }
        return Math.floor(lyric.text.length * highlightProgress);
    }
    getLineTiles(text, lineNumber, linesCount, baseColor, highlightColor, bgColor, highlightChars) {
        const tiles = [];
        const startRow = this.getLineStartRow(lineNumber, linesCount);
        const displayText = text.toUpperCase().length > MAX_CHARS_PER_LINE
            ? text.toUpperCase().substring(0, MAX_CHARS_PER_LINE)
            : text.toUpperCase();
        const adjustedHighlightChars = Math.min(highlightChars, displayText.length);
        const startCol = this.getLineStartCol(displayText);
        for (let i = 0; i < displayText.length; i++) {
            const color = i < adjustedHighlightChars ? highlightColor : baseColor;
            const col = startCol + i * CHAR_TILE_WIDTH;
            if (col + CHAR_TILE_WIDTH < TILES_ACROSS - 1) {
                tiles.push(...this.getScaledCharTiles(displayText[i], col, startRow, color, bgColor));
            }
        }
        return tiles;
    }
    getCharTilesAtIndex(text, charIndex, lineNumber, linesCount, fgColor, bgColor) {
        const displayText = text.toUpperCase().length > MAX_CHARS_PER_LINE
            ? text.toUpperCase().substring(0, MAX_CHARS_PER_LINE)
            : text.toUpperCase();
        if (charIndex < 0 || charIndex >= displayText.length)
            return [];
        const startRow = this.getLineStartRow(lineNumber, linesCount);
        const startCol = this.getLineStartCol(displayText) + charIndex * CHAR_TILE_WIDTH;
        if (startCol + CHAR_TILE_WIDTH >= TILES_ACROSS - 1)
            return [];
        return this.getScaledCharTiles(displayText[charIndex], startCol, startRow, fgColor, bgColor);
    }
    getTextCenteredTiles(text, centerRow, fgColor, bgColor) {
        const displayText = text.length > MAX_CHARS_PER_LINE ? text.substring(0, MAX_CHARS_PER_LINE) : text;
        const startCol = this.getLineStartCol(displayText);
        const tiles = [];
        for (let i = 0; i < displayText.length; i++) {
            const col = startCol + i * CHAR_TILE_WIDTH;
            if (col + CHAR_TILE_WIDTH < TILES_ACROSS - 1) {
                tiles.push(...this.getScaledCharTiles(displayText[i], col, centerRow, fgColor, bgColor));
            }
        }
        return tiles;
    }
    getClearLineTiles(lineNumber, linesCount, bgColor) {
        const tiles = [];
        const startRow = this.getLineStartRow(lineNumber, linesCount);
        const emptyPixels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (let row = startRow; row < startRow + CHAR_TILE_HEIGHT && row < TILES_DOWN - 1; row++) {
            for (let col = 1; col < TILES_ACROSS - 1; col++) {
                tiles.push({ row, col, color0: bgColor, color1: bgColor, pixels: emptyPixels });
            }
        }
        return tiles;
    }
    getProgressBarTiles(progress, row, fgColor, bgColor) {
        const tiles = [];
        const barWidth = 36;
        const startCol = Math.floor((TILES_ACROSS - barWidth) / 2);
        const filledTiles = Math.floor(barWidth * progress);
        for (let col = 0; col < barWidth; col++) {
            const tileCol = startCol + col;
            if (col < filledTiles) {
                tiles.push({
                    row, col: tileCol, color0: bgColor, color1: fgColor,
                    pixels: [0x00, 0x00, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x00, 0x00]
                });
            }
            else if (col === filledTiles) {
                const partialProgress = (barWidth * progress) - filledTiles;
                const pixelsFilled = Math.floor(6 * partialProgress);
                const mask = pixelsFilled > 0 ? (0x3F << (6 - pixelsFilled)) & 0x3F : 0;
                tiles.push({
                    row, col: tileCol, color0: bgColor, color1: fgColor,
                    pixels: [0x00, 0x00, mask, mask, mask, mask, mask, mask, mask, mask, 0x00, 0x00]
                });
            }
            else {
                tiles.push({
                    row, col: tileCol, color0: bgColor, color1: fgColor,
                    pixels: [0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00]
                });
            }
        }
        return tiles;
    }
    writeTilesToPackets(tiles, skipEmpty = false) {
        const packets = [];
        for (const tile of tiles) {
            if (skipEmpty && tile.color0 === 0 && tile.pixels.every(p => p === 0)) {
                continue;
            }
            const packet = this.createTilePacket(tile.row, tile.col, tile.color0, tile.color1, tile.pixels);
            if (packet) {
                packets.push(packet);
            }
        }
        return packets;
    }
    detectInstrumentalSections(lyrics, duration) {
        const MIN_GAP = 5;
        const gaps = [];
        if (lyrics.length === 0)
            return gaps;
        const events = [];
        for (const lyric of lyrics) {
            events.push({ time: lyric.appearStartTime, type: 'start' });
            events.push({ time: lyric.appearEndTime, type: 'end' });
        }
        events.sort((a, b) => a.time - b.time);
        let activeCount = 0;
        let gapStart = null;
        for (const event of events) {
            if (event.type === 'start') {
                if (activeCount === 0 && gapStart !== null) {
                    const gapDuration = event.time - gapStart;
                    if (gapDuration >= MIN_GAP) {
                        gaps.push({ start: gapStart, end: event.time });
                    }
                    gapStart = null;
                }
                activeCount++;
            }
            else {
                activeCount--;
                if (activeCount === 0) {
                    gapStart = event.time;
                }
            }
        }
        if (gapStart !== null && duration - gapStart >= MIN_GAP) {
            gaps.push({ start: gapStart, end: duration });
        }
        if (lyrics.length > 0) {
            const sortedByStart = [...lyrics].sort((a, b) => a.appearStartTime - b.appearStartTime);
            const firstLyricStart = sortedByStart[0].appearStartTime;
            if (firstLyricStart >= MIN_GAP) {
                gaps.unshift({ start: 0, end: firstLyricStart });
            }
        }
        return gaps;
    }
    async generate(options, titleCardImage, endCardImage) {
        const { duration, linesCount, lyrics, titleCard, endCard, backgroundColor, preBuffer = 0, postBuffer = 0 } = options;
        const totalDuration = preBuffer + duration + postBuffer;
        const totalPackets = Math.ceil(totalDuration * PACKETS_PER_SECOND);
        const bgColor = backgroundColor || { r: 0, g: 0, b: 0 };
        const uniqueColors = new Map();
        lyrics.forEach(lyric => {
            const baseKey = `${lyric.baseColor.r}-${lyric.baseColor.g}-${lyric.baseColor.b}`;
            const highlightKey = `${lyric.highlightColor.r}-${lyric.highlightColor.g}-${lyric.highlightColor.b}`;
            uniqueColors.set(baseKey, lyric.baseColor);
            uniqueColors.set(highlightKey, lyric.highlightColor);
        });
        const colors = [bgColor];
        const colorIndexMap = new Map();
        colorIndexMap.set(`${bgColor.r}-${bgColor.g}-${bgColor.b}`, 0);
        let colorIndex = 1;
        uniqueColors.forEach((color, key) => {
            if (colorIndex < 16 && !colorIndexMap.has(key)) {
                colors.push(color);
                colorIndexMap.set(key, colorIndex);
                colorIndex++;
            }
        });
        while (colors.length < 16) {
            colors.push({ r: 0, g: 0, b: 0 });
        }
        const frameEvents = [];
        frameEvents.push({ time: 0, type: 'colorTable', data: colors });
        frameEvents.push({ time: 0.01, type: 'memoryPreset', colorIndex: 0 });
        const instrumentalSections = this.detectInstrumentalSections(lyrics, duration);
        if (titleCard?.enabled && titleCard.text && titleCardImage) {
            frameEvents.push({ time: titleCard.startTime + preBuffer, type: 'colorTable', data: titleCardImage.colors });
            frameEvents.push({ time: titleCard.startTime + preBuffer + 0.02, type: 'memoryPreset', colorIndex: 0 });
            frameEvents.push({ time: titleCard.startTime + preBuffer + 0.1, type: 'tiles', tiles: titleCardImage.tiles });
            frameEvents.push({ time: titleCard.endTime + preBuffer, type: 'colorTable', data: colors });
            frameEvents.push({ time: titleCard.endTime + preBuffer + 0.01, type: 'memoryPreset', colorIndex: 0 });
        }
        const lineState = new Map();
        let currentInstrumental = null;
        let lastProgressUpdate = -1;
        let lastActiveLineKey = '';
        const timeSlice = 1.0 / 30;
        for (let time = 0; time < duration; time += timeSlice) {
            const adjustedTime = time + preBuffer;
            const PADDING = 1;
            let inInstrumental = false;
            let instrumentalProgress = 0;
            for (const section of instrumentalSections) {
                const displayStart = section.start + PADDING;
                const displayEnd = section.end - PADDING;
                if (displayEnd > displayStart && time >= displayStart && time <= displayEnd) {
                    inInstrumental = true;
                    instrumentalProgress = (time - displayStart) / (displayEnd - displayStart);
                    if (currentInstrumental !== section) {
                        currentInstrumental = section;
                        lineState.clear();
                        lastActiveLineKey = '';
                        lastProgressUpdate = -1;
                        frameEvents.push({ time: adjustedTime, type: 'memoryPreset', colorIndex: 0 });
                        const iconRow = Math.floor(TILES_DOWN / 2) - 3;
                        const labelRow = Math.floor(TILES_DOWN / 2) - 1;
                        frameEvents.push({
                            time: adjustedTime + 0.05,
                            type: 'tiles',
                            tiles: this.getTextCenteredTiles('♪', iconRow, 1, 0),
                        });
                        frameEvents.push({
                            time: adjustedTime + 0.08,
                            type: 'tiles',
                            tiles: this.getTextCenteredTiles('INST', labelRow, 1, 0),
                        });
                    }
                    const progressStep = Math.floor(instrumentalProgress * 20);
                    if (progressStep !== lastProgressUpdate) {
                        const progressRow = Math.floor(TILES_DOWN / 2) + 2;
                        const progressTiles = this.getProgressBarTiles(instrumentalProgress, progressRow, 1, 0);
                        frameEvents.push({ time: adjustedTime, type: 'tiles', tiles: progressTiles });
                        lastProgressUpdate = progressStep;
                    }
                    break;
                }
            }
            if (!inInstrumental) {
                if (currentInstrumental !== null) {
                    frameEvents.push({ time: adjustedTime, type: 'memoryPreset', colorIndex: 0 });
                    currentInstrumental = null;
                    lastProgressUpdate = -1;
                    lineState.clear();
                    lastActiveLineKey = '';
                }
                const activeLyrics = lyrics
                    .filter((l) => time >= l.appearStartTime && time <= l.appearEndTime)
                    .sort((a, b) => a.lineNumber - b.lineNumber);
                const activeLineKey = activeLyrics
                    .map((lyric) => `${lyric.lineNumber}:${lyric.text}`)
                    .join('|');
                const compositionChanged = activeLineKey !== lastActiveLineKey ||
                    activeLyrics.some((lyric) => lineState.get(lyric.lineNumber)?.text !== lyric.text);
                if (compositionChanged) {
                    if (activeLyrics.length > 0 || lastActiveLineKey.length > 0) {
                        frameEvents.push({ time: adjustedTime, type: 'memoryPreset', colorIndex: 0 });
                    }
                    for (const lyric of activeLyrics) {
                        const baseKey = `${lyric.baseColor.r}-${lyric.baseColor.g}-${lyric.baseColor.b}`;
                        const highlightKey = `${lyric.highlightColor.r}-${lyric.highlightColor.g}-${lyric.highlightColor.b}`;
                        const baseColorIdx = colorIndexMap.get(baseKey) || 1;
                        const highlightColorIdx = colorIndexMap.get(highlightKey) || 2;
                        const highlightChars = this.getLineHighlightChars(lyric, time);
                        const tiles = this.getLineTiles(lyric.text, lyric.lineNumber, linesCount, baseColorIdx, highlightColorIdx, 0, highlightChars);
                        frameEvents.push({ time: adjustedTime + 0.02, type: 'tiles', tiles });
                        lineState.set(lyric.lineNumber, {
                            text: lyric.text,
                            lastHighlightChars: highlightChars,
                        });
                    }
                    lastActiveLineKey = activeLineKey;
                }
                else {
                    for (const lyric of activeLyrics) {
                        const baseKey = `${lyric.baseColor.r}-${lyric.baseColor.g}-${lyric.baseColor.b}`;
                        const highlightKey = `${lyric.highlightColor.r}-${lyric.highlightColor.g}-${lyric.highlightColor.b}`;
                        const highlightColorIdx = colorIndexMap.get(highlightKey) || 2;
                        const highlightChars = this.getLineHighlightChars(lyric, time);
                        const state = lineState.get(lyric.lineNumber);
                        if (!state || highlightChars <= state.lastHighlightChars)
                            continue;
                        const tiles = [];
                        for (let charIndex = state.lastHighlightChars; charIndex < highlightChars; charIndex++) {
                            tiles.push(...this.getCharTilesAtIndex(lyric.text, charIndex, lyric.lineNumber, linesCount, highlightColorIdx, 0));
                        }
                        if (tiles.length > 0) {
                            frameEvents.push({ time: adjustedTime, type: 'tiles', tiles });
                            lineState.set(lyric.lineNumber, {
                                text: lyric.text,
                                lastHighlightChars: highlightChars,
                            });
                        }
                    }
                }
            }
        }
        if (endCard?.enabled && endCard.text && endCardImage) {
            frameEvents.push({ time: endCard.startTime + preBuffer, type: 'colorTable', data: endCardImage.colors });
            frameEvents.push({ time: endCard.startTime + preBuffer + 0.02, type: 'memoryPreset', colorIndex: 0 });
            frameEvents.push({ time: endCard.startTime + preBuffer + 0.1, type: 'tiles', tiles: endCardImage.tiles });
        }
        frameEvents.sort((a, b) => a.time - b.time);
        this.packets = [];
        this.screenState.clear();
        let currentPacket = 0;
        for (const event of frameEvents) {
            const targetPacket = Math.floor(event.time * PACKETS_PER_SECOND);
            while (currentPacket < targetPacket && currentPacket < totalPackets) {
                this.packets.push(this.createEmptyPacket());
                currentPacket++;
            }
            let eventPackets = [];
            switch (event.type) {
                case 'colorTable':
                    if (event.data) {
                        eventPackets = this.createColorTablePackets(event.data);
                        this.screenState.clear();
                    }
                    break;
                case 'memoryPreset':
                    if (event.colorIndex !== undefined) {
                        eventPackets = this.createMemoryPresetPackets(event.colorIndex);
                    }
                    break;
                case 'tiles':
                    if (event.tiles) {
                        eventPackets = this.writeTilesToPackets(event.tiles, true);
                    }
                    break;
            }
            for (const packet of eventPackets) {
                if (currentPacket < totalPackets) {
                    this.packets.push(packet);
                    currentPacket++;
                }
            }
        }
        while (currentPacket < totalPackets) {
            this.packets.push(this.createEmptyPacket());
            currentPacket++;
        }
        return Buffer.concat(this.packets);
    }
}
export function hexToRGB(hex) {
    hex = hex.replace('#', '');
    const r = Math.round(parseInt(hex.substring(0, 2), 16) / 17);
    const g = Math.round(parseInt(hex.substring(2, 4), 16) / 17);
    const b = Math.round(parseInt(hex.substring(4, 6), 16) / 17);
    return { r, g, b };
}
export async function generateCDG(options) {
    const generator = new CDGGenerator();
    let titleCardImage;
    let endCardImage;
    if (options.titleCard?.enabled && options.titleCard.text) {
        const imageBuffer = await generateTitleCardImage(options.titleCard.text);
        titleCardImage = await imageToTiles(imageBuffer);
    }
    if (options.endCard?.enabled && options.endCard.text) {
        const imageBuffer = await generateTitleCardImage(options.endCard.text);
        endCardImage = await imageToTiles(imageBuffer);
    }
    return generator.generate(options, titleCardImage, endCardImage);
}
