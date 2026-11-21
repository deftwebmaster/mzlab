import {
  backupFile, checkPassphrase, decode, legacyFormat, newKey, openEnvelope, readEnvelope, seal, sponsorFormat,
} from './crypto.js'
import { compareSponsor, mergeSponsor, readSponsor, sponsorStores } from './db.js'
import { workbookId } from './sponsor.js'
import { download, errorLine, markBackup, onSubmit } from './ui.js'

const legacyMax = 150 * 1048576
const dated = { id: 'id', createdAt: 'timestamp', updatedAt: 'timestamp' }
const belongs = { ...dated, sponseeId: 'id' }
const schemas = {
  sponsees: {
    ...dated, displayName: 'name', startDate: 'date?', currentStep: 'step', status: 'profileStatus',
    nextAction: 'action', nextCheckIn: 'date?', generalNotes: 'note?', playbookSnapshotId: 'id?',
  },
  sponseeSteps: { ...belongs, stepNumber: 'step', status: 'stepStatus' },
  notes: {
    ...belongs, date: 'date', stepNumber: 'step?', summary: 'summary', remember: 'note?',
    nextAction: 'note?', followUpDate: 'date?',
  },
  assignments: {
    ...belongs, stepNumber: 'step', title: 'title', instructions: 'text', resourceIds: 'ids',
    playbookItemId: 'id?', targetDate: 'date?', status: 'assignmentStatus', discussedAt: 'timestamp?',
  },
  resources: {
    ...dated, title: 'title', description: 'text', stepNumbers: 'steps', category: 'category',
    sourceType: 'sourceType', filePath: 'text?', version: 'text', printable: 'bool',
    size: 'size?', pageCount: 'positive?',
  },
  resourceBlobs: { id: 'id', data: 'base64', type: 'pdfType' },
  stepKits: {
    ...dated, stepNumber: 'step', version: 'positive', title: 'text', overview: 'text', readings: 'texts',
    discussion: 'texts', exercises: 'texts', resourceIds: 'ids', sponsorTips: 'texts', assignmentTemplates: 'templates',
  },
  playbooks: { ...dated, name: 'title', description: 'text', version: 'positive', archived: 'bool' },
  playbookItems: {
    ...dated, playbookId: 'id', title: 'nonempty', description: 'text', stepNumber: 'step',
    orderIndex: 'integer', readingReference: 'note?', resourceIds: 'ids',
    discussionPrompts: 'texts', assignment: 'activityAssignment?',
  },
  sponseePlaybooks: {
    ...belongs, playbookId: 'id', version: 'positive', name: 'text', items: 'items',
  },
  settings: { id: 'preferences', theme: 'theme', uploadLimitMB: 'uploadLimit', seedVersion: 'seedVersion' },
}

const object = value => value && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string'
const bounded = (value, maximum) => text(value) && value.length <= maximum
const nonblank = (value, maximum) => text(value) && value.trim().length > 0 && value.trim().length <= maximum
const integer = value => Number.isInteger(value) && value >= 0
const id = value => text(value) && /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i.test(value)
const step = value => Number.isInteger(value) && value >= 1 && value <= 12
const every = (value, check) => Array.isArray(value) && value.every(check)
const choice = (...options) => value => options.includes(value)

function isoDate(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const rules = {
  id, step, text, integer, date: isoDate,
  timestamp: value => text(value) && isoDate(value.slice(0, 10))
    && /^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?Z$/.test(value),
  note: value => bounded(value, 10000),
  action: value => bounded(value, 1000),
  name: value => nonblank(value, 100),
  title: value => nonblank(value, 200),
  summary: value => nonblank(value, 10000),
  nonempty: value => text(value) && value.length > 0,
  positive: value => integer(value) && value > 0,
  size: value => Number.isFinite(value) && value >= 0,
  bool: value => typeof value === 'boolean',
  profileStatus: choice('Active', 'Paused', 'Archived'),
  stepStatus: choice('Not Started', 'In Progress', 'Completed'),
  assignmentStatus: choice('Not Started', 'In Progress', 'Ready to Discuss', 'Discussed'),
  category: choice('worksheet', 'reading', 'guide'),
  sourceType: choice('bundled', 'uploaded'),
  pdfType: choice('application/pdf'),
  preferences: choice('preferences'),
  theme: choice('light', 'dark', 'system'),
  uploadLimit: value => Number.isFinite(value) && value >= 1 && value <= 100,
  seedVersion: choice(1),
  steps: value => every(value, step),
  texts: value => every(value, text),
  ids: value => every(value, id),
  base64: value => text(value) && value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value),
  templates: value => every(value, row => matches(row, { id: 'id', title: 'nonempty', instructions: 'text', resourceIds: 'ids' })),
  items: value => every(value, row => matches(row, schemas.playbookItems)),
  activityAssignment: value => matches(value, { title: 'text', instructions: 'text' }),
}

