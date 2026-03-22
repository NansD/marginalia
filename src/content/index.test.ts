import { fireEvent, screen, waitFor } from '@testing-library/react';

import type { ContentScriptState, RuntimeMessage } from '@/shared/runtime/messages';
import { LocalAdapter, resetLocalAdapterDatabase } from '@/shared/storage/LocalAdapter';

vi.mock('./navigationObserver', () => ({
  observePageNavigation: vi.fn(() => ({ disconnect: vi.fn() })),
}));

vi.mock('@/shared/runtime/shortcuts', async () => {
  const actual = await vi.importActual<typeof import('@/shared/runtime/shortcuts')>('@/shared/runtime/shortcuts');

  return {
    ...actual,
    ensureShortcutBindings: vi.fn(() => Promise.resolve(actual.DEFAULT_SHORTCUT_BINDINGS)),
    subscribeToShortcutBindings: vi.fn(() => () => undefined),
  };
});

describe('content script object tools', () => {
  afterEach(() => {
    delete (globalThis as { __MARGINALIA_LOCAL_ADAPTER_DB_NAME__?: string }).__MARGINALIA_LOCAL_ADAPTER_DB_NAME__;
  });

  it('persists connector authoring and keeps deletion behavior correct through the overlay flow', async () => {
    const databaseName = `marginalia-content-index-${crypto.randomUUID()}`;
    (globalThis as { __MARGINALIA_LOCAL_ADAPTER_DB_NAME__?: string }).__MARGINALIA_LOCAL_ADAPTER_DB_NAME__ =
      databaseName;
    await resetLocalAdapterDatabase(databaseName);
    document.body.innerHTML = '';
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 0 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });

    class ResizeObserverMock {
      public observe = vi.fn();
      public disconnect = vi.fn();
    }

    const runtimeListeners: Array<
      (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: ContentScriptState) => void,
      ) => boolean | undefined
    > = [];
    type RuntimeListener = (typeof runtimeListeners)[number];
    const sendMessage = vi.fn((_message: RuntimeMessage, callback?: () => void) => {
      callback?.();
    });

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn((listener: RuntimeListener) => {
            runtimeListeners.push(listener);
          }),
        },
        lastError: undefined,
      },
      storage: {
        sync: {
          get: vi.fn((key: string, callback: (items: Record<string, unknown>) => void) => {
            callback({ [key]: undefined });
          }),
          set: vi.fn((_: Record<string, unknown>, callback: () => void) => {
            callback();
          }),
          onChanged: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        },
      },
    });

    vi.resetModules();
    await import('./index');

    const dispatchRuntimeMessage = async (message: RuntimeMessage): Promise<ContentScriptState | undefined> => {
      const listener = runtimeListeners.at(-1);
      expect(listener).toBeDefined();

      return new Promise<ContentScriptState | undefined>((resolve) => {
        listener!(message, {} as chrome.runtime.MessageSender, (response) => {
          resolve(response);
        });
      });
    };

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          annotationModeEnabled: false,
          canonicalUrl: 'http://localhost:3000/',
          kind: 'page-state-changed',
        }),
        expect.any(Function),
      );
    });

    await dispatchRuntimeMessage({ kind: 'set-annotation-mode', enabled: true });

    const overlayElement = document.querySelector<SVGSVGElement>('#marginalia-overlay');
    expect(overlayElement).toBeInTheDocument();

    await dispatchRuntimeMessage({ kind: 'select-annotation-tool', tool: 'ellipse' });
    fireEvent.pointerDown(overlayElement!, { button: 0, clientX: 180, clientY: 120, pointerId: 1 });
    fireEvent.pointerMove(overlayElement!, { clientX: 120, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(overlayElement!, { pointerId: 1 });

    const adapter = new LocalAdapter();
    const canonicalUrl = 'http://localhost:3000/';

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);

      expect(annotations.map((annotation) => annotation.type)).toEqual(['ellipse']);
    });

    await dispatchRuntimeMessage({ kind: 'select-annotation-tool', tool: 'text' });
    fireEvent.pointerDown(overlayElement!, { button: 0, clientX: 48, clientY: 72, pointerId: 2 });

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);

      expect(annotations.map((annotation) => annotation.type)).toEqual(['ellipse', 'text']);
    });

    await dispatchRuntimeMessage({ kind: 'select-annotation-tool', tool: 'sticky-note' });
    fireEvent.pointerDown(overlayElement!, { button: 0, clientX: 260, clientY: 140, pointerId: 3 });

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);

      expect(annotations.map((annotation) => annotation.type)).toEqual(['ellipse', 'text', 'sticky-note']);
    });

    const savedAnnotations = await adapter.getAnnotations(canonicalUrl);
    const ellipseAnnotation = savedAnnotations.find((annotation) => annotation.type === 'ellipse');
    const textAnnotation = savedAnnotations.find((annotation) => annotation.type === 'text');
    const stickyNoteAnnotation = savedAnnotations.find((annotation) => annotation.type === 'sticky-note');

    expect(ellipseAnnotation).toBeDefined();
    expect(textAnnotation).toBeDefined();
    expect(stickyNoteAnnotation).toBeDefined();

    await dispatchRuntimeMessage({ kind: 'select-annotation-tool', tool: 'connector' });
    fireEvent.pointerDown(document.querySelector(`[data-marginalia-annotation-id="${ellipseAnnotation!.id}"]`)!, {
      button: 0,
      clientX: 120,
      clientY: 90,
      pointerId: 4,
    });
    fireEvent.pointerDown(document.querySelector(`[data-marginalia-annotation-id="${textAnnotation!.id}"]`)!, {
      button: 0,
      clientX: 48,
      clientY: 96,
      pointerId: 5,
    });

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);
      const connectorAnnotation = annotations.find((annotation) => annotation.type === 'connector');

      expect(annotations.map((annotation) => annotation.type)).toEqual(['ellipse', 'text', 'sticky-note', 'connector']);
      expect(connectorAnnotation).toMatchObject({
        content: {
          kind: 'connector',
          sourceId: ellipseAnnotation!.id,
          targetId: textAnnotation!.id,
          color: 'purple',
        },
      });
    });

    await dispatchRuntimeMessage({ kind: 'select-annotation-tool', tool: 'select' });
    fireEvent.pointerDown(document.querySelector(`[data-marginalia-annotation-id="${ellipseAnnotation!.id}"]`)!, {
      button: 0,
      clientX: 180,
      clientY: 120,
      pointerId: 6,
    });
    fireEvent.pointerMove(overlayElement!, { clientX: 220, clientY: 150, pointerId: 6 });

    expect(document.querySelector('[data-marginalia-annotation-kind="connector"]')).toHaveAttribute('x1', '160');
    expect(document.querySelector('[data-marginalia-annotation-kind="connector"]')).toHaveAttribute('y1', '120');

    fireEvent.pointerUp(overlayElement!, { pointerId: 6 });

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);
      const movedEllipseAnnotation = annotations.find((annotation) => annotation.id === ellipseAnnotation!.id);

      expect(movedEllipseAnnotation).toMatchObject({
        content: {
          kind: 'ellipse',
          x: 160,
          y: 90,
          width: 60,
          height: 60,
          color: 'green',
        },
      });
    });

    await dispatchRuntimeMessage({ kind: 'run-annotation-command', command: 'undo' });

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);
      const restoredEllipseAnnotation = annotations.find((annotation) => annotation.id === ellipseAnnotation!.id);

      expect(restoredEllipseAnnotation).toMatchObject({
        content: {
          kind: 'ellipse',
          x: 120,
          y: 60,
          width: 60,
          height: 60,
          color: 'green',
        },
      });
      expect(document.querySelector('[data-marginalia-annotation-kind="connector"]')).toHaveAttribute('x1', '120');
      expect(document.querySelector('[data-marginalia-annotation-kind="connector"]')).toHaveAttribute('y1', '90');
    });

    await dispatchRuntimeMessage({ kind: 'run-annotation-command', command: 'redo' });

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);
      const movedEllipseAnnotation = annotations.find((annotation) => annotation.id === ellipseAnnotation!.id);

      expect(movedEllipseAnnotation).toMatchObject({
        content: {
          kind: 'ellipse',
          x: 160,
          y: 90,
          width: 60,
          height: 60,
          color: 'green',
        },
      });
      expect(document.querySelector('[data-marginalia-annotation-kind="connector"]')).toHaveAttribute('x1', '160');
      expect(document.querySelector('[data-marginalia-annotation-kind="connector"]')).toHaveAttribute('y1', '120');
    });

    fireEvent.pointerDown(
      document.querySelector(`[data-marginalia-annotation-kind="connector"]`)!,
      { button: 0, pointerId: 7 },
    );
    fireEvent.click(
      Array.from(document.querySelectorAll<HTMLButtonElement>('#marginalia-overlay-toolbar button')).find(
        (button) => button.textContent === 'Delete selected',
      )!,
    );

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);

      expect(annotations.map((annotation) => annotation.type)).toEqual(['ellipse', 'text', 'sticky-note']);
    });

    await dispatchRuntimeMessage({ kind: 'select-annotation-tool', tool: 'connector' });
    fireEvent.pointerDown(document.querySelector(`[data-marginalia-annotation-id="${ellipseAnnotation!.id}"]`)!, {
      button: 0,
      clientX: 220,
      clientY: 120,
      pointerId: 8,
    });
    fireEvent.pointerDown(document.querySelector(`[data-marginalia-annotation-id="${textAnnotation!.id}"]`)!, {
      button: 0,
      clientX: 48,
      clientY: 96,
      pointerId: 9,
    });

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);

      expect(annotations.map((annotation) => annotation.type)).toEqual(['ellipse', 'text', 'sticky-note', 'connector']);
    });

    await dispatchRuntimeMessage({ kind: 'select-annotation-tool', tool: 'select' });
    fireEvent.pointerDown(
      document.querySelector(`[data-marginalia-annotation-id="${textAnnotation!.id}"]`)!,
      { button: 0, pointerId: 10 },
    );
    fireEvent.click(
      Array.from(document.querySelectorAll<HTMLButtonElement>('#marginalia-overlay-toolbar button')).find(
        (button) => button.textContent === 'Delete selected',
      )!,
    );

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);

      expect(annotations.map((annotation) => annotation.type)).toEqual(['ellipse', 'sticky-note']);
    });
  });

  it('persists text and sticky-note edits and keeps undo redo coherent', async () => {
    const databaseName = `marginalia-content-index-${crypto.randomUUID()}`;
    (globalThis as { __MARGINALIA_LOCAL_ADAPTER_DB_NAME__?: string }).__MARGINALIA_LOCAL_ADAPTER_DB_NAME__ =
      databaseName;
    await resetLocalAdapterDatabase(databaseName);
    document.body.innerHTML = '';
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 0 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });

    class ResizeObserverMock {
      public observe = vi.fn();
      public disconnect = vi.fn();
    }

    const runtimeListeners: Array<
      (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: ContentScriptState) => void,
      ) => boolean | undefined
    > = [];
    type RuntimeListener = (typeof runtimeListeners)[number];
    const sendMessage = vi.fn((_message: RuntimeMessage, callback?: () => void) => {
      callback?.();
    });

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: vi.fn((listener: RuntimeListener) => {
            runtimeListeners.push(listener);
          }),
        },
        lastError: undefined,
      },
      storage: {
        sync: {
          get: vi.fn((key: string, callback: (items: Record<string, unknown>) => void) => {
            callback({ [key]: undefined });
          }),
          set: vi.fn((_: Record<string, unknown>, callback: () => void) => {
            callback();
          }),
          onChanged: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        },
      },
    });

    vi.resetModules();
    await import('./index');

    const dispatchRuntimeMessage = async (message: RuntimeMessage): Promise<ContentScriptState | undefined> => {
      const listener = runtimeListeners.at(-1);
      expect(listener).toBeDefined();

      return new Promise<ContentScriptState | undefined>((resolve) => {
        listener!(message, {} as chrome.runtime.MessageSender, (response) => {
          resolve(response);
        });
      });
    };

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          annotationModeEnabled: false,
          canonicalUrl: 'http://localhost:3000/',
          kind: 'page-state-changed',
        }),
        expect.any(Function),
      );
    });

    await dispatchRuntimeMessage({ kind: 'set-annotation-mode', enabled: true });

    const overlayElement = document.querySelector<SVGSVGElement>('#marginalia-overlay');
    const adapter = new LocalAdapter();
    const canonicalUrl = 'http://localhost:3000/';
    expect(overlayElement).toBeInTheDocument();

    await dispatchRuntimeMessage({ kind: 'select-annotation-tool', tool: 'text' });
    fireEvent.pointerDown(overlayElement!, { button: 0, clientX: 48, clientY: 72, pointerId: 21 });

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);

      expect(annotations.map((annotation) => annotation.type)).toEqual(['text']);
    });

    await dispatchRuntimeMessage({ kind: 'select-annotation-tool', tool: 'sticky-note' });
    fireEvent.pointerDown(overlayElement!, { button: 0, clientX: 260, clientY: 140, pointerId: 22 });

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);

      expect(annotations.map((annotation) => annotation.type)).toEqual(['text', 'sticky-note']);
    });

    const [textAnnotation, stickyNoteAnnotation] = await adapter.getAnnotations(canonicalUrl);

    expect(textAnnotation?.type).toBe('text');
    expect(stickyNoteAnnotation?.type).toBe('sticky-note');

    await dispatchRuntimeMessage({ kind: 'select-annotation-tool', tool: 'select' });

    fireEvent.pointerDown(document.querySelector(`[data-marginalia-annotation-id="${textAnnotation!.id}"]`)!, {
      button: 0,
      pointerId: 23,
    });
    fireEvent.click(
      Array.from(document.querySelectorAll<HTMLButtonElement>('#marginalia-overlay-toolbar button')).find(
        (button) => button.textContent === 'Edit selected',
      )!,
    );
    fireEvent.input(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Annotation text"]')!, {
      target: { value: 'Edited text annotation' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);
      const editedText = annotations.find((annotation) => annotation.id === textAnnotation!.id);

      expect(editedText).toMatchObject({
        content: {
          kind: 'text',
          text: 'Edited text annotation',
        },
      });
    });

    await dispatchRuntimeMessage({ kind: 'run-annotation-command', command: 'undo' });

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);
      const restoredText = annotations.find((annotation) => annotation.id === textAnnotation!.id);

      expect(restoredText).toMatchObject({
        content: {
          kind: 'text',
          text: 'Text annotation',
        },
      });
    });

    await dispatchRuntimeMessage({ kind: 'run-annotation-command', command: 'redo' });

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);
      const editedText = annotations.find((annotation) => annotation.id === textAnnotation!.id);

      expect(editedText).toMatchObject({
        content: {
          kind: 'text',
          text: 'Edited text annotation',
        },
      });
    });

    fireEvent.doubleClick(document.querySelector(`[data-marginalia-annotation-id="${stickyNoteAnnotation!.id}"]`)!);
    fireEvent.input(document.querySelector<HTMLInputElement>('input[aria-label="Sticky note title"]')!, {
      target: { value: 'Edited sticky title' },
    });
    fireEvent.input(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Sticky note text"]')!, {
      target: { value: 'Edited sticky body' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);
      const editedSticky = annotations.find((annotation) => annotation.id === stickyNoteAnnotation!.id);

      expect(editedSticky).toMatchObject({
        content: {
          kind: 'sticky-note',
          title: 'Edited sticky title',
          text: 'Edited sticky body',
        },
      });
    });
  });
});
