import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_SOCKETS_PER_ROOM_BATCH,
  generateSpecification,
  planSpecificationParts,
  splitForTranslation,
  translateSpecification,
} from '../api/src/utils/specification';
import { generateDescription } from '../src/api';

type Reply = { choices: { message: { content: string }; finish_reason?: string }[] };

function plan(socketsPerRoom: number[]) {
  const rooms = socketsPerRoom.map((_, i) => ({ id: `r${i + 1}`, name: `Room ${i + 1}` }));
  let n = 0;
  const placements = socketsPerRoom.flatMap((count, i) =>
    Array.from({ length: count }, () => ({ socket_id: `S${++n}`, room_id: `r${i + 1}` })),
  );
  return { rooms, placements: { placements, circuits: [], wiring: [] } };
}

function deferredClient() {
  const pending: { resolve: (reply: Reply) => void; request: { messages: { content: string }[] } }[] = [];
  const create = vi.fn(
    (request: { messages: { content: string }[] }) =>
      new Promise<Reply>((resolve) => pending.push({ resolve, request })),
  );
  const client = { chat: { completions: { create } } } as never;
  return { client, create, pending };
}

const reply = (content: string, finish_reason = 'stop'): Reply => ({ choices: [{ message: { content }, finish_reason }] });

describe('specification parts', () => {
  it('batches rooms by socket count so section 2 scales with the plan, covering every socket once', () => {
    const { rooms, placements } = plan([8, 7, 5, 5, 2, 2, 15]);
    const parts = planSpecificationParts(rooms, placements);
    const roomParts = parts.slice(1, -2);

    expect(roomParts.map((p) => p.rooms.map((r) => r.id))).toEqual([['r1'], ['r2', 'r3'], ['r4', 'r5', 'r6'], ['r7']]);
    expect(roomParts.map((p) => p.scope.match(/2\.\d+( to 2\.\d+)?/)?.[0])).toEqual(['2.1', '2.2 to 2.3', '2.4 to 2.6', '2.7']);
    expect(roomParts[0].scope).toContain('## 2. Room-by-Room Specification');
    expect(roomParts[1].scope).not.toContain('## 2.');
    for (const part of roomParts) {
      const ids = new Set(part.rooms.map((r) => r.id));
      expect(part.placements.placements.every((p) => ids.has(p.room_id))).toBe(true);
      const sockets = part.placements.placements.length;
      expect(sockets <= MAX_SOCKETS_PER_ROOM_BATCH || part.rooms.length === 1).toBe(true);
    }
    expect(roomParts.flatMap((p) => p.placements.placements.map((s) => s.socket_id))).toEqual(
      placements.placements.map((s) => s.socket_id),
    );
  });

  it('requests every part before any answers, and assembles them in document order', async () => {
    const { rooms, placements } = plan([8, 7, 5]);
    const { client, create, pending } = deferredClient();
    const result = generateSpecification(client, 'gpt-6-luna', 'PROMPT', rooms, placements);

    await Promise.resolve();
    const expected = planSpecificationParts(rooms, placements).length;
    expect(create).toHaveBeenCalledTimes(expected);
    [...pending].reverse().forEach((call, i) => call.resolve(reply(`part ${pending.length - i}`)));

    expect(await result).toBe(Array.from({ length: expected }, (_, i) => `part ${i + 1}`).join('\n\n'));
  });

  it.each([
    ['empty', reply('  ')],
    ['cut off at the token limit', reply('## 2.1 Kitchen | S1 |', 'length')],
  ])('fails instead of returning a specification with a part that came back %s', async (_, bad) => {
    const { rooms, placements } = plan([3]);
    const { client, pending } = deferredClient();
    const result = generateSpecification(client, 'gpt-6-luna', 'PROMPT', rooms, placements);
    await Promise.resolve();
    pending.forEach((call, i) => call.resolve(i === 1 ? bad : reply(`part ${i + 1}`)));

    await expect(result).rejects.toThrow(/Specification part 2 of 4/);
  });
});

describe('translation chunks', () => {
  const table = ['| # | ID |', '|---|---|', ...Array.from({ length: 60 }, (_, i) => `| ${i + 1} | S${i + 1} |`)].join('\n');
  const doc = [
    '# Electrical Installation Specification',
    '**Property type:** apartment',
    '---',
    '## 1. Project Overview',
    'Six rooms.',
    '## 2. Room-by-Room Specification',
    '### 2.1. Kitchen',
    table,
    '### 2.2. Living room',
    'Two sockets.',
    '## 3. Circuit Schedule',
    '#### Note that stays with its section',
    'Text.',
  ].join('\n');

  it('splits only at headings, keeps tables whole and loses nothing', () => {
    const chunks = splitForTranslation(doc, 400);

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.join('\n')).toBe(doc);
    expect(chunks.slice(1).every((c) => /^#{1,3} /.test(c))).toBe(true);
    expect(chunks.filter((c) => c.includes('| 1 | S1 |'))[0]).toContain('| 60 | S60 |');
    expect(chunks.find((c) => c.includes('## 3. Circuit Schedule'))).toContain('#### Note that stays with its section');
    for (const chunk of chunks) expect(chunk.length <= 400 || !/\n#{1,3} /.test(chunk)).toBe(true);
  });

  it('translates every chunk in parallel and keeps their order', async () => {
    const { client, create, pending } = deferredClient();
    const english = ['## 1. A', 'a'.repeat(2000), '## 2. B', 'b'.repeat(2000), '## 3. C', 'c'.repeat(2000)].join('\n');
    const result = translateSpecification(client, 'gpt-6-luna', english, 'Latvian');

    await Promise.resolve();
    expect(create).toHaveBeenCalledTimes(3);
    [...pending].reverse().forEach((call) => call.resolve(reply(`LV ${call.request.messages[1].content.split('\n')[2]}`)));

    expect(await result).toBe('LV ## 1. A\n\nLV ## 2. B\n\nLV ## 3. C');
  });
});

describe('client generateDescription', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetches the English specification, then its translation, and merges both', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      const body = url.endsWith('/generate-description')
        ? { description_en: '# EN', language: { name: 'Latvian', code: 'lv' } }
        : { description_local: '# LV', language: { name: 'Latvian', code: 'lv' } };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateDescription([], { placements: [] } as never, 'LV', 'apartment');

    expect(fetchMock.mock.calls.map(([url]) => String(url).split('/').pop())).toEqual([
      'generate-description',
      'translate-description',
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ description_en: '# EN', countryCode: 'LV' });
    expect(result).toEqual({ description_en: '# EN', description_local: '# LV', language: { name: 'Latvian', code: 'lv' } });
  });
});
