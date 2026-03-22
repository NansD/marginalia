import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { App } from './App';

describe('Options App', () => {
  const setupChrome = () => {
    const storageState: Record<string, unknown> = {
      'marginalia.shortcuts': {
        toggleAnnotationMode: {
          code: 'KeyM',
          altKey: false,
          shiftKey: true,
          primaryModifier: true,
        },
      },
    };
    const changeListeners: Array<
      (changes: Record<string, chrome.storage.StorageChange>, areaName?: string) => void
    > = [];
    const addListener = vi.fn((listener: (changes: Record<string, chrome.storage.StorageChange>, areaName?: string) => void) => {
      changeListeners.push(listener);
    });
    const removeListener = vi.fn((listener: (changes: Record<string, chrome.storage.StorageChange>, areaName?: string) => void) => {
      const listenerIndex = changeListeners.indexOf(listener);

      if (listenerIndex >= 0) {
        changeListeners.splice(listenerIndex, 1);
      }
    });
    const get = vi.fn((key: string, callback: (items: Record<string, unknown>) => void) => {
      callback({ [key]: storageState[key] });
    });
    const set = vi.fn((items: Record<string, unknown>, callback: () => void) => {
      const previousState = { ...storageState };

      Object.assign(storageState, items);
      callback();

      for (const listener of changeListeners) {
        listener(
          Object.fromEntries(
            Object.entries(items).map(([key, newValue]) => [
              key,
              {
                oldValue: previousState[key],
                newValue,
              },
            ]),
          ) as Record<string, chrome.storage.StorageChange>,
          'sync',
        );
      }
    });

    vi.stubGlobal('chrome', {
      runtime: {
        lastError: undefined,
      },
      storage: {
        sync: {
          get,
          set,
          onChanged: {
            addListener,
            removeListener,
          },
        },
      },
    });

    return { addListener, removeListener, set, storageState };
  };

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders grouped shortcut definitions from synced bindings', async () => {
    const { addListener, removeListener } = setupChrome();

    const { unmount } = render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/shortcut bindings update automatically/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 2, name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Editing' })).toBeInTheDocument();
    expect(screen.getByText('Toggle annotation mode:', { selector: 'strong' }).closest('li')).toHaveTextContent(
      /Toggle annotation mode:\s*Ctrl\+Shift\+M/,
    );
    expect(screen.getByText('Select tool:', { selector: 'strong' }).closest('li')).toHaveTextContent(/Select tool:\s*V/);
    expect(screen.getByText('Undo:', { selector: 'strong' }).closest('li')).toHaveTextContent(/Undo:\s*Ctrl\+Z/);
    expect(addListener).toHaveBeenCalledTimes(1);
    expect(removeListener).not.toHaveBeenCalled();

    unmount();
  });

  it('records a shortcut, persists it, and lets the user reset back to default', async () => {
    const { storageState } = setupChrome();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/shortcut bindings update automatically/i)).toBeInTheDocument();
    });

    const selectToolItem = screen.getByText('Select tool:', { selector: 'strong' }).closest('li');

    expect(selectToolItem).not.toBeNull();

    fireEvent.click(within(selectToolItem as HTMLElement).getByRole('button', { name: 'Record shortcut' }));
    fireEvent.keyDown(window, { code: 'KeyS', ctrlKey: true });

    await waitFor(() => {
      expect(storageState['marginalia.shortcuts']).toMatchObject({
        selectTool: {
          code: 'KeyS',
          altKey: false,
          shiftKey: false,
          primaryModifier: true,
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Select tool:', { selector: 'strong' }).closest('li')).toHaveTextContent(/Select tool:\s*Ctrl\+S/);
    });

    fireEvent.click(within(selectToolItem as HTMLElement).getByRole('button', { name: 'Reset' }));

    await waitFor(() => {
      expect(screen.getByText('Select tool:', { selector: 'strong' }).closest('li')).toHaveTextContent(/Select tool:\s*V/);
    });
  });

  it('shows a validation error when a shortcut conflicts with an existing binding', async () => {
    const { set } = setupChrome();

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/shortcut bindings update automatically/i)).toBeInTheDocument();
    });

    const textToolItem = screen.getByText('Text tool:', { selector: 'strong' }).closest('li');

    expect(textToolItem).not.toBeNull();

    fireEvent.click(within(textToolItem as HTMLElement).getByRole('button', { name: 'Record shortcut' }));
    fireEvent.keyDown(window, { code: 'KeyV' });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Select tool already uses V.');
    });

    expect(set).toHaveBeenCalledTimes(1);
  });
});
