import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const registeredHandlers = new Map<string, { handler: (request: any) => Promise<any> }>();

  const appHttpMock = vi.fn((name: string, config: { handler: (request: any) => Promise<any> }) => {
    registeredHandlers.set(name, config);
  });

  const openAICreateMock = vi.fn();
  const tableCreateEntityMock = vi.fn();
  const tableGetEntityMock = vi.fn();
  const tableUpdateEntityMock = vi.fn();
  const tableListEntitiesMock = vi.fn();
  const tableCreateTableMock = vi.fn();
  const blobUploadMock = vi.fn();

  return {
    registeredHandlers,
    appHttpMock,
    openAICreateMock,
    tableCreateEntityMock,
    tableGetEntityMock,
    tableUpdateEntityMock,
    tableListEntitiesMock,
    tableCreateTableMock,
    blobUploadMock,
  };
});

vi.mock('@azure/functions', () => ({
  app: {
    http: mocks.appHttpMock,
  },
}));

vi.mock('openai', () => ({
  AzureOpenAI: class {
    chat = {
      completions: {
        create: mocks.openAICreateMock,
      },
    };
  },
}));

vi.mock('@azure/data-tables', () => ({
  TableServiceClient: {
    fromConnectionString: vi.fn(() => ({
      createTable: mocks.tableCreateTableMock,
    })),
  },
  TableClient: {
    fromConnectionString: vi.fn(() => ({
      createEntity: mocks.tableCreateEntityMock,
      getEntity: mocks.tableGetEntityMock,
      updateEntity: mocks.tableUpdateEntityMock,
      listEntities: mocks.tableListEntitiesMock,
    })),
  },
}));

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: vi.fn(() => ({
      getContainerClient: vi.fn(() => ({
        getBlockBlobClient: vi.fn((blobName: string) => ({
          upload: mocks.blobUploadMock,
          url: `https://example.blob.core.windows.net/uploads/${blobName}`,
        })),
      })),
    })),
  },
}));

function getHandler(name: string) {
  const config = mocks.registeredHandlers.get(name);
  if (!config) {
    throw new Error(`Handler ${name} was not registered`);
  }
  return config.handler;
}

beforeAll(async () => {
  await import('../api/src/functions/standards');
  await import('../api/src/functions/analyze');
  await import('../api/src/functions/calculate');
  await import('../api/src/functions/generateDescription');
  await import('../api/src/functions/proposePlacements');
  await import('../api/src/functions/upload');
  await import('../api/src/functions/feedback');
  await import('../api/src/functions/logLogin');
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.openAICreateMock.mockReset();
  mocks.tableListEntitiesMock.mockReset();
});

describe('standards endpoint', () => {
  it('returns countries list when country is missing', async () => {
    const response = await getHandler('standards')({ params: {} });

    expect(response.status).toBe(200);
    expect(response.jsonBody.countries.length).toBeGreaterThanOrEqual(3);
  });

  it('returns 404 for unknown country code', async () => {
    const response = await getHandler('standards')({ params: { country: 'xx' } });

    expect(response.status).toBe(404);
    expect(response.jsonBody.error).toContain('XX');
  });
});

