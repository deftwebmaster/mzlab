import { readVault, writeVault } from './db.js'
import {
  backupFile, checkPassphrase, inventoryFormat, newKey, openEnvelope, readEnvelope, seal,
} from './crypto.js'
import { field, html, onSubmit, errorLine, download, workbookLink } from './ui.js'
import { sections, reviewPages, checklist, reflections, prepChecklist, prepFields } from './prompts.js'

let session
let view = { screen: 'overview' }
let host
let header
let dirty = false
let pending
let saveFailure = ''
let hiding

const owns = (object, key) => Object.hasOwn(object, key)
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const validFields = (input, allowed, type) => object(input) && Object.entries(input).every(([key, value]) =>
  allowed.includes(key) && typeof value === type && (type !== 'string' || value.length <= 20000))
const checkKeys = groups => Object.values(groups).flatMap(group => Object.keys(group))

function blank() {
  return {
    version: 1, entries: { resentments: [], fears: [], relationships: [] },
    checks: {}, reflections: {}, prepChecks: {}, prep: {}, ready: false, resume: null,
  }
}

function validateDraft(data) {
  const valid = object(data) && data.version === 1 && object(data.entries)
    && Object.keys(data).length === 8
    && Object.keys(data.entries).length === Object.keys(sections).length
    && Object.entries(sections).every(([key, section]) =>
      Array.isArray(data.entries[key]) && data.entries[key].every(entry =>
        validFields(entry, [...Object.keys(section.fields), ...Object.keys(section.second ?? {})], 'string')))
    && validFields(data.checks, checkKeys(checklist), 'boolean')
    && validFields(data.reflections, Object.keys(reflections), 'string')
    && validFields(data.prepChecks, checkKeys(prepChecklist), 'boolean')
    && validFields(data.prep, Object.keys(prepFields), 'string')
    && typeof data.ready === 'boolean'
  if (!valid || (data.resume !== null && !validResume(data.resume, data))) {
    throw new Error('This backup contains an unsupported inventory.')
  }
  return data
}

function validResume(resume, draft) {
  if (!object(resume)) return false
  if (resume.screen === 'entry') {
    return owns(sections, resume.section) && Number.isInteger(resume.index) && resume.index >= 0
      && resume.index < draft.entries[resume.section].length
      && (resume.pass === 1 || (resume.pass === 2 && resume.section === 'resentments'))
  }
  return owns(reviewPages, resume.screen)
}

function paintSaveState() {
  const label = host?.querySelector('[data-save]')
  const retry = host?.querySelector('[data-retry]')
  const error = host?.querySelector('[data-save-error]')
  if (label) label.textContent = saveFailure ? 'Save failed' : dirty || pending ? 'Saving…' : 'Saved on this device'
  if (retry) retry.hidden = !saveFailure
  if (error) error.textContent = saveFailure
}

async function flush() {
  if (!session) return
  if (!pending && dirty) {
    const current = session
    pending = (async () => {
      while (dirty && session === current) {
        dirty = false
        const envelope = await seal(inventoryFormat, current.draft, current)
        current.revision = await writeVault(envelope, current.revision)
        current.envelope = envelope
      }
    })()
    try {
      await pending
      saveFailure = ''
    } catch (error) {
      dirty = true
      saveFailure = error.message || 'Browser storage could not save your writing.'
      throw error
    } finally {
      pending = undefined
      paintSaveState()
    }
  } else if (pending) {
    await pending
  }
}

function changed() {
  dirty = true
  saveFailure = ''
  const request = flush()
  paintSaveState()
  request.catch(() => {})
}

async function openHere(draft, credentials, revision, envelope) {
  session = { draft, key: credentials.key, salt: credentials.salt, revision, envelope }
  view = { screen: 'overview' }
  await render()
}

function forget() {
  session = undefined
  dirty = false
  saveFailure = ''
  view = { screen: 'overview' }
}

export function hasPendingInventory() {
  return Boolean(session && (dirty || pending))
}

