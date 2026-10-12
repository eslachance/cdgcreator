/**
 * CDG (CD+Graphics) File Generator
 *
 * Based on specifications from:
 * - https://www.cdgfix.com/help/3.x/Technical_information/The_CDG_graphics_format.htm
 * - https://jbum.com/cdg_revealed.html
 * - https://goughlui.com/2019/03/31/tech-flashback-the-cdgraphics-format-cdg/
 *
 * How it works
 * ------------
 * A CDG stream is 300 packets per second; every packet can carry at most one
 * instruction (a palette load, a screen clear, or one 6x12 tile). So the
 * generator is built around two pieces:
 *
 * 1. A "desired" framebuffer (300x216 palette indices) that scenes paint into
 *    as time advances: title/end cards, instrumental breaks, and lyric lines
 *    with a pixel-accurate highlight wipe.
 * 2. A scheduler that, for every packet slot, picks the dirty tile with the
 *    earliest deadline and emits the cheapest packets (normal and/or XOR tile
 *    blocks) that turn what the player currently shows into the desired tile.
 *    Nothing is ever dropped or pushed out of sync: if the stream is busy,
 *    updates simply coalesce.
 *
 * Lyrics use the same trick professional karaoke CDGs use: text is drawn
 * anti-aliased with palette entries 0-7 (background -> base color ramp) and
 * entries 8-15 hold the same ramp toward the highlight color. Highlighting a
 * pixel is then just flipping bit 3 with a Tile Block XOR, which costs one
 * packet per tile no matter how many shades the tile contains. With several
 * singers the ramp is split into fewer shades per singer.
 */

import sharp from 'sharp';

const CDG_COMMAND = 0x09;
const CDG_INST_MEMORY_PRESET = 1;
const CDG_INST_BORDER_PRESET = 2;
const CDG_INST_TILE_BLOCK = 6;
const CDG_INST_LOAD_CLUT_LOW = 30;
const CDG_INST_LOAD_CLUT_HIGH = 31;
const CDG_INST_TILE_BLOCK_XOR = 38;

const PACKETS_PER_SECOND = 300;
const CDG_WIDTH = 300;
const CDG_HEIGHT = 216;
const TILE_WIDTH = 6;
const TILE_HEIGHT = 12;
const TILES_ACROSS = 50;
const TILES_DOWN = 18;
const TILE_PIXELS = TILE_WIDTH * TILE_HEIGHT;

// The outer ring of tiles is the border area, which many players hide.
const SAFE_LEFT = TILE_WIDTH;
const SAFE_TOP = TILE_HEIGHT;
const SAFE_WIDTH = CDG_WIDTH - 2 * TILE_WIDTH;
const SAFE_HEIGHT = CDG_HEIGHT - 2 * TILE_HEIGHT;
const TEXT_MAX_WIDTH = SAFE_WIDTH - 8;

const HIGHLIGHT_BIT = 8;
// How often (in packets) animated elements advance: 10 packets = 30 updates/s.
const ANIMATION_INTERVAL = 10;
const MEMORY_PRESET_REPEATS = 16;
const MAX_DRAW_LEAD = 0.35;
const MIN_PACKETS_BETWEEN_PALETTE_LOADS = 4;

const FONT_FAMILY = "Arial, 'Liberation Sans', Helvetica, sans-serif";
const TITLE_CARD_COLOR = '#c084fc';
const END_CARD_COLOR = '#fbbf24';
const CARD_FADE_DURATION = 0.3;
const INSTRUMENTAL_MIN_GAP = 5;
const INSTRUMENTAL_PADDING = 1;
const INSTRUMENTAL_FADE_DURATION = 1;

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

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const BLACK: CDGColor = { r: 0, g: 0, b: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function colorKey(color: CDGColor): string {
  return `${color.r}-${color.g}-${color.b}`;
}

function cdgColorToHex(color: CDGColor): string {
  const toByte = (value: number) => clamp(value * 17, 0, 255);
  const r = toByte(color.r).toString(16).padStart(2, '0');
  const g = toByte(color.g).toString(16).padStart(2, '0');
  const b = toByte(color.b).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function lerpColor(from: CDGColor, to: CDGColor, t: number): CDGColor {
  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
  };
}

function cdgColorDistance(c1: CDGColor, c2: CDGColor): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return dr * dr * 3 + dg * dg * 4 + db * db * 2;
}

function fadePalette(palette: CDGColor[], background: CDGColor, opacity: number): CDGColor[] {
  return palette.map((color) => lerpColor(background, color, clamp(opacity, 0, 1)));
}

/**
 * Reduce one or more RGB images to a palette of at most 16 colors (12-bit),
 * with the background guaranteed to be entry 0 so a Memory Preset clears to it.
 */