function matches(row, schema) {
  return object(row) && Object.entries(schema).every(([name, rule]) => {
    if (rule.endsWith('?')) return row[name] === undefined || rules[rule.slice(0, -1)](row[name])
    return rules[rule](row[name])
  })
}

function need(condition, message) {
  if (!condition) throw new Error(`Invalid backup. ${message}`)
}

function validateStores(stores, names) {
  need(object(stores) && Object.keys(stores).length === names.length, 'Unexpected record collections.')
  for (const name of names) {
    const rows = stores[name]
    need(every(rows, row => matches(row, schemas[name])), `Invalid records in ${name}.`)
    need(new Set(rows.map(row => row.id)).size === rows.length, `Duplicate record IDs in ${name}.`)
  }
}

function validateSponsor(stores) {
  const progress = new Map(stores.sponsees.map(row => [row.id, new Set()]))
  for (const row of stores.sponseeSteps) {
    const owned = progress.get(row.sponseeId)
    need(owned && !owned.has(row.stepNumber), 'Missing profile or duplicate step progress.')
    owned.add(row.stepNumber)
  }
  for (const owned of progress.values()) need(owned.size === 12, 'A profile is missing step records.')
  for (const row of [...stores.notes, ...stores.assignments]) {
    need(progress.has(row.sponseeId), 'A conversation or assignment refers to a missing profile.')
  }
  return progress
}

function validateLegacy(stores, people) {
  const resources = new Map(stores.resources.map(row => [row.id, row]))
  const blobs = new Map(stores.resourceBlobs.map(row => [row.id, row]))
  const books = new Set(stores.playbooks.map(row => row.id))
  const activities = new Set(stores.playbookItems.map(row => row.id))
  const snapshots = new Map(stores.sponseePlaybooks.map(row => [row.id, row]))
  const snapshotActivities = new Map()
  const checkResources = ({ resourceIds }) => {
    need(resourceIds.every(reference => resources.has(reference)), 'A resource reference is missing.')
  }
  need(stores.settings.length === 1, 'The preferences record is missing.')
  need(stores.stepKits.length === 12 && new Set(stores.stepKits.map(row => row.stepNumber)).size === 12,
    'The twelve original Step Kit records are required.')
  for (const row of stores.stepKits) {
    checkResources(row)
    row.assignmentTemplates.forEach(checkResources)
  }
  for (const row of stores.resources) {
    if (row.sourceType === 'bundled') {
      need(row.id === workbookId && row.filePath === 'worksheets/stepwise-step4-inventory-workbook.pdf',
        'Unrecognized bundled resource.')
    } else {
      need(!row.filePath && blobs.has(row.id), 'An uploaded PDF is missing or has an invalid path.')
    }
  }
  for (const row of stores.resourceBlobs) {
    const resource = resources.get(row.id)
    need(resource?.sourceType === 'uploaded', 'An uploaded PDF is missing its resource record.')
    const padding = row.data.endsWith('==') ? 2 : row.data.endsWith('=') ? 1 : 0
    const byteLength = row.data.length * 3 / 4 - padding
    const header = new TextDecoder().decode(decode(row.data.slice(0, 8)))
    need(header.startsWith('%PDF-') && (resource.size === undefined || resource.size === byteLength),
      'An uploaded PDF has an invalid signature or size.')
  }
  for (const row of stores.playbookItems) {
    need(books.has(row.playbookId), 'A playbook activity refers to a missing playbook.')
    checkResources(row)
  }
  for (const row of stores.sponseePlaybooks) {
    need(people.has(row.sponseeId) && books.has(row.playbookId), 'A playbook snapshot has a missing profile or playbook.')
    need(new Set(row.items.map(item => item.id)).size === row.items.length, 'Duplicate activities in a playbook snapshot.')
    const owned = snapshotActivities.get(row.sponseeId) ?? new Set()
    for (const item of row.items) {
      need(item.playbookId === row.playbookId, 'A snapshot activity refers to the wrong playbook.')
      checkResources(item)
      owned.add(item.id)
    }
    snapshotActivities.set(row.sponseeId, owned)
  }
  for (const row of stores.sponsees) {
    if (row.playbookSnapshotId) {
      need(snapshots.get(row.playbookSnapshotId)?.sponseeId === row.id, 'A profile references an invalid playbook snapshot.')
    }
  }
  for (const row of stores.assignments) {
    checkResources(row)
    if (row.playbookItemId) need(activities.has(row.playbookItemId)
      || snapshotActivities.get(row.sponseeId)?.has(row.playbookItemId), 'An assignment references a missing activity.')
  }
}

