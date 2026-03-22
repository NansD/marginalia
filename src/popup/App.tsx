import { useEffect, useState } from 'react';

import type { ContentScriptState } from '@/shared/runtime/messages';
import { sendMessageToTab } from '@/shared/runtime/tabMessaging';
import { WorkspaceShell } from '@/shared/ui/WorkspaceShell';

type PopupState =
  | { kind: 'working'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const isContentScriptState = (value: unknown): value is ContentScriptState =>
  typeof value === 'object' &&
  value !== null &&
  'annotationModeEnabled' in value &&
  typeof value.annotationModeEnabled === 'boolean' &&
  'canonicalUrl' in value &&
  typeof value.canonicalUrl === 'string';

const queryActiveTab = async (): Promise<chrome.tabs.Tab | undefined> =>
  new Promise<chrome.tabs.Tab | undefined>((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });

const toggleAnnotationModeForActiveTab = async (): Promise<ContentScriptState> => {
  const activeTab = await queryActiveTab();

  if (activeTab?.id === undefined) {
    throw new Error('Open a standard web page, then click the Marginalia icon again.');
  }

  const response = await sendMessageToTab<ContentScriptState>(activeTab.id, { kind: 'toggle-annotation-mode' });

  if (!isContentScriptState(response)) {
    throw new Error('The current tab did not return its annotation state.');
  }

  return response;
};

export function App() {
  const [popupState, setPopupState] = useState<PopupState>({
    kind: 'working',
    message: 'Toggling annotation mode on the active tab…',
  });

  useEffect(() => {
    let isMounted = true;
    let closeTimerId: number | undefined;

    const toggleAnnotationMode = async (): Promise<void> => {
      setPopupState({
        kind: 'working',
        message: 'Toggling annotation mode on the active tab…',
      });

      try {
        const nextState = await toggleAnnotationModeForActiveTab();

        if (!isMounted) {
          return;
        }

        setPopupState({
          kind: 'success',
          message: nextState.annotationModeEnabled
            ? 'Annotation mode is now enabled. The in-page toolbar should be visible.'
            : 'Annotation mode is now disabled.',
        });
        closeTimerId = window.setTimeout(() => {
          window.close();
        }, 700);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPopupState({
          kind: 'error',
          message: `Could not toggle annotation mode: ${describeError(error)}`,
        });
      }
    };

    void toggleAnnotationMode();

    return () => {
      isMounted = false;

      if (closeTimerId !== undefined) {
        window.clearTimeout(closeTimerId);
      }
    };
  }, []);

  return (
    <WorkspaceShell surface="popup">
      <p className="panel__note">{popupState.message}</p>
      {popupState.kind === 'error' ? (
        <p className="panel__note">Marginalia can only annotate regular web pages where the content script is available.</p>
      ) : null}
    </WorkspaceShell>
  );
}
