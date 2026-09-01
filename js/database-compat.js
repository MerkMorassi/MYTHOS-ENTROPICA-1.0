/*
 * DATABASE COMPATIBILITY
 *
 * Converts legacy/current records into the canonical logical shape.
 *
 * This layer exists so the physical IndexedDB schema can remain stable
 * while logical record formats evolve.
 */

import {
    normalizeVectorRecord,
    normalizeDocumentRecord,
    normalizeLogRecord,
    isLegacyRecord
} from './database-schema.js';

export function toCurrentVector(record = {}) {
    const normalized =
        normalizeVectorRecord(record);

    if (!isLegacyRecord(record)) {
        return normalized;
    }

    return {
        ...normalized,
        embedding: Array.isArray(
            normalized.embedding
        )
            ? normalized.embedding
            : [],
        metadata:
            normalized.metadata || {}
    };
}

export function toCurrentVectors(
    records = []
) {
    if (!Array.isArray(records)) {
        return [];
    }

    return records.map(
        toCurrentVector
    );
}

export function toCurrentDocument(
    record = {}
) {
    const normalized =
        normalizeDocumentRecord(record);

    if (!isLegacyRecord(record)) {
        return normalized;
    }

    return {
        ...normalized,
        metadata:
            normalized.metadata || {}
    };
}

export function toCurrentDocuments(
    records = []
) {
    if (!Array.isArray(records)) {
        return [];
    }

    return records.map(
        toCurrentDocument
    );
}

export function toCurrentLog(
    record = {}
) {
    const normalized =
        normalizeLogRecord(record);

    if (!isLegacyRecord(record)) {
        return normalized;
    }

    return {
        ...normalized,
        message:
            typeof normalized.message ===
            'string'
                ? normalized.message
                : ''
    };
}

export function toCurrentLogs(
    records = []
) {
    if (!Array.isArray(records)) {
        return [];
    }

    return records.map(
        toCurrentLog
    );
}
