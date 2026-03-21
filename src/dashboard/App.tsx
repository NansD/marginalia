import { WorkspaceShell } from '@/shared/ui/WorkspaceShell';

export function App() {
  return (
    <WorkspaceShell surface="dashboard">
      <section className="panel__grid" aria-label="Scaffold highlights">
        <article className="card">
          <h2>Storage adapter</h2>
          <p>Reserved for the local-first annotation index and sync-ready abstractions.</p>
        </article>
        <article className="card">
          <h2>Search & filters</h2>
          <p>Future dashboard work can plug search controls into this dedicated extension page.</p>
        </article>
      </section>
    </WorkspaceShell>
  );
}
