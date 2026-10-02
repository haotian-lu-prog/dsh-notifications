// The browser half's entry point: wire the runners, the settings section, and
// the locale dictionaries.
//
// Fragment: concatenated last by scripts/build-client.mjs; `apply` and
// `clientInject` are read off the factory's exports by the emitted wrapper.

/** The plugin id: package name, profile entry id, and client module id are one value. */
const CLIENT_ENTRY_ID = 'dsh-notifications'

/** Locale namespace owned by this plugin. */
const NOTIFY_LOCALE_NS = 'settings.dshNotifications'

/** Client services required before load. */
const clientInject = ['slots', 'locale', 'connection', 'configForms', 'sessions', 'uiSession']

/**
 * Show one decided attention, applying the visibility gate first.
 * @param ctx - the client context.
 * @param form - the profile settings form.
 * @param plan - the plan produced by the runner.
 * @returns the notifier result.
 */
function deliverNotification(ctx, form, plan) {
  const settings = resolveSettings(form.getSnapshot()?.value)
  const list = ctx.get('sessions')?.list
  const current = typeof list?.getSnapshot === 'function' ? list.getSnapshot()?.current : undefined
  const hidden = typeof document === 'undefined' ? false : document.hidden
  if (!shouldShowNotification(notificationPermission(), settings.backgroundOnly === true, hidden, plan.sessionId, current)) {
    return { ok: false, message: 'suppressed by permission or the background-only gate' }
  }
  return showNotification(plan.title, plan.body, plan.tag, plan.requireInteraction === true)
}

/** Mount the notification surface: runners, dictionaries, and the settings page. */
function apply(ctx) {
  adoptStyles()
  const t = ctx.locale.bind(NOTIFY_LOCALE_NS)
  ctx.effect(() => ctx.locale.register(NOTIFY_LOCALE_NS, dictionaries), 'dsh-notifications: dictionaries')

  const form = ctx.configForms.get(CLIENT_ENTRY_ID)
  const runner = startAttentionRunners({
    settings: form,
    uiSession: ctx.get('uiSession'),
    sessions: ctx.get('sessions'),
    translate: t,
    notify: plan => {
      const result = deliverNotification(ctx, form, plan)
      if (result.ok !== true) console.info(`[dsh-notifications] ${plan.kind} for ${plan.sessionId}: ${result.message}`)
    },
  })
  ctx.effect(() => () => runner.dispose(), 'dsh-notifications: attention runners')

  // A reconnect re-seeds the baseline: what happened while the transport was
  // down is history, and replaying it would fire a burst of stale banners.
  if (typeof ctx.on === 'function') {
    ctx.effect(() => ctx.on('connection/reset', () => { runner.reseed() }), 'dsh-notifications: reconnect reseed')
  }

  const requestPermission = () => Promise.resolve(requestNotificationPermission())
  const sendTest = () => showNotification(
    t('testTitle'),
    t('testBody'),
    `dsh-notifications-test-${Date.now()}`,
    false,
  )

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'notifications',
    order: 40,
    label: () => t('nav'),
    locale: NOTIFY_LOCALE_NS,
    inject: () => ({
      hooks: { notifySettings: form },
      set: patch => {
        for (const [field, value] of Object.entries(patch)) form.set(field, value)
      },
      requestPermission,
      sendTest,
    }),
  }, NotifySettingsSection))
}
