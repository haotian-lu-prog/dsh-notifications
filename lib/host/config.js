/**
 * The plugin's profile configuration.
 *
 * Every field is `.volatile()`: a settings change is committed into the running
 * references and announced on the owning fiber instead of remounting the
 * plugin, so flipping a switch never restarts the native helper or drops a
 * pending marker.
 *
 * The browser half reads these same fields through `configForms`, which is why
 * the notification switches live here rather than in browser storage: the
 * profile file stays the single source of truth, and the settings page and the
 * native indicator can never disagree about what is on.
 */
import z from '@deepseek-ai/schemastery'

/** Cordis plugin name; also the profile entry id and the client module id. */
export const name = 'dsh-notifications'

/** Profile entry id from `cordis.patch.yml`; it names this plugin's settings form. */
export const ENTRY_ID = 'dsh-notifications'

/** Live fields of the indicator and of the notifications it raises. */
export const Config = z.object({
  // Native side: the macOS menu bar indicator.
  enabled: z.boolean().default(true).volatile(),
  questionMarkers: z.boolean().default(true).volatile(),
  approvalMarkers: z.boolean().default(true).volatile(),
  sweep: z.boolean().default(true).volatile(),
  sound: z.boolean().default(true).volatile(),
  flash: z.boolean().default(true).volatile(),
  // Browser side: system notifications raised by the Web Client half.
  browserNotifications: z.boolean().default(true).volatile(),
  notifyApproval: z.boolean().default(true).volatile(),
  notifyQuestion: z.boolean().default(true).volatile(),
  notifyPlanReview: z.boolean().default(false).volatile(),
  notifyCompleted: z.boolean().default(true).volatile(),
  notifyError: z.boolean().default(true).volatile(),
  backgroundOnly: z.boolean().default(true).volatile(),
  requireInteraction: z.boolean().default(false).volatile(),
  keywords: z.string().default('').volatile(),
})
