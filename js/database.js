 /*
  * DATABASE
  *
  * IndexedDB persistence boundary for MythOS Vault.
  *
  * Physical database version:
  *     6
  *
  * IMPORTANT:
  * The physical IndexedDB version is intentionally kept stable.
  * Logical record evolution is handled by database-schema.js and
  * database-compat.js rather than by repeatedly incrementing the
  * IndexedDB version.
  */

import {
    normalizeVectorRecord,
    normalizeDocumentRecord,
    normalizeLogRecord
} from './database-schema.js';

import {
    toCurrentVector,
    toCurrentDocument,
    toCurrentLog
} from './database-compat.js';


// ================================================================
// DATABASE CONSTANTS
// ================================================================

export const DB_NAME =
    'mythos_rag_db';

export const DB_VERSION =
    6;

export const VECTOR_STORE =
    'vectors';

export const DOCUMENT_STORE =
    'documents';

export const LOG_STORE =
    'logs';


// ================================================================
// DATABASE
// ================================================================

export class Database {
    constructor(
        name = DB_NAME,
        version = DB_VERSION
    ) {
        this.name = name;
        this.version = version;
        this.connection = null;
    }


    // ============================================================
    // INITIALIZATION
    // ============================================================

    async init() {
        if (this.connection) {
            return this;
        }

        this.connection =
            await this.open();

        return this;
    }


    open() {
        return new Promise(
            (resolve, reject) => {
                const request =
                    indexedDB.open(
                        this.name,
                        this.version
                    );

                request.onupgradeneeded =
                    event => {
                        const database =
                            event.target.result;

                        ensureStore(
                            database,
                            VECTOR_STORE,
                            'id'
                        );

                        ensureStore(
                            database,
                            DOCUMENT_STORE,
                            'id'
                        );

                        ensureStore(
                            database,
                            LOG_STORE,
                            'id'
                        );
                    };

                request.onsuccess =
                    event => {
                        const database =
                            event.target.result;

                        database.onversionchange =
                            () => {
                                database.close();
                                this.connection =
                                    null;
                            };

                        resolve(
                            database
                        );
                    };

                request.onerror =
                    () => {
                        reject(
                            request.error ||
                            new Error(
                                'Unable to open IndexedDB.'
                            )
                        );
                    };

                request.onblocked =
                    () => {
                        reject(
                            new Error(
                                'IndexedDB upgrade is blocked by another open connection.'
                            )
                        );
                    };
            }
        );
    }


    // ============================================================
    // CONNECTION
    // ============================================================

    get db() {
        if (!this.connection) {
            throw new Error(
                'Database has not been initialized.'
            );
        }

        return this.connection;
    }


    // ============================================================
    // VECTORS
    // ============================================================

    async getVectors() {
        const records =
            await this.getAll(
                VECTOR_STORE
            );

        return records.map(
            normalizeVectorRecord
        );
    }


    async putVector(record) {
        const vector =
            toCurrentVector(record);

        await this.put(
            VECTOR_STORE,
            vector
        );

        return vector;
    }


    async putVectors(records) {
        const vectors =
            records.map(
                toCurrentVector
            );

        if (!vectors.length) {
            return [];
        }

        await this.putMany(
            VECTOR_STORE,
            vectors
        );

        return vectors;
    }


    async clearVectors() {
        await this.clear(
            VECTOR_STORE
        );
    }


    async vectorCount() {
        return this.count(
            VECTOR_STORE
        );
    }


    // ============================================================
    // DOCUMENTS
    // ============================================================

    async getDocuments() {
        const records =
            await this.getAll(
                DOCUMENT_STORE
            );

        return records.map(
            normalizeDocumentRecord
        );
    }


    async getDocument(id) {
        const record =
            await this.getById(
                DOCUMENT_STORE,
                id
            );

        return record
            ? normalizeDocumentRecord(
                record
            )
            : null;
    }


    async putDocument(record) {
        const document =
            toCurrentDocument(
                record
            );

        await this.put(
            DOCUMENT_STORE,
            document
        );

        return document;
    }


    async putDocuments(records) {
        const documents =
            records.map(
                toCurrentDocument
            );

        if (!documents.length) {
            return [];
        }

        await this.putMany(
            DOCUMENT_STORE,
            documents
        );

        return documents;
    }


    async clearDocuments() {
        await this.clear(
            DOCUMENT_STORE
        );
    }


    async documentCount() {
        return this.count(
            DOCUMENT_STORE
        );
    }


    // ============================================================
    // LOGS
    // ============================================================

    async getLogs() {
        const records =
            await this.getAll(
                LOG_STORE
            );

        return records.map(
            normalizeLogRecord
        );
    }


    async putLog(record) {
        const log =
            toCurrentLog(record);

        await this.put(
            LOG_STORE,
            log
        );

        return log;
    }


    async putLogs(records) {
        const logs =
            records.map(
                toCurrentLog
            );

        if (!logs.length) {
            return [];
        }

        await this.putMany(
            LOG_STORE,
            logs
        );

        return logs;
    }


    async clearLogs() {
        await this.clear(
            LOG_STORE
        );
    }


