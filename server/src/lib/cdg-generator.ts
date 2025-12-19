/**
 * CDG (CD+Graphics) File Generator
 * 
 * Based on specifications from:
 * - https://jbum.com/cdg_revealed.html
 * - https://goughlui.com/2019/03/31/tech-flashback-the-cdgraphics-format-cdg/
 */

const CDG_COMMAND = 0x09;
const PACKETS_PER_SECOND = 300;
const SCREEN_WIDTH = 300;
const SCREEN_HEIGHT = 216;
const TILE_WIDTH = 6;
const TILE_HEIGHT = 12;
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

function scaleFont2x(fontData: number[]): number[][] {
  const result: number[][] = [[], [], [], []];
  
  for (let row = 0; row < 12; row++) {
    const srcByte = fontData[row];
    const destRow = Math.floor(row / 6);
    const localRow = (row % 6) * 2;
    
    let leftByte = 0;
    let rightByte = 0;
    
    for (let bit = 5; bit >= 0; bit--) {
      const isSet = (srcByte >> bit) & 1;
      const destBit = (5 - bit) * 2;
      
      if (destBit < 6) {
        if (isSet) {
          leftByte |= (1 << (5 - destBit));
          leftByte |= (1 << (5 - destBit - 1));
        }
      } else {
        const rightBit = destBit - 6;
        if (isSet) {
          rightByte |= (1 << (5 - rightBit));
          if (rightBit + 1 < 6) {
            rightByte |= (1 << (5 - rightBit - 1));
          }
        }
      }
    }
    
    if (result[destRow * 2].length <= localRow) {
      result[destRow * 2].push(leftByte);
      result[destRow * 2].push(leftByte);
    }
    if (result[destRow * 2 + 1].length <= localRow) {
      result[destRow * 2 + 1].push(rightByte);
      result[destRow * 2 + 1].push(rightByte);
    }
  }
  
  return result;
}

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

class CDGGenerator {
  private packets: Buffer[] = [];
  private currentPacket = 0;
  private useDoubleSize = true;

  private createPacket(instruction: number, data: number[]): Buffer {
    const packet = Buffer.alloc(24);
    packet[0] = CDG_COMMAND;
    packet[1] = instruction & 0x3F;
    for (let i = 0; i < 16 && i < data.length; i++) {
      packet[4 + i] = data[i] & 0x3F;
    }
    return packet;
  }

  private addEmptyPackets(count: number) {
    for (let i = 0; i < count; i++) {
      this.packets.push(Buffer.alloc(24));
      this.currentPacket++;
    }
  }

  private seekToTime(timeSeconds: number) {
    const targetPacket = Math.floor(timeSeconds * PACKETS_PER_SECOND);
    if (targetPacket > this.currentPacket) {
      this.addEmptyPackets(targetPacket - this.currentPacket);
    }
  }

  private setColorTable(colors: CDGColor[]) {
    const lowData: number[] = [];
    for (let i = 0; i < 8; i++) {
      const color = colors[i] || { r: 0, g: 0, b: 0 };
      lowData.push((color.r << 2) | ((color.g >> 2) & 0x03));
      lowData.push(((color.g & 0x03) << 4) | color.b);
    }
    this.packets.push(this.createPacket(CDG_INST_LOAD_CLUT_LOW, lowData));
    this.currentPacket++;

    const highData: number[] = [];
    for (let i = 8; i < 16; i++) {
      const color = colors[i] || { r: 0, g: 0, b: 0 };
      highData.push((color.r << 2) | ((color.g >> 2) & 0x03));
      highData.push(((color.g & 0x03) << 4) | color.b);
    }
    this.packets.push(this.createPacket(CDG_INST_LOAD_CLUT_HIGH, highData));
    this.currentPacket++;
  }

