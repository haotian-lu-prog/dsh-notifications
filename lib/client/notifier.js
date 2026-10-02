// Browser-side notification delivery.
//
// Fragment: concatenated into the plugin bundle by scripts/build-client.mjs, so
// it declares no imports and no exports and shares one scope with the shared
// contract/decision modules that precede it. Only pure presentation decisions
// live here; the runner owns when to call them.

/** The Notification constructor, or undefined in a context that has none. */
function notificationsApi() {
  return typeof Notification === 'undefined' ? undefined : Notification
}

/** The current browser permission, defaulting to denied without an API. */
function notificationPermission() {
  return notificationsApi()?.permission ?? 'denied'
}

/** Ask the browser for notification permission, tolerating an absent API. */
function requestNotificationPermission() {
  const api = notificationsApi()
  if (api === undefined) return Promise.resolve('denied')
  try {
    return Promise.resolve(api.requestPermission())
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * The notification title key for one attention kind. Titles are looked up in
 * the locale dictionary by the runner, never composed here.
 */
function attentionTitleKey(kind) {
  switch (kind) {
    case 'approval': return 'titleApproval'
    case 'question': return 'titleQuestion'
    case 'plan-review': return 'titlePlanReview'
    case 'completed': return 'titleCompleted'
    case 'error': return 'titleError'
    default: return 'titleGeneric'
  }
}

/**
 * Whether a notification may surface right now.
 *
 * Permission is mandatory. `backgroundOnly` keeps a notification from firing
 * for the session the user is already looking at in a focused page: a
 * completion or an approval the user can already see on screen does not need a
 * system banner, and firing one there is how a notifier becomes noise.
 * @param permission - the browser permission.
 * @param backgroundOnly - the "only when the page is not in front" setting.
 * @param documentHidden - whether the page is currently hidden.
 * @param sessionId - the session the attention belongs to.
 * @param currentSessionId - the session currently in view.
 * @returns whether to show.
 */
function shouldShowNotification(permission, backgroundOnly, documentHidden, sessionId, currentSessionId) {
  if (permission !== 'granted') return false
  if (backgroundOnly === true && documentHidden !== true && sessionId === currentSessionId) return false
  return true
}

/**
 * The grouping tag for one attention. One slot per session per attention
 * sequence keeps a later banner from being swallowed by an earlier one that is
 * still sitting in the notification centre.
 */
function notificationTag(sessionId, kind, sequence) {
  return `dsh-notifications-${kind}-${sessionId}-${sequence}`
}

/**
 * Construct one system notification and wire its click to focus the window.
 * @returns a result record; creation failures are reported, never swallowed.
 */
function showNotification(title, body, tag, requireInteraction) {
  const api = notificationsApi()
  if (api === undefined) return { ok: false, message: 'The Notification API is unavailable in this context.' }
  if (api.permission !== 'granted') return { ok: false, message: 'Notification permission is not granted.' }
  try {
    const notification = new api(title, { body, tag, requireInteraction })
    notification.onclick = () => { try { window.focus() } catch { /* focus is best effort */ } }
    return { ok: true, notification }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
