# Stepwise

A mobile-first sponsor workspace and a separate, private Step Four writing area. The app runs directly from these files with native browser modules, IndexedDB, and Web Crypto.

## Preview locally

From the **Stepwise Sponsorship App v2** workspace:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000/vanilla/](http://127.0.0.1:8000/vanilla/). Keep the trailing slash. Stop the server with **Ctrl+C**. Localhost and HTTPS allow secure storage, encryption, and the service worker. No npm, build command, or backend is needed to run Stepwise.

The contents of `vanilla/` can be served from any static HTTPS subdirectory. Hash routes such as `/project/stepwise/#/resources/4` refresh without server rewrites. Open the app online once and let its service worker finish installing before trying a cold offline launch. The service worker caches the app shell, Step Kits, icons, and unchanged blank workbook. When a new version is deployed, open copies show **A new version of Stepwise is ready** with an **Update now** button. Closing all Stepwise tabs or installed windows also activates it. Bump the cache version in `sw.js` whenever you change a cached file, or people keep the old version. Stepwise asks the browser for persistent storage on the first save, which reduces automatic clearing. On iPhone, adding Stepwise to the Home Screen gives the most reliable storage.

## Workspaces

- **Today** shows scheduled check-ins (flagging today and overdue), undated next actions, and active sponsees with no follow-up planned, each with when you last talked. Logging a conversation updates the profile’s next action and check-in by default; clear **Update the profile’s next action and check-in** to keep the profile as it is. Today also reminds you to make a sponsor backup when the last one from this browser is more than 30 days old.
- **Sponsees** supports editable profiles, a twelve-step progress strip, conversation history, and assignments. Each profile shows the Step Kit for the sponsee’s current step: discussion prompts, the suggested assignment (**Assign this** starts a prefilled assignment), and a link to the full kit. **Mark Step N complete and move to Step N+1** updates the current step and both step statuses together. Conversations, assignments, and whole profiles (with their records) can be edited or deleted. Archive a profile instead of deleting it to keep the history.
- **Resources** holds the twelve built-in Step Kits and the blank PDF. Each kit links its Big Book and Twelve and Twelve readings on aa.org, and its assignment ideas can be started for any active sponsee. Steps 3–12 include suggested prayers and actions, with links to the relevant pages in A.A. literature. The prayers work offline. The original A.A. readings open online.

Stepwise follows the device’s light or dark setting.
- **Private inventory** opens a passphrase-protected Step Four workspace for the writer. Choose a section or resume the last writing screen. Resentments have a first pass and a separate **My part** pass. Fears and relationships support multiple entries. Review includes the workbook checklist, optional reflections, and private Step Five preparation. **Mark ready to discuss** requires confirmation and stays private. The current sponsorship step is controlled on the profile.

The guided inventory follows the original bundled workbook pages 2–12. Open the blank workbook in the browser’s PDF viewer to print or save it.

## Privacy, saving, and backups

Private writing is stored as an encrypted document in its own IndexedDB database. AES-256-GCM uses a fresh random nonce per save and a non-exportable key derived with PBKDF2-SHA256, 600,000 iterations, and a random salt. The unlocked page keeps the key and writing in memory. Use **Lock** before handing the device over. Leaving the writing area locks it. Reloading requires the passphrase again. Wait for **Saved on this device** before closing or suspending the app, because closing while a save is pending can lose the latest edits. Each inventory supports up to 10 MiB of decrypted data.

The inventory stays out of sponsor screens and exports, URLs, and service-worker caches. The app uses no accounts, analytics, remote services, or automatic sharing. Sponsor records are stored locally in a separate database and are readable by the browser. Sponsor backup files require their own passphrase.

To export an inventory, open **Back up my inventory** on the inventory overview. Prepare and download the encrypted `.stepwise-inventory` file, then store it outside the browser. The file uses the inventory’s existing passphrase. To restore it in a fresh browser, open **Private inventory**, expand **Restore encrypted inventory backup**, and choose the file. Restoring over an existing inventory requires an explicit replacement checkbox and validates the file before writing. **Sponsor backups** exports and imports encrypted `.stepwise-sponsor` files separately, with a 10 MiB limit on decrypted sponsor export data.

Clearing website data, browser storage eviction, reinstalling, or changing browsers can remove access to local records. A different origin, port, or app directory has separate Stepwise storage. Keep your backup files and their passphrases. If you lose an inventory passphrase, Stepwise cannot decrypt that inventory or its backups. Browser extensions, other apps on the same origin, and anyone with access to an unlocked device can be inside the browser’s trust boundary. Use a dedicated HTTPS origin for real private data when possible.

## Legacy migration

Use **Sponsor backups → Import sponsor records** with an original encrypted `.stepwise` file and its original passphrase. Supported legacy files use envelope version 1, data schema version 2, and seed version 1. The importer authenticates the archive, validates its records and references, and shows a review before any sponsor data is written. The import is atomic and additive. It skips identical records and reports ID or step conflicts before allowing an import. It also checks again at commit time. The legacy browser database and selected file remain untouched.

| Carries over | Details |
| --- | --- |
| Profiles | IDs and timestamps, display and start dates, active/paused/archived status, current step, notes, next action and check-in |
| Step progress | All 12 step records per profile with IDs, statuses, and timestamps |
| Conversations | IDs, dates, step if present, summary, reminders, next action and follow-up date |
| Assignments | IDs, profile, step, title, instructions, target date, status, discussion timestamp, and the attachment link to the bundled blank workbook |

The review lists skipped Step Kit records and customizations, resource records and uploaded PDFs, playbooks and their activities and snapshots, preferences, and links to skipped records. Built-in Step Kits and the blank workbook come from the app’s own files. Assignment text remains available even when an uploaded attachment or playbook link is skipped. Keep the original app and legacy backup for those records. Legacy archives support up to 150 MiB of decrypted data and are processed in memory. Use a desktop browser for large files.

## Verification

The optional browser checks in `tests/browser.mjs` use an isolated Chromium browser and temporary localhost server. They read the original project’s bundled defaults and use synthetic records only. With Playwright and Chromium available through the original project, run `node tests/browser.mjs` from the v2 workspace. Set `STEPWISE_PLAYWRIGHT` to use another Playwright installation, `STEPWISE_CHECK=first` for the initial sponsor and resentment flow, or `STEPWISE_VERIFY_LEGACY=1` to generate the synthetic file with the original app’s backup writer in memory. Set `STEPWISE_AXE` to a local path to `axe.min.js` to run the included WCAG checks. Test tooling is separate from the static app.

On a physical iPhone, verify Safari and Home Screen installation, safe-area and software-keyboard behavior, persistence after force-quitting, offline cold launch, and the PDF and backup Files/Share/Print flows. Physical-device testing and deployment are outside this handoff.