function buildImagePalette(images: Buffer[], background: CDGColor): CDGColor[] {
  const histogram = new Map<number, number>();
  const bgKey = (background.r << 8) | (background.g << 4) | background.b;
  for (const image of images) {
    for (let i = 0; i < image.length; i += 3) {
      const key = (Math.round(image[i] / 17) << 8) | (Math.round(image[i + 1] / 17) << 4) | Math.round(image[i + 2] / 17);
      if (key === bgKey) continue;
      histogram.set(key, (histogram.get(key) ?? 0) + 1);
    }
  }

  type Entry = { color: CDGColor; count: number };
  const entries: Entry[] = Array.from(histogram, ([key, count]) => ({
    color: { r: (key >> 8) & 0xf, g: (key >> 4) & 0xf, b: key & 0xf },
    count,
  }));

  let colors: CDGColor[];
  if (entries.length <= 15) {
    colors = entries.map((entry) => entry.color);
  } else {
    // Median cut, splitting the box with the widest weighted channel range.
    let boxes: Entry[][] = [entries];
    while (boxes.length < 15) {
      let bestBox = -1;
      let bestChannel: keyof CDGColor = 'r';
      let bestScore = 0;
      boxes.forEach((box, index) => {
        if (box.length < 2) return;
        const weight = box.reduce((sum, entry) => sum + entry.count, 0);
        for (const channel of ['r', 'g', 'b'] as const) {
          const values = box.map((entry) => entry.color[channel]);
          const score = (Math.max(...values) - Math.min(...values)) * Math.sqrt(weight);
          if (score > bestScore) {
            bestScore = score;
            bestBox = index;
            bestChannel = channel;
          }
        }
      });
      if (bestBox < 0) break;
      const box = boxes[bestBox].sort((a, b) => a.color[bestChannel] - b.color[bestChannel]);
      const total = box.reduce((sum, entry) => sum + entry.count, 0);
      let running = 0;
      let split = 1;
      for (let i = 0; i < box.length - 1; i++) {
        running += box[i].count;
        split = i + 1;
        if (running >= total / 2) break;
      }
      boxes = [...boxes.slice(0, bestBox), box.slice(0, split), box.slice(split), ...boxes.slice(bestBox + 1)];
    }
    colors = boxes.map((box) => {
      const total = box.reduce((sum, entry) => sum + entry.count, 0);
      return {
        r: Math.round(box.reduce((sum, entry) => sum + entry.color.r * entry.count, 0) / total),
        g: Math.round(box.reduce((sum, entry) => sum + entry.color.g * entry.count, 0) / total),
        b: Math.round(box.reduce((sum, entry) => sum + entry.color.b * entry.count, 0) / total),
      };
    });
  }

  const palette = [background, ...colors];
  while (palette.length < 16) palette.push(background);
  return palette;
}

function mapImageToPalette(image: Buffer, palette: CDGColor[]): Uint8Array {
  const indices = new Uint8Array(CDG_WIDTH * CDG_HEIGHT);
  const cache = new Map<number, number>();
  for (let p = 0; p < indices.length; p++) {
    const r = Math.round(image[p * 3] / 17);
    const g = Math.round(image[p * 3 + 1] / 17);
    const b = Math.round(image[p * 3 + 2] / 17);
    const key = (r << 8) | (g << 4) | b;
    let index = cache.get(key);
    if (index === undefined) {
      index = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < palette.length; i++) {
        const distance = cdgColorDistance({ r, g, b }, palette[i]);
        if (distance < bestDistance) {
          bestDistance = distance;
          index = i;
        }
      }
      cache.set(key, index);
    }
    indices[p] = index;
  }
  return indices;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface TextAlpha {
  width: number;
  height: number;
  alpha: Uint8Array;
  inkLeft: number;
  inkRight: number;
}

