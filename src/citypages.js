// Builds the website's city pages, so that a search for "prayer times in <city>" has a real page to find:
//   prayer-times/<city>/        one small page per city: a day's times as plain text (replaced by today's in the
//                               browser), the method, the Qibla, the year's fasting hours, a table through the year
//   ar/prayer-times/<city>/     the same in Arabic, for every city that has an Arabic name in the template
//   prayer-times/, ar/prayer-times/   an A–Z index of them
//   sitemap.xml, robots.txt     only when the site's address is set in src/site.json
// Cities: the featured ones, every urban area of 1M+ and every map dot (capitals, cultural cities, sparse regions).
// The names, methods and Arabic are read out of template.html and the astronomy is core.js, so a page can never
// disagree with the map. Each page's address is the token the map itself opens with (/#<city>).
const fs = require('fs'), path = require('path');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// one `const NAME = …;` statement out of the template (none of the ones used has ";\n" inside it)
function stmt(src, name) {
  const a = src.indexOf(`\nconst ${name} = `);
  if (a < 0) throw new Error(`city pages: "const ${name}" not found in template.html`);
  return src.slice(a + 1, src.indexOf(';\n', a) + 1);
}
const value = (src, name) => new Function(`${stmt(src, name)}\nreturn ${name};`)();

module.exports = function buildCityPages(out, { url, template, coreSrc, places, now = Date.now() }) {
  template = template.replace(/\r\n/g, '\n');   // the statements are found by their line ends
  const { METHODS, RAD, DEG, EVENTS, sunPosition, dayEvents, prayerTimes } =
    new Function(coreSrc + '\nreturn { METHODS, RAD, DEG, EVENTS, sunPosition, dayEvents, prayerTimes };')();
  const PERIODS = value(template, 'PERIODS'), METHOD_AR = value(template, 'METHOD_AR'), AR_NAMES = value(template, 'AR_NAMES'),
    CITIES = value(template, 'CITIES'), COUNTRY_METHOD = value(template, 'COUNTRY_METHOD'), KAABA = value(template, 'KAABA');
  const slug = new Function([stmt(template, 'fold'), stmt(template, 'LATIN'), stmt(template, 'slug'), 'return slug;'].join('\n'))();
  if (PERIODS.length !== 6 || slug('São Paulo') !== 'sao-paulo' || !COUNTRY_METHOD.SA) throw new Error('city pages: the template no longer reads as expected');

  const distKm = (a, b) => {
    const dl = (b.lat - a.lat) * RAD, dn = (b.lon - a.lon) * RAD;
    const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dn / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };

  // ---- Which cities, and the address of each: the same order the map searches in, so /#<token> opens the same place ----
  const TOWNS = places.rows.split('\n').map(r => {
    const [name, lat, lon, tz, cc, pop, flags, big] = r.split(';');
    return { name, lat: +lat, lon: +lon, tz: places.tz[tz], cc, pop: +pop, big: +big || 0, dot: flags.includes('d') };
  });
  const used = new Set(), search = [];
  for (const [, list] of CITIES) for (const [name, lat, lon, tz] of list) {
    let best = null, bd = 30;
    for (const t of TOWNS) { const km = distKm({ lat, lon }, t); if (km < bd) { bd = km; best = t; } }
    if (best) used.add(best);
    search.push({ name, lat, lon, tz, cc: best ? best.cc : '', pop: best ? Math.max(best.pop, best.big) : 0, alias: best && best.name !== name ? best.name : '', page: true });
  }
  for (const t of TOWNS) if (!used.has(t)) search.push({ ...t, pop: Math.max(t.pop, t.big), page: !!(t.big || t.dot) });
  const firstPlain = new Map(), firstCc = new Map();
  for (const c of search) {
    c.slug = slug(c.name); if (!c.slug) continue;
    if (!firstPlain.has(c.slug)) firstPlain.set(c.slug, c);
    c.slugCc = c.cc ? `${c.slug}-${c.cc.toLowerCase()}` : '';
    if (c.slugCc && !firstCc.has(c.slugCc)) firstCc.set(c.slugCc, c);
  }
  const cities = []; let skipped = 0;
  for (const c of search) if (c.page) {
    // a name shared with a bigger city takes its country's code (hyderabad-pk), which the map also understands
    const token = firstPlain.get(c.slug) === c ? c.slug : c.slugCc && firstCc.get(c.slugCc) === c && !firstPlain.has(c.slugCc) ? c.slugCc : '';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(token)) { skipped++; continue; }
    try { new Intl.DateTimeFormat('en', { timeZone: c.tz }); } catch { skipped++; continue; }
    cities.push(Object.assign(c, { token, ar: AR_NAMES[c.name] || (c.alias && AR_NAMES[c.alias]) || '' }));
  }

  // ---- Words ----
  const NO_COUNTRY = new Set(['IL', 'PS']);   // named by city alone, as the map draws the two as one
  const regionNames = { en: new Intl.DisplayNames(['en'], { type: 'region' }), ar: new Intl.DisplayNames(['ar'], { type: 'region' }) };
  const country = (c, lang) => { if (!c.cc || NO_COUNTRY.has(c.cc)) return ''; try { return regionNames[lang].of(c.cc) || ''; } catch { return ''; } };
  const dg = (s, lang) => lang === 'ar' ? String(s).replace(/[0-9]/g, n => '٠١٢٣٤٥٦٧٨٩'[n]) : String(s);
  const num = (x, lang) => lang === 'ar' ? dg(x, lang).replace('.', '٫') : String(x);
  const coord = (c, lang) => lang === 'ar'
    ? `${num(Math.abs(c.lat).toFixed(2), lang)}° ${c.lat >= 0 ? 'شمالًا' : 'جنوبًا'}، ${num(Math.abs(c.lon).toFixed(2), lang)}° ${c.lon >= 0 ? 'شرقًا' : 'غربًا'}`
    : `${Math.abs(c.lat).toFixed(2)}° ${c.lat >= 0 ? 'N' : 'S'}, ${Math.abs(c.lon).toFixed(2)}° ${c.lon >= 0 ? 'E' : 'W'}`;
  const COMPASS = {
    en: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'],
    ar: ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'] };
  const LOC = { en: 'en-GB', ar: 'ar-u-nu-arab' };
  const fmts = new Map();
  const fmt = (lang, tz, kind) => {
    const key = lang + tz + kind;
    if (!fmts.has(key)) fmts.set(key, new Intl.DateTimeFormat(LOC[lang], {
      timeZone: tz,
      ...(kind === 'time' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
        : kind === 'date' ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
        : kind === 'day' ? { day: 'numeric', month: 'long' } : { month: 'short' }) }));
    return fmts.get(key);
  };
  const time = (ms, c, lang) => isFinite(ms) ? fmt(lang, c.tz, 'time').format(Math.round(ms / 60000) * 60000) : '—';
  const ymd = new Map();
  const localNoon = (ms, tz) => {
    if (!ymd.has(tz)) ymd.set(tz, new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }));
    const p = Object.fromEntries(ymd.get(tz).formatToParts(ms).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, 12);
  };
  const hijriFmt = (() => {
    try {
      const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', month: 'numeric' });
      return f.resolvedOptions().calendar === 'islamic-umalqura' ? f : null;
    } catch { return null; }
  })();
  const T = {
    en: {
      site: 'Adhan Atlas', index: 'Prayer times by city', today: 'Today', next: 'Next prayer', month: 'Month',
      title: (n, co) => `Prayer times in ${n}${co ? ', ' + co : ''} · Adhan Atlas`, h1: n => `Prayer times in ${n}`,
      desc: (n, co, q) => `Today's prayer times in ${n}${co ? ', ' + co : ''}: Fajr, sunrise, Dhuhr, Asr, Maghrib and Isha.${q ? ` Qibla ${q}.` : ''} Times through the year and a live world map.`,
      staticFor: d => `Times for ${d}.`,
      open: n => `Open ${n} on the live map`, openSub: 'The live map adds a Qibla compass, the month’s timetable, a calendar download and a mosque display.',
      about: 'About these times',
      method: (m, fajr, isha, where) => `Times follow the ${m} method (Fajr when the sun is ${fajr}° below the horizon, Isha ${isha}), ${where}, with Asr when a shadow is as long as the object casting it. You can choose another method on the live map.`,
      ishaDeg: a => `at ${a}°`, ishaMin: m => `${m} minutes after Maghrib`,
      usedIn: co => co ? `the one most followed in ${co}` : 'the one most followed there', usedElse: 'used where no local method is set',
      qibla: (n, b, dir, km) => `The Qibla from ${n} is ${b}° from north, towards the ${dir}. The Kaaba is ${km} km away.`,
      qiblaShort: (b, dir) => `${b}° (${dir})`,
      fast: (lo, loD, hi, hiD) => `Over the year the daily fast, from Fajr to Maghrib, runs from about ${lo} (around ${loD}) to about ${hi} (around ${hiD}).`,
      dur: (h, m) => `${h} h ${String(m).padStart(2, '0')} min`,
      year: 'Through the year', yearCap: (y, n) => `Times on the 15th of each month in ${y}, in ${n}’s own time (24-hour clock).`,
      near: 'Nearby cities', all: 'All cities', map: 'Live world map', aboutLink: 'Privacy and credits',
      foot: 'Times are calculated from the position of the sun and usually agree with published timetables to within a minute or two. Mosques and local authorities may adjust theirs, so check locally for congregation times.',
      indexTitle: 'Prayer times by city · Adhan Atlas', indexDesc: n => `Prayer times for ${n} cities around the world: today's Fajr, Dhuhr, Asr, Maghrib and Isha, the Qibla and times through the year.`,
      indexLead: n => `${n} cities, each with today’s times, the Qibla and the year’s timetable.`, indexElse: ['For any other town or place, search or tap it on the ', 'live map', '.'],
      other: 'العربية', sep: ', ', periods: p => p.name,
    },
    ar: {
      site: 'أطلس الأذان', index: 'مواقيت الصلاة حسب المدينة', today: 'اليوم', next: 'الصلاة التالية', month: 'الشهر',
      title: (n, co) => `مواقيت الصلاة في ${n}${co ? '، ' + co : ''} · أطلس الأذان`, h1: n => `مواقيت الصلاة في ${n}`,
      desc: (n, co, q) => `مواقيت الصلاة اليوم في ${n}${co ? '، ' + co : ''}: الفجر والشروق والظهر والعصر والمغرب والعشاء.${q ? ` القبلة ${q}.` : ''} مع مواقيت السنة وخريطة حيّة للعالم.`,
      staticFor: d => `مواقيت يوم ${d}.`,
      open: n => `اعرض ${n} على الخريطة الحيّة`, openSub: 'في الخريطة الحيّة بوصلة القبلة، وجدول الشهر، وتنزيل المواقيت إلى التقويم، وشاشة عرض للمساجد.',
      about: 'عن هذه المواقيت',
      method: (m, fajr, isha, where) => `تُحسب المواقيت بطريقة ${m} (الفجر حين تكون الشمس ${fajr}° تحت الأفق، والعشاء ${isha})، ${where}، والعصر حين يصير ظل الشيء مثله. يمكنك اختيار طريقة أخرى في الخريطة الحيّة.`,
      ishaDeg: a => `عند ${a}°`, ishaMin: m => `بعد المغرب بـ${m} دقيقة`,
      usedIn: co => co ? `وهي الأكثر اتباعًا في ${co}` : 'وهي الأكثر اتباعًا هناك', usedElse: 'وهي المعتمدة حيث لا توجد طريقة محلية',
      qibla: (n, b, dir, km) => `اتجاه القبلة من ${n}: ${b}° من الشمال، نحو ${dir}. وتبعد الكعبة المشرفة ${km} كم.`,
      qiblaShort: (b, dir) => `${b}° (${dir})`,
      fast: (lo, loD, hi, hiD) => `على مدار السنة يتراوح طول الصيام اليومي، من الفجر إلى المغرب، بين نحو ${lo} (قرابة ${loD}) ونحو ${hi} (قرابة ${hiD}).`,
      dur: (h, m) => `${dg(h, 'ar')} س ${dg(String(m).padStart(2, '0'), 'ar')} د`,
      year: 'على مدار السنة', yearCap: (y, n) => `المواقيت في اليوم الخامس عشر من كل شهر في عام ${y}، بتوقيت ${n} المحلي (نظام ٢٤ ساعة).`,
      near: 'مدن قريبة', all: 'كل المدن', map: 'الخريطة الحيّة للعالم', aboutLink: 'الخصوصية والمصادر',
      foot: 'تُحسب المواقيت من موضع الشمس، وتوافق الجداول المنشورة عادةً في حدود دقيقة أو دقيقتين. قد تعدّل المساجد والجهات المحلية مواقيتها، فراجع مسجدك لأوقات الجماعة.',
      indexTitle: 'مواقيت الصلاة حسب المدينة · أطلس الأذان', indexDesc: n => `مواقيت الصلاة في ${n} مدينة حول العالم: الفجر والظهر والعصر والمغرب والعشاء اليوم، واتجاه القبلة، ومواقيت السنة.`,
      indexLead: n => `${n} مدينة، لكل منها مواقيت اليوم واتجاه القبلة وجدول السنة.`, indexElse: ['لأي بلدة أو مكان آخر، ابحث عنه أو اضغط عليه في ', 'الخريطة الحيّة', '.'],
      other: 'English', sep: '، ', periods: p => p.ar,
    },
  };
  const nameIn = (c, lang) => lang === 'ar' ? c.ar : c.name;

  // ---- The page shell ----
  const dirOf = { en: 'prayer-times', ar: 'ar/prayer-times' }, rootOf = { en: '../../', ar: '../../../' };
  const mapHref = (root, lang, token) => root + (lang === 'ar' ? '?lang=ar' : '') + (token ? '#' + token : '');
  function shell({ lang, root, self, title, desc, alt, ld, body, script }) {
    const t = T[lang], abs = p => `${url}/${p}`;
    return `<!doctype html>
<html lang="${lang}"${lang === 'ar' ? ' dir="rtl"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#0b0d14">
${url ? `<link rel="canonical" href="${abs(self)}">\n` + (alt ? `<link rel="alternate" hreflang="en" href="${abs(alt.en)}">\n<link rel="alternate" hreflang="ar" href="${abs(alt.ar)}">\n<link rel="alternate" hreflang="x-default" href="${abs(alt.en)}">\n` : '') : ''}<link rel="icon" href="${root}icons/favicon-32.png" sizes="32x32">
<link rel="icon" href="${root}icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}icons/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Adhan Atlas">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${url ? `<meta property="og:url" content="${abs(self)}">\n` : ''}<meta property="og:image" content="${url ? abs('og.jpg') : root + 'og.jpg'}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="${root}assets/fonts/fonts.css">
<link rel="stylesheet" href="${root}assets/city.css">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n` : ''}</head>
<body>
<div class="page">
<header class="top">
  <a class="brand" href="${mapHref(root, lang)}">${t.site}</a>
  ${alt ? `<a class="lang" lang="${lang === 'ar' ? 'en' : 'ar'}" href="${root}${lang === 'ar' ? alt.en : alt.ar}">${t.other}</a>` : ''}
