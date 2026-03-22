import { render, screen, waitFor } from '@testing-library/react';

import { App } from './App';

describe('Popup App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('toggles annotation mode for the active tab when opened', async () => {
    type ExecuteScriptOptions = Parameters<typeof chrome.scripting.executeScript>[0];
    const query = vi.fn((queryInfo: chrome.tabs.QueryInfo, callback: (tabs: chrome.tabs.Tab[]) => void) => {
      expect(queryInfo).toEqual({ active: true, lastFocusedWindow: true });
      callback([
        {
          active: true,
          highlighted: true,
          id: 7,
          incognito: false,
          index: 0,
          frozen: false,
          pinned: false,
          selected: true,
          title: 'Example',
          url: 'https://example.com',
          windowId: 1,
          discarded: false,
          autoDiscardable: true,
          groupId: -1,
        },
      ]);
    });
    const sendMessage = vi.fn(
      (tabId: number, message: unknown, callback: (response: { annotationModeEnabled: boolean; canonicalUrl: string }) => void) => {
        expect(tabId).toBe(7);
        expect(message).toEqual({ kind: 'toggle-annotation-mode' });
        callback({ annotationModeEnabled: true, canonicalUrl: 'https://example.com' });
      },
    );
    const executeScript = vi.fn((_options: ExecuteScriptOptions, callback: () => void) => {
      callback();
    });

    vi.stubGlobal('chrome', {
      runtime: {
        getManifest: () => ({
          content_scripts: [{ js: ['assets/content-loader.js'] }],
        }),
        lastError: undefined,
      },
      scripting: {
        executeScript,
      },
      tabs: {
        query,
        sendMessage,
      },
    });
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined);

    render(<App />);

    expect(screen.getByText(/toggling annotation mode/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/annotation mode is now enabled/i)).toBeInTheDocument();
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(executeScript).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('injects the content script and retries when the first message has no receiver', async () => {
    type ExecuteScriptOptions = Parameters<typeof chrome.scripting.executeScript>[0];
    const query = vi.fn((_: chrome.tabs.QueryInfo, callback: (tabs: chrome.tabs.Tab[]) => void) => {
      callback([{ id: 7 } as chrome.tabs.Tab]);
    });
    const executeScript = vi.fn((options: ExecuteScriptOptions, callback: () => void) => {
      expect(options).toEqual({
        files: ['assets/content-loader.js'],
        target: { tabId: 7 },
      });
      callback();
    });
    let sendAttempt = 0;
    const runtimeState = { lastError: undefined as chrome.runtime.LastError | undefined };
    const sendMessage = vi.fn(
      (tabId: number, message: unknown, callback: (response?: { annotationModeEnabled: boolean; canonicalUrl: string }) => void) => {
        sendAttempt += 1;
        expect(tabId).toBe(7);
        expect(message).toEqual({ kind: 'toggle-annotation-mode' });

        if (sendAttempt === 1) {
          runtimeState.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
          callback(undefined);
          runtimeState.lastError = undefined;

          return;
        }

        callback({ annotationModeEnabled: true, canonicalUrl: 'https://example.com' });
      },
    );

    vi.stubGlobal('chrome', {
      runtime: {
        getManifest: () => ({
          content_scripts: [{ js: ['assets/content-loader.js'] }],
        }),
        get lastError() {
          return runtimeState.lastError;
        },
      },
      scripting: {
        executeScript,
      },
      tabs: {
        query,
        sendMessage,
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/annotation mode is now enabled/i)).toBeInTheDocument();
    });

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(executeScript).toHaveBeenCalledTimes(1);
  });

  it('shows the injection error when the tab does not allow content scripts', async () => {
    type ExecuteScriptOptions = Parameters<typeof chrome.scripting.executeScript>[0];
    const query = vi.fn((_: chrome.tabs.QueryInfo, callback: (tabs: chrome.tabs.Tab[]) => void) => {
      callback([{ id: 7 } as chrome.tabs.Tab]);
    });
    const runtimeState = { lastError: undefined as chrome.runtime.LastError | undefined };
    const sendMessage = vi.fn((_: number, __: unknown, callback: (response?: unknown) => void) => {
      runtimeState.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
      callback(undefined);
      runtimeState.lastError = undefined;
    });
    const executeScript = vi.fn((_: ExecuteScriptOptions, callback: () => void) => {
      runtimeState.lastError = { message: 'Cannot access contents of the page. Extension manifest must request permission to access the respective host.' };
      callback();
      runtimeState.lastError = undefined;
    });

    vi.stubGlobal('chrome', {
      runtime: {
        getManifest: () => ({
          content_scripts: [{ js: ['assets/content-loader.js'] }],
        }),
        get lastError() {
          return runtimeState.lastError;
        },
      },
      scripting: {
        executeScript,
      },
      tabs: {
        query,
        sendMessage,
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/cannot access contents of the page/i)).toBeInTheDocument();
    });

    expect(executeScript).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
