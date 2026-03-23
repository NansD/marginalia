import {
  isCanvasAnnotation,
  type Annotation,
  type AnnotationContent,
  type CanvasAnnotation,
  type CanvasBounds,
} from '@/shared/models/annotations';
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
  shouldIgnoreKeyboardEventTarget,
  SHORTCUT_DEFINITIONS,
  subscribeToShortcutBindings,
} from '@/shared/runtime/shortcuts';
import { canonicalizeUrl } from '@/shared/url/canonicalizeUrl';

import { CommandHistory } from './commandHistory';
import { observePageNavigation } from './navigationObserver';
import { createOverlayController } from './overlayController';

const adapter = new LocalAdapter();

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
    case 'circle':
      return { ...baseAnnotation, type: 'circle', content };
    case 'text':
      return { ...baseAnnotation, type: 'text', content };
    case 'sticky-note':
      return { ...baseAnnotation, type: 'sticky-note', content };
    case 'connector':
      return { ...baseAnnotation, type: 'connector', content };
  }
};

const getDeletedAnnotationsForSelection = (
  currentAnnotations: Annotation[],
  selectedAnnotationId: string | null,
): Annotation[] => {
  if (!selectedAnnotationId) {
    return [];
  }

  const selectedAnnotation = currentAnnotations.find((annotation) => annotation.id === selectedAnnotationId);

  if (!selectedAnnotation) {
    return [];
  }

  if (selectedAnnotation.content.kind === 'connector') {
    return [selectedAnnotation];
  }

  return currentAnnotations.filter((annotation) => {
    if (annotation.id === selectedAnnotation.id) {
      return true;
    }

    return (
      annotation.content.kind === 'connector' &&
      (annotation.content.sourceId === selectedAnnotation.id || annotation.content.targetId === selectedAnnotation.id)
    );
  });
};

const canCreateConnector = (currentAnnotations: Annotation[], content: AnnotationContent): boolean => {
  if (content.kind !== 'connector') {
    return true;
  }

  if (content.sourceId === content.targetId) {
    return false;
  }

  const canvasAnnotationIds = new Set(
    currentAnnotations
      .filter((annotation) => annotation.content.kind !== 'connector')
      .map((annotation) => annotation.id),
  );

  return canvasAnnotationIds.has(content.sourceId) && canvasAnnotationIds.has(content.targetId);
};

const updateAnnotationBounds = <T extends CanvasAnnotation>(
  annotation: T,
  bounds: CanvasBounds,
  timestamp: string,
): T => ({
  ...annotation,
  updatedAt: timestamp,
  content: {
    ...annotation.content,
    ...bounds,
  },
}) as T;

