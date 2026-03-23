import type { Annotation } from '@/shared/models/annotations';
import { ANNOTATION_TOOL_METADATA, type AnnotationTool } from '@/shared/runtime/messages';
import {
  DEFAULT_SHORTCUT_BINDINGS,
  formatShortcut,
  type ShortcutAction,
  type ShortcutBindings,
} from '@/shared/runtime/shortcuts';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const TOOLBAR_TOOL_SHORTCUT_ACTIONS: Record<AnnotationTool, ShortcutAction> = {
  select: 'selectTool',
  text: 'textTool',
  'sticky-note': 'stickyNoteTool',
  rectangle: 'rectangleTool',
  ellipse: 'ellipseTool',
  circle: 'circleTool',
  connector: 'connectorTool',
};

export const TOOLBAR_TOOL_ORDER = [
  'select',
  'text',
  'sticky-note',
  'rectangle',
  'ellipse',
  'circle',
  'connector',
] as const satisfies readonly AnnotationTool[];

const ANNOTATION_KIND_LABELS: Record<Annotation['type'], string> = {
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  circle: 'Circle',
  text: 'Text',
  'sticky-note': 'Sticky note',
  connector: 'Connector',
};

export const getToolbarToolLabel = (tool: AnnotationTool): string => ANNOTATION_TOOL_METADATA[tool].label;

export const getToolbarToolHint = (tool: AnnotationTool): string => ANNOTATION_TOOL_METADATA[tool].hint;

export const getAnnotationKindLabel = (annotationType: Annotation['type']): string => ANNOTATION_KIND_LABELS[annotationType];

export const getToolbarToolShortcutLabel = (
  tool: AnnotationTool,
  bindings: ShortcutBindings = DEFAULT_SHORTCUT_BINDINGS,
  platform?: string,
): string => formatShortcut(bindings[TOOLBAR_TOOL_SHORTCUT_ACTIONS[tool]], platform);

export const getToolbarToolTitle = (
  tool: AnnotationTool,
  bindings: ShortcutBindings = DEFAULT_SHORTCUT_BINDINGS,
  platform?: string,
): string => `${getToolbarToolLabel(tool)} • ${getToolbarToolShortcutLabel(tool, bindings, platform)}`;

export interface ToolbarStatusOptions {
  activeTool: AnnotationTool;
  annotationsCount: number;
  pendingConnectorSourceType?: Extract<Annotation['type'], 'circle' | 'ellipse' | 'rectangle' | 'sticky-note' | 'text'>;
  selectedAnnotationType?: Annotation['type'];
}

export const getToolbarStatusMessage = ({
  activeTool,
  annotationsCount,
  pendingConnectorSourceType,
  selectedAnnotationType,
}: ToolbarStatusOptions): string => {
  if (activeTool === 'connector' && pendingConnectorSourceType) {
    return `Connector tool active. Source ${getAnnotationKindLabel(pendingConnectorSourceType)} annotation selected. Click another annotation to finish.`;
  }

  if (selectedAnnotationType) {
    return `${getToolbarToolLabel(activeTool)} tool active. Selected ${getAnnotationKindLabel(selectedAnnotationType)} annotation.`;
  }

  return `${getToolbarToolLabel(activeTool)} tool active. ${
    annotationsCount === 0 ? 'No annotations on this page yet.' : `${annotationsCount} annotation${annotationsCount === 1 ? '' : 's'} on this page.`
  }`;
};

const createSvg = (documentRef: Document): SVGSVGElement => {
  const svg = documentRef.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.display = 'block';
  svg.style.overflow = 'visible';

  return svg;
};

const appendNode = (
  documentRef: Document,
  svg: SVGSVGElement,
  tagName: 'circle' | 'ellipse' | 'path' | 'rect',
  attributes: Record<string, string>,
): void => {
  const node = documentRef.createElementNS(SVG_NAMESPACE, tagName);

  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }

  svg.append(node);
};

const baseStroke = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'stroke-width': '1.8',
};

export const createToolbarIcon = (documentRef: Document, tool: AnnotationTool): SVGSVGElement => {
  const svg = createSvg(documentRef);

  switch (tool) {
    case 'select':
      appendNode(documentRef, svg, 'path', {
        d: 'M5 4.75V17.5L9.05 13.95L12.3 19.25L14.65 17.9L11.45 12.7H17.25L5 4.75Z',
        fill: 'currentColor',
      });
      break;
    case 'text':
      appendNode(documentRef, svg, 'path', {
        ...baseStroke,
        d: 'M5 6H19M12 6V18M8.75 18H15.25',
      });
      break;
    case 'sticky-note':
      appendNode(documentRef, svg, 'path', {
        ...baseStroke,
        d: 'M7 4.75H17C18.24 4.75 19.25 5.76 19.25 7V17L15.5 20.75H7C5.76 20.75 4.75 19.74 4.75 18.5V7C4.75 5.76 5.76 4.75 7 4.75Z',
      });
      appendNode(documentRef, svg, 'path', {
        ...baseStroke,
        d: 'M14.75 20.25V16.75H18.25',
      });
      break;
    case 'rectangle':
      appendNode(documentRef, svg, 'rect', {
        ...baseStroke,
        x: '5.25',
        y: '6.25',
        width: '13.5',
        height: '11.5',
        rx: '2.5',
      });
      break;
    case 'ellipse':
      appendNode(documentRef, svg, 'ellipse', {
        ...baseStroke,
        cx: '12',
        cy: '12',
        rx: '7.5',
        ry: '5.25',
      });
      break;
    case 'circle':
      appendNode(documentRef, svg, 'circle', {
        ...baseStroke,
        cx: '12',
        cy: '12',
        r: '6.75',
      });
      break;
    case 'connector':
      appendNode(documentRef, svg, 'circle', {
        cx: '6.5',
        cy: '8',
        r: '1.5',
        fill: 'currentColor',
      });
      appendNode(documentRef, svg, 'circle', {
        cx: '17.5',
        cy: '16',
        r: '1.5',
        fill: 'currentColor',
      });
      appendNode(documentRef, svg, 'path', {
        ...baseStroke,
        d: 'M8 8.9C10.3 8.9 10.55 16 14.5 16H16',
      });
      break;
  }

  return svg;
};
