import {
  ANNOTATION_COMMANDS,
  ANNOTATION_TOOLS,
  isRuntimeMessage,
} from '@/shared/runtime/messages';
import {
  DEFAULT_SHORTCUT_BINDINGS,
  findMatchingShortcutAction,
  formatShortcut,
  getShortcutRuntimeMessage,
  readShortcutBindingFromKeyboardEvent,
  SHORTCUT_DEFINITIONS,
  updateShortcutBinding,
  validateShortcutBinding,
} from '@/shared/runtime/shortcuts';

describe('shortcut bindings', () => {
  it('matches the default toggle binding on non-Apple platforms', () => {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyY',
      ctrlKey: true,
      shiftKey: true,
    });

    expect(findMatchingShortcutAction(DEFAULT_SHORTCUT_BINDINGS, event, 'Win32')).toBe('toggleAnnotationMode');
  });

  it('matches the default toggle binding on Apple platforms', () => {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyY',
      metaKey: true,
      shiftKey: true,
    });

    expect(findMatchingShortcutAction(DEFAULT_SHORTCUT_BINDINGS, event, 'MacIntel')).toBe('toggleAnnotationMode');
  });

  it('matches tool and command bindings without a primary modifier', () => {
    const selectEvent = new KeyboardEvent('keydown', {
      code: 'KeyV',
    });
    const escapeEvent = new KeyboardEvent('keydown', {
      code: 'Escape',
    });

    expect(findMatchingShortcutAction(DEFAULT_SHORTCUT_BINDINGS, selectEvent, 'Win32')).toBe('selectTool');
    expect(findMatchingShortcutAction(DEFAULT_SHORTCUT_BINDINGS, escapeEvent, 'Win32')).toBe('cancelCurrentAction');
  });

  it('formats shortcut labels per platform', () => {
    expect(formatShortcut(DEFAULT_SHORTCUT_BINDINGS.toggleAnnotationMode, 'Win32')).toBe('Ctrl+Shift+Y');
    expect(formatShortcut(DEFAULT_SHORTCUT_BINDINGS.toggleAnnotationMode, 'MacIntel')).toBe('⌘⇧Y');
    expect(formatShortcut(DEFAULT_SHORTCUT_BINDINGS.selectTool, 'Win32')).toBe('V');
    expect(formatShortcut(DEFAULT_SHORTCUT_BINDINGS.cancelCurrentAction, 'MacIntel')).toBe('Escape');
  });

  it('maps actions to typed runtime messages', () => {
    expect(getShortcutRuntimeMessage('rectangleTool')).toEqual({
      kind: 'select-annotation-tool',
      tool: 'rectangle',
    });
    expect(getShortcutRuntimeMessage('undo')).toEqual({
      kind: 'run-annotation-command',
      command: 'undo',
    });
  });

  it('declares defaults for each exposed shortcut action', () => {
    expect(Object.keys(DEFAULT_SHORTCUT_BINDINGS).sort()).toEqual(Object.keys(SHORTCUT_DEFINITIONS).sort());
  });

  it('covers every supported tool and command with shortcut runtime messages', () => {
    const runtimeMessages = Object.values(SHORTCUT_DEFINITIONS).map((definition) => definition.runtimeMessage);
    const toolMessages = runtimeMessages.filter((message) => message.kind === 'select-annotation-tool');
    const commandMessages = runtimeMessages.filter((message) => message.kind === 'run-annotation-command');

    expect(toolMessages.map((message) => message.tool).sort()).toEqual([...ANNOTATION_TOOLS].sort());
    expect(commandMessages.map((message) => message.command).sort()).toEqual([...ANNOTATION_COMMANDS].sort());
  });

  it('emits runtime messages that satisfy the shared runtime guard', () => {
    for (const action of Object.keys(SHORTCUT_DEFINITIONS) as Array<keyof typeof SHORTCUT_DEFINITIONS>) {
      expect(isRuntimeMessage(getShortcutRuntimeMessage(action))).toBe(true);
    }
  });

  it('reads shortcut bindings from keyboard events', () => {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyK',
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });

    expect(readShortcutBindingFromKeyboardEvent(event, 'Win32')).toEqual({
      code: 'KeyK',
      altKey: true,
      shiftKey: true,
      primaryModifier: true,
    });
  });

  it('ignores modifier-only keyboard events while recording', () => {
    const event = new KeyboardEvent('keydown', {
      code: 'ShiftLeft',
      shiftKey: true,
    });

    expect(readShortcutBindingFromKeyboardEvent(event, 'Win32')).toBeNull();
  });

  it('rejects duplicate shortcut bindings', () => {
    expect(
      validateShortcutBinding(DEFAULT_SHORTCUT_BINDINGS, 'textTool', {
        code: 'KeyV',
        altKey: false,
        shiftKey: false,
        primaryModifier: false,
      }),
    ).toBe('Select tool already uses V.');
  });

  it('persists an updated shortcut binding to synced storage', async () => {
    const storageState: Record<string, unknown> = {};

    vi.stubGlobal('chrome', {
      runtime: {
        lastError: undefined,
      },
      storage: {
        sync: {
          get: vi.fn((key: string, callback: (items: Record<string, unknown>) => void) => {
            callback({ [key]: storageState[key] });
          }),
          set: vi.fn((items: Record<string, unknown>, callback: () => void) => {
            Object.assign(storageState, items);
            callback();
          }),
          onChanged: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
          },
        },
      },
    });

    const nextBindings = await updateShortcutBinding('selectTool', {
      code: 'KeyS',
      altKey: false,
      shiftKey: false,
      primaryModifier: true,
    });

    expect(nextBindings.selectTool).toEqual({
      code: 'KeyS',
      altKey: false,
      shiftKey: false,
      primaryModifier: true,
    });
    expect(storageState['marginalia.shortcuts']).toEqual(nextBindings);
  });
});
