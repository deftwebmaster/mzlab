import { showSponsor } from './sponsor.js'
import { showInventory, leaveInventory, hideInventory, hasPendingInventory } from './inventory.js'
import { showBackups } from './migration.js'

const shell = document.querySelector('#shell')
const main = document.querySelector('#main')
let currentPage
let acceptedHash
let routing = Promise.resolve()

function sponsorShell(page) {
  const nav = (id, label, short = label) => `<a href="#/${id}" aria-label="${label}"${page === id ? ' aria-current="page"' : ''}>
    <span aria-hidden="true" class="nav-icon icon-${id}"></span><span class="nav-full">${label}</span><span class="nav-short">${short}</span></a>`
  shell.innerHTML = `<div class="workspace-shell">
    <a class="brand" href="#/today"><span class="brand-mark" aria-hidden="true">S</span> Stepwise</a>
    <div class="rail-content"><nav class="workspace-nav" aria-label="Sponsor workspace">
      ${nav('today', 'Today')}${nav('sponsees', 'Sponsees')}${nav('resources', 'Resources')}
    </nav>
    <div class="rail-bottom">
      <a class="inventory-link" href="#/inventory" aria-label="Private inventory"><span aria-hidden="true" class="nav-icon icon-lock"></span><span class="nav-full">Private inventory</span><span class="nav-short">Inventory</span><span aria-hidden="true">↗</span></a>
      ${nav('backups', 'Sponsor backups', 'Backups')}
    </div></div>
  </div>`
}

async function route() {
  if (!location.hash || location.hash === '#/') history.replaceState(null, '', '#/today')
  const path = location.hash.slice(2).split('/')
  const page = ['today', 'sponsees', 'resources', 'inventory', 'backups'].includes(path[0]) ? path[0] : 'today'
  if (page === 'inventory' && location.hash !== '#/inventory') history.replaceState(null, '', '#/inventory')
  if (currentPage === 'inventory' && page !== 'inventory' && await leaveInventory() === false) {
    history.replaceState(null, '', acceptedHash)
    return
  }
  currentPage = page
  acceptedHash = location.hash
  document.body.classList.toggle('writing', page === 'inventory')
  main.replaceChildren()
  if (page === 'inventory') {
    await showInventory(main, shell)
  } else {
    sponsorShell(page)
    if (page === 'backups') await showBackups(main)
    else await showSponsor(main, path[0] === page ? path : ['today'])
  }
  main.querySelector('h1')?.focus({ preventScroll: true })
  window.scrollTo(0, 0)
}

function showRoute() {
  routing = routing.then(route).catch(() => {
    main.replaceChildren()
    const heading = document.createElement('h1')
    const description = document.createElement('p')
    heading.textContent = 'Stepwise could not open this page'
    description.textContent = 'Check that browser storage is available, then reload to try again.'
    main.append(heading, description)
    main.focus()
  })
}

document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault()
  main.focus()
})
window.addEventListener('hashchange', showRoute)
window.addEventListener('pagehide', hideInventory)
window.addEventListener('pageshow', event => { if (event.persisted) showRoute() })
window.addEventListener('beforeunload', event => {
  if (!hasPendingInventory()) return
  event.preventDefault()
  event.returnValue = true
})
showRoute()

function offerUpdate(worker) {
  if (!worker || !navigator.serviceWorker.controller || document.querySelector('.update-banner')) return
  const banner = document.createElement('div')
  const text = document.createElement('span')
  const reload = document.createElement('button')
  banner.className = 'update-banner'
  banner.setAttribute('role', 'status')
  text.textContent = 'A new version of Stepwise is ready.'
  reload.type = 'button'
  reload.className = 'button small'
  reload.textContent = 'Update now'
  reload.onclick = () => {
    reload.disabled = true
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
    worker.postMessage('skip-waiting')
  }
  banner.append(text, reload)
  document.body.append(banner)
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(registration => {
    offerUpdate(registration.waiting)
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') offerUpdate(worker)
      })
    })
  }).catch(() => {
    const message = document.createElement('p')
    message.className = 'offline-warning'
    message.setAttribute('role', 'status')
    message.textContent = 'Offline reopening is unavailable in this browser.'
    document.body.append(message)
  })
}