</header>
${body}
<footer>
  <p>${t.foot}</p>
  <p class="foot-links">${self === dirOf[lang] + '/' ? '' : `<a href="${root}${dirOf[lang]}/">${t.all}</a>`}<a href="${mapHref(root, lang)}">${t.map}</a><a href="${root}about.html">${t.aboutLink}</a></p>
</footer>
</div>
${script ? `<script src="${root}assets/city.js" defer></script>\n` : ''}</body>
</html>
`;
  }

  // ---- One city ----
  const year = new Date(now).getUTCFullYear();
  const arSet = new Set(cities.filter(c => c.ar));
  const nearest = (c, pool) => pool.filter(o => o !== c).map(o => [distKm(c, o), o]).sort((a, b) => a[0] - b[0]).slice(0, 8).map(x => x[1]);
  function cityPage(c, lang, pool) {
    const t = T[lang], root = rootOf[lang], n = nameIn(c, lang), co = country(c, lang), L = s => dg(s, lang);
    const methodKey = COUNTRY_METHOD[c.cc] || 'MWL', m = METHODS[methodKey];
    const base = { method: methodKey, asr: 1, highLat: 'angle', polar: 'nearest' };
    const calc = noon => methodKey === 'Makkah' && hijriFmt && parseInt(hijriFmt.format(noon), 10) === 9 ? { ...base, ramadan: true } : base;
    const on = noon => prayerTimes(c.lat, c.lon, noon, calc(noon));
    const todayNoon = localNoon(now, c.tz), today = on(todayNoon);
    // the Qibla, except in Makkah itself
    const km = distKm(c, KAABA);
    let qibla = '', qShort = '';
    if (km > 20) {
      const f1 = c.lat * RAD, f2 = KAABA.lat * RAD, dl = (KAABA.lon - c.lon) * RAD;
      const b = (Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)) * DEG + 360) % 360;
      const dir = COMPASS[lang][Math.round(b / 45) % 8], kmText = lang === 'ar' ? L(Math.round(km / 10) * 10) : (Math.round(km / 10) * 10).toLocaleString('en-GB');
      qibla = t.qibla(n, L(Math.round(b)), dir, kmText); qShort = t.qiblaShort(L(Math.round(b)), dir);
    }
    // the shortest and longest fast of the year, from each day's solar events (hours from solar noon)
    let lo = null, hi = null;
    for (let d = 0; d < 365; d++) {
      const noon = Date.UTC(year, 0, 1 + d, 12), ev = dayEvents(c.lat, sunPosition(noon - c.lon / 15 * 3600000).decl, base);
      if (!ev || !isFinite(ev.fajr) || !isFinite(ev.maghrib)) continue;
      const len = ev.maghrib - ev.fajr;
      if (!lo || len < lo.len) lo = { len, noon };
      if (!hi || len > hi.len) hi = { len, noon };
    }
    const dur = h => { const mins = Math.round(h * 60); return t.dur(Math.floor(mins / 60), mins % 60); };
    const dayOf = noon => fmt(lang, 'UTC', 'day').format(noon);
    const fast = lo && hi && hi.len - lo.len > 1 / 12 ? t.fast(dur(lo.len), dayOf(lo.noon), dur(hi.len), dayOf(hi.noon)) : '';
    const known = !!COUNTRY_METHOD[c.cc];
    const method = t.method(lang === 'ar' ? METHOD_AR[methodKey] : m.name, num(m.fajr, lang),
      m.ishaMin ? t.ishaMin(L(m.ishaMin)) : t.ishaDeg(num(m.isha, lang)), known ? t.usedIn(co) : t.usedElse);
    const rows = PERIODS.map(p => `      <li data-k="${p.key}"><i style="background:var(--p-${p.key})"></i><span class="n">${t.periods(p)}${lang === 'en' && p.en ? `<em>${p.en}</em>` : ''}</span><b class="t">${time(today[p.key], c, lang)}</b></li>`).join('\n');
    const table = Array.from({ length: 12 }, (_, mo) => {
      const noon = Date.UTC(year, mo, 15, 12), tm = on(noon);
      return `<tr><th scope="row">${fmt(lang, 'UTC', 'month').format(noon)}</th>${PERIODS.map(p => `<td>${time(tm[p.key], c, lang)}</td>`).join('')}</tr>`;
    }).join('\n        ');
    const self = `${dirOf[lang]}/${c.token}/`, alt = c.ar ? { en: `${dirOf.en}/${c.token}/`, ar: `${dirOf.ar}/${c.token}/` } : null;
    const title = t.title(n, co), desc = t.desc(n, co, qShort);
    const ld = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebPage', name: title, description: desc, inLanguage: lang, ...(url ? { url: `${url}/${self}` } : {}),
        about: { '@type': 'City', name: n, geo: { '@type': 'GeoCoordinates', latitude: c.lat, longitude: c.lon } } },
      ...(url ? [{ '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.site, item: `${url}/` },
        { '@type': 'ListItem', position: 2, name: t.index, item: `${url}/${dirOf[lang]}/` },
        { '@type': 'ListItem', position: 3, name: n, item: `${url}/${self}` }] }] : [])] };
    const near = nearest(c, pool);
    const body = `<main>
  <div>
    <p class="crumb"><a href="../">${t.index}</a></p>
    <h1>${esc(t.h1(n))}</h1>
    <p class="meta">${esc([co, coord(c, lang)].filter(Boolean).join(' · '))}</p>
  </div>
  <section class="today" id="today" data-lat="${c.lat}" data-lon="${c.lon}" data-tz="${esc(c.tz)}" data-method="${methodKey}">
    <div class="today-head"><h2>${t.today}</h2><p class="date" id="tDate">${fmt(lang, c.tz, 'date').format(now)}</p></div>
    <div class="next" id="tNext" hidden><div><span class="lbl">${t.next}</span><b id="tNextName"></b><span class="at" id="tNextAt"></span></div><span class="count" id="tCount"></span></div>
    <ol class="times">
