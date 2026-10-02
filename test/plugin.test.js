/**
 * The plugin's contracts at the boundaries that actually fail: the Host's
 * observation of Agents and interactions, the wire protocol it speaks to the
 * native helper, the profile Config it exposes, and the browser bundle's
 * notification behaviour.
 *
 * The bundle tests drive the same client services the Harness renders from —
 * `uiSession.sessionStatus` and `sessions.list` — because the shipped bug lived
 * exactly there: a runner reading a service name that no longer existed stayed
 * silent for every approval, and no unit test of the pure decision could have
 * noticed.
 */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { PassThrough } from 'node:stream'
import { promisify } from 'node:util'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import {
  Config,
  ENTRY_ID,
  MenuBarIndicator,
  apply,
  launchMenuBarHelper,
  observePendingInteractions,
  observeRunningAgents,
  publishLiveConfig,
  webClientOrigin,
} from '../index.js'

const execFileAsync = promisify(execFile)

/** Every Config field, with the value a profile that sets nothing receives. */
const CONFIG_DEFAULTS = {
  enabled: true,
  questionMarkers: true,
  approvalMarkers: true,
  sweep: true,
  sound: true,
  flash: true,
  browserNotifications: true,
  notifyApproval: true,
  notifyQuestion: true,
  notifyPlanReview: false,
  notifyCompleted: true,
  notifyError: true,
  backgroundOnly: true,
  requireInteraction: false,
  keywords: '',
}

function fakeContext(agents) {
  const listeners = new Map()
  return {
    agents: { list: () => agents },
    on(name, listener) {
      listeners.set(name, listener)
      return () => listeners.delete(name)
    },
    emit(name, payload) {
      listeners.get(name)?.(payload)
    },
    listeners,
  }
}

/** Config references a test can re-point, mirroring volatile Cordis fields. */
function liveConfig(values = {}) {
  return Object.fromEntries(Object.keys(CONFIG_DEFAULTS).map(field => [
    field,
    { get: () => (field in values ? values[field] : CONFIG_DEFAULTS[field]) },
  ]))
}

/** A helper stand-in that records the exact wire calls the indicator makes. */
function recordingLaunch(events) {
  return (_logger, origin) => {
    events.push(['url', origin])
    return {
      setCount: count => events.push(['count', count]),
      setMarkers: markers => events.push(['markers', markers]),
      setSweepEnabled: enabled => events.push(['sweep', enabled]),
      alert: (kind, options) => events.push(['alert', kind, options]),
      setAttention: active => events.push(['attention', active]),
      close: async () => { events.push(['close']) },
    }
  }
}

/** Host context recording what `apply` registers, without launching a helper. */
function fakeHostContext(agents = []) {
  const listeners = new Map()
  const disposers = []
  const injections = []
  const policies = []
  const ctx = {
    agents: { list: () => agents },
    webServer: { port: 3080 },
    logger: { warn() {} },
    fiber: { name: 'dsh-notifications' },
    on(name, listener) {
      listeners.set(name, listener)
      return () => listeners.delete(name)
    },
    effect(setup) {
      disposers.push(setup())
      return () => {}
    },
    inject(dependencies, callback) {
      injections.push(dependencies)
      callback({
        effect(setup) {
          disposers.push(setup())
          return () => {}
        },
        settings: {
          configure(policy, owner) {
            policies.push([policy, owner])
            return () => {}
          },
        },
      })
    },
  }
  return { ctx, listeners, disposers, injections, policies }
}

test('tracks initial and live running-agent counts without duplicates', () => {
  const first = { status: 'running' }
  const second = { status: 'idle' }
  const ctx = fakeContext([first, second])
  const counts = []
  const dispose = observeRunningAgents(ctx, count => counts.push(count))

  ctx.emit('agent/status', { agent: second, status: 'running' })
  ctx.emit('agent/status', { agent: second, status: 'running' })
  ctx.emit('agent/status', { agent: first, status: 'idle' })
  ctx.emit('agent/disposed', { agent: second })

  assert.deepEqual(counts, [1, 2, 1, 0])
  dispose()
  assert.equal(ctx.listeners.size, 0)
})

