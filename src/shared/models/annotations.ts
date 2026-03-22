export const ANNOTATION_TYPES = ['rectangle'] as const;

export type AnnotationType = (typeof ANNOTATION_TYPES)[number];

export interface RectangleAnnotationContent {
  kind: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnnotationContent = RectangleAnnotationContent;

export interface Annotation {
  id: string;
  type: AnnotationType;
  createdAt: string;
  updatedAt: string;
  content: AnnotationContent;
}

export interface PageRecord {
  canonicalUrl: string;
  pageTitle: string;
  lastVisited: string;
  tags: string[];
  annotations: Annotation[];
}

export const createEmptyPageRecord = (
  canonicalUrl: string,
  overrides: Partial<Omit<PageRecord, 'canonicalUrl'>> = {},
): PageRecord => ({
  canonicalUrl,
  pageTitle: overrides.pageTitle ?? '',
  lastVisited: overrides.lastVisited ?? new Date().toISOString(),
  tags: overrides.tags ?? [],
  annotations: overrides.annotations ?? [],
});
