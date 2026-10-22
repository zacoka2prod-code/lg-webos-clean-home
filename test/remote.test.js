// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {REMOTE_KEY, digitFromKey} from '../src/js/remote.js';

describe('remote key table', () => {
  it('defines the Channel Up / Channel Down keycodes', () => {
    expect(REMOTE_KEY.CHANNEL_UP).toBe(427);
    expect(REMOTE_KEY.CHANNEL_DOWN).toBe(428);
  });
});

describe('digitFromKey', () => {
  it('maps the digit row (1-9 = 49-57, 0 = 48)', () => {
    expect(digitFromKey(48)).toBe(0);
    for (let n = 1; n <= 9; n += 1) {
      expect(digitFromKey(48 + n)).toBe(n);
    }
  });

  it('maps the numeric keypad (0-9 = 96-105)', () => {
    expect(digitFromKey(96)).toBe(0);
    for (let n = 1; n <= 9; n += 1) {
      expect(digitFromKey(96 + n)).toBe(n);
    }
  });

  it('maps a single-character key when no code matches', () => {
    expect(digitFromKey(0, '7')).toBe(7);
    expect(digitFromKey(undefined, '0')).toBe(0);
  });

  it('prefers the key over the code', () => {
    expect(digitFromKey(49, '3')).toBe(3);
  });

  it('returns -1 for non-number keys', () => {
    expect(digitFromKey(37)).toBe(-1);
    expect(digitFromKey(13)).toBe(-1);
    expect(digitFromKey(undefined)).toBe(-1);
    expect(digitFromKey(0, 'a')).toBe(-1);
  });

  it('falls back to the code when the key is not a digit character', () => {
    // Shift+1 reports key "!" but the digit-row code 49.
    expect(digitFromKey(49, '!')).toBe(1);
  });
});
