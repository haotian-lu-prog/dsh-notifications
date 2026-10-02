// The Settings page: one section covering the native indicator, the system
// notifications, and the keyword rules that gate them.
//
// Fragment: concatenated into the bundle. `require` here is the Harness client
// module loader's require, in scope inside the plugin factory.
const { jsx, jsxs } = require('react/jsx-runtime')
const React = require('react')

/** One label + description + switch row. */
function NotifyRow({ label, description, checked, disabled, onClick, ariaLabel, child = false }) {
  return jsxs('div', {
    className: `dshNotifyCard${child ? ' dshNotifyChildCard' : ''}`,
    children: [
      jsxs('div', {
        className: 'dshNotifyCopy',
        children: [
          jsx('div', { className: 'dshNotifyLabel', children: label }),
          description === undefined ? null : jsx('p', { className: 'dshNotifyDescription', children: description }),
        ],
      }),
      jsx('button', {
        type: 'button',
        className: 'dshNotifySwitch',
        role: 'switch',
        'aria-checked': checked,
        'aria-label': ariaLabel ?? label,
        disabled,
        onClick,
        children: jsx('span', { className: 'dshNotifyKnob', 'aria-hidden': true }),
      }),
    ],
  })
}

/** One labelled group of rows. */
function NotifyGroup({ title, children }) {
  return jsxs('div', {
    className: 'dshNotifyGroup',
    children: [
      jsx('h3', { className: 'dshNotifyGroupTitle', children: title }),
      ...children,
    ],
  })
}

/** The keyboard/state summary for a settings snapshot. */
function statusText(snapshot, enabled, t) {
  if (snapshot.status === 'loading') return t('loading')
  // Memory mode keeps a remote browser's writes process-local, so it must not
  // present the form as a persisted setting.
  if (snapshot.status !== 'ready' || snapshot.mode === 'memory') return t('unavailable')
  if (!snapshot.writable) return t('readOnly')
  return enabled ? t('enabled') : t('disabled')
}

/** The macOS menu bar half of the settings. */
function NativeGroup({ t, values, disabled, status, set }) {
  const on = values.enabled !== false
  const editable = disabled === false
  return jsx(NotifyGroup, {
    title: t('groupNative'),
    children: [
      jsx(NotifyRow, {
        label: t('label'), description: t('description'), checked: on,
        disabled: !editable, onClick: () => set({ enabled: !on }), ariaLabel: t('toggle'),
      }),
      jsxs('div', {
        className: 'dshNotifyCard dshNotifyChildCard',
        children: [
          jsxs('div', {
            className: 'dshNotifyCopy',
            children: [
              jsx('div', { className: 'dshNotifyLabel', children: t('subscriptionLabel') }),
              jsx('p', { className: 'dshNotifyDescription', children: t('subscriptionDescription') }),
              jsxs('div', {
                className: 'dshNotifySubscriptions',
                children: [
                  jsxs('label', {
                    className: 'dshNotifyCheckbox',
                    children: [
                      jsx('input', {
                        type: 'checkbox',
                        checked: values.questionMarkers !== false,
                        disabled: !editable || !on,
                        'aria-label': t('questionToggle'),
                        onChange: () => set({ questionMarkers: values.questionMarkers === false }),
                      }),
                      t('questionSubscription'),
                    ],
                  }),
                  jsxs('label', {
                    className: 'dshNotifyCheckbox',
                    children: [
                      jsx('input', {
                        type: 'checkbox',
                        checked: values.approvalMarkers !== false,
                        disabled: !editable || !on,
                        'aria-label': t('approvalToggle'),
                        onChange: () => set({ approvalMarkers: values.approvalMarkers === false }),
                      }),
                      t('approvalSubscription'),
                    ],
                  }),
                ],
              }),
              jsx('p', { className: 'dshNotifyStatus', 'aria-live': 'polite', children: statusText(status, on, t) }),
            ],
          }),
        ],
      }),
      jsx(NotifyRow, {
        label: t('soundLabel'), description: t('soundDescription'), checked: values.sound !== false,
        disabled: !editable || !on, onClick: () => set({ sound: values.sound === false }), ariaLabel: t('soundLabel'),
      }),
      jsx(NotifyRow, {
        label: t('flashLabel'), description: t('flashDescription'), checked: values.flash !== false,
        disabled: !editable || !on, onClick: () => set({ flash: values.flash === false }), ariaLabel: t('flashLabel'),
      }),
      jsx(NotifyRow, {
        label: t('sweepLabel'), description: t('sweepDescription'), checked: values.sweep !== false,
        disabled: !editable || !on || (values.questionMarkers === false && values.approvalMarkers === false),
        onClick: () => set({ sweep: values.sweep === false }), ariaLabel: t('sweepToggle'), child: true,
      }),
    ],
  })
}

