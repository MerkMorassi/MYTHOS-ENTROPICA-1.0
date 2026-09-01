/*
 * GEMINI API
 *
 * Single network boundary for Gemini requests.
 *
 * Application code should not call fetch() against Gemini directly.
 */

const GEMINI_API_BASE =
    'https://generativelanguage.googleapis.com/v1beta/models';

const GEMINI_API_ROOT =
    'https://generativelanguage.googleapis.com/v1beta';

export const DEFAULT_MODEL =
    'gemini-3.7-flash';

export const EMBEDDING_MODEL =
    'gemini-embedding-001';


// ================================================================
// CORE REQUEST
// ================================================================

async function request(
    url,
    apiKey,
    options = {}
) {
    if (!apiKey) {
        throw new Error(
            'Gemini API key is required.'
        );
    }

    const response =
        await fetch(
            `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`,
            {
                method:
                    options.method || 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body:
                    options.body
                        ? JSON.stringify(
                            options.body
                        )
                        : undefined,

                signal:
                    options.signal
            }
        );

    const data =
        await response.json();

    if (!response.ok) {
        const message =
            data?.error?.message ||
            `Gemini API request failed (${response.status}).`;

        throw new Error(message);
    }

    return data;
}


// ================================================================
// GENERATION
// ================================================================

export async function generateContent(
    contents,
    apiKey,
    options = {}
) {
    const model =
        options.model ||
        DEFAULT_MODEL;

    const body = {
        contents
    };

    if (
        options.generationConfig
    ) {
        body.generationConfig =
            options.generationConfig;
    }

    if (
        options.systemInstruction
    ) {
        body.systemInstruction = {
            parts: [
                {
                    text:
                        options.systemInstruction
                }
            ]
        };
    }

    return request(
        `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`,
        apiKey,
        {
            method: 'POST',
            body,
            signal: options.signal
        }
    );
}


// ================================================================
// EMBEDDINGS
// ================================================================

export async function embedContent(
    text,
    apiKey,
    options = {}
) {
    if (
        typeof text !== 'string' ||
        !text.trim()
    ) {
        throw new Error(
            'Text is required for embedding.'
        );
    }

    const model =
        options.model ||
        EMBEDDING_MODEL;

    return request(
        `${GEMINI_API_BASE}/${encodeURIComponent(model)}:embedContent`,
        apiKey,
        {
            method: 'POST',

            body: {
                content: {
                    parts: [
                        {
                            text
                        }
                    ]
                }
            },

            signal: options.signal
        }
    );
}


// ================================================================
// MODEL DISCOVERY
// ================================================================

export async function listModels(
    apiKey,
    options = {}
) {
    return fetchModelsPage(
        apiKey,
        options
    );
}


async function fetchModelsPage(
    apiKey,
    options = {}
) {
    const params =
        new URLSearchParams();

    if (options.pageSize) {
        params.set(
            'pageSize',
            String(options.pageSize)
        );
    }

    if (options.pageToken) {
        params.set(
            'pageToken',
            options.pageToken
        );
    }

    const query =
        params.toString();

    const url =
        `${GEMINI_API_ROOT}/models${query ? `?${query}` : ''}`;

    const data =
        await request(
            url,
            apiKey,
            {
                method: 'GET',
                signal: options.signal
            }
        );

    const models =
        Array.isArray(data.models)
            ? data.models
            : [];

    if (
        !data.nextPageToken
    ) {
        return models;
    }

    const remaining =
        await fetchModelsPage(
            apiKey,
            {
                ...options,
                pageToken:
                    data.nextPageToken
            }
        );

    return [
        ...models,
        ...remaining
    ];
}


// ================================================================
// LOW-LEVEL COMPATIBILITY API
// ================================================================
//
// Kept intentionally small. Existing application code that needs
// an operation-oriented API can use apiCall(), while new code
// should prefer the explicit functions above.
//

export async function apiCall(
    operation,
    payload,
    apiKey,
    model = DEFAULT_MODEL
) {
    switch (operation) {

        case 'generate':
            return generateContent(
                payload.contents,
                apiKey,
                {
                    model,
                    generationConfig:
                        payload.generationConfig,
                    systemInstruction:
                        payload.systemInstruction,
                    signal:
                        payload.signal
                }
            );

        case 'embed':
            return embedContent(
                payload.text,
                apiKey,
                {
                    model:
                        payload.model ||
                        EMBEDDING_MODEL,
                    signal:
                        payload.signal
                }
            );

        case 'models':
            return listModels(
                apiKey,
                {
                    signal:
                        payload?.signal
                }
            );

        default:
            throw new Error(
                `Unsupported Gemini operation: ${operation}`
            );
    }
}