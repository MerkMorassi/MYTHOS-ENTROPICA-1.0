export const SCHEMA_VERSION = 1;

export function normalizeMetadata(metadata) {
    return (
        metadata &&
        typeof metadata === 'object' &&
        !Array.isArray(metadata)
    )
        ? { ...metadata }
        : {};
}

export function normalizeEmbedding(record) {
    const embedding = Array.isArray(record?.embedding)
        ? record.embedding
        : Array.isArray(record?.vector)
            ? record.vector
            : [];

    return embedding
        .map(Number)
        .filter(Number.isFinite);
}

export function normalizeText(record) {
    if (typeof record?.text === 'string') {
        return record.text;
    }

    if (typeof record?.content === 'string') {
        return record.content;
    }

    if (typeof record?.chunk === 'string') {
        return record.chunk;
    }

    return '';
}

function getId(record) {
    return (
        record?.id ??
        record?.key ??
        crypto.randomUUID()
    );
}

export function normalizeVectorRecord(record = {}) {
    const normalized = {
        ...record,
        schema: SCHEMA_VERSION,
        id: getId(record),
        text: normalizeText(record),
        embedding: normalizeEmbedding(record),
        metadata: normalizeMetadata(record.metadata)
    };

    if (
        normalized.metadata.source == null &&
        record.source != null
    ) {
        normalized.metadata.source = record.source;
    }

    if (
        normalized.metadata.filename == null &&
        record.filename != null
    ) {
        normalized.metadata.filename = record.filename;
    }

    return normalized;
}

export function normalizeDocumentRecord(record = {}) {
    return {
        ...record,
        schema: SCHEMA_VERSION,
        id: getId(record),
        text: normalizeText(record),
        metadata: normalizeMetadata(record.metadata)
    };
}

export function normalizeLogRecord(record = {}) {
    return {
        ...record,
        schema: SCHEMA_VERSION,
        id: getId(record),
        timestamp:
            record.timestamp ??
            record.createdAt ??
            new Date().toISOString(),
        message:
            typeof record.message === 'string'
                ? record.message
                : typeof record.text === 'string'
                    ? record.text
                    : ''
    };
}

export function getSchemaVersion(record) {
    const version = Number(record?.schema);

    return Number.isInteger(version) && version >= 0
        ? version
        : 0;
}

export function isLegacyRecord(record) {
    return getSchemaVersion(record) < SCHEMA_VERSION;
}