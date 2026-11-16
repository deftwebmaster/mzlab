# ManicZone Lab

Upload-ready static site for **https://lab.maniczone.com/**.

## Deploy

Upload **the contents of this directory** to the new domain’s document root. `index.html`, `CNAME`, `.nojekyll`, and the four collection directories and `apps/` must be at that root. No build or package installation is required. The supplied ZIP has this same flat root layout.

- `/apps/24/meetings/` — 24 Meeting Tracker (schedule and attendance)
- `/games/` — 12 browser games
- `/tools/` — 30 browser tools
- `/projects/` — projects and experiments, including Minecraft tools
- `/shed/` — Script Shed pages and downloadable PHP packages

On GitHub Pages, retain `CNAME` (`lab.maniczone.com`) and `.nojekyll`. On other static hosts, configure that hostname in the host’s domain settings. Keep the root directory layout; these apps are intended for the subdomain root, not a repository-name subpath. The PHP scripts are ZIP downloads; the Lab does not need PHP to serve their product pages. Users installing those scripts need their own compatible PHP hosting.

## What changed

The four collections retain their existing URL paths. Old website references were replaced in pages, styles, JavaScript, metadata, documentation, and downloadable ZIP contents. Site branding now points to ManicZone Lab; author credits retain Matt Livingston. Shared icons and the generic social cards belong to the Lab. Individual game/project artwork remains intact.

The homepage links to all four collections and the meeting tracker, with the dark cyan/violet visual style used across the Lab. Added a sitemap, robots.txt, and a branded 404 page. Each game’s service worker only removes its own obsolete caches, allowing all twelve games to coexist on this origin.

## Before enabling old-site redirects

1. Deploy the new root and verify HTTPS on `lab.maniczone.com`.
2. Open each collection and a few nested apps on the live domain. Check downloads, a social image, manifests, and service-worker requests.
3. Export important saved data from old-domain apps where an export feature exists. Browser storage and installed PWAs belong to their origin; redirects do **not** move saved games, settings, localStorage, or IndexedDB. Import exports on the new domain where supported, and reinstall PWAs from the new domain. Apps without export support do not gain automatic save transfer in this migration. An already-installed offline app may continue to use its old cached copy.
4. Enable path-preserving **301** redirects for only `/games`, `/tools`, `/projects`, and `/shed`, including every descendant. Keep query strings. Leave the rest of the old website on its current domain.
5. Replace the old website’s sitemap with one excluding the relocated sections, and submit the new Lab sitemap through your usual search tools.

An Apache redirect fragment, a proposed old-site sitemap, a full page redirect map, and verification reports are in the sibling `migration/` directory. They are **not** part of the Lab upload.

## Local preview

From the workspace parent, run `node migration/server.cjs`, then open `http://127.0.0.1:8766/`. Root-relative URLs require a local web server; opening individual HTML files using `file://` will not reproduce deployment behavior.

## Verification scope

See `migration/VERIFICATION.md` for the recorded checks and limitations. Hosting, DNS, live HTTPS, old-domain 301 responses, social-platform caches, and real-device installed PWA behavior require checks after deployment. No live deployment or redirects were performed.
