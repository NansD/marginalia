import {
  createEmptyPageRecord,
  isCanvasAnnotation,
  isConnectorAnnotation,
  isRectangleAnnotation,
  type Annotation,
} from '@/shared/models/annotations';

const rectangleAnnotation: Annotation = {
  id: 'annotation-rectangle',
  type: 'rectangle',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  content: {
    kind: 'rectangle',
    x: 16,
    y: 24,
    width: 120,
    height: 80,
  },
};

const connectorAnnotation: Annotation = {
  id: 'annotation-connector',
  type: 'connector',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  content: {
    kind: 'connector',
    sourceId: 'annotation-rectangle',
    sourceAnchor: 'right',
    targetId: 'annotation-text',
    targetAnchor: 'left',
    color: 'blue',
    label: 'relates to',
  },
};

describe('annotation models', () => {
  it('narrows structured annotation unions with runtime guards', () => {
    expect(isRectangleAnnotation(rectangleAnnotation)).toBe(true);
    expect(isCanvasAnnotation(rectangleAnnotation)).toBe(true);
    expect(isConnectorAnnotation(rectangleAnnotation)).toBe(false);

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
});
