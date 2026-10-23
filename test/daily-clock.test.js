import {it, expect} from 'vitest';
import {paintDailyClock} from '../src/js/daily-clock.js';
it('does not display yesterday saint or verse after midnight', () => {
 const el=document.createElement('div');
 el.innerHTML='<span class="clean-saint-name"></span><span class="clean-daily-verse"></span><span class="clean-daily-reference"></span>';
 const data={date:'2026-10-23',saintDate:'2026-10-23',saint:'Saint Jean de Capistran',verse:'Test',reference:'Philippiens 4:4',edition:'Louis Segond 1910'};
 paintDailyClock(el,data,new Date(2026,9,23,21,20));
 expect(el.querySelector('.clean-saint-name').textContent).toBe(data.saint);
 paintDailyClock(el,data,new Date(2026,9,24,0,0));
 expect(el.querySelector('.clean-saint-name').textContent).toBe('Actualisation…');
 expect(el.querySelector('.clean-daily-reference').textContent).toBe('');
});
it('renders endpoint text as text and never as markup', () => {
 const el=document.createElement('div');
 el.innerHTML='<span class="clean-saint-name"></span><span class="clean-daily-verse"></span><span class="clean-daily-reference"></span>';
 paintDailyClock(el,{date:'2026-10-23',saintDate:'2026-10-23',saint:'<img src=x onerror=alert(1)>',verse:'<script>bad()</script>',reference:'Test',edition:'Test'},new Date(2026,9,23));
 expect(el.querySelectorAll('img,script').length).toBe(0);
});
