/**
 * Forward Fact-Checker - WhatsApp Web Content Script
 * Observes WhatsApp Web chat stream and injects AI verification buttons.
 */

const INJECT_BUTTON_CLASS = "ffc-verify-btn";
const PROCESSED_ATTR = "data-ffc-processed";
let isAutoCheckEnabled = true;

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

function findMessageText(row) {
  const selectors = [
    '.selectable-text.copyable-text',
    '.selectable-text',
    'span._ao3e',
    'span[dir="ltr"]',
    'span[dir="auto"]'
  ];

  for (const sel of selectors) {
    const el = row.querySelector(sel);
    if (el && el.innerText && el.innerText.trim().length > 0) {
      return el.innerText.trim();
    }
  }

  const bubble = row.querySelector('[data-id]') || row;
  const rawText = bubble ? bubble.innerText : "";
  return rawText.trim();
}

function findMessageMedia(row) {
  const img = row.querySelector('img[src*="blob:"], img[src*="http"]');
  if (img && img.src && !img.src.includes('avatar') && !img.src.includes('emoji')) {
    return { type: 'IMAGE', url: img.src };
  }
  return null;
}

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

    const messageText = findMessageText(row);
    const mediaInfo = findMessageMedia(row);

    if (!messageText && !mediaInfo) return;
    if (row.querySelector(`.${INJECT_BUTTON_CLASS}`)) return;

    const btn = document.createElement("button");
    btn.className = INJECT_BUTTON_CLASS;
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", "Fact-check with AI");
    btn.innerHTML = `
      <svg class="ffc-shield-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
      <span>Verify</span>
    `;
    btn.title = "Verify claim & check for scams with AI Agent";

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      btn.classList.add("ffc-btn-clicked");
      setTimeout(() => btn.classList.remove("ffc-btn-clicked"), 400);

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
