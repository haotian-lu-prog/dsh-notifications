// The attention runners: the browser half's reason to exist.
//
// Two observations drive every notification:
//   1. a session's pending interaction (`approval` / `question` / `plan-review`)
//      appearing — this is what fires when the Harness needs YOU, including a
//      sandbox escalation;
//   2. a session's completion flag going unread — a turn just finished.
//
// Both come from `uiSession.sessionStatus`, the live client-side truth the
// Harness itself renders from. That matters: the reference implementation this
// plugin learned from reads `uiSession.pendingInteractions`, a name that does
// not exist in DSH 0.2.0-rc.1 — a runner copied from it would observe nothing
// and stay silent, which is exactly the bug this file exists to fix.
//
// Fragment: concatenated by scripts/build-client.mjs; no imports or exports.

/** Fold one session's pending kind and report whether a fresh wait appeared. */
function pendingAdvance(previous, kind) {
  if (previous === undefined) return { kind, fresh: false }
  return { kind, fresh: kind !== undefined && kind !== previous.kind }
}

/** Fold one session's unread-completion flag and report the rising edge. */
function completionAdvance(previous, unread) {
  if (previous === undefined) return { unread, fresh: false }
  // `previous` is the wrapper the caller stored, so the edge is read off its
  // field — the shape `pendingAdvance` already uses. Comparing the wrapper
  // itself to `true` is always true, so `fresh` degenerates to "still unread":
  // every later status publish then repeats the banner for that session, and a
  // session nobody opens (a subagent) never clears the flag.
  return { unread, fresh: unread === true && previous.unread !== true }
}

/**
 * Read the session status map across both shapes the client has used: the
 * 0.1.x row field and the 0.2 status store. Reading defensively keeps one
 * bundle working on both generations — the failure mode this plugin actually
 * shipped with was reading only the shape that had gone away.
 *
 * The check is structural rather than `instanceof Map`: the bundle is evaluated
 * in its own realm, where a map handed in from another realm fails an
 * `instanceof` test while still being a perfectly good map.
 * @returns the status map, or an empty map when the service is absent.
 */
function sessionStatusMap(uiSession) {
  const store = uiSession?.sessionStatus
  if (store === undefined || typeof store.getSnapshot !== 'function') return new Map()
  const snapshot = store.getSnapshot()
  if (snapshot === null || typeof snapshot !== 'object' || typeof snapshot.get !== 'function') return new Map()
  return snapshot
}

/** The pending kind reported for one session, across both client generations. */
function pendingKindOf(statusMap, summary) {
  const fromStatus = asPendingKind(statusMap.get(summary.id)?.pendingInteraction?.kind)
  if (fromStatus !== undefined) return fromStatus
  return asPendingKind(summary.pendingInteraction)
}

/** Whether one session's completion is unread, across both client generations. */
function completionUnreadOf(statusMap, summary) {
  const status = statusMap.get(summary.id)
  if (status !== undefined && typeof status.completionUnread === 'boolean') return status.completionUnread
  return summary.completed === true
}

/**
 * Whether one list row is a delegated child session rather than the user's own.
 *
 * The client list row spreads the host summary, so the marker a spawn records
 * survives: `origin: 'subagent'`. Only that marker is trusted — a fork carries a
 * parent too, but a fork is the user's own session and keeps notifying.
 * @param summary - one row from `sessions.list`.
 * @returns whether the session was spawned to serve another agent's turn.
 */
function isDelegatedSession(summary) {
  return summary.origin === 'subagent'
}

/**
 * The detail line for one attention: the tool asking for approval, or the
 * session title, whichever the runtime actually supplies.
 */
function attentionDetail(kind, status, title) {
  const interaction = status?.pendingInteraction
  if (kind === 'approval') {
    const tool = typeof interaction?.toolName === 'string' && interaction.toolName !== ''
      ? interaction.toolName
      : undefined
    const reason = typeof interaction?.displayReason === 'string' && interaction.displayReason !== ''
      ? interaction.displayReason
      : (typeof interaction?.reason === 'string' ? interaction.reason : undefined)
    return [tool, reason].filter(part => part !== undefined && part !== '').join(' · ')
  }
  return typeof title === 'string' ? title : ''
}

