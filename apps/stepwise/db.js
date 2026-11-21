const scope = new URL('./', import.meta.url).pathname
export const sponsorStores = ['sponsees', 'sponseeSteps', 'notes', 'assignments']
const vaultStore = 'sealed'

function openDatabase(name, upgrade) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => upgrade(request.result)
    request.onerror = () => reject(new Error('Browser storage could not be opened.'))
    request.onblocked = () => reject(new Error('Close other Stepwise tabs, then reload.'))
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
  })
}

let sponsorDatabase
let vaultDatabase
function sponsorDB() {
  return sponsorDatabase ??= openDatabase(`stepwise-vanilla-sponsor:${scope}`, database => {
    for (const name of sponsorStores) {
      const store = database.createObjectStore(name, { keyPath: 'id' })
      if (name === 'sponseeSteps') store.createIndex('personStep', ['sponseeId', 'stepNumber'], { unique: true })
    }
  })
}

function vaultDB() {
  return vaultDatabase ??= openDatabase(`stepwise-vanilla-inventory:${scope}`, database => {
    database.createObjectStore(vaultStore)
  })
}

// Ask once per visit for storage the browser will not evict under pressure. Safari and
// Chromium decide quietly; Firefox may ask the person. Saving still works if it is refused.
let persisting
function persist() {
  persisting ??= navigator.storage?.persist?.().catch(() => false)
}

function transact(database, names, mode, work) {
  if (mode === 'readwrite') persist()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(names, mode)
    const stores = Object.fromEntries(names.map(name => [name, tx.objectStore(name)]))
    let reason
    const abort = message => {
      reason = new Error(message)
      tx.abort()
    }
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(reason ?? new Error('Browser storage could not save this change.'))
    try {
      work(stores, abort)
    } catch {
      abort('Browser storage could not complete this action.')
    }
  })
}

export async function readSponsor() {
  const database = await sponsorDB()
  const data = {}
  await transact(database, sponsorStores, 'readonly', stores => {
    for (const name of sponsorStores) {
      const request = stores[name].getAll()
      request.onsuccess = () => { data[name] = request.result }
    }
  })
  return data
}

export async function writeSponsor(changes, previous = {}) {
  const database = await sponsorDB()
  await transact(database, sponsorStores, 'readwrite', (stores, abort) => {
    for (const [name, rows] of Object.entries(changes)) {
      const expected = new Map((previous[name] ?? []).map(row => [row.id, row]))
      for (const row of rows) {
        const store = stores[name]
        if (!expected.has(row.id)) {
          store.add(row)
          continue
        }
        const request = store.get(row.id)
        request.onsuccess = () => {
          if (!request.result || !equivalent(request.result, expected.get(row.id))) {
            abort('These sponsor records changed in another tab. Reopen this screen before retrying.')
            return
          }
          store.put(row)
        }
      }
    }
  })
}

export async function deleteSponsor(removals) {
  const database = await sponsorDB()
  await transact(database, sponsorStores, 'readwrite', (stores, abort) => {
    for (const [name, rows] of Object.entries(removals)) {
      for (const row of rows) {
        const store = stores[name]
        const request = store.get(row.id)
        request.onsuccess = () => {
          if (request.result && !equivalent(request.result, row)) {
            abort('These sponsor records changed in another tab. Reopen this screen before retrying.')
            return
          }
          store.delete(row.id)
        }
      }
    }
  })
}

export async function mergeSponsor(changes) {
  const database = await sponsorDB()
  await transact(database, sponsorStores, 'readwrite', (stores, abort) => {
    const existing = {}
    for (const name of sponsorStores) {
      const request = stores[name].getAll()
      request.onsuccess = () => {
        existing[name] = request.result
        if (Object.keys(existing).length !== sponsorStores.length) return
        const { additions, conflicts } = compareSponsor(changes, existing)
        if (conflicts) {
          abort('Existing sponsor records conflict with this file. No records were imported.')
          return
        }
        for (const [store, rows] of Object.entries(additions)) {
          for (const row of rows) stores[store].add(row)
        }
      }
    }
  })
}

export function compareSponsor(incoming, existing) {
  let duplicates = 0
  let conflicts = 0
  const occupiedSteps = new Set(existing.sponseeSteps.map(row => `${row.sponseeId}:${row.stepNumber}`))
  const additions = Object.fromEntries(sponsorStores.map(name => {
    const current = new Map(existing[name].map(row => [row.id, row]))
    return [name, incoming[name].filter(row => {
      const match = current.get(row.id)
      if (match && equivalent(row, match)) duplicates++
      else if (match || (name === 'sponseeSteps' && occupiedSteps.has(`${row.sponseeId}:${row.stepNumber}`))) conflicts++
      else return true
      return false
    })]
  }))
  return { additions, duplicates, conflicts }
}

function equivalent(left, right) {
  const normalize = row => JSON.stringify(Object.entries(row)
    .filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)))
  return normalize(left) === normalize(right)
}

export async function readVault() {
  const database = await vaultDB()
  let record
  await transact(database, [vaultStore], 'readonly', stores => {
    const request = stores[vaultStore].get('inventory')
    request.onsuccess = () => { record = request.result }
  })
  return record
}

export async function writeVault(envelope, expectedRevision) {
  const database = await vaultDB()
  const revision = crypto.randomUUID()
  await transact(database, [vaultStore], 'readwrite', (stores, abort) => {
    const store = stores[vaultStore]
    const request = store.get('inventory')
    request.onsuccess = () => {
      if (request.result?.revision !== expectedRevision) {
        abort('This inventory changed in another tab. Your edits here could not be saved.')
        return
      }
      store.put({ revision, envelope }, 'inventory')
    }
  })
  return revision
}

export function stamps() {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now }
}
