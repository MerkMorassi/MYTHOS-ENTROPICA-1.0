```js
/*
 * ENTROPICA
 *
 * Application controller and RAG engine for MythOS Vault.
 *
 * Boundaries:
 *   - gemini-api.js  -> Gemini network access
 *   - database.js    -> IndexedDB access
 *   - this file      -> application state, ingestion, retrieval, UI
 */

import {
    DEFAULT_MODEL,
    EMBEDDING_MODEL,
    generateContent,
    embedContent,
    listModels
} from './gemini-api.js';

import { db } from './database.js';

import {
    toCurrentVector,
    toCurrentVectors,
    toCurrentLog
} from './database-compat.js';


const SETTINGS_KEY =
    'mythos_vault_settings';

const DEFAULT_SYSTEM_INSTRUCTION =
    `You are Noesis, the reasoning intelligence of MythOS Vault.

Use the supplied archive context as your primary factual grounding.
Distinguish retrieved material from inference.
Do not fabricate citations, archive entries, people, events, or quotations.
When the archive does not contain enough information, say so clearly.

You may reason across symbolic, philosophical, scientific, artistic,
and engineering material when the retrieved context supports doing so.`;

const DEFAULT_CHUNK_SIZE =
    1800;

const DEFAULT_CHUNK_OVERLAP =
    250;

const DEFAULT_RESULT_LIMIT =
    8;

const state = {
    apiKey: '',
    model: DEFAULT_MODEL,
    systemInstruction:
        DEFAULT_SYSTEM_INSTRUCTION,
    glossary: {},

    selectedFiles: [],

    isIngesting: false,
    abortController: null,

    vectors: [],

    chat: []
};


const dom = {};

let entropica = null;


/* ------------------------------------------------------------------
 * INITIALIZATION
 * ---------------------------------------------------------------- */

async function initialize() {
    cacheDom();
    loadSettings();
    wireEvents();

    populateModelSelect();

    await db.init();

    entropica =
        new RagEngine();

    await entropica.init();

    state.vectors =
        entropica.vectors;

    updateDatabaseStatus();
    renderSourceList();
    renderWelcome();
}


/* ------------------------------------------------------------------
 * DOM
 * ---------------------------------------------------------------- */

function cacheDom() {
    const ids = [
        'apiKeyInput',
        'modelSelect',
        'systemInstructionInput',
        'glossaryInput',
        'fileInput',
        'fileDrop',
        'fileList',
        'ingestButton',
        'cancelIngestButton',
        'progressContainer',
        'progressBar',
        'progressText',
        'chatInput',
        'sendButton',
        'chatHistory',
        'databaseStatus',
        'vectorCount',
        'documentCount',
        'logCount',
        'sourceList',
        'statusMessage',
        'settingsButton',
        'settingsPanel',
        'archiveButton',
        'archivePanel',
        'analyticsButton',
        'analyticsPanel',
        'clearVectorsButton',
        'exportButton',
        'restoreButton',
        'restoreInput'
    ];

    for (const id of ids) {
        dom[id] =
            document.getElementById(id);
    }
}


/* ------------------------------------------------------------------
 * SETTINGS
 * ---------------------------------------------------------------- */

function loadSettings() {
    try {
        const raw =
            localStorage.getItem(
                SETTINGS_KEY
            );

        if (!raw) {
            return;
        }

        const settings =
            JSON.parse(raw);

        state.apiKey =
            typeof settings.apiKey ===
            'string'
                ? settings.apiKey
                : '';

        state.model =
            typeof settings.model ===
            'string' &&
            settings.model.trim()
                ? settings.model
                : DEFAULT_MODEL;

        state.systemInstruction =
            typeof settings.systemInstruction ===
            'string' &&
            settings.systemInstruction.trim()
                ? settings.systemInstruction
                : DEFAULT_SYSTEM_INSTRUCTION;

        state.glossary =
            settings.glossary &&
            typeof settings.glossary ===
                'object'
                ? settings.glossary
                : {};
    } catch {
        state.apiKey = '';
        state.model =
            DEFAULT_MODEL;
        state.systemInstruction =
            DEFAULT_SYSTEM_INSTRUCTION;
        state.glossary = {};
    }

    if (dom.apiKeyInput) {
        dom.apiKeyInput.value =
            state.apiKey;
    }

    if (dom.modelSelect) {
        dom.modelSelect.value =
            state.model;
    }

    if (dom.systemInstructionInput) {
        dom.systemInstructionInput.value =
            state.systemInstruction;
    }
}

function saveSettings() {
    state.apiKey =
        dom.apiKeyInput?.value.trim() ||
        '';

    state.model =
        dom.modelSelect?.value ||
        DEFAULT_MODEL;

    state.systemInstruction =
        dom.systemInstructionInput?.value.trim() ||
        DEFAULT_SYSTEM_INSTRUCTION;

    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
            apiKey: state.apiKey,
            model: state.model,
            systemInstruction:
                state.systemInstruction,
            glossary:
                state.glossary
        })
    );
}


/* ------------------------------------------------------------------
 * MODEL DISCOVERY
 * ---------------------------------------------------------------- */

async function refreshModels() {
    if (!state.apiKey) {
        showStatus(
            'Enter a Gemini API key before refreshing models.',
            'warning'
        );

        return;
    }

    try {
        showStatus(
            'Loading available Gemini models…',
            'info'
        );

        const models =
            await listModels(
                state.apiKey
            );

        const supported =
            models.filter(
                model =>
                    Array.isArray(
                        model.supportedGenerationMethods
                    ) &&
                    model.supportedGenerationMethods.includes(
                        'generateContent'
                    )
            );

        populateModelSelect(
            supported
        );

        showStatus(
            `${supported.length} generation models available.`,
            'success'
        );
    } catch (error) {
        showStatus(
            error.message,
            'error'
        );
    }
}

function populateModelSelect(
    models = []
) {
    if (!dom.modelSelect) {
        return;
    }

    const current =
        state.model ||
        DEFAULT_MODEL;

    dom.modelSelect.innerHTML = '';

    const available =
        models.length
            ? models
            : [
                {
                    name:
                        `models/${DEFAULT_MODEL}`,
                    displayName:
                        DEFAULT_MODEL
                }
            ];

    for (const model of available) {
        const name =
            String(
                model.name || ''
            ).replace(
                /^models\//,
                ''
            );

        if (!name) {
            continue;
        }

        const option =
            document.createElement(
                'option'
            );

        option.value = name;

        option.textContent =
            model.displayName ||
            name;

        dom.modelSelect.appendChild(
            option
        );
    }

    const exists =
        Array.from(
            dom.modelSelect.options
        ).some(
            option =>
                option.value === current
        );

    if (!exists) {
        const option =
            document.createElement(
                'option'
            );

        option.value = current;
        option.textContent = current;

        dom.modelSelect.appendChild(
            option
        );
    }

    dom.modelSelect.value =
        current;
}


/* ------------------------------------------------------------------
 * EVENTS
 * ---------------------------------------------------------------- */

function wireEvents() {
    dom.apiKeyInput?.addEventListener(
        'change',
        saveSettings
    );

    dom.modelSelect?.addEventListener(
        'change',
        saveSettings
    );

    dom.systemInstructionInput?.addEventListener(
        'change',
        saveSettings
    );

    dom.fileInput?.addEventListener(
        'change',
        event => {
            state.selectedFiles =
                Array.from(
                    event.target.files || []
                );

            renderSelectedFiles();
        }
    );

    dom.fileDrop?.addEventListener(
        'dragover',
        event => {
            event.preventDefault();
            dom.fileDrop.classList.add(
                'drag-active'
            );
        }
    );

    dom.fileDrop?.addEventListener(
        'dragleave',
        () => {
            dom.fileDrop.classList.remove(
                'drag-active'
            );
        }
    );

    dom.fileDrop?.addEventListener(
        'drop',
        event => {
            event.preventDefault();

            dom.fileDrop.classList.remove(
                'drag-active'
            );

            state.selectedFiles =
                Array.from(
                    event.dataTransfer.files || []
                );

            renderSelectedFiles();
        }
    );

    dom.ingestButton?.addEventListener(
        'click',
        ingestFiles
    );

    dom.cancelIngestButton?.addEventListener(
        'click',
        cancelIngestion
    );

    dom.sendButton?.addEventListener(
        'click',
        sendMessage
    );

    dom.chatInput?.addEventListener(
        'keydown',
        event => {
            if (
                event.key === 'Enter' &&
                !event.shiftKey
            ) {
                event.preventDefault();
                sendMessage();
            }
        }
    );

    dom.settingsButton?.addEventListener(
        'click',
        () =>
            togglePanel(
                dom.settingsPanel
            )
    );

    dom.archiveButton?.addEventListener(
        'click',
        () =>
            togglePanel(
                dom.archivePanel
            )
    );

    dom.analyticsButton?.addEventListener(
        'click',
        () =>
            togglePanel(
                dom.analyticsPanel
            )
    );

    dom.clearVectorsButton?.addEventListener(
        'click',
        clearVectors
    );

    dom.exportButton?.addEventListener(
        'click',
        exportArchive
    );

    dom.restoreButton?.addEventListener(
        'click',
        () =>
            dom.restoreInput?.click()
    );

    dom.restoreInput?.addEventListener(
        'change',
        restoreArchive
    );

    document
        .querySelectorAll(
            '[data-refresh-models]'
        )
        .forEach(
            element =>
                element.addEventListener(
                    'click',
                    refreshModels
                )
        );

    document
        .querySelectorAll(
            '[data-import-glossary]'
        )
        .forEach(
            element =>
                element.addEventListener(
                    'click',
                    importGlossary
                )
        );
}


/* ------------------------------------------------------------------
 * INGESTION
 * ---------------------------------------------------------------- */

async function ingestFiles() {
    if (state.isIngesting) {
        return;
    }

    if (!state.apiKey) {
        showStatus(
            'Enter a Gemini API key before ingesting files.',
            'error'
        );

        return;
    }

    if (!state.selectedFiles.length) {
        showStatus(
            'Select one or more files first.',
            'warning'
        );

        return;
    }

    saveSettings();

    state.isIngesting = true;
    state.abortController =
        new AbortController();

    setIngestionControls(true);
    showProgress(0, 'Preparing ingestion…');

    const controller =
        state.abortController;

    let processed = 0;
    let created = 0;

    try {
        for (
            const file of state.selectedFiles
        ) {
            if (
                controller.signal.aborted
            ) {
                break;
            }

            showProgress(
                processed /
                    state.selectedFiles.length *
                    100,
                `Reading ${file.name}…`
            );

            const text =
                await readFile(
                    file
                );

            const cleaned =
                cleanText(text);

            const chunks =
                chunkText(
                    cleaned,
                    DEFAULT_CHUNK_SIZE,
                    DEFAULT_CHUNK_OVERLAP
                );

            for (
                let index = 0;
                index < chunks.length;
                index++
            ) {
                if (
                    controller.signal.aborted
                ) {
                    break;
                }

                const chunk =
                    chunks[index];

                showProgress(
                    (
                        processed +
                        index /
                            Math.max(
                                chunks.length,
                                1
                            )
                    ) /
                        state.selectedFiles.length *
                        100,
                    `${file.name} — chunk ${index + 1}/${chunks.length}`
                );

                const response =
                    await embedContent(
                        chunk,
                        state.apiKey,
                        {
                            model:
                                EMBEDDING_MODEL,
                            signal:
                                controller.signal
                        }
                    );

                const embedding =
                    extractEmbedding(
                        response
                    );

                const vector =
                    toCurrentVector({
                        id:
                            crypto.randomUUID(),
                        text: chunk,
                        embedding,
                        metadata: {
                            source:
                                file.name,
                            filename:
                                file.name,
                            mimeType:
                                file.type ||
                                'text/plain',
                            chunkIndex:
                                index,
                            chunkCount:
                                chunks.length,
                            createdAt:
                                new Date().toISOString()
                        }
                    });

                await entropica.addVector(
                    vector
                );

                created++;
            }

            processed++;
        }

        if (
            controller.signal.aborted
        ) {
            showStatus(
                `Ingestion cancelled. ${created} vector${created === 1 ? '' : 's'} added.`,
                'warning'
            );
        } else {
            showStatus(
                `Ingestion complete. ${created} vector${created === 1 ? '' : 's'} added.`,
                'success'
            );
        }

        renderSourceList();
        updateDatabaseStatus();
    } catch (error) {
        if (
            error?.name ===
            'AbortError'
        ) {
            showStatus(
                `Ingestion cancelled. ${created} vector${created === 1 ? '' : 's'} added.`,
                'warning'
            );
        } else {
            showStatus(
                error.message,
                'error'
            );
        }
    } finally {
        const wasAborted =
            controller.signal.aborted;

        state.isIngesting = false;

        if (
            state.abortController ===
            controller
        ) {
            state.abortController = null;
        }

        setIngestionControls(false);

        if (!wasAborted) {
            hideProgress();
        }
    }
}

function cancelIngestion() {
    if (
        state.abortController
    ) {
        state.abortController.abort();
    }
}

function setIngestionControls(
    active
) {
    if (dom.ingestButton) {
        dom.ingestButton.disabled =
            active;
    }

    if (dom.cancelIngestButton) {
        dom.cancelIngestButton.disabled =
            !active;
    }
}

function showProgress(
    percent,
    text
) {
    if (
        dom.progressContainer
    ) {
        dom.progressContainer.classList.remove(
            'hidden'
        );
    }

    if (dom.progressBar) {
        dom.progressBar.style.width =
            `${Math.max(
                0,
                Math.min(100, percent)
            )}%`;
    }

    if (dom.progressText) {
        dom.progressText.textContent =
            text;
    }
}

function hideProgress() {
    dom.progressContainer?.classList.add(
        'hidden'
    );
}

function readFile(file) {
    return new Promise(
        (resolve, reject) => {
            const reader =
                new FileReader();

            reader.onload =
                () =>
                    resolve(
                        String(
                            reader.result || ''
                        )
                    );

            reader.onerror =
                () =>
                    reject(
                        reader.error ||
                        new Error(
                            `Unable to read ${file.name}.`
                        )
                    );

            reader.readAsText(
                file
            );
        }
    );
}

function cleanText(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(
            /[ \t]+\n/g,
            '\n'
        )
        .replace(
            /\n{3,}/g,
            '\n\n'
        )
        .trim();
}

function chunkText(
    text,
    size = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_CHUNK_OVERLAP
) {
    if (!text) {
        return [];
    }

    if (
        size <= overlap
    ) {
        throw new Error(
            'Chunk size must be greater than chunk overlap.'
        );
    }

    const chunks = [];

    let start = 0;

    while (
        start < text.length
    ) {
        const end =
            Math.min(
                start + size,
                text.length
            );

        let chunk =
            text.slice(
                start,
                end
            );

        if (
            end < text.length
        ) {
            const boundary =
                Math.max(
                    chunk.lastIndexOf('\n\n'),
                    chunk.lastIndexOf('. '),
                    chunk.lastIndexOf(' ')
                );

            if (
                boundary >
                size * 0.55
            ) {
                chunk =
                    chunk.slice(
                        0,
                        boundary + 1
                    );
            }
        }

        chunk =
            chunk.trim();

        if (chunk) {
            chunks.push(chunk);
        }

        const advance =
            Math.max(
                chunk.length -
                    overlap,
                1
            );

        start += advance;
    }

    return chunks;
}


/* ------------------------------------------------------------------
 * RAG ENGINE
 * ---------------------------------------------------------------- */

class RagEngine {
    constructor() {
        this.vectors = [];
    }

    async init() {
        this.vectors =
            toCurrentVectors(
                await db.getVectors()
            );

        return this;
    }

    async addVector(
        record
    ) {
        const vector =
            toCurrentVector(
                record
            );

        await db.putVector(
            vector
        );

        this.vectors.push(
            vector
        );

        state.vectors =
            this.vectors;

        return vector;
    }

    async addVectors(
        records
    ) {
        const vectors =
            toCurrentVectors(
                records
            );

        if (!vectors.length) {
            return [];
        }

        await db.putVectors(
            vectors
        );

        this.vectors.push(
            ...vectors
        );

        state.vectors =
            this.vectors;

        return vectors;
    }

    async clear() {
        await db.clearVectors();

        this.vectors = [];

        state.vectors =
            this.vectors;
    }

    search(
        embedding,
        limit = DEFAULT_RESULT_LIMIT
    ) {
        if (
            !Array.isArray(
                embedding
            ) ||
            !embedding.length
        ) {
            return [];
        }

        return this.vectors
            .map(
                vector => ({
                    vector,
                    score:
                        cosineSimilarity(
                            embedding,
                            vector.embedding
                        )
                })
            )
            .filter(
                result =>
                    Number.isFinite(
                        result.score
                    )
            )
            .sort(
                (a, b) =>
                    b.score -
                    a.score
            )
            .slice(
                0,
                limit
            );
    }
}


/* ------------------------------------------------------------------
 * RETRIEVAL
 * ---------------------------------------------------------------- */

async function hybridSearch(
    query,
    limit = DEFAULT_RESULT_LIMIT
) {
    if (
        !entropica?.vectors.length
    ) {
        return [];
    }

    const response =
        await embedContent(
            query,
            state.apiKey,
            {
                model:
                    EMBEDDING_MODEL
            }
        );

    const embedding =
        extractEmbedding(
            response
        );

    const vectorResults =
        entropica.search(
            embedding,
            Math.max(
                limit * 3,
                12
            )
        );

    const lexicalResults =
        lexicalSearch(
            query,
            entropica.vectors,
            Math.max(
                limit * 3,
                12
            )
        );

    const combined =
        new Map();

    for (
        const result of vectorResults
    ) {
        combined.set(
            result.vector.id,
            {
                vector:
                    result.vector,
                vectorScore:
                    result.score,
                lexicalScore: 0
            }
        );
    }

    for (
        const result of lexicalResults
    ) {
        const existing =
            combined.get(
                result.vector.id
            );

        if (existing) {
            existing.lexicalScore =
                result.score;
        } else {
            combined.set(
                result.vector.id,
                {
                    vector:
                        result.vector,
                    vectorScore: 0,
                    lexicalScore:
                        result.score
                }
            );
        }
    }

    return Array.from(
        combined.values()
    )
        .map(result => ({
            vector:
                result.vector,
            score:
                result.vectorScore *
                    0.75 +
                result.lexicalScore *
                    0.25
        }))
        .sort(
            (a, b) =>
                b.score -
                a.score
        )
        .slice(
            0,
            limit
        );
}

function lexicalSearch(
    query,
    vectors,
    limit
) {
    const terms =
        tokenize(query);

    if (!terms.length) {
        return [];
    }

    return vectors
        .map(vector => {
            const text =
                `${vector.text} ${
                    vector.metadata?.source || ''
                }`.toLowerCase();

            let matches = 0;

            for (
                const term of terms
            ) {
                if (
                    text.includes(term)
                ) {
                    matches++;
                }
            }

            return {
                vector,
                score:
                    matches /
                    terms.length
            };
        })
        .filter(
            result =>
                result.score > 0
        )
        .sort(
            (a, b) =>
                b.score -
                a.score
        )
        .slice(
            0,
            limit
        );
}

function tokenize(text) {
    return String(text || '')
        .toLowerCase()
        .split(/[^a-z0-9_'-]+/)
        .map(
            term =>
                term.trim()
        )
        .filter(
            term =>
                term.length > 1
        );
}

function cosineSimilarity(
    a,
    b
) {
    if (
        !Array.isArray(a) ||
        !Array.isArray(b) ||
        !a.length ||
        a.length !== b.length
    ) {
        return 0;
    }

    let dot = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (
        let index = 0;
        index < a.length;
        index++
    ) {
        const valueA =
            Number(a[index]);

        const valueB =
            Number(b[index]);

        if (
            !Number.isFinite(valueA) ||
            !Number.isFinite(valueB)
        ) {
            return 0;
        }

        dot +=
            valueA *
            valueB;

        magnitudeA +=
            valueA *
            valueA;

        magnitudeB +=
            valueB *
            valueB;
    }

    if (
        magnitudeA === 0 ||
        magnitudeB === 0
    ) {
        return 0;
    }

    return (
        dot /
        (
            Math.sqrt(
                magnitudeA
            ) *
            Math.sqrt(
                magnitudeB
            )
        )
    );
}


/* ------------------------------------------------------------------
 * CHAT
 * ---------------------------------------------------------------- */

async function sendMessage() {
    if (
        state.isIngesting
    ) {
        return;
    }

    const query =
        dom.chatInput?.value.trim();

    if (!query) {
        return;
    }

    if (!state.apiKey) {
        showStatus(
            'Enter a Gemini API key before sending a query.',
            'error'
        );

        return;
    }

    saveSettings();

    dom.chatInput.value = '';

    appendMessage(
        'user',
        query
    );

    state.chat.push({
        role: 'user',
        text: query
    });

    try {
        showStatus(
            'Searching the archive…',
            'info'
        );

        const results =
            await hybridSearch(
                query
            );

        const context =
            buildContext(
                results
            );

        const prompt =
            buildPrompt(
                query,
                context
            );

        const response =
            await generateContent(
                [
                    {
                        role: 'user',
                        parts: [
                            {
                                text:
                                    prompt
                            }
                        ]
                    }
                ],
                state.apiKey,
                {
                    model:
                        state.model,
                    systemInstruction:
                        state.systemInstruction
                }
            );

        const answer =
            extractText(
                response
            );

        appendMessage(
            'assistant',
            answer
        );

        state.chat.push({
            role: 'assistant',
            text: answer
        });

        await db.putLog(
            toCurrentLog({
                id:
                    crypto.randomUUID(),
                timestamp:
                    new Date().toISOString(),
                message:
                    query
            })
        );

        showStatus(
            `${results.length} archive result${results.length === 1 ? '' : 's'} used.`,
            'success'
        );

        updateDatabaseStatus();
    } catch (error) {
        appendMessage(
            'system',
            error.message
        );

        showStatus(
            error.message,
            'error'
        );
    }
}

function buildContext(
    results
) {
    if (!results.length) {
        return 'No relevant archive material was retrieved.';
    }

    return results
        .map(
            (result, index) => {
                const source =
                    result.vector
                        .metadata?.source ||
                    'Unknown source';

                return [
                    `[SOURCE ${index + 1}]`,
                    `File: ${source}`,
                    `Score: ${result.score.toFixed(4)}`,
                    result.vector.text
                ].join('\n');
            }
        )
        .join('\n\n');
}

function buildPrompt(
    query,
    context
) {
    return [
        'Answer the user query using the archive context below.',
        '',
        'ARCHIVE CONTEXT:',
        context,
        '',
        'USER QUERY:',
        query,
        '',
        'INSTRUCTIONS:',
        '- Ground factual claims in the retrieved context.',
        '- Do not invent archive material.',
        '- If context is insufficient, say what is missing.',
        '- Reason across sources when appropriate.',
        '- Do not expose internal implementation details.'
    ].join('\n');
}

function extractText(
    response
) {
    const candidates =
        response?.candidates;

    if (
        !Array.isArray(candidates) ||
        !candidates.length
    ) {
        throw new Error(
            'Gemini returned no response candidates.'
        );
    }

    const parts =
        candidates[0]?.content?.parts;

    if (
        !Array.isArray(parts)
    ) {
        throw new Error(
            'Gemini returned no response text.'
        );
    }

    const text =
        parts
            .map(
                part =>
                    typeof part.text ===
                    'string'
                        ? part.text
                        : ''
            )
            .join('')
            .trim();

    if (!text) {
        throw new Error(
            'Gemini returned an empty response.'
        );
    }

    return text;
}

function extractEmbedding(
    response
) {
    const values =
        response?.embedding?.values;

    if (
        !Array.isArray(values) ||
        !values.length
    ) {
        throw new Error(
            'Gemini returned no embedding.'
        );
    }

    return values.map(Number);
}


/* ------------------------------------------------------------------
 * GLOSSARY
 * ---------------------------------------------------------------- */

async function importGlossary() {
    if (!dom.glossaryInput) {
        return;
    }

    const file =
        dom.glossaryInput.files?.[0];

    if (!file) {
        return;
    }

    try {
        const text =
            await readFile(
                file
            );

        const parsed =
            JSON.parse(text);

        if (
            !parsed ||
            typeof parsed !== 'object' ||
            Array.isArray(parsed)
        ) {
            throw new Error(
                'Glossary must be a JSON object.'
            );
        }

        state.glossary =
            parsed;

        saveSettings();

        showStatus(
            'Glossary imported.',
            'success'
        );
    } catch (error) {
        showStatus(
            error.message,
            'error'
        );
    } finally {
        dom.glossaryInput.value =
            '';
    }
}


/* ------------------------------------------------------------------
 * ARCHIVE
 * ---------------------------------------------------------------- */

async function exportArchive() {
    try {
        const archive = {
            version: 1,
            exportedAt:
                new Date().toISOString(),
            vectors:
                toCurrentVectors(
                    await db.getVectors()
                ),
            documents:
                await db.getDocuments(),
            logs:
                await db.getLogs()
        };

        downloadJson(
            'mythos-vault-archive.json',
            archive
        );

        showStatus(
            'Archive exported.',
            'success'
        );
    } catch (error) {
        showStatus(
            error.message,
            'error'
        );
    }
}

async function restoreArchive() {
    const file =
        dom.restoreInput?.files?.[0];

    if (!file) {
        return;
    }

    try {
        const text =
            await readFile(
                file
            );

        const archive =
            JSON.parse(text);

        const vectors =
            toCurrentVectors(
                archive?.vectors || []
            );

        const documents =
            Array.isArray(
                archive?.documents
            )
                ? archive.documents
                : [];

        const logs =
            Array.isArray(
                archive?.logs
            )
                ? archive.logs
                : [];

        if (vectors.length) {
            await db.putVectors(
                vectors
            );
        }

        if (documents.length) {
            await db.putDocuments(
                documents
            );
        }

        if (logs.length) {
            await db.putLogs(
                logs
            );
        }

        await entropica.init();

        state.vectors =
            entropica.vectors;

        renderSourceList();
        updateDatabaseStatus();

        showStatus(
            `Archive restored: ${vectors.length} vectors, ${documents.length} documents, ${logs.length} logs.`,
            'success'
        );
    } catch (error) {
        showStatus(
            error.message,
            'error'
        );
    } finally {
        if (dom.restoreInput) {
            dom.restoreInput.value =
                '';
        }
    }
}

async function clearVectors() {
    const confirmed =
        window.confirm(
            'Delete all stored vectors? This cannot be undone.'
        );

    if (!confirmed) {
        return;
    }

    try {
        await entropica.clear();

        renderSourceList();
        updateDatabaseStatus();

        showStatus(
            'Vector store cleared.',
            'success'
        );
    } catch (error) {
        showStatus(
            error.message,
            'error'
        );
    }
}

function downloadJson(
    filename,
    data
) {
    const blob =
        new Blob(
            [
                JSON.stringify(
                    data,
                    null,
                    2
                )
            ],
            {
                type:
                    'application/json'
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const anchor =
        document.createElement(
            'a'
        );

    anchor.href = url;
    anchor.download =
        filename;

    document.body.appendChild(
        anchor
    );

    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(
        url
    );
}


/* ------------------------------------------------------------------
 * UI
 * ---------------------------------------------------------------- */

function renderSelectedFiles() {
    if (!dom.fileList) {
        return;
    }

    dom.fileList.innerHTML =
        '';

    for (
        const file of state.selectedFiles
    ) {
        const item =
            document.createElement(
                'div'
            );

        item.className =
            'file-item';

        item.textContent =
            `${file.name} (${formatBytes(file.size)})`;

        dom.fileList.appendChild(
            item
        );
    }
}

function renderSourceList() {
    if (!dom.sourceList) {
        return;
    }

    const counts =
        new Map();

    for (
        const vector of entropica?.vectors || []
    ) {
        const source =
            vector.metadata?.source ||
            vector.metadata?.filename ||
            'Unknown source';

        counts.set(
            source,
            (
                counts.get(source) ||
                0
            ) + 1
        );
    }

    dom.sourceList.innerHTML =
        '';

    if (!counts.size) {
        const empty =
            document.createElement(
                'div'
            );

        empty.textContent =
            'No sources indexed.';

        dom.sourceList.appendChild(
            empty
        );

        return;
    }

    for (
        const [source, count]
        of counts
    ) {
        const item =
            document.createElement(
                'div'
            );

        item.className =
            'source-item';

        item.textContent =
            `${source} — ${count} vector${count === 1 ? '' : 's'}`;

        dom.sourceList.appendChild(
            item
        );
    }
}

async function updateDatabaseStatus() {
    try {
        const [
            vectors,
            documents,
            logs
        ] =
            await Promise.all([
                db.vectorCount(),
                db.documentCount(),
                db.logCount()
            ]);

        if (dom.vectorCount) {
            dom.vectorCount.textContent =
                vectors;
        }

        if (dom.documentCount) {
            dom.documentCount.textContent =
                documents;
        }

        if (dom.logCount) {
            dom.logCount.textContent =
                logs;
        }

        if (dom.databaseStatus) {
            dom.databaseStatus.textContent =
                `IndexedDB: ${vectors} vectors · ${documents} documents · ${logs} logs`;
        }
    } catch (error) {
        showStatus(
            error.message,
            'error'
        );
    }
}

function renderWelcome() {
    if (
        !dom.chatHistory ||
        dom.chatHistory.children.length
    ) {
        return;
    }

    appendMessage(
        'assistant',
        'Noesis online. The archive is ready.'
    );
}

function appendMessage(
    role,
    text
) {
    if (!dom.chatHistory) {
        return;
    }

    const message =
        document.createElement(
            'div'
        );

    message.className =
        `message message-${role}`;

    const author =
        document.createElement(
            'div'
        );

    author.className =
        'message-author';

    author.textContent =
        role === 'user'
            ? 'YOU'
            : role === 'assistant'
                ? 'NOESIS'
                : 'SYSTEM';

    const body =
        document.createElement(
            'div'
        );

    body.className =
        'message-body';

    body.textContent =
        text;

    message.append(
        author,
        body
    );

    dom.chatHistory.appendChild(
        message
    );

    dom.chatHistory.scrollTop =
        dom.chatHistory.scrollHeight;
}

function togglePanel(
    panel
) {
    panel?.classList.toggle(
        'hidden'
    );
}

function showStatus(
    message,
    type = 'info'
) {
    if (!dom.statusMessage) {
        return;
    }

    dom.statusMessage.textContent =
        message;

    dom.statusMessage.dataset.type =
        type;
}

function formatBytes(
    bytes
) {
    const value =
        Number(bytes);

    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {
        return '0 B';
    }

    const units = [
        'B',
        'KB',
        'MB',
        'GB'
    ];

    const exponent =
        Math.min(
            Math.floor(
                Math.log(value) /
                Math.log(1024)
            ),
            units.length - 1
        );

    return `${(
        value /
        Math.pow(
            1024,
            exponent
        )
    ).toFixed(
        exponent === 0 ? 0 : 1
    )} ${units[exponent]}`;
}


/* ------------------------------------------------------------------
 * STARTUP
 * ---------------------------------------------------------------- */

if (
    document.readyState ===
    'loading'
) {
    document.addEventListener(
        'DOMContentLoaded',
        initialize,
        {
            once: true
        }
    );
} else {
    initialize();
}
```
