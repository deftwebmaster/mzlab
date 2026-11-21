export const workbook = './assets/stepwise-step4-inventory-workbook.pdf'
export const workbookLink = (label = 'Open printable workbook') =>
  `<a class="button secondary" href="${workbook}" target="_blank" rel="noopener noreferrer">${label} <span aria-hidden="true">↗</span></a>`

export function html(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}

export function field(label, name, value = '', { type = 'text', required = false, max = 10000 } = {}) {
  const attrs = `id="field-${name}" name="${name}" maxlength="${max}"${required ? ' required' : ''}`
  const control = type === 'textarea'
    ? `<textarea ${attrs} rows="4">\n${html(value)}</textarea>`
    : `<input ${attrs} type="${type}" value="${html(value)}">`
  return `<div class="field"><label for="field-${name}">${label}</label>${control}</div>`
}

export function select(label, name, options, value) {
  return `<div class="field"><label for="select-${name}">${label}</label><select id="select-${name}" name="${name}">${options.map(option =>
    `<option${String(option) === String(value) ? ' selected' : ''}>${html(option)}</option>`).join('')}</select></div>`
}

export const errorLine = '<p class="error" role="alert" data-error></p>'
export const formData = form => Object.fromEntries(new FormData(form))
export const today = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function dateLabel(value) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  }) : 'No date set'
}

// Remembers when this browser last produced a sponsor backup, for the Today reminder.
const backupKey = 'stepwise:last-sponsor-backup'
export function lastBackup() {
  try {
    return localStorage.getItem(backupKey) || undefined
  } catch {
    return undefined
  }
}
export function markBackup() {
  try {
    localStorage.setItem(backupKey, new Date().toISOString())
  } catch {}
}

export function download(container, file, name) {
  const link = document.createElement('a')
  const url = URL.createObjectURL(file)
  link.className = 'button'
  link.download = name
  link.href = url
  link.textContent = 'Download encrypted backup'
  container.replaceChildren(link)
  link.focus()
  // Leave the link usable long enough for browsers that rely on the share sheet.
  setTimeout(() => URL.revokeObjectURL(url), 600000)
}

export function onSubmit(form, handler) {
  form.addEventListener('submit', async event => {
    event.preventDefault()
    const button = form.querySelector('[type="submit"]')
    const error = form.querySelector('[data-error]')
    button.disabled = true
    error.textContent = ''
    try {
      await handler(formData(form))
    } catch (failure) {
      error.textContent = failure.message || 'This action could not be completed.'
    } finally {
      button.disabled = false
    }
  })
}
