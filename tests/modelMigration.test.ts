import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Request {
  json: () => Promise<unknown>;
}

interface Response {
  status?: number;
  jsonBody?: unknown;
}

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, { handler: (request: Request) => Promise<Response> }>(),
  create: vi.fn(),
  constructor: vi.fn(),
}));

vi.mock('@azure/functions', () => ({
  app: {
    http: (name: string, config: { handler: (request: Request) => Promise<Response> }) => {
      mocks.handlers.set(name, config);
    },
  },
}));

vi.mock('openai', () => ({
  AzureOpenAI: class {
    constructor(options: unknown) {
      mocks.constructor(options);
    }
    chat = { completions: { create: mocks.create } };
  },
}));

const scenarios = [
  { configured: undefined, resolved: 'gpt-6-luna' },
  { configured: '', resolved: 'gpt-6-luna' },
  { configured: 'gpt-6-luna', resolved: 'gpt-6-luna' },
  // Existing app settings must remain usable between deployment and the model flip.
  { configured: 'gpt-4o', resolved: 'gpt-4o' },
  { configured: 'gpt-4o-mini', resolved: 'gpt-4o-mini' },
  { configured: 'gpt-4.1', resolved: 'gpt-4.1' },
  { configured: 'gpt-6-luna-custom', resolved: 'gpt-6-luna-custom' },
];

const endpoints = [
  {
    name: 'analyze',
    body: { imageUrl: 'https://example.com/plan.png', propertyType: 'apartment' },
    replies: ['{"rooms":[{"id":"r1"}],"switchboard":{}}'],
    expectedResponse: { rooms: [{ id: 'r1' }], switchboard: {} },
    calls: [{ ceiling: 4000, temperature: 0.1, json: false }],
  },
  {
    name: 'calculate',
    body: { rooms: [{ id: 'r1' }], countryCode: 'LV', standards: {} },
    replies: ['{"placements":[],"circuits":[],"wiring":[]}'],
    expectedResponse: { placements: [], circuits: [], wiring: [] },
    calls: [{ ceiling: 8000, temperature: 0.2, json: true }],
  },
  {
    name: 'proposePlacements',
    body: { rooms: [{ id: 'r1' }], countryCode: 'LV', standards: {}, switchboard: {} },
    replies: ['{"placements":[],"switchboard":{}}'],
    expectedResponse: { placements: [], switchboard: {} },
    calls: [{ ceiling: 6000, temperature: 0.2, json: true }],
  },
  {
    name: 'generate-description',
    body: { rooms: [], countryCode: 'LV', propertyType: 'apartment', placements: {} },
    replies: ['# Title', '## 2. Rooms', '## 3. Circuits', '## 6. Materials'],
    expectedResponse: {
      description_en: '# Title\n\n## 2. Rooms\n\n## 3. Circuits\n\n## 6. Materials',
      language: { name: 'Latvian', code: 'lv' },
    },
    calls: [1000, 600, 1000, 2500].map((ceiling) => ({ ceiling, temperature: 0.15, json: false })),
  },
  {
    name: 'translate-description',
    body: { description_en: '# English specification', countryCode: 'LV' },
    replies: ['# Latvian specification'],
    expectedResponse: {
      description_local: '# Latvian specification',
      language: { name: 'Latvian', code: 'lv' },
    },
    calls: [{ ceiling: 800, temperature: 0.1, json: false }],
  },
];

beforeEach(() => {
  vi.resetModules();
  mocks.handlers.clear();
  mocks.create.mockReset();
  mocks.constructor.mockReset();
  vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://example.openai.azure.com');
  vi.stubEnv('AZURE_OPENAI_KEY', 'unit-test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(scenarios)('model request contract: $configured -> $resolved', ({ configured, resolved }) => {
  it.each(endpoints)('$name preserves the endpoint contract with retirement-safe options', async (endpoint) => {
    vi.stubEnv('AZURE_OPENAI_DEPLOYMENT', configured);
    await import('../api/src/functions/analyze');
    await import('../api/src/functions/calculate');
    await import('../api/src/functions/proposePlacements');
    await import('../api/src/functions/generateDescription');
    await import('../api/src/functions/translateDescription');

    for (const content of endpoint.replies) {
      mocks.create.mockResolvedValueOnce({ choices: [{ message: { content } }] });
    }
    const config = mocks.handlers.get(endpoint.name);
    if (!config) throw new Error(`Handler not registered: ${endpoint.name}`);
    const response = await config.handler({ json: async () => endpoint.body });

    expect(response).toEqual({ status: 200, jsonBody: endpoint.expectedResponse });
    expect(mocks.constructor).toHaveBeenCalledExactlyOnceWith({
      endpoint: 'https://example.openai.azure.com',
      apiKey: 'unit-test-key',
      apiVersion: '2024-10-21',
      deployment: resolved,
    });
    expect(mocks.create).toHaveBeenCalledTimes(endpoint.calls.length);
    endpoint.calls.forEach(({ ceiling, temperature, json }, index) => {
      const request = mocks.create.mock.calls[index][0];
      expect(request).toEqual({
        model: resolved,
        messages: expect.any(Array),
        max_completion_tokens: ceiling,
        temperature,
        ...(resolved === 'gpt-6-luna' ? { reasoning_effort: 'none' } : {}),
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      });
      expect(request).not.toHaveProperty('max_tokens');
      if (endpoint.name === 'analyze') {
        expect(request.messages[1].content[0]).toEqual({
          type: 'image_url',
          image_url: { url: 'https://example.com/plan.png', detail: 'high' },
        });
      }
      if (endpoint.name === 'translate-description') {
        expect(request.messages[1].content).toContain('# English specification');
      }
    });
  });
});

it('configures new environments to use the non-retiring deployment', () => {
  const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  expect(example).toMatch(/^AZURE_OPENAI_DEPLOYMENT=gpt-6-luna$/m);
});