export async function leaveInventory() {
  if (!session) return
  try {
    await flush()
  } catch {
    if (!window.confirm('Your latest edits could not be saved. Leave and discard these unsaved edits?')) return false
  }
  forget()
  host.replaceChildren()
}

export function hideInventory() {
  if (!session) return
  host.replaceChildren()
  header.replaceChildren()
  // Hide decrypted content from the page cache immediately. A save already in
  // progress can finish if the browser allows it.
  const closingSession = session
  hiding = flush().catch(() => {}).finally(() => {
    if (session === closingSession) forget()
    hiding = undefined
  })
}

export async function showInventory(main, shell) {
  host = main
  header = shell
  if (hiding) await hiding
  await render()
}

function frame(content, { open = false } = {}) {
  header.innerHTML = `<div class="private-header">
    <a class="brand" href="#/inventory"><span class="brand-mark" aria-hidden="true">S</span> Stepwise</a>
    <div class="private-nav">
      <a class="quiet" href="#/today" aria-label="Sponsor workspace"><span class="private-nav-full">Sponsor workspace</span><span class="private-nav-short">Sponsor</span></a>
      ${open ? '<button type="button" class="button secondary" data-lock>Lock</button>' : ''}
    </div>
  </div>`
  host.innerHTML = `<div class="private-content">${open ? `<div class="save-bar">
    <span class="save-status" role="status" data-save></span>
    <button class="button secondary small" type="button" data-retry hidden>Retry save</button>
    <p class="error" role="alert" data-save-error></p>
  </div>` : ''}${content}</div>`
  header.querySelector('[data-lock]')?.addEventListener('click', async () => {
    if (await leaveInventory() !== false) await redraw()
  })
  if (open) header.querySelector('.brand').onclick = event => {
    event.preventDefault()
    move({ screen: 'overview' })
  }
  host.querySelector('[data-retry]')?.addEventListener('click', changed)
  paintSaveState()
}

async function redraw() {
  await render()
  host.querySelector('h1')?.focus()
  window.scrollTo(0, 0)
}

async function move(next) {
  view = next
  if (validResume(next, session.draft)) {
    session.draft.resume = next
    changed()
  }
  await redraw()
}

function intro(title, detail, meta = '') {
  return `<div class="page-heading"><div>${meta ? `<p class="kicker">${meta}</p>` : ''}
    <h1 tabindex="-1">${title}</h1><p class="lede">${detail}</p></div></div>`
}

function passInput(label, name, kind = 'current-password') {
  return `<label class="field"><span>${label}</span><input required type="password" name="${name}" autocomplete="${kind}"></label>`
}

