import { fireEvent, waitFor } from '@testing-library/react';

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
  it('persists connector authoring and keeps deletion behavior correct through the overlay flow', async () => {
    await resetLocalAdapterDatabase();
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
    fireEvent.pointerDown(
      document.querySelector(`[data-marginalia-annotation-kind="connector"]`)!,
      { button: 0, pointerId: 6 },
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
      clientX: 120,
      clientY: 90,
      pointerId: 7,
    });
    fireEvent.pointerDown(document.querySelector(`[data-marginalia-annotation-id="${textAnnotation!.id}"]`)!, {
      button: 0,
      clientX: 48,
      clientY: 96,
      pointerId: 8,
    });

    await waitFor(async () => {
      const annotations = await adapter.getAnnotations(canonicalUrl);

      expect(annotations.map((annotation) => annotation.type)).toEqual(['ellipse', 'text', 'sticky-note', 'connector']);
    });

    await dispatchRuntimeMessage({ kind: 'select-annotation-tool', tool: 'select' });
    fireEvent.pointerDown(
      document.querySelector(`[data-marginalia-annotation-id="${textAnnotation!.id}"]`)!,
      { button: 0, pointerId: 9 },
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
});
