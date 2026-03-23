import {
  createLocalAdapterDatabaseOpener,
  LocalAdapter,
} from '@/shared/storage/LocalAdapter';
import {
  buildEllipseAnnotation,
  buildRectangleAnnotation,
  buildStickyNoteAnnotation,
  buildTextAnnotation,
} from '@/test/factories';

describe('LocalAdapter', () => {
  it('supports save, retrieve, delete, and list flows for v1 object annotations', async () => {
    const databaseName = `marginalia-test-${crypto.randomUUID()}`;
    const adapter = new LocalAdapter(createLocalAdapterDatabaseOpener(databaseName));
    const canonicalUrl = 'https://example.com/articles/1';
    const annotations = [
      buildRectangleAnnotation('annotation-rectangle'),
      buildEllipseAnnotation('annotation-ellipse'),
      buildTextAnnotation('annotation-text'),
      buildStickyNoteAnnotation('annotation-sticky-note'),
    ];

    for (const annotation of annotations) {
      await adapter.saveAnnotation(canonicalUrl, annotation);
    }

    await expect(adapter.getAnnotations(canonicalUrl)).resolves.toEqual(annotations);
    await expect(adapter.listAnnotatedUrls()).resolves.toEqual([
      expect.objectContaining({
        annotations,
        canonicalUrl,
      }),
    ]);

    await expect(adapter.deleteAnnotation(canonicalUrl, annotations[2]!.id)).resolves.toBe(true);
    await expect(adapter.getAnnotations(canonicalUrl)).resolves.toEqual([
      annotations[0],
      annotations[1],
      annotations[3],
    ]);
  });

  it('updates existing annotations by id', async () => {
    const databaseName = `marginalia-test-${crypto.randomUUID()}`;
    const adapter = new LocalAdapter(createLocalAdapterDatabaseOpener(databaseName));
    const canonicalUrl = 'https://example.com/articles/2';

    await adapter.saveAnnotation(canonicalUrl, buildTextAnnotation('annotation-2'));
    await adapter.saveAnnotation(canonicalUrl, {
      ...buildTextAnnotation('annotation-2'),
      updatedAt: '2025-01-02T00:00:00.000Z',
      content: {
        ...buildTextAnnotation('annotation-2').content,
        text: 'Updated text',
      },
    });

    const [annotation] = await adapter.getAnnotations(canonicalUrl);

    expect(annotation).toBeDefined();
    expect(annotation?.id).toBe('annotation-2');
    expect(annotation?.updatedAt).toBe('2025-01-02T00:00:00.000Z');
    expect(annotation?.type).toBe('text');
    expect(annotation?.content.kind).toBe('text');

    if (annotation?.content.kind !== 'text') {
      throw new Error('Expected a text annotation');
    }

    expect(annotation.content.text).toBe('Updated text');
  });

  it('hydrates legacy canvas metadata defaults when reading stored annotations', async () => {
    const databaseName = `marginalia-test-${crypto.randomUUID()}`;
    const adapter = new LocalAdapter(createLocalAdapterDatabaseOpener(databaseName));
    const canonicalUrl = 'https://example.com/articles/legacy';

    await adapter.saveAnnotation(canonicalUrl, {
      ...buildTextAnnotation('annotation-legacy'),
      content: {
        kind: 'text',
        x: 48,
        y: 64,
        width: 200,
        height: 48,
        color: 'blue',
        text: 'Legacy text',
      },
    } as ReturnType<typeof buildTextAnnotation>);

    const [annotation] = await adapter.getAnnotations(canonicalUrl);

    expect(annotation).toMatchObject({
      id: 'annotation-legacy',
      type: 'text',
      content: {
        kind: 'text',
        rotation: 0,
        borderVisible: false,
        text: 'Legacy text',
      },
    });
  });
});
