import {
  DEFAULT_CANVAS_ROTATION,
  DEFAULT_TEXT_BORDER_VISIBLE,
  isCanvasAnnotation,
  isConnectorAnnotation,
  type Annotation,
  type AnnotationContent,
  type AnnotationPalette,
  type CanvasAnnotation,
  type CanvasBounds,
  type ConnectorAnchor,
  type CircleAnnotation,
  type ConnectorAnnotation,
  type EllipseAnnotation,
  type RectangleAnnotation,
  type StickyNoteAnnotation,
  type TextAnnotation,
} from '@/shared/models/annotations';
import {
  type AnnotationCommand,
  type AnnotationTool,
} from '@/shared/runtime/messages';

import {
  TOOLBAR_TOOL_ORDER,
  createToolbarIcon,
  getToolbarStatusMessage,
  getToolbarToolHint,
  getToolbarToolLabel,
  getToolbarToolShortcutLabel,
  getToolbarToolTitle,
} from './toolbarPresentation';

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
const DEFAULT_ELLIPSE_COLOR: AnnotationPalette = 'green';
const DEFAULT_CIRCLE_COLOR: AnnotationPalette = 'pink';
const ROTATION_HANDLE_RADIUS = 7;
const ROTATION_HANDLE_HIT_RADIUS = 16;
const ROTATION_HANDLE_MIN_OFFSET = 18;
const ROTATION_HANDLE_MAX_OFFSET = 28;
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
  onCreateAnnotation?: (content: AnnotationContent) => Promise<Annotation | void> | Annotation | void;
  onEditAnnotation?: (annotationId: string, content: AnnotationContent) => Promise<void> | void;
  onMoveAnnotation?: (annotationId: string, bounds: CanvasBounds) => Promise<void> | void;
  onRequestDisable?: () => Promise<void> | void;
  onRunCommand?: (command: AnnotationCommand) => Promise<void> | void;
  onSelectTool?: (tool: AnnotationTool) => Promise<void> | void;
  onSelectionChange?: (annotationId: string | null) => Promise<void> | void;
}

type OverlayWindow = Window & {
  [OVERLAY_CLEANUP_KEY]?: () => void;
};

type ShapeTool = Extract<AnnotationTool, 'circle' | 'ellipse' | 'rectangle'>;
type TextEditableAnnotation = CircleAnnotation | EllipseAnnotation | RectangleAnnotation | TextAnnotation;
type EditableAnnotation = StickyNoteAnnotation | TextEditableAnnotation;
type EditingDraft =
  | {
      annotationId: string;
      kind: 'inline-text';
      annotationType: TextEditableAnnotation['type'];
      text: string;
      borderVisible: boolean;
      selectAllOnFocus: boolean;
    }
  | {
      annotationId: string;
      kind: 'sticky-note';
      title: string;
      text: string;
    };

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

const normalizeCircleBounds = (startX: number, startY: number, currentX: number, currentY: number): CanvasBounds => {
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;
  const size = Math.max(Math.abs(deltaX), Math.abs(deltaY));
  const resolvedX = startX + (deltaX >= 0 ? size : -size);
  const resolvedY = startY + (deltaY >= 0 ? size : -size);

  return normalizeBounds(startX, startY, resolvedX, resolvedY);
};

const toCanvasBounds = (bounds: CanvasBounds): CanvasBounds => ({
  x: bounds.x,
  y: bounds.y,
  width: bounds.width,
  height: bounds.height,
});

const normalizeRotation = (rotation: number): number => {
  if (!Number.isFinite(rotation)) {
    return DEFAULT_CANVAS_ROTATION;
  }

  const wrappedRotation = ((rotation + 180) % 360 + 360) % 360 - 180;

  return Object.is(wrappedRotation, -0) ? 0 : wrappedRotation;
};

const clampRotationInput = (rotation: number): number =>
  Math.max(-180, Math.min(180, rotation));

const getCanvasAnnotationCenter = (bounds: CanvasBounds): { x: number; y: number } => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2,
});

const rotatePoint = (
  point: { x: number; y: number },
  center: { x: number; y: number },
  rotation: number,
): { x: number; y: number } => {
  if (rotation === 0) {
    return point;
  }

  const radians = (rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;

  return {
    x: center.x + offsetX * cosine - offsetY * sine,
    y: center.y + offsetX * sine + offsetY * cosine,
  };
};

const getAngleFromCenter = (center: { x: number; y: number }, point: { x: number; y: number }): number =>
  (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;

const getRotationHandleGeometry = (
  bounds: CanvasBounds & { rotation: number },
): {
  handleCenter: { x: number; y: number };
  guideStart: { x: number; y: number };
  guideEnd: { x: number; y: number };
} => {
  const center = getCanvasAnnotationCenter(bounds);
  const rotation = normalizeRotation(bounds.rotation);
  const offset = Math.max(
    ROTATION_HANDLE_MIN_OFFSET,
    Math.min(ROTATION_HANDLE_MAX_OFFSET, Math.min(bounds.width, bounds.height) * 0.25),
  );
  const baseGuideStart = {
    x: center.x,
    y: bounds.y,
  };
  const baseHandleCenter = {
    x: center.x,
    y: bounds.y - offset,
  };
  const baseGuideEnd = {
    x: center.x,
    y: baseHandleCenter.y + ROTATION_HANDLE_RADIUS + 2,
  };

  return {
    handleCenter: rotatePoint(baseHandleCenter, center, rotation),
    guideStart: rotatePoint(baseGuideStart, center, rotation),
    guideEnd: rotatePoint(baseGuideEnd, center, rotation),
  };
};

const getCanvasRotationTransform = (bounds: CanvasBounds & { rotation: number }): string | null => {
  const rotation = normalizeRotation(bounds.rotation);

  if (rotation === 0) {
    return null;
  }

  const center = getCanvasAnnotationCenter(bounds);

  return `rotate(${rotation} ${center.x} ${center.y})`;
};

const applyCanvasRotation = (
  element: SVGElement,
  bounds: CanvasBounds & { rotation: number },
): void => {
  const transform = getCanvasRotationTransform(bounds);

  if (transform) {
    element.setAttribute('transform', transform);
    return;
  }

  element.removeAttribute('transform');
};

const areBoundsEqual = (left: CanvasBounds, right: CanvasBounds): boolean =>
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height;

const updateCanvasAnnotationBounds = <T extends CanvasAnnotation>(annotation: T, bounds: CanvasBounds): T => ({
  ...annotation,
  content: {
    ...annotation.content,
    ...bounds,
  },
});

const createTextAnnotationContent = (point: { x: number; y: number }): AnnotationContent => ({
  kind: 'text',
  x: point.x,
  y: point.y,
  width: DEFAULT_TEXT_WIDTH,
  height: DEFAULT_TEXT_HEIGHT,
  rotation: DEFAULT_CANVAS_ROTATION,
  color: 'blue',
  borderVisible: DEFAULT_TEXT_BORDER_VISIBLE,
  text: 'Text annotation',
});

const createStickyNoteAnnotationContent = (point: { x: number; y: number }): AnnotationContent => ({
  kind: 'sticky-note',
  x: point.x,
  y: point.y,
  width: DEFAULT_STICKY_NOTE_WIDTH,
  height: DEFAULT_STICKY_NOTE_HEIGHT,
  rotation: DEFAULT_CANVAS_ROTATION,
  color: 'yellow',
  collapsed: false,
  text: 'New note',
  title: 'Sticky note',
});

const isShapeTool = (tool: AnnotationTool): tool is ShapeTool =>
  tool === 'rectangle' || tool === 'ellipse' || tool === 'circle';
const isTextEditableAnnotation = (annotation: Annotation | undefined): annotation is TextEditableAnnotation =>
  annotation?.type === 'text' ||
  annotation?.type === 'rectangle' ||
  annotation?.type === 'ellipse' ||
  annotation?.type === 'circle';
const isEditableAnnotation = (annotation: Annotation | undefined): annotation is EditableAnnotation =>
  isTextEditableAnnotation(annotation) || annotation?.type === 'sticky-note';

const createMultilineText = (
  documentRef: Document,
  lines: string[],
  options: {
    x: number;
    y: number;
    fill: string;
    fontSize: number;
    fontFamily: string;
    fontWeight?: string;
    lineHeight: number;
    textAnchor?: 'middle' | 'start';
  },
): SVGTextElement => {
  const text = documentRef.createElementNS(SVG_NAMESPACE, 'text');

  text.setAttribute('x', `${options.x}`);
  text.setAttribute('y', `${options.y}`);
  text.setAttribute('fill', options.fill);
  text.setAttribute('font-size', `${options.fontSize}`);
  text.setAttribute('font-family', options.fontFamily);
  text.setAttribute('dominant-baseline', 'hanging');
  text.setAttribute('text-anchor', options.textAnchor ?? 'start');

  if (options.fontWeight) {
    text.setAttribute('font-weight', options.fontWeight);
  }

  lines.forEach((line, index) => {
    const span = documentRef.createElementNS(SVG_NAMESPACE, 'tspan');
    span.setAttribute('x', `${options.x}`);

    if (index === 0) {
      span.setAttribute('dy', '0');
    } else {
      span.setAttribute('dy', `${options.lineHeight}`);
    }

    span.textContent = line === '' ? ' ' : line;
    text.append(span);
  });

  return text;
};

const getMultilineAnnotationText = (text: string): string[] => {
  const lines = text.split('\n').slice(0, 6);

  return lines.length > 0 ? lines : [''];
};

const getRenderableShapeTextLines = (text?: string): string[] => {
  if (!text || text.trim() === '') {
    return [];
  }

  return getMultilineAnnotationText(text).slice(0, 4);
};

const createShapeTextElement = (
  documentRef: Document,
  annotation: CircleAnnotation | EllipseAnnotation | RectangleAnnotation,
): SVGTextElement | null => {
  const lines = getRenderableShapeTextLines(annotation.content.text);

  if (lines.length === 0) {
    return null;
  }

  const lineHeight = 16;
  const totalTextHeight = lineHeight * lines.length;
  const label = createMultilineText(documentRef, lines, {
    x: annotation.content.x + annotation.content.width / 2,
    y: Math.max(annotation.content.y + 12, annotation.content.y + (annotation.content.height - totalTextHeight) / 2),
    fill: '#0f172a',
    fontSize: 14,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    lineHeight,
    textAnchor: 'middle',
  });

  label.style.pointerEvents = 'none';

  return label;
};

const resolveAnchorPoint = (
  bounds: CanvasBounds & { rotation?: number },
  anchor: ConnectorAnchor,
): { x: number; y: number } => {
  const basePoint =
    anchor === 'top'
      ? { x: bounds.x + bounds.width / 2, y: bounds.y }
      : anchor === 'right'
        ? { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }
        : anchor === 'bottom'
          ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }
          : anchor === 'left'
            ? { x: bounds.x, y: bounds.y + bounds.height / 2 }
            : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };

  return rotatePoint(basePoint, getCanvasAnnotationCenter(bounds), normalizeRotation(bounds.rotation ?? 0));
};

