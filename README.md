# Adhan Atlas

A live world map of the five daily prayers: where the adhan is sounding right now, with prayer times, the Qibla, a
monthly timetable, a new-crescent visibility map and a mosque display for any place. English and Arabic.

Everything is calculated in the browser from the position of the sun. There are no accounts, ads or tracking.

## Build

Needs Node.js 18 or later, and nothing else.

```
node src/build.js site               # the website, into site/ (upload that folder to any static host)
node src/build.js adhan-atlas.html   # the same app as one self-contained file
```

To try the built site on your own computer:

```
python -m http.server 8767 --directory site
```

## What is where

| Path | What it is |
|---|---|
| `src/template.html` | The app: page, styles and script |
| `src/core.js` | The prayer-time astronomy |
| `src/citypages.js` | Makes the website's page for each city, in English and Arabic |
| `src/data/` | Towns, time zones and country outlines |
| `src/web/` | Files copied into the website as they are: fonts, icons, the offline worker |
| `PUBLISHING.md` | How to put the site online |
| `DESIGN-TOKENS.md` | The colours, sizes and spacing the design uses |

## Credits

Town names, positions and time zones from [GeoNames](https://www.geonames.org/) (CC BY 4.0). Country outlines and
populations from [Natural Earth](https://www.naturalearthdata.com/) (public domain). Airports from
[OurAirports](https://ourairports.com/) (public domain). Prayer-time calculation after
[PrayTimes.org](http://praytimes.org/). Map drawing with [D3](https://d3js.org/) and topojson-client (ISC).
Fonts under the SIL Open Font License 1.1: Reem Kufi, Amiri Quran, Public Sans, IBM Plex Mono and IBM Plex Sans
Arabic. The full list is on the site's "Privacy and credits" page.

## Licence

The code is under the [MIT License](LICENSE). The map data, fonts and libraries keep their own licences, credited above.
