import {describe, expect, it} from 'vitest';
import {REMOTE_KEY, isHomeApp} from '../src/js/remote.js';

describe('test harness', () => {
  it('runs project ES modules', () => {
    expect(REMOTE_KEY.LEFT).toBe(37);
    expect(REMOTE_KEY.ENTER).toBe(13);
  });

  it('exposes a jsdom document', () => {
    expect(typeof document).toBe('object');
    const el = document.createElement('div');
    expect(el.tagName).toBe('DIV');
  });

  it('evaluates a pure function', () => {
    expect(isHomeApp('com.webos.app.home')).toBe(true);
    expect(isHomeApp('netflix')).toBe(false);
  });
});
