import { useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_SHORTCUT_BINDINGS,
  ensureShortcutBindings,
  formatShortcut,
  SHORTCUT_ACTIONS,
  SHORTCUT_DEFINITIONS,
  subscribeToShortcutBindings,
  type ShortcutBindings,
  type ShortcutSection,
} from '@/shared/runtime/shortcuts';
import { WorkspaceShell } from '@/shared/ui/WorkspaceShell';

const SHORTCUT_SECTIONS: ShortcutSection[] = ['General', 'Tools', 'Editing'];

const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function App() {
  const [shortcutBindings, setShortcutBindings] = useState<ShortcutBindings>(DEFAULT_SHORTCUT_BINDINGS);
  const [statusMessage, setStatusMessage] = useState('Loading saved shortcut bindings…');

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

  const groupedShortcuts = useMemo(
    () =>
      SHORTCUT_SECTIONS.map((section) => ({
        actionIds: SHORTCUT_ACTIONS.filter((action) => SHORTCUT_DEFINITIONS[action].section === section),
        section,
      })),
    [],
  );

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

              return (
                <li key={action}>
                  <strong>{definition.label}:</strong> {formatShortcut(currentBinding)}
                  {currentBinding.code !== defaultBinding.code ||
                  currentBinding.altKey !== defaultBinding.altKey ||
                  currentBinding.shiftKey !== defaultBinding.shiftKey ||
                  currentBinding.primaryModifier !== defaultBinding.primaryModifier ? (
                    <> (default {formatShortcut(defaultBinding, 'MacIntel')} / {formatShortcut(defaultBinding, 'Win32')})</>
                  ) : null}
                  <br />
                  <span>{definition.description}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </WorkspaceShell>
  );
}