${rows}
    </ol>
    <p class="note" id="tStatic">${t.staticFor(fmt(lang, c.tz, 'date').format(now))}</p>
  </section>
  <p class="cta"><a class="btn" href="${mapHref(root, lang, c.token)}">${esc(t.open(n))}<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a><span>${t.openSub}</span></p>
  <section>
    <h2>${t.about}</h2>
    <p>${esc(method)}</p>${qibla ? `\n    <p>${esc(qibla)}</p>` : ''}${fast ? `\n    <p>${esc(fast)}</p>` : ''}
  </section>
  <section>
    <h2>${t.year}</h2>
    <p class="cap">${esc(t.yearCap(L(year), n))}</p>
    <div class="table-wrap"><table>
      <thead><tr><th scope="col">${t.month}</th>${PERIODS.map(p => `<th scope="col">${t.periods(p)}</th>`).join('')}</tr></thead>
      <tbody>
        ${table}
      </tbody>
    </table></div>
  </section>
  <section>
    <h2>${t.near}</h2>
    <ul class="links">${near.map(o => `<li><a href="../${o.token}/">${esc(nameIn(o, lang))}</a></li>`).join('')}</ul>
  </section>
</main>`;
    return shell({ lang, root, self, title, desc, alt, ld, body, script: true });
  }

  // ---- The A–Z index ----
  function indexPage(lang, list) {
    const t = T[lang], root = lang === 'ar' ? '../../' : '../', coll = new Intl.Collator(lang);
    const key = c => lang === 'ar' ? c.ar.replace(/^ال/, '').replace(/[أإآ]/g, 'ا') : c.slug;
    const sorted = [...list].sort((a, b) => coll.compare(key(a), key(b)) || b.pop - a.pop);
    const groups = new Map();
    for (const c of sorted) { const l = key(c)[0].toUpperCase(); if (!groups.has(l)) groups.set(l, []); groups.get(l).push(c); }
    const letters = [...groups.keys()], id = l => 'l-' + letters.indexOf(l);
    const body = `<main>
  <div>
    <h1>${t.index}</h1>
    <p class="meta">${t.indexLead(dg(list.length, lang))} ${t.indexElse[0]}<a href="${mapHref(root, lang)}">${t.indexElse[1]}</a>${t.indexElse[2]}</p>
  </div>
  <nav class="az" aria-label="${lang === 'ar' ? 'الحروف' : 'Letters'}">${letters.map(l => `<a href="#${id(l)}">${l}</a>`).join('')}</nav>
