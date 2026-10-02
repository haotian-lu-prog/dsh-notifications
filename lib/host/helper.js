/**
 * The native helper process: launch, protocol, and shutdown.
 *
 * The helper is an AppKit executable owned by this package. It receives
 * newline-delimited JSON on stdin and owns the menu bar item; this module owns
 * its lifetime and never lets a dead pipe become an unhandled error.
 */
import { constants, accessSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** Absolute path of the packaged universal helper. */
export const helperPath = fileURLToPath(new URL('../../native/dsh-notifications-menubar', import.meta.url))

/** Grace given to the helper to exit on its own before it is signalled. */
const SHUTDOWN_GRACE_MS = 1_000

function waitForClose(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise(resolve => { child.once('close', resolve) })
}

function delay(milliseconds) {
  return new Promise(resolve => { setTimeout(resolve, milliseconds) })
}

/**
 * Launch the package-owned AppKit process and expose its command protocol.
 * @param logger - the plugin logger.
 * @param webClientOrigin - the loopback origin the indicator focuses on click.
 * @param spawnProcess - injection seam for tests.
 */
export function launchMenuBarHelper(logger, webClientOrigin, spawnProcess = spawn) {
  if (process.platform !== 'darwin') {
    throw new Error('dsh-notifications supports macOS only')
  }
  accessSync(helperPath, constants.X_OK)

  const child = spawnProcess(helperPath, [], {
    stdio: ['pipe', 'ignore', 'pipe'],
    env: { LANG: process.env.LANG ?? 'en_US.UTF-8' },
  })
  let closing = false
  let writable = true

  child.once('error', error => {
    writable = false
    if (!closing) logger.warn(`dsh-notifications: menu bar helper failed: ${String(error)}`)
  })
  child.stdin.on('error', error => {
    writable = false
    if (!closing) logger.warn(`dsh-notifications: menu bar helper input failed: ${String(error)}`)
  })
  child.stderr.on('data', chunk => {
    const message = String(chunk).trim()
    if (message.length > 0) logger.warn(`dsh-notifications: menu bar helper: ${message}`)
  })
  child.once('exit', (code, signal) => {
    writable = false
    if (!closing) {
      logger.warn(`dsh-notifications: menu bar helper exited unexpectedly (${signal ?? `code ${String(code)}`})`)
    }
  })

  const send = message => {
    if (!writable || child.stdin.destroyed) return
    child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  send({ type: 'url', url: webClientOrigin })

  return {
    setCount(count) {
      send({ type: 'count', count })
    },
    setMarkers(markers) {
      send({ type: 'markers', markers })
    },
    setSweepEnabled(enabled) {
      send({ type: 'sweep', sweep: enabled })
    },
    /**
     * Nudge the user: sound and/or a flashing item. Fired the moment an
     * approval or a question arrives, which is the one moment the user cannot
     * recover by looking at the window later.
     */
    alert(kind, { sound = true, flash = true } = {}) {
      send({ type: 'alert', kind, sound, flash })
    },
    /** Hold or release the red/flashing attention state. */
    setAttention(active) {
      send({ type: 'attention', active })
    },
    async close() {
      if (closing) return waitForClose(child)
      closing = true
      send({ type: 'quit' })
      child.stdin.end()

      const closed = waitForClose(child)
      if (child.exitCode === null && child.signalCode === null) {
        await Promise.race([closed, delay(SHUTDOWN_GRACE_MS)])
      }
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
      if (child.exitCode === null && child.signalCode === null) {
        await Promise.race([closed, delay(SHUTDOWN_GRACE_MS)])
      }
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      await closed
    },
  }
}