/** The system-notification half of the settings. */
function BrowserGroup({ t, values, disabled, permission, requestPermission, sendTest, set }) {
  const editable = disabled === false
  const on = values.browserNotifications !== false
  const row = (field, descriptionKey) => jsx(NotifyRow, {
    label: t(field),
    description: t(descriptionKey),
    checked: values[field] !== false,
    disabled: !editable || !on,
    onClick: () => set({ [field]: values[field] === false }),
    ariaLabel: t(field),
  })
  const permissionLabel = permission === 'granted'
    ? t('permissionGranted')
    : permission === 'denied' || permission === 'default' ? t('permissionDenied') : t('permissionUnavailable')
  return jsx(NotifyGroup, {
    title: t('groupBrowser'),
    children: [
      jsx(NotifyRow, {
        label: t('browserLabel'), description: t('browserDescription'), checked: on,
        disabled: !editable, onClick: () => set({ browserNotifications: !on }), ariaLabel: t('browserLabel'),
      }),
      row('notifyApproval', 'notifyApprovalDescription'),
      row('notifyQuestion', 'notifyQuestionDescription'),
      row('notifyPlanReview', 'notifyPlanReviewDescription'),
      row('notifyCompleted', 'notifyCompletedDescription'),
      row('notifyError', 'notifyErrorDescription'),
      jsx(NotifyRow, {
        label: t('backgroundOnly'), description: t('backgroundOnlyDescription'), checked: values.backgroundOnly !== false,
        disabled: !editable || !on, onClick: () => set({ backgroundOnly: values.backgroundOnly === false }), ariaLabel: t('backgroundOnly'),
      }),
      jsx(NotifyRow, {
        label: t('requireInteraction'), description: t('requireInteractionDescription'), checked: values.requireInteraction === true,
        disabled: !editable || !on, onClick: () => set({ requireInteraction: values.requireInteraction !== true }), ariaLabel: t('requireInteraction'),
      }),
      jsxs('div', {
        className: 'dshNotifyCard',
        children: [
          jsxs('div', {
            className: 'dshNotifyCopy',
            children: [
              jsx('div', { className: 'dshNotifyLabel', children: permissionLabel }),
              jsx('p', { className: 'dshNotifyDescription', children: t('browserDescription') }),
            ],
          }),
          jsxs('div', {
            className: 'dshNotifyActions',
            children: [
              jsx('button', {
                type: 'button', className: 'dshNotifyButton',
                disabled: permission === 'granted' || permission === 'unsupported',
                onClick: () => { Promise.resolve(requestPermission()).catch(() => {}) },
                children: t('grant'),
              }),
              jsx('button', {
                type: 'button', className: 'dshNotifyButton',
                disabled: permission !== 'granted',
                onClick: () => { sendTest() },
                children: t('test'),
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

/** The keyword-rule editor. */
function RulesGroup({ t, values, disabled, set }) {
  const editable = disabled === false
  return jsx(NotifyGroup, {
    title: t('groupRules'),
    children: [
      jsxs('div', {
        className: 'dshNotifyCard',
        children: [
          jsxs('div', {
            className: 'dshNotifyCopy',
            children: [
              jsx('div', { className: 'dshNotifyLabel', children: t('keywordsLabel') }),
              jsx('p', { className: 'dshNotifyDescription', children: t('keywordsDescription') }),
              jsx('textarea', {
                className: 'dshNotifyField',
                value: typeof values.keywords === 'string' ? values.keywords : '',
                placeholder: t('keywordsPlaceholder'),
                disabled: !editable,
                spellCheck: false,
                'aria-label': t('keywordsLabel'),
                onChange: event => set({ keywords: event.target.value }),
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

/** The section the Harness mounts under Settings → Notifications. */
function NotifySettingsSection({ t, useNotifySettings, set, requestPermission, sendTest }) {
  const snapshot = useNotifySettings(value => value)
  const values = resolveSettings(snapshot.value)
  const editable = snapshot.status === 'ready' && snapshot.writable && snapshot.mode === 'host'
  const disabled = !editable
  // The controls are disabled, but the write path is guarded too: a disabled
  // attribute only stops the browser's own event dispatch, and a write into a
  // read-only or process-local form must never be attempted from this page.
  const write = patch => { if (editable) set(patch) }
  const [permission, setPermission] = React.useState(() => (
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  ))
  return jsxs('section', {
    className: 'dshNotifySection',
    children: [
      jsx('h2', { className: 'dshNotifyHeading', children: t('title') }),
      jsx('p', { className: 'dshNotifyIntro', children: t('intro') }),
      jsx(NativeGroup, { t, values, disabled, status: snapshot, set: write }),
      jsx(BrowserGroup, {
        t, values, disabled, permission, set: write,
        requestPermission: () => Promise.resolve(requestPermission()).then(
          next => { setPermission(next ?? 'denied') },
          () => { setPermission('denied') },
        ),
        sendTest: () => {
          const result = sendTest()
          if (result?.ok === false) console.warn(`[dsh-notifications] test notification failed: ${result.message}`)
        },
      }),
      jsx(RulesGroup, { t, values, disabled, set: write }),
    ],
  })
}
