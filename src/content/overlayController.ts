import {
  isCanvasAnnotation,
  isConnectorAnnotation,
  type Annotation,
  type AnnotationContent,
  type AnnotationPalette,
  type CanvasAnnotation,
  type CanvasBounds,
  type ConnectorAnchor,
  type ConnectorAnnotation,
  type EllipseAnnotation,
  type RectangleAnnotation,
  type StickyNoteAnnotation,
  type TextAnnotation,
} from '@/shared/models/annotations';
import {
  ANNOTATION_TOOLS,
  type AnnotationCommand,
  type AnnotationTool,
} from '@/shared/runtime/messages';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export const OVERLAY_ELEMENT_ID = 'marginalia-overlay';
export const OVERLAY_TOOLBAR_ID = 'marginalia-overlay-toolbar';

const OVERLAY_Z_INDEX = '2147483647';
const MIN_RECT_SIZE = 8;
const ACCENT_COLOR = '#4f46e5';
const SELECTED_STROKE_COLOR = '#312e81';
const OVERLAY_CLEANUP_KEY = '__marginaliaOverlayCleanup';
const DEFAULT_TEXT_WIDTH = 220;
const DEFAULT_TEXT_HEIGHT = 56;
const DEFAULT_STICKY_NOTE_WIDTH = 220;
const DEFAULT_STICKY_NOTE_HEIGHT = 160;
const DEFAULT_CONNECTOR_COLOR: AnnotationPalette = 'purple';
const TOOL_LABELS: Record<AnnotationTool, string> = {
  select: 'Select',
  text: 'Text',
  'sticky-note': 'Sticky note',
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  connector: 'Connector',
};
const TOOL_HINTS: Record<AnnotationTool, string> = {
  select: 'Click an annotation to select it.',
  text: 'Click anywhere on the page to place a text annotation.',
  'sticky-note': 'Click anywhere on the page to place a sticky note.',
  rectangle: 'Drag anywhere on the page to draw a rectangle annotation.',
  ellipse: 'Drag anywhere on the page to draw an ellipse annotation.',
  connector: 'Click a source annotation, then click a target annotation to connect them.',
};
const PALETTE_COLORS: Record<AnnotationPalette, string> = {
  yellow: '#f59e0b',
  pink: '#ec4899',
  green: '#10b981',
  blue: '#3b82f6',
  orange: '#f97316',
  purple: '#8b5cf6',
};

export interface OverlayController {
  setInteractive(enabled: boolean): void;
  setAnnotations(annotations: Annotation[]): void;
  setActiveTool(tool: AnnotationTool): void;
  setSelection(annotationId: string | null): void;
  cancelCurrentAction(): boolean;
  runCommand(command: AnnotationCommand): void;
  syncToDocument(): void;
}

export interface OverlayControllerOptions {
  onCreateAnnotation?: (content: AnnotationContent) => Promise<void> | void;
  onRequestDisable?: () => Promise<void> | void;
  onRunCommand?: (command: AnnotationCommand) => Promise<void> | void;
  onSelectTool?: (tool: AnnotationTool) => Promise<void> | void;
  onSelectionChange?: (annotationId: string | null) => Promise<void> | void;
}

type OverlayWindow = Window & {
  [OVERLAY_CLEANUP_KEY]?: () => void;
};

type ShapeTool = Extract<AnnotationTool, 'ellipse' | 'rectangle'>;

const isSvgTag = (element: Element | null, tagName: string): boolean =>
  element?.tagName.toLowerCase() === tagName;

const getDocumentDimensions = (documentRef: Document) => {
  const { body, documentElement } = documentRef;

  return {
    height: Math.max(
      body?.scrollHeight ?? 0,
      body?.offsetHeight ?? 0,
      documentElement.scrollHeight,
      documentElement.offsetHeight,
      documentElement.clientHeight,
    ),
    width: Math.max(
      body?.scrollWidth ?? 0,
      body?.offsetWidth ?? 0,
      documentElement.scrollWidth,
      documentElement.offsetWidth,
      documentElement.clientWidth,
    ),
  };
};

const getAnnotationColor = (color?: AnnotationPalette): string => (color ? PALETTE_COLORS[color] : ACCENT_COLOR);

const normalizeBounds = (startX: number, startY: number, currentX: number, currentY: number): CanvasBounds => ({
  x: Math.min(startX, currentX),
  y: Math.min(startY, currentY),
  width: Math.abs(currentX - startX),
  height: Math.abs(currentY - startY),
});

const createTextAnnotationContent = (point: { x: number; y: number }): AnnotationContent => ({
  kind: 'text',
  x: point.x,
  y: point.y,
  width: DEFAULT_TEXT_WIDTH,
  height: DEFAULT_TEXT_HEIGHT,
  color: 'blue',
  text: 'Text annotation',
});

const createStickyNoteAnnotationContent = (point: { x: number; y: number }): AnnotationContent => ({
  kind: 'sticky-note',
  x: point.x,
  y: point.y,
  width: DEFAULT_STICKY_NOTE_WIDTH,
  height: DEFAULT_STICKY_NOTE_HEIGHT,
  color: 'yellow',
  collapsed: false,
  text: 'New note',
  title: 'Sticky note',
});

