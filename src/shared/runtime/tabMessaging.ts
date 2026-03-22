import type { RuntimeMessage } from './messages';

const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const sendTabMessage = async <Response>(tabId: number, message: RuntimeMessage): Promise<Response> =>
  new Promise<Response>((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));

        return;
      }

      resolve(response as Response);
    });
  });

const getContentScriptFiles = (): string[] => {
  const files =
    chrome.runtime
      .getManifest()
      .content_scripts?.flatMap((contentScript) => contentScript.js ?? [])
      .filter((file): file is string => typeof file === 'string') ?? [];

  if (files.length === 0) {
    throw new Error('Marginalia could not find its content script bundle.');
  }

  return [...new Set(files)];
};

const injectContentScripts = async (tabId: number): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: getContentScriptFiles(),
      },
      () => {
        const error = chrome.runtime.lastError;

        if (error) {
          reject(new Error(error.message));

          return;
        }

        resolve();
      },
    );
  });

export const isMissingReceiverError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('Receiving end does not exist');

export const sendMessageToTab = async <Response>(tabId: number, message: RuntimeMessage): Promise<Response> => {
  try {
    return await sendTabMessage<Response>(tabId, message);
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    try {
      await injectContentScripts(tabId);
    } catch (injectionError) {
      throw new Error(describeError(injectionError));
    }

    return sendTabMessage<Response>(tabId, message);
  }
};
