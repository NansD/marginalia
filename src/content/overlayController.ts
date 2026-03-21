const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export const OVERLAY_ELEMENT_ID = 'marginalia-overlay';

const OVERLAY_Z_INDEX = '2147483647';

export interface OverlayController {
  setInteractive(enabled: boolean): void;
  syncToDocument(): void;
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

export const createOverlayController = (
  documentRef: Document = document,
  windowRef: Window = window,
): OverlayController => {
  let overlayElement: SVGSVGElement | null = null;
  let interactive = false;

  const ensureMounted = (): SVGSVGElement | null => {
    if (overlayElement?.isConnected) {
      return overlayElement;
    }

    const body = documentRef.body;

    if (!body) {
      return null;
    }

    overlayElement = documentRef.createElementNS(SVG_NAMESPACE, 'svg');
    overlayElement.id = OVERLAY_ELEMENT_ID;
    overlayElement.setAttribute('aria-hidden', 'true');
    overlayElement.dataset.marginaliaOverlay = 'true';
    overlayElement.style.position = 'fixed';
    overlayElement.style.inset = '0';
    overlayElement.style.zIndex = OVERLAY_Z_INDEX;
    overlayElement.style.overflow = 'visible';
    overlayElement.style.pointerEvents = interactive ? 'auto' : 'none';

    const interactionSurface = documentRef.createElementNS(SVG_NAMESPACE, 'rect');
    interactionSurface.setAttribute('x', '0');
    interactionSurface.setAttribute('y', '0');
    interactionSurface.setAttribute('width', '100%');
    interactionSurface.setAttribute('height', '100%');
    interactionSurface.setAttribute('fill', 'transparent');
    interactionSurface.style.pointerEvents = 'all';
    overlayElement.append(interactionSurface);

    body.append(overlayElement);
    syncToDocument();

    return overlayElement;
  };

  const syncToDocument = (): void => {
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

      const mountedOverlay = ensureMounted();

      if (!mountedOverlay) {
        return;
      }

      mountedOverlay.dataset.mode = enabled ? 'interactive' : 'inert';
      mountedOverlay.style.pointerEvents = enabled ? 'auto' : 'none';
      syncToDocument();
    },
    syncToDocument,
  };
};
