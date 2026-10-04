/**
 * Forward Fact-Checker - Background Service Worker (Manifest V3)
 */

// 1. Create context menu for right-click on any webpage or image
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "factCheckSelection",
    title: "🛡️ Fact-check this claim with AI",
    contexts: ["selection", "image", "link"]
  });

  // Enable side panel to open on action toolbar icon click
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err) => console.error("setPanelBehavior error:", err));
  }
});

// Helper to open sidepanel and dispatch verification payload
async function openSidePanelAndVerify(tabId, payload) {
  try {
    // Persist pending payload in local storage so side panel picks it up upon mounting
    await chrome.storage.local.set({
      latestVerification: {
        payload,
        timestamp: Date.now()
      }
    });

    if (chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId });
    }

    // Give sidepanel React app a moment to mount and register listener
    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: "START_VERIFICATION",
        data: payload
      }).catch(() => {
        // Suppress error if sidepanel is still initializing (it will read storage)
      });
    }, 400);

    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: "START_VERIFICATION",
        data: payload
      }).catch(() => {});
    }, 1000);
  } catch (err) {
    console.error("Failed to open side panel:", err);
  }
}

// 2. Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "factCheckSelection") {
    let payload = null;

    if (info.selectionText && info.selectionText.trim().length > 0) {
      payload = {
        type: "TEXT",
        content: info.selectionText.trim(),
        sourceUrl: info.pageUrl || tab?.url
      };
    } else if (info.srcUrl) {
      payload = {
        type: "IMAGE",
        url: info.srcUrl,
        content: `Image source: ${info.srcUrl}`,
        sourceUrl: info.pageUrl || tab?.url
      };
    } else if (info.linkUrl) {
      payload = {
        type: "LINK",
        content: info.linkUrl,
        sourceUrl: info.pageUrl || tab?.url
      };
    }

    if (payload && tab?.id) {
      await openSidePanelAndVerify(tab.id, payload);
    }
  }
});

// 3. Listen to messages from content.js (WhatsApp Web "Verify" button) & Side Panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "VERIFY_FROM_WHATSAPP") {
    const tabId = sender.tab?.id;
    const payload = {
      type: request.mediaType || "TEXT",
      content: request.text || request.content,
      mediaUrl: request.mediaUrl || null,
      timestamp: Date.now(),
      senderName: request.senderName || "WhatsApp Forward"
    };

    if (tabId) {
      openSidePanelAndVerify(tabId, payload);
      sendResponse({ status: "opening_panel", payload });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          openSidePanelAndVerify(tabs[0].id, payload);
        }
      });
      sendResponse({ status: "locating_active_tab" });
    }
    return true;
  }

  if (request.action === "GET_LATEST_VERIFICATION") {
    chrome.storage.local.get(["latestVerification"], (result) => {
      sendResponse(result.latestVerification || null);
    });
    return true; // Keep channel open for async response
  }

  return true;
});