async function renderLocked() {
  const stored = await readVault()
  frame(`${intro('Step Four inventory', 'A private place to write through the Step Four workbook.', 'Private writing')}
    <div class="stack">
      <section class="panel lock-panel"><h2>${stored ? 'Unlock your inventory' : 'Create your private inventory'}</h2>
        <p>${stored ? 'Enter your inventory passphrase to resume writing.' : 'Choose a passphrase of at least 12 characters to encrypt your writing on this device.'}</p>
        <form method="post" data-unlock>
          ${passInput('Inventory passphrase', 'passphrase', stored ? 'current-password' : 'new-password')}
          ${stored ? '' : passInput('Confirm passphrase', 'confirm', 'new-password')}
          <button type="submit" class="button">${stored ? 'Unlock inventory' : 'Create inventory'}</button>
          ${errorLine}
        </form>
      </section>
      <div class="actions">${workbookLink()}</div>
      <details class="panel"><summary>Restore encrypted inventory backup</summary>
        <form method="post" data-restore>
          <p>Restore an inventory file using the passphrase from when it was made.</p>
          <label class="field"><span>Encrypted inventory file</span><input type="file" name="file" accept=".stepwise-inventory" required></label>
          ${passInput('Backup passphrase', 'passphrase')}
          ${stored ? '<label class="check"><input type="checkbox" required><span>Replace the inventory currently stored on this device.</span></label>' : ''}
          <button type="submit" class="button">Restore inventory</button>
          ${errorLine}
        </form>
      </details>
      <p class="help">Clearing browser data removes your local inventory. Keep an encrypted backup outside the browser. Your passphrase is required to open the inventory and its backups. There is no passphrase recovery.</p>
    </div>`)
  onSubmit(host.querySelector('[data-unlock]'), async ({ passphrase, confirm }) => {
    if (!stored) checkPassphrase(passphrase, confirm)
    const opened = stored
      ? await openEnvelope(stored.envelope, [inventoryFormat], passphrase)
      : await newKey(passphrase)
    if (location.hash !== '#/inventory') return
    if (stored) {
      await openHere(validateDraft(opened.data), opened, stored.revision, stored.envelope)
    } else {
      const draft = blank()
      const envelope = await seal(inventoryFormat, draft, opened)
      const revision = await writeVault(envelope, undefined)
      if (location.hash === '#/inventory') await openHere(draft, opened, revision, envelope)
    }
    if (location.hash === '#/inventory') host.querySelector('h1')?.focus()
  })
  onSubmit(host.querySelector('[data-restore]'), async ({ file, passphrase }) => {
    const envelope = await readEnvelope(file)
    const opened = await openEnvelope(envelope, [inventoryFormat], passphrase)
    const draft = validateDraft(opened.data)
    if (location.hash !== '#/inventory') return
    const revision = await writeVault(envelope, stored?.revision)
    if (location.hash !== '#/inventory') return
    await openHere(draft, opened, revision, envelope)
    host.querySelector('h1')?.focus()
  })
}

const overviewButton = '<button class="quiet" type="button" data-overview>← Inventory overview</button>'
const sectionButton = '<button class="quiet" type="button" data-section-back>← Section entries</button>'
const sectionMeta = section => `Workbook pages ${section.pages} <span aria-hidden="true">·</span> Big Book pages ${section.reading}`

function overview() {
  const { draft } = session
  frame(`${intro('Step Four inventory', 'Work in any order. You can leave any prompt blank and return when you’re ready.', 'Private writing')}
    <div class="actions">
      <button type="button" class="button" data-resume>Resume writing</button>
      ${workbookLink()}
    </div>
    <div class="section-grid">
      ${Object.entries(sections).map(([id, section]) => {
        const count = draft.entries[id].length
        return `<button class="section-card" type="button" data-section="${id}">
          <span class="meta">Workbook pages ${section.pages}</span><strong>${section.title}</strong>
          <span>${section.description}</span>
          <span class="card-action">${count ? `${count} ${count === 1 ? 'entry' : 'entries'}` : 'Open section'} <span aria-hidden="true">→</span></span>
        </button>`
      }).join('')}
      <button type="button" class="section-card" data-review>
        <span class="meta">Workbook pages 10–12</span><strong>Review & Step Five prep</strong>
        <span>Review your inventory, reflect on patterns, and make a private plan for Step Five.</span>
        <span class="card-action">${draft.ready ? 'Marked ready to discuss' : 'Open review'} <span aria-hidden="true">→</span></span>
      </button>
    </div>
    <details class="panel"><summary>Back up my inventory</summary>
      <p class="help">The file is encrypted with your current inventory passphrase. Store the file outside this browser.</p>
      <div data-download><button type="button" class="button secondary" data-export>Prepare encrypted backup</button></div>
      <p class="error" role="alert" data-export-error></p>
    </details>`, { open: true })
  host.querySelector('[data-resume]').onclick = () => move(draft.resume ?? { screen: 'section', section: 'resentments' })
  host.querySelectorAll('[data-section]').forEach(button => {
    button.onclick = () => move({ screen: 'section', section: button.dataset.section })
  })
  host.querySelector('[data-review]').onclick = () => move({ screen: 'reviewMenu' })
  host.querySelector('[data-export]').onclick = async () => {
    const current = session
    try {
      await flush()
      if (current === session && host.querySelector('[data-download]')) {
        download(host.querySelector('[data-download]'), backupFile(current.envelope), 'stepwise-private.stepwise-inventory')
      }
    } catch {
      const error = host.querySelector('[data-export-error]')
      if (error) error.textContent = 'Save your latest changes before exporting a backup.'
    }
  }
}