${letters.map(l => `  <section class="letter" id="${id(l)}">
    <h2>${l}</h2>
    <ul class="dir">${groups.get(l).map(c => `<li><a href="${c.token}/"><b>${esc(nameIn(c, lang))}</b><span>${esc(country(c, lang))}</span></a></li>`).join('')}</ul>
  </section>`).join('\n')}
</main>`;
    const self = dirOf[lang] + '/';
    return shell({ lang, root, self, title: t.indexTitle, desc: t.indexDesc(dg(list.length, lang)), alt: { en: dirOf.en + '/', ar: dirOf.ar + '/' }, body });
  }

  const list = cities.map(c => ({ name: c.name, alias: c.alias || '', cc: c.cc, lat: c.lat, lon: c.lon, pop: c.pop, token: c.token, ar: c.ar }));
  if (!out) return { cities: cities.length, arabic: arSet.size, skipped, list };   // only the list of cities, nothing written

  // ---- Write ----
  const write =(rel, text) => { const f = path.join(out, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  const urls = ['', 'about.html', dirOf.en + '/', dirOf.ar + '/'];
  const arList = [...arSet];
  for (const c of cities) {
    write(`${dirOf.en}/${c.token}/index.html`, cityPage(c, 'en', cities)); urls.push(`${dirOf.en}/${c.token}/`);
    if (c.ar) { write(`${dirOf.ar}/${c.token}/index.html`, cityPage(c, 'ar', arList)); urls.push(`${dirOf.ar}/${c.token}/`); }
  }
  write(`${dirOf.en}/index.html`, indexPage('en', cities));
  write(`${dirOf.ar}/index.html`, indexPage('ar', arList));
  if (url) {
    const day = new Date(now).toISOString().slice(0, 10);
    write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map(u => `<url><loc>${url}/${u}</loc><lastmod>${day}</lastmod></url>`).join('\n') + '\n</urlset>\n');
    write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${url}/sitemap.xml\n`);
  }
  return { cities: cities.length, arabic: arList.length, skipped, pages: urls.length - 2, list };
};
