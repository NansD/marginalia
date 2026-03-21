import type { Annotation } from '@/shared/models/annotations';
import {
  createLocalAdapterDatabaseOpener,
  LocalAdapter,
} from '@/shared/storage/LocalAdapter';

const buildAnnotation = (id: string): Annotation => ({
  id,
  type: 'placeholder',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  content: {
    kind: 'placeholder',
  },
});

describe('LocalAdapter', () => {
  it('supports save, retrieve, delete, and list flows', async () => {
    const databaseName = `marginalia-test-${crypto.randomUUID()}`;
    const adapter = new LocalAdapter(createLocalAdapterDatabaseOpener(databaseName));
    const canonicalUrl = 'https://example.com/articles/1';
    const annotation = buildAnnotation('annotation-1');

    await adapter.saveAnnotation(canonicalUrl, annotation);

    await expect(adapter.getAnnotations(canonicalUrl)).resolves.toEqual([annotation]);
    await expect(adapter.listAnnotatedUrls()).resolves.toEqual([
      expect.objectContaining({
        annotations: [annotation],
        canonicalUrl,
      }),
    ]);

    await expect(adapter.deleteAnnotation(canonicalUrl, annotation.id)).resolves.toBe(true);
    await expect(adapter.getAnnotations(canonicalUrl)).resolves.toEqual([]);
    await expect(adapter.listAnnotatedUrls()).resolves.toEqual([]);
  });

  it('updates existing annotations by id', async () => {
    const databaseName = `marginalia-test-${crypto.randomUUID()}`;
    const adapter = new LocalAdapter(createLocalAdapterDatabaseOpener(databaseName));
    const canonicalUrl = 'https://example.com/articles/2';

    await adapter.saveAnnotation(canonicalUrl, buildAnnotation('annotation-2'));
    await adapter.saveAnnotation(canonicalUrl, {
      ...buildAnnotation('annotation-2'),
      updatedAt: '2025-01-02T00:00:00.000Z',
    });

    await expect(adapter.getAnnotations(canonicalUrl)).resolves.toEqual([
      expect.objectContaining({
        id: 'annotation-2',
        updatedAt: '2025-01-02T00:00:00.000Z',
      }),
    ]);
  });
});
