import { deleteSponsor, readSponsor, stamps, writeSponsor } from './db.js'
import { dateLabel, errorLine, field, html, lastBackup, onSubmit, select, today, workbookLink } from './ui.js'

const steps = Array.from({ length: 12 }, (_, index) => index + 1)
const profiles = ['Active', 'Paused', 'Archived']
const progress = ['Not Started', 'In Progress', 'Completed']
const assignments = ['Not Started', 'In Progress', 'Ready to Discuss', 'Discussed']
export const workbookId = '621f1c4c-65ab-550e-b4c5-caf7e475d71f'
const backupInterval = 30
let kitsPromise
const prayerSources = {
  'how-it-works': {
    title: 'Big Book', firstPage: 58,
    url: 'https://www.aa.org/sites/default/files/2021-11/en_bigbook_chapt5.pdf',
  },
  'into-action': {
    title: 'Big Book', firstPage: 72,
    url: 'https://www.aa.org/sites/default/files/2021-11/en_bigbook_chapt6.pdf',
  },
  'a-vision-for-you': {
    title: 'Big Book', firstPage: 151,
    url: 'https://www.aa.org/sites/default/files/2021-11/en_bigbook_chapt11.pdf',
  },
  'twelve-and-twelve': {
    title: 'Twelve Steps and Twelve Traditions', firstPage: 96,
    url: 'https://www.aa.org/sites/default/files/2022-01/en_step11.pdf',
  },
}

function loadKits() {
  kitsPromise ??= fetch('./assets/step-kits.json').then(response => {
    if (!response.ok) throw new Error('Step Kits are temporarily unavailable.')
    return response.json()
  }).catch(error => {
    kitsPromise = undefined
    throw error
  })
  return kitsPromise
}

function heading(title, description, actions = '', kicker = '') {
  return `<div class="page-heading"><div>${kicker ? `<p class="kicker">${kicker}</p>` : ''}
    <h1 tabindex="-1">${title}</h1>${description ? `<p class="lede">${description}</p>` : ''}</div>${actions}</div>`
}

const route = (path, label, style = 'button secondary') => `<a href="#/${path}" class="${style}">${label}</a>`
const personPath = person => `sponsees/${person.id}`
const edit = person => route(`${personPath(person)}/edit`, 'Edit profile')
const log = person => route(`${personPath(person)}/log`, 'Log conversation', 'button')
const add = () => route('sponsees/new', '<span aria-hidden="true">+</span> Add sponsee', 'button')
const empty = message => `<p class="empty">${message}</p>`
const formatNotes = text => `<p class="preserve">${html(text)}</p>`
const orderPeople = (left, right) => left.displayName.localeCompare(right.displayName)
const dot = ' <span aria-hidden="true">·</span> '
const deleteButton = label => `<button type="button" class="button danger" data-delete>${label}</button>`

function daysBetween(from, to) {
  return Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000)
}

function relativeDay(value) {
  const days = daysBetween(value, today())
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days > 1 && days < 60) return `${days} days ago`
  return `on ${dateLabel(value)}`
}

function lastConversation(notes, person) {
  return notes.reduce((latest, note) =>
    note.sponseeId === person.id && note.date <= today() && note.date > latest ? note.date : latest, '')
}

function lastTalked(notes, person) {
  const date = lastConversation(notes, person)
  return date ? `Last conversation ${relativeDay(date)}` : 'No conversations logged yet'
}

function checkInLabel(date) {
  const current = today()
  if (date < current) return `<span class="past-due">Overdue · ${dateLabel(date)}</span>`
  if (date === current) return `<span class="due-today">Today · ${dateLabel(date)}</span>`
  return `<span>${dateLabel(date)}</span>`
}

function followUpList(people, none, notes) {
  if (!people.length) return empty(none)
  return `<ul class="record-list">${people.map(person => `<li class="follow-up">
      <div><a class="person-link" href="#/${personPath(person)}">${html(person.displayName)}</a>
      <p class="meta">Step ${person.currentStep}${person.nextCheckIn ? `${dot}${checkInLabel(person.nextCheckIn)}` : ''}</p>
      <p class="preserve">${html(person.nextAction || 'No next action set')}</p>
      <p class="meta subtle">${lastTalked(notes, person)}</p></div>
      ${log(person)}
    </li>`).join('')}</ul>`
}