  private memoryPreset(colorIndex: number, repeat: number = 0) {
    for (let i = 0; i < 16; i++) {
      const data = [colorIndex & 0x0F, i, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      this.packets.push(this.createPacket(CDG_INST_MEMORY_PRESET, data));
      this.currentPacket++;
    }
  }

  private borderPreset(colorIndex: number) {
    const data = [colorIndex & 0x0F, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.packets.push(this.createPacket(CDG_INST_BORDER_PRESET, data));
    this.currentPacket++;
  }

  private drawTile(row: number, col: number, color0: number, color1: number, pixels: number[]) {
    if (row < 0 || row >= TILES_DOWN || col < 0 || col >= TILES_ACROSS) return;
    const data = [
      color0 & 0x0F,
      color1 & 0x0F,
      row & 0x1F,
      col & 0x3F,
      ...pixels.slice(0, 12).map(p => p & 0x3F)
    ];
    this.packets.push(this.createPacket(CDG_INST_TILE_BLOCK, data));
    this.currentPacket++;
  }

  private drawCharacterSingle(char: string, tileCol: number, tileRow: number, fgColor: number, bgColor: number) {
    const fontData = FONT_6x12[char] || FONT_6x12[char.toUpperCase()] || FONT_6x12[' '];
    this.drawTile(tileRow, tileCol, bgColor, fgColor, fontData);
  }

  private drawCharacterDouble(char: string, tileCol: number, tileRow: number, fgColor: number, bgColor: number) {
    const fontData = FONT_6x12[char] || FONT_6x12[char.toUpperCase()] || FONT_6x12[' '];
    const scaled = scaleFont2x(fontData);
    
    this.drawTile(tileRow, tileCol, bgColor, fgColor, scaled[0]);
    this.drawTile(tileRow, tileCol + 1, bgColor, fgColor, scaled[1]);
    this.drawTile(tileRow + 1, tileCol, bgColor, fgColor, scaled[2]);
    this.drawTile(tileRow + 1, tileCol + 1, bgColor, fgColor, scaled[3]);
  }

  private getTextWidth(text: string): number {
    return this.useDoubleSize ? text.length * 2 : text.length;
  }

  private getCharHeight(): number {
    return this.useDoubleSize ? 2 : 1;
  }

  private drawTextCentered(text: string, centerRow: number, fgColor: number, bgColor: number) {
    const textWidth = this.getTextWidth(text);
    const startCol = Math.max(1, Math.floor((TILES_ACROSS - textWidth) / 2));
    
    for (let i = 0; i < text.length; i++) {
      if (this.useDoubleSize) {
        const col = startCol + i * 2;
        if (col + 1 < TILES_ACROSS - 1) {
          this.drawCharacterDouble(text[i], col, centerRow, fgColor, bgColor);
        }
      } else {
        const col = startCol + i;
        if (col < TILES_ACROSS - 1) {
          this.drawCharacterSingle(text[i], col, centerRow, fgColor, bgColor);
        }
      }
    }
  }

  private drawTextOnLine(text: string, lineNumber: number, linesCount: number, fgColor: number, bgColor: number) {
    const charHeight = this.getCharHeight();
    const usableRows = TILES_DOWN - 2;
    const rowsPerLine = Math.floor(usableRows / linesCount);
    const startRow = 1 + lineNumber * rowsPerLine + Math.floor((rowsPerLine - charHeight) / 2);
    
    this.drawTextCentered(text, startRow, fgColor, bgColor);
  }

  private drawTextWithHighlight(
    text: string, 
    lineNumber: number, 
    linesCount: number, 
    baseColor: number, 
    highlightColor: number, 
    bgColor: number,
    highlightProgress: number
  ) {
    const charHeight = this.getCharHeight();
    const usableRows = TILES_DOWN - 2;
    const rowsPerLine = Math.floor(usableRows / linesCount);
    const startRow = 1 + lineNumber * rowsPerLine + Math.floor((rowsPerLine - charHeight) / 2);
    
    const textWidth = this.getTextWidth(text);
    const startCol = Math.max(1, Math.floor((TILES_ACROSS - textWidth) / 2));
    const highlightChars = Math.floor(text.length * highlightProgress);
    
    for (let i = 0; i < text.length; i++) {
      const color = i < highlightChars ? highlightColor : baseColor;
      if (this.useDoubleSize) {
        const col = startCol + i * 2;
        if (col + 1 < TILES_ACROSS - 1) {
          this.drawCharacterDouble(text[i], col, startRow, color, bgColor);
        }
      } else {
        const col = startCol + i;
        if (col < TILES_ACROSS - 1) {
          this.drawCharacterSingle(text[i], col, startRow, color, bgColor);
        }
      }
    }
  }

  private clearLine(lineNumber: number, linesCount: number, bgColor: number) {
    const charHeight = this.getCharHeight();
    const usableRows = TILES_DOWN - 2;
    const rowsPerLine = Math.floor(usableRows / linesCount);
    const startRow = 1 + lineNumber * rowsPerLine + Math.floor((rowsPerLine - charHeight) / 2);
    
    for (let row = startRow; row < startRow + charHeight && row < TILES_DOWN - 1; row++) {
      for (let col = 1; col < TILES_ACROSS - 1; col++) {
        this.drawTile(row, col, bgColor, bgColor, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      }
    }
  }

  private drawProgressBar(progress: number, row: number, fgColor: number, bgColor: number) {
    const barWidth = 36;
    const startCol = Math.floor((TILES_ACROSS - barWidth) / 2);
    const filledTiles = Math.floor(barWidth * progress);
    
    for (let col = 0; col < barWidth; col++) {
      const tileCol = startCol + col;
      if (col < filledTiles) {
        this.drawTile(row, tileCol, bgColor, fgColor, [
          0x00, 0x00, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x00, 0x00
        ]);
      } else if (col === filledTiles) {
        const partialProgress = (barWidth * progress) - filledTiles;
        const pixelsFilled = Math.floor(6 * partialProgress);
        const mask = pixelsFilled > 0 ? (0x3F << (6 - pixelsFilled)) & 0x3F : 0;
        this.drawTile(row, tileCol, bgColor, fgColor, [
          0x00, 0x00, mask, mask, mask, mask, mask, mask, mask, mask, 0x00, 0x00
        ]);
      } else {
        this.drawTile(row, tileCol, bgColor, fgColor, [
          0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00
        ]);
      }
    }
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

  generate(options: CDGGeneratorOptions): Buffer {
    const { duration, linesCount, lyrics, titleCard, endCard, backgroundColor, preBuffer = 0, postBuffer = 0 } = options;
    
    const totalDuration = preBuffer + duration + postBuffer;
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
    
    this.setColorTable(colors);
    this.memoryPreset(0);
    this.borderPreset(0);
    this.addEmptyPackets(10);
    
    const instrumentalSections = this.detectInstrumentalSections(lyrics, duration);
    
    if (titleCard?.enabled && titleCard.text) {
      const cardStartTime = titleCard.startTime + preBuffer;
      const cardEndTime = titleCard.endTime + preBuffer;
      
      this.seekToTime(Math.max(0.1, cardStartTime));
      this.memoryPreset(0);
      
      const lines = titleCard.text.split('\n').filter(l => l.trim());
      const totalHeight = lines.length * this.getCharHeight();
      const startRow = Math.floor((TILES_DOWN - totalHeight) / 2);
      
      lines.forEach((line, idx) => {
        const row = startRow + idx * this.getCharHeight();
        this.drawTextCentered(line.toUpperCase(), row, 1, 0);
      });
      
      this.seekToTime(cardEndTime);
      this.memoryPreset(0);
    }
    
    const lineState: Map<number, { text: string; lastHighlightChars: number }> = new Map();
    let currentInstrumental: InstrumentalSection | null = null;
    let lastProgressUpdate = -1;
    
    const timeSlice = 0.1;
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
            this.seekToTime(adjustedTime);
            this.memoryPreset(0);
            
            const iconRow = Math.floor(TILES_DOWN / 2) - 2;
            this.drawTextCentered('♪', iconRow, 1, 0);
          }
          
          const progressRow = Math.floor(TILES_DOWN / 2) + 2;
          const progressPercent = Math.floor(instrumentalProgress * 100);
          if (progressPercent !== lastProgressUpdate) {
            this.seekToTime(adjustedTime);
            this.drawProgressBar(instrumentalProgress, progressRow, 1, 0);
            lastProgressUpdate = progressPercent;
          }
          break;
        }
      }
      
      if (!inInstrumental) {
        if (currentInstrumental !== null) {
          this.seekToTime(adjustedTime);
          this.memoryPreset(0);
          currentInstrumental = null;
          lastProgressUpdate = -1;
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
            this.seekToTime(adjustedTime);
            this.drawTextWithHighlight(
              lyric.text.toUpperCase(),
              lyric.lineNumber,
              linesCount,
              baseColorIdx,
              highlightColorIdx,
              0,
              highlightProgress
            );
            lineState.set(lyric.lineNumber, { text: lyric.text, lastHighlightChars: highlightChars });
          }
        }
        
        for (const [lineNum] of lineState.entries()) {
          if (!activeLyrics.some(l => l.lineNumber === lineNum)) {
            this.seekToTime(adjustedTime);
            this.clearLine(lineNum, linesCount, 0);
            lineState.delete(lineNum);
          }
        }
      }
    }
    
    if (endCard?.enabled && endCard.text) {
      const cardStartTime = endCard.startTime + preBuffer;
      const cardEndTime = Math.min(endCard.endTime + preBuffer, totalDuration - 0.1);
      
      this.seekToTime(cardStartTime);
      this.memoryPreset(0);
      
      const lines = endCard.text.split('\n').filter(l => l.trim());
      const totalHeight = lines.length * this.getCharHeight();
      const startRow = Math.floor((TILES_DOWN - totalHeight) / 2);
      
      lines.forEach((line, idx) => {
        const row = startRow + idx * this.getCharHeight();
        this.drawTextCentered(line.toUpperCase(), row, 1, 0);
      });
    }
    
    this.seekToTime(totalDuration);
    
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

export function generateCDG(options: CDGGeneratorOptions): Buffer {
  const generator = new CDGGenerator();
  return generator.generate(options);
}

export type { CDGColor, LyricEvent, TitleCard, CDGGeneratorOptions };
