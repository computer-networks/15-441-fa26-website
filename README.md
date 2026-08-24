# 15-441/641 — Computer Networks

Course website for Fall 2026. The site is intentionally plain HTML/CSS: GitHub
Pages can publish it without a package manager or a generated directory.

## Preview locally

Create the ignored local calendar configuration once:

```sh
cp assets/js/calendar-config.example.js assets/js/calendar-config.js
```

Open `assets/js/calendar-config.js` and insert the browser API key. This file is
ignored by Git and must not be committed. Then run:

```sh
make serve
```

Open <http://localhost:4000>. Stop the server with `Ctrl-C`.

## Check before publishing

```sh
make check
```

This validates internal links, image references, HTML structure, and the files
required by GitHub Pages. It uses only Python's standard library.

## Publish with GitHub Pages

1. Push `main` to GitHub.
2. Add the restricted key as an Actions repository secret named
   `GOOGLE_CALENDAR_API_KEY`:
   - Open **Repository Settings → Secrets and variables → Actions**.
   - Select **New repository secret**.
   - Enter `GOOGLE_CALENDAR_API_KEY` as the name and paste the key as its value.
3. In **Settings → Pages**, set **Source** to **GitHub Actions**.
4. The `Deploy course site` workflow publishes every push to `main`.

> **API key safety:** Never commit `assets/js/calendar-config.js`, paste the key
> into `index.html`, or include it directly in a commit. Before publishing,
> confirm the key is restricted to the **Google Calendar API** and to the
> production GitHub Pages/custom domain plus the approved localhost referrers.

The deployment workflow generates `calendar-config.js` from the secret. The
browser caches the current week's public events for ten minutes. The key is
still visible to browsers at runtime—as all static-site browser keys are—so its
HTTP-referrer and Google Calendar API restrictions are required.

Relative asset URLs are used throughout, so the same files work at both `/`
locally and `/15-441-fa26/` on GitHub Pages.

## Updating the course

- Edit announcements, deadlines, and links in `index.html`.
- Put public downloads in `assets/` and link to them with relative paths.
- Keep generated output such as `_site/` out of version control.

Links that are not ready are rendered as non-clickable “coming soon” labels.
Replace a label with an anchor only when its Fall 2026 destination is ready.