/**
 * Start both runners. Returns a disposer; every subscription is released with
 * the plugin's fiber.
 *
 * @param deps - the wired dependencies (all optional except `settings`).
 * @returns the disposer.
 */
function startAttentionRunners(deps) {
  const { settings, uiSession, sessions, translate, notify } = deps
  const observedPending = new Map()
  const observedCompletion = new Map()
  const sequences = new Map()

  const readSettings = () => {
    const snapshot = settings.getSnapshot()
    return resolveSettings(snapshot?.value)
  }

  const listSnapshot = () => {
    const list = sessions?.list
    if (list === undefined || typeof list.getSnapshot !== 'function') return { ids: [], byId: {}, current: undefined }
    return list.getSnapshot() ?? { ids: [], byId: {}, current: undefined }
  }

  /** Judge one attention and hand a decided plan to the notifier. */
  const raise = (kind, sessionId, title, detail) => {
    const current = readSettings()
    if (!shouldNotify(current, kind, title, detail, '')) return
    const sequence = (sequences.get(`${sessionId}:${kind}`) ?? 0) + 1
    sequences.set(`${sessionId}:${kind}`, sequence)
    notify({
      kind,
      sessionId,
      title: translate(attentionTitleKey(kind)),
      body: detail === '' ? translate('bodyFallback') : detail,
      tag: notificationTag(sessionId, kind, sequence),
      requireInteraction: current.requireInteraction === true,
    })
  }

  const run = () => {
    const list = listSnapshot()
    const statusMap = sessionStatusMap(uiSession)
    const live = new Set()

    for (const id of list.ids ?? []) {
      const summary = list.byId?.[id]
      if (summary === undefined) continue
      live.add(id)
      const status = statusMap.get(id)
      const title = summary.displayTitle ?? summary.title
      // A delegated child is the parent agent's business: its turn ending is not
      // the user's task finishing, and one fan-out would otherwise bury the
      // screen in banners titled with the child's own prompt. Its approvals and
      // questions still surface below — those the user really does answer.
      const delegated = isDelegatedSession(summary)

      const pending = pendingAdvance(observedPending.get(id), pendingKindOf(statusMap, summary))
      // Store a wrapper, never the bare kind: `Map.get` answers undefined both
      // for "never observed" and for "observed, nothing pending", and conflating
      // the two makes the first real wait look like a seed and never fire.
      observedPending.set(id, { kind: pending.kind })
      if (pending.fresh && pending.kind !== undefined) {
        raise(pending.kind, id, title, attentionDetail(pending.kind, status, title))
      }

      const completion = completionAdvance(observedCompletion.get(id), completionUnreadOf(statusMap, summary))
      observedCompletion.set(id, { unread: completion.unread })
      if (completion.fresh && !delegated) {
        // A session that is waiting for the user is not "finished": the
        // completion flag and a pending interaction can be set at once, and the
        // approval banner is the one that matters.
        if (pendingKindOf(statusMap, summary) === undefined) {
          raise('completed', id, title, title ?? '', '')
        }
      }
    }

    for (const id of [...observedPending.keys()]) if (!live.has(id)) observedPending.delete(id)
    for (const id of [...observedCompletion.keys()]) if (!live.has(id)) observedCompletion.delete(id)
  }

  /** Forget every observation; the next frame seeds a fresh baseline. */
  const reseed = () => {
    observedPending.clear()
    observedCompletion.clear()
    run()
  }

  // Seed before subscribing: a wait or a completion that already existed when
  // the page loaded is history, not news.
  run()

  const disposers = []
  const statusStore = uiSession?.sessionStatus
  if (statusStore !== undefined && typeof statusStore.subscribe === 'function') {
    disposers.push(statusStore.subscribe(run))
  }
  const list = sessions?.list
  if (list !== undefined && typeof list.subscribe === 'function') disposers.push(list.subscribe(run))
  return { dispose: () => { for (const off of disposers) { try { off() } catch { /* already released */ } } }, reseed, run }
}
