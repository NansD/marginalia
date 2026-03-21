import type { Annotation, PageRecord } from '@/shared/models/annotations';

export interface StorageAdapter {
  getAnnotations(canonicalUrl: string): Promise<Annotation[]>;
  saveAnnotation(canonicalUrl: string, annotation: Annotation): Promise<Annotation>;
  deleteAnnotation(canonicalUrl: string, annotationId: string): Promise<boolean>;
  listAnnotatedUrls(): Promise<PageRecord[]>;
}