    async logCount() {
        return this.count(
            LOG_STORE
        );
    }


    // ============================================================
    // GENERIC STORE OPERATIONS
    // ============================================================

    getStore(
        storeName,
        mode = 'readonly'
    ) {
        const transaction =
            this.db.transaction(
                storeName,
                mode
            );

        return transaction.objectStore(
            storeName
        );
    }


    getAll(storeName) {
        return new Promise(
            (resolve, reject) => {
                const store =
                    this.getStore(
                        storeName,
                        'readonly'
                    );

                const request =
                    store.getAll();

                request.onsuccess =
                    () => {
                        resolve(
                            Array.isArray(
                                request.result
                            )
                                ? request.result
                                : []
                        );
                    };

                request.onerror =
                    () => {
                        reject(
                            request.error ||
                            new Error(
                                `Unable to read ${storeName}.`
                            )
                        );
                    };
            }
        );
    }


    getById(
        storeName,
        id
    ) {
        return new Promise(
            (resolve, reject) => {
                const store =
                    this.getStore(
                        storeName,
                        'readonly'
                    );

                const request =
                    store.get(id);

                request.onsuccess =
                    () => {
                        resolve(
                            request.result ??
                            null
                        );
                    };

                request.onerror =
                    () => {
                        reject(
                            request.error ||
                            new Error(
                                `Unable to read record from ${storeName}.`
                            )
                        );
                    };
            }
        );
    }


    put(
        storeName,
        record
    ) {
        return new Promise(
            (resolve, reject) => {
                const transaction =
                    this.db.transaction(
                        storeName,
                        'readwrite'
                    );

                const store =
                    transaction.objectStore(
                        storeName
                    );

                store.put(record);

                transaction.oncomplete =
                    () => resolve(record);

                transaction.onerror =
                    () => {
                        reject(
                            transaction.error ||
                            new Error(
                                `Unable to write to ${storeName}.`
                            )
                        );
                    };

                transaction.onabort =
                    () => {
                        reject(
                            transaction.error ||
                            new Error(
                                `Write aborted for ${storeName}.`
                            )
                        );
                    };
            }
        );
    }


    putMany(
        storeName,
        records
    ) {
        return new Promise(
            (resolve, reject) => {
                const transaction =
                    this.db.transaction(
                        storeName,
                        'readwrite'
                    );

                const store =
                    transaction.objectStore(
                        storeName
                    );

                for (
                    const record of records
                ) {
                    store.put(record);
                }

                transaction.oncomplete =
                    () => resolve(records);

                transaction.onerror =
                    () => {
                        reject(
                            transaction.error ||
                            new Error(
                                `Unable to write records to ${storeName}.`
                            )
                        );
                    };

                transaction.onabort =
                    () => {
                        reject(
                            transaction.error ||
                            new Error(
                                `Write aborted for ${storeName}.`
                            )
                        );
                    };
            }
        );
    }


    delete(
        storeName,
        id
    ) {
        return new Promise(
            (resolve, reject) => {
                const transaction =
                    this.db.transaction(
                        storeName,
                        'readwrite'
                    );

                const store =
                    transaction.objectStore(
                        storeName
                    );

                store.delete(id);

                transaction.oncomplete =
                    () => resolve();

                transaction.onerror =
                    () => {
                        reject(
                            transaction.error ||
                            new Error(
                                `Unable to delete record from ${storeName}.`
                            )
                        );
                    };
            }
        );
    }


    clear(storeName) {
        return new Promise(
            (resolve, reject) => {
                const transaction =
                    this.db.transaction(
                        storeName,
                        'readwrite'
                    );

                const store =
                    transaction.objectStore(
                        storeName
                    );

                store.clear();

                transaction.oncomplete =
                    () => resolve();

                transaction.onerror =
                    () => {
                        reject(
                            transaction.error ||
                            new Error(
                                `Unable to clear ${storeName}.`
                            )
                        );
                    };

                transaction.onabort =
                    () => {
                        reject(
                            transaction.error ||
                            new Error(
                                `Clear aborted for ${storeName}.`
                            )
                        );
                    };
            }
        );
    }


    count(storeName) {
        return new Promise(
            (resolve, reject) => {
                const store =
                    this.getStore(
                        storeName,
                        'readonly'
                    );

                const request =
                    store.count();

                request.onsuccess =
                    () => {
                        resolve(
                            request.result || 0
                        );
                    };

                request.onerror =
                    () => {
                        reject(
                            request.error ||
                            new Error(
                                `Unable to count ${storeName}.`
                            )
                        );
                    };
            }
        );
    }


    // ============================================================
    // CLOSE
    // ============================================================

    close() {
        if (
            this.connection
        ) {
            this.connection.close();
            this.connection = null;
        }
    }
}


// ================================================================
// STORE CREATION
// ================================================================

function ensureStore(
    database,
    storeName,
    keyPath
) {
    if (
        database.objectStoreNames.contains(
            storeName
        )
    ) {
        return;
    }

    database.createObjectStore(
        storeName,
        {
            keyPath
        }
    );
}


// ================================================================
// SINGLE DATABASE INSTANCE
// ================================================================

export const db =
    new Database();

export default db;