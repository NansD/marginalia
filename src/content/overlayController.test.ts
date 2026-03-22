import { fireEvent, screen } from '@testing-library/react';

import { buildRectangleAnnotation } from '@/test/factories';

import {
  createOverlayController,
  OVERLAY_ELEMENT_ID,
  OVERLAY_TOOLBAR_ID,
} from './overlayController';

const getOverlayElement = (): SVGSVGElement => {
  const overlayElement = document.querySelector<SVGSVGElement>(`#${OVERLAY_ELEMENT_ID}`);

  expect(overlayElement).toBeInTheDocument();

  return overlayElement!;
};

const getDraftRectangle = (): SVGRectElement | null =>
  getOverlayElement().querySelector<SVGRectElement>('rect:not([data-marginalia-annotation-id])');

describe('createOverlayController', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 0 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it('does not mount the overlay while inert and empty', () => {
    const controller = createOverlayController(document, window);

    controller.syncToDocument();

    expect(document.getElementById(OVERLAY_ELEMENT_ID)).not.toBeInTheDocument();
    expect(document.getElementById(OVERLAY_TOOLBAR_ID)).not.toBeInTheDocument();
  });

  it('renders stored annotations without enabling interaction', () => {
    const controller = createOverlayController(document, window);

    controller.setAnnotations([
      buildRectangleAnnotation('annotation-1'),
      buildRectangleAnnotation('annotation-2', { content: { x: 240 } }),
    ]);

    const overlayElement = getOverlayElement();

    expect(overlayElement.querySelectorAll('[data-marginalia-annotation-id]')).toHaveLength(2);
    expect(overlayElement).toHaveAttribute('data-mode', 'inert');
    expect(document.getElementById(OVERLAY_TOOLBAR_ID)).not.toBeInTheDocument();
  });

  it('renders non-rectangle annotations inertly for future tools', () => {
    const controller = createOverlayController(document, window);

    controller.setAnnotations([
      {
        id: 'ellipse-1',
        type: 'ellipse',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        content: {
          kind: 'ellipse',
          x: 220,
          y: 40,
          width: 120,
          height: 80,
          color: 'green',
        },
      },
      {
        id: 'text-1',
        type: 'text',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        content: {
          kind: 'text',
          x: 24,
          y: 140,
          width: 180,
          height: 48,
          text: 'Draft text annotation',
          color: 'blue',
        },
      },
      {
        id: 'sticky-1',
        type: 'sticky-note',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        content: {
          kind: 'sticky-note',
          x: 260,
          y: 160,
          width: 180,
          height: 120,
          color: 'yellow',
          text: 'Investigate follow-up tasks',
          collapsed: false,
          title: 'Follow-up',
        },
      },
      {
        id: 'connector-1',
        type: 'connector',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        content: {
          kind: 'connector',
          sourceId: 'text-1',
          sourceAnchor: 'right',
          targetId: 'sticky-1',
          targetAnchor: 'left',
          color: 'purple',
          label: 'links',
        },
      },
    ]);

    const overlayElement = getOverlayElement();

    expect(overlayElement).toHaveAttribute('data-mode', 'inert');
    expect(overlayElement.querySelector('[data-marginalia-annotation-id="ellipse-1"]')).toBeInTheDocument();
    expect(overlayElement.querySelector('[data-marginalia-annotation-id="text-1"]')).toBeInTheDocument();
    expect(overlayElement.querySelector('[data-marginalia-annotation-id="sticky-1"]')).toBeInTheDocument();
    expect(overlayElement.querySelector('[data-marginalia-annotation-id="connector-1"]')).toBeInTheDocument();
  });

  it('shows a toolbar in interactive mode and lets the user leave the mode', () => {
    const onRequestDisable = vi.fn();
    const controller = createOverlayController(document, window, { onRequestDisable });

    controller.setInteractive(true);

    expect(screen.getByText('Marginalia annotation mode')).toBeInTheDocument();
    expect(screen.getByText('Drag anywhere on the page to draw a rectangle annotation.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onRequestDisable).toHaveBeenCalledTimes(1);
  });

  it('creates normalized rectangle annotations from pointer interactions', () => {
    const onCreateAnnotation = vi.fn();
    const controller = createOverlayController(document, window, { onCreateAnnotation });

    controller.setInteractive(true);

    const overlayElement = getOverlayElement();
    const setPointerCapture = vi.fn();
    Object.defineProperty(overlayElement, 'setPointerCapture', {
      configurable: true,
      value: setPointerCapture,
    });

    fireEvent.pointerDown(overlayElement, { button: 0, clientX: 120, clientY: 80, pointerId: 7 });
    expect(getDraftRectangle()).toHaveAttribute('x', '120');
    expect(getDraftRectangle()).toHaveAttribute('y', '80');
    expect(getDraftRectangle()).toHaveAttribute('width', '0');
    expect(getDraftRectangle()).toHaveAttribute('height', '0');

    fireEvent.pointerMove(overlayElement, { clientX: 40, clientY: 30, pointerId: 7 });
    expect(getDraftRectangle()).toHaveAttribute('x', '40');
    expect(getDraftRectangle()).toHaveAttribute('y', '30');
    expect(getDraftRectangle()).toHaveAttribute('width', '80');
    expect(getDraftRectangle()).toHaveAttribute('height', '50');

    fireEvent.pointerUp(overlayElement, { pointerId: 7 });

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(onCreateAnnotation).toHaveBeenCalledWith({
      kind: 'rectangle',
      x: 40,
      y: 30,
      width: 80,
      height: 50,
    });
    expect(getDraftRectangle()).not.toBeInTheDocument();
  });

  it('ignores other pointer ids and clears drafts through the cancel command', () => {
    const onRunCommand = vi.fn();
    const controller = createOverlayController(document, window, { onRunCommand });

    controller.setInteractive(true);

    const overlayElement = getOverlayElement();

    fireEvent.pointerDown(overlayElement, { button: 0, clientX: 25, clientY: 35, pointerId: 1 });
    fireEvent.pointerMove(overlayElement, { clientX: 180, clientY: 220, pointerId: 2 });

    expect(getDraftRectangle()).toHaveAttribute('x', '25');
    expect(getDraftRectangle()).toHaveAttribute('y', '35');
    expect(getDraftRectangle()).toHaveAttribute('width', '0');
    expect(getDraftRectangle()).toHaveAttribute('height', '0');

    controller.runCommand('cancel-current-action');

    expect(getDraftRectangle()).not.toBeInTheDocument();
    expect(onRunCommand).toHaveBeenCalledWith('cancel-current-action');
  });

  it('rejects rectangles smaller than the minimum draw size', () => {
    const onCreateAnnotation = vi.fn();
    const controller = createOverlayController(document, window, { onCreateAnnotation });

    controller.setInteractive(true);

    const overlayElement = getOverlayElement();

    fireEvent.pointerDown(overlayElement, { button: 0, clientX: 10, clientY: 12, pointerId: 4 });
    fireEvent.pointerMove(overlayElement, { clientX: 17, clientY: 19, pointerId: 4 });
    fireEvent.pointerUp(overlayElement, { pointerId: 4 });

    expect(onCreateAnnotation).not.toHaveBeenCalled();
    expect(getDraftRectangle()).not.toBeInTheDocument();
  });

  it('updates tool messaging and clears drafts when switching away from rectangles', () => {
    const controller = createOverlayController(document, window);

    controller.setInteractive(true);

    const overlayElement = getOverlayElement();
    fireEvent.pointerDown(overlayElement, { button: 0, clientX: 10, clientY: 12, pointerId: 9 });
    fireEvent.pointerMove(overlayElement, { clientX: 70, clientY: 82, pointerId: 9 });

    expect(getDraftRectangle()).toBeInTheDocument();

    controller.setActiveTool('ellipse');

    expect(getDraftRectangle()).not.toBeInTheDocument();
    expect(screen.getByText('Ellipse tool selection is ready, but drawing stays on rectangles for now.')).toBeInTheDocument();
    expect(screen.getByText('Ellipse tool active. No annotations on this page yet.')).toBeInTheDocument();
    expect(overlayElement).toHaveAttribute('data-active-tool', 'ellipse');
  });

  it('queues document sync through requestAnimationFrame on scroll and resize', () => {
    const callbacks: FrameRequestCallback[] = [];

    class ResizeObserverMock {
      public observe = vi.fn();
      public disconnect = vi.fn();
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const controller = createOverlayController(document, window);

    controller.setAnnotations([buildRectangleAnnotation('annotation-sync')]);

    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback): number => {
        callbacks.push(callback);
        return callbacks.length;
      });
    const overlayElement = getOverlayElement();

    Object.defineProperty(window, 'scrollX', { configurable: true, value: 24 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 36 });

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));

    expect(requestAnimationFrameSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    for (const callback of callbacks) {
      callback(0);
    }

    expect(overlayElement.style.transform).toBe('translate(-24px, -36px)');
  });
});
