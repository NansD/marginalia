import {
  TOOLBAR_TOOL_ORDER,
  createToolbarIcon,
  getToolbarStatusMessage,
  getToolbarToolShortcutLabel,
} from './toolbarPresentation';

describe('toolbarPresentation', () => {
  it('includes the full tool order, including circle', () => {
    expect(TOOLBAR_TOOL_ORDER).toEqual(['select', 'text', 'sticky-note', 'rectangle', 'ellipse', 'circle', 'connector']);
  });

  it('formats tool shortcuts from the shared shortcut bindings', () => {
    expect(getToolbarToolShortcutLabel('rectangle', undefined, 'Win32')).toBe('R');
    expect(getToolbarToolShortcutLabel('circle', undefined, 'Win32')).toBe('Shift+O');
    expect(getToolbarToolShortcutLabel('circle', undefined, 'MacIntel')).toBe('⇧O');
  });

  it('builds status messages for connector authoring and selection states', () => {
    expect(
      getToolbarStatusMessage({
        activeTool: 'connector',
        annotationsCount: 2,
        pendingConnectorSourceType: 'rectangle',
      }),
    ).toBe('Connector tool active. Source Rectangle annotation selected. Click another annotation to finish.');

    expect(
      getToolbarStatusMessage({
        activeTool: 'circle',
        annotationsCount: 3,
        selectedAnnotationType: 'ellipse',
      }),
    ).toBe('Circle tool active. Selected Ellipse annotation.');
  });

  it('creates dependency-free inline svg icons', () => {
    const icon = createToolbarIcon(document, 'circle');
    document.body.append(icon);

    expect(icon.tagName.toLowerCase()).toBe('svg');
    expect(icon.querySelector('circle')).toBeInTheDocument();
  });
});