const resolveNearestAnchor = (
  bounds: CanvasBounds & { rotation?: number },
  point: { x: number; y: number },
): ConnectorAnchor => {
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
) : SVGGElement => {
  const group = documentRef.createElementNS(SVG_NAMESPACE, 'g');
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

  group.append(rectangle);
  const label = createShapeTextElement(documentRef, annotation);

  if (label) {
    group.append(label);
  }

  applyCanvasRotation(group, annotation.content);
  setAnnotationElementState(group, annotation, interactive, activeTool, selected);

  return group;
};

const createEllipseElement = (
  documentRef: Document,
  annotation: EllipseAnnotation,
  interactive: boolean,
  activeTool: AnnotationTool,
  selected: boolean,
) : SVGGElement => {
  const group = documentRef.createElementNS(SVG_NAMESPACE, 'g');
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

  group.append(ellipse);
  const label = createShapeTextElement(documentRef, annotation);

  if (label) {
    group.append(label);
  }

  applyCanvasRotation(group, annotation.content);
  setAnnotationElementState(group, annotation, interactive, activeTool, selected);

  return group;
};

const createCircleElement = (
  documentRef: Document,
  annotation: CircleAnnotation,
  interactive: boolean,
  activeTool: AnnotationTool,
  selected: boolean,
) : SVGGElement => {
  const group = documentRef.createElementNS(SVG_NAMESPACE, 'g');
  const circle = documentRef.createElementNS(SVG_NAMESPACE, 'circle');
  const strokeColor = selected ? SELECTED_STROKE_COLOR : getAnnotationColor(annotation.content.color);
  const radius = Math.min(annotation.content.width, annotation.content.height) / 2;

  circle.setAttribute('cx', `${annotation.content.x + annotation.content.width / 2}`);
  circle.setAttribute('cy', `${annotation.content.y + annotation.content.height / 2}`);
  circle.setAttribute('r', `${radius}`);
  circle.setAttribute('fill', strokeColor);
  circle.setAttribute('fill-opacity', selected ? '0.18' : '0.12');
  circle.setAttribute('stroke', strokeColor);
  circle.setAttribute('stroke-width', selected ? '3' : '2');
  circle.setAttribute('vector-effect', 'non-scaling-stroke');

  group.append(circle);
  const label = createShapeTextElement(documentRef, annotation);

  if (label) {
    group.append(label);
  }

  applyCanvasRotation(group, annotation.content);
  setAnnotationElementState(group, annotation, interactive, activeTool, selected);

  return group;
};

const createTextElement = (
  documentRef: Document,
  annotation: TextAnnotation,
  interactive: boolean,
  activeTool: AnnotationTool,
  selected: boolean,
  borderVisible: boolean,
): SVGGElement => {
  const group = documentRef.createElementNS(SVG_NAMESPACE, 'g');
  const accentColor = selected ? SELECTED_STROKE_COLOR : getAnnotationColor(annotation.content.color);
  const shouldShowBorder = selected || borderVisible;
  const hitTarget = documentRef.createElementNS(SVG_NAMESPACE, 'rect');
  const label = createMultilineText(documentRef, getMultilineAnnotationText(annotation.content.text), {
    x: annotation.content.x + 6,
    y: annotation.content.y + 6,
    fill: '#0f172a',
    fontSize: 15,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    lineHeight: 18,
  });

  hitTarget.setAttribute('x', `${annotation.content.x}`);
  hitTarget.setAttribute('y', `${annotation.content.y}`);
  hitTarget.setAttribute('width', `${annotation.content.width}`);
  hitTarget.setAttribute('height', `${annotation.content.height}`);
  hitTarget.setAttribute('rx', '8');
  hitTarget.setAttribute('fill', '#ffffff');
  hitTarget.setAttribute('fill-opacity', shouldShowBorder ? (selected ? '0.06' : '0.02') : '0.001');
  hitTarget.setAttribute('stroke', shouldShowBorder ? accentColor : 'transparent');
  hitTarget.setAttribute('stroke-width', shouldShowBorder ? (selected ? '2' : '1.5') : '0');
  hitTarget.setAttribute('stroke-dasharray', shouldShowBorder ? (selected ? '6 4' : '5 3') : '0');
  hitTarget.setAttribute('vector-effect', 'non-scaling-stroke');
  label.style.pointerEvents = 'none';

  group.append(hitTarget, label);
  applyCanvasRotation(group, annotation.content);
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
  const title = createMultilineText(documentRef, getMultilineAnnotationText(annotation.content.title ?? 'Sticky note'), {
    x: annotation.content.x + 12,
    y: annotation.content.y + 10,
    fill: '#0f172a',
    fontSize: 12,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: '700',
    lineHeight: 14,
  });
  const body = createMultilineText(
    documentRef,
    getMultilineAnnotationText(annotation.content.collapsed ? 'Collapsed note' : annotation.content.text),
    {
      x: annotation.content.x + 12,
      y: annotation.content.y + 30,
      fill: '#1e293b',
      fontSize: 12,
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      lineHeight: 14,
    },
  );

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

  group.append(note, title, body);
  applyCanvasRotation(group, annotation.content);
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
  options: {
    textBorderVisible?: boolean;
  } = {},
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
    case 'circle':
      return createCircleElement(documentRef, annotation, interactive, activeTool, selected);
    case 'text':
      return createTextElement(
        documentRef,
        annotation,
        interactive,
        activeTool,
        selected,
        options.textBorderVisible ?? annotation.content.borderVisible,
      );
    case 'sticky-note':
      return createStickyNoteElement(documentRef, annotation, interactive, activeTool, selected);
  }

  return null;
};

