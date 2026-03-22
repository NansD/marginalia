import type { RuntimeMessage } from '@/shared/runtime/messages';

export const SHORTCUT_ACTIONS = [
  'toggleAnnotationMode',
  'selectTool',
  'textTool',
  'stickyNoteTool',
  'rectangleTool',
  'ellipseTool',
  'connectorTool',
  'cancelCurrentAction',
  'deleteSelectedAnnotation',
  'undo',
  'redo',
] as const;

export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];
export type ShortcutSection = 'General' | 'Tools' | 'Editing';

export interface ShortcutBinding {
  code: string;
  altKey: boolean;
  shiftKey: boolean;
  primaryModifier: boolean;
}

export interface ShortcutDefinition {
  label: string;
  description: string;
  section: ShortcutSection;
  defaultBinding: ShortcutBinding;
  runtimeMessage: RuntimeMessage;
  commandName?: string;
}

export type ShortcutBindings = Record<ShortcutAction, ShortcutBinding>;
export type ShortcutDefinitions = Record<ShortcutAction, ShortcutDefinition>;

export const SHORTCUT_STORAGE_KEY = 'marginalia.shortcuts';
const MODIFIER_KEY_CODES = new Set(['AltLeft', 'AltRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'ShiftLeft', 'ShiftRight']);

export const SHORTCUT_DEFINITIONS: ShortcutDefinitions = {
  toggleAnnotationMode: {
    label: 'Toggle annotation mode',
    description: 'Enable or disable the overlay on the active page.',
    section: 'General',
    defaultBinding: {
      code: 'KeyY',
      altKey: false,
      shiftKey: true,
      primaryModifier: true,
    },
    runtimeMessage: { kind: 'toggle-annotation-mode' },
    commandName: 'toggle-annotation-mode',
  },
  selectTool: {
    label: 'Select tool',
    description: 'Activate the select and move tool.',
    section: 'Tools',
    defaultBinding: {
      code: 'KeyV',
      altKey: false,
      shiftKey: false,
      primaryModifier: false,
    },
    runtimeMessage: { kind: 'select-annotation-tool', tool: 'select' },
  },
  textTool: {
    label: 'Text tool',
    description: 'Activate the free-floating text tool.',
    section: 'Tools',
    defaultBinding: {
      code: 'KeyT',
      altKey: false,
      shiftKey: false,
      primaryModifier: false,
    },
    runtimeMessage: { kind: 'select-annotation-tool', tool: 'text' },
  },
  stickyNoteTool: {
    label: 'Sticky note tool',
    description: 'Activate the sticky note placement tool.',
    section: 'Tools',
    defaultBinding: {
      code: 'KeyN',
      altKey: false,
      shiftKey: false,
      primaryModifier: false,
    },
    runtimeMessage: { kind: 'select-annotation-tool', tool: 'sticky-note' },
  },
  rectangleTool: {
    label: 'Rectangle tool',
    description: 'Activate the rectangle drawing tool.',
    section: 'Tools',
    defaultBinding: {
      code: 'KeyR',
      altKey: false,
      shiftKey: false,
      primaryModifier: false,
    },
    runtimeMessage: { kind: 'select-annotation-tool', tool: 'rectangle' },
  },
  ellipseTool: {
    label: 'Ellipse tool',
    description: 'Activate the ellipse drawing tool.',
    section: 'Tools',
    defaultBinding: {
      code: 'KeyO',
      altKey: false,
      shiftKey: false,
      primaryModifier: false,
    },
    runtimeMessage: { kind: 'select-annotation-tool', tool: 'ellipse' },
  },
  connectorTool: {
    label: 'Connector tool',
    description: 'Activate the connector drawing tool.',
    section: 'Tools',
    defaultBinding: {
      code: 'KeyC',
      altKey: false,
      shiftKey: false,
      primaryModifier: false,
    },
    runtimeMessage: { kind: 'select-annotation-tool', tool: 'connector' },
  },
  cancelCurrentAction: {
    label: 'Cancel or deselect',
    description: 'Exit the current interaction or clear selection.',
    section: 'Editing',
    defaultBinding: {
      code: 'Escape',
      altKey: false,
      shiftKey: false,
      primaryModifier: false,
    },
    runtimeMessage: { kind: 'run-annotation-command', command: 'cancel-current-action' },
  },
  deleteSelectedAnnotation: {
    label: 'Delete selected annotation',
    description: 'Remove the selected annotation from the current page.',
    section: 'Editing',
    defaultBinding: {
      code: 'Backspace',
      altKey: false,
      shiftKey: false,
      primaryModifier: false,
    },
    runtimeMessage: { kind: 'run-annotation-command', command: 'delete-selected-annotation' },
  },
  undo: {
    label: 'Undo',
    description: 'Revert the most recent annotation change.',
    section: 'Editing',
    defaultBinding: {
      code: 'KeyZ',
      altKey: false,
      shiftKey: false,
      primaryModifier: true,
    },
    runtimeMessage: { kind: 'run-annotation-command', command: 'undo' },
  },
  redo: {
    label: 'Redo',
    description: 'Reapply the most recently undone annotation change.',
    section: 'Editing',
    defaultBinding: {
      code: 'KeyZ',
      altKey: false,
      shiftKey: true,
      primaryModifier: true,
    },
    runtimeMessage: { kind: 'run-annotation-command', command: 'redo' },
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

const createShortcutBindings = (resolveBinding: (action: ShortcutAction) => ShortcutBinding): ShortcutBindings =>
  SHORTCUT_ACTIONS.reduce<ShortcutBindings>((bindings, action) => {
    bindings[action] = normalizeBinding(resolveBinding(action));

    return bindings;
  }, {} as ShortcutBindings);

export const DEFAULT_SHORTCUT_BINDINGS: ShortcutBindings = createShortcutBindings(
  (action) => SHORTCUT_DEFINITIONS[action].defaultBinding,
);

const normalizeBindings = (bindings?: Partial<ShortcutBindings>): ShortcutBindings =>
  createShortcutBindings((action) => bindings?.[action] ?? DEFAULT_SHORTCUT_BINDINGS[action]);

export const areShortcutBindingsEqual = (left: ShortcutBinding, right: ShortcutBinding): boolean =>
  left.code === right.code &&
  left.altKey === right.altKey &&
  left.shiftKey === right.shiftKey &&
  left.primaryModifier === right.primaryModifier;

export const shouldIgnoreKeyboardEventTarget = (event: Pick<KeyboardEvent, 'target'>): boolean => {
  const eventTarget = event.target;

  if (!(eventTarget instanceof HTMLElement)) {
    return false;
  }

  return (
    eventTarget.isContentEditable ||
    eventTarget instanceof HTMLInputElement ||
    eventTarget instanceof HTMLSelectElement ||
    eventTarget instanceof HTMLTextAreaElement
  );
};

export const readShortcutBindingFromKeyboardEvent = (
  event: Pick<KeyboardEvent, 'altKey' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
  platform = getPlatform(),
): ShortcutBinding | null => {
  if (!event.code || MODIFIER_KEY_CODES.has(event.code)) {
    return null;
  }

  return normalizeBinding({
    code: event.code,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    primaryModifier: isApplePlatform(platform) ? event.metaKey : event.ctrlKey,
  });
};

export const validateShortcutBinding = (
  bindings: ShortcutBindings,
  action: ShortcutAction,
  binding: ShortcutBinding,
  platform = getPlatform(),
): string | null => {
  const normalizedBinding = normalizeBinding(binding);

  if (!normalizedBinding.code || MODIFIER_KEY_CODES.has(normalizedBinding.code)) {
    return 'Shortcut needs a non-modifier key.';
  }

  const conflictingAction =
    SHORTCUT_ACTIONS.find(
      (candidateAction) =>
        candidateAction !== action && areShortcutBindingsEqual(bindings[candidateAction], normalizedBinding),
    ) ?? null;

  if (!conflictingAction) {
    return null;
  }

  return `${SHORTCUT_DEFINITIONS[conflictingAction].label} already uses ${formatShortcut(normalizedBinding, platform)}.`;
};

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

export const updateShortcutBinding = async (
  action: ShortcutAction,
  binding: ShortcutBinding,
): Promise<ShortcutBindings> => {
  const storedBindings = await storageGet<Partial<ShortcutBindings>>(SHORTCUT_STORAGE_KEY);
  const nextBinding = normalizeBinding(binding);
  const currentBindings = normalizeBindings(storedBindings);
  const validationError = validateShortcutBinding(currentBindings, action, nextBinding);

  if (validationError) {
    throw new Error(validationError);
  }

  const nextBindings = {
    ...currentBindings,
    [action]: nextBinding,
  };

  await storageSet({ [SHORTCUT_STORAGE_KEY]: nextBindings });

  return nextBindings;
};

export const subscribeToShortcutBindings = (listener: (bindings: ShortcutBindings) => void): (() => void) => {
  const storageChanged = chrome.storage.sync.onChanged;
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

  storageChanged.addListener(handleChange);

  return () => {
    storageChanged.removeListener(handleChange);
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

export const findMatchingShortcutAction = (
  bindings: ShortcutBindings,
  event: Pick<KeyboardEvent, 'altKey' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
  platform = getPlatform(),
): ShortcutAction | null =>
  SHORTCUT_ACTIONS.find((action) => matchesShortcut(bindings[action], event, platform)) ?? null;

export const getShortcutRuntimeMessage = (action: ShortcutAction): RuntimeMessage => {
  const runtimeMessage = SHORTCUT_DEFINITIONS[action].runtimeMessage;

  return { ...runtimeMessage };
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
