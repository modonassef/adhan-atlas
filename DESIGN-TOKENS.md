# Adhan Atlas design tokens

All of these are CSS variables on `:root` in `src/template.html`. Use them in CSS (`var(--r-2)`), and in canvas code
through `tok('--lamp')`, which reads the same variable. Don't write raw hex colours, radii, font sizes or gaps that
match one of these.

## Colour

| Token | Value | Use |
|---|---|---|
| `--ink-0` | `#07080d` | Map and canvas ground (the sea) |
| `--sky` | `#0b0d14` | Page background |
| `--sky-2` | `#11141c` | Cards |
| `--sky-3` | `#1a1e28` | Raised surfaces: inputs, active rows; land on the crescent map |
| `--fg` / `--fg-2` / `--muted` | `#eef0f5` / `#a3a9b8` / `#7a8296` | Primary text, secondary text, captions and icons |
| `--lamp` | `#f1c879` | Lamplight gold. Marks only "now / next", the chosen place, and the selected moment |
| `--lamp-ink` | `#241a05` | Text on a gold fill |
| `--p-fajr` … `--p-isha` | | The six prayer bands, chosen to stay apart under colour blindness |
| `--rule` / `--rule-2` | 8% / 16% of `--fg` | Hairlines on cards; on controls |
| `--rule-3` / `--rule-4` | 28% / 40% of `--fg` | Hairline on a hovered control; on an open or selected one |
| `--sky-glass` | `rgba(11,13,20,.88)` | Panels floating over the map |

The crescent zones have their own colours in the script (`CR_RGB`): gold for the naked eye, teal for binoculars then
perhaps the eye, blue (hatched) for optics only. They are data colours, like the prayer bands, not interface colours.

## Radius, type and space

| Scale | Tokens |
|---|---|
| Radius | `--r-1` 6px, `--r-2` 8px, `--r-3` 10px, `--r-4` 12px, `--r-5` 16px |
| Type size | `--fs-xs` .75rem, `--fs-sm` .8rem, `--fs-md` .85rem, `--fs-base` .9rem |
| Gap | `--s-1` 4px, `--s-2` 8px, `--s-3` 12px, `--s-4` 16px |

Fonts: `--f-display` (Reem Kufi), `--f-body` (Public Sans, IBM Plex Sans Arabic when the page is Arabic), `--f-arabic`
(Amiri Quran), `--f-mono` (IBM Plex Mono). Easing: `--ease`.

## Touch

On touch screens (`@media (pointer: coarse)`) buttons are 40–44px high; with a mouse they keep their compact size.
Links inside a line of text keep their size but get a taller touch area (`.lnk::after`).

## Narrow screens

Below 861px the page is one column (`narrow` in the script, the same breakpoint as `.cols`). There, settings open as
a sheet from the row under the times, the timetable opens on seven days, and a fixed bar at the foot (`.tabbar`)
jumps between sections. The body keeps 76px of bottom padding so nothing hides behind that bar.
