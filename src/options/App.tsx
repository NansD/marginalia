import { useEffect, useMemo, useState } from 'react';

import {
  areShortcutBindingsEqual,
  DEFAULT_SHORTCUT_BINDINGS,
  ensureShortcutBindings,
  formatShortcut,
  readShortcutBindingFromKeyboardEvent,
  SHORTCUT_ACTIONS,
  SHORTCUT_DEFINITIONS,
  subscribeToShortcutBindings,
  shouldIgnoreKeyboardEventTarget,
  type ShortcutBindings,
  type ShortcutAction,
  type ShortcutSection,
  updateShortcutBinding,
  validateShortcutBinding,
} from '@/shared/runtime/shortcuts';
import { WorkspaceShell } from '@/shared/ui/WorkspaceShell';

const SHORTCUT_SECTIONS: ShortcutSection[] = ['General', 'Tools', 'Editing'];

const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function App() {
  const [shortcutBindings, setShortcutBindings] = useState<ShortcutBindings>(DEFAULT_SHORTCUT_BINDINGS);
  const [statusMessage, setStatusMessage] = useState('Loading saved shortcut bindings…');
  const [recordingAction, setRecordingAction] = useState<ShortcutAction | null>(null);
  const [pendingAction, setPendingAction] = useState<ShortcutAction | null>(null);
  const [actionError, setActionError] = useState<{ action: ShortcutAction; message: string } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToShortcutBindings((nextBindings) => {
      if (!isMounted) {
        return;
      }

      setShortcutBindings(nextBindings);
      setStatusMessage('Shortcut bindings update automatically when your synced settings change.');
    });

    void ensureShortcutBindings()
      .then((nextBindings) => {
        if (!isMounted) {
          return;
        }

        setShortcutBindings(nextBindings);
        setStatusMessage('Shortcut bindings update automatically when your synced settings change.');
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setStatusMessage(`Could not load shortcut bindings: ${describeError(error)}`);
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!recordingAction) {
      return;
    }

    const definition = SHORTCUT_DEFINITIONS[recordingAction];

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (shouldIgnoreKeyboardEventTarget(event)) {
        return;
      }

      const nextBinding = readShortcutBindingFromKeyboardEvent(event);

      if (!nextBinding) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const validationError = validateShortcutBinding(shortcutBindings, recordingAction, nextBinding);

      if (validationError) {
        setActionError({ action: recordingAction, message: validationError });
        setStatusMessage(validationError);

        return;
      }

      setPendingAction(recordingAction);

      void updateShortcutBinding(recordingAction, nextBinding)
        .then(() => {
          setActionError(null);
          setRecordingAction(null);
          setStatusMessage(`Saved ${definition.label} as ${formatShortcut(nextBinding)}.`);
        })
        .catch((error: unknown) => {
          const message = describeError(error);

          setActionError({ action: recordingAction, message });
          setStatusMessage(`Could not save ${definition.label}: ${message}`);
        })
        .finally(() => {
          setPendingAction((currentAction) => (currentAction === recordingAction ? null : currentAction));
        });
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [recordingAction, shortcutBindings]);

  const groupedShortcuts = useMemo(
    () =>
      SHORTCUT_SECTIONS.map((section) => ({
        actionIds: SHORTCUT_ACTIONS.filter((action) => SHORTCUT_DEFINITIONS[action].section === section),
        section,
        })),
    [],
  );

  const startRecording = (action: ShortcutAction): void => {
    setRecordingAction(action);
    setActionError(null);
    setStatusMessage(`Recording ${SHORTCUT_DEFINITIONS[action].label}. Press the exact keys you want to use.`);
  };

  const stopRecording = (): void => {
    setRecordingAction(null);
    setActionError(null);
    setStatusMessage('Shortcut bindings update automatically when your synced settings change.');
  };

  const resetShortcut = (action: ShortcutAction): void => {
    const defaultBinding = DEFAULT_SHORTCUT_BINDINGS[action];
    const definition = SHORTCUT_DEFINITIONS[action];

    setPendingAction(action);
    setRecordingAction((currentAction) => (currentAction === action ? null : currentAction));
    setActionError(null);

    void updateShortcutBinding(action, defaultBinding)
      .then(() => {
        setStatusMessage(`Restored ${definition.label} to ${formatShortcut(defaultBinding)}.`);
      })
      .catch((error: unknown) => {
        const message = describeError(error);

        setActionError({ action, message });
        setStatusMessage(`Could not reset ${definition.label}: ${message}`);
      })
      .finally(() => {
        setPendingAction((currentAction) => (currentAction === action ? null : currentAction));
      });
  };

  return (
    <WorkspaceShell surface="options">
      <p className="panel__note">{statusMessage}</p>
      {groupedShortcuts.map(({ actionIds, section }) => (
        <section key={section} aria-labelledby={`shortcut-section-${section}`}>
          <h2 id={`shortcut-section-${section}`}>{section}</h2>
          <ul className="panel__list" aria-label={`${section} shortcuts`}>
            {actionIds.map((action) => {
              const definition = SHORTCUT_DEFINITIONS[action];
              const currentBinding = shortcutBindings[action];
              const defaultBinding = DEFAULT_SHORTCUT_BINDINGS[action];
              const isCustomBinding = !areShortcutBindingsEqual(currentBinding, defaultBinding);
              const isRecording = recordingAction === action;
              const isPending = pendingAction === action;
              const errorMessage = actionError?.action === action ? actionError.message : null;

              return (
                <li key={action} className="shortcut-item">
                  <div className="shortcut-item__header">
                    <div>
                      <strong>{definition.label}:</strong>
                      <div className="shortcut-item__binding-row">
                        <span className={`shortcut-chip${isRecording ? ' shortcut-chip--recording' : ''}`}>
                          {isRecording ? 'Recording…' : formatShortcut(currentBinding)}
                        </span>
                        {isCustomBinding ? (
                          <span className="shortcut-item__default">
                            Default {formatShortcut(defaultBinding, 'MacIntel')} / {formatShortcut(defaultBinding, 'Win32')}
                          </span>
                        ) : (
                          <span className="shortcut-item__default">Using the default shortcut.</span>
                        )}
                      </div>
                    </div>
                    <div className="shortcut-item__actions">
                      {isRecording ? (
                        <button type="button" className="ghost-button" onClick={stopRecording}>
                          Cancel
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={pendingAction !== null}
                          onClick={() => startRecording(action)}
                        >
                          Record shortcut
                        </button>
                      )}
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={!isCustomBinding || isPending}
                        onClick={() => resetShortcut(action)}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <span>{definition.description}</span>
                  {isRecording ? <span className="shortcut-item__hint">Press the exact key combination you want to use.</span> : null}
                  {errorMessage ? (
                    <span role="alert" className="shortcut-item__error">
                      {errorMessage}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </WorkspaceShell>
  );
}