const isShapeTool = (tool: AnnotationTool): tool is ShapeTool => tool === 'rectangle' || tool === 'ellipse';

const resolveAnchorPoint = (bounds: CanvasBounds, anchor: ConnectorAnchor): { x: number; y: number } => {
  switch (anchor) {
    case 'top':
      return { x: bounds.x + bounds.width / 2, y: bounds.y };
    case 'right':
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 };
    case 'bottom':
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height };
    case 'left':
      return { x: bounds.x, y: bounds.y + bounds.height / 2 };
    case 'center':
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }
};

const resolveNearestAnchor = (bounds: CanvasBounds, point: { x: number; y: number }): ConnectorAnchor => {
  const anchors: ConnectorAnchor[] = ['top', 'right', 'bottom', 'left', 'center'];

  let nearestAnchor: ConnectorAnchor = 'center';
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const anchor of anchors) {
    const anchorPoint = resolveAnchorPoint(bounds, anchor);
    const distance = Math.hypot(point.x - anchorPoint.x, point.y - anchorPoint.y);

    if (distance < nearestDistance) {
      nearestAnchor = anchor;
      nearestDistance = distance;
    }
  }

  return nearestAnchor;
};

const setAnnotationElementState = (
  element: SVGElement,
  annotation: Annotation,
  interactive: boolean,
  activeTool: AnnotationTool,
  selected: boolean,
): void => {
  const clickable =
    interactive && (activeTool === 'select' || (activeTool === 'connector' && annotation.content.kind !== 'connector'));

  element.dataset.marginaliaAnnotationId = annotation.id;
  element.dataset.marginaliaAnnotationKind = annotation.type;
  element.dataset.marginaliaSelected = selected ? 'true' : 'false';
  element.style.pointerEvents = clickable ? 'auto' : 'none';
  element.style.cursor = clickable ? (activeTool === 'connector' ? 'crosshair' : 'pointer') : 'default';
};

const createRectangleElement = (
  documentRef: Document,
  annotation: RectangleAnnotation,
  interactive: boolean,
  activeTool: AnnotationTool,
  selected: boolean,
): SVGRectElement => {
  const rectangle = documentRef.createElementNS(SVG_NAMESPACE, 'rect');
  const strokeColor = selected ? SELECTED_STROKE_COLOR : getAnnotationColor(annotation.content.color);

  rectangle.setAttribute('x', `${annotation.content.x}`);
  rectangle.setAttribute('y', `${annotation.content.y}`);
  rectangle.setAttribute('width', `${annotation.content.width}`);
  rectangle.setAttribute('height', `${annotation.content.height}`);
  rectangle.setAttribute('rx', '6');
  rectangle.setAttribute('fill', strokeColor);
  rectangle.setAttribute('fill-opacity', selected ? '0.18' : '0.14');
  rectangle.setAttribute('stroke', strokeColor);
  rectangle.setAttribute('stroke-width', selected ? '3' : '2');
  rectangle.setAttribute('vector-effect', 'non-scaling-stroke');

  setAnnotationElementState(rectangle, annotation, interactive, activeTool, selected);

  return rectangle;
};

const createEllipseElement = (
  documentRef: Document,
  annotation: EllipseAnnotation,
  interactive: boolean,
  activeTool: AnnotationTool,
  selected: boolean,
): SVGEllipseElement => {
  const ellipse = documentRef.createElementNS(SVG_NAMESPACE, 'ellipse');
  const strokeColor = selected ? SELECTED_STROKE_COLOR : getAnnotationColor(annotation.content.color);

  ellipse.setAttribute('cx', `${annotation.content.x + annotation.content.width / 2}`);
  ellipse.setAttribute('cy', `${annotation.content.y + annotation.content.height / 2}`);
  ellipse.setAttribute('rx', `${annotation.content.width / 2}`);
  ellipse.setAttribute('ry', `${annotation.content.height / 2}`);
  ellipse.setAttribute('fill', strokeColor);
  ellipse.setAttribute('fill-opacity', selected ? '0.18' : '0.12');
  ellipse.setAttribute('stroke', strokeColor);
  ellipse.setAttribute('stroke-width', selected ? '3' : '2');
  ellipse.setAttribute('vector-effect', 'non-scaling-stroke');

  setAnnotationElementState(ellipse, annotation, interactive, activeTool, selected);

  return ellipse;
};

