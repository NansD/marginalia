import { fireEvent, screen } from '@testing-library/react';

import {
  buildConnectorAnnotation,
  buildEllipseAnnotation,
  buildRectangleAnnotation,
  buildStickyNoteAnnotation,
  buildTextAnnotation,
} from '@/test/factories';

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
  getOverlayElement().querySelector<SVGRectElement>('g[data-marginalia-layer="drafts"] rect');

const getDraftEllipse = (): SVGEllipseElement | null =>
  getOverlayElement().querySelector<SVGEllipseElement>('g[data-marginalia-layer="drafts"] ellipse');

const getDraftConnector = (): SVGLineElement | null =>
  getOverlayElement().querySelector<SVGLineElement>('g[data-marginalia-layer="drafts"] line');

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

  it('renders supported v1 annotations inertly for future editing work', () => {
    const controller = createOverlayController(document, window);

    controller.setAnnotations([
      buildEllipseAnnotation('ellipse-1'),
      buildTextAnnotation('text-1'),
      buildStickyNoteAnnotation('sticky-1'),
      buildConnectorAnnotation('connector-1', {
        content: {
          sourceId: 'text-1',
          targetId: 'sticky-1',
        },
      }),
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
    expect(screen.getByRole('button', { name: 'Delete selected' })).toBeDisabled();

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

  it('creates ellipse annotations from pointer interactions', () => {
    const onCreateAnnotation = vi.fn();
    const controller = createOverlayController(document, window, { onCreateAnnotation });

    controller.setInteractive(true);
    controller.setActiveTool('ellipse');

    const overlayElement = getOverlayElement();

    fireEvent.pointerDown(overlayElement, { button: 0, clientX: 160, clientY: 120, pointerId: 11 });
    expect(getDraftEllipse()).toHaveAttribute('cx', '160');
    expect(getDraftEllipse()).toHaveAttribute('cy', '120');
    expect(getDraftEllipse()).toHaveAttribute('rx', '0');
    expect(getDraftEllipse()).toHaveAttribute('ry', '0');

    fireEvent.pointerMove(overlayElement, { clientX: 80, clientY: 40, pointerId: 11 });
    expect(getDraftEllipse()).toHaveAttribute('cx', '120');
    expect(getDraftEllipse()).toHaveAttribute('cy', '80');
    expect(getDraftEllipse()).toHaveAttribute('rx', '40');
    expect(getDraftEllipse()).toHaveAttribute('ry', '40');

    fireEvent.pointerUp(overlayElement, { pointerId: 11 });

    expect(onCreateAnnotation).toHaveBeenCalledWith({
      kind: 'ellipse',
      x: 80,
      y: 40,
      width: 80,
      height: 80,
      color: 'green',
    });
    expect(getDraftEllipse()).not.toBeInTheDocument();
  });

  it('creates text annotations with sensible click-to-place defaults', () => {
    const onCreateAnnotation = vi.fn();
    const controller = createOverlayController(document, window, { onCreateAnnotation });

    controller.setInteractive(true);
    controller.setActiveTool('text');

    fireEvent.pointerDown(getOverlayElement(), { button: 0, clientX: 42, clientY: 64, pointerId: 3 });

    expect(onCreateAnnotation).toHaveBeenCalledWith({
      kind: 'text',
      x: 42,
      y: 64,
      width: 220,
      height: 56,
      color: 'blue',
      text: 'Text annotation',
    });
  });

  it('creates sticky notes with sensible click-to-place defaults', () => {
    const onCreateAnnotation = vi.fn();
    const controller = createOverlayController(document, window, { onCreateAnnotation });

    controller.setInteractive(true);
    controller.setActiveTool('sticky-note');

    fireEvent.pointerDown(getOverlayElement(), { button: 0, clientX: 90, clientY: 110, pointerId: 5 });

    expect(onCreateAnnotation).toHaveBeenCalledWith({
      kind: 'sticky-note',
      x: 90,
      y: 110,
      width: 220,
      height: 160,
      color: 'yellow',
      collapsed: false,
      text: 'New note',
      title: 'Sticky note',
    });
  });

  it('creates connectors by clicking a source annotation and then a target annotation', () => {
    const onCreateAnnotation = vi.fn();
    const controller = createOverlayController(document, window, { onCreateAnnotation });

    controller.setAnnotations([
      buildRectangleAnnotation('annotation-source'),
      buildTextAnnotation('annotation-target', {
        content: {
          x: 260,
          y: 64,
        },
      }),
    ]);
    controller.setInteractive(true);
    controller.setActiveTool('connector');

    const overlayElement = getOverlayElement();
    const sourceElement = overlayElement.querySelector('[data-marginalia-annotation-id="annotation-source"]');
    const targetElement = overlayElement.querySelector('[data-marginalia-annotation-id="annotation-target"]');

    expect(sourceElement).toBeInTheDocument();
    expect(targetElement).toBeInTheDocument();

    fireEvent.pointerDown(sourceElement!, { button: 0, clientX: 176, clientY: 60, pointerId: 12 });

    expect(screen.getByText(/Source Rectangle annotation selected/)).toBeInTheDocument();
    expect(
      overlayElement.querySelector('[data-marginalia-annotation-id="annotation-source"]'),
    ).toHaveAttribute('data-marginalia-selected', 'true');

    fireEvent.pointerMove(overlayElement, { clientX: 220, clientY: 84, pointerId: 12 });

    expect(getDraftConnector()).toHaveAttribute('x1', '176');
    expect(getDraftConnector()).toHaveAttribute('y1', '60');
    expect(getDraftConnector()).toHaveAttribute('x2', '220');
    expect(getDraftConnector()).toHaveAttribute('y2', '84');

    fireEvent.pointerDown(
      overlayElement.querySelector('[data-marginalia-annotation-id="annotation-target"]')!,
      { button: 0, clientX: 260, clientY: 88, pointerId: 13 },
    );

    expect(onCreateAnnotation).toHaveBeenCalledWith({
      kind: 'connector',
      sourceId: 'annotation-source',
      sourceAnchor: 'right',
      targetId: 'annotation-target',
      targetAnchor: 'left',
      color: 'purple',
    });
    expect(getDraftConnector()).not.toBeInTheDocument();
    expect(screen.getByText('Connector tool active. 2 annotations on this page.')).toBeInTheDocument();
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

  it('rejects shapes smaller than the minimum draw size', () => {
    const onCreateAnnotation = vi.fn();
    const controller = createOverlayController(document, window, { onCreateAnnotation });

    controller.setInteractive(true);
    controller.setActiveTool('ellipse');

    const overlayElement = getOverlayElement();

    fireEvent.pointerDown(overlayElement, { button: 0, clientX: 10, clientY: 12, pointerId: 4 });
    fireEvent.pointerMove(overlayElement, { clientX: 17, clientY: 19, pointerId: 4 });
    fireEvent.pointerUp(overlayElement, { pointerId: 4 });

    expect(onCreateAnnotation).not.toHaveBeenCalled();
    expect(getDraftEllipse()).not.toBeInTheDocument();
  });

  it('updates tool messaging and clears drafts when switching tools', () => {
    const controller = createOverlayController(document, window);

    controller.setInteractive(true);

    const overlayElement = getOverlayElement();
    fireEvent.pointerDown(overlayElement, { button: 0, clientX: 10, clientY: 12, pointerId: 9 });
    fireEvent.pointerMove(overlayElement, { clientX: 70, clientY: 82, pointerId: 9 });

    expect(getDraftRectangle()).toBeInTheDocument();

    controller.setActiveTool('text');

    expect(getDraftRectangle()).not.toBeInTheDocument();
    expect(screen.getByText('Click anywhere on the page to place a text annotation.')).toBeInTheDocument();
    expect(screen.getByText('Text tool active. No annotations on this page yet.')).toBeInTheDocument();
    expect(overlayElement).toHaveAttribute('data-active-tool', 'text');
  });

  it('selects annotations in select mode and forwards delete requests for the selection', () => {
    const onRunCommand = vi.fn();
    const controller = createOverlayController(document, window, { onRunCommand });

    controller.setAnnotations([buildRectangleAnnotation('annotation-selected')]);
    controller.setInteractive(true);
    controller.setActiveTool('select');

    const annotationElement = getOverlayElement().querySelector('[data-marginalia-annotation-id="annotation-selected"]');

    expect(annotationElement).toBeInTheDocument();

    fireEvent.pointerDown(annotationElement!, { button: 0, pointerId: 10 });

    expect(getOverlayElement()).toHaveAttribute('data-selection', 'single');
    expect(screen.getByText('Select tool active. Selected Rectangle annotation.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete selected' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));

    expect(onRunCommand).toHaveBeenCalledWith('delete-selected-annotation');
  });

  it('drags selected canvas annotations in select mode and keeps connectors aligned', () => {
    const onMoveAnnotation = vi.fn();
    const controller = createOverlayController(document, window, { onMoveAnnotation });

    controller.setAnnotations([
      buildRectangleAnnotation('annotation-source'),
      buildTextAnnotation('annotation-target', {
        content: {
          x: 260,
          y: 64,
        },
      }),
      buildConnectorAnnotation('annotation-connector', {
        content: {
          sourceId: 'annotation-source',
          targetId: 'annotation-target',
        },
      }),
    ]);
    controller.setInteractive(true);
    controller.setActiveTool('select');

    const overlayElement = getOverlayElement();
    const connectorElement = overlayElement.querySelector<SVGLineElement>(
      '[data-marginalia-annotation-id="annotation-connector"]',
    );
    const sourceElement = overlayElement.querySelector('[data-marginalia-annotation-id="annotation-source"]');

    expect(connectorElement).toHaveAttribute('x1', '176');
    expect(connectorElement).toHaveAttribute('y1', '60');
    expect(sourceElement).toBeInTheDocument();

    fireEvent.pointerDown(sourceElement!, { button: 0, clientX: 80, clientY: 56, pointerId: 14 });
    fireEvent.pointerMove(overlayElement, { clientX: 120, clientY: 76, pointerId: 14 });

    expect(
      overlayElement.querySelector<SVGLineElement>('[data-marginalia-annotation-id="annotation-connector"]'),
    ).toHaveAttribute('x1', '216');
    expect(
      overlayElement.querySelector<SVGLineElement>('[data-marginalia-annotation-id="annotation-connector"]'),
    ).toHaveAttribute('y1', '80');

    fireEvent.pointerUp(overlayElement, { pointerId: 14 });

    expect(onMoveAnnotation).toHaveBeenCalledWith('annotation-source', {
      x: 56,
      y: 44,
      width: 160,
      height: 72,
    });
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
