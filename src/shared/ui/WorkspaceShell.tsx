import type { PropsWithChildren } from 'react';

import { getSurfaceConfig, type ExtensionSurface } from '@/shared/config/surfaces';

export interface WorkspaceShellProps extends PropsWithChildren {
  surface: ExtensionSurface;
}

export function WorkspaceShell({ children, surface }: WorkspaceShellProps) {
  const config = getSurfaceConfig(surface);

  return (
    <main className="shell">
      <section className="panel">
        <span className="panel__eyebrow">Marginalia workspace</span>
        <h1>{config.title}</h1>
        <p className="panel__description">{config.description}</p>
        <ul className="panel__list">
          {config.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        {children ?? <p className="panel__note">Phase-specific UI will land in a follow-up todo.</p>}
      </section>
    </main>
  );
}
