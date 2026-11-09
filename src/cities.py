# Builds data/cities.json from GeoNames cities15000.txt and cities5000.txt (https://download.geonames.org/export/dump/),
# Natural Earth's ne_10m_populated_places_simple.geojson and ne_110m_admin_0_countries.geojson
# (https://github.com/nvkelso/natural-earth-vector, v5.1.2) and OurAirports' airports.csv
# (https://davidmegginson.github.io/ourairports-data/airports.csv, downloaded November 2026).
# Usage: python -I cities.py cities15000.txt cities5000.txt ne_10m_populated_places_simple.geojson \
#          ne_110m_admin_0_countries.geojson airports.csv data/cities.json
import sys, json, math, csv
sys.stdout.reconfigure(encoding="utf-8")
src, src5000, ne_path, countries_path, airports_path, out = sys.argv[1:7]
WORLD_POP = 8_200_000_000   # about 2026

# Metro areas of 10M+ (UN World Urbanization Prospects megacities) whose city-proper population is smaller,
# plus European metro areas of 2M+ in the same situation. Matched by GeoNames name and country.
METROS = {('Tokyo', 'JP'), ('Delhi', 'IN'), ('Shanghai', 'CN'), ('São Paulo', 'BR'), ('Mexico City', 'MX'), ('Cairo', 'EG'),
  ('Mumbai', 'IN'), ('Beijing', 'CN'), ('Dhaka', 'BD'), ('Osaka', 'JP'), ('New York City', 'US'), ('Karachi', 'PK'),
  ('Buenos Aires', 'AR'), ('Chongqing', 'CN'), ('Istanbul', 'TR'), ('Kolkata', 'IN'), ('Manila', 'PH'), ('Lagos', 'NG'),
  ('Rio de Janeiro', 'BR'), ('Tianjin', 'CN'), ('Kinshasa', 'CD'), ('Guangzhou', 'CN'), ('Los Angeles', 'US'), ('Moscow', 'RU'),
  ('Shenzhen', 'CN'), ('Lahore', 'PK'), ('Bengaluru', 'IN'), ('Paris', 'FR'), ('Jakarta', 'ID'), ('Chennai', 'IN'), ('Lima', 'PE'),
  ('Bogotá', 'CO'), ('Bangkok', 'TH'), ('Seoul', 'KR'),
  ('Barcelona', 'ES'), ('Milan', 'IT'), ('Naples', 'IT'), ('Manchester', 'GB'), ('Birmingham', 'GB'), ('Hamburg', 'DE'), ('Munich', 'DE')}

# Cities that matter for their faith, scholarship or culture, whatever their size: shown as map dots and in
# the "Adhan now" list. 'h' marks the three holy cities, which that list always names first. Matched by
# GeoNames name, ASCII name or alternate name within the country, taking the most populous match.
CULTURAL = [
  ('Mecca', 'SA', 'h'), ('Medina', 'SA', 'h'), ('Jerusalem', 'IL', 'h'),
  # Islamic heritage
  ('Hebron', 'PS', 'c'), ('Nablus', 'PS', 'c'), ('Gaza', 'PS', 'c'), ('Acre', 'IL', 'c'), ('Najaf', 'IQ', 'c'),
  ('Karbala', 'IQ', 'c'), ('Samarra', 'IQ', 'c'), ('Kufa', 'IQ', 'c'), ('Mashhad', 'IR', 'c'), ('Qom', 'IR', 'c'),
  ('Isfahan', 'IR', 'c'), ('Shiraz', 'IR', 'c'), ('Tabriz', 'IR', 'c'), ('Konya', 'TR', 'c'), ('Bursa', 'TR', 'c'),
  ('Edirne', 'TR', 'c'), ('Bukhara', 'UZ', 'c'), ('Samarkand', 'UZ', 'c'), ('Khiva', 'UZ', 'c'), ('Fes', 'MA', 'c'),
  ('Marrakesh', 'MA', 'c'), ('Meknes', 'MA', 'c'), ('Kairouan', 'TN', 'c'), ('Tlemcen', 'DZ', 'c'), ('Ghardaia', 'DZ', 'c'),
  ('Constantine', 'DZ', 'c'), ('Timbuktu', 'ML', 'c'), ('Djenne', 'ML', 'c'), ('Agadez', 'NE', 'c'), ('Zinder', 'NE', 'c'),
  ('Harar', 'ET', 'c'), ('Lamu', 'KE', 'c'), ('Mombasa', 'KE', 'c'), ('Zanzibar', 'TZ', 'c'), ('Touba', 'SN', 'c'),
  ('Kano', 'NG', 'c'), ('Sokoto', 'NG', 'c'), ('Maiduguri', 'NG', 'c'), ('Alexandria', 'EG', 'c'), ('Aleppo', 'SY', 'c'),
  ('Herat', 'AF', 'c'), ('Mazar-e Sharif', 'AF', 'c'), ('Agra', 'IN', 'c'), ('Ajmer', 'IN', 'c'), ('Srinagar', 'IN', 'c'),
  ('Multan', 'PK', 'c'), ('Banda Aceh', 'ID', 'c'), ('Yogyakarta', 'ID', 'c'), ('Kashgar', 'CN', 'c'), ('Kazan', 'RU', 'c'),
  ('Grozny', 'RU', 'c'), ('Mostar', 'BA', 'c'), ('Nizwa', 'OM', 'c'), ('Zabid', 'YE', 'c'), ('Ta\u2019if', 'SA', 'c'),
  ('Cordoba', 'ES', 'c'), ('Granada', 'ES', 'c'), ('Malacca', 'MY', 'c'), ('Kota Bharu', 'MY', 'c'), ('Marawi', 'PH', 'c'),
  ('Cotabato', 'PH', 'c'),
  # world cultural cities
  ('Kyoto', 'JP', 'c'), ('Nara', 'JP', 'c'), ('Varanasi', 'IN', 'c'), ('Amritsar', 'IN', 'c'), ('Gaya', 'IN', 'c'),
  ('Jaipur', 'IN', 'c'), ('Lhasa', 'CN', 'c'), ('Xi\u2019an', 'CN', 'c'), ('Cusco', 'PE', 'c'), ('Florence', 'IT', 'c'),
  ('Venice', 'IT', 'c'), ('Santiago de Compostela', 'ES', 'c'), ('Luxor', 'EG', 'c'), ('Aksum', 'ET', 'c'),
  ('Oaxaca', 'MX', 'c'), ('Siem Reap', 'KH', 'c'), ('Mandalay', 'MM', 'c'), ('Kandy', 'LK', 'c'), ('Hue', 'VN', 'c'),
  ('Luang Prabang', 'LA', 'c'),
]
allf = [line.rstrip('\n').split('\t') for line in open(src, encoding='utf8')]
cultural, cultural_missing = {}, []
for cname, ccc, kind in CULTURAL:
    n = cname.lower()
    cands = [f for f in allf if f[8] == ccc and (f[1].lower() == n or f[2].lower() == n or n in f[3].lower().split(','))]
    if cands: cultural[max(cands, key=lambda f: int(f[14] or 0))[0]] = kind
    else: cultural_missing.append(cname)

