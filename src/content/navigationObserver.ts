import { canonicalizeUrl } from '@/shared/url/canonicalizeUrl';

export interface NavigationUpdate {
  canonicalUrl: string;
  href: string;
}

export interface NavigationObserver {
  disconnect(): void;
}

export const observePageNavigation = (
  onChange: (update: NavigationUpdate) => void,
  windowRef: Window = window,
  documentRef: Document = document,
): NavigationObserver => {
  let lastHref = windowRef.location.href;
  let pendingTimeoutId: number | null = null;

  const emitIfChanged = (): void => {
    const nextHref = windowRef.location.href;

    if (nextHref === lastHref) {
      return;
    }

    lastHref = nextHref;
    onChange({
      canonicalUrl: canonicalizeUrl(nextHref),
      href: nextHref,
    });
  };

  const scheduleCheck = (): void => {
    if (pendingTimeoutId !== null) {
      return;
    }

    pendingTimeoutId = windowRef.setTimeout(() => {
      pendingTimeoutId = null;
      emitIfChanged();
    }, 50);
  };

  const historyRef = windowRef.history as History & {
    pushState: History['pushState'];
    replaceState: History['replaceState'];
  };
  const originalPushState = historyRef.pushState.bind(windowRef.history);
  const originalReplaceState = historyRef.replaceState.bind(windowRef.history);

  historyRef.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
    originalPushState(data, unused, url);
    scheduleCheck();
  }) as History['pushState'];

  historyRef.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
    originalReplaceState(data, unused, url);
    scheduleCheck();
  }) as History['replaceState'];

  const mutationObserver = new MutationObserver(() => {
    scheduleCheck();
  });

  mutationObserver.observe(documentRef, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  const pollIntervalId = windowRef.setInterval(() => {
    emitIfChanged();
  }, 250);

  windowRef.addEventListener('hashchange', scheduleCheck);
  windowRef.addEventListener('popstate', scheduleCheck);

  return {
    disconnect() {
      historyRef.pushState = originalPushState;
      historyRef.replaceState = originalReplaceState;

      if (pendingTimeoutId !== null) {
        windowRef.clearTimeout(pendingTimeoutId);
      }

      windowRef.clearInterval(pollIntervalId);
      windowRef.removeEventListener('hashchange', scheduleCheck);
      windowRef.removeEventListener('popstate', scheduleCheck);
      mutationObserver.disconnect();
    },
  };
};
