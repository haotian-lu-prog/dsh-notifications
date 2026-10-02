/**
 * The menu bar indicator: one optional native helper, serialized settings
 * changes, and the alert that fires when the Harness needs the user.
 *
 * Every method here is safe to call when the helper is off — the indicator is
 * the single owner of "is there a helper right now", so callers never branch on
 * it. Settings changes are serialized through a promise tail: an enable/disable
 * arrives while a previous enable/disable is still closing a process, and the
 * two must not interleave.
 */

/** Minimum gap between two alert nudges, so a burst cannot become a siren. */
const ALERT_COOLDOWN_MS = 3_000

/** Track the authoritative live Agent states and publish every count change. */
export class MenuBarIndicator {
  constructor(logger, enabled, webClientOrigin, launch, options = {}) {
    this.logger = logger
    this.launch = launch
    this.webClientOrigin = webClientOrigin
    this.runningCount = 0
    this.markerCounts = { Q: 0, S: 0 }
    this.questionMarkers = options.questionMarkers ?? true
    this.approvalMarkers = options.approvalMarkers ?? true
    this.sweep = options.sweep ?? true
    this.sound = options.sound ?? true
    this.flash = options.flash ?? true
    this.lastAlertAt = 0
    this.desired = enabled
    this.helper = enabled ? launch(logger, webClientOrigin) : undefined
    this.tail = Promise.resolve()
    this.disposed = false
    this.publishPresentation()
  }

  setCount(count) {
    this.runningCount = count
    this.publishPresentation()
  }

  setMarkerCounts(counts) {
    this.markerCounts = counts
    this.publishPresentation()
  }

  setQuestionMarkers(enabled) {
    this.questionMarkers = enabled
    this.publishPresentation()
  }

  setApprovalMarkers(enabled) {
    this.approvalMarkers = enabled
    this.publishPresentation()
  }

  setSweepEnabled(enabled) {
    this.sweep = enabled
    this.publishPresentation()
  }

  setAlertOptions({ sound, flash }) {
    if (sound !== undefined) this.sound = sound
    if (flash !== undefined) this.flash = flash
    this.publishPresentation()
  }

  /**
   * Nudge the user the moment an attention arrives.
   * @param kind - `approval` or `question`.
   */
  alert(kind) {
    if (this.disposed || this.helper === undefined) return
    if (!this.sound && !this.flash) return
    const now = Date.now()
    if (now - this.lastAlertAt < ALERT_COOLDOWN_MS) return
    this.lastAlertAt = now
    this.helper.alert(kind, { sound: this.sound, flash: this.flash })
  }

  publishPresentation() {
    const markers = `${this.questionMarkers ? 'Q'.repeat(this.markerCounts.Q) : ''}${this.approvalMarkers ? 'S'.repeat(this.markerCounts.S) : ''}`
    this.helper?.setCount(markers.length === 0 ? this.runningCount : markers.length)
    this.helper?.setMarkers(markers)
    this.helper?.setSweepEnabled(markers.length > 0 && this.sweep)
    // Attention is a state, not an event: it is held while anything still waits
    // and released the moment the last pending interaction is answered.
    this.helper?.setAttention(markers.length > 0 && this.flash)
  }

  setEnabled(enabled) {
    if (this.disposed) return Promise.resolve()
    this.desired = enabled
    const task = this.tail.catch(() => {}).then(async () => {
      if (this.disposed) return
      if (this.desired && this.helper === undefined) {
        this.helper = this.launch(this.logger, this.webClientOrigin)
        this.publishPresentation()
      } else if (!this.desired && this.helper !== undefined) {
        const helper = this.helper
        this.helper = undefined
        await helper.close()
      }
    })
    this.tail = task
    return task
  }

  async dispose() {
    if (this.disposed) return
    this.disposed = true
    this.desired = false
    await this.tail.catch(() => {})
    if (this.helper === undefined) return
    const helper = this.helper
    this.helper = undefined
    await helper.close()
  }
}

/** Push every live Config reference into the running indicator. */
export function publishLiveConfig(indicator, config) {
  indicator.setQuestionMarkers(config.questionMarkers.get())
  indicator.setApprovalMarkers(config.approvalMarkers.get())
  indicator.setSweepEnabled(config.sweep.get())
  indicator.setAlertOptions({ sound: config.sound?.get?.(), flash: config.flash?.get?.() })
  indicator.setEnabled(config.enabled.get())
}
