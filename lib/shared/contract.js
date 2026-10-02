/**
 * Shared contract between the plugin's host half and its browser bundle.
 *
 * Both halves must agree on three things: which attentions the Harness can
 * raise, which notification categories the settings page exposes, and how a
 * keyword rule line is spelled. Keeping the answers here — dependency-free and
 * side-effect-free — is what lets the host read the profile Config while the
 * bundle reads the same fields through `configForms`, without either half
 * guessing at the other's vocabulary.
 */

/** Pending interactions the Harness client reports for a session. */
export const PENDING_KINDS = Object.freeze(['approval', 'question', 'plan-review'])

/** Turn-end reasons a completion notification can report. */
export const TURN_REASONS = Object.freeze(['completed', 'error', 'aborted', 'blocked', 'max-tokens'])

/**
 * Profile-config fields this plugin reads, with the fallback for a value the
 * profile does not carry (an older patch layer, or a partially written form).
 * The host declares the same names in its schemastery `Config`; this map is the
 * single list the browser bundle validates against.
 */
export const SETTING_DEFAULTS = Object.freeze({
  // Native side: the macOS menu bar indicator.
  enabled: true,
  questionMarkers: true,
  approvalMarkers: true,
  sweep: true,
  sound: true,
  flash: true,
  // Browser side: system notifications from the Web Client half.
  browserNotifications: true,
  notifyApproval: true,
  notifyQuestion: true,
  notifyPlanReview: false,
  notifyCompleted: true,
  notifyError: true,
  backgroundOnly: true,
  requireInteraction: false,
  keywords: '',
})

/** Whether a value is a plain boolean. */
function isBoolean(value) {
  return typeof value === 'boolean'
}

/**
 * Fold a raw settings snapshot into the field map both halves use. Unknown keys
 * are dropped and wrong-typed values fall back to the declared default, so a
 * hand-edited patch layer can never make the bundle throw.
 * @param raw - the profile form value (or any object).
 * @returns a complete settings record.
 */
export function resolveSettings(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const resolved = {}
  for (const [field, fallback] of Object.entries(SETTING_DEFAULTS)) {
    const value = source[field]
    if (isBoolean(fallback)) resolved[field] = isBoolean(value) ? value : fallback
    else resolved[field] = typeof value === 'string' ? value : fallback
  }
  return resolved
}

/** The notification category for one pending interaction kind. */
export function pendingCategory(kind) {
  switch (kind) {
    case 'approval': return 'notifyApproval'
    case 'question': return 'notifyQuestion'
    case 'plan-review': return 'notifyPlanReview'
    default: return undefined
  }
}

/** The notification category for one turn-end reason. */
export function completionCategory(reason) {
  switch (reason) {
    case 'completed': return 'notifyCompleted'
    case 'error': return 'notifyError'
    default: return undefined
  }
}

/**
 * Normalize a raw pending-interaction kind reported by the Harness client.
 * @param value - the reported `pendingInteraction.kind`.
 * @returns the known kind, or undefined for anything else.
 */
export function asPendingKind(value) {
  return typeof value === 'string' && PENDING_KINDS.includes(value) ? value : undefined
}

/**
 * Normalize a raw turn-end reason.
 * @param value - the reported reason kind.
 * @returns the known reason, or undefined for anything else.
 */
export function asTurnReason(value) {
  return typeof value === 'string' && TURN_REASONS.includes(value) ? value : undefined
}
