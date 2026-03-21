export interface ToggleAnnotationModeMessage {
  kind: 'toggle-annotation-mode';
}

export interface SetAnnotationModeMessage {
  kind: 'set-annotation-mode';
  enabled: boolean;
}

export interface RequestPageStateMessage {
  kind: 'request-page-state';
}

export interface PageStateChangedMessage {
  kind: 'page-state-changed';
  canonicalUrl: string;
  pageTitle: string;
  annotationModeEnabled: boolean;
}

export interface AnnotationsChangedMessage {
  kind: 'annotations-changed';
  canonicalUrl: string;
}

export interface ContentScriptState {
  annotationModeEnabled: boolean;
  canonicalUrl: string;
}

export type RuntimeMessage =
  | AnnotationsChangedMessage
  | PageStateChangedMessage
  | RequestPageStateMessage
  | SetAnnotationModeMessage
  | ToggleAnnotationModeMessage;

export const isRuntimeMessage = (value: unknown): value is RuntimeMessage =>
  typeof value === 'object' && value !== null && 'kind' in value;
