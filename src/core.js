// ---- Prayer time astronomy (after the praytimes.org formulation) ----
const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const fixAngle = a => a - 360 * Math.floor(a / 360);
const wrapHour = h => h - 24 * Math.floor((h + 12) / 24);   // to [-12, 12)

const METHODS = {
  MWL:       { name: 'Muslim World League',            fajr: 18,   isha: 17 },
  ISNA:      { name: 'ISNA (North America)',           fajr: 15,   isha: 15 },
  Egypt:     { name: 'Egyptian General Authority',     fajr: 19.5, isha: 17.5 },
  Makkah:    { name: 'Umm al-Qura, Makkah',            fajr: 18.5, ishaMin: 90 },
  Karachi:   { name: 'University of Islamic Sciences, Karachi', fajr: 18, isha: 18 },
  Tehran:    { name: 'Institute of Geophysics, Tehran', fajr: 17.7, isha: 14, maghrib: 4.5 },
  Jafari:    { name: 'Shia Ithna Ashari (Jafari)',     fajr: 16,   isha: 14, maghrib: 4 },
  Gulf:      { name: 'Gulf Region',                    fajr: 19.5, ishaMin: 90 },
  Kuwait:    { name: 'Kuwait',                         fajr: 18,   isha: 17.5 },
  Qatar:     { name: 'Qatar',                          fajr: 18,   ishaMin: 90 },
  Dubai:     { name: 'Dubai',                          fajr: 18.2, isha: 18.2 },
  Singapore: { name: 'MUIS, Singapore',                fajr: 20,   isha: 18 },
  JAKIM:     { name: 'JAKIM, Malaysia',                fajr: 20,   isha: 18 },
  Kemenag:   { name: 'Kemenag, Indonesia',             fajr: 20,   isha: 18 },
  Turkey:    { name: 'Diyanet, Türkiye',               fajr: 18,   isha: 17 },
  France:    { name: 'UOIF, France',                   fajr: 12,   isha: 12 },
  Russia:    { name: 'Spiritual Administration, Russia', fajr: 16, isha: 15 },
  Morocco:   { name: 'Ministry of Habous, Morocco',    fajr: 19,   isha: 17 },
};

// Sun position for a JS timestamp: declination (deg) and equation of time (hours)
function sunPosition(ms) {
  const D = ms / 86400000 + 2440587.5 - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * Math.sin(g * RAD) + 0.020 * Math.sin(2 * g * RAD));
  const e = 23.439 - 0.00000036 * D;
  const RA = fixAngle(Math.atan2(Math.cos(e * RAD) * Math.sin(L * RAD), Math.cos(L * RAD)) * DEG) / 15;
  return { decl: Math.asin(Math.sin(e * RAD) * Math.sin(L * RAD)) * DEG, eqt: wrapHour(q / 15 - RA) };
}

// Hours from solar noon until the sun reaches altitude `alt` (deg); NaN if it never does
function hoursToAlt(alt, lat, decl) {
  const c = (Math.sin(alt * RAD) - Math.sin(lat * RAD) * Math.sin(decl * RAD)) /
            (Math.cos(lat * RAD) * Math.cos(decl * RAD));
  return c < -1 || c > 1 ? NaN : Math.acos(c) * DEG / 15;
}
const asrAltitude = (factor, lat, decl) =>
  Math.atan(1 / (factor + Math.tan(Math.abs(lat - decl) * RAD))) * DEG;

// Event offsets in hours from solar noon for one latitude and sun position.
// Returns null in polar day/night (no sunrise or sunset).
function solarEvents(lat, decl, s) {
  // Umm al-Qura moves Isha to 120 minutes after Maghrib during Ramadan
  const m = s.ramadan && s.method === 'Makkah' ? { ...METHODS.Makkah, ishaMin: 120 } : METHODS[s.method];
  const rise = hoursToAlt(-0.833, lat, decl);
  if (isNaN(rise)) return null;
  const night = 24 - 2 * rise;
  const portion = a => s.highLat === 'middle' ? night / 2 : s.highLat === 'seventh' ? night / 7 : night * a / 60;
  let fajr = hoursToAlt(-m.fajr, lat, decl);
  if (isNaN(fajr) || fajr - rise > portion(m.fajr)) fajr = rise + portion(m.fajr);
  const maghrib = m.maghrib ? hoursToAlt(-m.maghrib, lat, decl) || rise : rise;
  let isha;
  if (m.ishaMin) isha = maghrib + m.ishaMin / 60;
  else {
    isha = hoursToAlt(-m.isha, lat, decl);
    if (isNaN(isha) || isha - maghrib > portion(m.isha)) isha = maghrib + portion(m.isha);
  }
  return { fajr: -fajr, sunrise: -rise, dhuhr: 0,
           asr: hoursToAlt(asrAltitude(s.asr, lat, decl), lat, decl), maghrib, isha };
}

// Like solarEvents, but where the sun does not rise or set that day, borrow the times of
// another latitude on the same meridian: the nearest one where it does (s.polar 'nearest'),
// or Makkah's (s.polar 'makkah'). The result carries `from`, the latitude borrowed.
const MAKKAH_LAT = 21.4225;
function dayEvents(lat, decl, s) {
  const ev = solarEvents(lat, decl, s);
  if (ev || s.polar === 'none') return ev;
  if (s.polar === 'makkah') return { ...solarEvents(MAKKAH_LAT, decl, s), from: MAKKAH_LAT };
  for (let l = Math.abs(lat) - 0.5; l > 0; l -= 0.5) {
    const e = solarEvents(Math.sign(lat) * l, decl, s);
    if (e) return { ...e, from: Math.sign(lat) * l };
  }
  return null;
}

// Period index at solar time `t` (hours from solar noon, [-12, 12))
// 0 Fajr, 1 Shuruq, 2 Dhuhr, 3 Asr, 4 Maghrib, 5 Isha
function periodAt(ev, t) {
  if (t < ev.fajr) return ev.isha - 24 > t ? 4 : 5;
  if (t < ev.sunrise) return 0;
  if (t < 0) return 1;
  if (t < ev.asr) return 2;
  if (t < ev.maghrib) return 3;
  if (t < ev.isha) return 4;
  return 5;
}
// Fallback when the sun neither rises nor sets: classify by altitude alone
function periodByAltitude(alt, t, lat, decl, s) {
  const m = METHODS[s.method];
  if (alt > -0.833) return t < 0 ? 1 : alt > asrAltitude(s.asr, lat, decl) ? 2 : 3;
  if (t < 0) return alt > -m.fajr ? 0 : 5;
  return alt > -(m.isha || 17) ? 4 : 5;
}

// Prayer times (UTC ms) for the solar day centred on `noonUTCms` (12:00 UTC of the local date)
const EVENTS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
function prayerTimes(lat, lon, dateNoonUTC, s) {
  const out = {};
  for (const k of EVENTS) {
    let t = dateNoonUTC - lon / 15 * 3600000, ok = true;
    for (let i = 0; i < 3; i++) {
      const sp = sunPosition(t);
      const ev = dayEvents(lat, sp.decl, s);
      if (ev && ev.from != null) out.from = ev.from;
      if (!ev || isNaN(ev[k])) { ok = false; break; }
      t = dateNoonUTC + (ev[k] - lon / 15 - sp.eqt) * 3600000;
    }
    out[k] = ok ? t : NaN;
  }
  return out;
}
