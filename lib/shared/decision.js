/**
 * The notification decision, shared by the host half and the browser bundle.
 *
 * Everything here is pure: it maps an attention to a category, evaluates the
 * keyword rules over a subject string, and answers whether that attention
 * should surface. Browser permission, page visibility and the native helper
 * stay outside — those are reads with side effects, and keeping them out is
 * what makes this file testable without a DOM.
 */
import {
  asPendingKind,
  asTurnReason,
  completionCategory,
  pendingCategory,
  resolveSettings,
} from './contract.js'

/** The keyword-rule marker that turns a line into an exclusion. */
const EXCLUDE_PREFIX = '-'
/** The keyword-rule marker that turns a line into a regular expression. */
const REGEX_PREFIX = 're:'
/** The keyword-rule marker that makes a match case-sensitive. */
const CASE_PREFIX = 'cs:'

/**
 * Parse the settings page's keyword text into rules.
 *
 * Grammar, one rule per line:
 *   `word`        include when the subject contains `word`
 *   `-word`       exclude when the subject contains `word`
 *   `re:pattern`  include when the regular expression matches
 *   `-re:pattern` exclude when the regular expression matches
 *   `cs:` prefix (after the include/exclude marker) makes matching case-sensitive
 *
 * Blank lines are ignored, matching is case-insensitive unless `cs:` is given,
 * and a malformed regular expression degrades to an inert rule rather than
 * throwing — a settings typo must never disable notifications wholesale.
 * @param text - the raw keyword field.
 * @returns parsed rules in declaration order.
 */
export function parseKeywordRules(text) {
  if (typeof text !== 'string' || text.trim() === '') return []
  const rules = []
  for (const line of text.split('\n')) {
    let body = line.trim()
    if (body === '') continue
    let mode = 'include'
    if (body.startsWith(EXCLUDE_PREFIX)) {
      mode = 'exclude'
      body = body.slice(EXCLUDE_PREFIX.length).trim()
    }
    let caseSensitive = false
    if (body.startsWith(CASE_PREFIX)) {
      caseSensitive = true
      body = body.slice(CASE_PREFIX.length)
    }
    const isRegex = body.startsWith(REGEX_PREFIX)
    const pattern = isRegex ? body.slice(REGEX_PREFIX.length) : body
    if (pattern === '') continue
    if (isRegex) {
      try {
        // Compile once at parse time so a bad pattern is inert for its whole life.
        new RegExp(pattern, caseSensitive ? '' : 'i')
      } catch {
        rules.push({ mode, pattern, isRegex, caseSensitive, invalid: true })
        continue
      }
    }
    rules.push({ mode, pattern, isRegex, caseSensitive, invalid: false })
  }
  return rules
}

/**
 * Whether one rule matches a subject.
 * @param rule - a rule from {@link parseKeywordRules}.
 * @param subject - the text a rule is matched against.
 * @returns true when the rule matches.
 */
export function ruleMatches(rule, subject) {
  if (rule.invalid === true) return false
  if (rule.isRegex) {
    return new RegExp(rule.pattern, rule.caseSensitive ? '' : 'i').test(subject)
  }
  const haystack = rule.caseSensitive ? subject : subject.toLowerCase()
  const needle = rule.caseSensitive ? rule.pattern : rule.pattern.toLowerCase()
  return haystack.includes(needle)
}

/**
 * Evaluate include/exclude rules over one subject.
 *
 * Exclusions always win. When at least one include rule is configured, the
 * subject must match one of them; with no include rules everything is allowed.
 * @param rules - parsed keyword rules.
 * @param subject - the text to judge.
 * @returns whether a notification may surface for this subject.
 */
export function rulesAllow(rules, subject) {
  if (rules.length === 0) return true
  const excludes = rules.filter(rule => rule.mode === 'exclude')
  if (excludes.some(rule => ruleMatches(rule, subject))) return false
  const includes = rules.filter(rule => rule.mode === 'include')
  if (includes.length === 0) return true
  return includes.some(rule => ruleMatches(rule, subject))
}

/**
 * Build the text keyword rules are matched against: the session title, the
 * attention's detail (tool name or question text), and any turn reply body.
 * @param title - the session title, when the runtime projects one.
 * @param detail - the attention-specific detail line.
 * @param body - a turn's reply text, when one is being reported.
 * @returns the joined subject.
 */
export function ruleSubject(title, detail, body) {
  const parts = []
  if (typeof title === 'string' && title.trim() !== '') parts.push(title.trim())
  if (typeof detail === 'string' && detail.trim() !== '') parts.push(detail.trim())
  if (typeof body === 'string' && body.trim() !== '') parts.push(body.trim())
  return parts.join('\n')
}

/**
 * Whether the settings enable the notification category for one attention.
 * @param settings - a resolved settings record.
 * @param category - the category field name.
 * @returns whether this category is on.
 */
export function categoryEnabled(settings, category) {
  if (category === undefined) return false
  if (settings.enabled !== true) return false
  if (settings.browserNotifications !== true) return false
  return settings[category] === true
}

/** The attention categories this plugin can raise, in settings-page order. */
export const ATTENTION_KINDS = Object.freeze(['approval', 'question', 'plan-review', 'completed', 'error'])

/**
 * Decide one attention end to end: category, settings, and keyword rules.
 * @param settings - a resolved settings record.
 * @param kind - a pending kind or turn reason.
 * @param title - the session title.
 * @param detail - the attention detail line.
 * @param body - an optional reply body.
 * @returns whether to notify.
 */
export function shouldNotify(settings, kind, title, detail, body) {
  const category = pendingCategory(kind) ?? completionCategory(kind)
  if (!categoryEnabled(settings, category)) return false
  const rules = parseKeywordRules(settings.keywords)
  return rulesAllow(rules, ruleSubject(title, detail, body))
}

/** Convenience for callers holding raw profile values. */
export { resolveSettings, asPendingKind, asTurnReason, pendingCategory, completionCategory }