function openEntry(section, index, pass = 1) {
  return move({ screen: 'entry', section, index, pass })
}

function sectionList() {
  const id = view.section
  const section = sections[id]
  const entries = session.draft.entries[id]
  frame(`${overviewButton}${intro(section.title, section.description, sectionMeta(section))}
    <div class="actions"><button type="button" class="button" data-add>Add entry</button></div>
    ${entries.length ? `<ul class="entry-list">${entries.map((entry, index) => `<li class="panel row">
      <button type="button" class="quiet" data-entry="${index}">${section.singular} ${index + 1}</button>
      ${id === 'resentments' ? `<button type="button" class="button secondary small" data-part="${index}" aria-label="My part for resentment ${index + 1}">My part</button>` : ''}
    </li>`).join('')}</ul>` : '<p class="empty">Add an entry when you’re ready to write.</p>'}`, { open: true })
  host.querySelector('[data-overview]').onclick = () => move({ screen: 'overview' })
  host.querySelector('[data-add]').onclick = () => {
    entries.push({})
    openEntry(id, entries.length - 1)
  }
  host.querySelectorAll('[data-entry]').forEach(button => {
    button.onclick = () => openEntry(id, Number(button.dataset.entry))
  })
  host.querySelectorAll('[data-part]').forEach(button => {
    button.onclick = () => openEntry(id, Number(button.dataset.part), 2)
  })
}

function writingFields(fields, values) {
  return Object.entries(fields).map(([id, [label, hint]]) => `<div class="writing-field">
    <div class="field"><label for="write-${id}">${html(label)}</label>
      ${hint ? `<small class="help" id="hint-${id}">${html(hint)}</small>` : ''}
      <textarea id="write-${id}" rows="4" maxlength="20000" spellcheck="false" autocorrect="off" autocomplete="off" autocapitalize="off" name="${id}"${hint ? ` aria-describedby="hint-${id}"` : ''}>\n${html(values[id])}</textarea>
    </div></div>`).join('')
}

function bindWriting(values) {
  for (const control of host.querySelectorAll('.writing-field textarea')) {
    control.oninput = () => {
      values[control.name] = control.value
      changed()
    }
  }
}

function entryView() {
  const { section: id, index, pass } = view
  const section = sections[id]
  const entries = session.draft.entries[id]
  const entry = entries[index]
  const title = pass === 2 ? 'My part' : `${section.singular} ${index + 1}`
  const detail = id === 'resentments'
    ? (pass === 2 ? 'Second pass · Your own conduct where applicable' : 'First pass · Who or what, the cause, and what was affected')
    : section.description
  frame(`${sectionButton}${intro(title, detail, `${section.title} <span aria-hidden="true">·</span> Entry ${index + 1} of ${entries.length}`)}
    <section class="panel writing-panel">
    ${pass === 2 ? `<details class="prior"><summary>Read first-pass notes</summary>
      <dl>${Object.entries(section.fields).map(([key, [label]]) =>
        `<dt>${html(label)}</dt><dd>${html(entry[key] || 'Left blank')}</dd>`).join('')}</dl></details>` : ''}
    ${writingFields(pass === 2 ? section.second : section.fields, entry)}
    <div class="actions">
      <button class="button" type="button" data-done>Done for now</button>
      ${id === 'resentments' ? `<button class="button secondary" type="button" data-switch>${pass === 2 ? 'Go to first pass' : 'Go to My part'}</button>` : ''}
    </div></section>
    <div class="actions pagination">
      ${index > 0 ? '<button class="quiet" type="button" data-prev>← Previous entry</button>' : ''}
      ${index + 1 < entries.length ? '<button class="quiet" type="button" data-next>Next entry →</button>' : ''}
    </div>`, { open: true })
  bindWriting(entry)
  const back = () => move({ screen: 'section', section: id })
  host.querySelector('[data-section-back]').onclick = back
  host.querySelector('[data-done]').onclick = back
  host.querySelector('[data-switch]')?.addEventListener('click', () => openEntry(id, index, pass === 1 ? 2 : 1))
  host.querySelector('[data-prev]')?.addEventListener('click', () => openEntry(id, index - 1, pass))
  host.querySelector('[data-next]')?.addEventListener('click', () => openEntry(id, index + 1, pass))
}

