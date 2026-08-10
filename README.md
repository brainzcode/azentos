# Azentos

Static one-page marketing site. Plain HTML, CSS and JavaScript — no build step, no
dependencies, no tooling. Open `index.html` in a browser, or drop the folder on any
static host.

## Before launch

**Replace the placeholder domain.** `https://azentos.example.com` appears **4 times** in
`index.html` (canonical, `og:url`, `og:image`, `twitter:image`). Social crawlers fetch
these from their own servers, so they must be absolute URLs on the real public origin —
link previews cannot work on `localhost` or `file://`. After deploying, re-scrape via the
[Facebook debugger](https://developers.facebook.com/tools/debug/) and
[LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/); both cache hard.

`favicon.ico` and `site.webmanifest` must stay at the web root.

## Structure

```
index.html          markup + inline SVG icon sprite
css/styles.css      design tokens, components, breakpoints
js/main.js          mobile menu, accordion, rail drag, wordmark fit, scroll reveal
assets/img/         photography (web-sized, ~460 KB total)
assets/icons/       brand marks + favicon set
assets/images/      1200x630 share image
assets/old/         original unprocessed source images (not shipped)
assets/screenshots/ design reference (not shipped)
```

`assets/old/` and `assets/screenshots/` are working files — exclude them from deploys.

## Design notes

Fonts are Geist / Geist Mono from Google Fonts, with a Helvetica-family fallback stack.

Breakpoints: `600` (two-up work grid), `900` (footer columns), `1024` (desktop hero
composition — below this the hero stacks and the model becomes a faded backdrop), `1180`
(accordion splits title and description onto one line), `1440` (composition locks).

Type and spacing are fluid via `clamp()` rather than fixed per-breakpoint sizes. Verified
free of horizontal overflow from 320px to 1920px.

**The hero** is one screen tall (`min-height: 100svh`, so content can push it taller
rather than being clipped) with the photograph as a full-bleed `object-fit: cover`
background. Its vertical rhythm is set in `vh` — headline at ~25% down, `--fs-mega` as
`min(6.8vw, 9vh)` — so the whole panel fits the viewport at any height. `object-position`
is `50% 0`: the top anchor keeps the model's crown just under the top edge when a wide
viewport crops vertically.

Four things that are load-bearing and easy to break:

- **`.acc__media` is `display: none` when closed.** A grid item whose named area is absent
  from the active `grid-template-areas` gets auto-placed into a new implicit column, which
  silently squeezes every other column on that row.
- **The badge and chip sizing is in absolute units, not percentages.** Percentage padding
  resolves against the containing block's inline size, not the element's own — with
  `border-box` that can zero out an element's content box.
- **The footer wordmark is fitted in JS** (`fit()` in `main.js`) by measuring an
  inline-block child. `scrollWidth` cannot be used: it is clamped to the box, so it reports
  the column width whenever the type is smaller than its column.
- **The hero has no vertical rules.** An earlier pass added hairlines at the photo's
  column edges; the source has none — that was the model's own silhouette edge misread
  from a low-resolution thumbnail.

## Credits

Site by [Luminous Digital Visions](https://luminousdigitalvisions.com).
