import {
  type ContentScriptState,
  isRuntimeMessage,
  type RuntimeMessage,
} from '@/shared/runtime/messages';
import { ensureShortcutBindings, matchesShortcut, subscribeToShortcutBindings } from '@/shared/runtime/shortcuts';
import { canonicalizeUrl } from '@/shared/url/canonicalizeUrl';

import { observePageNavigation } from './navigationObserver';
import { createOverlayController } from './overlayController';

const overlayController = createOverlayController();

const shouldIgnoreKeyboardEvent = (event: KeyboardEvent): boolean => {
  const eventTarget = event.target;

  if (!(eventTarget instanceof HTMLElement)) {
    return false;
  }

  return (
    eventTarget.isContentEditable ||
    eventTarget instanceof HTMLInputElement ||
    eventTarget instanceof HTMLSelectElement ||
    eventTarget instanceof HTMLTextAreaElement
  );
};

const sendRuntimeMessage = async (message: RuntimeMessage): Promise<void> =>
  new Promise<void>((resolve) => {
    chrome.runtime.sendMessage(message, () => {
      resolve();
    });
  });

const bootstrapContentScript = async (): Promise<void> => {
  let annotationModeEnabled = false;
  let shortcutBindings = await ensureShortcutBindings();
  let canonicalUrl = canonicalizeUrl(window.location.href);

  const publishPageState = async (): Promise<void> => {
    await sendRuntimeMessage({
      kind: 'page-state-changed',
      annotationModeEnabled,
      canonicalUrl,
      pageTitle: document.title,
    });
  };

  const syncOverlay = (): void => {
    overlayController.setInteractive(annotationModeEnabled);
    overlayController.syncToDocument();
  };

  const getState = (): ContentScriptState => ({
    annotationModeEnabled,
    canonicalUrl,
  });

  const setAnnotationMode = async (enabled: boolean): Promise<ContentScriptState> => {
    annotationModeEnabled = enabled;
    syncOverlay();
    await publishPageState();

    return getState();
  };

  const toggleAnnotationMode = async (): Promise<ContentScriptState> => setAnnotationMode(!annotationModeEnabled);

  document.addEventListener(
    'keydown',
    (event) => {
      if (shouldIgnoreKeyboardEvent(event)) {
        return;
      }

      if (!matchesShortcut(shortcutBindings.toggleAnnotationMode, event)) {
        return;
      }

      event.preventDefault();
      void toggleAnnotationMode();
    },
    true,
  );

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isRuntimeMessage(message)) {
      return undefined;
    }

    const respondWithState = (promise: Promise<ContentScriptState>): true => {
      void promise.then((state) => {
        sendResponse(state);
      });

      return true;
    };

    switch (message.kind) {
      case 'request-page-state':
        sendResponse(getState());

        return false;
      case 'set-annotation-mode':
        return respondWithState(setAnnotationMode(message.enabled));
      case 'toggle-annotation-mode':
        return respondWithState(toggleAnnotationMode());
      default:
        return undefined;
    }
  });

  observePageNavigation(({ canonicalUrl: nextCanonicalUrl }) => {
    canonicalUrl = nextCanonicalUrl;
    overlayController.syncToDocument();
    void publishPageState();
  });

  subscribeToShortcutBindings((nextBindings) => {
    shortcutBindings = nextBindings;
  });

  overlayController.syncToDocument();
  await publishPageState();
};

void bootstrapContentScript();

export {};
