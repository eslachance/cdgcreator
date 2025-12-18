import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function formatTimeWithSign(seconds: number): string {
  const isNegative = seconds < 0;
  const absSeconds = Math.abs(seconds);
  const mins = Math.floor(absSeconds / 60);
  const secs = Math.floor(absSeconds % 60);
  const ms = Math.floor((absSeconds % 1) * 100);
  const sign = isNegative ? '-' : '';
  return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function parseTime(timeStr: string): number {
  const match = timeStr.match(/^(\d+):(\d+)(?:\.(\d+))?$/);
  if (!match) return 0;
  const [, mins, secs, ms = '0'] = match;
  return parseInt(mins) * 60 + parseInt(secs) + parseInt(ms.padEnd(2, '0')) / 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

