# birthday-nfc

A tiny, self-contained unlock page meant to be opened by tapping a phone against an
NFC tag hidden inside a gift.

Open the link → a soft lock screen appears → the recipient enters a 4-digit date →
the birthday message (and optional photo, music, video and a hidden extra) reveals itself.

Pure HTML + CSS + JavaScript. No framework, no build step, no backend, no database,
no analytics, no tracking, no third-party scripts. The only network request is the
page's own CSS and JS.

---

## 1. What is in here

```
index.html    structure
style.css     all styling (mobile first, iPhone Safari)
script.js     all logic + the single CONFIG block you edit
assets/       your photos / audio / video (currently empty)
```

## 2. Configure it — one place only

Open `script.js`. The very first thing in the file is a `CONFIG` object. Everything you
would ever want to change lives there: the unlock code, the names, the headline, the
message, and every optional section.

```js
const CONFIG = {
  birthdayPassword: "MMDD",   // the unlock code
  recipientName: "…",         // shown in the headline as {name}
  senderName: "…",            // the signature
  gate:    { title, subtitle, buttonLabel, hint, wrongMessage },
  gift:    { title, subtitle },
  message: [ "paragraph one", "paragraph two" ],
  photo:   { enabled, src, caption, alt },
  gallery: { enabled, title, photos: [ … ] },
  music:   { enabled, buttonLabel, embedUrl, audioFile },
  video:   { enabled, buttonLabel, embedUrl, videoFile },
  egg:     { enabled, buttonLabel, title, paragraphs: [ … ] },
  rememberUnlock: true,
};
```

Turn any optional section off with `enabled: false`. Nothing else in the project needs
editing — there are no hard-coded dates, names or paths anywhere else.

### Assets work by dropping files in

Put your files at the exact paths below and the matching section appears on its own.
If a file is missing, that section is skipped silently — no broken image icons.

| File | Purpose |
| --- | --- |
| `assets/photo.jpg` | the one main photo (`.jpeg` / `.png` / `.webp` also accepted) |
| `assets/gallery-1.jpg` … `gallery-4.jpg` | the small square gallery |
| `assets/song.mp3` | local audio → set `music.audioFile: "assets/song.mp3"` |
| `assets/video.mp4` | local video → set `video.videoFile: "assets/video.mp4"` |

For music or video hosted elsewhere (Spotify, Apple Music, YouTube), paste the
**embed** URL — not the normal share link — into `music.embedUrl` / `video.embedUrl`.
Nothing autoplays: Safari blocks it, and an unexpected burst of sound is a bad gift.
The audio/video player loads only after a tap.

## 3. Run it locally

Any static file server works; opening `index.html` directly also works but a server
matches how the real site behaves.

```bash
cd birthday-nfc
python3 -m http.server 8080
# then open http://localhost:8080
```

To check the phone layout on a desktop browser, set the responsive viewport to
**390 × 844** (iPhone 14 Pro).

## 4. Deploying

The project is designed for GitHub Pages:

1. Push the folder to a **public** repository (Pages needs public on free accounts).
2. Repository → **Settings** → **Pages**.
3. Source: **Deploy from a branch**. Branch: **main**. Folder: **/ (root)**. Save.
4. Wait a minute, then open `https://<username>.github.io/<repo>/`.

Every later `git push` to `main` republishes automatically; no CI config needed.

## 5. Writing the NFC tag

Install **NFC Tools** (free, iOS/Android) on the phone you will write with.

1. Open **NFC Tools**
2. **Write**
3. **Add a record**
4. **URL / URI**
5. Paste the GitHub Pages URL of this project
6. **Write**
7. Hold the tag against the **top** of the phone
8. Done — the app confirms the write

Then test it the way the recipient will:

- Fully quit **NFC Tools**
- Go back to the iPhone Home Screen
- Lock the phone
- Hold the **top edge** of the iPhone against the tag
- A notification with the link appears — tap it to open the page

> **iPhones read NFC only from the top edge**, near the camera. On iPhone XS and later,
> background tag reading works without any app open. On older iPhones the recipient
> may need to open Control Center and tap the NFC reader.

## 6. Hiding the tag inside a gift

A plain NFC tag will **not** read through metal. Avoid sticking it directly onto:

- a metal box
- a metal photo frame
- any large metal surface

If the gift is metal or has a metal base, either place the tag on a non-metal part, or
raise the tag a few millimetres off the surface, or use an **anti-metal NFC tag**
(sometimes sold as an "on-metal" or "ferrite-shielded" tag). Test the hidden position
with the real phone *before* sealing the gift.

## 7. Privacy and honest security notes

This is a birthday page, not a vault.

- The unlock code is checked **in the browser, on the front end**. It is light
  protection, not encryption — anyone who opens the page source can read the code.
  Anyone technical can bypass it. That is an accepted trade-off for zero backend and
  zero maintenance.
- Nothing on the page displays the code, and no name or date appears in the page title,
  the URL, or the repository metadata.
- The page requests nothing from third parties: no analytics, no tracking, no ads, no
  external fonts, no CDN. If you paste a Spotify or YouTube embed, that iframe is the
  only exception, and it loads only after a tap.
- The page is marked `noindex, nofollow` so search engines should not list it, but a
  public repository is still public — **do not commit anything you would not want a
  stranger to read.**

**Suitable for:** birthday wishes, ordinary photos, a short personal note, a hidden joke.

**Not suitable for:** ID documents, bank details, phone numbers, addresses, private chat
logs, or anything whose leak would actually hurt. Do not add a backend just to "make it
secure" — keep sensitive material out of the project instead.

## 8. Cost and maintenance

Free to host on GitHub Pages indefinitely. Static files only, so nothing to patch or
upgrade. Editing the birthday message later is a one-line change plus a push.
