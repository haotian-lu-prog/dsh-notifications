// The settings page's stylesheet.
// Fragment: concatenated into the bundle; no imports or exports.

/** Plugin-scoped style element id, also used as the dedupe key. */
const NOTIFY_STYLE_ID = 'dsh-notifications/client.css'

/** Install the stylesheet once per document. */
function adoptStyles() {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(NOTIFY_STYLE_ID)}]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-notifications'
  tag.dataset.pluginCss = NOTIFY_STYLE_ID
  tag.textContent = `
    .dshNotifySection{box-sizing:border-box;max-width:720px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:16px}
    .dshNotifyHeading{margin:0;font-size:18px;font-weight:600;line-height:28px}
    .dshNotifyIntro{margin:0;color:var(--dsw-alias-label-secondary);font-size:14px;line-height:22px}
    .dshNotifyGroup{display:flex;flex-direction:column;gap:10px}
    .dshNotifyGroupTitle{margin:0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}
    .dshNotifyCard{display:flex;align-items:center;gap:24px;padding:18px 20px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-1)}
    .dshNotifyChildCard{margin-left:24px;border-left:3px solid var(--dsw-alias-border-l2)}
    .dshNotifySubscriptions{display:flex;flex-wrap:wrap;gap:14px 20px}
    .dshNotifyCheckbox{display:inline-flex;align-items:center;gap:7px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;cursor:pointer}
    .dshNotifyCheckbox input{width:16px;height:16px;margin:0;accent-color:var(--dsw-alias-brand-primary)}
    .dshNotifyCheckbox:has(input:disabled){color:var(--dsw-alias-label-secondary);cursor:not-allowed;opacity:.6}
    .dshNotifyCopy{min-width:0;display:flex;flex:1;flex-direction:column;gap:3px}
    .dshNotifyLabel{font-size:14px;font-weight:500;line-height:22px}
    .dshNotifyDescription,.dshNotifyStatus{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
    .dshNotifySwitch{box-sizing:border-box;position:relative;width:44px;height:24px;flex:none;padding:2px;border:0;border-radius:12px;background:var(--dsw-alias-border-l3);cursor:pointer;transition:background .15s ease}
    .dshNotifySwitch[aria-checked=true]{background:var(--dsw-alias-brand-primary)}
    .dshNotifySwitch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
    .dshNotifySwitch:disabled{cursor:not-allowed;opacity:.5}
    .dshNotifyKnob{display:block;width:20px;height:20px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground);box-shadow:0 1px 3px rgba(0,0,0,.22);transition:transform .15s ease}
    .dshNotifySwitch[aria-checked=true] .dshNotifyKnob{transform:translateX(20px)}
    .dshNotifyField{box-sizing:border-box;width:100%;min-height:88px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:18px;resize:vertical}
    .dshNotifyField:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
    .dshNotifyField:disabled{opacity:.6;cursor:not-allowed}
    .dshNotifyActions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .dshNotifyButton{appearance:none;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;padding:6px 12px;cursor:pointer}
    .dshNotifyButton:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
    .dshNotifyButton:disabled{opacity:.5;cursor:not-allowed}
    .dshNotifyHint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
  `
  document.head.appendChild(tag)
}
