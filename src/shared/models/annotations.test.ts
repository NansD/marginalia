import {
  createEmptyPageRecord,
  isCircleAnnotation,
  isCanvasAnnotation,
  isConnectorAnnotation,
  isRectangleAnnotation,
  normalizeAnnotation,
} from '@/shared/models/annotations';
import {
  buildCircleAnnotation,
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
    const circleAnnotation = buildCircleAnnotation();
    const textAnnotation = buildTextAnnotation();
    const stickyNoteAnnotation = buildStickyNoteAnnotation();
    const connectorAnnotation = buildConnectorAnnotation();

    expect(isRectangleAnnotation(rectangleAnnotation)).toBe(true);
    expect(isCanvasAnnotation(rectangleAnnotation)).toBe(true);
    expect(isConnectorAnnotation(rectangleAnnotation)).toBe(false);

    expect(isRectangleAnnotation(ellipseAnnotation)).toBe(false);
    expect(isCircleAnnotation(ellipseAnnotation)).toBe(false);
    expect(isCanvasAnnotation(ellipseAnnotation)).toBe(true);
    expect(isConnectorAnnotation(ellipseAnnotation)).toBe(false);

    expect(isRectangleAnnotation(circleAnnotation)).toBe(false);
    expect(isCircleAnnotation(circleAnnotation)).toBe(true);
    expect(isCanvasAnnotation(circleAnnotation)).toBe(true);
    expect(isConnectorAnnotation(circleAnnotation)).toBe(false);

    expect(isRectangleAnnotation(textAnnotation)).toBe(false);
    expect(isCircleAnnotation(textAnnotation)).toBe(false);
    expect(isCanvasAnnotation(textAnnotation)).toBe(true);
    expect(isConnectorAnnotation(textAnnotation)).toBe(false);

    expect(isRectangleAnnotation(stickyNoteAnnotation)).toBe(false);
    expect(isCircleAnnotation(stickyNoteAnnotation)).toBe(false);
    expect(isCanvasAnnotation(stickyNoteAnnotation)).toBe(true);
    expect(isConnectorAnnotation(stickyNoteAnnotation)).toBe(false);

    expect(isRectangleAnnotation(connectorAnnotation)).toBe(false);
    expect(isCircleAnnotation(connectorAnnotation)).toBe(false);
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

  it('normalizes shared canvas metadata for legacy annotations', () => {
    const legacyRectangle = {
      ...buildRectangleAnnotation(),
      content: {
        kind: 'rectangle' as const,
        x: 16,
        y: 24,
        width: 160,
        height: 72,
        text: '',
      },
    };
    const legacyText = {
      ...buildTextAnnotation(),
      content: {
        kind: 'text' as const,
        x: 48,
        y: 64,
        width: 200,
        height: 48,
        color: 'blue' as const,
        text: 'Test annotation',
      },
    };

    expect(normalizeAnnotation(legacyRectangle as Parameters<typeof normalizeAnnotation>[0])).toMatchObject({
      content: {
        kind: 'rectangle',
        rotation: 0,
      },
    });
    expect(normalizeAnnotation(legacyText as Parameters<typeof normalizeAnnotation>[0])).toMatchObject({
      content: {
        kind: 'text',
        rotation: 0,
        borderVisible: false,
      },
    });
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