describe('analyze endpoint', () => {
  it('returns 400 when imageUrl is missing', async () => {
    const response = await getHandler('analyze')({
      json: async () => ({ propertyType: 'apartment' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 400 when imageUrl format is invalid', async () => {
    const response = await getHandler('analyze')({
      json: async () => ({ imageUrl: 'ftp://bad-url' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 200 with parsed JSON on success', async () => {
    mocks.openAICreateMock.mockResolvedValue({
      choices: [{ message: { content: '{"rooms":[{"id":"room_1"}],"switchboard":{}}' } }],
    });

    const response = await getHandler('analyze')({
      json: async () => ({ imageUrl: 'https://example.com/plan.png', propertyType: 'house' }),
    });

    expect(response.status).toBe(200);
    expect(response.jsonBody.rooms).toHaveLength(1);
  });
});

describe('calculate endpoint', () => {
  it('returns 400 for missing required fields', async () => {
    const response = await getHandler('calculate')({
      json: async () => ({ rooms: [] }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 500 when AI response has no JSON', async () => {
    mocks.openAICreateMock.mockResolvedValue({ choices: [{ message: { content: 'not json' } }] });

    const response = await getHandler('calculate')({
      json: async () => ({ rooms: [{ id: 'room_1' }], countryCode: 'LV', standards: {} }),
    });

    expect(response.status).toBe(500);
  });

  it('returns 200 when AI returns valid JSON', async () => {
    mocks.openAICreateMock.mockResolvedValue({
      choices: [{ message: { content: '{"placements":[],"circuits":[],"wiring":[]}' } }],
    });

    const response = await getHandler('calculate')({
      json: async () => ({ rooms: [{ id: 'room_1' }], countryCode: 'LV', standards: {}, propertyType: 'apartment' }),
    });

    expect(response.status).toBe(200);
    expect(response.jsonBody.placements).toEqual([]);
  });
});

describe('proposePlacements endpoint', () => {
  it('returns 400 for missing required fields', async () => {
    const response = await getHandler('proposePlacements')({
      json: async () => ({ rooms: [] }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 200 on valid JSON response', async () => {
    mocks.openAICreateMock.mockResolvedValue({
      choices: [{ message: { content: '{"switchboard":{},"placements":[]}' } }],
    });

    const response = await getHandler('proposePlacements')({
      json: async () => ({ rooms: [{ id: 'room_1' }], countryCode: 'EE', standards: {}, switchboard: {} }),
    });

    expect(response.status).toBe(200);
    expect(response.jsonBody.placements).toEqual([]);
  });
});

describe('generate-description endpoint', () => {
  it('returns generated English and local descriptions', async () => {
    mocks.openAICreateMock
      .mockResolvedValueOnce({ choices: [{ message: { content: '# English' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: '# Latvian' } }] });

    const response = await getHandler('generate-description')({
      json: async () => ({
        countryCode: 'LV',
        propertyType: 'apartment',
        rooms: [{ id: 'r1', position: {}, features: [] }],
        placements: { placements: [], circuits: [], wiring: [] },
      }),
    });

    expect(response.status).toBe(200);
    expect(response.jsonBody.description_en).toBe('# English');
    expect(response.jsonBody.description_local).toBe('# Latvian');
    expect(mocks.openAICreateMock).toHaveBeenCalledTimes(2);
  });
});

describe('upload endpoint', () => {
  it('returns 400 when file is missing', async () => {
    const response = await getHandler('upload')({
      formData: async () => ({ get: () => null }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 400 for unsupported file type', async () => {
    const response = await getHandler('upload')({
      formData: async () => ({
        get: () => ({ type: 'text/plain', size: 20, name: 'a.txt', arrayBuffer: async () => new ArrayBuffer(0) }),
      }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 200 for valid PNG file', async () => {
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    const response = await getHandler('upload')({
      formData: async () => ({
        get: () => ({
          type: 'image/png',
          size: pngBytes.byteLength,
          name: 'floorplan.png',
          arrayBuffer: async () => pngBytes.buffer,
        }),
      }),
    });

    expect(response.status).toBe(200);
    expect(response.jsonBody.blobName).toMatch(/\.png$/);
    expect(mocks.blobUploadMock).toHaveBeenCalledOnce();
  });
});

describe('feedback endpoints', () => {
  it('returns 400 for submit without title', async () => {
    const response = await getHandler('feedbackSubmit')({
      json: async () => ({ description: 'desc', type: 'bug' }),
    });

    expect(response.status).toBe(400);
  });

  it('creates feedback and returns 201', async () => {
    const response = await getHandler('feedbackSubmit')({
      json: async () => ({ title: 'Need feature', description: 'Please add X', type: 'unknown' }),
    });

    expect(response.status).toBe(201);
    expect(mocks.tableCreateEntityMock).toHaveBeenCalledOnce();
  });

  it('lists feedback entries', async () => {
    mocks.tableListEntitiesMock.mockReturnValue(
      (async function* () {
        yield {
          rowKey: '2',
          type: 'bug',
          title: 'Newer',
          description: 'B',
          page: '/',
          status: 'open',
          createdAt: '2026-01-02T00:00:00.000Z',
        };
        yield {
          rowKey: '1',
          type: 'bug',
          title: 'Older',
          description: 'A',
          page: '/',
          status: 'open',
          createdAt: '2026-01-01T00:00:00.000Z',
        };
      })(),
    );

    const response = await getHandler('feedbackList')({
      query: new URL('https://example.test').searchParams,
    });

    expect(response.status).toBe(200);
    expect(response.jsonBody.items[0].title).toBe('Newer');
    expect(response.jsonBody.count).toBe(2);
  });

  it('returns 404 when updating missing feedback item', async () => {
    mocks.tableGetEntityMock.mockRejectedValueOnce({ statusCode: 404 });

    const response = await getHandler('feedbackUpdate')({
      params: { id: 'missing' },
      json: async () => ({ status: 'done' }),
    });

    expect(response.status).toBe(404);
  });

  it('updates feedback status', async () => {
    mocks.tableGetEntityMock.mockResolvedValueOnce({});

    const response = await getHandler('feedbackUpdate')({
      params: { id: 'abc' },
      json: async () => ({ status: 'in-progress' }),
    });

    expect(response.status).toBe(200);
    expect(mocks.tableUpdateEntityMock).toHaveBeenCalledOnce();
  });
});

describe('log-login endpoint', () => {
  it('returns 401 when auth header is missing', async () => {
    const response = await getHandler('logLogin')({
      headers: new Headers(),
    });

    expect(response.status).toBe(401);
  });

  it('logs login and returns success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const principal = Buffer.from(
      JSON.stringify({ userDetails: 'user@example.com', identityProvider: 'google', userId: '123' }),
    ).toString('base64');

    const headers = new Headers();
    headers.set('x-ms-client-principal', principal);

    const response = await getHandler('logLogin')({ headers });

    expect(response.status).toBe(200);
    expect(response.jsonBody.logged).toBe(true);
    expect(mocks.tableCreateEntityMock).toHaveBeenCalledOnce();
  });
});