const areAnnotationContentsEqual = (left: AnnotationContent, right: AnnotationContent): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const bootstrapContentScript = async (): Promise<void> => {
  let annotationModeEnabled = false;
  let annotations: Annotation[] = [];
  let shortcutBindings = DEFAULT_SHORTCUT_BINDINGS;
  let canonicalUrl = canonicalizeUrl(window.location.href);
  let activeTool: AnnotationTool = 'rectangle';
  let selectedAnnotationId: string | null = null;
  const commandHistory = new CommandHistory();
  let keyboardMoveQueue = Promise.resolve();

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

  const cycleSelection = (direction: 1 | -1): boolean => {
    if (!annotationModeEnabled || activeTool !== 'select' || annotations.length === 0) {
      return false;
    }

    const currentIndex = selectedAnnotationId
      ? annotations.findIndex((annotation) => annotation.id === selectedAnnotationId)
      : -1;
    const nextIndex =
      currentIndex === -1
        ? direction > 0
          ? 0
          : annotations.length - 1
        : (currentIndex + direction + annotations.length) % annotations.length;
    const nextAnnotation = annotations[nextIndex];

    if (!nextAnnotation) {
      return false;
    }

    selectedAnnotationId = nextAnnotation.id;
    overlayController.setSelection(nextAnnotation.id);

    return true;
  };

  const queueSelectedAnnotationMove = (deltaX: number, deltaY: number): boolean => {
    if (!annotationModeEnabled || activeTool !== 'select' || !selectedAnnotationId) {
      return false;
    }

    const annotationId = selectedAnnotationId;
    const selectedAnnotation = annotations.find((annotation) => annotation.id === annotationId);

    if (!selectedAnnotation || !isCanvasAnnotation(selectedAnnotation)) {
      return false;
    }

    keyboardMoveQueue = keyboardMoveQueue
      .then(async () => {
        const currentAnnotation = annotations.find((annotation) => annotation.id === annotationId);

        if (!currentAnnotation || !isCanvasAnnotation(currentAnnotation)) {
          return;
        }

        await handleMoveAnnotation(annotationId, {
          x: currentAnnotation.content.x + deltaX,
          y: currentAnnotation.content.y + deltaY,
          width: currentAnnotation.content.width,
          height: currentAnnotation.content.height,
        });
      })
      .catch((error: unknown) => {
        console.error(`Marginalia failed to move annotation from the keyboard: ${describeError(error)}`);
      });

    return true;
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
      case 'delete-selected-annotation': {
        const previousAnnotations = [...annotations];
        const deletedAnnotations = getDeletedAnnotationsForSelection(annotations, selectedAnnotationId);

        if (deletedAnnotations.length === 0) {
          break;
        }

        const annotationCanonicalUrl = canonicalUrl;

        await commandHistory.execute({
          execute: async () => {
            for (const annotation of deletedAnnotations) {
              await adapter.deleteAnnotation(annotationCanonicalUrl, annotation.id);
            }

            annotations = annotations.filter(
              (annotation) => !deletedAnnotations.some((deletedAnnotation) => deletedAnnotation.id === annotation.id),
            );
            selectedAnnotationId = null;
            await persistAnnotationsChanged(annotationCanonicalUrl);
          },
          undo: async () => {
            for (const annotation of deletedAnnotations) {
              await adapter.saveAnnotation(annotationCanonicalUrl, annotation);
            }

            const restoredAnnotationsById = new Map(
              [...annotations, ...deletedAnnotations].map((annotation) => [annotation.id, annotation] as const),
            );
            annotations = previousAnnotations.filter((annotation) => restoredAnnotationsById.has(annotation.id));
            selectedAnnotationId = deletedAnnotations[0]?.id ?? null;
            await persistAnnotationsChanged(annotationCanonicalUrl);
          },
        });
        break;
      }
    }

    return getState();
  };

  const handleCreateAnnotation = async (content: AnnotationContent): Promise<Annotation | undefined> => {
    if (!canCreateConnector(annotations, content)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const annotation = buildAnnotation(content, timestamp);
    const annotationCanonicalUrl = canonicalUrl;
    let savedCreatedAnnotation: Annotation | undefined;

    await commandHistory.execute({
      execute: async () => {
        const savedAnnotation = await adapter.saveAnnotation(annotationCanonicalUrl, annotation);
        annotations = annotations.filter((existingAnnotation) => existingAnnotation.id !== savedAnnotation.id);
        annotations = [...annotations, savedAnnotation];
        selectedAnnotationId = savedAnnotation.id;
        savedCreatedAnnotation = savedAnnotation;
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

    return savedCreatedAnnotation;
  };

  const handleMoveAnnotation = async (annotationId: string, bounds: CanvasBounds): Promise<void> => {
    const currentAnnotation = annotations.find((annotation) => annotation.id === annotationId);

    if (!currentAnnotation || !isCanvasAnnotation(currentAnnotation)) {
      return;
    }

    if (
      currentAnnotation.content.x === bounds.x &&
      currentAnnotation.content.y === bounds.y &&
      currentAnnotation.content.width === bounds.width &&
      currentAnnotation.content.height === bounds.height
    ) {
      return;
    }

    const annotationCanonicalUrl = canonicalUrl;
    const previousAnnotation = currentAnnotation;
    const movedAnnotation = updateAnnotationBounds(currentAnnotation, bounds, new Date().toISOString());

    await commandHistory.execute({
      execute: async () => {
        const savedAnnotation = await adapter.saveAnnotation(annotationCanonicalUrl, movedAnnotation);
        annotations = annotations.map((annotation) => (annotation.id === savedAnnotation.id ? savedAnnotation : annotation));
        selectedAnnotationId = savedAnnotation.id;
        await persistAnnotationsChanged(annotationCanonicalUrl);
      },
      undo: async () => {
        const restoredAnnotation = await adapter.saveAnnotation(annotationCanonicalUrl, previousAnnotation);
        annotations = annotations.map((annotation) =>
          annotation.id === restoredAnnotation.id ? restoredAnnotation : annotation,
        );
        selectedAnnotationId = restoredAnnotation.id;
        await persistAnnotationsChanged(annotationCanonicalUrl);
      },
    });
  };

  const handleEditAnnotation = async (annotationId: string, content: AnnotationContent): Promise<void> => {
    const currentAnnotation = annotations.find((annotation) => annotation.id === annotationId);

    if (
      !currentAnnotation ||
      currentAnnotation.type === 'connector' ||
      currentAnnotation.content.kind !== content.kind ||
      areAnnotationContentsEqual(currentAnnotation.content, content)
    ) {
      return;
    }

    const annotationCanonicalUrl = canonicalUrl;
    const previousAnnotation = currentAnnotation;
    const updatedAt = new Date().toISOString();
    let editedAnnotation: Annotation;

    switch (currentAnnotation.type) {
      case 'text':
        if (content.kind !== 'text') {
          return;
        }
        editedAnnotation = {
          ...currentAnnotation,
          updatedAt,
          content,
        };
        break;
      case 'sticky-note':
        if (content.kind !== 'sticky-note') {
          return;
        }
        editedAnnotation = {
          ...currentAnnotation,
          updatedAt,
          content,
        };
        break;
      case 'rectangle':
        if (content.kind !== 'rectangle') {
          return;
        }
        editedAnnotation = {
          ...currentAnnotation,
          updatedAt,
          content,
        };
        break;
      case 'ellipse':
        if (content.kind !== 'ellipse') {
          return;
        }
        editedAnnotation = {
          ...currentAnnotation,
          updatedAt,
          content,
        };
        break;
      case 'circle':
        if (content.kind !== 'circle') {
          return;
        }
        editedAnnotation = {
          ...currentAnnotation,
          updatedAt,
          content,
        };
        break;
    }

    await commandHistory.execute({
      execute: async () => {
        const savedAnnotation = await adapter.saveAnnotation(annotationCanonicalUrl, editedAnnotation);
        annotations = annotations.map((annotation) => (annotation.id === savedAnnotation.id ? savedAnnotation : annotation));
        selectedAnnotationId = savedAnnotation.id;
        await persistAnnotationsChanged(annotationCanonicalUrl);
      },
      undo: async () => {
        const restoredAnnotation = await adapter.saveAnnotation(annotationCanonicalUrl, previousAnnotation);
        annotations = annotations.map((annotation) =>
          annotation.id === restoredAnnotation.id ? restoredAnnotation : annotation,
        );
        selectedAnnotationId = restoredAnnotation.id;
        await persistAnnotationsChanged(annotationCanonicalUrl);
      },
      redo: async () => {
        const savedAnnotation = await adapter.saveAnnotation(annotationCanonicalUrl, editedAnnotation);
        annotations = annotations.map((annotation) => (annotation.id === savedAnnotation.id ? savedAnnotation : annotation));
        selectedAnnotationId = savedAnnotation.id;
        await persistAnnotationsChanged(annotationCanonicalUrl);
      },
    });
  };

  const overlayController = createOverlayController(document, window, {
    onCreateAnnotation: (content) =>
      handleCreateAnnotation(content).catch((error: unknown) => {
        console.error(`Marginalia failed to save annotation: ${describeError(error)}`);
      }),
    onEditAnnotation: (annotationId, content) =>
      handleEditAnnotation(annotationId, content).catch((error: unknown) => {
        console.error(`Marginalia failed to edit annotation: ${describeError(error)}`);
      }),
    onMoveAnnotation: (annotationId, bounds) =>
      handleMoveAnnotation(annotationId, bounds).catch((error: unknown) => {
        console.error(`Marginalia failed to move annotation: ${describeError(error)}`);
      }),
    onRequestDisable: async () => {
      await setAnnotationMode(false);
    },
    onRunCommand: (command) => {
      if (command === 'cancel-current-action') {
        return;
      }

      void handleAnnotationCommand(command).catch((error: unknown) => {
        console.error(`Marginalia failed to run annotation command: ${describeError(error)}`);
      });
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
      if (shouldIgnoreKeyboardEventTarget(event)) {
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.code === 'Tab') {
        if (cycleSelection(event.shiftKey ? -1 : 1)) {
          event.preventDefault();
        }

        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        const keyboardMoveDistance = event.shiftKey ? 10 : 1;
        let handledMove = false;

        switch (event.code) {
          case 'ArrowLeft':
            handledMove = queueSelectedAnnotationMove(-keyboardMoveDistance, 0);
            break;
          case 'ArrowRight':
            handledMove = queueSelectedAnnotationMove(keyboardMoveDistance, 0);
            break;
          case 'ArrowUp':
            handledMove = queueSelectedAnnotationMove(0, -keyboardMoveDistance);
            break;
          case 'ArrowDown':
            handledMove = queueSelectedAnnotationMove(0, keyboardMoveDistance);
            break;
        }

        if (handledMove) {
          event.preventDefault();
          return;
        }
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
