import {
  createEmptyPageRecord,
  isCanvasAnnotation,
  isConnectorAnnotation,
  isRectangleAnnotation,
} from '@/shared/models/annotations';
import {
  buildConnectorAnnotation,
  buildEllipseAnnotation,
  buildPageRecord,
  buildRectangleAnnotation,
  buildStickyNoteAnnotation,
  buildTextAnnotation,
} from '@/test/factories';

describe('annotation models', () => {
  it('classifies the supported v1 annotation shapes with runtime guards', () => {
    const rectangleAnnotation = buildRectangleAnnotation();
    const ellipseAnnotation = buildEllipseAnnotation();
    const textAnnotation = buildTextAnnotation();
    const stickyNoteAnnotation = buildStickyNoteAnnotation();
    const connectorAnnotation = buildConnectorAnnotation();

    expect(isRectangleAnnotation(rectangleAnnotation)).toBe(true);
    expect(isCanvasAnnotation(rectangleAnnotation)).toBe(true);
    expect(isConnectorAnnotation(rectangleAnnotation)).toBe(false);

    expect(isRectangleAnnotation(ellipseAnnotation)).toBe(false);
    expect(isCanvasAnnotation(ellipseAnnotation)).toBe(true);
    expect(isConnectorAnnotation(ellipseAnnotation)).toBe(false);

    expect(isRectangleAnnotation(textAnnotation)).toBe(false);
    expect(isCanvasAnnotation(textAnnotation)).toBe(true);
    expect(isConnectorAnnotation(textAnnotation)).toBe(false);

    expect(isRectangleAnnotation(stickyNoteAnnotation)).toBe(false);
    expect(isCanvasAnnotation(stickyNoteAnnotation)).toBe(true);
    expect(isConnectorAnnotation(stickyNoteAnnotation)).toBe(false);

    expect(isRectangleAnnotation(connectorAnnotation)).toBe(false);
    expect(isCanvasAnnotation(connectorAnnotation)).toBe(false);
    expect(isConnectorAnnotation(connectorAnnotation)).toBe(true);
  });

  it('creates empty page records with annotation arrays', () => {
    const record = createEmptyPageRecord('https://example.com/page');

    expect(record.canonicalUrl).toBe('https://example.com/page');
    expect(record.pageTitle).toBe('');
    expect(record.tags).toEqual([]);
    expect(record.annotations).toEqual([]);
    expect(typeof record.lastVisited).toBe('string');
  });

  it('builds rich page record fixtures for content-layer tests', () => {
    const annotations = [
      buildRectangleAnnotation('annotation-rectangle'),
      buildTextAnnotation('annotation-text'),
      buildConnectorAnnotation('annotation-connector', {
        content: {
          sourceId: 'annotation-rectangle',
          targetId: 'annotation-text',
        },
      }),
    ];

    const record = buildPageRecord('https://example.com/annotated', {
      pageTitle: 'Annotated example',
      tags: ['research', 'draft'],
      annotations,
    });

    expect(record).toEqual({
      canonicalUrl: 'https://example.com/annotated',
      pageTitle: 'Annotated example',
      lastVisited: '2025-01-01T00:00:00.000Z',
      tags: ['research', 'draft'],
      annotations,
    });
  });
});