test('the indicator closes and restores the helper around settings changes', async () => {
  const events = []
  const indicator = new MenuBarIndicator({ warn() {} }, true, 'http://127.0.0.1:3080', recordingLaunch(events))
  indicator.setCount(3)
  indicator.setMarkerCounts({ Q: 1, S: 0 })
  await indicator.setEnabled(false)
  indicator.setCount(4)
  indicator.setMarkerCounts({ Q: 2, S: 0 })
  await indicator.setEnabled(true)
  await indicator.dispose()

  assert.deepEqual(events, [
    ['url', 'http://127.0.0.1:3080'],
    ['count', 0], ['markers', ''], ['sweep', false], ['attention', false],
    ['count', 3], ['markers', ''], ['sweep', false], ['attention', false],
    ['count', 1], ['markers', 'Q'], ['sweep', true], ['attention', true],
    ['close'],
    ['url', 'http://127.0.0.1:3080'],
    ['count', 2], ['markers', 'QQ'], ['sweep', true], ['attention', true],
    ['close'],
  ])
})

test('filters subscribed markers while retaining the total for active types', () => {
  const events = []
  const indicator = new MenuBarIndicator({ warn() {} }, true, 'http://127.0.0.1:3080', recordingLaunch(events))

  indicator.setMarkerCounts({ Q: 2, S: 1 })
  indicator.setQuestionMarkers(false)
  indicator.setSweepEnabled(false)
  indicator.setQuestionMarkers(true)

  assert.deepEqual(events.map(([name, value]) => [name, value]).filter(([name]) => name !== 'attention'), [
    ['url', 'http://127.0.0.1:3080'], ['count', 0], ['markers', ''], ['sweep', false],
    ['count', 3], ['markers', 'QQS'], ['sweep', true],
    ['count', 1], ['markers', 'S'], ['sweep', true],
    ['count', 1], ['markers', 'S'], ['sweep', false],
    ['count', 3], ['markers', 'QQS'], ['sweep', false],
  ])
})

test('an approval or a question raises an alert, and attention clears with the last one', () => {
  const events = []
  const indicator = new MenuBarIndicator({ warn() {} }, true, 'http://127.0.0.1:3080', recordingLaunch(events))

  indicator.alert('approval')
  indicator.setMarkerCounts({ Q: 0, S: 1 })
  indicator.alert('question')
  indicator.setMarkerCounts({ Q: 1, S: 1 })
  indicator.setMarkerCounts({ Q: 0, S: 0 })

  const alerts = events.filter(([name]) => name === 'alert')
  // The cooldown keeps a burst of requests from becoming a siren, so exactly
  // one nudge gets through here; the count and marker frames are unaffected.
  assert.deepEqual(alerts, [['alert', 'approval', { sound: true, flash: true }]])
  assert.deepEqual(events.filter(([name]) => name === 'attention'), [
    ['attention', false],   // construction
    ['attention', true],    // held while the approval waits
    ['attention', true],    // and while the question waits too
    ['attention', false],   // released once nothing waits
  ])
})

test('the alert honours the sound and flash switches, and mutes itself when both are off', () => {
  const events = []
  const indicator = new MenuBarIndicator({ warn() {} }, true, 'http://127.0.0.1:3080', recordingLaunch(events), {
    sound: false, flash: true,
  })
  indicator.alert('approval')
  assert.deepEqual(events.filter(([name]) => name === 'alert'), [
    ['alert', 'approval', { sound: false, flash: true }],
  ])

  const silent = []
  const muted = new MenuBarIndicator({ warn() {} }, true, 'http://127.0.0.1:3080', recordingLaunch(silent), {
    sound: false, flash: false,
  })
  muted.alert('approval')
  assert.deepEqual(silent.filter(([name]) => name === 'alert'), [])
})

test('counts pending questions and approvals without taking over either answerer', async () => {
  const ctx = fakeContext([])
  const states = []
  const asked = []
  const stop = observePendingInteractions(ctx, active => states.push(active), kind => asked.push(kind))
  const question = Promise.withResolvers()
  const approval = Promise.withResolvers()
  const questionRequest = ctx.listeners.get('user-questions/request')(
    { questions: [{ id: 'mode', question: 'Choose a mode' }] },
    () => question.promise,
  )
  const approvalRequest = ctx.listeners.get('approval/request')(
    { toolName: 'dangerous_tool' },
    () => approval.promise,
  )

  assert.deepEqual(states, [{ Q: 1, S: 0 }, { Q: 1, S: 1 }])
  // The alert follows the request, in arrival order.
  assert.deepEqual(asked, ['question', 'approval'])
  question.resolve({ answers: [{ id: 'mode', selected: ['fast'] }] })
  await questionRequest
  assert.deepEqual(states, [{ Q: 1, S: 0 }, { Q: 1, S: 1 }, { Q: 0, S: 1 }])
  approval.resolve('allowed-once')
  await approvalRequest
  assert.deepEqual(states, [{ Q: 1, S: 0 }, { Q: 1, S: 1 }, { Q: 0, S: 1 }, { Q: 0, S: 0 }])
  stop()
})

