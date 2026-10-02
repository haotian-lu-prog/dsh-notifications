English | [简体中文](https://github.com/haotian-lu-prog/dsh-notifications/blob/main/README.md)

# dsh-notifications

[![npm version](https://img.shields.io/npm/v/dsh-notifications)](https://www.npmjs.com/package/dsh-notifications)
[![publish workflow](https://github.com/haotian-lu-prog/dsh-notifications/actions/workflows/publish.yml/badge.svg)](https://github.com/haotian-lu-prog/dsh-notifications/actions/workflows/publish.yml)
[![license](https://img.shields.io/npm/l/dsh-notifications)](LICENSE)
[![node](https://img.shields.io/node/v/dsh-notifications)](package.json)
[![platform](https://img.shields.io/badge/platform-macOS%2013%2B-lightgrey)](#requirements)

`dsh-notifications` is a pure third-party DeepSeek Harness bundle for macOS. It adds one status item to the system menu bar: the Harness whale mark followed by the number of live Agents whose authoritative status is `running`. When the count is zero, only the whale remains visible. While subscribed events await user action, the number becomes their total and the letters identify the event types: `Q` means a question and `S` means an approval, so `2-QS` means one of each. Both subscriptions and their sweeping attention effect default to on. Click the item to focus the open Google Chrome tab for this Harness process; it never opens a new tab. Its Web Client half contributes a Notifications page to the built-in Settings panel, where the indicator and event subscriptions can be managed without restarting Harness.

## Features

- **Live session count** — the whale mark followed by the number of Agents whose authoritative status is `running`, and nothing but the whale when that number is zero.
- **Pending event markers** — the number switches to the total of subscribed events awaiting user action, with `Q` per pending question and `S` per pending approval.
- **Sweeping attention effect** — a highlight sweeps across the status item while a subscribed event is pending.
- **Click to focus** — clicking the item brings the Google Chrome tab already showing this Harness process to the front. It never opens a new tab.
- **Settings without a restart** — the indicator, both subscriptions, and the sweep can be toggled live from the built-in Settings panel.
- **Instant approval and question alerts** — when a tool asks for privileged execution, the sandbox needs a decision, the model asks a question, or a plan waits for review, a system notification appears and the menu bar item plays a sound, turns red and flashes until the event is handled.
- **Turn outcome alerts** — finished and failed turns notify on their own switches, kept apart from "the Harness needs you".
- **Keyword rules** — include/exclude filtering over the session title, tool names and reply text, with regular expressions and case sensitivity.
- **Permission and self-test** — grant notification permission and send a test notification from the settings page.

## Requirements

- macOS 13 or later, on Apple silicon or Intel
- Node.js `^22.19` or `>=24`
- DeepSeek Harness `0.1.7-rc.2` or `0.2.0-rc.1` (both verified), with a Web profile that provides `ctx.agents`, `ctx.webServer`, and the settings service
- Xcode Command Line Tools when building from this checkout; packed artifacts contain the universal native helper

## Install

Install the published package into a custom Web profile. The artifact contains no path dependency on a Harness checkout, and its `dsh.bundle` patch adds the Host and Client plugin rows automatically:

```sh
dsh --profile web-notifications --from-default-profile web --dump-config
dsh plugin --profile web-notifications add dsh-notifications
dsh --profile web-notifications
```

To install a locally built tarball instead:

```sh
npm test
npm pack
dsh plugin --profile web-notifications add ./dsh-notifications-1.0.0.tgz
```

Either artifact already contains the universal native helper, so no Xcode installation is needed. Installing from a Git checkout does need Xcode Command Line Tools: pnpm runs the package's `prepare` script, which compiles that helper, and blocks it until the key it prints is allowlisted under `allowBuilds` in the profile's `pnpm-workspace.yaml`.

Remove it from the same profile with:

```sh
dsh plugin --profile web-notifications remove dsh-notifications
```

## Settings

The Host half declares the four fields in its Cordis `Config` and marks every one live-editable (`.volatile()`); the profile entry id `dsh-notifications` is their settings namespace. The built-in Settings page in the browser half reads and writes those fields: a write goes through Harness's revision-fenced settings transport into the active profile's Cordis patch, and a change confined to these fields is committed into the running references without remounting the plugin, so it applies immediately without restarting Harness.

| Setting | Default | Effect |
| --- | --- | --- |
| `enabled` | `true` | Show the menu bar status item. Turning it off closes the native helper and awaits its exit. |
| `questionMarkers` | `true` | Count pending user questions and add a `Q` for each one. |
| `approvalMarkers` | `true` | Count pending approvals and add an `S` for each one. |
| `sweep` | `true` | Sweep the status item while a subscribed event is pending. |
| `sound` | `true` | Play a sound when an approval or a question needs you. |
| `flash` | `true` | Turn the item red and flash it while an event waits. |
| `browserNotifications` | `true` | Raise system notifications at all. |
| `notifyApproval` | `true` | Notify when an approval is needed — tool escalation and sandbox decisions, the easiest to miss. |
| `notifyQuestion` | `true` | Notify when an answer is needed. |
| `notifyPlanReview` | `false` | Notify when a plan waits for review. |
| `notifyCompleted` | `true` | Notify when a turn finishes. |
| `notifyError` | `true` | Notify when a turn fails. |
| `backgroundOnly` | `true` | Skip the banner while you are looking at that session in a focused page. |
| `requireInteraction` | `false` | Keep the notification on screen until dismissed. |
| `keywords` | empty | One rule per line: a bare word includes, `-` excludes, `re:` is a regular expression, `cs:` matches case. |

While at least one marker letter is visible, the number reports the subscribed pending events instead of the session count. Turning both subscriptions off restores the plain session count, and sweep then has nothing to animate.

## How counting works

The indicator counts the complete Agent activity interval, including consecutive queued turns and final checkpoints. It does not infer activity from open turns or individual messages. Existing live Agents are scanned when the plugin loads, so profile live reload does not reset an active count to zero.

## Build and verify

```sh
npm test
file native/dsh-notifications-menubar
```

The build compiles the AppKit helper for `arm64` and `x86_64`, then combines both slices into one universal executable. The tests cover Agent counting, live enable/disable ownership, the Host half's volatile Config references and their `loader/volatile-update` follow-up, the Client bundle's reads and switch writes through `ctx.configForms`, and an AppKit probe that loads the packaged whale SVG without creating a status item.

## Troubleshooting

- **`dsh plugin add` reports 404 right after a release.** A brand-new version takes a few minutes to appear on the registry read path; the tarball, `dist-tags`, and the search index usually resolve first. Retry shortly.
- **Installing through a mirror fails with `ERR_PNPM_FETCH_404`.** Mirrors such as npmmirror sync new versions on their own schedule. Add `--registry=https://registry.npmjs.org` to that one command, or wait for the mirror.
- **pnpm refuses or prompts for a just-released version.** That is pnpm's `minimumReleaseAge` delay. Allow the package (pnpm records it under `minimumReleaseAgeExclude`) or wait out the window.
- **Clicking the item does not bring Chrome forward.** The helper only focuses a tab that is already open on this Harness origin, and it never opens one; `no open Chrome tab matches the Harness Web client` on stderr means nothing matched. macOS also gates control of other applications behind Automation permission, so a denied prompt leaves the count working while focus stays silent.
- **The status item never appears.** Check that the plugin row survived install (this covers the Host half only; client-half failures surface in the browser console):

  ```sh
  dsh --profile web-notifications --dump-config | grep -A 2 dsh-notifications
  ```

## Lifecycle and privacy

Disabling the indicator closes and awaits the native helper; disabling a subscription removes only its letter and count from the status item; disabling sweep keeps all subscribed letters visible. Enabling the indicator starts a new helper and immediately publishes the current settings and counts. The plugin listens only to `agent/status`, `agent/disposed`, `user-questions/request`, and `approval/request`. It sends the native helper non-negative aggregate session and subscribed-event counts, marker letters, and the sweeping preference over stdin; it sends no session IDs, prompts, model output, credentials, or file paths. Unloading the plugin removes all listeners, asks the helper to quit, and waits for the process to exit, escalating to termination only if graceful shutdown stalls.

## Relationship to upstream dsh-notify

This repository is a community fork of [linbin-mk/dsh-notify](https://github.com/linbin-mk/dsh-notify), based on upstream `0.4.0`. Differences from upstream:

- The package name is `dsh-notifications` instead of `@linbin-mk/dsh-notify`; the profile entry id, client module id, settings namespace, and native helper name were aligned with it (package name and client module id agreeing is exactly the shape Harness expects when it keys the client module table).
- Peer dependencies are widened to `^0.1.7-rc.2 || ^0.2.0-rc.1`, so both DSH `0.1.7-rc.2` and `0.2.0-rc.1` install directly with no exact-version exemption. Between those two releases, every `@deepseek-ai/*` package this plugin touches is unchanged apart from one type-only re-export added by `dsh-api-remotes`.
- Versioning restarts at `1.0.0`, independent of the upstream version line.

Behaviour matches upstream. Upstream authorship and license terms are recorded in `LICENSE` and `NOTICE`.

## License

MIT — see `LICENSE`.

The original implementation is copyright linbin-mk; modifications and redistribution in this fork are copyright Haotian Lu.

The whale outline in `native/whale.svg` is DeepSeek Harness's MIT-licensed `FishLogo` asset, reproduced unmodified; `NOTICE` carries the upstream copyright and license text. As a macOS template image it appears black in the light menu bar and automatically changes contrast in dark appearances.
