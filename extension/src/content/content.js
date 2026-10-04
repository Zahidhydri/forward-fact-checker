/**
 * Forward Fact-Checker - WhatsApp Web Content Script
 * Injects instant "Check Claim" buttons on WhatsApp Web message bubbles to transfer text into Sidepanel.
 */

const INJECT_BUTTON_CLASS = "ffc-verify-btn";
const PROCESSED_ATTR = "data-ffc-processed";
const AUTO_CHECKED_ATTR = "data-ffc-auto-checked";

// Auto check is ON by default
let isAutoCheckEnabled = true;

// Track button that was recently clicked for quick badge update
let lastClickedButton = null;

// Track safety timeouts for active checking buttons
const buttonSafetyTimeouts = new WeakMap();

// Sync auto-check status from chrome storage
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(['autoCheckEnabled'], (res) => {
    if (res && res.autoCheckEnabled === false) {
      isAutoCheckEnabled = false;
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoCheckEnabled) {
      isAutoCheckEnabled = changes.autoCheckEnabled.newValue !== false;
    }
  });
}

// Helper to determine if a string is just system/noise text
function isSystemNoise(text) {
  if (!text) return true;
  const t = text.trim();
  if (t.length <= 1) return true;
  // Time stamps like "12:30", "12:30 PM", "6:15 am"
  if (/^\d{1,2}:\d{2}(\s*(AM|PM|am|pm))?$/i.test(t)) return true;
  // System labels
  if (/^(forwarded|forwarded many times|edited|read|delivered|today|yesterday)$/i.test(t)) return true;
  // Extension own button text
  if (/^(check claim|verify|checking\.\.\.|sent to panel|fact-check|scam \/ fake|misleading|verified true|unverified|no claim found)$/i.test(t)) return true;
  return false;
}

function cleanWhatsAppText(text) {
  if (!text) return "";
  let cleaned = text.trim();
  // Remove extension button text if present inside string
  cleaned = cleaned.replace(/check claim|checking\.\.\.|sent to panel|no claim found/gi, '');
  // Strip out "Forwarded" prefix if present at start
  cleaned = cleaned.replace(/^forwarded(\s+many\s+times)?\s*/i, '');
  // Strip out trailing timestamp if present on newline (e.g. 12:34 PM)
  cleaned = cleaned.replace(/\n?\s*\d{1,2}:\d{2}(\s*(AM|PM|am|pm))?$/i, '');
  return cleaned.trim();
}

function findMessageText(row) {
  if (!row) return "";

  // 1. WhatsApp Web standard copyable text inside selectable container:
  const primaryCandidates = [
    row.querySelector('.selectable-text.copyable-text'),
    row.querySelector('span._ao3e'),
    row.querySelector('.selectable-text'),
    row.querySelector('span.copyable-text'),
    row.querySelector('.copyable-text'),
    row.classList?.contains('copyable-text') ? row : null,
    row
  ];

  for (const el of primaryCandidates) {
    if (!el) continue;
    const clone = el.cloneNode(true);
    clone.querySelectorAll(`.${INJECT_BUTTON_CLASS}, [data-testid="msg-meta"], [data-icon], time`).forEach(b => b.remove());
    let raw = clone.innerText || clone.textContent || "";
    raw = cleanWhatsAppText(raw);
    if (raw && !isSystemNoise(raw)) {
      return raw;
    }
  }

  // 2. Fallback: inspect parent bubble container
  const parentBubble = row.closest('div[data-testid="msg-container"], div.message-in, div.message-out, div[data-id]');
  if (parentBubble && parentBubble !== row) {
    const clone = parentBubble.cloneNode(true);
    clone.querySelectorAll(`.${INJECT_BUTTON_CLASS}, [data-testid="msg-meta"], [data-icon], time`).forEach(b => b.remove());
    let raw = cleanWhatsAppText(clone.innerText || clone.textContent || "");
    if (raw && !isSystemNoise(raw)) {
      return raw;
    }
  }

  return "";
}