test('the helper receives the active Harness Web origin before any other command', async () => {
  const child = new EventEmitter()
  child.stdin = new PassThrough()
  child.stderr = new PassThrough()
  child.exitCode = 0
  child.signalCode = null
  const messages = []
  child.stdin.setEncoding('utf8')
  child.stdin.on('data', chunk => {
    for (const line of chunk.split('\n')) if (line !== '') messages.push(JSON.parse(line))
  })

  const helper = launchMenuBarHelper({ warn() {} }, 'http://127.0.0.1:3080', () => child)
  helper.setCount(2)
  helper.setMarkers('QS')
  helper.setSweepEnabled(false)
  helper.alert('approval', { sound: true, flash: true })
  helper.setAttention(false)
  await helper.close()

  assert.deepEqual(messages, [
    { type: 'url', url: 'http://127.0.0.1:3080' },
    { type: 'count', count: 2 },
    { type: 'markers', markers: 'QS' },
    { type: 'sweep', sweep: false },
    { type: 'alert', kind: 'approval', sound: true, flash: true },
    { type: 'attention', active: false },
    { type: 'quit' },
  ])
})

test('builds the origin for the active loopback Web server', () => {
  assert.equal(webClientOrigin({ webServer: { port: 3080 } }), 'http://127.0.0.1:3080')
})

test('every Host Config field is a live reference carrying its documented default', () => {
  const parsed = Config({})
  assert.deepEqual(Object.keys(parsed).sort(), Object.keys(CONFIG_DEFAULTS).sort())
  for (const [field, reference] of Object.entries(parsed)) {
    assert.equal(typeof reference.get, 'function', `${field} is a volatile reference`)
    assert.equal(reference.get(), CONFIG_DEFAULTS[field], `${field} default`)
  }
})

test('the live Config references drive the running indicator without a remount', async () => {
  const events = []
  const values = { ...CONFIG_DEFAULTS }
  const config = liveConfig(values)
  const indicator = new MenuBarIndicator(
    { warn() {} },
    config.enabled.get(),
    'http://127.0.0.1:3080',
    recordingLaunch(events),
    {
      questionMarkers: config.questionMarkers.get(),
      approvalMarkers: config.approvalMarkers.get(),
      sweep: config.sweep.get(),
      sound: config.sound.get(),
      flash: config.flash.get(),
    },
  )

  indicator.setMarkerCounts({ Q: 2, S: 1 })
  values.questionMarkers = false
  values.sweep = false
  values.enabled = false
  publishLiveConfig(indicator, config)
  await indicator.tail

  // The contract is what reaches the helper, not how many redundant frames it
  // takes to get there: the switch changes land, nothing re-publishes the
  // dropped Q markers, and disabling closes the process.
  const wire = events.map(([name, value]) => [name, value]).filter(([name]) => name !== 'attention')
  assert.deepEqual(wire[0], ['url', 'http://127.0.0.1:3080'])
  assert.deepEqual(wire.at(-1), ['close', undefined])
  const afterDrop = wire.slice(wire.findIndex(([name, value]) => name === 'markers' && value === 'S'))
  assert.ok(afterDrop.length > 0, 'the Q markers were dropped from the item')
  assert.ok(
    afterDrop.every(([name, value]) => name !== 'markers' || value === 'S'),
    'only the approval letter is published once question markers are off',
  )
  assert.equal(
    afterDrop.filter(([name]) => name === 'sweep').at(-1)[1],
    false,
    'the sweep switch reaches the helper',
  )
  await indicator.dispose()
})

