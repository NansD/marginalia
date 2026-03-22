import { fireEvent, screen } from '@testing-library/react';

import type { Annotation } from '@/shared/models/annotations';

import {
  createOverlayController,
  OVERLAY_ELEMENT_ID,
  OVERLAY_TOOLBAR_ID,
} from './overlayController';

const buildAnnotation = (id: string): Annotation => ({
  id,
  type: 'rectangle',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  content: {
    kind: 'rectangle',
    x: 16,
    y: 24,
    width: 160,
    height: 72,
  },
});

describe('createOverlayController', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does not mount the overlay while inert and empty', () => {
    const controller = createOverlayController(document, window);

    controller.syncToDocument();

    expect(document.getElementById(OVERLAY_ELEMENT_ID)).not.toBeInTheDocument();
    expect(document.getElementById(OVERLAY_TOOLBAR_ID)).not.toBeInTheDocument();
  });

  it('renders stored annotations without enabling interaction', () => {
    const controller = createOverlayController(document, window);

    controller.setAnnotations([buildAnnotation('annotation-1')]);

    const overlayElement = document.getElementById(OVERLAY_ELEMENT_ID);

    expect(overlayElement).toBeInTheDocument();
    expect(overlayElement?.querySelector('[data-marginalia-annotation-id="annotation-1"]')).toBeInTheDocument();
    expect(overlayElement).toHaveAttribute('data-mode', 'inert');
  });

  it('shows a toolbar in interactive mode and lets the user leave the mode', () => {
    const onRequestDisable = vi.fn();
    const controller = createOverlayController(document, window, { onRequestDisable });

    controller.setInteractive(true);

    expect(screen.getByText('Marginalia annotation mode')).toBeInTheDocument();
    expect(screen.getByText('Drag anywhere on the page to draw a rectangle annotation.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onRequestDisable).toHaveBeenCalledTimes(1);
  });
});
