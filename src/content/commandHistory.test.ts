import { CommandHistory } from './commandHistory';

describe('CommandHistory', () => {
  it('tracks execute, undo, and redo lifecycle with explicit redo handlers', async () => {
    const history = new CommandHistory();
    const events: string[] = [];
    const command = {
      execute: vi.fn(() => {
        events.push('execute');
      }),
      undo: vi.fn(() => {
        events.push('undo');
      }),
      redo: vi.fn(() => {
        events.push('redo');
      }),
    };

    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);

    await history.execute(command);

    expect(events).toEqual(['execute']);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);

    await expect(history.undo()).resolves.toBe(true);
    expect(events).toEqual(['execute', 'undo']);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);

    await expect(history.redo()).resolves.toBe(true);
    expect(events).toEqual(['execute', 'undo', 'redo']);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it('falls back to execute when a command has no redo handler', async () => {
    const history = new CommandHistory();
    const command = {
      execute: vi.fn(),
      undo: vi.fn(),
    };

    await history.execute(command);
    await history.undo();
    await expect(history.redo()).resolves.toBe(true);

    expect(command.execute).toHaveBeenCalledTimes(2);
    expect(command.undo).toHaveBeenCalledTimes(1);
  });

  it('clears undo and redo state when requested', async () => {
    const history = new CommandHistory();
    const firstCommand = {
      execute: vi.fn(),
      undo: vi.fn(),
    };
    const secondCommand = {
      execute: vi.fn(),
      undo: vi.fn(),
    };

    await history.execute(firstCommand);
    await history.undo();
    expect(history.canRedo).toBe(true);

    await history.execute(secondCommand);
    expect(history.canRedo).toBe(false);
    expect(history.canUndo).toBe(true);

    history.clear();

    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    await expect(history.undo()).resolves.toBe(false);
    await expect(history.redo()).resolves.toBe(false);
  });

  it('caps undo history at 100 commands', async () => {
    const history = new CommandHistory();

    for (let index = 0; index < 101; index += 1) {
      await history.execute({
        execute: vi.fn(),
        undo: vi.fn(),
      });
    }

    let undoCount = 0;

    while (await history.undo()) {
      undoCount += 1;
    }

    expect(undoCount).toBe(100);
  });
});