test('apply follows loader volatile updates and suppresses the generated settings page', async () => {
  const values = { ...CONFIG_DEFAULTS, enabled: false }
  const { ctx, listeners, disposers, injections, policies } = fakeHostContext()
  apply(ctx, liveConfig(values))

  assert.deepEqual(injections, [['settings']])
  assert.deepEqual(policies, [[{ auto: false }, ctx.fiber]])
  assert.equal(typeof listeners.get('loader/volatile-update'), 'function')
  assert.equal(typeof listeners.get('agent/status'), 'function')
  assert.equal(typeof listeners.get('user-questions/request'), 'function')
  assert.equal(typeof listeners.get('approval/request'), 'function')

  values.questionMarkers = false
  values.sweep = false
  listeners.get('loader/volatile-update')([['questionMarkers'], ['sweep']])

  await Promise.all(disposers.map(dispose => dispose()))
  assert.equal(listeners.size, 0)
})

/** Materialize the browser half's registered bundle with a minimal React shim. */
async function loadClientBundle(notificationApi) {
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  let bundle
  const context = vm.createContext({
    window: { __ModuleLoader__: { load: value => { bundle = value } }, focus() {} },
    Promise,
    Date,
    console,
    Notification: notificationApi,
  })
  vm.runInContext(source, context)
  const jsx = (type, props) => ({ type, props })
  const useState = initial => [typeof initial === 'function' ? initial() : initial, () => {}]
  const plugin = bundle.factory(specifier => {
    if (specifier === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (specifier === 'react') return { useState }
    throw new Error(`unexpected module request: ${specifier}`)
  })
  return { bundle, plugin, source }
}

/** A `Notification` stand-in that records what the page would have shown. */
function recordingNotificationApi(permission = 'granted') {
  const shown = []
  class FakeNotification {
    static permission = permission
    static requestPermission() { return Promise.resolve(permission) }
    constructor(title, options) {
      shown.push({ title, ...options })
    }
  }
  return { FakeNotification, shown }
}

/** A minimal snapshot store, matching the client store face the bundle reads. */
function createStore(initial) {
  let value = initial
  const listeners = new Set()
  return {
    getSnapshot: () => value,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(next) {
      value = next
      for (const listener of [...listeners]) listener()
    },
  }
}

/** Browser context wired to the client services the bundle observes. */
function fakeClientContext({ form, sessionStatus, sessions }) {
  const captured = { registration: undefined, entryId: undefined, localeRows: [] }
  const ctx = {
    locale: {
      bind: () => key => key,
      register: (namespace, dictionaries) => {
        captured.localeRows.push([namespace, dictionaries])
        return () => {}
      },
    },
    configForms: {
      get: entryId => {
        captured.entryId = entryId
        return form
      },
    },
    get: name => (name === 'uiSession' ? { sessionStatus } : { list: sessions }),
    on: () => () => {},
    effect: setup => setup(),
    slots: {
      inject: (_name, setup) => setup(),
      register: (options, component) => {
        captured.registration = { options, component }
        return () => {}
      },
    },
  }
  return { ctx, captured }
}

/** Settings form stand-in: a snapshot store plus the write path. */
function createForm(values, { status = 'ready', mode = 'host', writable = true } = {}) {
  let value = { ...values }
  const store = createStore(undefined)
  const writes = []
  return {
    writes,
    getSnapshot: () => ({
      status, value, writable, mode, base: values, user: undefined, revision: 0,
    }),
    subscribe: store.subscribe,
    set: async (field, next) => {
      writes.push([field, next])
      value = { ...value, [field]: next }
      store.set(value)
      return true
    },
  }
}

/** The session list face: ids, rows and the session in view. */
function createSessions(ids) {
  const rows = Object.fromEntries(ids.map(id => [id, { id, displayTitle: `session ${id}` }]))
  return createStore({ ids, byId: rows, current: ids[0] })
}

/** Drive one attention frame through the client services. */
function setStatus(sessionStatus, entries) {
  sessionStatus.set(new Map(Object.entries(entries)))
}

test('an approval waiting in a session raises exactly one system notification', async () => {
  const { FakeNotification, shown } = recordingNotificationApi('granted')
  const { bundle, plugin } = await loadClientBundle(FakeNotification)
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  // Harness keys the client module table by entry name, which is the package
  // name; a stale id here only surfaces in the browser, at boot time.
  assert.equal(bundle.id, manifest.name)

  const form = createForm({ ...CONFIG_DEFAULTS, backgroundOnly: false })
  // The wait exists before the page does: that is the seed case.
  const sessionStatus = createStore(new Map([['s1', { pendingInteraction: { kind: 'approval', toolName: 'bash' } }]]))
  const sessions = createSessions(['s1'])
  const { ctx, captured } = fakeClientContext({ form, sessionStatus, sessions })
  plugin.apply(ctx)
  assert.equal(captured.entryId, ENTRY_ID)
  assert.deepEqual(shown, [], 'a wait that already existed when the page loaded is history, not news')

  setStatus(sessionStatus, { s1: {} })
  setStatus(sessionStatus, { s1: { pendingInteraction: { kind: 'approval', toolName: 'bash', reason: 'sandbox escalation' } } })
  assert.equal(shown.length, 1)
  assert.equal(shown[0].title, 'titleApproval')
  assert.match(shown[0].body, /bash/)
  assert.match(shown[0].body, /sandbox escalation/)
  assert.match(shown[0].tag, /^dsh-notifications-approval-s1-1$/)

  // The same wait observed again is not a new wait.
  setStatus(sessionStatus, { s1: { pendingInteraction: { kind: 'approval', toolName: 'bash' } } })
  assert.equal(shown.length, 1)

  // A question after the approval is its own interruption.
  setStatus(sessionStatus, { s1: { pendingInteraction: { kind: 'question' } } })
  assert.equal(shown.length, 2)
  assert.equal(shown[1].title, 'titleQuestion')
})

test('notifications honour permission, the category switches, keywords and the background gate', async () => {
  const denied = recordingNotificationApi('denied')
  const deniedBundle = await loadClientBundle(denied.FakeNotification)
  const deniedForm = createForm({ ...CONFIG_DEFAULTS, backgroundOnly: false })
  const deniedStatus = createStore(new Map())
  const deniedCtx = fakeClientContext({
    form: deniedForm, sessionStatus: deniedStatus, sessions: createSessions(['s1']),
  })
  deniedBundle.plugin.apply(deniedCtx.ctx)
  setStatus(deniedStatus, { s1: { pendingInteraction: { kind: 'approval' } } })
  assert.deepEqual(denied.shown, [], 'a denied permission shows nothing')

  const { FakeNotification, shown } = recordingNotificationApi('granted')
  const { plugin } = await loadClientBundle(FakeNotification)
  const form = createForm({ ...CONFIG_DEFAULTS, backgroundOnly: false, notifyApproval: false })
  const sessionStatus = createStore(new Map())
  const sessions = createSessions(['s1'])
  plugin.apply(fakeClientContext({ form, sessionStatus, sessions }).ctx)

  setStatus(sessionStatus, { s1: { pendingInteraction: { kind: 'approval', toolName: 'bash' } } })
  assert.deepEqual(shown, [], 'the approval switch is off')

  await form.set('notifyApproval', true)
  await form.set('keywords', '-sandbox')
  setStatus(sessionStatus, { s1: {} })
  setStatus(sessionStatus, { s1: { pendingInteraction: { kind: 'approval', toolName: 'bash (sandbox)' } } })
  assert.deepEqual(shown, [], 'an excluded keyword suppresses the banner')

  await form.set('keywords', '')
  await form.set('backgroundOnly', true)
  setStatus(sessionStatus, { s1: {} })
  setStatus(sessionStatus, { s1: { pendingInteraction: { kind: 'approval', toolName: 'bash' } } })
  assert.deepEqual(shown, [], 'the focused session in view is not interrupted')
})

test('a finished turn notifies once, and a waiting approval outranks it', async () => {
  const { FakeNotification, shown } = recordingNotificationApi('granted')
  const { plugin } = await loadClientBundle(FakeNotification)
  const form = createForm({ ...CONFIG_DEFAULTS, backgroundOnly: false })
  const sessionStatus = createStore(new Map())
  const sessions = createSessions(['s1'])
  plugin.apply(fakeClientContext({ form, sessionStatus, sessions }).ctx)

  setStatus(sessionStatus, { s1: { completionUnread: true } })
  assert.equal(shown.length, 1)
  assert.equal(shown[0].title, 'titleCompleted')

  setStatus(sessionStatus, { s1: { completionUnread: false } })
  setStatus(sessionStatus, { s1: { completionUnread: true, pendingInteraction: { kind: 'question' } } })
  assert.equal(shown.length, 2)
  assert.equal(shown[1].title, 'titleQuestion', 'the question banner is the one that matters')
})

/** Render function components down to a plain element tree. */
function renderTree(node) {
  if (node === null || node === undefined || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(renderTree)
  const { type, props } = node
  if (typeof type === 'function') return renderTree(type(props))
  return { ...node, props: { ...props, children: renderTree(props?.children) } }
}

/** Every node in a rendered tree matching a predicate. */
function collect(node, predicate, found = []) {
  if (node === null || node === undefined || typeof node !== 'object') return found
  if (Array.isArray(node)) {
    for (const child of node) collect(child, predicate, found)
    return found
  }
  if (predicate(node)) found.push(node)
  collect(node.props?.children, predicate, found)
  return found
}

const switches = tree => collect(tree, node => node.type === 'button' && node.props?.role === 'switch')
const checkboxes = tree => collect(tree, node => node.type === 'input' && node.props?.type === 'checkbox')

/** Render the registered Settings section the way the Harness does. */
function renderNotifySection(captured, snapshot) {
  const injected = captured.registration.options.inject()
  const tree = renderTree(captured.registration.component({
    t: key => key,
    useNotifySettings: selector => selector(snapshot),
    ...injected,
  }))
  return { injected, tree }
}

test('the settings page writes every control through the profile form', async () => {
  const form = createForm(CONFIG_DEFAULTS)
  const { plugin } = await loadClientBundle(recordingNotificationApi().FakeNotification)
  const { ctx, captured } = fakeClientContext({
    form, sessionStatus: createStore(new Map()), sessions: createSessions(['s1']),
  })
  plugin.apply(ctx)

  assert.equal(captured.registration.options.id, 'notifications')
  assert.equal(captured.registration.options.label(), 'nav')
  assert.equal(captured.localeRows[0][0], 'settings.dshNotifications')
  assert.equal(captured.localeRows[0][1].zh.title, '通知')
  assert.equal(captured.localeRows[0][1].zh.notifyApproval, '需要授权时提醒')

  const { injected, tree } = renderNotifySection(captured, form.getSnapshot())
  assert.equal(injected.hooks.notifySettings, form)

  const toggles = switches(tree)
  // enabled, sound, flash, browserNotifications, five categories, backgroundOnly,
  // requireInteraction, sweep — every boolean the settings page exposes.
  assert.equal(toggles.length, 12)
  // enabled · sound · flash · sweep · browserNotifications · approval ·
  // question · planReview · completed · error · backgroundOnly · requireInteraction
  assert.deepEqual(toggles.map(toggle => toggle.props['aria-checked']), [
    true, true, true, true, true, true, true, false, true, true, true, false,
  ])
  assert.equal(checkboxes(tree).length, 2)

  toggles[0].props.onClick()               // enabled off
  toggles[5].props.onClick()               // notifyApproval off
  checkboxes(tree)[0].props.onChange()     // questionMarkers off
  await Promise.resolve()
  assert.deepEqual(form.writes, [
    ['enabled', false],
    ['notifyApproval', false],
    ['questionMarkers', false],
  ])
})

test('the settings page refuses to write while the form is unavailable or process-local', async () => {
  const form = createForm(CONFIG_DEFAULTS, { status: 'unavailable', mode: 'memory', writable: false })
  const { plugin } = await loadClientBundle(recordingNotificationApi().FakeNotification)
  const { ctx, captured } = fakeClientContext({
    form, sessionStatus: createStore(new Map()), sessions: createSessions(['s1']),
  })
  plugin.apply(ctx)

  const { tree } = renderNotifySection(captured, form.getSnapshot())
  const toggles = switches(tree)
  assert.ok(toggles.every(toggle => toggle.props.disabled === true))
  assert.ok(checkboxes(tree).every(box => box.props.disabled === true))
  const text = collect(tree, node => node.type === 'p' && node.props?.children === 'unavailable')
  assert.equal(text.length, 1)

  toggles[0].props.onClick()
  checkboxes(tree)[0].props.onChange()
  await Promise.resolve()
  assert.deepEqual(form.writes, [])
})

test('the universal native helper loads the whale, the alert protocol and the click script', async () => {
  const helper = fileURLToPath(new URL('../native/dsh-notifications-menubar', import.meta.url))
  const { stdout } = await execFileAsync(helper, ['--probe'])
  assert.deepEqual(JSON.parse(stdout), {
    activeTitle: '2',
    alertKind: 'approval',
    alertSoundWireValue: false,
    alertsoundAvailable: true,
    attentionWireValue: false,
    chromeFocusScriptValid: true,
    iconLoaded: true,
    markerCommand: 'markers',
    markerTitle: '2-QSS',
    markerWireValue: 'QS',
    protocol: 2,
    sweepWireValue: false,
    zeroTitle: '',
  })
})
