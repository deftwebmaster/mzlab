# ManicZone Lab

A lightweight, responsive holding page for https://lab.maniczone.com/.
Plain HTML and CSS, with a small SVG favicon. No build step, JavaScript, external fonts, analytics, or runtime dependencies.

## Files

- `index.html` — page content and search/social metadata.
- `styles.css` — responsive layout and CSS orbital illustration.
- `favicon.svg` — browser icon.
- `CNAME` — custom domain: lab.maniczone.com.
- `.nojekyll` — serves the files directly without Jekyll processing.

## Deploy to GitHub Pages

1. Extract the ZIP. Upload the contents of `maniczone-lab/` to the root of your GitHub Pages repository, including `.nojekyll`. The publishing folder must contain `index.html` directly.
2. In the repository, open **Settings → Pages**. Choose **Deploy from a branch**, select your publishing branch (usually `main`), and select **/(root)**. Save.
3. In **Custom domain**, enter `lab.maniczone.com` and save. Do this before adding the DNS record.
4. At the provider managing your domain's DNS, add a **CNAME** record with host/name **lab** and value **YOUR-GITHUB-USERNAME.github.io** (or your organization's GitHub Pages hostname). Replace the placeholder. Do not include `https://`, a repository name, or a path. If Namecheap manages the DNS, use its domain DNS controls.
5. Allow the DNS check and certificate provisioning to complete, then enable **Enforce HTTPS** in Pages when available.
6. Visit `https://lab.maniczone.com/` and confirm the page, styling, favicon, and ManicZone links work.

Only the `lab` subdomain needs this DNS record; keep the root domain's existing hosting records. No GitHub account, repository, hosting, or DNS settings were changed as part of this delivery.

GitHub's setup reference: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

## Preview and edit

Open `index.html` directly in a browser, or serve this folder with any static web server. Edit the copy in `index.html`; change colors and spacing in `styles.css`.

The categories are descriptive text until projects are ready. Add real project links when they launch. Each future PWA should define its own manifest and appropriate service-worker scope.

## Verification

Desktop and narrow mobile layouts were visually checked in a browser, including the mobile categories and footer. No horizontal overflow was observed. Local page assets and link targets were checked. Live GitHub Pages deployment and DNS were not tested.
