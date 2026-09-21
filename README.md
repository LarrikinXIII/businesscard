# Scroll-Scrub Portfolio Intro — v2

GitHub Pages-ready, mobile-first scroll-driven video intro.

## What changed in this version

- Replaced the screenshot-image overlays with the **actual HTML content** from the matching section of `businesscard-main`.
- Uses only the content represented in your screenshots:
  - **Input C:** name / role / short description.
  - **Input B:** the same identity section plus the contact rows and availability line.
- No profile photo, skills, portfolio, TikTok section, modals, or other sections from the supplied business-card package are included.
- Video framing is shifted upward to approximately the requested 20–30% range.
- Loader still downloads the full MP4 before revealing the page.

## Files

```text
/
├── index.html
├── styles.css
├── script.js
├── README.md
├── .nojekyll
└── assets/
    ├── scroll-video.mp4
    └── video-poster.webp
```

## Replace the video later

Replace:

`assets/scroll-video.mp4`

with the final video using the same filename. The JavaScript reads its duration automatically. Keeping approximately the same duration will preserve the current pacing.

For smooth mobile scrubbing, keep the replacement H.264, muted/no-audio if possible, `faststart`, and frequent keyframes.

## Move the video up or down

At the top of `styles.css`:

```css
--video-focus-y: 26%;
```

Smaller values show a higher portion of the video. `50%` is centered. Mobile currently uses `24%` inside its media query.

## Tune when the final card enters

At the top of `script.js`:

```js
const B_ENTER_START = 0.70;
const C_FADE_START = 0.56;
const C_FADE_END = 0.74;
```

`B_ENTER_START = 0.70` means Input B begins sliding up after 70% of the scrub journey and reaches full-screen exactly at the final video frame.

## GitHub Pages

Upload the contents of this folder to the repository root, commit/push, then enable **Settings → Pages → Deploy from a branch → main → /(root)**.

No npm, build process, framework, or server is required.
