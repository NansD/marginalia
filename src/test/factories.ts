import type {
  Annotation,
  ConnectorAnnotation,
  EllipseAnnotation,
  PageRecord,
  RectangleAnnotation,
  StickyNoteAnnotation,
  TextAnnotation,
} from '@/shared/models/annotations';

const DEFAULT_CREATED_AT = '2025-01-01T00:00:00.000Z';
const DEFAULT_UPDATED_AT = '2025-01-01T00:00:00.000Z';

type AnnotationOverrides<T extends Annotation> = Partial<Omit<T, 'content' | 'type'>> & {
  content?: Partial<T['content']>;
};

const mergeAnnotation = <T extends Annotation>(annotation: T, overrides: AnnotationOverrides<T> = {}): T => ({
  ...annotation,
  ...overrides,
  content: {
    ...annotation.content,
    ...overrides.content,
  },
}) as T;

export const buildRectangleAnnotation = (
  id = 'annotation-rectangle',
  overrides: AnnotationOverrides<RectangleAnnotation> = {},
): RectangleAnnotation =>
  mergeAnnotation(
    {
      id,
      type: 'rectangle',
      createdAt: DEFAULT_CREATED_AT,
      updatedAt: DEFAULT_UPDATED_AT,
      content: {
        kind: 'rectangle',
        x: 16,
        y: 24,
        width: 160,
        height: 72,
      },
    },
    overrides,
  );

export const buildEllipseAnnotation = (
  id = 'annotation-ellipse',
  overrides: AnnotationOverrides<EllipseAnnotation> = {},
): EllipseAnnotation =>
  mergeAnnotation(
    {
      id,
      type: 'ellipse',
      createdAt: DEFAULT_CREATED_AT,
      updatedAt: DEFAULT_UPDATED_AT,
      content: {
        kind: 'ellipse',
        x: 32,
        y: 48,
        width: 120,
        height: 64,
        color: 'green',
      },
    },
    overrides,
  );

export const buildTextAnnotation = (
  id = 'annotation-text',
  overrides: AnnotationOverrides<TextAnnotation> = {},
): TextAnnotation =>
  mergeAnnotation(
    {
      id,
      type: 'text',
      createdAt: DEFAULT_CREATED_AT,
      updatedAt: DEFAULT_UPDATED_AT,
      content: {
        kind: 'text',
        x: 48,
        y: 64,
        width: 200,
        height: 48,
        color: 'blue',
        text: 'Test annotation',
      },
    },
    overrides,
  );

export const buildStickyNoteAnnotation = (
  id = 'annotation-sticky-note',
  overrides: AnnotationOverrides<StickyNoteAnnotation> = {},
): StickyNoteAnnotation =>
  mergeAnnotation(
    {
      id,
      type: 'sticky-note',
      createdAt: DEFAULT_CREATED_AT,
      updatedAt: DEFAULT_UPDATED_AT,
      content: {
        kind: 'sticky-note',
        x: 64,
        y: 80,
        width: 180,
        height: 140,
        color: 'yellow',
        text: 'Remember this detail',
        collapsed: false,
        title: 'Note',
      },
    },
    overrides,
  );

export const buildConnectorAnnotation = (
  id = 'annotation-connector',
  overrides: AnnotationOverrides<ConnectorAnnotation> = {},
): ConnectorAnnotation =>
  mergeAnnotation(
    {
      id,
      type: 'connector',
      createdAt: DEFAULT_CREATED_AT,
      updatedAt: DEFAULT_UPDATED_AT,
      content: {
        kind: 'connector',
        sourceId: 'annotation-rectangle',
        sourceAnchor: 'right',
        targetId: 'annotation-text',
        targetAnchor: 'left',
        color: 'purple',
        label: 'links to',
      },
    },
    overrides,
  );

export const buildPageRecord = (
  canonicalUrl = 'https://example.com/page',
  overrides: Partial<Omit<PageRecord, 'canonicalUrl'>> = {},
): PageRecord => ({
  canonicalUrl,
  pageTitle: overrides.pageTitle ?? 'Example page',
  lastVisited: overrides.lastVisited ?? DEFAULT_UPDATED_AT,
  tags: overrides.tags ?? ['research'],
  annotations: overrides.annotations ?? [],
});
