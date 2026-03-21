import { WorkspaceShell } from '@/shared/ui/WorkspaceShell';
import { DEFAULT_SHORTCUT_BINDINGS, formatShortcut } from '@/shared/runtime/shortcuts';

export function App() {
  return (
    <WorkspaceShell surface="options">
      <p className="panel__note">
        Annotation mode shortcut default:{' '}
        <strong>{formatShortcut(DEFAULT_SHORTCUT_BINDINGS.toggleAnnotationMode, 'MacIntel')}</strong> /{' '}
        <strong>{formatShortcut(DEFAULT_SHORTCUT_BINDINGS.toggleAnnotationMode, 'Win32')}</strong>
      </p>
    </WorkspaceShell>
  );
}
