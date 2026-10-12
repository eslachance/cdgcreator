import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import os from 'os';
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const FPS = 30;
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : { r: 255, g: 255, b: 255 };
}
function detectInstrumentalSections(lyrics, duration) {
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
    const sortedByStart = [...lyrics].sort((a, b) => a.appearStartTime - b.appearStartTime);
    if (sortedByStart.length > 0) {
        const firstLyricStart = sortedByStart[0].appearStartTime;
        if (firstLyricStart >= MIN_GAP) {
            gaps.unshift({ start: 0, end: firstLyricStart });
        }
    }
    return gaps;
}
function getCurrentInstrumental(currentTime, instrumentalGaps) {
    const PADDING = 1;
    const FADE_DURATION = 1;
    for (const gap of instrumentalGaps) {
        const displayStart = gap.start + PADDING;
        const displayEnd = gap.end - PADDING;
        if (displayEnd <= displayStart)
            continue;
        if (currentTime >= displayStart && currentTime <= displayEnd) {
            const totalDisplayTime = displayEnd - displayStart;
            const elapsed = currentTime - displayStart;
            const remaining = displayEnd - currentTime;
            const progress = elapsed / totalDisplayTime;
            let opacity = 1;
            if (elapsed < FADE_DURATION) {
                opacity = elapsed / FADE_DURATION;
            }
            else if (remaining < FADE_DURATION) {
                opacity = remaining / FADE_DURATION;
            }
            return { progress, opacity };
        }
    }
    return null;
}
function getVisibleLyrics(currentTime, lyrics, singers, showCard) {
    const lineMap = new Map();
    if (showCard)
        return lineMap;
    const FADE_DURATION = 0.2;
    for (const lyric of lyrics) {
        if (currentTime >= lyric.appearStartTime && currentTime <= lyric.appearEndTime) {
            const singer = singers.find((s) => s.id === lyric.singerId);
            if (!singer)
                continue;
            let highlightProgress = 0;
            if (currentTime >= lyric.highlightStartTime && currentTime <= lyric.highlightEndTime) {
                const highlightDuration = lyric.highlightEndTime - lyric.highlightStartTime;
                highlightProgress = (currentTime - lyric.highlightStartTime) / highlightDuration;
            }
            else if (currentTime > lyric.highlightEndTime) {
                highlightProgress = 1;
            }
            let opacity = 1;
            const timeSinceAppear = currentTime - lyric.appearStartTime;
            const timeUntilDisappear = lyric.appearEndTime - currentTime;
            if (timeSinceAppear < FADE_DURATION) {
                opacity = timeSinceAppear / FADE_DURATION;
            }
            else if (timeUntilDisappear < FADE_DURATION) {
                opacity = timeUntilDisappear / FADE_DURATION;
            }
            const existing = lineMap.get(lyric.lineNumber);
            if (!existing || lyric.appearStartTime > existing.appearStartTime) {
                lineMap.set(lyric.lineNumber, { ...lyric, singer, highlightProgress, opacity });
            }
        }
    }
    return lineMap;
}
function createSvgFrame(currentTime, options, instrumentalGaps) {
    const { linesCount, lyrics, singers, titleCard, endCard } = options;
    const showTitleCard = titleCard?.enabled &&
        currentTime >= titleCard.startTime &&
        currentTime <= titleCard.endTime;
    const showEndCard = endCard?.enabled &&
        currentTime >= endCard.startTime &&
        currentTime <= endCard.endTime;
    let content = '';
    if (showTitleCard && titleCard) {
        content = createCardSvg(currentTime, titleCard, 'title');
    }
    else if (showEndCard && endCard) {
        content = createCardSvg(currentTime, endCard, 'end');
    }
    else {
        const currentInstrumental = getCurrentInstrumental(currentTime, instrumentalGaps);
        if (currentInstrumental) {
            content = createInstrumentalSvg(currentInstrumental, singers);
        }
        else {
            const visibleLyrics = getVisibleLyrics(currentTime, lyrics, singers, false);
            content = createLyricsSvg(visibleLyrics, linesCount);
        }
    }
    return `<svg width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="black"/>
    <style>
      text {
        font-family: Arial, sans-serif;
        font-weight: bold;
      }
    </style>
    ${content}
  </svg>`;
}
function createCardSvg(currentTime, card, type) {
    const lines = card.text.split('\n');
    const isPurple = type === 'title';
    const baseColor = isPurple ? '#c084fc' : '#fbbf24';
    const FADE_DURATION = 0.3;
    const timeSinceStart = currentTime - card.startTime;
    const timeUntilEnd = card.endTime - currentTime;
    let cardOpacity = 1;
    if (timeSinceStart < FADE_DURATION) {
        cardOpacity = timeSinceStart / FADE_DURATION;
    }
    else if (timeUntilEnd < FADE_DURATION) {
        cardOpacity = timeUntilEnd / FADE_DURATION;
    }
    cardOpacity = Math.max(0, Math.min(1, cardOpacity));
    const lineHeight = 60;
    const totalHeight = lines.length * lineHeight;
    const startY = (VIDEO_HEIGHT - totalHeight) / 2 + 40;
    return lines.map((line, i) => {
        const fontSize = i === 0 ? 52 : 38;
        const alpha = i === 0 ? cardOpacity : cardOpacity * 0.8;
        return `<text x="${VIDEO_WIDTH / 2}" y="${startY + i * lineHeight}" 
      text-anchor="middle" 
      fill="${baseColor}" 
      fill-opacity="${alpha}"
      font-size="${fontSize}"
      filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.8))"
    >${escapeXml(line)}</text>`;
    }).join('\n');
}
function createInstrumentalSvg(instrumental, singers) {
    const singer = singers[0];
    const highlightColor = singer?.highlightColor || '#FFFF00';
    const baseColor = singer?.baseColor || '#FFFFFF';
    const opacity = Math.max(0, Math.min(1, instrumental.opacity));
    const iconY = VIDEO_HEIGHT / 2 - 30;
    const barWidth = VIDEO_WIDTH * 0.5;
    const barHeight = 14;
    const barX = (VIDEO_WIDTH - barWidth) / 2;
    const barY = VIDEO_HEIGHT / 2 + 40;
    const filledWidth = Math.max(0, Math.min(barWidth, barWidth * instrumental.progress));
    const baseRgb = hexToRgb(baseColor);
    return `
    <text x="${VIDEO_WIDTH / 2}" y="${iconY}" 
      text-anchor="middle" 
      fill="${highlightColor}" 
      fill-opacity="${opacity}"
      font-size="72"
    >♪</text>
    <rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" 
      rx="7" ry="7"
      fill="rgba(${baseRgb.r},${baseRgb.g},${baseRgb.b},${opacity * 0.3})"
    />
    <rect x="${barX}" y="${barY}" width="${filledWidth}" height="${barHeight}" 
      rx="7" ry="7"
      fill="${highlightColor}"
      fill-opacity="${opacity}"
    />
  `;
}
function createLyricsSvg(visibleLyrics, linesCount) {
    const lineHeight = VIDEO_HEIGHT / linesCount;
    let svg = '';
    for (let lineIndex = 0; lineIndex < linesCount; lineIndex++) {
        const lyricData = visibleLyrics.get(lineIndex);
        if (lyricData) {
            const y = lineHeight * lineIndex + lineHeight / 2 + 10;
            const fontSize = Math.min(52, Math.max(28, 220 / linesCount));
            const opacity = Math.max(0, Math.min(1, lyricData.opacity));
            const text = lyricData.text;
            const baseColor = lyricData.singer.baseColor;
            const highlightColor = lyricData.singer.highlightColor;
            const charWidth = fontSize * 0.6;
            const textWidth = text.length * charWidth;
            const startX = (VIDEO_WIDTH - textWidth) / 2;
            if (lyricData.highlightProgress > 0 && lyricData.highlightProgress < 1) {
                const clipWidth = textWidth * lyricData.highlightProgress;
                const clipId = `clip-${lineIndex}`;
                svg += `
          <defs>
            <clipPath id="${clipId}">
              <rect x="${startX}" y="${y - fontSize}" width="${clipWidth}" height="${fontSize * 2}"/>
            </clipPath>
          </defs>
          <text x="${VIDEO_WIDTH / 2}" y="${y}" 
            text-anchor="middle" 
            fill="${baseColor}" 
            fill-opacity="${opacity}"
            font-size="${fontSize}"
            filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.8))"
          >${escapeXml(text)}</text>
          <text x="${VIDEO_WIDTH / 2}" y="${y}" 
            text-anchor="middle" 
            fill="${highlightColor}" 
            fill-opacity="${opacity}"
            font-size="${fontSize}"
            clip-path="url(#${clipId})"
            filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.8))"
          >${escapeXml(text)}</text>
        `;
            }
            else {
                const color = lyricData.highlightProgress >= 1 ? highlightColor : baseColor;
                svg += `
          <text x="${VIDEO_WIDTH / 2}" y="${y}" 
            text-anchor="middle" 
            fill="${color}" 
            fill-opacity="${opacity}"
            font-size="${fontSize}"
            filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.8))"
          >${escapeXml(text)}</text>
        `;
            }
        }
    }
    return svg;
}
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
export function calculateTotalFrames(duration, preBuffer, postBuffer) {
    const totalDuration = preBuffer + duration + postBuffer;
    return Math.ceil(totalDuration * FPS);
}
export async function generateVideo(options) {
    const { duration, preBuffer, postBuffer, audioPath, outputPath, lyrics, onProgress, titleCard, endCard } = options;
    const totalDuration = preBuffer + duration + postBuffer;
    const totalFrames = Math.ceil(totalDuration * FPS);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'karaoke-video-'));
    const framesDir = path.join(tempDir, 'frames');
    fs.mkdirSync(framesDir, { recursive: true });
    const instrumentalGaps = detectInstrumentalSections(lyrics, duration);
    console.log(`Generating ${totalFrames} frames (${duration}s + ${preBuffer}s pre + ${postBuffer}s post)`);
    if (titleCard?.enabled) {
        console.log(`Title card: ${titleCard.startTime}s to ${titleCard.endTime}s`);
    }
    if (endCard?.enabled) {
        console.log(`End card: ${endCard.startTime}s to ${endCard.endTime}s`);
    }
    onProgress?.('generating', 0, 0);
    for (let frame = 0; frame < totalFrames; frame++) {
        const currentTime = (frame / FPS) - preBuffer;
        const svg = createSvgFrame(currentTime, options, instrumentalGaps);
        const frameBuffer = await sharp(Buffer.from(svg))
            .png()
            .toBuffer();
        const framePath = path.join(framesDir, `frame_${String(frame).padStart(6, '0')}.png`);
        fs.writeFileSync(framePath, frameBuffer);
        const progress = Math.round((frame / totalFrames) * 100);
        if (frame % 10 === 0) {
            onProgress?.('generating', progress, frame);
        }
        if (frame % 100 === 0) {
            console.log(`Generating: ${progress}%`);
        }
    }
    onProgress?.('generating', 100, totalFrames);
    console.log('Encoding video...');
    onProgress?.('encoding', 0);
    await new Promise((resolve, reject) => {
        const framePattern = path.join(framesDir, 'frame_%06d.png');
        ffmpeg()
            .input(framePattern)
            .inputFPS(FPS)
            .input(audioPath)
            .outputOptions([
            '-c:v libx264',
            '-preset medium',
            '-crf 23',
            '-pix_fmt yuv420p',
            '-c:a aac',
            '-b:a 192k',
            '-shortest',
        ])
            .output(outputPath)
            .on('progress', (progress) => {
            if (progress.percent) {
                const percent = Math.round(progress.percent);
                onProgress?.('encoding', percent);
                console.log(`Encoding: ${percent}%`);
            }
        })
            .on('end', () => {
            console.log('Video encoding complete!');
            onProgress?.('encoding', 100);
            fs.rmSync(tempDir, { recursive: true, force: true });
            resolve();
        })
            .on('error', (err) => {
            console.error('FFmpeg error:', err);
            fs.rmSync(tempDir, { recursive: true, force: true });
            reject(err);
        })
            .run();
    });
}
