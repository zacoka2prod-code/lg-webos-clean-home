import {it, expect, vi} from 'vitest';
import {createCleanHome} from '../src/js/clean-home.js';
it('restores the dock and weather after delayed native scrolling', () => {
 vi.useFakeTimers();
 vi.stubGlobal('requestAnimationFrame', fn => setTimeout(fn, 16));
 document.body.innerHTML='<div id="app-grid-shell"><div id="app-grid"><button class="app-tile" data-focus-index="0" data-app-id="test"></button></div></div>' + ['clean-shelf-title','clean-ambient','clean-focus','clean-inputs-panel','clean-inputs-btn','clean-network-btn','clean-greeting','clean-app-count'].map(id=>'<div id="'+id+'"></div>').join('');
 createCleanHome({focus:{focusElement:vi.fn()},onNetwork:vi.fn()});
 const shell=document.getElementById('app-grid-shell');
 shell.scrollTop=202; document.body.classList.add('clean-grid-browsing');
 document.querySelector('.app-tile').focus();
 shell.scrollTop=156; // WAM's delayed focus-scroll completion.
 vi.advanceTimersByTime(300);
 expect(shell.scrollTop).toBe(0);
 expect(document.body.classList.contains('clean-grid-browsing')).toBe(false);
 vi.useRealTimers();vi.unstubAllGlobals();
});
