/**
 * Host-side observation of the two things that matter to the indicator:
 * which Agents are running, and which interactions await the user.
 *
 * Both observers return a disposer and never claim the event they observe: the
 * approval and question events are waterfalls owned by whoever actually answers
 * them, so this plugin wraps them with `next()` and publishes a count on the
 * way through. Taking over either waterfall would mean the approval card never
 * renders — the failure mode is silent and total, and the plugin would look
 * like it "just notified".
 */

/** Track the authoritative live Agent states and publish every count change. */
export function observeRunningAgents(ctx, publish) {
  const running = new Set(
    ctx.agents.list().filter(agent => agent.status === 'running'),
  )
  let lastCount
  const publishIfChanged = () => {
    if (lastCount === running.size) return
    lastCount = running.size
    publish(lastCount)
  }

  const disposeStatus = ctx.on('agent/status', ({ agent, status }) => {
    if (status === 'running') running.add(agent)
    else running.delete(agent)
    publishIfChanged()
  })
  const disposeAgent = ctx.on('agent/disposed', ({ agent }) => {
    running.delete(agent)
    publishIfChanged()
  })
  publishIfChanged()

  return () => {
    disposeStatus()
    disposeAgent()
  }
}

/**
 * Track pending question and approval requests without claiming either waterfall.
 * @param ctx - the host context.
 * @param publish - receives the pending counts after every change.
 * @param onAsk - called with `approval` or `question` the moment one arrives.
 */
export function observePendingInteractions(ctx, publish, onAsk) {
  const pending = { Q: 0, S: 0 }
  const observe = (event, marker, kind) => ctx.on(event, async (_request, next) => {
    pending[marker] += 1
    if (typeof onAsk === 'function') onAsk(kind)
    publish({ ...pending })
    try {
      return await next()
    } finally {
      pending[marker] -= 1
      publish({ ...pending })
    }
  }, { global: true, prepend: true })
  const disposeQuestion = observe('user-questions/request', 'Q', 'question')
  const disposeApproval = observe('approval/request', 'S', 'approval')

  return () => {
    disposeQuestion()
    disposeApproval()
  }
}
