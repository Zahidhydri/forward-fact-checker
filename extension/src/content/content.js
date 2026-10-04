/**
 * Forward Fact-Checker - WhatsApp Web Content Script
 * Observes WhatsApp Web chat stream and injects AI verification buttons.
 */

const INJECT_BUTTON_CLASS = "ffc-verify-btn";
const PROCESSED_ATTR = "data-ffc-processed";
let isAutoCheckEnabled = true;

// Track button that was recently clicked for quick badge update
let lastClickedButton = null;

// Check auto-check status from chrome storage
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(['autoCheckEnabled'], (res) => {
    if (res && res.autoCheckEnabled === false) {
      isAutoCheckEnabled = false;
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoCheckEnabled) {
      isAutoCheckEnabled = changes.autoCheckEnabled.newValue !== false;
      if (!isAutoCheckEnabled) {
        document.querySelectorAll(`.${INJECT_BUTTON_CLASS}`).forEach(el => el.remove());
      } else {
        injectVerifyButtons();
      }
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
  if (/^(check claim|verify|checking\.\.\.|fact-check|scam \/ fake|misleading|verified true|unverified)$/i.test(t)) return true;
  return false;
}

function cleanWhatsAppText(text) {
  if (!text) return "";
  let cleaned = text.trim();
  // Strip out "Forwarded" prefix if present at start
  cleaned = cleaned.replace(/^forwarded(\s+many\s+times)?\s*/i, '');
  // Strip out trailing timestamp if present on newline
  cleaned = cleaned.replace(/\n\s*\d{1,2}:\d{2}(\s*(AM|PM|am|pm))?$/i, '');
  return cleaned.trim();
}

function findMessageText(row) {
  // 1. WhatsApp Web standard copyable text inside selectable container:
  const primaryCandidates = [
    row.querySelector('.selectable-text.copyable-text'),
    row.querySelector('span._ao3e'),
    row.querySelector('.selectable-text')
  ];

  for (const el of primaryCandidates) {
    if (el) {
      const clone = el.cloneNode(true);
      clone.querySelectorAll(`.${INJECT_BUTTON_CLASS}`).forEach(b => b.remove());
      const raw = clone.innerText || clone.textContent || "";
      if (raw && !isSystemNoise(raw)) {
        return cleanWhatsAppText(raw);
      }
    }
  }

  // 2. Look inside .copyable-text container
  const copyableDiv = row.querySelector('.copyable-text');
  if (copyableDiv) {
    const clone = copyableDiv.cloneNode(true);
    clone.querySelectorAll(`.${INJECT_BUTTON_CLASS}, [data-testid="msg-meta"], [data-icon], time`).forEach(b => b.remove());
    const raw = clone.innerText || clone.textContent || "";
    if (raw && !isSystemNoise(raw)) {
      return cleanWhatsAppText(raw);
    }
  }

  // 3. Fallback: inspect direct child text elements while filtering noise
  const spans = row.querySelectorAll('span[dir="ltr"], span[dir="auto"]');
  for (const span of spans) {
    if (span.closest(`.${INJECT_BUTTON_CLASS}`)) continue;
    if (span.closest('[data-testid="msg-meta"]')) continue;
    if (span.closest('[data-testid="author"]')) continue;

    const raw = span.innerText || span.textContent || "";
    if (raw && raw.length > 3 && !isSystemNoise(raw)) {
      return cleanWhatsAppText(raw);
    }
  }

  // 4. Ultimate fallback: full bubble text minus button and metadata
  const bubble = row.querySelector('[data-id]') || row;
  if (bubble) {
    const clone = bubble.cloneNode(true);
    clone.querySelectorAll(`.${INJECT_BUTTON_CLASS}, [data-testid="msg-meta"], [data-icon], time`).forEach(b => b.remove());
    const raw = clone.innerText || clone.textContent || "";
    if (raw && !isSystemNoise(raw)) {
      return cleanWhatsAppText(raw);
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

// Inline SVG Icons
const ICONS = {
  checkClaim: `
    <svg class="ffc-shield-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      <circle cx="12" cy="12" r="4"/>
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

function injectVerifyButtons() {
  if (!isAutoCheckEnabled) return;

  const messageRows = document.querySelectorAll(
    `div[data-testid="msg-container"]:not([${PROCESSED_ATTR}]), ` +
    `div[role="row"]:not([${PROCESSED_ATTR}]), ` +
    `.message-in:not([${PROCESSED_ATTR}]), ` +
    `.message-out:not([${PROCESSED_ATTR}])`
  );

  messageRows.forEach((row) => {
    row.setAttribute(PROCESSED_ATTR, "true");

    const btn = document.createElement("button");
    btn.className = INJECT_BUTTON_CLASS;
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", "Check claim with AI Fact-Checker");
    btn.innerHTML = `${ICONS.checkClaim}<span>Check Claim</span>`;
    btn.title = "Click to fact-check this claim with AI";

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Dynamically extract text AT THE MOMENT OF CLICK!
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
      btn.setAttribute("data-ffc-checked-text", messageText);
      btn.classList.add("ffc-btn-checking");
      btn.innerHTML = `${ICONS.spinner}<span>Checking...</span>`;

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
    });

    const computedPosition = window.getComputedStyle(row).position;
    if (!computedPosition || computedPosition === "static") {
      row.style.position = "relative";
    }

    row.appendChild(btn);
  });
}

// ──────────────────────────────────────────────────────────
// Listen for Live Verdict Results Broadcast from Side Panel
// ──────────────────────────────────────────────────────────
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "UPDATE_WHATSAPP_BADGE" && request.verdict) {
      const verdict = request.verdict;
      const status = (verdict.status || verdict.label || 'UNVERIFIED').toUpperCase();

      // Find matching button: either lastClickedButton or matching data-ffc-checked-text
      let targetBtn = lastClickedButton;
      if (!targetBtn && request.text) {
        const snippet = request.text.slice(0, 30);
        targetBtn = document.querySelector(`button[data-ffc-checked-text*="${CSS.escape(snippet)}"]`);
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
  if (!isAutoCheckEnabled) return;
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

console.log("🛡️ Forward Fact-Checker: WhatsApp Web DOM observer activated.");
