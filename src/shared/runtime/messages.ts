export const ANNOTATION_TOOLS = ['select', 'text', 'sticky-note', 'rectangle', 'ellipse', 'circle', 'connector'] as const;

export type AnnotationTool = (typeof ANNOTATION_TOOLS)[number];

export const ANNOTATION_TOOL_METADATA = {
  select: {
    label: 'Select',
    hint: 'Click an annotation to select it.',
  },
  text: {
    label: 'Text',
    hint: 'Click anywhere on the page to place a text annotation.',
  },
  'sticky-note': {
    label: 'Sticky note',
    hint: 'Click anywhere on the page to place a sticky note.',
  },
  rectangle: {
    label: 'Rectangle',
    hint: 'Drag anywhere on the page to draw a rectangle annotation.',
  },
  ellipse: {
    label: 'Ellipse',
    hint: 'Drag anywhere on the page to draw an ellipse annotation.',
  },
  circle: {
    label: 'Circle',
    hint: 'Drag anywhere on the page to draw a perfect circle annotation.',
  },
  connector: {
    label: 'Connector',
    hint: 'Click a source annotation, then click a target annotation to connect them.',
  },
} as const satisfies Record<AnnotationTool, { label: string; hint: string }>;

export const ANNOTATION_COMMANDS = ['cancel-current-action', 'delete-selected-annotation', 'undo', 'redo'] as const;

export type AnnotationCommand = (typeof ANNOTATION_COMMANDS)[number];

export interface ToggleAnnotationModeMessage {
  kind: 'toggle-annotation-mode';
}

export interface SetAnnotationModeMessage {
  kind: 'set-annotation-mode';
  enabled: boolean;
}

export interface SelectAnnotationToolMessage {
  kind: 'select-annotation-tool';
  tool: AnnotationTool;
}

export interface RunAnnotationCommandMessage {
  kind: 'run-annotation-command';
  command: AnnotationCommand;
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
  | RunAnnotationCommandMessage
  | SelectAnnotationToolMessage
  | SetAnnotationModeMessage
  | ToggleAnnotationModeMessage;

const RUNTIME_MESSAGE_KINDS = [
  'annotations-changed',
  'page-state-changed',
  'request-page-state',
  'run-annotation-command',
  'select-annotation-tool',
  'set-annotation-mode',
  'toggle-annotation-mode',
] as const satisfies readonly RuntimeMessage['kind'][];

export const isRuntimeMessage = (value: unknown): value is RuntimeMessage =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  typeof value.kind === 'string' &&
  RUNTIME_MESSAGE_KINDS.includes(value.kind as RuntimeMessage['kind']);
