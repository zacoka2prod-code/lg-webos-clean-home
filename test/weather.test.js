import {describe, expect, it} from 'vitest';
import {buildHours, renderPanel} from '../src/js/weather.js';

function forecast() {
  return {utc_offset_seconds: 7200,
    current: {temperature_2m: 12, weather_code: 61, is_day: 1, wind_speed_10m: 31},
    daily: {time: ['2026-10-23'], weather_code: [61], temperature_2m_max: [15], temperature_2m_min: [8]},
    hourly: {time: ['2026-10-23T22:00','2026-10-23T23:00','2026-10-24T00:00','2026-10-24T01:00','2026-10-24T02:00','2026-10-24T03:00','2026-10-24T04:00'], temperature_2m: [12,11,10,9,8,8,8], weather_code: [61,61,3,3,2,0,0], is_day: [0,0,0,0,0,0,0], precipitation: [.2,.3,0,0,0,0,0]}};
}
const cfg = {units: 'c', location: {name: 'Amiens, France'}};
describe('hourly weather card', () => {
  it('uses forecast local time and crosses midnight without repeating days', () => {
    const hours = buildHours(forecast(), Date.parse('2026-10-23T21:30:00Z'));
    expect(hours.map(h => h.time)).toEqual(['23 h','00 h','01 h','02 h','03 h','04 h']);
    expect(hours[0].temperature).toBe(11);
  });
  it('renders current rain/wind, then switches to the night scene', () => {
    const d = forecast();
    const today = new Date(Date.now()+7200000).toISOString().slice(0,10);
    d.daily.time = [today];
    d.hourly.time = Array.from({length: 6},(_,i)=> today+'T'+String(18+i).padStart(2,'0')+':00');
    const el = document.createElement('section');
    expect(renderPanel(el,d,cfg)).toBe(true);
    expect(el.classList.contains('weather-rain')).toBe(true);
    expect(el.classList.contains('weather-windy')).toBe(true);
    expect(el.querySelector('.weather-city').textContent).toBe('Amiens');
    d.current.is_day = 0; d.current.weather_code = 0;
    renderPanel(el,d,cfg);
    expect(el.classList.contains('weather-night')).toBe(true);
    expect(el.classList.contains('weather-rain')).toBe(false);
  });
});