function reviewMenu() {
  frame(`${overviewButton}${intro('Review & Step Five prep', 'Review what you’ve written and prepare for a private Step Five conversation.', 'Workbook pages 10–12')}
    <div class="section-grid">${Object.entries(reviewPages).map(([id, page]) =>
      `<button type="button" class="section-card" data-review-page="${id}"><span class="meta">Workbook page ${page.page}</span>
        <strong>${page.title}</strong><span>${page.description}</span><span class="card-action">Open <span aria-hidden="true">→</span></span></button>`).join('')}</div>`, { open: true })
  host.querySelector('[data-overview]').onclick = () => move({ screen: 'overview' })
  host.querySelectorAll('[data-review-page]').forEach(button => {
    button.onclick = () => move({ screen: button.dataset.reviewPage })
  })
}

function checkboxGroups(groups, values) {
  return Object.entries(groups).map(([group, items]) => `<fieldset><legend>${group}</legend>
    ${Object.entries(items).map(([id, label]) => `<label class="check"><input type="checkbox" name="${id}"${values[id] ? ' checked' : ''}><span>${label}</span></label>`).join('')}
  </fieldset>`).join('')
}

function reviewPage() {
  const { draft } = session
  const page = reviewPages[view.screen]
  const checks = view.screen === 'review' ? draft.checks : draft.prepChecks
  const writing = view.screen === 'reflection' ? draft.reflections : draft.prep
  const prep = view.screen === 'preparation'
  let content
  if (view.screen === 'review') content = checkboxGroups(checklist, checks)
  if (view.screen === 'reflection') content = writingFields(reflections, writing)
  if (prep) content = checkboxGroups(prepChecklist, checks) + writingFields(prepFields, writing)
  frame(`<button class="quiet" type="button" data-review-back>← Review & Step Five prep</button>
    ${intro(page.title, page.description, `Workbook page ${page.page}`)}
    <section class="panel writing-panel">${content}
      ${prep ? `<div class="ready-panel"><h2>Ready to discuss</h2>
        <p class="help">This marker stays in your private inventory. Current steps are updated manually in the sponsor workspace.</p>
        <p role="status">${draft.ready ? 'Marked ready to discuss' : ''}</p>
        <button class="button secondary" type="button" data-ready>${draft.ready ? 'Clear ready marker' : 'Mark ready to discuss'}</button>
      </div>` : ''}
      <button class="button" type="button" data-review-done>Done for now</button>
    </section>`, { open: true })
  bindWriting(writing)
  for (const control of host.querySelectorAll('input[type="checkbox"]')) {
    control.onchange = () => {
      checks[control.name] = control.checked
      changed()
    }
  }
  host.querySelector('[data-ready]')?.addEventListener('click', () => {
    if (!draft.ready && !window.confirm('Mark your private inventory ready to discuss?')) return
    draft.ready = !draft.ready
    changed()
    reviewPage()
    host.querySelector('[data-ready]').focus()
  })
  const back = () => move({ screen: 'reviewMenu' })
  host.querySelector('[data-review-back]').onclick = back
  host.querySelector('[data-review-done]').onclick = back
}

async function render() {
  if (!crypto.subtle || !globalThis.indexedDB) {
    frame(intro('Step Four inventory', 'Open Stepwise over HTTPS or on localhost in a browser with secure storage.'))
  } else if (!session) {
    await renderLocked()
  } else if (view.screen === 'overview') overview()
  else if (view.screen === 'section') sectionList()
  else if (view.screen === 'entry') entryView()
  else if (view.screen === 'reviewMenu') reviewMenu()
  else reviewPage()
}
