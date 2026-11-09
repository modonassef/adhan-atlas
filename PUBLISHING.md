# Publishing Adhan Atlas

## What is ready

| Path | What it is |
|---|---|
| `site/` | The website, ready to upload as it is. Everything it needs (map libraries, fonts, icons) is inside, so it makes no requests to other servers, works offline once opened, and can be installed to a phone's home screen. |
| `store/icon-1024.png` | The 1024 × 1024 icon the App Store and Google Play ask for (no transparency, as Apple requires). |
| `adhan-atlas.html` | The single-file version published as the claude.ai artifact. |
| `src/` | The source. `site/` and `adhan-atlas.html` are built from it, so make changes there. |

## 1. Choose and buy a domain

Pick a name and check it is free, both as a domain and as an app name in the App Store and Google Play. Buy it from
Cloudflare Registrar, Porkbun or Namecheap; a `.com` or `.app` costs about $10–20 a year. Buying it at Cloudflare
makes step 2 the simplest, because the domain and the hosting are then in one place.

## 2. Put the site online (free)

**Cloudflare Pages** (recommended, free, fast worldwide):

1. Create a Cloudflare account and open **Workers & Pages**.
2. Create a new **Pages** project and choose to **upload** your files (no Git needed).
3. Give the project a name and drag in the **`site`** folder. Deploy.
4. The site is live straight away at `https://<project-name>.pages.dev`. Open it on your phone and check it.
5. In the project's **Custom domains** tab, add your domain. If you bought it at Cloudflare this is a couple of
   clicks; otherwise Cloudflare tells you which DNS records to add at your registrar.

**Simplest alternative:** Netlify Drop (<https://app.netlify.com/drop>): drag the `site` folder onto the page and
it is online, then add your domain in the site settings. GitHub Pages also works.

## 3. Put your address into the site

Link previews (WhatsApp, iMessage, X) need the site's full address. Once you know it, open `src/site.json` and set:

```json
"url": "https://your-domain.com"
```

then rebuild and upload `site/` again (step 4). Share links don't need this; they always use whatever address the
site is opened at.

The address also switches on what search engines need: each page's canonical link, the English/Arabic alternates,
`sitemap.xml` and `robots.txt`. Without it the site works, but those are left out.

### City pages (for search)

The build writes a small page for each of about 770 cities at `prayer-times/<city>/`, with an Arabic one at
`ar/prayer-times/<city>/` for every city that has an Arabic name in the template, and an A–Z index of them at
`prayer-times/`. Each shows a day's times as plain text (the browser replaces them with today's), the method, the
Qibla, the year's fasting hours and a table through the year, and links to the same city on the live map. They are
made by `src/citypages.js` from the same names and astronomy as the map, so they cannot disagree with it.

Once the site has its address, add it in Google Search Console (and Bing Webmaster Tools) and submit
`https://your-domain.com/sitemap.xml`, so the pages are found sooner. Rebuilding and uploading now and then keeps
the plain-text times recent for search engines that do not run scripts.

## 4. Updating the site later

1. Change the source in `src/` (or ask Claude to).
2. Rebuild the website from the project folder:

   ```
   node src/build.js site
   ```

3. Upload the new `site/` folder to the same project (Cloudflare: **Create deployment**; Netlify: drag it in again).

People's offline copies update by themselves the next time they open the site with a connection.

To try the built site on this computer first:

```
python -m http.server 8767 --directory site
```

then open <http://localhost:8767>.

## 5. Check after going live

- On an iPhone, open the site in Safari, tap **Share → Add to Home Screen**. On Android, Chrome offers
  **Install app**. It opens full screen with its own icon.
- Try **Use my location** and the Qibla compass (tap the dial). Both need the real `https://` site; they may be
  blocked inside the claude.ai preview.
- Paste the link into a WhatsApp chat to see the preview card.
- Turn on airplane mode and open it again: it should still work.

## 6. Before the app stores

- **Support and contact.** Both stores require a support address and a privacy policy link. The privacy page is
  `about.html` on your site; add a contact email or form to it first.
- **App build.** The plan is to wrap this same site in Capacitor, which builds the iPhone and Android apps from it,
  and add the native feature that justifies an app: adhan notifications that arrive even when the app is closed.
- **Accounts.** Google Play: $25 once. Apple Developer Program: $99 a year, and building for iPhone needs a Mac
  (your own, a rented cloud Mac, or a build service such as Codemagic).

## Credits you must keep

The town data comes from GeoNames under CC BY 4.0, which requires attribution. It is on the site's
**Privacy and credits** page (`about.html`), linked from the bottom of the main page, together with Natural Earth,
OurAirports, D3, topojson-client and the fonts (SIL Open Font License). Keep that page when you change the site.

## Icons and preview image

`src/web/icons/icon.svg` is the master icon. The PNG sizes were drawn from it with `src/tools/make-icons.html`
and `src/tools/save-images.py`. The link preview, `src/web/og.jpg`, is a render of the live map with the title
over it. Ask Claude to redraw either if the design changes.
