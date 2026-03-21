import { WorkspaceShell } from '@/shared/ui/WorkspaceShell';

export function App() {
  return (
    <WorkspaceShell surface="popup">
      <p className="panel__note">Use the toolbar icon or shortcut to toggle annotation mode on the active tab.</p>
    </WorkspaceShell>
  );
}