function backupReminder(count) {
  if (!count) return ''
  const last = lastBackup()
  const age = last ? daysBetween(last.slice(0, 10), today()) : Infinity
  if (age < backupInterval) return ''
  return `<section class="panel reminder"><div><h2>Back up your sponsor records</h2>
    <p>${last ? `Your last sponsor backup from this browser was ${relativeDay(last.slice(0, 10))}.` : 'You haven’t made a sponsor backup from this browser yet.'}
    Stepwise keeps records only on this device, so a backup file is the only way to recover them if browser data is cleared.</p></div>
    ${route('backups', 'Back up now')}</section>`
}

function welcome() {
  return `<section class="panel welcome"><h2>Welcome to Stepwise</h2>
    <ul class="bullets">
      <li>Add each person you sponsor, then log conversations and set the next check-in. Today keeps your follow-ups in one place.</li>
      <li>Each profile shows the step they’re on, with discussion prompts, readings, prayers, and suggested assignments from the Step Kits.</li>
      <li>Everything stays in this browser. There are no accounts and nothing is sent anywhere. Use <strong>Sponsor backups</strong> regularly to keep a copy.</li>
      <li>On a phone, add Stepwise to your Home Screen so it opens like an app and works offline.</li>
    </ul></section>`
}

function todayPage({ sponsees, notes }) {
  const active = sponsees.filter(person => person.status === 'Active')
  const dated = active.filter(person => person.nextCheckIn)
    .sort((left, right) => left.nextCheckIn.localeCompare(right.nextCheckIn) || orderPeople(left, right))
  const undated = active.filter(person => !person.nextCheckIn && person.nextAction.trim()).sort(orderPeople)
  const unplanned = active.filter(person => !person.nextCheckIn && !person.nextAction.trim()).sort(orderPeople)
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  if (!sponsees.length) return `${heading('Today', date, add(), 'Sponsor workspace')}${welcome()}`
  return `${heading('Today', date, add(), 'Sponsor workspace')}
    <section class="panel schedule"><h2>Upcoming check-ins</h2>
      ${followUpList(dated, 'No check-ins scheduled. Set a date on a sponsee’s profile.', notes)}</section>
    <section class="panel schedule"><h2>Next actions without a date</h2>
      ${followUpList(undated, 'No undated next actions.', notes)}</section>
    ${unplanned.length ? `<section class="panel schedule"><h2>No follow-up planned</h2>
      <p class="help">These active sponsees have no next action or check-in date.</p>
      ${followUpList(unplanned, '', notes)}</section>` : ''}
    ${backupReminder(sponsees.length)}`
}

function peopleList(people, notes) {
  return `<ul class="record-list">${people.sort(orderPeople).map(person =>
    `<li><a class="list-link" href="#/${personPath(person)}"><div><strong>${html(person.displayName)}</strong>
    <p class="meta">Step ${person.currentStep}${dot}${person.status}${person.nextCheckIn ? `${dot}${dateLabel(person.nextCheckIn)}` : ''}</p>
    <p class="meta subtle">${lastTalked(notes, person)}</p></div><span aria-hidden="true">→</span></a></li>`).join('')}</ul>`
}

function directory({ sponsees, notes }) {
  const active = sponsees.filter(person => person.status === 'Active')
  const others = sponsees.filter(person => person.status !== 'Active')
  return `${heading('Sponsees', 'Keep track of conversations, steps, and follow-ups.', add(), 'Sponsor workspace')}
    <section class="panel"><h2>Active sponsees</h2>${active.length ? peopleList(active, notes) : empty('No active sponsees yet.')}</section>
    ${others.length ? `<details class="panel"><summary>Paused and archived</summary>${peopleList(others, notes)}</details>` : ''}`
}

function notesSection(person, notes) {
  if (!notes.length) return empty('No conversations logged yet.')
  return `<ul class="record-list">${[...notes].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).map(note => `<li class="note">
    <div class="row"><p class="meta">${dateLabel(note.date)}${note.stepNumber ? `${dot}Step ${note.stepNumber}` : ''}</p>
      ${route(`${personPath(person)}/note/${note.id}`, `Edit<span class="visually-hidden"> conversation from ${dateLabel(note.date)}</span>`, 'quiet')}</div>
    ${formatNotes(note.summary)}
    ${note.remember ? `<p class="meta">Remember</p>${formatNotes(note.remember)}` : ''}
    ${note.nextAction ? `<p class="meta">Agreed next action</p>${formatNotes(note.nextAction)}` : ''}
    ${note.followUpDate ? `<p class="meta">Agreed check-in · ${dateLabel(note.followUpDate)}</p>` : ''}
    </li>`).join('')}</ul>`
}