function validateArchive(data, legacy) {
  need(object(data) && Object.keys(data).length === 4
    && data.format === (legacy ? 'stepwise-data' : 'stepwise-sponsor-data')
    && data.schemaVersion === (legacy ? 2 : 1) && rules.timestamp(data.exportedAt),
  'Unrecognized data format or schema version.')
  validateStores(data.stores, legacy ? Object.keys(schemas) : sponsorStores)
  const people = validateSponsor(data.stores)
  if (legacy) validateLegacy(data.stores, people)
  else {
    need(data.stores.sponsees.every(row => row.playbookSnapshotId === undefined)
      && data.stores.assignments.every(row => row.playbookItemId === undefined
        && row.resourceIds.every(resource => resource === workbookId)), 'Unexpected playbook or resource reference.')
  }
}

function project(stores) {
  return Object.fromEntries(sponsorStores.map(name => [name, stores[name].map(row => {
    const cleaned = Object.fromEntries(Object.keys(schemas[name])
      .filter(key => !['playbookSnapshotId', 'playbookItemId'].includes(key) && row[key] !== undefined)
      .map(key => [key, row[key]]))
    if (name === 'assignments') cleaned.resourceIds = row.resourceIds.filter(resource => resource === workbookId)
    return cleaned
  })]))
}

function omissions(stores) {
  return [
    ['Step Kit records, including any customizations', stores.stepKits.length],
    ['Resource records, including the legacy workbook listing', stores.resources.length],
    ['Uploaded PDF files', stores.resourceBlobs.length],
    ['Playbooks', stores.playbooks.length],
    ['Playbook activities', stores.playbookItems.length],
    ['Assigned playbook snapshots', stores.sponseePlaybooks.length],
    ['Preference records', stores.settings.length],
    ['Profile links to playbook snapshots', stores.sponsees.filter(row => row.playbookSnapshotId).length],
    ['Assignment links to playbook activities', stores.assignments.filter(row => row.playbookItemId).length],
    ['Assignment attachment links to uploaded PDFs', stores.assignments.reduce((sum, row) =>
      sum + row.resourceIds.filter(resource => resource !== workbookId).length, 0)],
  ].filter(([, count]) => count)
}

const labels = { sponsees: 'Sponsee profiles', sponseeSteps: 'Step records', notes: 'Conversations', assignments: 'Assignments' }