const createRotationHandleElement = (
  documentRef: Document,
  annotation: CanvasAnnotation,
  active: boolean,
): SVGGElement => {
  const group = documentRef.createElementNS(SVG_NAMESPACE, 'g');
  const title = documentRef.createElementNS(SVG_NAMESPACE, 'title');
  const guide = documentRef.createElementNS(SVG_NAMESPACE, 'line');
  const hitTarget = documentRef.createElementNS(SVG_NAMESPACE, 'circle');
  const outerHandle = documentRef.createElementNS(SVG_NAMESPACE, 'circle');
  const innerHandle = documentRef.createElementNS(SVG_NAMESPACE, 'circle');
  const { guideStart, guideEnd, handleCenter } = getRotationHandleGeometry(annotation.content);

  title.textContent = 'Rotate selected annotation';

  guide.setAttribute('x1', `${guideStart.x}`);
  guide.setAttribute('y1', `${guideStart.y}`);
  guide.setAttribute('x2', `${guideEnd.x}`);
  guide.setAttribute('y2', `${guideEnd.y}`);
  guide.setAttribute('stroke', SELECTED_STROKE_COLOR);
  guide.setAttribute('stroke-width', '2');
  guide.setAttribute('stroke-linecap', 'round');
  guide.setAttribute('stroke-opacity', active ? '0.9' : '0.75');
  guide.setAttribute('vector-effect', 'non-scaling-stroke');
  guide.style.pointerEvents = 'none';

  for (const handleElement of [hitTarget, outerHandle, innerHandle]) {
    handleElement.dataset.marginaliaRotationHandle = 'true';
    handleElement.dataset.marginaliaRotationAnnotationId = annotation.id;
    handleElement.setAttribute('cx', `${handleCenter.x}`);
    handleElement.setAttribute('cy', `${handleCenter.y}`);
  }

  hitTarget.setAttribute('r', `${ROTATION_HANDLE_HIT_RADIUS}`);
  hitTarget.setAttribute('fill', '#ffffff');
  hitTarget.setAttribute('fill-opacity', '0.001');
  hitTarget.setAttribute('stroke', 'transparent');
  hitTarget.style.pointerEvents = 'all';
  hitTarget.style.cursor = active ? 'grabbing' : 'grab';

  outerHandle.setAttribute('r', `${ROTATION_HANDLE_RADIUS}`);
  outerHandle.setAttribute('fill', '#ffffff');
  outerHandle.setAttribute('stroke', SELECTED_STROKE_COLOR);
  outerHandle.setAttribute('stroke-width', '2');
  outerHandle.setAttribute('vector-effect', 'non-scaling-stroke');
  outerHandle.style.pointerEvents = 'none';

  innerHandle.setAttribute('r', '2.5');
  innerHandle.setAttribute('fill', SELECTED_STROKE_COLOR);
  innerHandle.style.pointerEvents = 'none';

  group.append(title, guide, hitTarget, outerHandle, innerHandle);

  return group;
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
  let selectionLayer: SVGGElement | null = null;
  let editorLayer: SVGGElement | null = null;
  let draftLayer: SVGGElement | null = null;
  let draftShapeElement: SVGElement | null = null;
  let inlineEditorInputElement: HTMLTextAreaElement | null = null;
  let toolbarElement: HTMLDivElement | null = null;
  let toolbarHintElement: HTMLParagraphElement | null = null;
  let toolbarStatusElement: HTMLParagraphElement | null = null;
  let toolbarEditSectionElement: HTMLDivElement | null = null;
  let toolbarDeleteButtonElement: HTMLButtonElement | null = null;
  let toolbarToolButtons = new Map<AnnotationTool, HTMLButtonElement>();
  let interactive = false;
  let annotations: Annotation[] = [];
  let activeTool: AnnotationTool = 'rectangle';
  let selectedAnnotationId: string | null = null;
  let editingDraft: EditingDraft | null = null;
  let editingSavePending = false;
  let pendingTextBorderVisibility: { annotationId: string; borderVisible: boolean } | null = null;
  let pendingCanvasRotation: { annotationId: string; rotation: number } | null = null;
  let previewCanvasRotation: { annotationId: string; rotation: number } | null = null;
  let draftPointerId: number | null = null;
  let draftStartPoint: { x: number; y: number } | null = null;
  let draftShapeKind: ShapeTool | null = null;
  let draftBounds: CanvasBounds | null = null;
  let connectorSourceAnnotationId: string | null = null;
  let connectorSourceAnchor: ConnectorAnchor | null = null;
  let connectorPreviewPoint: { x: number; y: number } | null = null;
  let dragPointerId: number | null = null;
  let dragAnnotationId: string | null = null;
  let dragStartPoint: { x: number; y: number } | null = null;
  let dragOriginBounds: CanvasBounds | null = null;
  let dragCurrentBounds: CanvasBounds | null = null;
  let rotationPointerId: number | null = null;
  let rotationAnnotationId: string | null = null;
  let rotationCenterPoint: { x: number; y: number } | null = null;
  let rotationStartAngle: number | null = null;
  let rotationStartDegrees: number | null = null;

  const getShouldRenderOverlay = (): boolean => interactive || annotations.length > 0 || draftStartPoint !== null;

  const toPagePoint = (event: PointerEvent): { x: number; y: number } => ({
    x: event.clientX + windowRef.scrollX,
    y: event.clientY + windowRef.scrollY,
  });

  const applyVisibleCanvasRotation = <T extends CanvasAnnotation>(annotation: T): T => {
    const rotation = getCanvasRotation(annotation);

    if (annotation.content.rotation === rotation) {
      return annotation;
    }

    return {
      ...annotation,
      content: {
        ...annotation.content,
        rotation,
      },
    } as T;
  };

  const getSelectedAnnotation = (): Annotation | undefined => {
    if (!selectedAnnotationId) {
      return undefined;
    }

    const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedAnnotationId);

    return selectedAnnotation && isCanvasAnnotation(selectedAnnotation) ? applyVisibleCanvasRotation(selectedAnnotation) : selectedAnnotation;
  };

  const getCanvasAnnotationById = (annotationId: string | null): CanvasAnnotation | undefined => {
    if (!annotationId) {
      return undefined;
    }

    const annotation = annotations.find((candidate) => candidate.id === annotationId);

    return annotation && isCanvasAnnotation(annotation) ? applyVisibleCanvasRotation(annotation) : undefined;
  };

  const getPersistedCanvasAnnotationById = (annotationId: string | null): CanvasAnnotation | undefined => {
    if (!annotationId) {
      return undefined;
    }

    const annotation = annotations.find((candidate) => candidate.id === annotationId);

    return annotation && isCanvasAnnotation(annotation) ? annotation : undefined;
  };

  const getPendingConnectorSourceAnnotation = (): CanvasAnnotation | undefined =>
    getCanvasAnnotationById(connectorSourceAnnotationId);

  const getDraggedAnnotation = (): CanvasAnnotation | undefined => getCanvasAnnotationById(dragAnnotationId);

  const getEditingAnnotation = (): EditableAnnotation | undefined => {
    const currentEditingDraft = editingDraft;

    if (!currentEditingDraft) {
      return undefined;
    }

    const annotation = annotations.find((candidate) => candidate.id === currentEditingDraft.annotationId);

    if (!annotation || !isEditableAnnotation(annotation)) {
      return undefined;
    }

    return isCanvasAnnotation(annotation) ? applyVisibleCanvasRotation(annotation) : annotation;
  };

  const getTextEditingAnnotation = (): TextEditableAnnotation | undefined => {
    const annotation = getEditingAnnotation();

    return isTextEditableAnnotation(annotation) ? annotation : undefined;
  };

  const getTextBorderVisibility = (annotation: TextAnnotation): boolean =>
    pendingTextBorderVisibility?.annotationId === annotation.id
      ? pendingTextBorderVisibility.borderVisible
      : annotation.content.borderVisible;

  const getCanvasRotation = (annotation: CanvasAnnotation): number =>
    previewCanvasRotation?.annotationId === annotation.id
      ? normalizeRotation(previewCanvasRotation.rotation)
      : pendingCanvasRotation?.annotationId === annotation.id
      ? normalizeRotation(pendingCanvasRotation.rotation)
      : normalizeRotation(annotation.content.rotation);

  const getRotationHandleAnnotation = (): CanvasAnnotation | undefined => {
    if (!interactive || activeTool !== 'select' || editingDraft !== null || editingSavePending) {
      return undefined;
    }

    const selectedAnnotation = getSelectedAnnotation();

    if (!selectedAnnotation || !isCanvasAnnotation(selectedAnnotation)) {
      return undefined;
    }

    if (pendingCanvasRotation?.annotationId === selectedAnnotation.id) {
      return undefined;
    }

    return selectedAnnotation;
  };

  const isEventInsideInlineEditor = (eventTarget: EventTarget | null): boolean =>
    eventTarget instanceof Element && eventTarget.closest('[data-marginalia-inline-editor="true"]') !== null;

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

  const clearDraggedAnnotation = (): boolean => {
    const hadDraggedAnnotation =
      dragPointerId !== null ||
      dragAnnotationId !== null ||
      dragStartPoint !== null ||
      dragOriginBounds !== null ||
      dragCurrentBounds !== null;

    dragPointerId = null;
    dragAnnotationId = null;
    dragStartPoint = null;
    dragOriginBounds = null;
    dragCurrentBounds = null;

    return hadDraggedAnnotation;
  };

  const clearRotationGesture = (): boolean => {
    const hadRotationGesture =
      rotationPointerId !== null ||
      rotationAnnotationId !== null ||
      rotationCenterPoint !== null ||
      rotationStartAngle !== null ||
      rotationStartDegrees !== null ||
      previewCanvasRotation !== null;

    rotationPointerId = null;
    rotationAnnotationId = null;
    rotationCenterPoint = null;
    rotationStartAngle = null;
    rotationStartDegrees = null;
    previewCanvasRotation = null;

    return hadRotationGesture;
  };

  const clearEditingDraft = (): boolean => {
    const hadEditingDraft = editingDraft !== null || editingSavePending;

    editingDraft = null;
    editingSavePending = false;

    return hadEditingDraft;
  };

  const startEditingSelection = (
    annotationId = selectedAnnotationId,
    options: {
      selectAllOnFocus?: boolean;
    } = {},
  ): boolean => {
    const nextAnnotation = annotationId ? annotations.find((candidate) => candidate.id === annotationId) : undefined;

    if (!isEditableAnnotation(nextAnnotation)) {
      return false;
    }

    const annotation = nextAnnotation;

    editingSavePending = false;
    editingDraft =
      isTextEditableAnnotation(annotation)
        ? {
            annotationId: annotation.id,
            kind: 'inline-text',
            annotationType: annotation.type,
            text: annotation.content.text ?? '',
            borderVisible: annotation.type === 'text' ? getTextBorderVisibility(annotation) : false,
            selectAllOnFocus: options.selectAllOnFocus ?? false,
          }
        : {
            annotationId: annotation.id,
            kind: 'sticky-note',
            title: annotation.content.title ?? '',
            text: annotation.content.text,
          };

    if (selectedAnnotationId !== annotation.id) {
      setSelection(annotation.id, true);
    }

    clearDraftShape();
    clearConnectorDraft();
    clearDraggedAnnotation();
    clearRotationGesture();

    return true;
  };

  const setSelection = (annotationId: string | null, notify = false): boolean => {
    if (selectedAnnotationId === annotationId) {
      return false;
    }

    selectedAnnotationId = annotationId;
    if (rotationAnnotationId && rotationAnnotationId !== annotationId) {
      clearRotationGesture();
    }

    if (editingDraft && editingDraft.annotationId !== annotationId) {
      clearEditingDraft();
    }

    if (notify) {
      void controllerOptions.onSelectionChange?.(annotationId);
    }

    return true;
  };

  const saveEditingDraft = (): void => {
    const currentDraft = editingDraft;
    const currentAnnotation = getEditingAnnotation();

    if (!currentDraft || !currentAnnotation || editingSavePending) {
      return;
    }

    const nextContent =
      currentDraft.kind === 'inline-text'
        ? currentAnnotation.type === 'text'
          ? {
              ...currentAnnotation.content,
              text: currentDraft.text,
              borderVisible: currentDraft.borderVisible,
            }
          : {
              ...currentAnnotation.content,
              text: currentDraft.text,
            }
        : {
            ...currentAnnotation.content,
            title: currentDraft.title,
            text: currentDraft.text,
          };

    editingSavePending = true;
    syncToDocument();
    void Promise.resolve(controllerOptions.onEditAnnotation?.(currentAnnotation.id, nextContent))
      .then(() => {
        clearEditingDraft();
        syncToDocument();
      })
      .catch(() => {
        editingSavePending = false;
        syncToDocument();
      });
  };

  const updateTextBorderVisibility = (annotation: TextAnnotation, borderVisible: boolean): void => {
    if (editingSavePending || getTextBorderVisibility(annotation) === borderVisible) {
      return;
    }

    pendingTextBorderVisibility = {
      annotationId: annotation.id,
      borderVisible,
    };
    syncToDocument();
    void Promise.resolve(
      controllerOptions.onEditAnnotation?.(annotation.id, {
        ...annotation.content,
        borderVisible,
      }),
    ).finally(() => {
      if (pendingTextBorderVisibility?.annotationId === annotation.id) {
        pendingTextBorderVisibility = null;
      }

      syncToDocument();
    });
  };

  const updateCanvasRotation = (annotation: CanvasAnnotation, rotation: number): void => {
    const nextRotation = normalizeRotation(rotation);

    if (editingSavePending || getCanvasRotation(annotation) === nextRotation) {
      return;
    }

    pendingCanvasRotation = {
      annotationId: annotation.id,
      rotation: nextRotation,
    };
    syncToDocument();
    void Promise.resolve(
      controllerOptions.onEditAnnotation?.(annotation.id, {
        ...annotation.content,
        rotation: nextRotation,
      }),
    ).finally(() => {
      if (pendingCanvasRotation?.annotationId === annotation.id && pendingCanvasRotation.rotation === nextRotation) {
        pendingCanvasRotation = null;
      }

      syncToDocument();
    });
  };

  const switchToSelectToolAfterCreation = (): void => {
    if (activeTool === 'select') {
      return;
    }

    activeTool = 'select';
    clearDraftShape();
    clearConnectorDraft();
    clearDraggedAnnotation();
    syncToDocument();
    void controllerOptions.onSelectTool?.('select');
  };

  const updateToolbarEditSection = (): void => {
    if (!toolbarEditSectionElement) {
      return;
    }

    const selectedAnnotation = getSelectedAnnotation();
    const editableSelectedAnnotation = isEditableAnnotation(selectedAnnotation) ? selectedAnnotation : undefined;

    toolbarEditSectionElement.replaceChildren();

    if (!editableSelectedAnnotation) {
      return;
    }

    const controlsRow = documentRef.createElement('div');
    controlsRow.style.display = 'flex';
    controlsRow.style.flexWrap = 'wrap';
    controlsRow.style.gap = '8px';
    controlsRow.style.marginTop = '12px';

    if (!editingDraft || editingDraft.annotationId !== editableSelectedAnnotation.id) {
      const heading = documentRef.createElement('p');
      heading.textContent =
        editableSelectedAnnotation.type === 'sticky-note' ? 'Sticky note editor' : 'Text controls';
      heading.style.margin = '12px 0 0';
      heading.style.fontSize = '12px';
      heading.style.fontWeight = '600';
      heading.style.color = '#e0e7ff';
      toolbarEditSectionElement.append(heading);

      const note = documentRef.createElement('p');
      note.textContent =
        editableSelectedAnnotation.type === 'sticky-note'
          ? 'Open the note editor to update the title and body, then save when you are done.'
          : editableSelectedAnnotation.type === 'text'
            ? 'Edit the text directly on the page and choose whether its border stays visible after you leave.'
            : 'Edit the text directly on the shape from the canvas.';
      note.style.margin = '6px 0 0';
      note.style.fontSize = '12px';
      note.style.color = '#cbd5e1';
      toolbarEditSectionElement.append(note);

      const editButton = documentRef.createElement('button');
      editButton.type = 'button';
      editButton.textContent =
        editableSelectedAnnotation.type === 'sticky-note' ? 'Edit note' : 'Edit text';
      editButton.style.padding = '8px 12px';
      editButton.style.border = '1px solid rgba(129, 140, 248, 0.5)';
      editButton.style.borderRadius = '999px';
      editButton.style.background = 'rgba(67, 56, 202, 0.24)';
      editButton.style.color = '#eef2ff';
      editButton.style.cursor = 'pointer';
      editButton.style.font = 'inherit';
      editButton.addEventListener('click', () => {
        if (!startEditingSelection(editableSelectedAnnotation.id)) {
          return;
        }

        syncToDocument();
      });
      controlsRow.append(editButton);

      if (editableSelectedAnnotation.type === 'text') {
        const borderLabel = documentRef.createElement('label');
        borderLabel.style.display = 'inline-flex';
        borderLabel.style.alignItems = 'center';
        borderLabel.style.gap = '8px';
        borderLabel.style.padding = '8px 12px';
        borderLabel.style.borderRadius = '999px';
        borderLabel.style.border = '1px solid rgba(148, 163, 184, 0.22)';
        borderLabel.style.background = 'rgba(15, 23, 42, 0.48)';
        borderLabel.style.color = '#e2e8f0';
        borderLabel.style.fontSize = '12px';

        const borderInput = documentRef.createElement('input');
        borderInput.type = 'checkbox';
        borderInput.checked = getTextBorderVisibility(editableSelectedAnnotation);
        borderInput.disabled =
          editingSavePending || pendingTextBorderVisibility?.annotationId === editableSelectedAnnotation.id;
        borderInput.setAttribute('aria-label', 'Keep text annotation border visible');
        borderInput.addEventListener('change', () => {
          updateTextBorderVisibility(editableSelectedAnnotation, borderInput.checked);
        });

        const borderCopy = documentRef.createElement('span');
        borderCopy.textContent = 'Keep border visible';
        borderLabel.append(borderInput, borderCopy);
        controlsRow.append(borderLabel);
      }

      toolbarEditSectionElement.append(controlsRow);

      if (editableSelectedAnnotation.type === 'text') {
        const note = documentRef.createElement('p');
        note.textContent =
          'The border always appears while the annotation is selected. Turn the toggle on to keep it visible all the time.';
        note.style.margin = '10px 0 0';
        note.style.fontSize = '12px';
        note.style.color = '#cbd5e1';
        toolbarEditSectionElement.append(note);
      } else if (editableSelectedAnnotation.type !== 'sticky-note') {
        const note = documentRef.createElement('p');
        note.textContent = 'Double-click the annotation to edit directly on the canvas.';
        note.style.margin = '10px 0 0';
        note.style.fontSize = '12px';
        note.style.color = '#cbd5e1';
        toolbarEditSectionElement.append(note);
      }

      return;
    }

    if (editingDraft.kind === 'inline-text') {
      const heading = documentRef.createElement('p');
      heading.textContent =
        editingDraft.annotationType === 'text' ? 'Editing text annotation' : `Editing ${editingDraft.annotationType} text`;
      heading.style.margin = '12px 0 0';
      heading.style.fontSize = '12px';
      heading.style.fontWeight = '600';
      heading.style.color = '#e0e7ff';
      toolbarEditSectionElement.append(heading);

      const note = documentRef.createElement('p');
      note.textContent = editingSavePending
        ? 'Saving text changes…'
        : editingDraft.annotationType === 'text'
          ? 'Editing inline on the canvas. Use the floating editor to save text and decide whether its border stays visible.'
          : 'Editing inline on the canvas. Use the floating editor to save or cancel.';
      note.style.margin = '6px 0 0';
      note.style.fontSize = '12px';
      note.style.color = '#cbd5e1';
      toolbarEditSectionElement.append(note);

      return;
    }

    const heading = documentRef.createElement('p');
    heading.textContent = 'Sticky note editor';
    heading.style.margin = '12px 0 0';
    heading.style.fontSize = '12px';
    heading.style.fontWeight = '600';
    heading.style.color = '#e0e7ff';
    toolbarEditSectionElement.append(heading);

    const description = documentRef.createElement('p');
    description.textContent = editingSavePending
      ? 'Saving note changes…'
      : 'Update the title and body together so the note stays easy to revisit later.';
    description.style.margin = '6px 0 0';
    description.style.fontSize = '12px';
    description.style.color = '#cbd5e1';
    toolbarEditSectionElement.append(description);

    const fieldLabelStyle = {
      display: 'block',
      marginTop: '8px',
      fontSize: '12px',
      color: '#cbd5e1',
    } as const;

    const titleLabel = documentRef.createElement('label');
    titleLabel.textContent = 'Title';
    Object.assign(titleLabel.style, fieldLabelStyle);

    const titleInput = documentRef.createElement('input');
    titleInput.type = 'text';
    titleInput.value = editingDraft.title;
    titleInput.setAttribute('aria-label', 'Sticky note title');
    titleInput.style.width = '100%';
    titleInput.style.marginTop = '4px';
    titleInput.style.padding = '8px 10px';
    titleInput.style.borderRadius = '10px';
    titleInput.style.border = '1px solid rgba(148, 163, 184, 0.4)';
    titleInput.style.background = 'rgba(15, 23, 42, 0.82)';
    titleInput.style.color = '#f8fafc';
    titleInput.style.font = 'inherit';
    titleInput.addEventListener('input', () => {
      if (editingDraft?.kind !== 'sticky-note') {
        return;
      }

      editingDraft = {
        ...editingDraft,
        title: titleInput.value,
      };
    });
    titleLabel.append(titleInput);
    toolbarEditSectionElement.append(titleLabel);

    const bodyLabel = documentRef.createElement('label');
    bodyLabel.textContent = 'Note';
    Object.assign(bodyLabel.style, fieldLabelStyle);

    const bodyInput = documentRef.createElement('textarea');
    bodyInput.value = editingDraft.text;
    bodyInput.setAttribute('aria-label', 'Sticky note text');
    bodyInput.rows = 5;
    bodyInput.style.width = '100%';
    bodyInput.style.minHeight = '120px';
    bodyInput.style.marginTop = '4px';
    bodyInput.style.padding = '8px 10px';
    bodyInput.style.borderRadius = '10px';
    bodyInput.style.border = '1px solid rgba(148, 163, 184, 0.4)';
    bodyInput.style.background = 'rgba(15, 23, 42, 0.82)';
    bodyInput.style.color = '#f8fafc';
    bodyInput.style.font = 'inherit';
    bodyInput.style.resize = 'vertical';
    bodyInput.addEventListener('input', () => {
      if (editingDraft?.kind !== 'sticky-note') {
        return;
      }

      editingDraft = {
        ...editingDraft,
        text: bodyInput.value,
      };
    });
    bodyLabel.append(bodyInput);
    toolbarEditSectionElement.append(bodyLabel);

    const saveButton = documentRef.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = editingSavePending ? 'Saving…' : 'Save note';
    saveButton.disabled = editingSavePending;
    saveButton.style.padding = '8px 12px';
    saveButton.style.border = '0';
    saveButton.style.borderRadius = '999px';
    saveButton.style.background = '#c7d2fe';
    saveButton.style.color = '#312e81';
    saveButton.style.cursor = editingSavePending ? 'progress' : 'pointer';
    saveButton.style.font = 'inherit';
    saveButton.addEventListener('click', () => {
      saveEditingDraft();
    });

    const cancelButton = documentRef.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel editing';
    cancelButton.disabled = editingSavePending;
    cancelButton.style.padding = '8px 12px';
    cancelButton.style.border = '1px solid rgba(148, 163, 184, 0.4)';
    cancelButton.style.borderRadius = '999px';
    cancelButton.style.background = 'transparent';
    cancelButton.style.color = '#e2e8f0';
    cancelButton.style.cursor = editingSavePending ? 'not-allowed' : 'pointer';
    cancelButton.style.font = 'inherit';
    cancelButton.addEventListener('click', () => {
      if (!clearEditingDraft()) {
        return;
      }

      syncToDocument();
    });

    controlsRow.append(saveButton, cancelButton);
    toolbarEditSectionElement.append(controlsRow);
  };

  const ensureToolbarMounted = (): HTMLDivElement | null => {
    if (!interactive) {
      toolbarElement?.remove();
      toolbarElement = null;
      toolbarHintElement = null;
      toolbarStatusElement = null;
      toolbarEditSectionElement = null;
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
    toolbarElement.style.width = '392px';
    toolbarElement.style.padding = '14px';
    toolbarElement.style.borderRadius = '18px';
    toolbarElement.style.background =
      'linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(15, 23, 42, 0.88) 100%)';
    toolbarElement.style.color = '#f8fafc';
    toolbarElement.style.border = '1px solid rgba(148, 163, 184, 0.18)';
    toolbarElement.style.boxShadow = '0 18px 48px rgba(15, 23, 42, 0.38)';
    toolbarElement.style.backdropFilter = 'blur(12px)';
    toolbarElement.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    toolbarElement.style.lineHeight = '1.4';

    const headerElement = documentRef.createElement('div');
    headerElement.style.display = 'flex';
    headerElement.style.alignItems = 'center';
    headerElement.style.justifyContent = 'space-between';
    headerElement.style.gap = '12px';

    const titleGroupElement = documentRef.createElement('div');

    const titleElement = documentRef.createElement('p');
    titleElement.textContent = 'Marginalia annotation mode';
    titleElement.style.margin = '0';
    titleElement.style.fontSize = '14px';
    titleElement.style.fontWeight = '700';
    titleElement.style.letterSpacing = '0.01em';
    titleGroupElement.append(titleElement);

    const subtitleElement = documentRef.createElement('p');
    subtitleElement.textContent = 'Tools stay one tap away with shortcuts visible at a glance.';
    subtitleElement.style.margin = '4px 0 0';
    subtitleElement.style.fontSize = '11px';
    subtitleElement.style.color = '#94a3b8';
    titleGroupElement.append(subtitleElement);

    const escapeChipElement = documentRef.createElement('span');
    escapeChipElement.textContent = 'Esc';
    escapeChipElement.style.display = 'inline-flex';
    escapeChipElement.style.alignItems = 'center';
    escapeChipElement.style.justifyContent = 'center';
    escapeChipElement.style.minWidth = '36px';
    escapeChipElement.style.padding = '6px 10px';
    escapeChipElement.style.borderRadius = '999px';
    escapeChipElement.style.border = '1px solid rgba(148, 163, 184, 0.18)';
    escapeChipElement.style.background = 'rgba(148, 163, 184, 0.08)';
    escapeChipElement.style.color = '#cbd5e1';
    escapeChipElement.style.fontSize = '11px';
    escapeChipElement.style.fontWeight = '700';
    escapeChipElement.title = 'Cancel the current interaction';

    headerElement.append(titleGroupElement, escapeChipElement);
    toolbarElement.append(headerElement);

    toolbarHintElement = documentRef.createElement('p');
    toolbarHintElement.style.margin = '12px 0 0';
    toolbarHintElement.style.fontSize = '13px';
    toolbarHintElement.style.color = '#cbd5e1';
    toolbarHintElement.style.padding = '10px 12px';
    toolbarHintElement.style.borderRadius = '12px';
    toolbarHintElement.style.background = 'rgba(79, 70, 229, 0.12)';
    toolbarHintElement.style.border = '1px solid rgba(129, 140, 248, 0.18)';
    toolbarElement.append(toolbarHintElement);

    const toolPaletteElement = documentRef.createElement('div');
    toolPaletteElement.style.display = 'grid';
    toolPaletteElement.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
    toolPaletteElement.style.gap = '10px';
    toolPaletteElement.style.marginTop = '12px';

    toolbarToolButtons = new Map<AnnotationTool, HTMLButtonElement>();
    for (const tool of TOOLBAR_TOOL_ORDER) {
      const button = documentRef.createElement('button');
      const iconFrame = documentRef.createElement('span');
      const labelElement = documentRef.createElement('span');
      const shortcutElement = documentRef.createElement('span');
      const shortcutLabel = getToolbarToolShortcutLabel(tool);

      button.type = 'button';
      button.setAttribute('aria-label', `${getToolbarToolLabel(tool)} (${shortcutLabel})`);
      button.dataset.marginaliaTool = tool;
      button.title = `${getToolbarToolTitle(tool)} — ${getToolbarToolHint(tool)}`;
      button.style.display = 'flex';
      button.style.flexDirection = 'column';
      button.style.alignItems = 'flex-start';
      button.style.justifyContent = 'space-between';
      button.style.minHeight = '84px';
      button.style.padding = '10px';
      button.style.borderRadius = '14px';
      button.style.border = '1px solid rgba(148, 163, 184, 0.16)';
      button.style.background = 'linear-gradient(180deg, rgba(30, 41, 59, 0.76) 0%, rgba(15, 23, 42, 0.92) 100%)';
      button.style.color = '#e2e8f0';
      button.style.cursor = 'pointer';
      button.style.font = 'inherit';
      button.style.textAlign = 'left';
      button.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.04)';
      button.style.transition = 'background 120ms ease, border-color 120ms ease, transform 120ms ease';

      iconFrame.style.display = 'inline-flex';
      iconFrame.style.alignItems = 'center';
      iconFrame.style.justifyContent = 'center';
      iconFrame.style.width = '36px';
      iconFrame.style.height = '36px';
      iconFrame.style.borderRadius = '12px';
      iconFrame.style.background = 'rgba(148, 163, 184, 0.08)';
      iconFrame.style.color = 'inherit';
      iconFrame.append(createToolbarIcon(documentRef, tool));

      labelElement.textContent = getToolbarToolLabel(tool);
      labelElement.style.display = 'block';
      labelElement.style.marginTop = '10px';
      labelElement.style.fontSize = '12px';
      labelElement.style.fontWeight = '700';
      labelElement.style.lineHeight = '1.2';

      shortcutElement.textContent = shortcutLabel;
      shortcutElement.setAttribute('aria-hidden', 'true');
      shortcutElement.style.display = 'inline-flex';
      shortcutElement.style.alignItems = 'center';
      shortcutElement.style.marginTop = '6px';
      shortcutElement.style.padding = '4px 6px';
      shortcutElement.style.borderRadius = '999px';
      shortcutElement.style.background = 'rgba(148, 163, 184, 0.12)';
      shortcutElement.style.color = '#94a3b8';
      shortcutElement.style.fontSize = '10px';
      shortcutElement.style.fontWeight = '700';
      shortcutElement.style.letterSpacing = '0.04em';

      button.append(iconFrame, labelElement, shortcutElement);
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
    toolbarStatusElement.style.color = '#c7d2fe';
    toolbarStatusElement.style.padding = '10px 12px';
    toolbarStatusElement.style.borderRadius = '12px';
    toolbarStatusElement.style.background = 'rgba(30, 41, 59, 0.72)';
    toolbarStatusElement.style.border = '1px solid rgba(148, 163, 184, 0.14)';
    toolbarElement.append(toolbarStatusElement);

    const actionsRow = documentRef.createElement('div');
    actionsRow.style.display = 'flex';
    actionsRow.style.flexWrap = 'wrap';
    actionsRow.style.gap = '8px';
    actionsRow.style.marginTop = '12px';

    toolbarDeleteButtonElement = documentRef.createElement('button');
    toolbarDeleteButtonElement.type = 'button';
    toolbarDeleteButtonElement.textContent = 'Delete selected';
    toolbarDeleteButtonElement.title = 'Delete the current selection • Backspace';
    toolbarDeleteButtonElement.style.flex = '1 1 auto';
    toolbarDeleteButtonElement.style.padding = '10px 12px';
    toolbarDeleteButtonElement.style.border = '1px solid rgba(248, 113, 113, 0.42)';
    toolbarDeleteButtonElement.style.borderRadius = '999px';
    toolbarDeleteButtonElement.style.background = 'rgba(127, 29, 29, 0.28)';
    toolbarDeleteButtonElement.style.color = '#fee2e2';
    toolbarDeleteButtonElement.style.cursor = 'pointer';
    toolbarDeleteButtonElement.style.font = 'inherit';
    toolbarDeleteButtonElement.addEventListener('click', () => {
      if (!selectedAnnotationId) {
        return;
      }

      void controllerOptions.onRunCommand?.('delete-selected-annotation');
    });
    actionsRow.append(toolbarDeleteButtonElement);

    toolbarEditSectionElement = documentRef.createElement('div');
    toolbarEditSectionElement.style.marginTop = '4px';
    toolbarElement.append(toolbarEditSectionElement);

    const doneButton = documentRef.createElement('button');
    doneButton.type = 'button';
    doneButton.textContent = 'Done';
    doneButton.style.padding = '10px 14px';
    doneButton.style.border = '0';
    doneButton.style.borderRadius = '999px';
    doneButton.style.background = '#eef2ff';
    doneButton.style.color = '#312e81';
    doneButton.style.cursor = 'pointer';
    doneButton.style.font = 'inherit';
    doneButton.addEventListener('click', () => {
      void controllerOptions.onRequestDisable?.();
    });
    actionsRow.append(doneButton);
    toolbarElement.append(actionsRow);

    body.append(toolbarElement);

    return toolbarElement;
  };

  const updateToolbar = (): void => {
    const mountedToolbar = ensureToolbarMounted();

    if (
      !mountedToolbar ||
      !toolbarHintElement ||
      !toolbarStatusElement ||
      !toolbarDeleteButtonElement ||
      !toolbarEditSectionElement
    ) {
      return;
    }

    toolbarHintElement.textContent = getToolbarToolHint(activeTool);
    for (const [tool, button] of toolbarToolButtons) {
      const active = tool === activeTool;
      button.dataset.active = active ? 'true' : 'false';
      button.style.background = active
        ? 'linear-gradient(180deg, rgba(79, 70, 229, 0.96) 0%, rgba(67, 56, 202, 0.92) 100%)'
        : 'linear-gradient(180deg, rgba(30, 41, 59, 0.76) 0%, rgba(15, 23, 42, 0.92) 100%)';
      button.style.borderColor = active ? 'rgba(165, 180, 252, 0.8)' : 'rgba(148, 163, 184, 0.16)';
      button.style.color = active ? '#eef2ff' : '#e2e8f0';
      button.style.transform = active ? 'translateY(-1px)' : 'translateY(0)';
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    const selectedAnnotation = getSelectedAnnotation();
    const pendingConnectorSourceAnnotation = getPendingConnectorSourceAnnotation();
    toolbarStatusElement.textContent = getToolbarStatusMessage({
      activeTool,
      annotationsCount: annotations.length,
      pendingConnectorSourceType: pendingConnectorSourceAnnotation?.type,
      selectedAnnotationType: selectedAnnotation?.type,
    });
    toolbarDeleteButtonElement.disabled = selectedAnnotation === undefined;
    toolbarDeleteButtonElement.style.opacity = selectedAnnotation ? '1' : '0.5';
    toolbarDeleteButtonElement.style.cursor = selectedAnnotation ? 'pointer' : 'not-allowed';
    updateToolbarEditSection();
  };

  const getInlineEditorBounds = (annotation: TextEditableAnnotation): CanvasBounds => {
    if (annotation.type === 'text') {
      return toCanvasBounds(annotation.content);
    }

    const horizontalInset = Math.max(12, annotation.content.width * 0.12);
    const verticalInset = Math.max(10, annotation.content.height * 0.18);

    return {
      x: annotation.content.x + horizontalInset,
      y: annotation.content.y + verticalInset,
      width: Math.max(annotation.content.width - horizontalInset * 2, 72),
      height: Math.max(annotation.content.height - verticalInset * 2, 40),
    };
  };

  const updateInlineEditor = (): void => {
    inlineEditorInputElement = null;

    if (!editorLayer) {
      return;
    }

    editorLayer.replaceChildren();

    const currentDraft = editingDraft;
    const annotation = getTextEditingAnnotation();

    if (!currentDraft || currentDraft.kind !== 'inline-text' || !annotation) {
      return;
    }

    const editorBounds = getInlineEditorBounds(annotation);
    const editorGroup = documentRef.createElementNS(SVG_NAMESPACE, 'g');
    const foreignObject = documentRef.createElementNS(SVG_NAMESPACE, 'foreignObject');
    foreignObject.setAttribute('x', `${editorBounds.x}`);
    foreignObject.setAttribute('y', `${editorBounds.y}`);
    foreignObject.setAttribute('width', `${editorBounds.width}`);
    foreignObject.setAttribute('height', `${editorBounds.height}`);
    foreignObject.style.overflow = 'visible';
    foreignObject.style.pointerEvents = 'auto';

    const container = documentRef.createElement('div');
    container.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    container.dataset.marginaliaInlineEditor = 'true';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.padding = annotation.type === 'text' ? '0' : '2px';
    container.style.boxSizing = 'border-box';

    const input = documentRef.createElement('textarea');
    input.value = currentDraft.text;
    input.setAttribute(
      'aria-label',
      annotation.type === 'text' ? 'Text annotation editor' : `${getToolbarToolLabel(annotation.type)} text editor`,
    );
    input.rows = annotation.type === 'text' ? 3 : 4;
    input.disabled = editingSavePending;
    input.style.width = '100%';
    input.style.height = '100%';
    input.style.minHeight = annotation.type === 'text' ? '56px' : '40px';
    input.style.padding = annotation.type === 'text' ? '6px' : '10px 12px';
    input.style.borderRadius =
      annotation.type === 'rectangle' ? '10px' : annotation.type === 'text' ? '8px' : '999px';
    input.style.border = `2px solid ${editingSavePending ? 'rgba(79, 70, 229, 0.28)' : ACCENT_COLOR}`;
    input.style.background = annotation.type === 'text' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.95)';
    input.style.color = '#0f172a';
    input.style.font =
      annotation.type === 'text'
        ? '400 15px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        : '500 14px/1.35 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    input.style.textAlign = annotation.type === 'text' ? 'left' : 'center';
    input.style.resize = annotation.type === 'text' ? 'vertical' : 'none';
    input.style.boxSizing = 'border-box';
    input.style.outline = 'none';
    input.addEventListener('input', () => {
      if (editingDraft?.kind !== 'inline-text') {
        return;
      }

      editingDraft = {
        ...editingDraft,
        text: input.value,
      };
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();

        if (clearEditingDraft()) {
          syncToDocument();
        }

        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        saveEditingDraft();
      }
    });

    inlineEditorInputElement = input;
    container.append(input);

    const actionsRow = documentRef.createElement('div');
    actionsRow.dataset.marginaliaInlineEditor = 'true';
    actionsRow.style.display = 'flex';
    actionsRow.style.alignItems = 'center';
    actionsRow.style.justifyContent = 'space-between';
    actionsRow.style.flexWrap = 'wrap';
    actionsRow.style.gap = '8px';

    const actionMeta = documentRef.createElement('div');
    actionMeta.dataset.marginaliaInlineEditor = 'true';
    actionMeta.style.display = 'inline-flex';
    actionMeta.style.alignItems = 'center';
    actionMeta.style.flexWrap = 'wrap';
    actionMeta.style.gap = '8px';

    const saveHint = documentRef.createElement('span');
    saveHint.textContent = '⌘/Ctrl+Enter saves';
    saveHint.style.color = '#475569';
    saveHint.style.font = '600 11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    actionMeta.append(saveHint);

    if (annotation.type === 'text') {
      const borderLabel = documentRef.createElement('label');
      borderLabel.style.display = 'inline-flex';
      borderLabel.style.alignItems = 'center';
      borderLabel.style.gap = '6px';
      borderLabel.style.padding = '4px 8px';
      borderLabel.style.borderRadius = '999px';
      borderLabel.style.background = 'rgba(79, 70, 229, 0.08)';
      borderLabel.style.color = '#312e81';
      borderLabel.style.font = '600 11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

      const borderInput = documentRef.createElement('input');
      borderInput.type = 'checkbox';
      borderInput.checked = currentDraft.borderVisible;
      borderInput.disabled = editingSavePending;
      borderInput.setAttribute('aria-label', 'Keep text annotation border visible');
      borderInput.addEventListener('change', () => {
        if (editingDraft?.kind !== 'inline-text') {
          return;
        }

        editingDraft = {
          ...editingDraft,
          borderVisible: borderInput.checked,
        };
      });

      const borderCopy = documentRef.createElement('span');
      borderCopy.textContent = 'Keep border visible';
      borderLabel.append(borderInput, borderCopy);
      actionMeta.append(borderLabel);
    }

    const actionButtons = documentRef.createElement('div');
    actionButtons.dataset.marginaliaInlineEditor = 'true';
    actionButtons.style.display = 'inline-flex';
    actionButtons.style.alignItems = 'center';
    actionButtons.style.gap = '8px';

    const cancelButton = documentRef.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    cancelButton.disabled = editingSavePending;
    cancelButton.style.padding = '6px 10px';
    cancelButton.style.border = '1px solid rgba(148, 163, 184, 0.35)';
    cancelButton.style.borderRadius = '999px';
    cancelButton.style.background = 'rgba(15, 23, 42, 0.8)';
    cancelButton.style.color = '#f8fafc';
    cancelButton.style.font = '600 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    cancelButton.addEventListener('click', () => {
      if (clearEditingDraft()) {
        syncToDocument();
      }
    });

    const saveButton = documentRef.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = editingSavePending ? 'Saving…' : 'Save text';
    saveButton.disabled = editingSavePending;
    saveButton.style.padding = '6px 10px';
    saveButton.style.border = '0';
    saveButton.style.borderRadius = '999px';
    saveButton.style.background = '#312e81';
    saveButton.style.color = '#eef2ff';
    saveButton.style.font = '600 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    saveButton.addEventListener('click', () => {
      saveEditingDraft();
    });

    actionButtons.append(cancelButton, saveButton);
    actionsRow.append(actionMeta, actionButtons);
    container.append(actionsRow);
    foreignObject.append(container);
    applyCanvasRotation(editorGroup, annotation.content);
    editorGroup.append(foreignObject);
    editorLayer.append(editorGroup);

    const shouldSelectAll = currentDraft.selectAllOnFocus;
    queueMicrotask(() => {
      if (inlineEditorInputElement !== input) {
        return;
      }

      input.focus();

      if (shouldSelectAll && editingDraft?.kind === 'inline-text') {
        input.select();
        editingDraft = {
          ...editingDraft,
          selectAllOnFocus: false,
        };
      }
    });
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

    selectionLayer = documentRef.createElementNS(SVG_NAMESPACE, 'g');
    selectionLayer.dataset.marginaliaLayer = 'selection';
    overlayElement.append(selectionLayer);

    editorLayer = documentRef.createElementNS(SVG_NAMESPACE, 'g');
    editorLayer.dataset.marginaliaLayer = 'editor';
    overlayElement.append(editorLayer);

    draftLayer = documentRef.createElementNS(SVG_NAMESPACE, 'g');
    draftLayer.dataset.marginaliaLayer = 'drafts';
    overlayElement.append(draftLayer);

    overlayElement.addEventListener('pointerdown', handlePointerDown);
    overlayElement.addEventListener('dblclick', handleDoubleClick);
    overlayElement.addEventListener('pointermove', handlePointerMove);
    overlayElement.addEventListener('pointerup', handlePointerUp);
    overlayElement.addEventListener('pointercancel', handlePointerCancel);

    body.append(overlayElement);

    return overlayElement;
  };

  const renderAnnotations = (): void => {
    if (!annotationsLayer || !selectionLayer) {
      return;
    }

    const draggedBounds = dragCurrentBounds;
    let renderedAnnotations = annotations.map((annotation) =>
      isCanvasAnnotation(annotation) ? applyVisibleCanvasRotation(annotation) : annotation,
    );

    if (dragAnnotationId && draggedBounds) {
      renderedAnnotations = renderedAnnotations.map((annotation) => {
        if (annotation.id !== dragAnnotationId || !isCanvasAnnotation(annotation)) {
          return annotation;
        }

        return updateCanvasAnnotationBounds(annotation, draggedBounds);
      });
    }
    const canvasAnnotationsById = new Map(
      renderedAnnotations
        .filter(isCanvasAnnotation)
        .map((annotation) => [annotation.id, annotation] as const),
    );
    const connectorElements: SVGElement[] = [];
    const annotationElements: SVGElement[] = [];

    for (const annotation of renderedAnnotations) {
      const element = createAnnotationElement(
        documentRef,
        annotation,
        interactive,
        activeTool,
        annotation.id === connectorSourceAnnotationId ? annotation.id : selectedAnnotationId,
        canvasAnnotationsById,
        annotation.type === 'text'
          ? {
              textBorderVisible: getTextBorderVisibility(annotation),
            }
          : undefined,
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
    selectionLayer.replaceChildren();

    const rotationHandleAnnotation = getRotationHandleAnnotation();

    if (rotationHandleAnnotation) {
      selectionLayer.append(
        createRotationHandleElement(
          documentRef,
          rotationHandleAnnotation,
          rotationPointerId !== null && rotationAnnotationId === rotationHandleAnnotation.id,
        ),
      );
    }

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
      selectionLayer = null;
      editorLayer = null;
      draftLayer = null;
      inlineEditorInputElement = null;
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
    updateInlineEditor();
    updateToolbar();
  };

  const updateDraftShape = (tool: ShapeTool, bounds: CanvasBounds): void => {
    draftShapeKind = tool;
    draftBounds = bounds;

    if (draftShapeElement && ((tool === 'rectangle' && !isSvgTag(draftShapeElement, 'rect')) || (tool !== 'rectangle' && !isSvgTag(draftShapeElement, 'ellipse')))) {
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

    const nextContent =
      shapeKind === 'rectangle'
        ? {
            kind: 'rectangle' as const,
            ...shapeBounds,
            rotation: DEFAULT_CANVAS_ROTATION,
            text: '',
          }
        : shapeKind === 'circle'
          ? {
              kind: 'circle' as const,
              ...shapeBounds,
              rotation: DEFAULT_CANVAS_ROTATION,
              color: DEFAULT_CIRCLE_COLOR,
              text: '',
            }
          : {
              kind: 'ellipse' as const,
              ...shapeBounds,
              rotation: DEFAULT_CANVAS_ROTATION,
              color: DEFAULT_ELLIPSE_COLOR,
              text: '',
            };

    void Promise.resolve(controllerOptions.onCreateAnnotation?.(nextContent)).then((createdAnnotation) => {
      switchToSelectToolAfterCreation();

      if (createdAnnotation && isTextEditableAnnotation(createdAnnotation) && startEditingSelection(createdAnnotation.id)) {
        syncToDocument();

        return;
      }

      syncToDocument();
    });
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

  const findRotationHandleAnnotationId = (eventTarget: EventTarget | null): string | null => {
    if (!(eventTarget instanceof Element)) {
      return null;
    }

    const handleElement = eventTarget.closest('[data-marginalia-rotation-handle="true"]');

    return handleElement?.getAttribute('data-marginalia-rotation-annotation-id') ?? null;
  };

  const beginRotationGesture = (annotation: CanvasAnnotation, event: PointerEvent): void => {
    const center = getCanvasAnnotationCenter(annotation.content);
    const point = toPagePoint(event);

    clearDraggedAnnotation();
    rotationPointerId = event.pointerId;
    rotationAnnotationId = annotation.id;
    rotationCenterPoint = center;
    rotationStartAngle = getAngleFromCenter(center, point);
    rotationStartDegrees = getCanvasRotation(annotation);
    previewCanvasRotation = {
      annotationId: annotation.id,
      rotation: rotationStartDegrees,
    };
    overlayElement?.setPointerCapture?.(event.pointerId);
    syncToDocument();
  };

  const updateRotationGesture = (event: PointerEvent): boolean => {
    if (
      rotationPointerId !== event.pointerId ||
      !rotationAnnotationId ||
      !rotationCenterPoint ||
      rotationStartAngle === null ||
      rotationStartDegrees === null
    ) {
      return false;
    }

    const nextRotation = normalizeRotation(
      rotationStartDegrees + (getAngleFromCenter(rotationCenterPoint, toPagePoint(event)) - rotationStartAngle),
    );

    if (
      previewCanvasRotation?.annotationId === rotationAnnotationId &&
      previewCanvasRotation.rotation === nextRotation
    ) {
      return true;
    }

    previewCanvasRotation = {
      annotationId: rotationAnnotationId,
      rotation: nextRotation,
    };
    syncToDocument();

    return true;
  };

  const finishRotationGesture = (event: PointerEvent): boolean => {
    if (rotationPointerId !== event.pointerId || !rotationAnnotationId || rotationStartDegrees === null) {
      return false;
    }

    const annotation = getPersistedCanvasAnnotationById(rotationAnnotationId);
    const finalRotation =
      previewCanvasRotation?.annotationId === rotationAnnotationId
        ? clampRotationInput(previewCanvasRotation.rotation)
        : rotationStartDegrees;

    clearRotationGesture();

    if (!annotation || normalizeRotation(annotation.content.rotation) === finalRotation) {
      syncToDocument();
      return true;
    }

    updateCanvasRotation(annotation, finalRotation);

    return true;
  };

  function handleDoubleClick(event: MouseEvent): void {
    if (!interactive || activeTool !== 'select') {
      return;
    }

    const eventTarget = event.target;

    if (!(eventTarget instanceof Element)) {
      return;
    }

    const annotationId =
      eventTarget.closest('[data-marginalia-annotation-id]')?.getAttribute('data-marginalia-annotation-id') ?? null;

    if (!annotationId || !startEditingSelection(annotationId)) {
      return;
    }

    event.preventDefault();
    syncToDocument();
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!interactive || event.button !== 0) {
      return;
    }

    if (editingDraft) {
      if (isEventInsideInlineEditor(event.target)) {
        return;
      }

      event.preventDefault();

      return;
    }

    if (activeTool === 'select') {
      const rotationHandleAnnotationId = findRotationHandleAnnotationId(event.target);

      if (rotationHandleAnnotationId) {
        const selectedCanvasAnnotation = getCanvasAnnotationById(rotationHandleAnnotationId);

        if (
          selectedCanvasAnnotation &&
          !editingSavePending &&
          pendingCanvasRotation?.annotationId !== selectedCanvasAnnotation.id
        ) {
          event.preventDefault();
          setSelection(selectedCanvasAnnotation.id, true);
          beginRotationGesture(selectedCanvasAnnotation, event);
        }

        return;
      }
    }

    const annotationId = findEventAnnotationId(event);

    if (activeTool === 'select') {
      event.preventDefault();
      const selectedCanvasAnnotation = getCanvasAnnotationById(annotationId);
      const selectionChanged = setSelection(annotationId, true);

      clearDraggedAnnotation();
      clearRotationGesture();

      if (selectedCanvasAnnotation) {
        dragPointerId = event.pointerId;
        dragAnnotationId = selectedCanvasAnnotation.id;
        dragStartPoint = toPagePoint(event);
        dragOriginBounds = toCanvasBounds(selectedCanvasAnnotation.content);
        dragCurrentBounds = toCanvasBounds(selectedCanvasAnnotation.content);
        overlayElement?.setPointerCapture?.(event.pointerId);
      }

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
      void Promise.resolve(controllerOptions.onCreateAnnotation?.(createTextAnnotationContent(toPagePoint(event)))).then(
        (createdAnnotation) => {
          switchToSelectToolAfterCreation();

          if (!createdAnnotation || !isTextEditableAnnotation(createdAnnotation)) {
            return;
          }

          if (!startEditingSelection(createdAnnotation.id, { selectAllOnFocus: createdAnnotation.type === 'text' })) {
            return;
          }

          syncToDocument();
        },
      );

      return;
    }

    if (activeTool === 'sticky-note') {
      void Promise.resolve(controllerOptions.onCreateAnnotation?.(createStickyNoteAnnotationContent(toPagePoint(event)))).then(
        (createdAnnotation) => {
          switchToSelectToolAfterCreation();

          if (!createdAnnotation || createdAnnotation.type !== 'sticky-note') {
            return;
          }

          if (!startEditingSelection(createdAnnotation.id)) {
            return;
          }

          syncToDocument();
        },
      );
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    if (updateRotationGesture(event)) {
      return;
    }

    if (
      interactive &&
      activeTool === 'select' &&
      dragPointerId === event.pointerId &&
      dragAnnotationId &&
      dragStartPoint &&
      dragOriginBounds
    ) {

      const point = toPagePoint(event);
      dragCurrentBounds = {
        ...dragOriginBounds,
        x: dragOriginBounds.x + (point.x - dragStartPoint.x),
        y: dragOriginBounds.y + (point.y - dragStartPoint.y),
      };
      syncToDocument();

      return;
    }

    if (interactive && activeTool === 'connector' && connectorSourceAnnotationId) {
      connectorPreviewPoint = toPagePoint(event);
      syncToDocument();

      return;
    }

    if (!interactive || !isShapeTool(activeTool) || draftStartPoint === null || draftPointerId !== event.pointerId) {
      return;
    }

    const point = toPagePoint(event);
    updateDraftShape(
      activeTool,
      activeTool === 'circle'
        ? normalizeCircleBounds(draftStartPoint.x, draftStartPoint.y, point.x, point.y)
        : normalizeBounds(draftStartPoint.x, draftStartPoint.y, point.x, point.y),
    );
  }

  function handlePointerUp(event: PointerEvent): void {
    if (finishRotationGesture(event)) {
      return;
    }

    if (
      dragPointerId === event.pointerId &&
      dragAnnotationId &&
      dragOriginBounds &&
      dragCurrentBounds &&
      getDraggedAnnotation()
    ) {
      const dragCompletedBounds = { ...dragCurrentBounds };
      const dragShouldPersist = !areBoundsEqual(dragOriginBounds, dragCompletedBounds);

      if (!dragShouldPersist) {
        clearDraggedAnnotation();
        syncToDocument();

        return;
      }

      void Promise.resolve(controllerOptions.onMoveAnnotation?.(dragAnnotationId, dragCompletedBounds)).finally(() => {
        clearDraggedAnnotation();
        syncToDocument();
      });

      return;
    }

    if (draftPointerId !== event.pointerId) {
      return;
    }

    finishShape();
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (rotationPointerId === event.pointerId) {
      clearRotationGesture();
      syncToDocument();

      return;
    }

    if (dragPointerId === event.pointerId) {
      clearDraggedAnnotation();
      syncToDocument();

      return;
    }

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

    cancelled = clearEditingDraft() || cancelled;
    cancelled = clearDraftShape() || cancelled;
    cancelled = clearConnectorDraft() || cancelled;
    cancelled = clearDraggedAnnotation() || cancelled;
    cancelled = clearRotationGesture() || cancelled;
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
        clearEditingDraft();
        clearDraftShape();
        clearConnectorDraft();
        clearDraggedAnnotation();
        clearRotationGesture();
      }

      syncToDocument();
    },
    setAnnotations(nextAnnotations) {
      annotations = [...nextAnnotations];
      const currentEditingDraft = editingDraft;

      if (selectedAnnotationId && !annotations.some((annotation) => annotation.id === selectedAnnotationId)) {
        setSelection(null, true);
      }

      if (currentEditingDraft && !annotations.some((annotation) => annotation.id === currentEditingDraft.annotationId)) {
        clearEditingDraft();
      }

      const pendingBorderVisibility = pendingTextBorderVisibility;

      if (
        pendingBorderVisibility &&
        !annotations.some((annotation) => annotation.id === pendingBorderVisibility.annotationId)
      ) {
        pendingTextBorderVisibility = null;
      }

      const pendingRotation = pendingCanvasRotation;

      if (pendingRotation && !annotations.some((annotation) => annotation.id === pendingRotation.annotationId)) {
        pendingCanvasRotation = null;
      }

      const previewRotation = previewCanvasRotation;

      if (previewRotation && !annotations.some((annotation) => annotation.id === previewRotation.annotationId)) {
        clearRotationGesture();
      }

      if (!getPendingConnectorSourceAnnotation()) {
        clearConnectorDraft();
      }

      if (!getDraggedAnnotation()) {
        clearDraggedAnnotation();
      }

      syncToDocument();
    },
    setActiveTool(tool) {
      if (activeTool === tool) {
        return;
      }

      activeTool = tool;

      clearEditingDraft();
      clearDraftShape();
      clearConnectorDraft();
      clearDraggedAnnotation();
      clearRotationGesture();

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
