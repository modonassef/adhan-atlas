
// ---- City page: today's times, worked out in the reader's browser ----
// The build puts this after core.js in assets/city.js. The page already holds a day's times as plain text
// (for readers and search engines without scripts); this replaces them with today's, and counts down to the next.
(() => {
  const box = document.getElementById('today'); if (!box) return;
  const d = box.dataset, lat = +d.lat, lon = +d.lon, tz = d.tz;
  const ar = document.documentElement.lang === 'ar';
  const base = { method: d.method, asr: d.asr === '2' ? 2 : 1, highLat: 'angle', polar: 'nearest' };
  if (!METHODS[base.method] || !isFinite(lat) || !isFinite(lon)) return;
  const $ = id => document.getElementById(id);
  const dg = s => ar ? String(s).replace(/[0-9]/g, n => '٠١٢٣٤٥٦٧٨٩'[n]) : String(s);
  const loc = ar ? 'ar-u-nu-arab' : (/^en\b/i.test(navigator.language || '') ? navigator.language : 'en-GB');
  let h24 = true, fTime, fDate, fYMD, fZone, fHijri = null;
  try {
    h24 = /h2[34]/.test(new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle);
    fTime = new Intl.DateTimeFormat(loc, { timeZone: tz, ...(h24 ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' }) });
    fDate = new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    fYMD = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' });
    fZone = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
  } catch { return; }   // a browser that does not know this time zone keeps the page's own times
  try {
    const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', month: 'numeric' });
    if (f.resolvedOptions().calendar === 'islamic-umalqura') fHijri = f;
  } catch {}
  const time = ms => fTime.format(Math.round(ms / 60000) * 60000);
  const noonOf = ms => { const p = Object.fromEntries(fYMD.formatToParts(ms).map(x => [x.type, x.value])); return Date.UTC(+p.year, +p.month - 1, +p.day, 12); };
  // Umm al-Qura moves Isha to 120 minutes after Maghrib in Ramadan
  const calc = noon => base.method === 'Makkah' && fHijri && parseInt(fHijri.format(noon), 10) === 9 ? { ...base, ramadan: true } : base;
  const on = noon => prayerTimes(lat, lon, noon, calc(noon));
  const zone = ms => { const p = fZone.formatToParts(ms).find(x => x.type === 'timeZoneName'); return p ? p.value.replace('GMT', 'UTC') : ''; };
  const count = ms => {
    const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    return dg((h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'));
  };
  const rows = Object.fromEntries([...box.querySelectorAll('li[data-k]')].map(li => [li.dataset.k, li]));
  let day = 0, today = null, tomorrow = null;
  function tick() {
    const t = Date.now(), noon = noonOf(t);
    if (noon !== day) {
      day = noon; today = on(noon); tomorrow = on(noon + 86400000);
      for (const k of EVENTS) rows[k].querySelector('.t').textContent = isFinite(today[k]) ? time(today[k]) : '—';
      const z = zone(t);
      $('tDate').textContent = fDate.format(t) + (z ? ' · ' + (ar ? '⁦' + dg(z) + '⁩' : z) : '');
      $('tStatic').hidden = true;
    }
    let cur = 'isha';
    for (const k of EVENTS) if (isFinite(today[k]) && today[k] <= t) cur = k;
    for (const k of EVENTS) rows[k].classList.toggle('now', k === cur);
    // the next prayer (Shuruq ends Fajr; it is not one), tomorrow's Fajr after Isha
    let next = EVENTS.filter(k => k !== 'sunrise' && today[k] > t).map(k => ({ k, at: today[k] }))[0];
    if (!next && isFinite(tomorrow.fajr)) next = { k: 'fajr', at: tomorrow.fajr };
    $('tNext').hidden = !next;
    if (next) {
      $('tNextName').textContent = rows[next.k].querySelector('.n').firstChild.textContent;
      $('tNextAt').textContent = time(next.at);
      $('tCount').textContent = count(next.at - t);
    }
  }
  tick();
  setInterval(tick, 1000);
})();