function review(container, incoming, skipped, report) {
  const count = Object.values(report.additions).reduce((sum, rows) => sum + rows.length, 0)
  container.innerHTML = `<section class="panel import-review"><h2 tabindex="-1">Review sponsor import</h2>
    <ul class="bullets">${sponsorStores.map(name => `<li>${labels[name]} · ${incoming[name].length} in file, ${report.additions[name].length} new</li>`).join('')}</ul>
    ${report.duplicates ? `<p>Identical records already present · ${report.duplicates}</p>` : ''}
    ${report.conflicts ? `<p class="error">Conflicting records · ${report.conflicts}. Resolve those conflicts before importing this backup.</p>` : ''}
    ${skipped.length ? `<h3>Items this version skips</h3><ul class="bullets">
      ${skipped.map(([label, amount]) => `<li>${label} · ${amount}</li>`).join('')}</ul>
      <p>The built-in Step Kits and blank workbook are already available in Resources. Assignments keep their links to the blank workbook.</p>` : ''}
    ${!report.conflicts && count ? `<form method="post"><button type="submit" class="button">Import ${count} sponsor records</button>${errorLine}</form>` : ''}
    <p role="status" data-import-result></p>
  </section>`
  container.querySelector('h2').focus()
  const form = container.querySelector('form')
  if (form) onSubmit(form, async () => {
    await mergeSponsor(incoming)
    container.querySelector('[data-import-result]').textContent = 'Sponsor records imported.'
    form.remove()
  })
}

export function showBackups(main) {
  main.innerHTML = `<div class="page-heading"><div><p class="kicker">Sponsor workspace</p><h1 tabindex="-1">Sponsor backups</h1>
    <p class="lede">Export sponsor records or bring them over from the original Stepwise app.</p></div></div>
    <section class="panel form-panel"><h2>Import sponsor records</h2>
      <p>Choose an encrypted legacy .stepwise file or a Stepwise sponsor backup. Review the records before adding them to this workspace.</p>
      <form method="post" data-import>
        <label class="field"><span>Sponsor backup file</span><input type="file" name="file" accept=".stepwise,.stepwise-sponsor" required></label>
        <label class="field"><span>Backup passphrase</span><input type="password" name="passphrase" required autocomplete="current-password"></label>
        <button class="button" type="submit">Review sponsor backup</button>${errorLine}
      </form></section>
    <div data-review></div>
    <section class="panel form-panel"><h2>Export sponsor records</h2>
      <p>This encrypted backup contains profiles, step records, conversations, and assignments. Private inventory has its own backup in the writing area.</p>
      <form method="post" data-export>
        <label class="field"><span>New backup passphrase</span><input type="password" name="passphrase" minlength="12" required autocomplete="new-password"></label>
        <label class="field"><span>Confirm backup passphrase</span><input type="password" name="confirm" minlength="12" required autocomplete="new-password"></label>
        <button class="button" type="submit">Prepare sponsor backup</button>${errorLine}
      </form><div data-download></div>
    </section>
    <p class="help">Clearing browser data can remove local sponsor records. Keep your encrypted backups outside the browser and keep the passphrase required to open each file.</p>`
  const importer = main.querySelector('[data-import]')
  const reviewHost = main.querySelector('[data-review]')
  let selection = 0
  importer.elements.file.addEventListener('change', () => {
    selection++
    reviewHost.replaceChildren()
  })
  onSubmit(importer, async ({ file, passphrase }) => {
    const reviewed = selection
    reviewHost.replaceChildren()
    const envelope = await readEnvelope(file, legacyMax * 1.4)
    const legacy = envelope?.format === legacyFormat
    const { data } = await openEnvelope(envelope, [legacyFormat, sponsorFormat], passphrase, legacy ? legacyMax : undefined)
    validateArchive(data, legacy)
    const incoming = project(data.stores)
    const report = compareSponsor(incoming, await readSponsor())
    if (!reviewHost.isConnected || reviewed !== selection) return
    importer.reset()
    review(reviewHost, incoming, legacy ? omissions(data.stores) : [], report)
  })
  const exporter = main.querySelector('[data-export]')
  const downloadHost = main.querySelector('[data-download]')
  onSubmit(exporter, async ({ passphrase, confirm }) => {
    downloadHost.replaceChildren()
    checkPassphrase(passphrase, confirm)
    const stores = project(await readSponsor())
    const archive = { format: 'stepwise-sponsor-data', schemaVersion: 1, exportedAt: new Date().toISOString(), stores }
    const envelope = await seal(sponsorFormat, archive, await newKey(passphrase))
    exporter.reset()
    if (!downloadHost.isConnected) return
    download(downloadHost, backupFile(envelope), `stepwise-${new Date().toISOString().slice(0, 10)}.stepwise-sponsor`)
    downloadHost.querySelector('a').addEventListener('click', markBackup)
  })
}