function findMessageMedia(row) {
  const img = row.querySelector('img[src*="blob:"], img[src*="http"]');
  if (img && img.src && !img.src.includes('avatar') && !img.src.includes('emoji')) {
    return { type: 'IMAGE', url: img.src };
  }
  return null;
}

// Check if a message container is a forwarded message
function isForwardedMessage(row) {
  if (row.querySelector('[data-testid="forwarded"]') || row.querySelector('.forwarded')) {
    return true;
  }
  const rawText = (row.innerText || row.textContent || '').toLowerCase();
  return rawText.includes('forwarded') || rawText.includes('forwarded many times');
}

// Inline SVG Icons
const ICONS = {
  checkClaim: `
    <svg class="ffc-shield-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      <circle cx="12" cy="12" r="4"/>
    </svg>`,
  sent: `
    <svg class="ffc-shield-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>`,
  spinner: `
    <svg class="ffc-shield-icon ffc-spin" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25" stroke="currentColor"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"/>
    </svg>`,
  scam: `
    <svg class="ffc-shield-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>`,
  misleading: `
    <svg class="ffc-shield-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`,
  verified: `
    <svg class="ffc-shield-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>`,
  unverified: `
    <svg class="ffc-shield-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`
};

function triggerVerificationForButton(btn, row) {
  const messageText = findMessageText(row);
  const mediaInfo = findMessageMedia(row);

  if (!messageText && !mediaInfo) {
    btn.innerHTML = `<span>No Claim Found</span>`;
    setTimeout(() => {
      btn.innerHTML = `${ICONS.checkClaim}<span>Check Claim</span>`;
    }, 1500);
    return;
  }

  lastClickedButton = btn;
  btn.setAttribute("data-ffc-checked-text", messageText || "Image Claim");

  // Show visual feedback "Sent to Panel ✓"
  btn.innerHTML = `${ICONS.sent}<span>Sent to Panel ✓</span>`;
  btn.style.opacity = "1";

  // Revert button text after 2 seconds
  setTimeout(() => {
    if (!btn.classList.contains("ffc-badge-scam") && 
        !btn.classList.contains("ffc-badge-misleading") && 
        !btn.classList.contains("ffc-badge-verified")) {
      btn.innerHTML = `${ICONS.checkClaim}<span>Check Claim</span>`;
    }
  }, 2200);

  const payload = {
    action: "VERIFY_FROM_WHATSAPP",
    text: messageText || "Image Claim",
    mediaType: mediaInfo ? mediaInfo.type : "TEXT",
    mediaUrl: mediaInfo ? mediaInfo.url : null
  };

  try {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        console.log("Forward Fact-Checker background listener:", chrome.runtime.lastError.message);
      }
    });
  } catch (err) {
    console.warn("Could not dispatch message to background worker:", err);
  }
}

function injectVerifyButtons() {
  // Always inject "Check Claim" button on WhatsApp Web bubbles so user can click to verify
  const messageRows = document.querySelectorAll(
    `div[data-pre-plain-text], ` +
    `div.copyable-text, ` +
    `div[data-testid="msg-container"], ` +
    `div.message-in, ` +
    `div.message-out, ` +
    `div[data-id^="true_"], ` +
    `div[data-id^="false_"]`
  );

  let autoCheckDelay = 300;

  messageRows.forEach((row) => {
    // Avoid double buttons in same row or parent bubble
    if (row.querySelector(`.${INJECT_BUTTON_CLASS}`) || row.classList.contains(INJECT_BUTTON_CLASS) || row.closest(`.${INJECT_BUTTON_CLASS}`)) {
      return;
    }

    row.setAttribute(PROCESSED_ATTR, "true");

    const btn = document.createElement("button");
    btn.className = INJECT_BUTTON_CLASS;
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", "Send claim to AI Fact-Checker panel");
    btn.innerHTML = `${ICONS.checkClaim}<span>Check Claim</span>`;
    btn.title = "Click to send this message to AI Fact-Checker panel";

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      triggerVerificationForButton(btn, row);
    });

    row.appendChild(btn);

    // Auto-check feature: ONLY auto-triggers if user explicitly turned auto-check ON in settings
    if (isAutoCheckEnabled && isForwardedMessage(row) && !row.hasAttribute(AUTO_CHECKED_ATTR)) {
      row.setAttribute(AUTO_CHECKED_ATTR, "true");
      setTimeout(() => {
        if (isAutoCheckEnabled && document.body.contains(btn)) {
          triggerVerificationForButton(btn, row);
        }
      }, autoCheckDelay);
      autoCheckDelay += 800; // Stagger requests
    }
  });
}

