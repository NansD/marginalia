import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { Annotation, PageRecord } from '@/shared/models/annotations';
import { createEmptyPageRecord } from '@/shared/models/annotations';
import type { StorageAdapter } from '@/shared/storage/StorageAdapter';

interface MarginaliaDatabase extends DBSchema {
  pages: {
    key: string;
    value: PageRecord;
  };
}

export const LOCAL_ADAPTER_DB_NAME = 'marginalia-local';
export const LOCAL_ADAPTER_DB_VERSION = 1;

const PAGE_STORE = 'pages';

const cloneValue = <T>(value: T): T =>
  typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T;

export const createLocalAdapterDatabaseOpener =
  (databaseName = LOCAL_ADAPTER_DB_NAME): (() => Promise<IDBPDatabase<MarginaliaDatabase>>) =>
  () =>
    openDB<MarginaliaDatabase>(databaseName, LOCAL_ADAPTER_DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(PAGE_STORE)) {
          database.createObjectStore(PAGE_STORE, { keyPath: 'canonicalUrl' });
        }
      },
    });

const getConfiguredLocalAdapterDatabaseName = (): string =>
  (globalThis as { __MARGINALIA_LOCAL_ADAPTER_DB_NAME__?: string }).__MARGINALIA_LOCAL_ADAPTER_DB_NAME__ ??
  LOCAL_ADAPTER_DB_NAME;

export const openLocalAdapterDatabase = (): Promise<IDBPDatabase<MarginaliaDatabase>> =>
  createLocalAdapterDatabaseOpener(getConfiguredLocalAdapterDatabaseName())();

export const resetLocalAdapterDatabase = async (databaseName = LOCAL_ADAPTER_DB_NAME): Promise<void> => {
  await deleteDB(databaseName);
};

export class LocalAdapter implements StorageAdapter {
  public constructor(
    private readonly openDatabase: () => Promise<IDBPDatabase<MarginaliaDatabase>> = openLocalAdapterDatabase,
  ) {}

  public async getAnnotations(canonicalUrl: string): Promise<Annotation[]> {
    const pageRecord = await this.getPageRecord(canonicalUrl);

    return cloneValue(pageRecord?.annotations ?? []);
  }

  public async saveAnnotation(canonicalUrl: string, annotation: Annotation): Promise<Annotation> {
    const database = await this.openDatabase();
    const pageRecord = (await database.get(PAGE_STORE, canonicalUrl)) ?? createEmptyPageRecord(canonicalUrl);
    const existingIndex = pageRecord.annotations.findIndex(
      (storedAnnotation) => storedAnnotation.id === annotation.id,
    );
    const nextAnnotations = [...pageRecord.annotations];

    if (existingIndex >= 0) {
      nextAnnotations[existingIndex] = cloneValue(annotation);
    } else {
      nextAnnotations.push(cloneValue(annotation));
    }

    await database.put(PAGE_STORE, {
      ...pageRecord,
      lastVisited: new Date().toISOString(),
      annotations: nextAnnotations,
    });

    return cloneValue(annotation);
  }

  public async deleteAnnotation(canonicalUrl: string, annotationId: string): Promise<boolean> {
    const database = await this.openDatabase();
    const pageRecord = await database.get(PAGE_STORE, canonicalUrl);

    if (!pageRecord) {
      return false;
    }

    const nextAnnotations = pageRecord.annotations.filter((annotation) => annotation.id !== annotationId);

    if (nextAnnotations.length === pageRecord.annotations.length) {
      return false;
    }

    if (nextAnnotations.length === 0) {
      await database.delete(PAGE_STORE, canonicalUrl);

      return true;
    }

    await database.put(PAGE_STORE, {
      ...pageRecord,
      lastVisited: new Date().toISOString(),
      annotations: nextAnnotations,
    });

    return true;
  }

  public async listAnnotatedUrls(): Promise<PageRecord[]> {
    const database = await this.openDatabase();
    const pageRecords = await database.getAll(PAGE_STORE);

    return pageRecords
      .filter((pageRecord) => pageRecord.annotations.length > 0)
      .sort((left, right) => right.lastVisited.localeCompare(left.lastVisited))
      .map((pageRecord) => cloneValue(pageRecord));
  }

  private async getPageRecord(canonicalUrl: string): Promise<PageRecord | undefined> {
    const database = await this.openDatabase();

    return database.get(PAGE_STORE, canonicalUrl);
  }
}