function assignmentSection(person, items) {
  return `<div class="actions below-summary">${route(`${personPath(person)}/assignment/new`, 'Add assignment')}</div>
    ${items.length ? `<ul class="record-list">${[...items].sort((a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999')).map(item =>
      `<li class="note"><div class="row"><h3>${html(item.title)}</h3>${route(`${personPath(person)}/assignment/${item.id}`, 'Edit assignment', 'quiet')}</div>
      <p class="meta">Step ${item.stepNumber}${dot}${item.status}${item.targetDate ? `${dot}Target ${dateLabel(item.targetDate)}` : ''}</p>
      ${item.instructions ? formatNotes(item.instructions) : ''}
      ${item.resourceIds.includes(workbookId) ? workbookLink() : ''}</li>`).join('')}</ul>` : empty('No assignments yet.')}`
}

function stepTrack(person, records) {
  const status = new Map(records.map(row => [row.stepNumber, row.status]))
  return `<ol class="step-track" aria-label="Progress through the Twelve Steps">${steps.map(number => {
    const state = status.get(number) ?? 'Not Started'
    const classes = [`is-${state.toLowerCase().replace(' ', '-')}`, number === person.currentStep ? 'is-current' : '']
    return `<li class="${classes.join(' ')}"><span aria-hidden="true">${number}</span>
      <span class="visually-hidden">Step ${number}, ${state}${number === person.currentStep ? ', current step' : ''}</span></li>`
  }).join('')}</ol>`
}

function kitPanel(person, kit) {
  if (!kit) return ''
  const next = person.currentStep + 1
  const template = kit.assignmentTemplates[0]
  return `<section class="panel kit-panel" aria-labelledby="kit-heading">
    <p class="kicker">Step ${kit.stepNumber} kit</p>
    <h2 id="kit-heading">${html(kit.title)}</h2>
    <p class="help">${html(kit.overview)}</p>
    <h3>Ask in your next conversation</h3>
    <ul class="bullets">${kit.discussion.map(item => `<li>${html(item)}</li>`).join('')}</ul>
    ${template ? `<div class="suggestion"><p class="meta">Suggested assignment</p><p>${html(template.instructions)}</p></div>` : ''}
    <div class="actions">
      ${template ? route(`${personPath(person)}/assignment/new/${template.id}`, 'Assign this') : ''}
      ${route(`resources/${kit.stepNumber}`, `Readings, prayers, and tips <span aria-hidden="true">→</span>`, 'quiet')}
    </div>
    ${next <= 12 ? `<form method="post" class="advance" data-advance>
      <button type="submit" class="button secondary">Mark Step ${person.currentStep} complete and move to Step ${next}</button>
      ${errorLine}</form>` : ''}
  </section>`
}

function profilePage(data, person, kit) {
  const related = name => data[name].filter(row => row.sponseeId === person.id)
  const stepRecords = related('sponseeSteps').sort((a, b) => a.stepNumber - b.stepNumber)
  const last = lastConversation(data.notes, person)
  return `${route('sponsees', '← All sponsees', 'quiet back')}
    ${heading(html(person.displayName), `Step ${person.currentStep}${dot}${person.status}`, `<div class="actions">${log(person)}${edit(person)}</div>`)}
    ${stepTrack(person, stepRecords)}
    <section class="panel next-panel"><h2>Next check-in</h2>
      <div class="next-grid"><div><p class="meta">Date</p><strong>${person.nextCheckIn ? checkInLabel(person.nextCheckIn) : dateLabel()}</strong>
        <p class="meta subtle">${last ? `Last talked ${relativeDay(last)}` : 'No conversations yet'}</p></div>
      <div><p class="meta">Next action</p>${formatNotes(person.nextAction || 'No next action set')}</div></div></section>
    ${kitPanel(person, kit)}
    <section class="panel"><div class="row"><h2>Conversations</h2></div>${notesSection(person, related('notes'))}</section>
    <details class="panel"><summary>Step history and status</summary>
      <form method="post" class="step-form" data-progress>
        ${stepRecords.map(row => select(`Step ${row.stepNumber}${row.stepNumber === person.currentStep ? ' (current)' : ''}`, row.id, progress, row.status)).join('')}
        <button class="button" type="submit">Save step statuses</button>
        ${errorLine}<p data-progress-saved role="status"></p>
      </form>
    </details>
    <details class="panel"><summary>Assignments</summary>${assignmentSection(person, related('assignments'))}</details>
    ${person.startDate || person.generalNotes ? `<details class="panel"><summary>Profile details</summary>
      ${person.startDate ? `<p>Started ${dateLabel(person.startDate)}</p>` : ''}
      ${person.generalNotes ? formatNotes(person.generalNotes) : ''}</details>` : ''}`
}

function bindDelete(main, message, work) {
  const button = main.querySelector('[data-delete]')
  if (!button) return
  button.addEventListener('click', async () => {
    if (!window.confirm(message)) return
    const error = main.querySelector('[data-error]')
    button.disabled = true
    error.textContent = ''
    try {
      await work()
    } catch (failure) {
      error.textContent = failure.message || 'This record could not be deleted.'
      button.disabled = false
    }
  })
}

function editProfile(main, person, data) {
  main.innerHTML = `${route(person ? personPath(person) : 'sponsees', '← Back', 'quiet back')}
    ${heading(person ? 'Edit profile' : 'Add sponsee', '')}
    <form method="post" class="panel form-panel">
      ${field('Display name', 'displayName', person?.displayName, { required: true, max: 100 })}
      <p class="help">A first name or initial is enough. Stepwise never needs a full name or contact details.</p>
      <div class="form-grid">${select('Current step', 'currentStep', steps, person?.currentStep ?? 1)}
      ${select('Profile status', 'status', profiles, person?.status ?? 'Active')}</div>
      ${field('Next action', 'nextAction', person?.nextAction, { type: 'textarea', max: 1000 })}
      <div class="form-grid">${field('Next check-in', 'nextCheckIn', person?.nextCheckIn, { type: 'date' })}
      ${field('Start date', 'startDate', person?.startDate, { type: 'date' })}</div>
      ${field('General notes', 'generalNotes', person?.generalNotes, { type: 'textarea' })}
      <div class="actions"><button type="submit" class="button">${person ? 'Save profile' : 'Add sponsee'}</button>
      ${person ? deleteButton('Delete sponsee') : ''}</div>${errorLine}
    </form>`
  onSubmit(main.querySelector('form'), async values => {
    values.displayName = values.displayName.trim()
    if (!values.displayName) throw new Error('Enter a display name.')
    const row = {
      ...(person ?? stamps()), displayName: values.displayName, status: values.status,
      currentStep: Number(values.currentStep), nextAction: values.nextAction,
      nextCheckIn: values.nextCheckIn || undefined, startDate: values.startDate || undefined,
      generalNotes: values.generalNotes || undefined, updatedAt: new Date().toISOString(),
    }
    const changes = { sponsees: [row] }
    if (!person) changes.sponseeSteps = steps.map(stepNumber => ({
      ...stamps(), sponseeId: row.id, stepNumber, status: stepNumber === row.currentStep ? 'In Progress'
        : stepNumber < row.currentStep ? 'Completed' : 'Not Started',
    }))
    await writeSponsor(changes, person ? { sponsees: [person] } : undefined)
    location.hash = `#/${personPath(row)}`
  })
  if (person) bindDelete(main, `Delete ${person.displayName} and all of their conversations, step records, and assignments from this device? This cannot be undone. To keep the history, set the status to Archived instead.`, async () => {
    const owned = name => data[name].filter(row => row.sponseeId === person.id)
    await deleteSponsor({
      sponsees: [person], sponseeSteps: owned('sponseeSteps'), notes: owned('notes'), assignments: owned('assignments'),
    })
    location.hash = '#/sponsees'
  })
}

function logConversation(main, person, note) {
  main.innerHTML = `${route(personPath(person), '← Back to profile', 'quiet back')}
    ${heading(note ? 'Edit conversation' : 'Log conversation', html(person.displayName))}
    <form method="post" class="panel form-panel">
      <div class="form-grid">${field('Conversation date', 'date', note?.date ?? today(), { type: 'date', required: true })}
      ${select('Step discussed', 'stepNumber', ['No step selected', ...steps], note ? note.stepNumber ?? 'No step selected' : person.currentStep)}</div>
      ${field('Summary', 'summary', note?.summary, { type: 'textarea', required: true })}
      ${field('What to remember', 'remember', note?.remember, { type: 'textarea' })}
      ${field('Agreed next action', 'nextAction', note ? note.nextAction : person.nextAction, { type: 'textarea', max: 1000 })}
      ${field('Next check-in', 'followUpDate', note ? note.followUpDate : person.nextCheckIn, { type: 'date' })}
      ${note ? '' : '<label class="check"><input type="checkbox" name="updateProfile" checked><span>Update the profile’s next action and check-in with these values.</span></label>'}
      <div class="actions"><button type="submit" class="button">Save conversation</button>
      ${note ? deleteButton('Delete conversation') : ''}</div>${errorLine}
    </form>`
  onSubmit(main.querySelector('form'), async values => {
    const summary = values.summary.trim()
    if (!summary) throw new Error('Enter a short conversation summary.')
    if (!values.date) throw new Error('Enter the conversation date.')
    const now = new Date().toISOString()
    const row = {
      ...(note ?? stamps()), sponseeId: person.id, date: values.date, summary, stepNumber: Number(values.stepNumber) || undefined,
      remember: values.remember || undefined, nextAction: values.nextAction || undefined,
      followUpDate: values.followUpDate || undefined, updatedAt: now,
    }
    const changes = { notes: [row] }
    if (values.updateProfile) changes.sponsees = [{
      ...person, nextAction: values.nextAction, nextCheckIn: row.followUpDate, updatedAt: now,
    }]
    await writeSponsor(changes, note ? { sponsees: [person], notes: [note] } : { sponsees: [person] })
    location.hash = `#/${personPath(person)}`
  })
  if (note) bindDelete(main, 'Delete this conversation from this device? This cannot be undone.', async () => {
    await deleteSponsor({ notes: [note] })
    location.hash = `#/${personPath(person)}`
  })
}

function editAssignment(main, person, assignment, template) {
  const draft = assignment ?? (template ? {
    title: template.title, instructions: template.instructions, stepNumber: template.stepNumber, resourceIds: template.resourceIds,
  } : undefined)
  main.innerHTML = `${route(personPath(person), '← Back to profile', 'quiet back')}
    ${heading(assignment ? 'Edit assignment' : 'Add assignment', html(person.displayName))}
    <form method="post" class="panel form-panel">
      ${template && !assignment ? '<p class="help">Started from the Step Kit suggestion. Adjust the wording to fit this person before saving.</p>' : ''}
      ${field('Title', 'title', draft?.title, { required: true, max: 200 })}
      ${field('Instructions', 'instructions', draft?.instructions, { type: 'textarea' })}
      <div class="form-grid">${select('Step', 'stepNumber', steps, draft?.stepNumber ?? person.currentStep)}
      ${select('Assignment status', 'status', assignments, assignment?.status ?? 'Not Started')}</div>
      ${field('Target date', 'targetDate', assignment?.targetDate, { type: 'date' })}
      <label class="check"><input type="checkbox" name="workbook"${draft?.resourceIds.includes(workbookId) ? ' checked' : ''}><span>Attach the blank Step Four workbook.</span></label>
      <div class="actions"><button type="submit" class="button">Save assignment</button>
      ${assignment ? deleteButton('Delete assignment') : ''}</div>${errorLine}
    </form>`
  onSubmit(main.querySelector('form'), async values => {
    const title = values.title.trim()
    if (!title) throw new Error('Enter an assignment title.')
    const now = new Date().toISOString()
    await writeSponsor({ assignments: [{
      ...(assignment ?? stamps()), sponseeId: person.id, title, instructions: values.instructions,
      stepNumber: Number(values.stepNumber), status: values.status, targetDate: values.targetDate || undefined,
      resourceIds: values.workbook ? [workbookId] : [], updatedAt: now,
      discussedAt: values.status === 'Discussed' ? assignment?.discussedAt ?? now : undefined,
    }] }, assignment ? { assignments: [assignment] } : undefined)
    location.hash = `#/${personPath(person)}`
  })
  if (assignment) bindDelete(main, `Delete the assignment “${assignment.title}” from this device? This cannot be undone.`, async () => {
    await deleteSponsor({ assignments: [assignment] })
    location.hash = `#/${personPath(person)}`
  })
}

async function findTemplate(id) {
  const kits = await loadKits().catch(() => [])
  for (const kit of kits) {
    const template = kit.assignmentTemplates.find(item => item.id === id)
    if (template) return { ...template, stepNumber: kit.stepNumber }
  }
}

export async function showSponsor(main, path) {
  if (path[0] === 'resources') return showResources(main, path[1])
  const data = await readSponsor()
  if (path[0] === 'today') {
    main.innerHTML = todayPage(data)
    return
  }
  if (!path[1]) {
    main.innerHTML = directory(data)
    return
  }
  if (path[1] === 'new') return editProfile(main)
  const person = data.sponsees.find(row => row.id === path[1])
  if (!person) {
    main.innerHTML = heading('Sponsee unavailable', 'This profile is unavailable in this browser.', route('sponsees', 'All sponsees'))
    return
  }
  if (path[2] === 'assignment') {
    const assignment = data.assignments.find(row => row.id === path[3] && row.sponseeId === person.id)
    if (path[3] === 'new') return editAssignment(main, person, undefined, path[4] && await findTemplate(path[4]))
    if (assignment) return editAssignment(main, person, assignment)
  }
  if (path[2] === 'note') {
    const note = data.notes.find(row => row.id === path[3] && row.sponseeId === person.id)
    if (note) return logConversation(main, person, note)
  }
  if (path[2] === 'edit') return editProfile(main, person, data)
  if (path[2] === 'log') return logConversation(main, person)
  const kits = await loadKits().catch(() => [])
  main.innerHTML = profilePage(data, person, kits.find(kit => kit.stepNumber === person.currentStep))
  const rows = data.sponseeSteps.filter(row => row.sponseeId === person.id)
  const form = main.querySelector('[data-progress]')
  onSubmit(form, async values => {
    const updatedAt = new Date().toISOString()
    const changed = rows.filter(row => Object.hasOwn(values, row.id) && values[row.id] !== row.status)
      .map(row => ({ ...row, status: values[row.id], updatedAt }))
    if (changed.length) {
      await writeSponsor({ sponseeSteps: changed }, { sponseeSteps: rows })
      for (const row of rows) {
        const updated = changed.find(next => next.id === row.id)
        if (updated) Object.assign(row, updated)
      }
    }
    form.querySelector('[data-progress-saved]').textContent = 'Step statuses saved.'
  })
  const advance = main.querySelector('[data-advance]')
  if (advance) onSubmit(advance, async () => {
    const updatedAt = new Date().toISOString()
    const next = person.currentStep + 1
    const target = { [person.currentStep]: 'Completed', [next]: 'In Progress' }
    const changed = rows.filter(row => target[row.stepNumber] && (row.stepNumber === person.currentStep || row.status === 'Not Started'))
      .map(row => ({ ...row, status: target[row.stepNumber], updatedAt }))
    await writeSponsor({ sponsees: [{ ...person, currentStep: next, updatedAt }], sponseeSteps: changed },
      { sponsees: [person], sponseeSteps: rows })
    await showSponsor(main, path)
    main.querySelector('h1')?.focus()
  })
}

function prayerSection(prayers) {
  if (!prayers?.length) return ''
  return `<section class="panel prayer-panel" aria-labelledby="step-prayers">
    <h2 id="step-prayers">Prayers and actions</h2>
    <p class="help">Prayers marked “Big Book wording” are quoted as written. The others are plain-language prayers based on the Big Book’s directions. Use them or your own words. Each prayer has a suggested action and an A.A. reading reference.</p>
    <ul class="record-list">
      ${prayers.map(prayer => {
        const source = prayerSources[prayer.source]
        const page = prayer.page - source.firstPage + 1
        const reference = prayer.endPage ? `pp. ${prayer.page}–${prayer.endPage}` : `p. ${prayer.page}`
        const sourceLabel = prayer.sourceLabel
          ? `${prayer.sourceLabel}, ${reference}` : `${source.title}, ${reference}`
        return `<li class="prayer">
          <h3>${html(prayer.title)}</h3>
          ${prayer.words ? `<p class="meta">${prayer.wording === 'original' ? 'Big Book wording' : 'Plain-language prayer'}</p>
            <p class="prayer-words">${html(prayer.words)}</p>` : ''}
          <p><strong>Suggested action</strong> ${html(prayer.action)}</p>
          <a href="${source.url}#page=${page}" target="_blank" rel="noopener noreferrer">${html(sourceLabel)} <span aria-hidden="true">↗</span></a>
        </li>`
      }).join('')}
    </ul>
  </section>`
}

function readingList(readings) {
  if (!readings.length) return ''
  return `<section class="panel"><h2>Readings</h2>
    <ul class="bullets readings">${readings.map(item => typeof item === 'string' ? `<li>${html(item)}</li>`
      : `<li><a href="${html(item.url)}" target="_blank" rel="noopener noreferrer">${html(item.title)} <span aria-hidden="true">↗</span></a>
        ${item.detail ? `<span class="meta">${html(item.detail)}</span>` : ''}</li>`).join('')}</ul>
    <p class="help">Links open the free reading on aa.org. Page numbers follow the Big Book, 4th edition.</p></section>`
}

function assignForm(template, people) {
  if (!people.length) return ''
  return `<form class="assign-form" data-assign="${template.id}">
    <div class="field"><label for="assign-${template.id}">Assign to</label>
      <select id="assign-${template.id}" name="person">${people.map(person =>
        `<option value="${person.id}">${html(person.displayName)}</option>`).join('')}</select></div>
    <button type="submit" class="button secondary">Start assignment</button></form>`
}

async function showResources(main, step) {
  const kits = await loadKits()
  const kit = kits.find(item => String(item.stepNumber) === step)
  if (kit) {
    const people = (await readSponsor().catch(() => ({ sponsees: [] }))).sponsees
      .filter(person => person.status === 'Active').sort(orderPeople)
    const list = (label, items) => items.length ? `<section class="panel"><h2>${label}</h2>
      <ul class="bullets">${items.map(item => `<li>${html(item)}</li>`).join('')}</ul></section>` : ''
    main.innerHTML = `${route('resources', '← All resources', 'quiet back')}
      ${heading(html(kit.title), html(kit.overview), '', `Step ${kit.stepNumber}`)}
      ${kit.resourceIds.includes(workbookId) ? `<div class="actions">${workbookLink()}</div>` : ''}
      ${prayerSection(kit.prayers)}
      ${readingList(kit.readings)}${list('Discussion prompts', kit.discussion)}
      ${list('Exercises', kit.exercises)}${list('Sponsor tips', kit.sponsorTips)}
      ${kit.assignmentTemplates.length ? `<section class="panel"><h2>Assignment ideas</h2>
        ${kit.assignmentTemplates.map(item => `<div class="note"><h3>${html(item.title)}</h3>${formatNotes(item.instructions)}
          ${item.resourceIds.includes(workbookId) ? workbookLink() : ''}${assignForm(item, people)}</div>`).join('')}</section>` : ''}
      <nav class="actions pagination" aria-label="Other steps">
        ${kit.stepNumber > 1 ? route(`resources/${kit.stepNumber - 1}`, `← Step ${kit.stepNumber - 1}`, 'quiet') : ''}
        ${kit.stepNumber < 12 ? route(`resources/${kit.stepNumber + 1}`, `Step ${kit.stepNumber + 1} →`, 'quiet') : ''}
      </nav>`
    for (const form of main.querySelectorAll('[data-assign]')) {
      form.addEventListener('submit', event => {
        event.preventDefault()
        location.hash = `#/sponsees/${form.elements.person.value}/assignment/new/${form.dataset.assign}`
      })
    }
  } else {
    main.innerHTML = `${heading('Resources', 'Step Kits, prayers and actions, and the printable Step Four workbook.', '', 'Sponsor workspace')}
      <section class="panel next-panel workbook-card"><div><p class="meta">Step Four · PDF · 12 pages</p><h2>Personal Inventory Workbook</h2>
        <p>Blank worksheets for inventory, reflection, and Step Five preparation.</p></div>${workbookLink()}</section>
      <section class="panel"><h2>Step Kits</h2><ul class="kit-grid">${kits.map(item =>
        `<li><a href="#/resources/${item.stepNumber}"><span class="kit-number" aria-hidden="true">${String(item.stepNumber).padStart(2, '0')}</span>
          <span><span class="meta">Step ${item.stepNumber}</span><strong>${html(item.title)}</strong></span><span aria-hidden="true">→</span></a></li>`).join('')}</ul></section>`
  }
}
