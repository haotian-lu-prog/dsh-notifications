/**
 * The notification decision's own contract: the keyword rule grammar, the
 * include/exclude semantics, and the category gate.
 *
 * These functions decide whether the user is interrupted, so the tests state
 * the promised behaviour in user terms (a line of text in the settings page)
 * rather than restating the implementation.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseKeywordRules,
  resolveSettings,
  ruleMatches,
  ruleSubject,
  rulesAllow,
  shouldNotify,
} from '../lib/shared/decision.js'

test('a bare keyword line means "only notify when it matches"', () => {
  const rules = parseKeywordRules('deploy')
  assert.equal(rulesAllow(rules, ruleSubject('release', 'deploy finished', '')), true)
  assert.equal(rulesAllow(rules, ruleSubject('release', 'tests finished', '')), false)
})

test('a leading dash excludes and always wins over an include', () => {
  const rules = parseKeywordRules('deploy\n-deploy-canary')
  assert.equal(rulesAllow(rules, ruleSubject('deploy', '', '')), true)
  assert.equal(rulesAllow(rules, ruleSubject('release', 'deploy-canary failed', '')), false)
})

test('rules match the session title, the detail line and the reply body alike', () => {
  const rules = parseKeywordRules('-sandbox')
  assert.equal(rulesAllow(rules, ruleSubject('', 'tool bash (sandbox)', '')), false)
  assert.equal(rulesAllow(rules, ruleSubject('sandbox experiments', '', '')), false)
  assert.equal(rulesAllow(rules, ruleSubject('', '', 'sandbox output')), false)
  assert.equal(rulesAllow(rules, ruleSubject('deploy', 'tool bash', 'all good')), true)
})

test('re: switches a line to a regular expression and cs: makes it case-sensitive', () => {
  const regex = parseKeywordRules('re:^deploy-\\d+$')
  assert.equal(rulesAllow(regex, ruleSubject('deploy-42', '', '')), true)
  assert.equal(rulesAllow(regex, ruleSubject('redeploy-42', '', '')), false)

  const insensitive = parseKeywordRules('deploy')
  assert.equal(rulesAllow(insensitive, ruleSubject('DEPLOY', '', '')), true)
  const sensitive = parseKeywordRules('cs:DEPLOY')
  assert.equal(rulesAllow(sensitive, ruleSubject('deploy', '', '')), false)
  assert.equal(rulesAllow(sensitive, ruleSubject('DEPLOY', '', '')), true)
})

test('a blank keyword field filters nothing, and junk lines never disable notifications', () => {
  assert.equal(rulesAllow(parseKeywordRules(''), ruleSubject('anything', '', '')), true)
  assert.equal(rulesAllow(parseKeywordRules('   \n\n'), ruleSubject('anything', '', '')), true)
  // A malformed regular expression is inert: the user keeps their notifications
  // instead of losing every one of them to a typo.
  const broken = parseKeywordRules('-re:([unclosed')
  assert.equal(broken.length, 1)
  assert.equal(ruleMatches(broken[0], 'anything'), false)
  assert.equal(rulesAllow(broken, ruleSubject('anything', '', '')), true)
})

test('an approval is notified by default, a plan review is not', () => {
  const settings = resolveSettings({})
  assert.equal(shouldNotify(settings, 'approval', 'session', 'bash', ''), true)
  assert.equal(shouldNotify(settings, 'question', 'session', '', ''), true)
  assert.equal(shouldNotify(settings, 'plan-review', 'session', '', ''), false)
  assert.equal(shouldNotify(settings, 'completed', 'session', '', ''), true)
})

test('the master switches and the per-kind switches both gate a notification', () => {
  assert.equal(shouldNotify(resolveSettings({ enabled: false }), 'approval', 's', '', ''), false)
  assert.equal(shouldNotify(resolveSettings({ browserNotifications: false }), 'approval', 's', '', ''), false)
  assert.equal(shouldNotify(resolveSettings({ notifyApproval: false }), 'approval', 's', '', ''), false)
  assert.equal(shouldNotify(resolveSettings({ notifyApproval: false }), 'question', 's', '', ''), true)
  assert.equal(shouldNotify(resolveSettings({ notifyError: true }), 'error', 's', '', ''), true)
})

test('keyword rules gate a notification end to end', () => {
  const settings = resolveSettings({ keywords: '-sandbox' })
  assert.equal(shouldNotify(settings, 'approval', 'session', 'bash (sandbox)', ''), false)
  assert.equal(shouldNotify(settings, 'approval', 'session', 'bash', ''), true)
})

test('an unknown field or type falls back to the declared default instead of throwing', () => {
  const settings = resolveSettings({ enabled: 'yes', keywords: 42, notifyError: true, nonsense: 1 })
  assert.equal(settings.enabled, true)
  assert.equal(settings.keywords, '')
  assert.equal(settings.notifyError, true)
  assert.equal('nonsense' in settings, false)
})