rows, seen = [], set()
for f in allf:
    pop, code, name, cc, tz = int(f[14] or 0), f[7], f[1], f[8], f[17]
    kind = cultural.get(f[0], '')
    if pop >= 100000 or code == 'PPLC' or (code == 'PPLA' and pop >= 20000) or kind:
        metro = (name, cc) in METROS and (name, cc) not in seen
        if metro: seen.add((name, cc))
        # Turkey is left out of the Europe rule: its Anatolian cities share Istanbul's time zone
        # core dots ('k') show at every zoom; the other dots appear once the map is zoomed in
        core = code == 'PPLC' or pop >= 10_000_000 or (tz.startswith('Europe/') and cc != 'TR' and pop >= 2_000_000) or metro or kind == 'h'
        flags = ('d' if core or kind else '') + ('k' if core else '') + ('c' if kind else '') + ('h' if kind == 'h' else '')
        rows.append([pop, name, round(float(f[4]), 3), round(float(f[5]), 3), tz, cc, flags, f[0]])
rows.sort(key=lambda r: -r[0])

# GeoNames often gives a whole district's or prefecture's population, so a "1M+" filter on it lets small
# towns through. Natural Earth's pop_max is the urban area's population; each of its 1M+ cities marks one
# GeoNames town as big: a town of the same name within 50 km, or else the most populous town within 30 km
# (so Rome lands on Rome and not on Vatican City, Pune on Pune and not on one of its districts).
def km(a, b):
    dl, dn = math.radians(b[0] - a[0]), math.radians(b[1] - a[1])
    h = math.sin(dl / 2) ** 2 + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(dn / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))
big = {}
ne = [f['properties'] for f in json.load(open(ne_path, encoding='utf8'))['features']]
NE_SKIP = {('Amaravati', 'IN')}   # a planned capital that Natural Earth credits with its whole region's 5.8M
for c in ne:
    if (c.get('pop_max') or 0) < 1_000_000 or (c['name'], c['iso_a2']) in NE_SKIP: continue
    names = {c['name'], c.get('nameascii') or c['name']}
    near = [(i, km((r[2], r[3]), (c['latitude'], c['longitude']))) for i, r in enumerate(rows) if abs(r[2] - c['latitude']) < 0.6]
    same = [i for i, d in near if d < 50 and rows[i][1] in names]
    close = [i for i, d in near if d < 30]
    best = min(same, key=lambda i: dict(near)[i]) if same else max(close, key=lambda i: rows[i][0]) if close else None
    if best is not None: big[best] = max(big.get(best, 0), c['pop_max'])
unmatched = sum(1 for c in ne if (c.get('pop_max') or 0) >= 1_000_000) - len(big)

