// Builds Adhan Atlas.
//   node src/build.js adhan-atlas.html   the single-file page (the claude.ai artifact)
//   node src/build.js site [dir]         the website, ready to upload (default dir: site/ in the project), with its
//                                        libraries, fonts, icons, app manifest and offline support served from the
//                                        site itself, and a page per city for search engines (src/citypages.js).
//                                        The site's address and description are in src/site.json.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), d = __dirname;
const read = f => fs.readFileSync(path.join(d, f), 'utf8');

function page() {
  return read('template.html')
    .replace('/*CORE*/', () => read('core.js'))
    .replace('/*WORLD*/', () => JSON.stringify(JSON.parse(read('data/countries-110m.json'))))
    .replace('/*WORLD50*/', () => read('data/countries-50m.json'))
    .replace('/*PLACES*/', () => read('data/cities.json'));
}

function sitePage(cfg) {
  let h = page();
  const swap = (a, b) => { if (!h.includes(a)) throw new Error('not found in template: ' + a); h = h.replace(a, () => b); };
  const url = (cfg.url || '').replace(/\/+$/, ''), abs = f => url ? `${url}/${f}` : f;
  const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  // libraries and fonts from the site itself
  swap('<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>', '<script src="assets/d3.min.js"></script>');
  swap('<script src="https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js"></script>', '<script src="assets/topojson-client.min.js"></script>');
  const preconnects = h.match(/<link rel="preconnect" href="https:\/\/fonts\.g[^"]*"( crossorigin)?>\r?\n/g) || [];
  if (preconnects.length !== 2) throw new Error('expected the two Google Fonts preconnect links in the template');
  preconnects.forEach(l => swap(l, ''));
  const fonts = h.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/);
  if (!fonts) throw new Error('Google Fonts link not found in template');
  swap(fonts[0], '<link rel="stylesheet" href="assets/fonts/fonts.css">');
  // what a browser, a home screen and a link preview need to know about the site
  swap('<meta name="claude:viewport-fit-sides" content="cover">', [
    `<meta name="description" content="${esc(cfg.description)}">`,
    '<meta name="theme-color" content="#0b0d14">',
    '<link rel="manifest" href="manifest.webmanifest">',
    '<link rel="icon" href="icons/favicon-32.png" sizes="32x32">',
    '<link rel="icon" href="icons/icon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">',
    '<meta name="apple-mobile-web-app-title" content="Adhan Atlas">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black">',
    ...(url ? [`<link rel="canonical" href="${url}/">`, `<meta property="og:url" content="${url}/">`] : []),
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Adhan Atlas">',
    '<meta property="og:title" content="Adhan Atlas">',
    `<meta property="og:description" content="${esc(cfg.description)}">`,
    `<meta property="og:image" content="${abs('og.jpg')}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n'));
  swap('const SITE_BUILD = false;', 'const SITE_BUILD = true;');
  swap('<title>Adhan Atlas</title>', '<title>Adhan Atlas: live world map of prayer times</title>');
  swap('<footer data-i="footer"></footer>',
    '<footer data-i="footer"></footer>\n  <p class="foot-links"><a href="prayer-times/" id="citiesLink" data-i="citiesLink">Prayer times by city</a> · ' +
    '<a href="about.html" data-i="aboutLink">Privacy and credits</a></p>');
  // offline support, once the page has loaded (only over https, or on this computer while testing)
  h += `<script>
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'))
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
</script>\n`;
  return '<!doctype html>\n<html lang="en">\n' + h + '</html>\n';
}

function buildSite(out) {
  const cfg = JSON.parse(read('site.json')), web = path.join(d, 'web');
  out = path.resolve(out);
  if (!out.startsWith(path.resolve(d, '..'))) throw new Error('the site folder must be inside the project: ' + out);
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(web, out, { recursive: true });
  fs.writeFileSync(path.join(out, 'index.html'), sitePage(cfg));
  // a page per city, and the script that keeps each one's times live: the same astronomy as the map
  fs.writeFileSync(path.join(out, 'assets', 'city.js'), read('core.js') + read('city-live.js'));
  const cityStats = require('./citypages.js')(out, { url: (cfg.url || '').replace(/\/+$/, ''), template: read('template.html'),
    coreSrc: read('core.js'), places: JSON.parse(read('data/cities.json')) });
  // every file the offline copy needs (all but the worker itself and the host's settings), and a version
  // that changes whenever any of them does
  const files = [], hash = crypto.createHash('sha1');
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return walk(f);
    const rel = path.relative(out, f).split(path.sep).join('/');
    if (rel === 'sw.js' || rel === '_headers' || rel === 'og.jpg' || rel === 'sitemap.xml' || rel === 'robots.txt') return;
    if (rel.startsWith('prayer-times/') || rel.startsWith('ar/')) return;   // city pages are kept as they are visited, not all up front
    files.push(rel); hash.update(rel).update(fs.readFileSync(f));
  });
  walk(out);
  files.sort();
  const sw = fs.readFileSync(path.join(out, 'sw.js'), 'utf8')
    .replace('__VERSION__', hash.digest('hex').slice(0, 10))
    .replace('__FILES__', JSON.stringify(['./', ...files], null, 2));
  fs.writeFileSync(path.join(out, 'sw.js'), sw);
  const size = files.reduce((n, f) => n + fs.statSync(path.join(out, f)).size, 0);
  console.log(`site written to ${out}: ${files.length + 1} files, ${(size / 1048576).toFixed(2)} MB offline copy` +
    (cfg.url ? `, address ${cfg.url}` : ', no address set in src/site.json yet'));
  console.log(`city pages: ${cityStats.cities} cities in English, ${cityStats.arabic} in Arabic` + (cityStats.skipped ? `, ${cityStats.skipped} skipped` : '') +
    (cfg.url ? ', with sitemap.xml and robots.txt' : '; set the address in src/site.json to add canonical links and a sitemap'));
}

if (process.argv[2] === 'site') buildSite(process.argv[3] || path.join(d, '..', 'site'));
else { const h = page(); fs.writeFileSync(process.argv[2], h); console.log(h.length); }
