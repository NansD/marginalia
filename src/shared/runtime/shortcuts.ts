export type ShortcutAction = 'toggleAnnotationMode';

export interface ShortcutBinding {
  code: string;
  altKey: boolean;
  shiftKey: boolean;
  primaryModifier: boolean;
}

export type ShortcutBindings = Record<ShortcutAction, ShortcutBinding>;

export const SHORTCUT_STORAGE_KEY = 'marginalia.shortcuts';

export const DEFAULT_SHORTCUT_BINDINGS: ShortcutBindings = {
  toggleAnnotationMode: {
    code: 'KeyY',
    altKey: false,
    shiftKey: true,
    primaryModifier: true,
  },
};

const isApplePlatform = (platform: string): boolean => /Mac|iPhone|iPad|iPod/i.test(platform);

const getPlatform = (): string =>
  typeof navigator === 'undefined'
    ? ''
    : (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
      navigator.platform ??
      navigator.userAgent;

const normalizeBinding = (binding: ShortcutBinding): ShortcutBinding => ({
  code: binding.code,
  altKey: binding.altKey,
  shiftKey: binding.shiftKey,
  primaryModifier: binding.primaryModifier,
});

const normalizeBindings = (bindings?: Partial<ShortcutBindings>): ShortcutBindings => ({
  toggleAnnotationMode: normalizeBinding(bindings?.toggleAnnotationMode ?? DEFAULT_SHORTCUT_BINDINGS.toggleAnnotationMode),
});

const storageGet = async <T>(key: string): Promise<T | undefined> =>
  new Promise<T | undefined>((resolve, reject) => {
    chrome.storage.sync.get(key, (items) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));

        return;
      }

      resolve(items[key] as T | undefined);
    });
  });

const storageSet = async (items: Record<string, unknown>): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    chrome.storage.sync.set(items, () => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));

        return;
      }

      resolve();
    });
  });

export const ensureShortcutBindings = async (): Promise<ShortcutBindings> => {
  const storedBindings = await storageGet<Partial<ShortcutBindings>>(SHORTCUT_STORAGE_KEY);
  const nextBindings = normalizeBindings(storedBindings);

  if (!storedBindings || JSON.stringify(storedBindings) !== JSON.stringify(nextBindings)) {
    await storageSet({ [SHORTCUT_STORAGE_KEY]: nextBindings });
  }

  return nextBindings;
};

export const subscribeToShortcutBindings = (listener: (bindings: ShortcutBindings) => void): (() => void) => {
  const handleChange = ((
    changes: Record<string, chrome.storage.StorageChange>,
    areaName?: string,
  ): void => {
    const storageChange = changes[SHORTCUT_STORAGE_KEY];

    if ((areaName !== undefined && areaName !== 'sync') || !storageChange) {
      return;
    }

    listener(normalizeBindings(storageChange.newValue as Partial<ShortcutBindings> | undefined));
  }) as unknown as Parameters<typeof chrome.storage.sync.onChanged.addListener>[0];

  chrome.storage.sync.onChanged.addListener(handleChange);

  return () => {
    chrome.storage.sync.onChanged.removeListener(handleChange);
  };
};

export const matchesShortcut = (
  binding: ShortcutBinding,
  event: Pick<KeyboardEvent, 'altKey' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
  platform = getPlatform(),
): boolean => {
  const expectsMeta = binding.primaryModifier && isApplePlatform(platform);
  const expectsCtrl = binding.primaryModifier && !isApplePlatform(platform);

  return (
    event.code === binding.code &&
    event.altKey === binding.altKey &&
    event.shiftKey === binding.shiftKey &&
    event.metaKey === expectsMeta &&
    event.ctrlKey === expectsCtrl
  );
};

export const formatShortcut = (binding: ShortcutBinding, platform = getPlatform()): string => {
  const parts: string[] = [];

  if (binding.primaryModifier) {
    parts.push(isApplePlatform(platform) ? '⌘' : 'Ctrl');
  }

  if (binding.altKey) {
    parts.push(isApplePlatform(platform) ? '⌥' : 'Alt');
  }

  if (binding.shiftKey) {
    parts.push(isApplePlatform(platform) ? '⇧' : 'Shift');
  }

  parts.push(binding.code.replace(/^Key/, '').replace(/^Digit/, ''));

  return parts.join(isApplePlatform(platform) ? '' : '+');
};
