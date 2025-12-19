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

const CDG_INST_MEMORY_PRESET = 1;
const CDG_INST_BORDER_PRESET = 2;
const CDG_INST_TILE_BLOCK = 6;
const CDG_INST_LOAD_CLUT_LOW = 30;
const CDG_INST_LOAD_CLUT_HIGH = 31;

const FONT_6x12: Record<string, number[]> = {
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

interface CDGColor {
  r: number;
  g: number;
  b: number;
}

interface LyricEvent {
  text: string;
  lineNumber: number;
  appearStartTime: number;
  appearEndTime: number;
  highlightStartTime: number;
  highlightEndTime: number;
  baseColor: CDGColor;
  highlightColor: CDGColor;
}

interface TitleCard {
  enabled: boolean;
  text: string;
  startTime: number;
  endTime: number;
}

interface InstrumentalSection {
  start: number;
  end: number;
}

interface CDGGeneratorOptions {
  duration: number;
  linesCount: number;
  lyrics: LyricEvent[];
  titleCard?: TitleCard;
  endCard?: TitleCard;
  backgroundColor?: CDGColor;
  preBuffer?: number;
  postBuffer?: number;
}

interface TileUpdate {
  row: number;
  col: number;
  color0: number;
  color1: number;
  pixels: number[];
}

interface FrameEvent {
  time: number;
  type: 'clear' | 'colorTable' | 'tiles' | 'memoryPreset';
  data?: CDGColor[];
  tiles?: TileUpdate[];
  colorIndex?: number;
}

interface ImageTileData {
  tiles: TileUpdate[];
  colors: CDGColor[];
}

function cdgColorDistance(c1: CDGColor, c2: CDGColor): number {
  const dr = (c1.r - c2.r) * 17;
  const dg = (c1.g - c2.g) * 17;
  const db = (c1.b - c2.b) * 17;
  return dr * dr + dg * dg + db * db;
}

function findClosestColorIndex(color: CDGColor, palette: CDGColor[]): number {
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

function rgbToCdgColor(r: number, g: number, b: number): CDGColor {
  return {
    r: Math.round(r / 17),
    g: Math.round(g / 17),
    b: Math.round(b / 17),
  };
}

async function generateTitleCardImage(
  text: string,
  textColor: string = '#FFFFFF',
  bgColor: string = '#000000'
): Promise<Buffer> {
  const lines = text.split('\n').filter(l => l.trim());
  const lineHeight = lines.length > 2 ? 32 : 40;
  const fontSize = lines.length > 2 ? 28 : 34;
  const totalTextHeight = lines.length * lineHeight;
  const startY = Math.floor((CDG_HEIGHT - totalTextHeight) / 2) + fontSize * 0.8;
  
  const textElements = lines.map((line, idx) => {
    const y = startY + idx * lineHeight;
    return `<text x="50%" y="${y}" text-anchor="middle" 
      font-family="Arial, Helvetica, sans-serif" 
      font-size="${fontSize}" 
      font-weight="bold"
      fill="${textColor}"
      stroke="${bgColor}"
      stroke-width="2"
      paint-order="stroke">${escapeXml(line)}</text>`;
  }).join('\n');

  const svg = `<svg width="${CDG_WIDTH}" height="${CDG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${bgColor}"/>
    <rect x="10" y="10" width="${CDG_WIDTH - 20}" height="${CDG_HEIGHT - 20}" 
      fill="none" stroke="${textColor}" stroke-width="3" rx="8"/>
    <rect x="16" y="16" width="${CDG_WIDTH - 32}" height="${CDG_HEIGHT - 32}" 
      fill="none" stroke="${textColor}" stroke-width="1" rx="6"/>
    ${textElements}
  </svg>`;

  return sharp(Buffer.from(svg))
    .resize(CDG_WIDTH, CDG_HEIGHT)
    .removeAlpha()
    .toColorspace('srgb')
    .raw()
    .toBuffer();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function imageToTiles(imageBuffer: Buffer): Promise<ImageTileData> {
  const palette: CDGColor[] = [{ r: 0, g: 0, b: 0 }];
  const colorIndexMap = new Map<string, number>();
  colorIndexMap.set('0-0-0', 0);
  
  const indexedPixels: number[][] = [];
  for (let y = 0; y < CDG_HEIGHT; y++) {
    indexedPixels[y] = [];
    for (let x = 0; x < CDG_WIDTH; x++) {
      const idx = (y * CDG_WIDTH + x) * 3;
      const r = imageBuffer[idx] ?? 0;
      const g = imageBuffer[idx + 1] ?? 0;
      const b = imageBuffer[idx + 2] ?? 0;
      const cdgColor = rgbToCdgColor(r, g, b);
      const colorKey = `${cdgColor.r}-${cdgColor.g}-${cdgColor.b}`;
      
      let colorIndex: number;
      if (colorIndexMap.has(colorKey)) {
        colorIndex = colorIndexMap.get(colorKey)!;
      } else if (palette.length < 16) {
        colorIndex = palette.length;
        palette.push(cdgColor);
        colorIndexMap.set(colorKey, colorIndex);
      } else {
        colorIndex = findClosestColorIndex(cdgColor, palette);
      }
      indexedPixels[y][x] = colorIndex;
    }
  }
  
  while (palette.length < 16) {
    palette.push({ r: 0, g: 0, b: 0 });
  }
  
  const tiles: TileUpdate[] = [];
  
  for (let tileRow = 0; tileRow < TILES_DOWN; tileRow++) {
    for (let tileCol = 0; tileCol < TILES_ACROSS; tileCol++) {
      const colorCounts = new Map<number, number>();
      
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
      
      const tilePixels: number[] = [];
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
  private packets: Buffer[] = [];
  private screenState: Map<string, { color0: number; color1: number; pixels: string }> = new Map();

  private createPacket(instruction: number, data: number[]): Buffer {
    const packet = Buffer.alloc(24);
    packet[0] = CDG_COMMAND;
    packet[1] = instruction & 0x3F;
    for (let i = 0; i < 16 && i < data.length; i++) {
      packet[4 + i] = data[i] & 0x3F;
    }
    return packet;
  }

  private createEmptyPacket(): Buffer {
    return Buffer.alloc(24);
  }

  private createColorTablePackets(colors: CDGColor[]): Buffer[] {
    const packets: Buffer[] = [];
    
    const lowData: number[] = [];
    for (let i = 0; i < 8; i++) {
      const color = colors[i] || { r: 0, g: 0, b: 0 };
      lowData.push((color.r << 2) | ((color.g >> 2) & 0x03));
      lowData.push(((color.g & 0x03) << 4) | color.b);
    }
    packets.push(this.createPacket(CDG_INST_LOAD_CLUT_LOW, lowData));

    const highData: number[] = [];
    for (let i = 8; i < 16; i++) {
      const color = colors[i] || { r: 0, g: 0, b: 0 };
      highData.push((color.r << 2) | ((color.g >> 2) & 0x03));
      highData.push(((color.g & 0x03) << 4) | color.b);
    }
    packets.push(this.createPacket(CDG_INST_LOAD_CLUT_HIGH, highData));
    
    return packets;
  }

  private createMemoryPresetPackets(colorIndex: number): Buffer[] {
    const packets: Buffer[] = [];
    for (let i = 0; i < 16; i++) {
      const data = [colorIndex & 0x0F, i, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      packets.push(this.createPacket(CDG_INST_MEMORY_PRESET, data));
    }
    this.screenState.clear();
    return packets;
  }

  private createTilePacket(row: number, col: number, color0: number, color1: number, pixels: number[]): Buffer | null {
    if (row < 0 || row >= TILES_DOWN || col < 0 || col >= TILES_ACROSS) return null;
    
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

  private getCharTiles(char: string, tileCol: number, tileRow: number, fgColor: number, bgColor: number): TileUpdate[] {
    const baseFontData = FONT_6x12[char] || FONT_6x12[char.toUpperCase()] || FONT_6x12[' '];
    const fontData = baseFontData.map(byte => byte & 0x3E);
    
    return [
      { row: tileRow, col: tileCol, color0: bgColor, color1: fgColor, pixels: fontData },
    ];
  }

  private getTextWidth(text: string): number {
    return text.length;
  }

  private getCharHeight(): number {
    return 1;
  }

  private getTextCenteredTiles(text: string, centerRow: number, fgColor: number, bgColor: number): TileUpdate[] {
    const tiles: TileUpdate[] = [];
    const maxChars = TILES_ACROSS - 2;
    const displayText = text.length > maxChars ? text.substring(0, maxChars) : text;
    const textWidth = this.getTextWidth(displayText);
    const startCol = Math.max(1, Math.floor((TILES_ACROSS - textWidth) / 2));
    
    for (let i = 0; i < displayText.length; i++) {
      const col = startCol + i;
      if (col < TILES_ACROSS - 1) {
        tiles.push(...this.getCharTiles(displayText[i], col, centerRow, fgColor, bgColor));
      }
    }
    return tiles;
  }

  private getTextWithHighlightTiles(
    text: string, 
    lineNumber: number, 
    linesCount: number, 
    baseColor: number, 
    highlightColor: number, 
    bgColor: number,
    highlightChars: number
  ): TileUpdate[] {
    const tiles: TileUpdate[] = [];
    const charHeight = this.getCharHeight();
    const usableRows = TILES_DOWN - 2;
    const rowsPerLine = Math.floor(usableRows / linesCount);
    const startRow = 1 + lineNumber * rowsPerLine + Math.floor((rowsPerLine - charHeight) / 2);
    
    const maxChars = TILES_ACROSS - 2;
    const displayText = text.length > maxChars ? text.substring(0, maxChars) : text;
    const adjustedHighlightChars = Math.min(highlightChars, displayText.length);
    
    const textWidth = this.getTextWidth(displayText);
    const startCol = Math.max(1, Math.floor((TILES_ACROSS - textWidth) / 2));
    
    for (let i = 0; i < displayText.length; i++) {
      const color = i < adjustedHighlightChars ? highlightColor : baseColor;
      const col = startCol + i;
      if (col < TILES_ACROSS - 1) {
        tiles.push(...this.getCharTiles(displayText[i], col, startRow, color, bgColor));
      }
    }
    return tiles;
  }

  private getClearLineTiles(lineNumber: number, linesCount: number, bgColor: number): TileUpdate[] {
    const tiles: TileUpdate[] = [];
    const charHeight = this.getCharHeight();
    const usableRows = TILES_DOWN - 2;
    const rowsPerLine = Math.floor(usableRows / linesCount);
    const startRow = 1 + lineNumber * rowsPerLine + Math.floor((rowsPerLine - charHeight) / 2);
    const emptyPixels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    
    for (let row = startRow; row < startRow + charHeight && row < TILES_DOWN - 1; row++) {
      for (let col = 1; col < TILES_ACROSS - 1; col++) {
        tiles.push({ row, col, color0: bgColor, color1: bgColor, pixels: emptyPixels });
      }
    }
    return tiles;
  }

  private getProgressBarTiles(progress: number, row: number, fgColor: number, bgColor: number): TileUpdate[] {
    const tiles: TileUpdate[] = [];
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
      } else if (col === filledTiles) {
        const partialProgress = (barWidth * progress) - filledTiles;
        const pixelsFilled = Math.floor(6 * partialProgress);
        const mask = pixelsFilled > 0 ? (0x3F << (6 - pixelsFilled)) & 0x3F : 0;
        tiles.push({
          row, col: tileCol, color0: bgColor, color1: fgColor,
          pixels: [0x00, 0x00, mask, mask, mask, mask, mask, mask, mask, mask, 0x00, 0x00]
        });
      } else {
        tiles.push({
          row, col: tileCol, color0: bgColor, color1: fgColor,
          pixels: [0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00]
        });
      }
    }
    return tiles;
  }

  private writeTilesToPackets(tiles: TileUpdate[], skipEmpty: boolean = false): Buffer[] {
    const packets: Buffer[] = [];
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

  private detectInstrumentalSections(lyrics: LyricEvent[], duration: number): InstrumentalSection[] {
    const MIN_GAP = 5;
    const gaps: InstrumentalSection[] = [];
    
    if (lyrics.length === 0) return gaps;
    
    const events: { time: number; type: 'start' | 'end' }[] = [];
    for (const lyric of lyrics) {
      events.push({ time: lyric.appearStartTime, type: 'start' });
      events.push({ time: lyric.appearEndTime, type: 'end' });
    }
    events.sort((a, b) => a.time - b.time);
    
    let activeCount = 0;
    let gapStart: number | null = null;
    
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
      } else {
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

  async generate(options: CDGGeneratorOptions, titleCardImage?: ImageTileData, endCardImage?: ImageTileData): Promise<Buffer> {
    const { duration, linesCount, lyrics, titleCard, endCard, backgroundColor, preBuffer = 0, postBuffer = 0 } = options;
    
    const totalDuration = preBuffer + duration + postBuffer;
    const totalPackets = Math.ceil(totalDuration * PACKETS_PER_SECOND);
    const bgColor: CDGColor = backgroundColor || { r: 0, g: 0, b: 0 };
    
    const uniqueColors = new Map<string, CDGColor>();
    lyrics.forEach(lyric => {
      const baseKey = `${lyric.baseColor.r}-${lyric.baseColor.g}-${lyric.baseColor.b}`;
      const highlightKey = `${lyric.highlightColor.r}-${lyric.highlightColor.g}-${lyric.highlightColor.b}`;
      uniqueColors.set(baseKey, lyric.baseColor);
      uniqueColors.set(highlightKey, lyric.highlightColor);
    });
    
    const colors: CDGColor[] = [bgColor];
    const colorIndexMap = new Map<string, number>();
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
    
    const frameEvents: FrameEvent[] = [];
    
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
    
    const lineState: Map<number, { text: string; lastHighlightChars: number }> = new Map();
    let currentInstrumental: InstrumentalSection | null = null;
    let lastProgressUpdate = -1;
    
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
            frameEvents.push({ time: adjustedTime, type: 'memoryPreset', colorIndex: 0 });
            
            const iconRow = Math.floor(TILES_DOWN / 2) - 2;
            const iconTiles = this.getTextCenteredTiles('♪', iconRow, 1, 0);
            frameEvents.push({ time: adjustedTime + 0.1, type: 'tiles', tiles: iconTiles });
          }
          
          const progressRow = Math.floor(TILES_DOWN / 2) + 2;
          const progressPercent = Math.floor(instrumentalProgress * 100);
          if (progressPercent !== lastProgressUpdate) {
            const progressTiles = this.getProgressBarTiles(instrumentalProgress, progressRow, 1, 0);
            frameEvents.push({ time: adjustedTime, type: 'tiles', tiles: progressTiles });
            lastProgressUpdate = progressPercent;
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
        }
        
        const activeLyrics = lyrics.filter(
          l => time >= l.appearStartTime && time <= l.appearEndTime
        );
        
        for (const lyric of activeLyrics) {
          const baseKey = `${lyric.baseColor.r}-${lyric.baseColor.g}-${lyric.baseColor.b}`;
          const highlightKey = `${lyric.highlightColor.r}-${lyric.highlightColor.g}-${lyric.highlightColor.b}`;
          const baseColorIdx = colorIndexMap.get(baseKey) || 1;
          const highlightColorIdx = colorIndexMap.get(highlightKey) || 2;
          
          let highlightProgress = 0;
          if (time >= lyric.highlightStartTime && time <= lyric.highlightEndTime) {
            highlightProgress = (time - lyric.highlightStartTime) / (lyric.highlightEndTime - lyric.highlightStartTime);
          } else if (time > lyric.highlightEndTime) {
            highlightProgress = 1;
          }
          
          const highlightChars = Math.floor(lyric.text.length * highlightProgress);
          const state = lineState.get(lyric.lineNumber);
          
          if (!state || state.text !== lyric.text || state.lastHighlightChars !== highlightChars) {
            const tiles = this.getTextWithHighlightTiles(
              lyric.text.toUpperCase(),
              lyric.lineNumber,
              linesCount,
              baseColorIdx,
              highlightColorIdx,
              0,
              highlightChars
            );
            frameEvents.push({ time: adjustedTime, type: 'tiles', tiles });
            lineState.set(lyric.lineNumber, { text: lyric.text, lastHighlightChars: highlightChars });
          }
        }
        
        for (const [lineNum] of lineState.entries()) {
          if (!activeLyrics.some(l => l.lineNumber === lineNum)) {
            const tiles = this.getClearLineTiles(lineNum, linesCount, 0);
            frameEvents.push({ time: adjustedTime, type: 'tiles', tiles });
            lineState.delete(lineNum);
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
      
      let eventPackets: Buffer[] = [];
      
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

export function hexToRGB(hex: string): CDGColor {
  hex = hex.replace('#', '');
  const r = Math.round(parseInt(hex.substring(0, 2), 16) / 17);
  const g = Math.round(parseInt(hex.substring(2, 4), 16) / 17);
  const b = Math.round(parseInt(hex.substring(4, 6), 16) / 17);
  return { r, g, b };
}

export async function generateCDG(options: CDGGeneratorOptions): Promise<Buffer> {
  const generator = new CDGGenerator();
  
  let titleCardImage: ImageTileData | undefined;
  let endCardImage: ImageTileData | undefined;
  
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

export type { CDGColor, LyricEvent, TitleCard, CDGGeneratorOptions };
