import type { Annotation, RectangleAnnotationContent } from '@/shared/models/annotations';
import { LocalAdapter } from '@/shared/storage/LocalAdapter';
import {
  type ContentScriptState,
  isRuntimeMessage,
  type RuntimeMessage,
} from '@/shared/runtime/messages';
import {
  DEFAULT_SHORTCUT_BINDINGS,
  ensureShortcutBindings,
  matchesShortcut,
  subscribeToShortcutBindings,
} from '@/shared/runtime/shortcuts';
import { canonicalizeUrl } from '@/shared/url/canonicalizeUrl';

import { observePageNavigation } from './navigationObserver';
import { createOverlayController } from './overlayController';

const adapter = new LocalAdapter();

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

const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const createAnnotationId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const bootstrapContentScript = async (): Promise<void> => {
  let annotationModeEnabled = false;
  let annotations: Annotation[] = [];
  let shortcutBindings = DEFAULT_SHORTCUT_BINDINGS;
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
    overlayController.setAnnotations(annotations);
    overlayController.setInteractive(annotationModeEnabled);
    overlayController.syncToDocument();
  };

  const loadAnnotations = async (): Promise<void> => {
    annotations = await adapter.getAnnotations(canonicalUrl);
    overlayController.setAnnotations(annotations);
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

  const handleCreateAnnotation = async (content: RectangleAnnotationContent): Promise<void> => {
    const timestamp = new Date().toISOString();
    const annotation: Annotation = {
      id: createAnnotationId(),
      type: 'rectangle',
      createdAt: timestamp,
      updatedAt: timestamp,
      content,
    };

    const savedAnnotation = await adapter.saveAnnotation(canonicalUrl, annotation);

    annotations = [...annotations, savedAnnotation];
    overlayController.setAnnotations(annotations);
    await sendRuntimeMessage({ kind: 'annotations-changed', canonicalUrl });
  };

  const overlayController = createOverlayController(document, window, {
    onCreateAnnotation: (content) =>
      handleCreateAnnotation(content).catch((error: unknown) => {
        console.error(`Marginalia failed to save annotation: ${describeError(error)}`);
      }),
    onRequestDisable: async () => {
      await setAnnotationMode(false);
    },
  });

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
    void loadAnnotations()
      .then(() => {
        overlayController.syncToDocument();
        return publishPageState();
      })
      .catch((error: unknown) => {
        console.error(`Marginalia failed to refresh annotations after navigation: ${describeError(error)}`);
      });
  });

  subscribeToShortcutBindings((nextBindings) => {
    shortcutBindings = nextBindings;
  });

  shortcutBindings = await ensureShortcutBindings();
  await loadAnnotations();
  syncOverlay();
  await publishPageState();
};

void bootstrapContentScript();

export {};
