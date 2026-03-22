import { render, screen, waitFor } from '@testing-library/react';

import { App } from './App';

describe('Options App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders grouped shortcut definitions from synced bindings', async () => {
    const storageState = {
      'marginalia.shortcuts': {
        toggleAnnotationMode: {
          code: 'KeyM',
          altKey: false,
          shiftKey: true,
          primaryModifier: true,
        },
      },
    };
    const addListener = vi.fn();
    const removeListener = vi.fn();

    vi.stubGlobal('chrome', {
      runtime: {
        lastError: undefined,
      },
      storage: {
        sync: {
          get: vi.fn((key: string, callback: (items: Record<string, unknown>) => void) => {
            callback({ [key]: storageState[key as keyof typeof storageState] });
          }),
          set: vi.fn((items: Record<string, unknown>, callback: () => void) => {
            Object.assign(storageState, items);
            callback();
          }),
          onChanged: {
            addListener,
            removeListener,
          },
        },
      },
    });

    const { unmount } = render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/shortcut bindings update automatically/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 2, name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Editing' })).toBeInTheDocument();
    expect(screen.getByText('Toggle annotation mode:', { selector: 'strong' }).closest('li')).toHaveTextContent(
      'Toggle annotation mode: Ctrl+Shift+M',
    );
    expect(screen.getByText('Select tool:', { selector: 'strong' }).closest('li')).toHaveTextContent('Select tool: V');
    expect(screen.getByText('Undo:', { selector: 'strong' }).closest('li')).toHaveTextContent('Undo: Ctrl+Z');
    expect(addListener).toHaveBeenCalledTimes(1);
    expect(removeListener).not.toHaveBeenCalled();

    unmount();
  });
});
