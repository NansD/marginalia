import {
  ANNOTATION_COMMANDS,
  ANNOTATION_TOOL_METADATA,
  ANNOTATION_TOOLS,
  isRuntimeMessage,
} from '@/shared/runtime/messages';

describe('isRuntimeMessage', () => {
  it.each(ANNOTATION_TOOLS)('accepts tool selection messages for %s', (tool) => {
    expect(isRuntimeMessage({ kind: 'select-annotation-tool', tool })).toBe(true);
  });

  it.each(ANNOTATION_COMMANDS)('accepts annotation command messages for %s', (command) => {
    expect(isRuntimeMessage({ kind: 'run-annotation-command', command })).toBe(true);
  });

  it('defines shared metadata for every annotation tool', () => {
    expect(Object.keys(ANNOTATION_TOOL_METADATA).sort()).toEqual([...ANNOTATION_TOOLS].sort());
  });

  it('accepts page state and annotation mode messages', () => {
    expect(isRuntimeMessage({ kind: 'toggle-annotation-mode' })).toBe(true);
    expect(isRuntimeMessage({ kind: 'set-annotation-mode', enabled: true })).toBe(true);
    expect(isRuntimeMessage({ kind: 'request-page-state' })).toBe(true);
    expect(
      isRuntimeMessage({
        kind: 'page-state-changed',
        canonicalUrl: 'https://example.com/article',
        pageTitle: 'Article',
        annotationModeEnabled: false,
      }),
    ).toBe(true);
    expect(isRuntimeMessage({ kind: 'annotations-changed', canonicalUrl: 'https://example.com/article' })).toBe(
      true,
    );
  });

  it('rejects objects without a known runtime message kind', () => {
    expect(isRuntimeMessage({ kind: 'made-up-message' })).toBe(false);
    expect(isRuntimeMessage({})).toBe(false);
    expect(isRuntimeMessage(null)).toBe(false);
  });
});
