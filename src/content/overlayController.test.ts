import { fireEvent, screen } from '@testing-library/react';

import {
  buildCircleAnnotation,
  buildConnectorAnnotation,
  buildEllipseAnnotation,
  buildRectangleAnnotation,
  buildStickyNoteAnnotation,
  buildTextAnnotation,
} from '@/test/factories';
import type { AnnotationContent } from '@/shared/models/annotations';

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

const getRotationHandle = (): SVGCircleElement | null =>
  getOverlayElement().querySelector<SVGCircleElement>('[data-marginalia-rotation-handle="true"]');

const getConnectorHandle = (endpoint: 'source' | 'target'): SVGCircleElement | null =>
  getOverlayElement().querySelector<SVGCircleElement>(
    `[data-marginalia-connector-handle="${endpoint}"] [data-marginalia-connector-handle-visual="true"]`,
  );

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

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

  it('renders supported annotations inertly for future editing work', () => {
    const controller = createOverlayController(document, window);

    controller.setAnnotations([
      buildCircleAnnotation('circle-1'),
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
    expect(overlayElement.querySelector('[data-marginalia-annotation-id="circle-1"]')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Circle (Shift+O)' })).toBeInTheDocument();
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
      rotation: 0,
      text: '',
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
      rotation: 0,
      color: 'green',
      text: '',
    });
    expect(getDraftEllipse()).not.toBeInTheDocument();
  });

  it('creates constrained circle annotations from pointer interactions', () => {
    const onCreateAnnotation = vi.fn();
    const controller = createOverlayController(document, window, { onCreateAnnotation });

    controller.setInteractive(true);
    controller.setActiveTool('circle');

    const overlayElement = getOverlayElement();

    fireEvent.pointerDown(overlayElement, { button: 0, clientX: 160, clientY: 120, pointerId: 21 });
    fireEvent.pointerMove(overlayElement, { clientX: 120, clientY: 40, pointerId: 21 });

    expect(getDraftEllipse()).toHaveAttribute('cx', '120');
    expect(getDraftEllipse()).toHaveAttribute('cy', '80');
    expect(getDraftEllipse()).toHaveAttribute('rx', '40');
    expect(getDraftEllipse()).toHaveAttribute('ry', '40');

    fireEvent.pointerUp(overlayElement, { pointerId: 21 });

    expect(onCreateAnnotation).toHaveBeenCalledWith({
      kind: 'circle',
      x: 80,
      y: 40,
      width: 80,
      height: 80,
      rotation: 0,
      color: 'pink',
      text: '',
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
      rotation: 0,
      color: 'blue',
      borderVisible: false,
      text: 'Text annotation',
    });
  });

  it('renders text annotations without a visible border until selected', () => {
    const controller = createOverlayController(document, window);

    controller.setAnnotations([buildTextAnnotation('annotation-text')]);

    const hitTarget = getOverlayElement().querySelector<SVGRectElement>(
      '[data-marginalia-annotation-id="annotation-text"] rect',
    );

    expect(hitTarget).toHaveAttribute('stroke', 'transparent');
    expect(hitTarget).toHaveAttribute('fill-opacity', '0.001');
  });

  it('updates text border visibility from toolbar controls and keeps it visible when deselected', async () => {
    const onEditAnnotation = vi.fn((annotationId: string, content: AnnotationContent) => {
      if (content.kind !== 'text') {
        throw new Error('Expected text annotation content');
      }

      const updatedAnnotation = buildTextAnnotation(annotationId, { content });
      controller.setAnnotations([updatedAnnotation]);

      return Promise.resolve();
    });

    const controller = createOverlayController(document, window, { onEditAnnotation });
    controller.setAnnotations([buildTextAnnotation('annotation-text')]);
    controller.setInteractive(true);
    controller.setActiveTool('select');

    const annotationElement = getOverlayElement().querySelector('[data-marginalia-annotation-id="annotation-text"]');

    fireEvent.pointerDown(annotationElement!, { button: 0, pointerId: 12 });

    const borderToggle = screen.getByRole('checkbox', { name: 'Keep text annotation border visible' });
    expect(borderToggle).not.toBeChecked();

    fireEvent.click(borderToggle);
    await flushMicrotasks();

    expect(onEditAnnotation).toHaveBeenCalledWith(
      'annotation-text',
      expect.objectContaining({
        kind: 'text',
        borderVisible: true,
      }),
    );

    controller.setSelection(null);

    const hitTarget = getOverlayElement().querySelector<SVGRectElement>(
      '[data-marginalia-annotation-id="annotation-text"] rect',
    );

    expect(hitTarget).toHaveAttribute('stroke', '#3b82f6');
    expect(hitTarget).toHaveAttribute('fill-opacity', '0.02');
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
      rotation: 0,
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

  it('selects connectors in select mode and shows direct anchor handles', () => {
    const controller = createOverlayController(document, window);

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
          targetAnchor: 'left',
        },
      }),
    ]);
    controller.setInteractive(true);
    controller.setActiveTool('select');

    const connectorElement = getOverlayElement().querySelector('[data-marginalia-annotation-id="annotation-connector"]');

    expect(connectorElement).toBeInTheDocument();

    fireEvent.pointerDown(connectorElement!, { button: 0, clientX: 176, clientY: 60, pointerId: 31 });

    expect(getOverlayElement()).toHaveAttribute('data-selection', 'single');
    expect(screen.getByText('Select tool active. Selected Connector annotation.')).toBeInTheDocument();
    expect(getConnectorHandle('source')).toHaveAttribute('cx', '176');
    expect(getConnectorHandle('source')).toHaveAttribute('cy', '60');
    expect(getConnectorHandle('target')).toHaveAttribute('cx', '260');
    expect(getConnectorHandle('target')).toHaveAttribute('cy', '88');
  });

  it('starts inline editing immediately after creating a text annotation', async () => {
    const onEditAnnotation = vi.fn();
    const onCreateAnnotation = vi.fn((content: AnnotationContent) => {
      expect(content.kind).toBe('text');
      if (content.kind !== 'text') {
        throw new Error('Expected text annotation content');
      }
      const createdAnnotation = buildTextAnnotation('annotation-text-new', { content });
      controller.setAnnotations([createdAnnotation]);

      return Promise.resolve(createdAnnotation);
    });

    const controller = createOverlayController(document, window, { onCreateAnnotation, onEditAnnotation });
    controller.setInteractive(true);
    controller.setActiveTool('text');

    fireEvent.pointerDown(getOverlayElement(), { button: 0, clientX: 42, clientY: 64, pointerId: 3 });
    await flushMicrotasks();

    expect(getOverlayElement()).toHaveAttribute('data-active-tool', 'select');
    expect(screen.getByText('Select tool active. Selected Text annotation.')).toBeInTheDocument();
    const editor = screen.getByLabelText('Text annotation editor');
    expect(editor).toHaveValue('Text annotation');
    expect(screen.getByRole('checkbox', { name: 'Keep text annotation border visible' })).not.toBeChecked();

    fireEvent.input(editor, {
      target: { value: 'Updated annotation copy' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Keep text annotation border visible' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save text' }));
    await flushMicrotasks();

    expect(onEditAnnotation).toHaveBeenCalledWith(
      'annotation-text-new',
      expect.objectContaining({
        kind: 'text',
        borderVisible: true,
        text: 'Updated annotation copy',
      }),
    );
  });

  it('opens sticky note editor controls immediately after creation', async () => {
    const onCreateAnnotation = vi.fn((content: AnnotationContent) => {
      if (content.kind !== 'sticky-note') {
        throw new Error('Expected sticky note annotation content');
      }

      expect(content).toMatchObject({
        kind: 'sticky-note',
        title: 'Sticky note',
        text: 'New note',
      });

      const createdAnnotation = buildStickyNoteAnnotation('annotation-sticky-note-new', { content });
      controller.setAnnotations([createdAnnotation]);

      return Promise.resolve(createdAnnotation);
    });

    const controller = createOverlayController(document, window, { onCreateAnnotation });
    controller.setInteractive(true);
    controller.setActiveTool('sticky-note');

    fireEvent.pointerDown(getOverlayElement(), { button: 0, clientX: 90, clientY: 110, pointerId: 9 });
    await flushMicrotasks();

    expect(getOverlayElement()).toHaveAttribute('data-active-tool', 'select');
    expect(screen.getByText('Select tool active. Selected Sticky note annotation.')).toBeInTheDocument();
    expect(screen.getByText('Sticky note editor')).toBeInTheDocument();
    expect(screen.getByLabelText('Sticky note title')).toHaveValue('Sticky note');
    expect(screen.getByLabelText('Sticky note text')).toHaveValue('New note');
    expect(screen.getByRole('button', { name: 'Save note' })).toBeInTheDocument();
  });

  it('falls back to select mode and opens inline editing after creating rectangles', async () => {
    const onCreateAnnotation = vi.fn((content: AnnotationContent) => {
      if (content.kind !== 'rectangle') {
        throw new Error('Expected rectangle annotation content');
      }

      const createdAnnotation = buildRectangleAnnotation('annotation-rectangle-new', { content });
      controller.setAnnotations([createdAnnotation]);

      return Promise.resolve(createdAnnotation);
    });

    const controller = createOverlayController(document, window, { onCreateAnnotation });
    controller.setInteractive(true);

    const overlayElement = getOverlayElement();
    fireEvent.pointerDown(overlayElement, { button: 0, clientX: 40, clientY: 50, pointerId: 41 });
    fireEvent.pointerMove(overlayElement, { clientX: 140, clientY: 110, pointerId: 41 });
    fireEvent.pointerUp(overlayElement, { pointerId: 41 });
    await flushMicrotasks();

    expect(getOverlayElement()).toHaveAttribute('data-active-tool', 'select');
    expect(screen.getByText('Select tool active. Selected Rectangle annotation.')).toBeInTheDocument();
    expect(screen.getByLabelText('Rectangle text editor')).toHaveValue('');
  });

  it('opens editor controls on double click for sticky notes and cancels cleanly', () => {
    const onEditAnnotation = vi.fn();
    const controller = createOverlayController(document, window, { onEditAnnotation });

    controller.setAnnotations([buildStickyNoteAnnotation('annotation-sticky-note')]);
    controller.setInteractive(true);
    controller.setActiveTool('select');

    const annotationElement = getOverlayElement().querySelector(
      '[data-marginalia-annotation-id="annotation-sticky-note"]',
    );

    fireEvent.doubleClick(annotationElement!);

    expect(screen.getByLabelText('Sticky note title')).toHaveValue('Note');
    expect(screen.getByLabelText('Sticky note text')).toHaveValue('Remember this detail');

    fireEvent.input(screen.getByLabelText('Sticky note title'), { target: { value: 'Revised note' } });
    fireEvent.input(screen.getByLabelText('Sticky note text'), { target: { value: 'A better sticky note body' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel editing' }));

    expect(screen.queryByLabelText('Sticky note title')).not.toBeInTheDocument();
    expect(onEditAnnotation).not.toHaveBeenCalled();
  });

  it('edits rectangle text inline from canvas interactions', async () => {
    const onEditAnnotation = vi.fn();
    const controller = createOverlayController(document, window, { onEditAnnotation });

    controller.setAnnotations([
      buildRectangleAnnotation('annotation-rectangle', {
        content: {
          text: 'Before',
        },
      }),
    ]);
    controller.setInteractive(true);
    controller.setActiveTool('select');

    const annotationElement = getOverlayElement().querySelector(
      '[data-marginalia-annotation-id="annotation-rectangle"]',
    );

    fireEvent.doubleClick(annotationElement!);

    const editor = screen.getByLabelText('Rectangle text editor');
    expect(editor).toHaveValue('Before');

    fireEvent.input(editor, { target: { value: 'Inside shape' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save text' }));
    await flushMicrotasks();

    expect(onEditAnnotation).toHaveBeenCalledWith(
      'annotation-rectangle',
      expect.objectContaining({
        kind: 'rectangle',
        text: 'Inside shape',
      }),
    );
  });

  it('makes empty shape text editing obvious from the toolbar affordance', () => {
    const controller = createOverlayController(document, window);

    controller.setAnnotations([buildRectangleAnnotation('annotation-rectangle-empty')]);
    controller.setInteractive(true);
    controller.setActiveTool('select');

    const annotationElement = getOverlayElement().querySelector(
      '[data-marginalia-annotation-id="annotation-rectangle-empty"]',
    );

    fireEvent.pointerDown(annotationElement!, { button: 0, pointerId: 44 });

    expect(screen.getByText('Text & color')).toBeInTheDocument();
    expect(screen.getByText('No text yet — add a short label so this shape is easy to find again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add text' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add text' }));

    expect(screen.getByLabelText('Rectangle text editor')).toBeInTheDocument();
  });

  it('updates selected rectangle colors from the toolbar palette', async () => {
    const onEditAnnotation = vi.fn((annotationId: string, content: AnnotationContent) => {
      if (content.kind !== 'rectangle') {
        throw new Error('Expected rectangle annotation content');
      }

      controller.setAnnotations([buildRectangleAnnotation(annotationId, { content })]);

      return Promise.resolve();
    });

    const controller = createOverlayController(document, window, { onEditAnnotation });
    controller.setAnnotations([buildRectangleAnnotation('annotation-rectangle-color')]);
    controller.setInteractive(true);
    controller.setActiveTool('select');

    const annotationElement = getOverlayElement().querySelector(
      '[data-marginalia-annotation-id="annotation-rectangle-color"]',
    );

    fireEvent.pointerDown(annotationElement!, { button: 0, pointerId: 45 });
    fireEvent.click(screen.getByRole('button', { name: 'Set Rectangle color to orange' }));
    await flushMicrotasks();

    expect(onEditAnnotation).toHaveBeenCalledWith(
      'annotation-rectangle-color',
      expect.objectContaining({
        kind: 'rectangle',
        color: 'orange',
      }),
    );

    controller.setSelection(null);

    const rectangle = getOverlayElement().querySelector<SVGRectElement>(
      '[data-marginalia-annotation-id="annotation-rectangle-color"] rect',
    );
    expect(rectangle).toHaveAttribute('stroke', '#f97316');
  });

  it('updates selected annotation rotation from the toolbar transform controls', async () => {
    const onEditAnnotation = vi.fn((annotationId: string, content: AnnotationContent) => {
      if (content.kind !== 'rectangle') {
        throw new Error('Expected rectangle annotation content');
      }

      controller.setAnnotations([buildRectangleAnnotation(annotationId, { content })]);

      return Promise.resolve();
    });

    const controller = createOverlayController(document, window, { onEditAnnotation });
    controller.setAnnotations([buildRectangleAnnotation('annotation-rectangle-rotation')]);
    controller.setInteractive(true);
    controller.setActiveTool('select');

    const annotationElement = getOverlayElement().querySelector(
      '[data-marginalia-annotation-id="annotation-rectangle-rotation"]',
    );

    fireEvent.pointerDown(annotationElement!, { button: 0, pointerId: 46 });

    const rotationInput = screen.getByRole('spinbutton', { name: 'Annotation rotation' });
    expect(rotationInput).toHaveValue(0);
    expect(screen.getByRole('button', { name: 'Reset annotation rotation' })).toBeDisabled();

    fireEvent.change(rotationInput, { target: { value: '45' } });
    fireEvent.blur(rotationInput);
    await flushMicrotasks();

    expect(onEditAnnotation).toHaveBeenCalledWith(
      'annotation-rectangle-rotation',
      expect.objectContaining({
        kind: 'rectangle',
        rotation: 45,
      }),
    );
    expect(screen.getByRole('spinbutton', { name: 'Annotation rotation' })).toHaveValue(45);
    expect(screen.getByRole('button', { name: 'Reset annotation rotation' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Reset annotation rotation' }));
    await flushMicrotasks();

    expect(onEditAnnotation).toHaveBeenLastCalledWith(
      'annotation-rectangle-rotation',
      expect.objectContaining({
        kind: 'rectangle',
        rotation: 0,
      }),
    );
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
    expect(getRotationHandle()).toHaveAttribute('cx', '96');
    expect(getRotationHandle()).toHaveAttribute('cy', '6');

    fireEvent.pointerMove(overlayElement, { clientX: 120, clientY: 76, pointerId: 14 });

    expect(
      overlayElement.querySelector<SVGLineElement>('[data-marginalia-annotation-id="annotation-connector"]'),
    ).toHaveAttribute('x1', '216');
    expect(
      overlayElement.querySelector<SVGLineElement>('[data-marginalia-annotation-id="annotation-connector"]'),
    ).toHaveAttribute('y1', '80');
    expect(getRotationHandle()).toHaveAttribute('cx', '136');
    expect(getRotationHandle()).toHaveAttribute('cy', '26');

    fireEvent.pointerUp(overlayElement, { pointerId: 14 });

    expect(onMoveAnnotation).toHaveBeenCalledWith('annotation-source', {
      x: 56,
      y: 44,
      width: 160,
      height: 72,
    });
  });

  it('snaps rotation gestures to the nearest cardinal angle and keeps connectors aligned', async () => {
    const targetAnnotation = buildTextAnnotation('annotation-target', {
      content: {
        x: 260,
        y: 64,
      },
    });
    const connectorAnnotation = buildConnectorAnnotation('annotation-connector', {
      content: {
        sourceId: 'annotation-source',
        targetId: 'annotation-target',
      },
    });
    const onEditAnnotation = vi.fn((annotationId: string, content: AnnotationContent) => {
      if (content.kind !== 'rectangle') {
        throw new Error('Expected rectangle annotation content');
      }

      controller.setAnnotations([
        buildRectangleAnnotation(annotationId, { content }),
        targetAnnotation,
        connectorAnnotation,
      ]);

      return Promise.resolve();
    });

    const controller = createOverlayController(document, window, { onEditAnnotation });
    controller.setAnnotations([buildRectangleAnnotation('annotation-source'), targetAnnotation, connectorAnnotation]);
    controller.setInteractive(true);
    controller.setActiveTool('select');

    fireEvent.pointerDown(
      getOverlayElement().querySelector('[data-marginalia-annotation-id="annotation-source"]')!,
      { button: 0, pointerId: 29 },
    );

    expect(screen.getByRole('spinbutton', { name: 'Annotation rotation' })).toHaveValue(0);
    expect(screen.getByRole('button', { name: 'Reset annotation rotation' })).toBeDisabled();
    expect(getRotationHandle()).toBeInTheDocument();
    expect(
      getOverlayElement().querySelector('g[data-marginalia-layer="selection"]'),
    ).not.toHaveStyle({ pointerEvents: 'none' });
    expect(getRotationHandle()).toHaveStyle({ pointerEvents: 'all' });

    fireEvent.pointerDown(getRotationHandle()!, { button: 0, clientX: 96, clientY: 6, pointerId: 30 });

    expect(getOverlayElement()).toHaveAttribute('data-selection', 'single');
    expect(screen.getByText('Select tool active. Selected Rectangle annotation.')).toBeInTheDocument();

    fireEvent.pointerMove(getOverlayElement(), { clientX: 176, clientY: 54, pointerId: 30 });

    expect(
      getOverlayElement().querySelector('[data-marginalia-annotation-id="annotation-source"]'),
    ).toHaveAttribute('transform', 'rotate(90 96 60)');
    expect(getRotationHandle()).toHaveAttribute('cx', '150');
    expect(getRotationHandle()).toHaveAttribute('cy', '60');

    fireEvent.pointerUp(getOverlayElement(), { pointerId: 30 });
    await flushMicrotasks();

    expect(onEditAnnotation).toHaveBeenCalledWith(
      'annotation-source',
      expect.objectContaining({
        kind: 'rectangle',
        rotation: 90,
      }),
    );
    expect(
      getOverlayElement().querySelector('[data-marginalia-annotation-id="annotation-source"]'),
    ).toHaveAttribute('transform', 'rotate(90 96 60)');
    expect(
      getOverlayElement().querySelector<SVGLineElement>('[data-marginalia-annotation-id="annotation-connector"]'),
    ).toHaveAttribute('x1', '96');
    expect(
      getOverlayElement().querySelector<SVGLineElement>('[data-marginalia-annotation-id="annotation-connector"]'),
    ).toHaveAttribute('y1', '140');
  });

  it('repositions connector anchors by dragging the on-canvas endpoint handles', async () => {
    const onEditAnnotation = vi.fn((annotationId: string, content: AnnotationContent) => {
      if (content.kind !== 'connector') {
        throw new Error('Expected connector annotation content');
      }

      controller.setAnnotations([
        buildRectangleAnnotation('annotation-source'),
        buildTextAnnotation('annotation-target', {
          content: {
            x: 260,
            y: 64,
          },
        }),
        buildConnectorAnnotation(annotationId, { content }),
      ]);

      return Promise.resolve();
    });
    const controller = createOverlayController(document, window, { onEditAnnotation });

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
          targetAnchor: 'left',
        },
      }),
    ]);
    controller.setInteractive(true);
    controller.setActiveTool('select');

    fireEvent.pointerDown(
      getOverlayElement().querySelector('[data-marginalia-annotation-id="annotation-connector"]')!,
      { button: 0, clientX: 176, clientY: 60, pointerId: 41 },
    );

    expect(getConnectorHandle('source')).toHaveAttribute('cx', '176');
    expect(getConnectorHandle('source')).toHaveAttribute('cy', '60');

    fireEvent.pointerDown(getConnectorHandle('source')!, { button: 0, clientX: 176, clientY: 60, pointerId: 42 });
    fireEvent.pointerMove(getOverlayElement(), { clientX: 96, clientY: 24, pointerId: 42 });

    expect(
      getOverlayElement().querySelector<SVGLineElement>('[data-marginalia-annotation-id="annotation-connector"]'),
    ).toHaveAttribute('x1', '96');
    expect(
      getOverlayElement().querySelector<SVGLineElement>('[data-marginalia-annotation-id="annotation-connector"]'),
    ).toHaveAttribute('y1', '24');
    expect(getConnectorHandle('source')).toHaveAttribute('cx', '96');
    expect(getConnectorHandle('source')).toHaveAttribute('cy', '24');

    fireEvent.pointerUp(getOverlayElement(), { pointerId: 42 });
    await flushMicrotasks();

    expect(onEditAnnotation).toHaveBeenCalledWith(
      'annotation-connector',
      expect.objectContaining({
        kind: 'connector',
        sourceId: 'annotation-source',
        sourceAnchor: 'top',
        targetId: 'annotation-target',
        targetAnchor: 'left',
      }),
    );
    expect(getConnectorHandle('source')).toHaveAttribute('cx', '96');
    expect(getConnectorHandle('source')).toHaveAttribute('cy', '24');
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
