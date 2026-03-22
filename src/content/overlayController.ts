import {
  isRectangleAnnotation,
  type Annotation,
  type RectangleAnnotation,
  type RectangleAnnotationContent,
} from '@/shared/models/annotations';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export const OVERLAY_ELEMENT_ID = 'marginalia-overlay';
export const OVERLAY_TOOLBAR_ID = 'marginalia-overlay-toolbar';

const OVERLAY_Z_INDEX = '2147483647';
const MIN_RECT_SIZE = 8;
const ACCENT_COLOR = '#4f46e5';

export interface OverlayController {
  setInteractive(enabled: boolean): void;
  setAnnotations(annotations: Annotation[]): void;
  syncToDocument(): void;
}

export interface OverlayControllerOptions {
  onCreateAnnotation?: (content: RectangleAnnotationContent) => Promise<void> | void;
  onRequestDisable?: () => Promise<void> | void;
}

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

const createRectangleElement = (documentRef: Document, annotation: RectangleAnnotation): SVGRectElement => {
  const rectangle = documentRef.createElementNS(SVG_NAMESPACE, 'rect');

  rectangle.dataset.marginaliaAnnotationId = annotation.id;
  rectangle.setAttribute('x', `${annotation.content.x}`);
  rectangle.setAttribute('y', `${annotation.content.y}`);
  rectangle.setAttribute('width', `${annotation.content.width}`);
  rectangle.setAttribute('height', `${annotation.content.height}`);
  rectangle.setAttribute('rx', '6');
  rectangle.setAttribute('fill', ACCENT_COLOR);
  rectangle.setAttribute('fill-opacity', '0.14');
  rectangle.setAttribute('stroke', ACCENT_COLOR);
  rectangle.setAttribute('stroke-width', '2');
  rectangle.setAttribute('vector-effect', 'non-scaling-stroke');
  rectangle.style.pointerEvents = 'none';

  return rectangle;
};

const normalizeRectangle = (startX: number, startY: number, currentX: number, currentY: number): RectangleAnnotationContent => ({
  kind: 'rectangle',
  x: Math.min(startX, currentX),
  y: Math.min(startY, currentY),
  width: Math.abs(currentX - startX),
  height: Math.abs(currentY - startY),
});

