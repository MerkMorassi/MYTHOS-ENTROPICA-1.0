/*
 * MYTHOS DB
 *
 * Single IndexedDB access layer.
 *
 * The native IndexedDB version is changed only when the physical
 * object-store structure changes. Application schema evolution is
 * handled by mythos-db-schema.js and mythos-db-compat.js.
 */

import {
    normalizeVectorRecord,
    normalizeDocumentRecord,
    normalizeLogRecord
} from './mythos-db-schema.js';

export const MYTHOS_DB_NAME = 'mythos_rag_db';

/*
 * Preserve the existing physical database version.
 * Do not increment this for logical schema changes.
 */
export const MYTHOS_IDB_VERSION = 6;

export const STORES = Object.freeze({
    VECTORS: 'vectors',
    DOCUMENTS: 'documents',
    LOGS: 'logs'
});

class MythosDB {
    constructor() {
        this.db = null;
    }

    async open() {
        if (this.db) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(
                MYTHOS_DB_NAME,
                MYTHOS_IDB_VERSION
            );

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(STORES.VECTORS)) {
                    db.createObjectStore(STORES.VECTORS, {
                        keyPath: 'id'
                    });
                }

                if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
                    db.createObjectStore(STORES.DOCUMENTS, {
                        keyPath: 'id'
                    });
                }

                if (!db.objectStoreNames.contains(STORES.LOGS)) {
                    db.createObjectStore(STORES.LOGS, {
                        keyPath: 'id'
                    });
                }
            };

            request.onsuccess = () => {
                this.db = request.result;

                this.db.onclose = () => {
                    this.db = null;
                };

                resolve(this.db);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async put(storeName, record) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);

            const request = store.put(record);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const request = tx.objectStore(storeName).get(id);

            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const request = tx.objectStore(storeName).getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const request = tx.objectStore(storeName).delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const request = tx.objectStore(storeName).clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async count(storeName) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const request = tx.objectStore(storeName).count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async putVector(record) {
        return this.put(
            STORES.VECTORS,
            normalizeVectorRecord(record)
        );
    }

    async getVector(id) {
        const record = await this.get(STORES.VECTORS, id);
        return record ? normalizeVectorRecord(record) : null;
    }

    async getVectors() {
        const records = await this.getAll(STORES.VECTORS);
        return records.map(normalizeVectorRecord);
    }

    async putDocument(record) {
        return this.put(
            STORES.DOCUMENTS,
            normalizeDocumentRecord(record)
        );
    }

    async getDocument(id) {
        const record = await this.get(STORES.DOCUMENTS, id);
        return record ? normalizeDocumentRecord(record) : null;
    }

    async getDocuments() {
        const records = await this.getAll(STORES.DOCUMENTS);
        return records.map(normalizeDocumentRecord);
    }

    async putLog(record) {
        return this.put(
            STORES.LOGS,
            normalizeLogRecord(record)
        );
    }

    async getLogs() {
        const records = await this.getAll(STORES.LOGS);
        return records.map(normalizeLogRecord);
    }

    async deleteVector(id) {
        return this.delete(STORES.VECTORS, id);
    }

    async clearVectors() {
        return this.clear(STORES.VECTORS);
    }

    async vectorCount() {
        return this.count(STORES.VECTORS);
    }
}

export const mythosDB = new MythosDB();

export default mythosDB;