// ──────────────────────────────────────────────────────────
// Listen for Live Verdict Results Broadcast from Side Panel
// ──────────────────────────────────────────────────────────
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TOGGLE_AUTO_CHECK") {
      isAutoCheckEnabled = request.enabled === true;
      sendResponse({ status: "ok" });
      return true;
    }

    if (request.action === "UPDATE_WHATSAPP_BADGE" && request.verdict) {
      const verdict = request.verdict;
      const status = (verdict.status || verdict.label || 'UNVERIFIED').toUpperCase();

      let targetBtn = null;

      // 1. Try to match by text snippet
      if (request.text) {
        const textKey = request.text.trim();
        const snippet = textKey.slice(0, 20);
        const allBtns = Array.from(document.querySelectorAll(`.${INJECT_BUTTON_CLASS}`));
        targetBtn = allBtns.find(b => {
          const attr = (b.getAttribute("data-ffc-checked-text") || "").trim();
          return attr && (attr.includes(snippet) || textKey.includes(attr.slice(0, 15)));
        });
      }

      // 2. Fallback to lastClickedButton
      if (!targetBtn) {
        targetBtn = lastClickedButton;
      }

      if (targetBtn) {
        targetBtn.classList.remove("ffc-btn-checking", "ffc-badge-scam", "ffc-badge-fake", "ffc-badge-misleading", "ffc-badge-verified", "ffc-badge-unverified");

        if (status === 'SCAM' || status === 'FAKE' || status === 'FALSE') {
          targetBtn.classList.add("ffc-badge-scam");
          targetBtn.innerHTML = `${ICONS.scam}<span>🚨 Scam / Fake</span>`;
          targetBtn.title = "SCAM DETECTED: Click to view AI evidence report";
        } else if (status === 'MISLEADING') {
          targetBtn.classList.add("ffc-badge-misleading");
          targetBtn.innerHTML = `${ICONS.misleading}<span>⚠️ Misleading</span>`;
          targetBtn.title = "MISLEADING CLAIM: Click to view evidence breakdown";
        } else if (status === 'VERIFIED' || status === 'TRUE') {
          targetBtn.classList.add("ffc-badge-verified");
          targetBtn.innerHTML = `${ICONS.verified}<span>✅ Verified True</span>`;
          targetBtn.title = "VERIFIED: Information aligns with official records";
        } else {
          targetBtn.classList.add("ffc-badge-unverified");
          targetBtn.innerHTML = `${ICONS.unverified}<span>❓ Unverified</span>`;
          targetBtn.title = "UNVERIFIED: Click to view details";
        }
      }
    }
  });
}

let debounceTimer = null;
function debouncedInject() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    injectVerifyButtons();
  }, 120);
}

injectVerifyButtons();

const observer = new MutationObserver((mutations) => {
  let shouldRun = false;
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      shouldRun = true;
      break;
    }
  }
  if (shouldRun) {
    debouncedInject();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log("🛡️ Forward Fact-Checker: Click-to-panel text transfer activated.");
