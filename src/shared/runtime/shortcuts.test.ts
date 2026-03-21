import { DEFAULT_SHORTCUT_BINDINGS, formatShortcut, matchesShortcut } from '@/shared/runtime/shortcuts';

describe('matchesShortcut', () => {
  it('matches the default binding on non-Apple platforms', () => {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyY',
      ctrlKey: true,
      shiftKey: true,
    });

    expect(matchesShortcut(DEFAULT_SHORTCUT_BINDINGS.toggleAnnotationMode, event, 'Win32')).toBe(true);
  });

  it('matches the default binding on Apple platforms', () => {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyY',
      metaKey: true,
      shiftKey: true,
    });

    expect(matchesShortcut(DEFAULT_SHORTCUT_BINDINGS.toggleAnnotationMode, event, 'MacIntel')).toBe(true);
  });

  it('formats shortcut labels per platform', () => {
    expect(formatShortcut(DEFAULT_SHORTCUT_BINDINGS.toggleAnnotationMode, 'Win32')).toBe('Ctrl+Shift+Y');
    expect(formatShortcut(DEFAULT_SHORTCUT_BINDINGS.toggleAnnotationMode, 'MacIntel')).toBe('⌘⇧Y');
  });
});