/** Render a single line of bold text, centered horizontally, as an 8-bit coverage mask. */
async function renderTextAlpha(
  text: string,
  fontSize: number,
  width: number,
  height: number,
  baseline: number
): Promise<TextAlpha> {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#000"/>
    <text x="${width / 2}" y="${baseline}" text-anchor="middle" xml:space="preserve"
      font-family="${FONT_FAMILY}" font-weight="bold" font-size="${fontSize}" fill="#fff">${escapeXml(text)}</text>
  </svg>`;
  const { data, info } = await sharp(Buffer.from(svg))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(width * height);
  let inkLeft = width;
  let inkRight = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = data[(y * width + x) * info.channels];
      alpha[y * width + x] = value;
      if (value > 0) {
        if (x < inkLeft) inkLeft = x;
        if (x > inkRight) inkRight = x;
      }
    }
  }
  return { width, height, alpha, inkLeft, inkRight };
}

async function measureTextWidth(text: string, fontSize: number): Promise<number> {
  const height = Math.ceil(fontSize * 1.6);
  const rendered = await renderTextAlpha(text, fontSize, 1600, height, Math.round(fontSize * 1.2));
  return rendered.inkRight < 0 ? 0 : rendered.inkRight - rendered.inkLeft + 1;
}

/** Largest font size (<= maxSize) at which the text fits in maxWidth pixels. */
async function fitFontSize(text: string, maxSize: number, maxWidth: number, minSize = 7): Promise<number> {
  let size = maxSize;
  const width = await measureTextWidth(text, size);
  if (width > maxWidth) {
    size = Math.max(minSize, Math.floor((size * maxWidth) / width));
    while (size > minSize && (await measureTextWidth(text, size)) > maxWidth) {
      size--;
    }
  }
  return size;
}

async function renderSvgToRgb(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg))
    .resize(CDG_WIDTH, CDG_HEIGHT)
    .removeAlpha()
    .toColorspace('srgb')
    .raw()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Packet encoding
// ---------------------------------------------------------------------------

interface Instruction {
  instruction: number;
  data: number[];
}

interface TileOp {
  xor: boolean;
  color0: number;
  color1: number;
  // One entry per tile pixel (row-major): true selects color1.
  select: Uint8Array;
}

function memoryPresetInstructions(colorIndex: number): Instruction[] {
  const instructions: Instruction[] = [];
  for (let repeat = 0; repeat < MEMORY_PRESET_REPEATS; repeat++) {
    instructions.push({ instruction: CDG_INST_MEMORY_PRESET, data: [colorIndex & 0x0f, repeat & 0x0f] });
  }
  return instructions;
}

function encodeColor(color: CDGColor): [number, number] {
  return [((color.r & 0x0f) << 2) | ((color.g >> 2) & 0x03), ((color.g & 0x03) << 4) | (color.b & 0x0f)];
}

function paletteInstructions(palette: CDGColor[], previous?: CDGColor[]): Instruction[] {
  const instructions: Instruction[] = [];
  for (const [instruction, offset] of [[CDG_INST_LOAD_CLUT_LOW, 0], [CDG_INST_LOAD_CLUT_HIGH, 8]]) {
    const half = palette.slice(offset, offset + 8);
    if (previous && half.every((color, i) => colorKey(color) === colorKey(previous[offset + i]))) continue;
    instructions.push({ instruction, data: half.flatMap(encodeColor) });
  }
  return instructions;
}

function tileInstruction(op: TileOp, tileIndex: number): Instruction {
  const row = Math.floor(tileIndex / TILES_ACROSS);
  const col = tileIndex % TILES_ACROSS;
  const data = [op.color0 & 0x0f, op.color1 & 0x0f, row & 0x1f, col & 0x3f];
  for (let y = 0; y < TILE_HEIGHT; y++) {
    let bits = 0;
    for (let x = 0; x < TILE_WIDTH; x++) {
      if (op.select[y * TILE_WIDTH + x]) bits |= 1 << (TILE_WIDTH - 1 - x);
    }
    data.push(bits);
  }
  return { instruction: op.xor ? CDG_INST_TILE_BLOCK_XOR : CDG_INST_TILE_BLOCK, data };
}

function distinctValues(values: Uint8Array): number[] {
  let mask = 0;
  for (let i = 0; i < values.length; i++) mask |= 1 << values[i];
  const result: number[] = [];
  for (let v = 0; v < 16; v++) if (mask & (1 << v)) result.push(v);
  return result;
}

/** XOR operations that apply an arbitrary per-pixel XOR delta. */
function xorOpsForDelta(delta: Uint8Array): TileOp[] {
  const values = distinctValues(delta);
  if (values.length === 1 && values[0] === 0) return [];

  const selectWhere = (predicate: (value: number) => boolean) => {
    const select = new Uint8Array(TILE_PIXELS);
    for (let i = 0; i < TILE_PIXELS; i++) select[i] = predicate(delta[i]) ? 1 : 0;
    return select;
  };

  if (values.length <= 2) {
    const [color0, color1 = values[0]] = values;
    return [{ xor: true, color0, color1, select: selectWhere((v) => v === color1 && color1 !== color0) }];
  }

  const [r1, r2, r3, r4] = values;
  if (values.length === 3 || (values.length === 4 && (r1 ^ r2 ^ r3 ^ r4) === 0)) {
    return [
      { xor: true, color0: 0, color1: r3 ^ r1, select: selectWhere((v) => v === r3 || v === r4) },
      { xor: true, color0: r1, color1: r2, select: selectWhere((v) => v === r2 || (values.length === 4 && v === r4)) },
    ];
  }

  const ops: TileOp[] = [];
  for (let bit = 1; bit < 16; bit <<= 1) {
    if (values.some((v) => v & bit)) {
      ops.push({ xor: true, color0: 0, color1: bit, select: selectWhere((v) => (v & bit) !== 0) });
    }
  }
  return ops;
}

/** Cheapest sequence of tile operations that turns `current` into `target`. */
function encodeTile(current: Uint8Array, target: Uint8Array): TileOp[] {
  const delta = new Uint8Array(TILE_PIXELS);
  for (let i = 0; i < TILE_PIXELS; i++) delta[i] = current[i] ^ target[i];
  let best = xorOpsForDelta(delta);
  if (best.length <= 1) return best;

  const targetValues = distinctValues(target);
  if (targetValues.length <= 2) {
    const [color0, color1 = targetValues[0]] = targetValues;
    const select = new Uint8Array(TILE_PIXELS);
    for (let i = 0; i < TILE_PIXELS; i++) select[i] = target[i] === color1 && color1 !== color0 ? 1 : 0;
    return [{ xor: false, color0, color1, select }];
  }

  // A normal tile block with the two dominant colors, then XOR fix-ups.
  const counts = new Array(16).fill(0);
  for (let i = 0; i < TILE_PIXELS; i++) counts[target[i]]++;
  const frequent = targetValues.sort((a, b) => counts[b] - counts[a]).slice(0, 4);
  const residual = new Uint8Array(TILE_PIXELS);
  for (let i = 0; i < frequent.length; i++) {
    for (let j = i + 1; j < frequent.length; j++) {
      const a = frequent[i];
      const b = frequent[j];
      const others = targetValues.filter((v) => v !== a && v !== b);
      if (others.length > 8) continue;
      for (let assignment = 0; assignment < 1 << others.length; assignment++) {
        const useB = new Array(16).fill(false);
        useB[b] = true;
        others.forEach((v, k) => {
          useB[v] = (assignment & (1 << k)) !== 0;
        });
        const select = new Uint8Array(TILE_PIXELS);
        for (let p = 0; p < TILE_PIXELS; p++) {
          select[p] = useB[target[p]] ? 1 : 0;
          residual[p] = target[p] ^ (select[p] ? b : a);
        }
        const fixups = xorOpsForDelta(residual);
        if (fixups.length + 1 < best.length) {
          best = [{ xor: false, color0: a, color1: b, select }, ...fixups];
          if (best.length <= 2) return best;
        }
      }
    }
  }
  return best;
}

function applyTileOp(tile: Uint8Array, op: TileOp): void {
  for (let i = 0; i < TILE_PIXELS; i++) {
    const value = op.select[i] ? op.color1 : op.color0;
    tile[i] = op.xor ? tile[i] ^ value : value;
  }
}

function readTile(frame: Uint8Array, tileIndex: number, out: Uint8Array): void {
  const x0 = (tileIndex % TILES_ACROSS) * TILE_WIDTH;
  const y0 = Math.floor(tileIndex / TILES_ACROSS) * TILE_HEIGHT;
  for (let y = 0; y < TILE_HEIGHT; y++) {
    const rowStart = (y0 + y) * CDG_WIDTH + x0;
    for (let x = 0; x < TILE_WIDTH; x++) out[y * TILE_WIDTH + x] = frame[rowStart + x];
  }
}

function writeTile(frame: Uint8Array, tileIndex: number, tile: Uint8Array): void {
  const x0 = (tileIndex % TILES_ACROSS) * TILE_WIDTH;
  const y0 = Math.floor(tileIndex / TILES_ACROSS) * TILE_HEIGHT;
  for (let y = 0; y < TILE_HEIGHT; y++) {
    const rowStart = (y0 + y) * CDG_WIDTH + x0;
    for (let x = 0; x < TILE_WIDTH; x++) frame[rowStart + x] = tile[y * TILE_WIDTH + x];
  }
}

function tileAt(x: number, y: number): number {
  return Math.floor(y / TILE_HEIGHT) * TILES_ACROSS + Math.floor(x / TILE_WIDTH);
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

interface DirtyTile {
  deadline: number;
  order: number;
}

/** What scenes use to paint the desired frame and request tile updates. */
class Canvas {
  readonly desired = new Uint8Array(CDG_WIDTH * CDG_HEIGHT);
  readonly dirty = new Map<number, DirtyTile>();

  markTile(tileIndex: number, deadline: number, order = tileIndex): void {
    const existing = this.dirty.get(tileIndex);
    if (!existing || deadline < existing.deadline || (deadline === existing.deadline && order < existing.order)) {
      this.dirty.set(tileIndex, { deadline, order });
    }
  }

  /** Mark every tile overlapping the pixel rectangle, ordered left-to-right. */
  markRect(x0: number, y0: number, x1: number, y1: number, deadline: number): void {
    if (x1 <= x0 || y1 <= y0) return;
    const col0 = Math.floor(x0 / TILE_WIDTH);
    const col1 = Math.floor((x1 - 1) / TILE_WIDTH);
    const row0 = Math.floor(y0 / TILE_HEIGHT);
    const row1 = Math.floor((y1 - 1) / TILE_HEIGHT);
    for (let col = col0; col <= col1; col++) {
      for (let row = row0; row <= row1; row++) {
        this.markTile(row * TILES_ACROSS + col, deadline, col * TILES_DOWN + row);
      }
    }
  }

  clear(): void {
    this.desired.fill(0);
    this.dirty.clear();
  }
}

interface Scene {
  readonly palette: CDGColor[];
  enter(canvas: Canvas, time: number, packet: number): void;
  update(canvas: Canvas, time: number, packet: number): void;
  /** Overall opacity (0..1) used to fade the palette; `drawn` is the time the initial paint finished. */
  opacity(time: number, drawn: number | null): number;
}

interface PreparedLine {
  lyric: LyricEvent;
  group: number;
  top: number;
  height: number;
  // Shade level per pixel of the band (SAFE_WIDTH x height), 0 = background.
  levels: Uint8Array;
  inkLeft: number;
  inkRight: number;
  // Seconds to start drawing ahead of the appear time when the slot is empty.
  lead: number;
}

class LyricsScene implements Scene {
  private active = new Map<number, { line: PreparedLine; wipeX: number; lastWipePacket: number }>();

  constructor(
    readonly palette: CDGColor[],
    private linesByNumber: PreparedLine[][],
    private levelsPerGroup: number,
    private preBuffer: number
  ) {}

  enter(canvas: Canvas, time: number, packet: number): void {
    this.active.clear();
    this.update(canvas, time, packet);
  }

  opacity(): number {
    return 1;
  }

  update(canvas: Canvas, time: number, packet: number): void {
    const songTime = time - this.preBuffer;
    this.linesByNumber.forEach((lines, lineNumber) => {
      // Like the preview: the most recently appeared lyric wins the slot.
      let current: PreparedLine | undefined;
      for (const line of lines) {
        if (songTime >= line.lyric.appearStartTime && songTime <= line.lyric.appearEndTime) {
          if (!current || line.lyric.appearStartTime > current.lyric.appearStartTime) current = line;
        }
      }
      // Drawing a line takes a moment, so if its slot is free, start a little
      // early so the reveal is centered on the appear time.
      if (!current) {
        current = lines.find(
          (line) => songTime < line.lyric.appearStartTime && songTime >= line.lyric.appearStartTime - line.lead
        );
      }

      const state = this.active.get(lineNumber);
      if (state?.line !== current) {
        if (state) this.eraseLine(canvas, state.line, time);
        if (current) {
          this.paintLine(canvas, current, time);
          this.active.set(lineNumber, { line: current, wipeX: SAFE_LEFT + current.inkLeft, lastWipePacket: -Infinity });
        } else {
          this.active.delete(lineNumber);
        }
      }
    });

    for (const state of this.active.values()) {
      if (packet - state.lastWipePacket < ANIMATION_INTERVAL) continue;
      const { lyric, inkLeft, inkRight } = state.line;
      const span = lyric.highlightEndTime - lyric.highlightStartTime;
      const progress = songTime >= lyric.highlightEndTime ? 1 : span > 0 ? clamp((songTime - lyric.highlightStartTime) / span, 0, 1) : 0;
      const targetX = SAFE_LEFT + inkLeft + Math.round(progress * (inkRight - inkLeft + 1));
      if (targetX > state.wipeX) {
        this.highlightColumns(canvas, state.line, state.wipeX, targetX, time);
        state.wipeX = targetX;
        state.lastWipePacket = packet;
      }
    }
  }

  private paintLine(canvas: Canvas, line: PreparedLine, time: number): void {
    const base = line.group * this.levelsPerGroup;
    for (let y = 0; y < line.height; y++) {
      const rowStart = (line.top + y) * CDG_WIDTH + SAFE_LEFT;
      for (let x = 0; x < SAFE_WIDTH; x++) {
        const level = line.levels[y * SAFE_WIDTH + x];
        canvas.desired[rowStart + x] = level ? base + level : 0;
      }
    }
    // Lines that will be sung sooner are drawn first.
    const deadline = Math.max(time, line.lyric.highlightStartTime + this.preBuffer);
    canvas.markRect(SAFE_LEFT + line.inkLeft, line.top, SAFE_LEFT + line.inkRight + 1, line.top + line.height, deadline);
  }

  private eraseLine(canvas: Canvas, line: PreparedLine, time: number): void {
    for (let y = 0; y < line.height; y++) {
      canvas.desired.fill(0, (line.top + y) * CDG_WIDTH + SAFE_LEFT, (line.top + y) * CDG_WIDTH + SAFE_LEFT + SAFE_WIDTH);
    }
    canvas.markRect(SAFE_LEFT + line.inkLeft, line.top, SAFE_LEFT + line.inkRight + 1, line.top + line.height, time);
  }

  private highlightColumns(canvas: Canvas, line: PreparedLine, fromX: number, toX: number, time: number): void {
    for (let x = fromX; x < toX; x++) {
      for (let y = 0; y < line.height; y++) {
        if (line.levels[y * SAFE_WIDTH + (x - SAFE_LEFT)]) {
          canvas.desired[(line.top + y) * CDG_WIDTH + x] |= HIGHLIGHT_BIT;
        }
      }
    }
    canvas.markRect(fromX, line.top, toX, line.top + line.height, time);
  }
}

/** A static full-screen image (title and end cards). */
class ImageScene implements Scene {
  constructor(
    readonly palette: CDGColor[],
    private image: Uint8Array,
    private end: number,
    private fadeDuration: number
  ) {}

  enter(canvas: Canvas, time: number): void {
    canvas.desired.set(this.image);
    for (let tile = 0; tile < TILES_ACROSS * TILES_DOWN; tile++) canvas.markTile(tile, time);
  }

  update(): void {}

  opacity(time: number, drawn: number | null): number {
    if (drawn === null) return 0;
    return clamp(Math.min((time - drawn) / this.fadeDuration, (this.end - time) / this.fadeDuration), 0, 1);
  }
}

/** Music icon with a progress bar that fills over the instrumental break. */
class InstrumentalScene implements Scene {
  private fillX = 0;
  private lastFillPacket = -Infinity;

  constructor(
    readonly palette: CDGColor[],
    private empty: Uint8Array,
    private full: Uint8Array,
    private barLeft: number,
    private barRight: number,
    private start: number,
    private end: number
  ) {}

  enter(canvas: Canvas, time: number, packet: number): void {
    canvas.desired.set(this.empty);
    for (let tile = 0; tile < TILES_ACROSS * TILES_DOWN; tile++) canvas.markTile(tile, time);
    this.fillX = this.barLeft;
    this.lastFillPacket = -Infinity;
    this.update(canvas, time, packet);
  }

  update(canvas: Canvas, time: number, packet: number): void {
    if (packet - this.lastFillPacket < ANIMATION_INTERVAL) return;
    const progress = clamp((time - this.start) / (this.end - this.start), 0, 1);
    const targetX = Math.round(this.barLeft + progress * (this.barRight - this.barLeft));
    if (targetX <= this.fillX) return;
    for (let y = 0; y < CDG_HEIGHT; y++) {
      for (let x = this.fillX; x < targetX; x++) canvas.desired[y * CDG_WIDTH + x] = this.full[y * CDG_WIDTH + x];
    }
    for (let x = this.fillX; x < targetX; x++) {
      for (let y = 0; y < CDG_HEIGHT; y += TILE_HEIGHT) {
        const tile = tileAt(x, y);
        let changed = false;
        for (let py = y; py < y + TILE_HEIGHT && !changed; py++) {
          changed = this.empty[py * CDG_WIDTH + x] !== this.full[py * CDG_WIDTH + x];
        }
        if (changed) canvas.markTile(tile, time);
      }
    }
    this.fillX = targetX;
    this.lastFillPacket = packet;
  }

  opacity(time: number, drawn: number | null): number {
    if (drawn === null) return 0;
    return clamp(Math.min(time - drawn, this.end - time) / INSTRUMENTAL_FADE_DURATION, 0, 1);
  }
}

// ---------------------------------------------------------------------------
// Scene construction
// ---------------------------------------------------------------------------

function detectInstrumentalSections(lyrics: LyricEvent[], duration: number): InstrumentalSection[] {
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
        if (event.time - gapStart >= INSTRUMENTAL_MIN_GAP) {
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

  if (gapStart !== null && duration - gapStart >= INSTRUMENTAL_MIN_GAP) {
    gaps.push({ start: gapStart, end: duration });
  }

  const firstLyricStart = Math.min(...lyrics.map((lyric) => lyric.appearStartTime));
  if (firstLyricStart >= INSTRUMENTAL_MIN_GAP) {
    gaps.unshift({ start: 0, end: firstLyricStart });
  }

  return gaps;
}

interface SingerGroup {
  baseColor: CDGColor;
  highlightColor: CDGColor;
}

/**
 * Lyrics palette: index = highlightBit(8) | group * levels + shade. Shade 0 is
 * always the background, so XORing bit 3 on text pixels swaps base/highlight.
 */
function buildLyricsPalette(groups: SingerGroup[], levelsPerGroup: number, background: CDGColor): CDGColor[] {
  const palette: CDGColor[] = new Array(16).fill(background);
  groups.forEach((group, g) => {
    for (let level = 1; level < levelsPerGroup; level++) {
      const t = level / (levelsPerGroup - 1);
      palette[g * levelsPerGroup + level] = lerpColor(background, group.baseColor, t);
      palette[HIGHLIGHT_BIT + g * levelsPerGroup + level] = lerpColor(background, group.highlightColor, t);
    }
  });
  return palette;
}

/**
 * Packets needed to draw a tile (on a cleared screen) for every subset of a
 * group's shades. Index bit `l` set means shade level `l` is used.
 */
function buildShadeCostTable(levelsPerGroup: number, group: number): number[] {
  const costs: number[] = [];
  const empty = new Uint8Array(TILE_PIXELS);
  for (let mask = 0; mask < 1 << levelsPerGroup; mask++) {
    const values = [0];
    for (let level = 1; level < levelsPerGroup; level++) {
      if (mask & (1 << level)) values.push(group * levelsPerGroup + level);
    }
    const tile = new Uint8Array(TILE_PIXELS);
    for (let i = 0; i < TILE_PIXELS; i++) tile[i] = values[i % values.length];
    costs.push(encodeTile(empty, tile).length);
  }
  return costs;
}

// Trade-off between anti-aliasing accuracy and packets: one extra packet per
// tile must buy at least this much squared coverage error (in pixels).
const SHADE_PACKET_COST = 0.35;

/**
 * Quantize text coverage to shade levels, choosing per tile the subset of
 * shades that best balances accuracy against how many packets the tile costs.
 * Most tiles end up drawable with two packets instead of one per bit plane.
 */
function quantizeShadesPerTile(alpha: Uint8Array, top: number, levelsPerGroup: number, costs: number[]): Uint8Array {
  const levels = new Uint8Array(alpha.length);
  const height = alpha.length / SAFE_WIDTH;
  const maxLevel = levelsPerGroup - 1;
  const tileRow0 = Math.floor(top / TILE_HEIGHT);
  const tileRow1 = Math.floor((top + height - 1) / TILE_HEIGHT);
  const pixels: number[] = [];
  const positions: number[] = [];

  for (let tileRow = tileRow0; tileRow <= tileRow1; tileRow++) {
    const y0 = Math.max(0, tileRow * TILE_HEIGHT - top);
    const y1 = Math.min(height, (tileRow + 1) * TILE_HEIGHT - top);
    for (let x0 = 0; x0 < SAFE_WIDTH; x0 += TILE_WIDTH) {
      pixels.length = 0;
      positions.length = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x0 + TILE_WIDTH; x++) {
          const value = alpha[y * SAFE_WIDTH + x];
          if (value > 0) {
            pixels.push((value / 255) * maxLevel);
            positions.push(y * SAFE_WIDTH + x);
          }
        }
      }
      if (pixels.length === 0) continue;

      let bestMask = 0;
      let bestScore = Infinity;
      for (let mask = 0; mask < costs.length; mask += 2) {
        let error = 0;
        for (const shade of pixels) {
          let nearest = shade * shade;
          for (let level = 1; level <= maxLevel; level++) {
            if (mask & (1 << level)) nearest = Math.min(nearest, (shade - level) * (shade - level));
          }
          error += nearest;
        }
        const score = error / (maxLevel * maxLevel) + costs[mask] * SHADE_PACKET_COST;
        if (score < bestScore) {
          bestScore = score;
          bestMask = mask;
        }
      }

      pixels.forEach((shade, i) => {
        let best = 0;
        let bestDistance = shade * shade;
        for (let level = 1; level <= maxLevel; level++) {
          if (bestMask & (1 << level) && (shade - level) * (shade - level) < bestDistance) {
            bestDistance = (shade - level) * (shade - level);
            best = level;
          }
        }
        levels[positions[i]] = best;
      });
    }
  }
  return levels;
}

async function prepareLyricLines(
  lyrics: LyricEvent[],
  linesCount: number,
  background: CDGColor
): Promise<{ linesByNumber: PreparedLine[][]; palette: CDGColor[]; levelsPerGroup: number }> {
  const visible = lyrics.filter((lyric) => lyric.lineNumber >= 0 && lyric.lineNumber < linesCount && lyric.text.trim());

  // Each distinct base/highlight pair gets its own shade ramp: 8 shades for one
  // singer, 4 for two, 2 (no anti-aliasing) for three or four.
  const groups: SingerGroup[] = [];
  const groupIndex = new Map<string, number>();
  for (const lyric of visible) {
    const key = `${colorKey(lyric.baseColor)}/${colorKey(lyric.highlightColor)}`;
    if (!groupIndex.has(key)) {
      groupIndex.set(key, groups.length);
      groups.push({ baseColor: lyric.baseColor, highlightColor: lyric.highlightColor });
    }
  }
  const maxGroups = 4;
  const groupCount = Math.max(1, Math.min(groups.length, maxGroups));
  const levelsPerGroup = groupCount === 1 ? 8 : groupCount === 2 ? 4 : 2;
  const resolveGroup = (lyric: LyricEvent) => {
    const index = groupIndex.get(`${colorKey(lyric.baseColor)}/${colorKey(lyric.highlightColor)}`) ?? 0;
    if (index < maxGroups) return index;
    // Too many singers for the palette: reuse the closest looking one.
    let best = 0;
    let bestDistance = Infinity;
    for (let g = 0; g < maxGroups; g++) {
      const distance =
        cdgColorDistance(groups[g].baseColor, lyric.baseColor) + cdgColorDistance(groups[g].highlightColor, lyric.highlightColor);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = g;
      }
    }
    return best;
  };
  const palette = buildLyricsPalette(groups.slice(0, maxGroups), levelsPerGroup, background);
  const shadeCostTables = Array.from({ length: groupCount }, (_, g) => buildShadeCostTable(levelsPerGroup, g));

  // One font size for the whole song, sized so nearly every line fits; the
  // occasional very long line is shrunk on its own.
  const bandHeight = SAFE_HEIGHT / linesCount;
  const maxFontSize = clamp(Math.round(bandHeight * 0.6), 10, 24);
  const referenceSize = 40;
  const widths = await Promise.all(visible.map((lyric) => measureTextWidth(lyric.text, referenceSize)));
  const sortedWidths = [...widths].sort((a, b) => a - b);
  const typicalWidth = sortedWidths[Math.floor(sortedWidths.length * 0.9)] ?? 0;
  const songFontSize = typicalWidth > 0
    ? clamp(Math.floor((referenceSize * TEXT_MAX_WIDTH) / typicalWidth), 8, maxFontSize)
    : maxFontSize;

  const linesByNumber: PreparedLine[][] = Array.from({ length: linesCount }, () => []);
  await Promise.all(
    visible.map(async (lyric, i) => {
      const top = SAFE_TOP + Math.round(lyric.lineNumber * bandHeight);
      const height = SAFE_TOP + Math.round((lyric.lineNumber + 1) * bandHeight) - top;
      let fontSize = Math.min(songFontSize, Math.floor((referenceSize * TEXT_MAX_WIDTH) / Math.max(1, widths[i])));
      fontSize = await fitFontSize(lyric.text, fontSize, TEXT_MAX_WIDTH);
      const baseline = Math.round(height / 2 + fontSize * 0.36);
      const rendered = await renderTextAlpha(lyric.text, fontSize, SAFE_WIDTH, height, baseline);
      const group = resolveGroup(lyric);
      const levels = quantizeShadesPerTile(rendered.alpha, top, levelsPerGroup, shadeCostTables[group]);
      let inkLeft = SAFE_WIDTH;
      let inkRight = -1;
      for (let p = 0; p < levels.length; p++) {
        if (levels[p]) {
          const x = p % SAFE_WIDTH;
          inkLeft = Math.min(inkLeft, x);
          inkRight = Math.max(inkRight, x);
        }
      }
      if (inkRight < 0) return;
      let inkTiles = 0;
      for (let tileRow = Math.floor(top / TILE_HEIGHT); tileRow <= Math.floor((top + height - 1) / TILE_HEIGHT); tileRow++) {
        for (let x0 = 0; x0 < SAFE_WIDTH; x0 += TILE_WIDTH) {
          let hasInk = false;
          for (let y = Math.max(0, tileRow * TILE_HEIGHT - top); y < Math.min(height, (tileRow + 1) * TILE_HEIGHT - top) && !hasInk; y++) {
            for (let x = x0; x < x0 + TILE_WIDTH && !hasInk; x++) hasInk = levels[y * SAFE_WIDTH + x] > 0;
          }
          if (hasInk) inkTiles++;
        }
      }
      const estimatedDrawSeconds = (inkTiles * 2) / PACKETS_PER_SECOND;
      linesByNumber[lyric.lineNumber].push({
        lyric,
        group,
        top,
        height,
        levels,
        inkLeft,
        inkRight,
        lead: Math.min(MAX_DRAW_LEAD, estimatedDrawSeconds / 2),
      });
    })
  );

  return { linesByNumber, palette, levelsPerGroup };
}

async function buildCardScene(card: TitleCard, color: string, background: CDGColor, end: number): Promise<ImageScene> {
  // Like the preview: first line large, the rest smaller at 80% opacity. Each
  // gets its own 8-shade ramp so the text stays anti-aliased yet cheap to draw.
  const textColor = hexToRGB(color);
  const groups: SingerGroup[] = [
    { baseColor: textColor, highlightColor: lerpColor(background, textColor, 0.8) },
  ];
  const palette = buildLyricsPalette(groups, 8, background);
  for (let level = 1; level < 8; level++) palette[level] = lerpColor(background, textColor, level / 7);
  const costs = [buildShadeCostTable(8, 0), buildShadeCostTable(8, 1)];

  const lines = card.text.split('\n').filter((line) => line.trim());
  const sizes = await Promise.all(lines.map((line, i) => fitFontSize(line, i === 0 ? 24 : 16, TEXT_MAX_WIDTH)));
  const lineHeight = (size: number) => Math.round(size * 1.5);
  const totalHeight = sizes.reduce((sum, size) => sum + lineHeight(size), 0);
  const image = new Uint8Array(CDG_WIDTH * CDG_HEIGHT);
  let top = Math.round((CDG_HEIGHT - totalHeight) / 2);
  for (let i = 0; i < lines.length; i++) {
    const height = lineHeight(sizes[i]);
    if (top >= SAFE_TOP && top + height <= SAFE_TOP + SAFE_HEIGHT) {
      const baseline = Math.round(height / 2 + sizes[i] * 0.36);
      const rendered = await renderTextAlpha(lines[i], sizes[i], SAFE_WIDTH, height, baseline);
      const group = i === 0 ? 0 : 1;
      const levels = quantizeShadesPerTile(rendered.alpha, top, 8, costs[group]);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < SAFE_WIDTH; x++) {
          const level = levels[y * SAFE_WIDTH + x];
          if (level) image[(top + y) * CDG_WIDTH + SAFE_LEFT + x] = group * 8 + level;
        }
      }
    }
    top += height;
  }
  return new ImageScene(palette, image, end, CARD_FADE_DURATION);
}

async function buildInstrumentalScene(
  singer: SingerGroup,
  background: CDGColor,
  start: number,
  end: number
): Promise<InstrumentalScene> {
  const highlight = cdgColorToHex(singer.highlightColor);
  const track = cdgColorToHex(lerpColor(background, singer.baseColor, 0x30 / 255));
  const barWidth = 150;
  const barHeight = 6;
  const barLeft = (CDG_WIDTH - barWidth) / 2;
  const barTop = 120;
  const iconSize = 30;
  const iconTop = barTop - 12 - iconSize;

  // Same music icon as the web preview (24x24 viewBox, stroked).
  const icon = `<g transform="translate(${(CDG_WIDTH - iconSize) / 2} ${iconTop}) scale(${iconSize / 24})"
      fill="none" stroke="${highlight}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </g>`;
  const frame = (filledWidth: number) => `<svg width="${CDG_WIDTH}" height="${CDG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${cdgColorToHex(background)}"/>
    ${icon}
    <rect x="${barLeft}" y="${barTop}" width="${barWidth}" height="${barHeight}" rx="${barHeight / 2}" fill="${track}"/>
    ${filledWidth > 0 ? `<rect x="${barLeft}" y="${barTop}" width="${filledWidth}" height="${barHeight}" rx="${barHeight / 2}" fill="${highlight}"/>` : ''}
  </svg>`;

  const [emptyRgb, fullRgb] = await Promise.all([renderSvgToRgb(frame(0)), renderSvgToRgb(frame(barWidth))]);
  const palette = buildImagePalette([emptyRgb, fullRgb], background);
  return new InstrumentalScene(
    palette,
    mapImageToPalette(emptyRgb, palette),
    mapImageToPalette(fullRgb, palette),
    barLeft,
    barLeft + barWidth,
    start,
    end
  );
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

interface SceneSlot {
  key: string;
  start: number;
  end: number;
  build: () => Promise<Scene>;
}

class CDGGenerator {
  async generate(options: CDGGeneratorOptions): Promise<Buffer> {
    const { duration, linesCount, lyrics, titleCard, endCard, preBuffer = 0, postBuffer = 0 } = options;
    const background = options.backgroundColor ?? BLACK;
    const totalPackets = Math.ceil((preBuffer + duration + postBuffer) * PACKETS_PER_SECOND);

    const prepared = await prepareLyricLines(lyrics, Math.max(1, linesCount), background);
    const lyricsScene = () =>
      new LyricsScene(prepared.palette, prepared.linesByNumber, prepared.levelsPerGroup, preBuffer);
    // The instrumental screen uses the first singer's colors, like the preview.
    const firstSinger: SingerGroup = lyrics[0] ?? { baseColor: { r: 15, g: 15, b: 15 }, highlightColor: { r: 15, g: 15, b: 0 } };

    // Everything is scheduled in CDG time (song time + pre-buffer). Earlier
    // slots take priority, mirroring the preview: cards, then instrumentals.
    const slots: SceneSlot[] = [];
    if (titleCard?.enabled && titleCard.text) {
      const start = titleCard.startTime + preBuffer;
      const end = titleCard.endTime + preBuffer;
      slots.push({ key: 'title', start, end, build: () => buildCardScene(titleCard, TITLE_CARD_COLOR, background, end) });
    }
    if (endCard?.enabled && endCard.text) {
      const start = endCard.startTime + preBuffer;
      const end = endCard.endTime + preBuffer;
      slots.push({ key: 'end', start, end, build: () => buildCardScene(endCard, END_CARD_COLOR, background, end) });
    }
    detectInstrumentalSections(lyrics, duration).forEach((gap, i) => {
      const start = gap.start + INSTRUMENTAL_PADDING + preBuffer;
      const end = gap.end - INSTRUMENTAL_PADDING + preBuffer;
      if (end <= start) return;
      slots.push({ key: `instrumental-${i}`, start, end, build: () => buildInstrumentalScene(firstSinger, background, start, end) });
    });

    const builtScenes = new Map<string, Scene>();
    await Promise.all(slots.map(async (slot) => builtScenes.set(slot.key, await slot.build())));
    const sceneKeyAt = (time: number) => slots.find((slot) => time >= slot.start && time <= slot.end)?.key ?? 'lyrics';

    const output = Buffer.alloc(totalPackets * 24);
    const screen = new Uint8Array(CDG_WIDTH * CDG_HEIGHT);
    const canvas = new Canvas();
    const queue: Instruction[] = [];
    const currentTile = new Uint8Array(TILE_PIXELS);
    const targetTile = new Uint8Array(TILE_PIXELS);

    let sceneKey = '';
    let scene: Scene = lyricsScene();
    let drawnAt: number | null = null;
    let emittedPalette: CDGColor[] | undefined;
    let lastPaletteLoad = -Infinity;

    const writePacket = (packet: number, { instruction, data }: Instruction) => {
      const offset = packet * 24;
      output[offset] = CDG_COMMAND;
      output[offset + 1] = instruction & 0x3f;
      for (let i = 0; i < 16; i++) output[offset + 4 + i] = (data[i] ?? 0) & 0x3f;
    };

    for (let packet = 0; packet < totalPackets; packet++) {
      const time = packet / PACKETS_PER_SECOND;

      const key = sceneKeyAt(time);
      if (key !== sceneKey) {
        sceneKey = key;
        scene = builtScenes.get(key) ?? lyricsScene();
        // Clear first (index 0 is the background in every palette), then swap
        // palettes, so nothing from the old scene flashes in new colors.
        queue.length = 0;
        queue.push(...memoryPresetInstructions(0));
        if (packet === 0) queue.push({ instruction: CDG_INST_BORDER_PRESET, data: [0] });
        screen.fill(0);
        canvas.clear();
        scene.enter(canvas, time, packet);
        drawnAt = null;
        // Always send the whole palette here: loads still queued for the old
        // scene were just dropped.
        const palette = fadePalette(scene.palette, background, scene.opacity(time, drawnAt));
        queue.push(...paletteInstructions(palette));
        emittedPalette = palette;
        lastPaletteLoad = packet;
      } else {
        scene.update(canvas, time, packet);
      }

      if (drawnAt === null && canvas.dirty.size === 0 && queue.length === 0) drawnAt = time;
      if (packet - lastPaletteLoad >= MIN_PACKETS_BETWEEN_PALETTE_LOADS) {
        const palette = fadePalette(scene.palette, background, scene.opacity(time, drawnAt));
        const instructions = paletteInstructions(palette, emittedPalette);
        if (instructions.length > 0) {
          queue.push(...instructions);
          emittedPalette = palette;
          lastPaletteLoad = packet;
        }
      }

      // Pick the most urgent tile that actually differs from what's on screen.
      while (queue.length === 0 && canvas.dirty.size > 0) {
        let bestTile = -1;
        let best: DirtyTile | undefined;
        for (const [tile, entry] of canvas.dirty) {
          if (!best || entry.deadline < best.deadline || (entry.deadline === best.deadline && entry.order < best.order)) {
            best = entry;
            bestTile = tile;
          }
        }
        canvas.dirty.delete(bestTile);
        readTile(screen, bestTile, currentTile);
        readTile(canvas.desired, bestTile, targetTile);
        const ops = encodeTile(currentTile, targetTile);
        for (const op of ops) {
          applyTileOp(currentTile, op);
          queue.push(tileInstruction(op, bestTile));
        }
        writeTile(screen, bestTile, currentTile);
      }

      const next = queue.shift();
      if (next) writePacket(packet, next);
    }

    return output;
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
  return new CDGGenerator().generate(options);
}

export type { CDGColor, LyricEvent, TitleCard, CDGGeneratorOptions };