# Sparse regions (Siberia, the American West, the Sahara, the outback...): wherever no dot lies within GAP km,
# a town is added ('s'), chosen in strict order of preference:
#   1. a state or regional capital of 5,000+ (GeoNames PPLA: the seat of a province, state, oblast or region)
#   2. failing that, a city with an international airport (OurAirports: scheduled service, and either a large
#      airport or "International" in its name), the town of 10,000+ nearest the airport
# Capitals are placed completely, biggest first, before airport towns fill what gaps remain, so a capital always
# wins. Gaps left after both stay empty. Dense regions gain nothing. These dots appear once the map is zoomed in.
GAP = 650
f5000 = [line.rstrip('\n').split('\t') for line in open(src5000, encoding='utf8')]
by_id = {r[7]: r for r in rows}
def as_row(f):   # a GeoNames record from cities5000 as a row, reusing the row if it is already in the list
    if f[0] in by_id: return by_id[f[0]]
    r = [int(f[14] or 0), f[1], round(float(f[4]), 3), round(float(f[5]), 3), f[17], f[8], '', f[0]]
    rows.append(r); by_id[f[0]] = r
    return r
# capitals of 5,000+ (GeoNames also lists the seats of tiny island groups with a few hundred people or none)
capitals = sorted((f for f in f5000 if f[7] == 'PPLA' and int(f[14] or 0) >= 5000), key=lambda f: -int(f[14] or 0))
by_cc = {}
for f in f5000:
    if int(f[14] or 0) >= 10000: by_cc.setdefault(f[8], []).append(f)
airport_towns, airports = {}, 0
for a in csv.DictReader(open(airports_path, encoding='utf8')):
    name = a['name'].lower()
    if a['scheduled_service'] != 'yes' or not (a['type'] == 'large_airport' or 'international' in name or ' intl' in name): continue
    airports += 1
    alat, alon = float(a['latitude_deg']), float(a['longitude_deg'])
    near = [f for f in by_cc.get(a['iso_country'], []) if abs(float(f[4]) - alat) < 0.4 and km((alat, alon), (float(f[4]), float(f[5]))) < 40]
    if not near: continue
    town = next((f for f in near if f[1] == a['municipality'] or f[2] == a['municipality']), None) or max(near, key=lambda f: int(f[14] or 0))
    airport_towns[town[0]] = town
airport_list = sorted(airport_towns.values(), key=lambda f: -int(f[14] or 0))
dots = [(r[2], r[3]) for r in rows if 'd' in r[6]]
far = lambda lat, lon: all(abs(lat - d[0]) > GAP / 111 or km((lat, lon), d) > GAP for d in dots)
added = {'capital': 0, 'airport': 0}
for tier, pool in (('capital', capitals), ('airport', airport_list)):
    for f in pool:
        lat, lon = float(f[4]), float(f[5])
        if not far(lat, lon): continue
        r = as_row(f)
        if 'd' in r[6]: continue
        r[6] += 'ds'; dots.append((r[2], r[3])); added[tier] += 1
anchors = sum(added.values())
# A few GeoNames entries carry a district's name where the city is meant
DISTRICT_NAMES = {'Rasapūdipalem': 'Visakhapatnam', 'Jinshanlu': 'Altay'}
for r in rows:
    if r[1] in DISTRICT_NAMES: r[1] = DISTRICT_NAMES[r[1]]
tzs = sorted({r[4] for r in rows})
ti = {t: i for i, t in enumerate(tzs)}
# People each town stands for: its country's whole population (Natural Earth's 2019 estimate) shared out
# across that country's towns by their size, so rural people are counted near where they live. Scaled so
# the world adds up to today's population.
country_pop = {}
for f in json.load(open(countries_path, encoding='utf8'))['features']:
    q = f['properties']; country_pop[q['ISO_A2_EH']] = country_pop.get(q['ISO_A2_EH'], 0) + q['POP_EST']
town_sum = {}
for r in rows: town_sum[r[5]] = town_sum.get(r[5], 0) + r[0]
weight = [r[0] * country_pop[r[5]] / town_sum[r[5]] if r[5] in country_pop and town_sum[r[5]] else r[0] for r in rows]
scale = WORLD_POP / sum(weight)
weight = [w * scale for w in weight]
missing = sorted(set(country_pop) - set(town_sum))
lines = [f"{r[1]};{r[2]};{r[3]};{ti[r[4]]};{r[5]};{r[0] // 1000};{r[6]};{big[i] // 1000 if i in big else ''};{round(weight[i] / 1000)}" for i, r in enumerate(rows)]
open(out, 'w', encoding='utf8').write(json.dumps({'tz': tzs, 'rows': '\n'.join(lines)}, ensure_ascii=False, separators=(',', ':')))
print('people share: scale', round(scale, 3), '; countries with no town:', missing)
print('cultural cities:', len(cultural), 'matched, missing:', cultural_missing)
print('sparse-region towns added:', anchors, added, '| international airports:', airports, 'serving', len(airport_towns), 'towns')
print(len(rows), 'towns,', sum(1 for r in rows if r[6]), 'dots,', len(big), 'big cities (', unmatched, 'Natural Earth cities unmatched or merged ); unmatched metros:', sorted(METROS - seen))
