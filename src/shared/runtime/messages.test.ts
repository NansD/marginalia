import { isRuntimeMessage } from '@/shared/runtime/messages';

describe('isRuntimeMessage', () => {
  it('accepts new tool and command messages', () => {
    expect(isRuntimeMessage({ kind: 'select-annotation-tool', tool: 'ellipse' })).toBe(true);
    expect(isRuntimeMessage({ kind: 'run-annotation-command', command: 'undo' })).toBe(true);
  });

  it('rejects objects without a known runtime message kind', () => {
    expect(isRuntimeMessage({ kind: 'made-up-message' })).toBe(false);
    expect(isRuntimeMessage({})).toBe(false);
    expect(isRuntimeMessage(null)).toBe(false);
  });
});
