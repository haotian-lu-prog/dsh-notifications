/**
 * dsh-notifications host half: the macOS menu bar indicator, and the native
 * half of the alert that fires when the Harness needs the user.
 *
 * The browser half lives in `client.js` (generated from `lib/client/**` by
 * `scripts/build-client.mjs`) and owns system notifications; this half owns the
 * indicator and the alert nudge that works even when no browser is looking.
 *
 * Until DSH 0.2.0-rc.1 the alert did not exist: an approval only painted a
 * letter into the menu bar item, which is invisible when the user is away from
 * the machine — exactly when an approval is waiting on them.
 */
import { Config, ENTRY_ID, name } from './lib/host/config.js'
import { helperPath, launchMenuBarHelper } from './lib/host/helper.js'
import { MenuBarIndicator, publishLiveConfig } from './lib/host/indicator.js'
import { observePendingInteractions, observeRunningAgents } from './lib/host/observe.js'

export { Config, ENTRY_ID, name, helperPath, launchMenuBarHelper, MenuBarIndicator, publishLiveConfig }
export { observePendingInteractions, observeRunningAgents }

/** Host services required before load. */
export const inject = ['agents', 'webServer']

/** Resolve the loopback origin used by this Harness process's Web client. */
export function webClientOrigin(ctx) {
  return `http://127.0.0.1:${String(ctx.webServer.port)}`
}

/** Mount the configurable macOS menu bar indicator for this Harness process. */
export function apply(ctx, config) {
  // The browser half ships its own Settings page, so the automatically
  // generated config page must not offer the same fields twice.
  ctx.inject(['settings'], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
  ctx.effect(() => {
    const indicator = new MenuBarIndicator(ctx.logger, config.enabled.get(), webClientOrigin(ctx), launchMenuBarHelper, {
      questionMarkers: config.questionMarkers.get(),
      approvalMarkers: config.approvalMarkers.get(),
      sweep: config.sweep.get(),
      sound: config.sound.get(),
      flash: config.flash.get(),
    })
    const stopObserving = observeRunningAgents(ctx, count => { indicator.setCount(count) })
    const stopInteractions = observePendingInteractions(
      ctx,
      counts => { indicator.setMarkerCounts(counts) },
      // The nudge is the point: it fires the instant an approval or a question
      // arrives, not when the user happens to look at the menu bar.
      kind => { indicator.alert(kind) },
    )
    // Volatile-only config edits are committed into these references and
    // announced on the owning fiber instead of remounting the plugin.
    const stopWatching = ctx.on('loader/volatile-update', () => { publishLiveConfig(indicator, config) })
    return async () => {
      stopWatching()
      stopInteractions()
      stopObserving()
      await indicator.dispose()
    }
  })
}
