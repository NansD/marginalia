import { LocalAdapter } from '@/shared/storage/LocalAdapter';
import { ensureShortcutBindings } from '@/shared/runtime/shortcuts';
import { isRuntimeMessage, type RuntimeMessage } from '@/shared/runtime/messages';

const adapter = new LocalAdapter();
const tabCanonicalUrls = new Map<number, string>();

const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const sendMessageToTab = async (tabId: number, message: RuntimeMessage): Promise<unknown> =>
  new Promise<unknown>((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));

        return;
      }

      resolve(response);
    });
  });

const queryActiveTab = async (): Promise<chrome.tabs.Tab | undefined> =>
  new Promise<chrome.tabs.Tab | undefined>((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });

const setBadgeText = async (tabId: number, text: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    chrome.action.setBadgeText({ tabId, text }, () => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));

        return;
      }

      resolve();
    });
  });

const setBadgeBackgroundColor = async (tabId: number): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    chrome.action.setBadgeBackgroundColor({ color: '#4f46e5', tabId }, () => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));

        return;
      }

      resolve();
    });
  });

const updateBadgeForTab = async (tabId: number, canonicalUrl?: string): Promise<void> => {
  if (!canonicalUrl) {
    await setBadgeText(tabId, '');

    return;
  }

  const annotations = await adapter.getAnnotations(canonicalUrl);

  if (annotations.length === 0) {
    await setBadgeText(tabId, '');

    return;
  }

  await setBadgeBackgroundColor(tabId);
  await setBadgeText(tabId, `${Math.min(annotations.length, 99)}`);
};

const requestPageState = async (tabId: number): Promise<void> => {
  try {
    const response = await sendMessageToTab(tabId, { kind: 'request-page-state' });

    if (
      response &&
      typeof response === 'object' &&
      'canonicalUrl' in response &&
      typeof response.canonicalUrl === 'string'
    ) {
      tabCanonicalUrls.set(tabId, response.canonicalUrl);
      await updateBadgeForTab(tabId, response.canonicalUrl);
    }
  } catch (error) {
    console.error(`Marginalia failed to read page state for tab ${tabId}: ${describeError(error)}`);
    await updateBadgeForTab(tabId);
  }
};

const toggleTabAnnotationMode = async (tabId: number): Promise<void> => {
  try {
    await sendMessageToTab(tabId, { kind: 'toggle-annotation-mode' });
  } catch (error) {
    console.error(`Marginalia failed to toggle annotation mode for tab ${tabId}: ${describeError(error)}`);
    await updateBadgeForTab(tabId);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void ensureShortcutBindings();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureShortcutBindings();
});

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (!isRuntimeMessage(message)) {
    return;
  }

  const tabId = sender.tab?.id;

  if (tabId === undefined) {
    return;
  }

  switch (message.kind) {
    case 'annotations-changed':
      if (tabCanonicalUrls.get(tabId) === message.canonicalUrl) {
        void updateBadgeForTab(tabId, message.canonicalUrl);
      }
      break;
    case 'page-state-changed':
      tabCanonicalUrls.set(tabId, message.canonicalUrl);
      void updateBadgeForTab(tabId, message.canonicalUrl);
      break;
    default:
      break;
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) {
    return;
  }

  void toggleTabAnnotationMode(tab.id);
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-annotation-mode') {
    return;
  }

  void queryActiveTab().then((tab) => {
    if (tab?.id === undefined) {
      return;
    }

    void toggleTabAnnotationMode(tab.id);
  });
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void requestPageState(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    void requestPageState(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabCanonicalUrls.delete(tabId);
});

export {};
