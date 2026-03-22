import type { Annotation, AnnotationContent } from '@/shared/models/annotations';
import { LocalAdapter } from '@/shared/storage/LocalAdapter';
import {
  type AnnotationCommand,
  type AnnotationTool,
  type ContentScriptState,
  isRuntimeMessage,
  type RuntimeMessage,
} from '@/shared/runtime/messages';
import {
  DEFAULT_SHORTCUT_BINDINGS,
  ensureShortcutBindings,
  findMatchingShortcutAction,
  SHORTCUT_DEFINITIONS,
  subscribeToShortcutBindings,
} from '@/shared/runtime/shortcuts';
import { canonicalizeUrl } from '@/shared/url/canonicalizeUrl';

import { CommandHistory } from './commandHistory';
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

const buildAnnotation = (content: AnnotationContent, timestamp: string): Annotation => {
  const baseAnnotation = {
    id: createAnnotationId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  switch (content.kind) {
    case 'rectangle':
      return { ...baseAnnotation, type: 'rectangle', content };
    case 'ellipse':
      return { ...baseAnnotation, type: 'ellipse', content };
    case 'text':
      return { ...baseAnnotation, type: 'text', content };
    case 'sticky-note':
      return { ...baseAnnotation, type: 'sticky-note', content };
    case 'connector':
      return { ...baseAnnotation, type: 'connector', content };
  }
};

const bootstrapContentScript = async (): Promise<void> => {
  let annotationModeEnabled = false;
  let annotations: Annotation[] = [];
  let shortcutBindings = DEFAULT_SHORTCUT_BINDINGS;
  let canonicalUrl = canonicalizeUrl(window.location.href);
  let activeTool: AnnotationTool = 'rectangle';
  let selectedAnnotationId: string | null = null;
  const commandHistory = new CommandHistory();

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
    overlayController.setActiveTool(activeTool);
    overlayController.setSelection(selectedAnnotationId);
    overlayController.setInteractive(annotationModeEnabled);
    overlayController.syncToDocument();
  };

  const loadAnnotations = async (): Promise<void> => {
    annotations = await adapter.getAnnotations(canonicalUrl);

    if (selectedAnnotationId && !annotations.some((annotation) => annotation.id === selectedAnnotationId)) {
      selectedAnnotationId = null;
    }

    overlayController.setAnnotations(annotations);
    overlayController.setSelection(selectedAnnotationId);
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

  const persistAnnotationsChanged = async (targetCanonicalUrl = canonicalUrl): Promise<void> => {
    syncOverlay();
    await sendRuntimeMessage({ kind: 'annotations-changed', canonicalUrl: targetCanonicalUrl });
  };

  const setActiveTool = (tool: AnnotationTool): ContentScriptState => {
    activeTool = tool;

    if (tool !== 'select') {
      selectedAnnotationId = null;
    }

    overlayController.setActiveTool(activeTool);
    overlayController.setSelection(selectedAnnotationId);

    return getState();
  };

  const handleAnnotationCommand = async (command: AnnotationCommand): Promise<ContentScriptState> => {
    switch (command) {
      case 'undo':
        await commandHistory.undo();
        syncOverlay();
        break;
      case 'redo':
        await commandHistory.redo();
        syncOverlay();
        break;
      case 'cancel-current-action':
        selectedAnnotationId = null;
        overlayController.runCommand(command);
        break;
    }

    return getState();
  };

  const handleCreateAnnotation = async (content: AnnotationContent): Promise<void> => {
    const timestamp = new Date().toISOString();
    const annotation = buildAnnotation(content, timestamp);
    const annotationCanonicalUrl = canonicalUrl;

    await commandHistory.execute({
      execute: async () => {
        const savedAnnotation = await adapter.saveAnnotation(annotationCanonicalUrl, annotation);
        annotations = annotations.filter((existingAnnotation) => existingAnnotation.id !== savedAnnotation.id);
        annotations = [...annotations, savedAnnotation];
        await persistAnnotationsChanged(annotationCanonicalUrl);
      },
      undo: async () => {
        await adapter.deleteAnnotation(annotationCanonicalUrl, annotation.id);
        annotations = annotations.filter((existingAnnotation) => existingAnnotation.id !== annotation.id);
        if (selectedAnnotationId === annotation.id) {
          selectedAnnotationId = null;
        }
        await persistAnnotationsChanged(annotationCanonicalUrl);
      },
    });
  };

  const overlayController = createOverlayController(document, window, {
    onCreateAnnotation: (content) =>
      handleCreateAnnotation(content).catch((error: unknown) => {
        console.error(`Marginalia failed to save annotation: ${describeError(error)}`);
      }),
    onRequestDisable: async () => {
      await setAnnotationMode(false);
    },
    onSelectTool: (tool) => {
      setActiveTool(tool);
    },
    onSelectionChange: (annotationId) => {
      selectedAnnotationId = annotationId;
    },
  });

  const toggleAnnotationMode = async (): Promise<ContentScriptState> => setAnnotationMode(!annotationModeEnabled);

  const dispatchRuntimeMessage = async (message: RuntimeMessage): Promise<ContentScriptState | undefined> => {
    switch (message.kind) {
      case 'request-page-state':
        return getState();
      case 'set-annotation-mode':
        return setAnnotationMode(message.enabled);
      case 'toggle-annotation-mode':
        return toggleAnnotationMode();
      case 'select-annotation-tool':
        return setActiveTool(message.tool);
      case 'run-annotation-command':
        return handleAnnotationCommand(message.command);
      default:
        return undefined;
    }
  };

  document.addEventListener(
    'keydown',
    (event) => {
      if (shouldIgnoreKeyboardEvent(event)) {
        return;
      }

      const matchedAction = findMatchingShortcutAction(shortcutBindings, event);

      if (!matchedAction) {
        return;
      }

      event.preventDefault();
      void dispatchRuntimeMessage(SHORTCUT_DEFINITIONS[matchedAction].runtimeMessage);
    },
    true,
  );

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isRuntimeMessage(message)) {
      return undefined;
    }

    if (message.kind === 'request-page-state') {
      sendResponse(getState());

      return false;
    }

    void dispatchRuntimeMessage(message).then((state) => {
      sendResponse(state);
    });

    return true;
  });

  observePageNavigation(({ canonicalUrl: nextCanonicalUrl }) => {
    canonicalUrl = nextCanonicalUrl;
    commandHistory.clear();
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
