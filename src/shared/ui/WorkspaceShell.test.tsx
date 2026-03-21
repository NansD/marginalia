import { render, screen } from '@testing-library/react';

import { WorkspaceShell } from '@/shared/ui/WorkspaceShell';

describe('WorkspaceShell', () => {
  it('renders dashboard scaffold copy', () => {
    render(<WorkspaceShell surface="dashboard" />);

    expect(
      screen.getByRole('heading', { name: 'Annotation library scaffold' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/browse, search, and manage annotations from this extension page/i),
    ).toBeInTheDocument();
  });
});
