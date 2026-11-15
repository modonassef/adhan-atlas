// Compares the app's prayer times with the timetables the authorities themselves publish.
//   node src/tools/check-times.js            every city in official-times.json
//   node src/tools/check-times.js istanbul   only the cities whose name contains the word
// Each row of official-times.json is one city on one day, copied from the source it names. The app's time is
// worked out exactly as the map does it (same core.js, same method and Asr rule for the country) and rounded
// to the minute it would show. The run fails if any time is further out than the row allows ("within",
// one minute unless the row says otherwise; a row can also set "known" to explain a difference left as it is).
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..');
const core = new Function(fs.readFileSync(path.join(src, 'core.js'), 'utf8') + '\nreturn { METHODS, EVENTS, prayerTimes, localMethod };')();
const template = fs.readFileSync(path.join(src, 'template.html'), 'utf8').replace(/\r\n/g, '\n');
function stmt(name) {
  const a = template.indexOf(`\nconst ${name} = `);
  if (a < 0) throw new Error(`"const ${name}" not found in template.html`);
  return template.slice(a + 1, template.indexOf(';\n', a) + 1);
}
const value = name => new Function(`${stmt(name)}\nreturn ${name};`)();
const CITIES = value('CITIES'), COUNTRY_METHOD = value('COUNTRY_METHOD'), COUNTRY_ASR = value('COUNTRY_ASR');
const places = JSON.parse(fs.readFileSync(path.join(src, 'data/cities.json'), 'utf8'));
const TOWNS = places.rows.split('\n').map(r => {
  const [name, lat, lon, tz, cc, pop, , big] = r.split(';');
  return { name, lat: +lat, lon: +lon, tz: places.tz[tz], cc, pop: Math.max(+pop, +big || 0) };
});
// the place as the app itself has it: a featured city first, then the largest town of that name in the country
function find(name, cc) {
  for (const [, list] of CITIES) for (const [n, lat, lon, tz] of list) if (n === name) return { lat, lon, tz };
  const hit = TOWNS.filter(t => t.name === name && t.cc === cc).sort((a, b) => b.pop - a.pop)[0];
  if (!hit) throw new Error(`no place called ${name} in ${cc}`);
  return hit;
}
const shown = (ms, tz) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(Math.round(ms / 60000) * 60000);
const mins = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

const only = process.argv.slice(2).map(a => a.toLowerCase());
let failed = 0, checked = 0;
for (const o of JSON.parse(fs.readFileSync(path.join(__dirname, 'official-times.json'), 'utf8'))) {
  if (only.length && !only.some(x => o.city.toLowerCase().includes(x))) continue;
  const p = find(o.city, o.cc), [y, m, d] = o.date.split('-').map(Number);
  const method = core.localMethod(p.lat, p.lon) || COUNTRY_METHOD[o.cc] || 'MWL', asr = COUNTRY_ASR[o.cc] || 1, within = o.within == null ? 1 : o.within;
  const t = core.prayerTimes(p.lat, p.lon, Date.UTC(y, m - 1, d, 12), { method, asr, highLat: 'angle', polar: 'nearest' });
  const diffs = core.EVENTS.map(k => o.times[k] ? mins(shown(t[k], p.tz)) - mins(o.times[k]) : null);
  const worst = Math.max(...diffs.map(x => Math.abs(x || 0))), ok = worst <= within;
  checked++; if (!ok && !o.known) failed++;
  console.log(`\n${ok ? 'ok  ' : o.known ? 'KNOWN' : 'FAIL'}  ${o.city}, ${o.cc}, ${o.date} · ${core.METHODS[method].name}, Asr ${asr}× · ${o.source}`);
  const row = (label, f) => console.log('      ' + label.padEnd(9) + core.EVENTS.map((k, i) => String(f(k, i)).padStart(9)).join(''));
  row('', k => k);
  row('official', k => o.times[k] || '—');
  row('app', k => shown(t[k], p.tz));
  if (worst) row('minutes', (k, i) => diffs[i] ? (diffs[i] > 0 ? '+' : '') + diffs[i] : '');
  if (!ok && o.known) console.log('      ' + o.known);
}
console.log(`\n${checked} checked, ${failed} outside the allowed difference`);
process.exit(failed ? 1 : 0);
