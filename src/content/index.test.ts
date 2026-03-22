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
  it('persists object-tool creations and selected deletion through the overlay flow', async () => {
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
    const textAnnotation = savedAnnotations.find((annotation) => annotation.type === 'text');

    expect(textAnnotation).toBeDefined();

    await dispatchRuntimeMessage({ kind: 'select-annotation-tool', tool: 'select' });
    fireEvent.pointerDown(
      document.querySelector(`[data-marginalia-annotation-id="${textAnnotation!.id}"]`)!,
      { button: 0, pointerId: 4 },
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
