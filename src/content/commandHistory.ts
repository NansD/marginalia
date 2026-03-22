export interface HistoryCommand {
  execute(): Promise<void> | void;
  undo(): Promise<void> | void;
  redo?(): Promise<void> | void;
}

export class CommandHistory {
  private static readonly MAX_HISTORY_SIZE = 100;
  private readonly undoStack: HistoryCommand[] = [];
  private readonly redoStack: HistoryCommand[] = [];

  public get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public async execute(command: HistoryCommand): Promise<void> {
    await command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > CommandHistory.MAX_HISTORY_SIZE) {
      this.undoStack.splice(0, this.undoStack.length - CommandHistory.MAX_HISTORY_SIZE);
    }
    this.redoStack.length = 0;
  }

  public async undo(): Promise<boolean> {
    const command = this.undoStack.pop();

    if (!command) {
      return false;
    }

    await command.undo();
    this.redoStack.push(command);

    return true;
  }

  public async redo(): Promise<boolean> {
    const command = this.redoStack.pop();

    if (!command) {
      return false;
    }

    if (command.redo) {
      await command.redo();
    } else {
      await command.execute();
    }

    this.undoStack.push(command);

    return true;
  }

  public clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