export const createOverlayController = (
  documentRef: Document = document,
  windowRef: Window = window,
  controllerOptions: OverlayControllerOptions = {},
): OverlayController => {
  let overlayElement: SVGSVGElement | null = null;
  let annotationsLayer: SVGGElement | null = null;
  let draftRectangleElement: SVGRectElement | null = null;
  let toolbarElement: HTMLDivElement | null = null;
  let toolbarStatusElement: HTMLParagraphElement | null = null;
  let interactive = false;
  let annotations: Annotation[] = [];
  let draftPointerId: number | null = null;
  let draftStartPoint: { x: number; y: number } | null = null;

  const getShouldRenderOverlay = (): boolean => interactive || annotations.length > 0 || draftStartPoint !== null;

  const toPagePoint = (event: PointerEvent): { x: number; y: number } => ({
    x: event.clientX + windowRef.scrollX,
    y: event.clientY + windowRef.scrollY,
  });

  const clearDraftRectangle = (): void => {
    draftPointerId = null;
    draftStartPoint = null;
    draftRectangleElement?.remove();
    draftRectangleElement = null;
  };

  const ensureToolbarMounted = (): HTMLDivElement | null => {
    if (!interactive) {
      toolbarElement?.remove();
      toolbarElement = null;
      toolbarStatusElement = null;

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
    toolbarElement.style.width = '280px';
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

    const hintElement = documentRef.createElement('p');
    hintElement.textContent = 'Drag anywhere on the page to draw a rectangle annotation.';
    hintElement.style.margin = '8px 0 0';
    hintElement.style.fontSize = '13px';
    hintElement.style.color = '#cbd5e1';
    toolbarElement.append(hintElement);

    toolbarStatusElement = documentRef.createElement('p');
    toolbarStatusElement.style.margin = '8px 0 0';
    toolbarStatusElement.style.fontSize = '12px';
    toolbarStatusElement.style.color = '#a5b4fc';
    toolbarElement.append(toolbarStatusElement);

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

    if (!mountedToolbar || !toolbarStatusElement) {
      return;
    }

    toolbarStatusElement.textContent =
      annotations.length === 0
        ? 'No annotations on this page yet.'
        : `${annotations.length} annotation${annotations.length === 1 ? '' : 's'} on this page.`;
  };

  const renderAnnotations = (): void => {
    if (!annotationsLayer) {
      return;
    }

    annotationsLayer.replaceChildren(
      ...annotations.filter(isRectangleAnnotation).map((annotation) => createRectangleElement(documentRef, annotation)),
    );
  };

  const syncToDocument = (): void => {
    if (!getShouldRenderOverlay()) {
      overlayElement?.remove();
      overlayElement = null;
      annotationsLayer = null;
      clearDraftRectangle();
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
    mountedOverlay.style.pointerEvents = interactive ? 'auto' : 'none';
    renderAnnotations();
    updateToolbar();
  };

  const updateDraftRectangle = (draftRectangle: RectangleAnnotationContent): void => {
    if (!draftRectangleElement) {
      const mountedOverlay = ensureMounted();

      if (!mountedOverlay) {
        return;
      }

      draftRectangleElement = documentRef.createElementNS(SVG_NAMESPACE, 'rect');
      draftRectangleElement.setAttribute('rx', '6');
      draftRectangleElement.setAttribute('fill', ACCENT_COLOR);
      draftRectangleElement.setAttribute('fill-opacity', '0.08');
      draftRectangleElement.setAttribute('stroke', ACCENT_COLOR);
      draftRectangleElement.setAttribute('stroke-width', '2');
      draftRectangleElement.setAttribute('stroke-dasharray', '6 4');
      draftRectangleElement.setAttribute('vector-effect', 'non-scaling-stroke');
      draftRectangleElement.style.pointerEvents = 'none';
      mountedOverlay.append(draftRectangleElement);
    }

    draftRectangleElement.setAttribute('x', `${draftRectangle.x}`);
    draftRectangleElement.setAttribute('y', `${draftRectangle.y}`);
    draftRectangleElement.setAttribute('width', `${draftRectangle.width}`);
    draftRectangleElement.setAttribute('height', `${draftRectangle.height}`);
  };

  const finishRectangle = (): void => {
    if (!draftStartPoint || !draftRectangleElement) {
      clearDraftRectangle();

      return;
    }

    const rectangle = normalizeRectangle(
      Number(draftRectangleElement.getAttribute('x')),
      Number(draftRectangleElement.getAttribute('y')),
      Number(draftRectangleElement.getAttribute('x')) + Number(draftRectangleElement.getAttribute('width')),
      Number(draftRectangleElement.getAttribute('y')) + Number(draftRectangleElement.getAttribute('height')),
    );

    clearDraftRectangle();

    if (rectangle.width < MIN_RECT_SIZE || rectangle.height < MIN_RECT_SIZE) {
      syncToDocument();

      return;
    }

    void controllerOptions.onCreateAnnotation?.(rectangle);
    syncToDocument();
  };

  const handlePointerDown = (event: PointerEvent): void => {
    if (!interactive || event.button !== 0) {
      return;
    }

    event.preventDefault();
    draftPointerId = event.pointerId;
    draftStartPoint = toPagePoint(event);
    updateDraftRectangle({
      kind: 'rectangle',
      x: draftStartPoint.x,
      y: draftStartPoint.y,
      width: 0,
      height: 0,
    });
    overlayElement?.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (!interactive || draftStartPoint === null || draftPointerId !== event.pointerId) {
      return;
    }

    const point = toPagePoint(event);
    updateDraftRectangle(normalizeRectangle(draftStartPoint.x, draftStartPoint.y, point.x, point.y));
  };

  const handlePointerUp = (event: PointerEvent): void => {
    if (draftPointerId !== event.pointerId) {
      return;
    }

    finishRectangle();
  };

  const handlePointerCancel = (event: PointerEvent): void => {
    if (draftPointerId !== event.pointerId) {
      return;
    }

    clearDraftRectangle();
    syncToDocument();
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
    overlayElement.addEventListener('pointerdown', handlePointerDown);
    overlayElement.addEventListener('pointermove', handlePointerMove);
    overlayElement.addEventListener('pointerup', handlePointerUp);
    overlayElement.addEventListener('pointercancel', handlePointerCancel);

    annotationsLayer = documentRef.createElementNS(SVG_NAMESPACE, 'g');
    annotationsLayer.dataset.marginaliaLayer = 'annotations';
    overlayElement.append(annotationsLayer);

    body.append(overlayElement);

    return overlayElement;
  };

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

  return {
    setInteractive(enabled) {
      interactive = enabled;

      if (!enabled) {
        clearDraftRectangle();
      }

      syncToDocument();
    },
    setAnnotations(nextAnnotations) {
      annotations = [...nextAnnotations];
      syncToDocument();
    },
    syncToDocument,
  };
};