const createTextElement = (
  documentRef: Document,
  annotation: TextAnnotation,
  interactive: boolean,
  activeTool: AnnotationTool,
  selected: boolean,
): SVGGElement => {
  const group = documentRef.createElementNS(SVG_NAMESPACE, 'g');
  const accentColor = selected ? SELECTED_STROKE_COLOR : getAnnotationColor(annotation.content.color);
  const outline = documentRef.createElementNS(SVG_NAMESPACE, 'rect');
  const label = documentRef.createElementNS(SVG_NAMESPACE, 'text');

  outline.setAttribute('x', `${annotation.content.x}`);
  outline.setAttribute('y', `${annotation.content.y}`);
  outline.setAttribute('width', `${annotation.content.width}`);
  outline.setAttribute('height', `${annotation.content.height}`);
  outline.setAttribute('rx', '8');
  outline.setAttribute('fill', '#ffffff');
  outline.setAttribute('fill-opacity', '0.9');
  outline.setAttribute('stroke', accentColor);
  outline.setAttribute('stroke-width', selected ? '3' : '1.5');
  outline.setAttribute('stroke-dasharray', '6 4');
  outline.setAttribute('vector-effect', 'non-scaling-stroke');

  label.setAttribute('x', `${annotation.content.x + 12}`);
  label.setAttribute('y', `${annotation.content.y + 12}`);
  label.setAttribute('fill', '#0f172a');
  label.setAttribute('font-size', '15');
  label.setAttribute('font-family', 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
  label.setAttribute('dominant-baseline', 'hanging');
  label.textContent = annotation.content.text;

  group.append(outline, label);
  setAnnotationElementState(group, annotation, interactive, activeTool, selected);

  return group;
};

const createStickyNoteElement = (
  documentRef: Document,
  annotation: StickyNoteAnnotation,
  interactive: boolean,
  activeTool: AnnotationTool,
  selected: boolean,
): SVGGElement => {
  const group = documentRef.createElementNS(SVG_NAMESPACE, 'g');
  const accentColor = selected ? SELECTED_STROKE_COLOR : getAnnotationColor(annotation.content.color);
  const note = documentRef.createElementNS(SVG_NAMESPACE, 'rect');
  const title = documentRef.createElementNS(SVG_NAMESPACE, 'text');
  const body = documentRef.createElementNS(SVG_NAMESPACE, 'text');

  note.setAttribute('x', `${annotation.content.x}`);
  note.setAttribute('y', `${annotation.content.y}`);
  note.setAttribute('width', `${annotation.content.width}`);
  note.setAttribute('height', `${annotation.content.height}`);
  note.setAttribute('rx', '10');
  note.setAttribute('fill', accentColor);
  note.setAttribute('fill-opacity', annotation.content.collapsed ? '0.4' : '0.2');
  note.setAttribute('stroke', accentColor);
  note.setAttribute('stroke-width', selected ? '3' : '2');
  note.setAttribute('vector-effect', 'non-scaling-stroke');

  title.setAttribute('x', `${annotation.content.x + 12}`);
  title.setAttribute('y', `${annotation.content.y + 10}`);
  title.setAttribute('fill', '#0f172a');
  title.setAttribute('font-size', '12');
  title.setAttribute('font-weight', '700');
  title.setAttribute('font-family', 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
  title.setAttribute('dominant-baseline', 'hanging');
  title.textContent = annotation.content.title ?? 'Sticky note';

  body.setAttribute('x', `${annotation.content.x + 12}`);
  body.setAttribute('y', `${annotation.content.y + 30}`);
  body.setAttribute('fill', '#1e293b');
  body.setAttribute('font-size', '12');
  body.setAttribute('font-family', 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
  body.setAttribute('dominant-baseline', 'hanging');
  body.textContent = annotation.content.collapsed ? 'Collapsed note' : annotation.content.text;

  group.append(note, title, body);
  setAnnotationElementState(group, annotation, interactive, activeTool, selected);

  return group;
};

const createConnectorElement = (
  documentRef: Document,
  annotation: ConnectorAnnotation,
  interactive: boolean,
  activeTool: AnnotationTool,
  selected: boolean,
  canvasAnnotationsById: Map<string, CanvasAnnotation>,
): SVGLineElement | null => {
  const source = canvasAnnotationsById.get(annotation.content.sourceId);
  const target = canvasAnnotationsById.get(annotation.content.targetId);

  if (!source || !target) {
    return null;
  }

  const strokeColor = selected ? SELECTED_STROKE_COLOR : getAnnotationColor(annotation.content.color);
  const start = resolveAnchorPoint(source.content, annotation.content.sourceAnchor);
  const end = resolveAnchorPoint(target.content, annotation.content.targetAnchor);
  const connector = documentRef.createElementNS(SVG_NAMESPACE, 'line');

  connector.setAttribute('x1', `${start.x}`);
  connector.setAttribute('y1', `${start.y}`);
  connector.setAttribute('x2', `${end.x}`);
  connector.setAttribute('y2', `${end.y}`);
  connector.setAttribute('stroke', strokeColor);
  connector.setAttribute('stroke-width', selected ? '3' : '2');
  connector.setAttribute('stroke-dasharray', annotation.content.label ? '0' : '8 6');
  connector.setAttribute('vector-effect', 'non-scaling-stroke');

  setAnnotationElementState(connector, annotation, interactive, activeTool, selected);

  return connector;
};

const createAnnotationElement = (
  documentRef: Document,
  annotation: Annotation,
  interactive: boolean,
  activeTool: AnnotationTool,
  selectedAnnotationId: string | null,
  canvasAnnotationsById: Map<string, CanvasAnnotation>,
): SVGElement | null => {
  const selected = annotation.id === selectedAnnotationId;

  if (isConnectorAnnotation(annotation)) {
    return createConnectorElement(documentRef, annotation, interactive, activeTool, selected, canvasAnnotationsById);
  }

  switch (annotation.type) {
    case 'rectangle':
      return createRectangleElement(documentRef, annotation, interactive, activeTool, selected);
    case 'ellipse':
      return createEllipseElement(documentRef, annotation, interactive, activeTool, selected);
    case 'text':
      return createTextElement(documentRef, annotation, interactive, activeTool, selected);
    case 'sticky-note':
      return createStickyNoteElement(documentRef, annotation, interactive, activeTool, selected);
  }
};

export const createOverlayController = (
  documentRef: Document = document,
  windowRef: Window = window,
  controllerOptions: OverlayControllerOptions = {},
): OverlayController => {
  const overlayWindow = windowRef as OverlayWindow;

  overlayWindow[OVERLAY_CLEANUP_KEY]?.();

  let overlayElement: SVGSVGElement | null = null;
  let annotationsLayer: SVGGElement | null = null;
  let draftLayer: SVGGElement | null = null;
  let draftShapeElement: SVGElement | null = null;
  let toolbarElement: HTMLDivElement | null = null;
  let toolbarHintElement: HTMLParagraphElement | null = null;
  let toolbarStatusElement: HTMLParagraphElement | null = null;
  let toolbarDeleteButtonElement: HTMLButtonElement | null = null;
  let toolbarToolButtons = new Map<AnnotationTool, HTMLButtonElement>();
  let interactive = false;
  let annotations: Annotation[] = [];
  let activeTool: AnnotationTool = 'rectangle';
  let selectedAnnotationId: string | null = null;
  let draftPointerId: number | null = null;
  let draftStartPoint: { x: number; y: number } | null = null;
  let draftShapeKind: ShapeTool | null = null;
  let draftBounds: CanvasBounds | null = null;
  let connectorSourceAnnotationId: string | null = null;
  let connectorSourceAnchor: ConnectorAnchor | null = null;
  let connectorPreviewPoint: { x: number; y: number } | null = null;

  const getShouldRenderOverlay = (): boolean => interactive || annotations.length > 0 || draftStartPoint !== null;

  const toPagePoint = (event: PointerEvent): { x: number; y: number } => ({
    x: event.clientX + windowRef.scrollX,
    y: event.clientY + windowRef.scrollY,
  });

  const getSelectedAnnotation = (): Annotation | undefined =>
    selectedAnnotationId ? annotations.find((annotation) => annotation.id === selectedAnnotationId) : undefined;

  const getCanvasAnnotationById = (annotationId: string | null): CanvasAnnotation | undefined => {
    if (!annotationId) {
      return undefined;
    }

    const annotation = annotations.find((candidate) => candidate.id === annotationId);

    return annotation && isCanvasAnnotation(annotation) ? annotation : undefined;
  };

  const getPendingConnectorSourceAnnotation = (): CanvasAnnotation | undefined =>
    getCanvasAnnotationById(connectorSourceAnnotationId);

  const clearDraftShape = (): boolean => {
    const hadDraft =
      draftStartPoint !== null ||
      draftShapeElement !== null ||
      draftPointerId !== null ||
      draftBounds !== null ||
      draftShapeKind !== null;

    draftPointerId = null;
    draftStartPoint = null;
    draftShapeKind = null;
    draftBounds = null;
    draftShapeElement?.remove();
    draftShapeElement = null;

    return hadDraft;
  };

  const clearConnectorDraft = (): boolean => {
    const hadConnectorDraft =
      connectorSourceAnnotationId !== null || connectorSourceAnchor !== null || connectorPreviewPoint !== null;

    connectorSourceAnnotationId = null;
    connectorSourceAnchor = null;
    connectorPreviewPoint = null;

    return hadConnectorDraft;
  };

  const setSelection = (annotationId: string | null, notify = false): boolean => {
    if (selectedAnnotationId === annotationId) {
      return false;
    }

    selectedAnnotationId = annotationId;

    if (notify) {
      void controllerOptions.onSelectionChange?.(annotationId);
    }

    return true;
  };

  const ensureToolbarMounted = (): HTMLDivElement | null => {
    if (!interactive) {
      toolbarElement?.remove();
      toolbarElement = null;
      toolbarHintElement = null;
      toolbarStatusElement = null;
      toolbarDeleteButtonElement = null;
      toolbarToolButtons = new Map<AnnotationTool, HTMLButtonElement>();

      return null;
    }

    if (toolbarElement?.isConnected) {
      return toolbarElement;
    }

    const body = documentRef.body;

    if (!body) {
      return null;
    }

    toolbarElement = documentRef.createElement('div');
    toolbarElement.id = OVERLAY_TOOLBAR_ID;
    toolbarElement.dataset.marginaliaToolbar = 'true';
    toolbarElement.style.position = 'fixed';
    toolbarElement.style.top = '16px';
    toolbarElement.style.right = '16px';
    toolbarElement.style.zIndex = OVERLAY_Z_INDEX;
    toolbarElement.style.width = '320px';
    toolbarElement.style.padding = '12px';
    toolbarElement.style.borderRadius = '12px';
    toolbarElement.style.background = 'rgba(15, 23, 42, 0.92)';
    toolbarElement.style.color = '#f8fafc';
    toolbarElement.style.boxShadow = '0 12px 32px rgba(15, 23, 42, 0.28)';
    toolbarElement.style.backdropFilter = 'blur(6px)';
    toolbarElement.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    toolbarElement.style.lineHeight = '1.4';

    const titleElement = documentRef.createElement('p');
    titleElement.textContent = 'Marginalia annotation mode';
    titleElement.style.margin = '0';
    titleElement.style.fontSize = '14px';
    titleElement.style.fontWeight = '600';
    toolbarElement.append(titleElement);

    toolbarHintElement = documentRef.createElement('p');
    toolbarHintElement.style.margin = '8px 0 0';
    toolbarHintElement.style.fontSize = '13px';
    toolbarHintElement.style.color = '#cbd5e1';
    toolbarElement.append(toolbarHintElement);

    const toolPaletteElement = documentRef.createElement('div');
    toolPaletteElement.style.display = 'grid';
    toolPaletteElement.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    toolPaletteElement.style.gap = '8px';
    toolPaletteElement.style.marginTop = '12px';

    toolbarToolButtons = new Map<AnnotationTool, HTMLButtonElement>();
    for (const tool of ANNOTATION_TOOLS) {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.textContent = TOOL_LABELS[tool];
      button.dataset.marginaliaTool = tool;
      button.style.padding = '8px 10px';
      button.style.borderRadius = '10px';
      button.style.border = '1px solid rgba(148, 163, 184, 0.32)';
      button.style.background = 'rgba(15, 23, 42, 0.72)';
      button.style.color = '#e2e8f0';
      button.style.cursor = 'pointer';
      button.style.font = 'inherit';
      button.addEventListener('click', () => {
        if (activeTool !== tool) {
          activeTool = tool;
        }

        if (tool !== 'select') {
          setSelection(null, true);
        }

        clearDraftShape();
        clearConnectorDraft();
        syncToDocument();
        void controllerOptions.onSelectTool?.(tool);
      });
      toolPaletteElement.append(button);
      toolbarToolButtons.set(tool, button);
    }
    toolbarElement.append(toolPaletteElement);

    toolbarStatusElement = documentRef.createElement('p');
    toolbarStatusElement.style.margin = '12px 0 0';
    toolbarStatusElement.style.fontSize = '12px';
    toolbarStatusElement.style.color = '#a5b4fc';
    toolbarElement.append(toolbarStatusElement);

    toolbarDeleteButtonElement = documentRef.createElement('button');
    toolbarDeleteButtonElement.type = 'button';
    toolbarDeleteButtonElement.textContent = 'Delete selected';
    toolbarDeleteButtonElement.style.marginTop = '12px';
    toolbarDeleteButtonElement.style.marginRight = '8px';
    toolbarDeleteButtonElement.style.padding = '8px 12px';
    toolbarDeleteButtonElement.style.border = '1px solid rgba(248, 113, 113, 0.5)';
    toolbarDeleteButtonElement.style.borderRadius = '999px';
    toolbarDeleteButtonElement.style.background = 'rgba(127, 29, 29, 0.35)';
    toolbarDeleteButtonElement.style.color = '#fee2e2';
    toolbarDeleteButtonElement.style.cursor = 'pointer';
    toolbarDeleteButtonElement.style.font = 'inherit';
    toolbarDeleteButtonElement.addEventListener('click', () => {
      if (!selectedAnnotationId) {
        return;
      }

      void controllerOptions.onRunCommand?.('delete-selected-annotation');
    });
    toolbarElement.append(toolbarDeleteButtonElement);

    const doneButton = documentRef.createElement('button');
    doneButton.type = 'button';
    doneButton.textContent = 'Done';
    doneButton.style.marginTop = '12px';
    doneButton.style.padding = '8px 12px';
    doneButton.style.border = '0';
    doneButton.style.borderRadius = '999px';
    doneButton.style.background = '#eef2ff';
    doneButton.style.color = '#312e81';
    doneButton.style.cursor = 'pointer';
    doneButton.style.font = 'inherit';
    doneButton.addEventListener('click', () => {
      void controllerOptions.onRequestDisable?.();
    });
    toolbarElement.append(doneButton);

    body.append(toolbarElement);

    return toolbarElement;
  };

  const updateToolbar = (): void => {
    const mountedToolbar = ensureToolbarMounted();

    if (!mountedToolbar || !toolbarHintElement || !toolbarStatusElement || !toolbarDeleteButtonElement) {
      return;
    }

    toolbarHintElement.textContent = TOOL_HINTS[activeTool];
    for (const [tool, button] of toolbarToolButtons) {
      const active = tool === activeTool;
      button.dataset.active = active ? 'true' : 'false';
      button.style.background = active ? '#4338ca' : 'rgba(15, 23, 42, 0.72)';
      button.style.borderColor = active ? '#818cf8' : 'rgba(148, 163, 184, 0.32)';
      button.style.color = active ? '#eef2ff' : '#e2e8f0';
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    const selectedAnnotation = getSelectedAnnotation();
    const pendingConnectorSourceAnnotation = getPendingConnectorSourceAnnotation();
    toolbarStatusElement.textContent =
      activeTool === 'connector' && pendingConnectorSourceAnnotation
        ? `Connector tool active. Source ${TOOL_LABELS[pendingConnectorSourceAnnotation.type]} annotation selected. Click another annotation to finish.`
        : selectedAnnotation
          ? `${TOOL_LABELS[activeTool]} tool active. Selected ${TOOL_LABELS[selectedAnnotation.type]} annotation.`
          : `${TOOL_LABELS[activeTool]} tool active. ${
              annotations.length === 0
                ? 'No annotations on this page yet.'
                : `${annotations.length} annotation${annotations.length === 1 ? '' : 's'} on this page.`
            }`;
    toolbarDeleteButtonElement.disabled = selectedAnnotation === undefined;
    toolbarDeleteButtonElement.style.opacity = selectedAnnotation ? '1' : '0.5';
    toolbarDeleteButtonElement.style.cursor = selectedAnnotation ? 'pointer' : 'not-allowed';
  };

  const ensureMounted = (): SVGSVGElement | null => {
    if (!getShouldRenderOverlay()) {
      return null;
    }

    if (overlayElement?.isConnected) {
      return overlayElement;
    }

    const body = documentRef.body;

    if (!body) {
      return null;
    }

    overlayElement = documentRef.createElementNS(SVG_NAMESPACE, 'svg');
    overlayElement.id = OVERLAY_ELEMENT_ID;
    overlayElement.dataset.marginaliaOverlay = 'true';
    overlayElement.style.position = 'fixed';
    overlayElement.style.inset = '0';
    overlayElement.style.zIndex = OVERLAY_Z_INDEX;
    overlayElement.style.overflow = 'visible';
    overlayElement.style.pointerEvents = interactive ? 'auto' : 'none';
    overlayElement.style.touchAction = 'none';

    annotationsLayer = documentRef.createElementNS(SVG_NAMESPACE, 'g');
    annotationsLayer.dataset.marginaliaLayer = 'annotations';
    overlayElement.append(annotationsLayer);

    draftLayer = documentRef.createElementNS(SVG_NAMESPACE, 'g');
    draftLayer.dataset.marginaliaLayer = 'drafts';
    overlayElement.append(draftLayer);

    overlayElement.addEventListener('pointerdown', handlePointerDown);
    overlayElement.addEventListener('pointermove', handlePointerMove);
    overlayElement.addEventListener('pointerup', handlePointerUp);
    overlayElement.addEventListener('pointercancel', handlePointerCancel);

    body.append(overlayElement);

    return overlayElement;
  };

  const renderAnnotations = (): void => {
    if (!annotationsLayer) {
      return;
    }

    const canvasAnnotationsById = new Map(
      annotations
        .filter(isCanvasAnnotation)
        .map((annotation) => [annotation.id, annotation] as const),
    );
    const connectorElements: SVGElement[] = [];
    const annotationElements: SVGElement[] = [];

    for (const annotation of annotations) {
      const element = createAnnotationElement(
        documentRef,
        annotation,
        interactive,
        activeTool,
        annotation.id === connectorSourceAnnotationId ? annotation.id : selectedAnnotationId,
        canvasAnnotationsById,
      );

      if (!element) {
        continue;
      }

      if (isConnectorAnnotation(annotation)) {
        connectorElements.push(element);
      } else {
        annotationElements.push(element);
      }
    }

    annotationsLayer.replaceChildren(...connectorElements, ...annotationElements);

    if (draftLayer) {
      draftLayer.replaceChildren(...(draftShapeElement ? [draftShapeElement] : []));
    }

    const pendingConnectorSourceAnnotation = getPendingConnectorSourceAnnotation();

    if (!draftLayer || !pendingConnectorSourceAnnotation || !connectorSourceAnchor || !connectorPreviewPoint) {
      return;
    }

    const start = resolveAnchorPoint(pendingConnectorSourceAnnotation.content, connectorSourceAnchor);
    const draftConnectorElement = documentRef.createElementNS(SVG_NAMESPACE, 'line');
    draftConnectorElement.setAttribute('x1', `${start.x}`);
    draftConnectorElement.setAttribute('y1', `${start.y}`);
    draftConnectorElement.setAttribute('x2', `${connectorPreviewPoint.x}`);
    draftConnectorElement.setAttribute('y2', `${connectorPreviewPoint.y}`);
    draftConnectorElement.setAttribute('stroke', ACCENT_COLOR);
    draftConnectorElement.setAttribute('stroke-width', '2');
    draftConnectorElement.setAttribute('stroke-dasharray', '8 6');
    draftConnectorElement.setAttribute('stroke-opacity', '0.7');
    draftConnectorElement.setAttribute('vector-effect', 'non-scaling-stroke');
    draftConnectorElement.style.pointerEvents = 'none';
    draftLayer.append(draftConnectorElement);
  };

  const syncToDocument = (): void => {
    if (!getShouldRenderOverlay()) {
      overlayElement?.remove();
      overlayElement = null;
      annotationsLayer = null;
      draftLayer = null;
      clearDraftShape();
      updateToolbar();

      return;
    }

    const mountedOverlay = ensureMounted();

    if (!mountedOverlay) {
      return;
    }

    const { height, width } = getDocumentDimensions(documentRef);

    mountedOverlay.setAttribute('width', `${width}`);
    mountedOverlay.setAttribute('height', `${height}`);
    mountedOverlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
    mountedOverlay.style.width = `${width}px`;
    mountedOverlay.style.height = `${height}px`;
    mountedOverlay.style.transform = `translate(${-windowRef.scrollX}px, ${-windowRef.scrollY}px)`;
    mountedOverlay.dataset.mode = interactive ? 'interactive' : 'inert';
    mountedOverlay.dataset.activeTool = activeTool;
    mountedOverlay.dataset.selection = selectedAnnotationId ? 'single' : 'none';
    mountedOverlay.style.pointerEvents = interactive ? 'auto' : 'none';
    renderAnnotations();
    updateToolbar();
  };

  const updateDraftShape = (tool: ShapeTool, bounds: CanvasBounds): void => {
    draftShapeKind = tool;
    draftBounds = bounds;

    if (
      draftShapeElement &&
      ((tool === 'rectangle' && !isSvgTag(draftShapeElement, 'rect')) ||
        (tool === 'ellipse' && !isSvgTag(draftShapeElement, 'ellipse')))
    ) {
      draftShapeElement.remove();
      draftShapeElement = null;
    }

    if (!draftShapeElement) {
      ensureMounted();

      if (!draftLayer) {
        return;
      }

      draftShapeElement = documentRef.createElementNS(SVG_NAMESPACE, tool === 'rectangle' ? 'rect' : 'ellipse');
      draftShapeElement.setAttribute('fill', ACCENT_COLOR);
      draftShapeElement.setAttribute('fill-opacity', '0.08');
      draftShapeElement.setAttribute('stroke', ACCENT_COLOR);
      draftShapeElement.setAttribute('stroke-width', '2');
      draftShapeElement.setAttribute('stroke-dasharray', '6 4');
      draftShapeElement.setAttribute('vector-effect', 'non-scaling-stroke');
      draftShapeElement.style.pointerEvents = 'none';

      if (isSvgTag(draftShapeElement, 'rect')) {
        draftShapeElement.setAttribute('rx', '6');
      }

      draftLayer.append(draftShapeElement);
    }

    if (isSvgTag(draftShapeElement, 'rect')) {
      draftShapeElement.setAttribute('x', `${bounds.x}`);
      draftShapeElement.setAttribute('y', `${bounds.y}`);
      draftShapeElement.setAttribute('width', `${bounds.width}`);
      draftShapeElement.setAttribute('height', `${bounds.height}`);
      return;
    }

    if (isSvgTag(draftShapeElement, 'ellipse')) {
      draftShapeElement.setAttribute('cx', `${bounds.x + bounds.width / 2}`);
      draftShapeElement.setAttribute('cy', `${bounds.y + bounds.height / 2}`);
      draftShapeElement.setAttribute('rx', `${bounds.width / 2}`);
      draftShapeElement.setAttribute('ry', `${bounds.height / 2}`);
    }
  };

  const finishShape = (): void => {
    if (!draftStartPoint || !draftBounds || !draftShapeKind) {
      clearDraftShape();

      return;
    }

    const shapeBounds = { ...draftBounds };
    const shapeKind = draftShapeKind;

    clearDraftShape();

    if (shapeBounds.width < MIN_RECT_SIZE || shapeBounds.height < MIN_RECT_SIZE) {
      syncToDocument();

      return;
    }

    void controllerOptions.onCreateAnnotation?.(
      shapeKind === 'rectangle'
        ? {
            kind: 'rectangle',
            ...shapeBounds,
          }
        : {
            kind: 'ellipse',
            ...shapeBounds,
            color: 'green',
          },
    );
    syncToDocument();
  };

  const findEventAnnotationId = (event: PointerEvent): string | null => {
    const eventTarget = event.target;

    if (!(eventTarget instanceof Element)) {
      return null;
    }

    const annotationElement = eventTarget.closest('[data-marginalia-annotation-id]');

    return annotationElement?.getAttribute('data-marginalia-annotation-id') ?? null;
  };

  function handlePointerDown(event: PointerEvent): void {
    if (!interactive || event.button !== 0) {
      return;
    }

    const annotationId = findEventAnnotationId(event);

    if (activeTool === 'select') {
      event.preventDefault();
      const selectionChanged = setSelection(annotationId, true);

      if (selectionChanged || annotationId === null) {
        syncToDocument();
      }

      return;
    }

    event.preventDefault();

    if (activeTool === 'connector') {
      const annotation = getCanvasAnnotationById(annotationId);

      if (!annotation) {
        if (clearConnectorDraft()) {
          syncToDocument();
        }

        return;
      }

      const point = toPagePoint(event);
      const anchor = resolveNearestAnchor(annotation.content, point);

      if (!connectorSourceAnnotationId || !connectorSourceAnchor) {
        connectorSourceAnnotationId = annotation.id;
        connectorSourceAnchor = anchor;
        connectorPreviewPoint = point;
        syncToDocument();

        return;
      }

      if (connectorSourceAnnotationId === annotation.id) {
        clearConnectorDraft();
        syncToDocument();

        return;
      }

      void controllerOptions.onCreateAnnotation?.({
        kind: 'connector',
        sourceId: connectorSourceAnnotationId,
        sourceAnchor: connectorSourceAnchor,
        targetId: annotation.id,
        targetAnchor: anchor,
        color: DEFAULT_CONNECTOR_COLOR,
      });

      clearConnectorDraft();
      syncToDocument();

      return;
    }

    if (isShapeTool(activeTool)) {
      draftPointerId = event.pointerId;
      draftStartPoint = toPagePoint(event);
      updateDraftShape(activeTool, {
        x: draftStartPoint.x,
        y: draftStartPoint.y,
        width: 0,
        height: 0,
      });
      overlayElement?.setPointerCapture?.(event.pointerId);

      return;
    }

    if (activeTool === 'text') {
      void controllerOptions.onCreateAnnotation?.(createTextAnnotationContent(toPagePoint(event)));

      return;
    }

    if (activeTool === 'sticky-note') {
      void controllerOptions.onCreateAnnotation?.(createStickyNoteAnnotationContent(toPagePoint(event)));
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    if (interactive && activeTool === 'connector' && connectorSourceAnnotationId) {
      connectorPreviewPoint = toPagePoint(event);
      syncToDocument();

      return;
    }

    if (!interactive || !isShapeTool(activeTool) || draftStartPoint === null || draftPointerId !== event.pointerId) {
      return;
    }

    const point = toPagePoint(event);
    updateDraftShape(activeTool, normalizeBounds(draftStartPoint.x, draftStartPoint.y, point.x, point.y));
  }

  function handlePointerUp(event: PointerEvent): void {
    if (draftPointerId !== event.pointerId) {
      return;
    }

    finishShape();
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (draftPointerId !== event.pointerId) {
      return;
    }

    clearDraftShape();
    syncToDocument();
  }

  const queueSync = (): void => {
    windowRef.requestAnimationFrame(() => {
      syncToDocument();
    });
  };

  windowRef.addEventListener('resize', queueSync, { passive: true });
  windowRef.addEventListener('scroll', queueSync, { passive: true });

  if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(() => {
      queueSync();
    });

    resizeObserver.observe(documentRef.documentElement);

    if (documentRef.body) {
      resizeObserver.observe(documentRef.body);
    }
  }

  overlayWindow[OVERLAY_CLEANUP_KEY] = () => {
    windowRef.removeEventListener('resize', queueSync);
    windowRef.removeEventListener('scroll', queueSync);
  };

  const cancelCurrentAction = (): boolean => {
    let cancelled = false;

    cancelled = clearDraftShape() || cancelled;
    cancelled = clearConnectorDraft() || cancelled;
    cancelled = setSelection(null, true) || cancelled;

    if (cancelled) {
      syncToDocument();
    }

    return cancelled;
  };

  return {
    setInteractive(enabled) {
      interactive = enabled;

      if (!enabled) {
        clearDraftShape();
        clearConnectorDraft();
      }

      syncToDocument();
    },
    setAnnotations(nextAnnotations) {
      annotations = [...nextAnnotations];

      if (selectedAnnotationId && !annotations.some((annotation) => annotation.id === selectedAnnotationId)) {
        setSelection(null, true);
      }

      if (!getPendingConnectorSourceAnnotation()) {
        clearConnectorDraft();
      }

      syncToDocument();
    },
    setActiveTool(tool) {
      if (activeTool === tool) {
        return;
      }

      activeTool = tool;

      clearDraftShape();
      clearConnectorDraft();

      if (tool !== 'select') {
        setSelection(null, true);
      }

      syncToDocument();
    },
    setSelection(annotationId) {
      if (!setSelection(annotationId)) {
        return;
      }

      syncToDocument();
    },
    cancelCurrentAction,
    runCommand(command) {
      if (command === 'cancel-current-action') {
        cancelCurrentAction();
      }

      void controllerOptions.onRunCommand?.(command);
    },
    syncToDocument,
  };
};
