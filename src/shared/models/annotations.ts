export const ANNOTATION_TYPES = ['rectangle', 'ellipse', 'circle', 'text', 'sticky-note', 'connector'] as const;

export type AnnotationType = (typeof ANNOTATION_TYPES)[number];

export const ANNOTATION_PALETTE = ['yellow', 'pink', 'green', 'blue', 'orange', 'purple'] as const;

export type AnnotationPalette = (typeof ANNOTATION_PALETTE)[number];

export const CONNECTOR_ANCHORS = ['top', 'right', 'bottom', 'left', 'center'] as const;

export type ConnectorAnchor = (typeof CONNECTOR_ANCHORS)[number];

export const DEFAULT_CANVAS_ROTATION = 0;
export const DEFAULT_TEXT_BORDER_VISIBLE = false;

export interface CanvasBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasAnnotationContent extends CanvasBounds {
  rotation: number;
  color?: AnnotationPalette;
}

export interface RectangleAnnotationContent extends CanvasAnnotationContent {
  kind: 'rectangle';
  text?: string;
}

export interface EllipseAnnotationContent extends CanvasAnnotationContent {
  kind: 'ellipse';
  text?: string;
}

export interface CircleAnnotationContent extends CanvasAnnotationContent {
  kind: 'circle';
  text?: string;
}

export interface TextAnnotationContent extends CanvasAnnotationContent {
  kind: 'text';
  text: string;
  borderVisible: boolean;
}

export interface StickyNoteAnnotationContent extends CanvasAnnotationContent {
  kind: 'sticky-note';
  color: AnnotationPalette;
  text: string;
  collapsed: boolean;
  title?: string;
}

export interface ConnectorAnnotationContent {
  kind: 'connector';
  sourceId: string;
  sourceAnchor: ConnectorAnchor;
  targetId: string;
  targetAnchor: ConnectorAnchor;
  color: AnnotationPalette;
  label?: string;
}

export type AnnotationContent =
  | CircleAnnotationContent
  | ConnectorAnnotationContent
  | EllipseAnnotationContent
  | RectangleAnnotationContent
  | StickyNoteAnnotationContent
  | TextAnnotationContent;

interface BaseAnnotation<TType extends AnnotationType, TContent extends AnnotationContent> {
  id: string;
  type: TType;
  createdAt: string;
  updatedAt: string;
  content: TContent;
}

export type RectangleAnnotation = BaseAnnotation<'rectangle', RectangleAnnotationContent>;
export type EllipseAnnotation = BaseAnnotation<'ellipse', EllipseAnnotationContent>;
export type CircleAnnotation = BaseAnnotation<'circle', CircleAnnotationContent>;
export type TextAnnotation = BaseAnnotation<'text', TextAnnotationContent>;
export type StickyNoteAnnotation = BaseAnnotation<'sticky-note', StickyNoteAnnotationContent>;
export type ConnectorAnnotation = BaseAnnotation<'connector', ConnectorAnnotationContent>;

export type CanvasAnnotation = RectangleAnnotation | EllipseAnnotation | CircleAnnotation | StickyNoteAnnotation | TextAnnotation;

export type Annotation =
  | CanvasAnnotation
  | ConnectorAnnotation;

export const normalizeAnnotation = (annotation: Annotation): Annotation => {
  switch (annotation.type) {
    case 'connector':
      return annotation;
    case 'text':
      return {
        ...annotation,
        content: {
          ...annotation.content,
          rotation: annotation.content.rotation ?? DEFAULT_CANVAS_ROTATION,
          borderVisible: annotation.content.borderVisible ?? DEFAULT_TEXT_BORDER_VISIBLE,
        },
      };
    case 'rectangle':
      return {
        ...annotation,
        content: {
          ...annotation.content,
          rotation: annotation.content.rotation ?? DEFAULT_CANVAS_ROTATION,
        },
      };
    case 'ellipse':
      return {
        ...annotation,
        content: {
          ...annotation.content,
          rotation: annotation.content.rotation ?? DEFAULT_CANVAS_ROTATION,
        },
      };
    case 'circle':
      return {
        ...annotation,
        content: {
          ...annotation.content,
          rotation: annotation.content.rotation ?? DEFAULT_CANVAS_ROTATION,
        },
      };
    case 'sticky-note':
      return {
        ...annotation,
        content: {
          ...annotation.content,
          rotation: annotation.content.rotation ?? DEFAULT_CANVAS_ROTATION,
        },
      };
  }
};

export const normalizeAnnotations = (annotations: Annotation[]): Annotation[] => annotations.map(normalizeAnnotation);

export const isRectangleAnnotation = (annotation: Annotation): annotation is RectangleAnnotation =>
  annotation.type === 'rectangle' && annotation.content.kind === 'rectangle';

export const isCircleAnnotation = (annotation: Annotation): annotation is CircleAnnotation =>
  annotation.type === 'circle' && annotation.content.kind === 'circle';

export const isCanvasAnnotation = (annotation: Annotation): annotation is CanvasAnnotation =>
  annotation.content.kind !== 'connector';

export const isConnectorAnnotation = (annotation: Annotation): annotation is ConnectorAnnotation =>
  annotation.type === 'connector' && annotation.content.kind === 'connector';

export interface PageRecord {
  canonicalUrl: string;
  pageTitle: string;
  lastVisited: string;
  tags: string[];
  annotations: Annotation[];
}

export const normalizePageRecord = (pageRecord: PageRecord): PageRecord => ({
  ...pageRecord,
  annotations: normalizeAnnotations(pageRecord.annotations),
});

export const createEmptyPageRecord = (
  canonicalUrl: string,
  overrides: Partial<Omit<PageRecord, 'canonicalUrl'>> = {},
): PageRecord => ({
  canonicalUrl,
  pageTitle: overrides.pageTitle ?? '',
  lastVisited: overrides.lastVisited ?? new Date().toISOString(),
  tags: overrides.tags ?? [],
  annotations: normalizeAnnotations(overrides.annotations ?? []),
});
