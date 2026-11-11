import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_ROOMS_PER_ROOM_BATCH,
  MAX_SOCKETS_PER_ROOM_BATCH,
  buildSpecPrompt,
  countryInfo,
  generateSpecification,
  planSpecificationParts,
  splitForTranslation,
  translateSpecification,
} from '../api/src/utils/specification';
import { generateDescription } from '../src/api';

type Reply = { choices: { message: { content: string }; finish_reason?: string }[] };

// Shaped like the calculate endpoint's response, after generate-description cleans it.
function plan(socketsPerRoom: number[]) {
  const walls = ['north', 'east', 'south', 'west'];
  const rooms = socketsPerRoom.map((count, i) => ({
    id: `r${i + 1}`, type: 'bedroom', name: `Room ${i + 1}`, area_m2: 12.5, width_m: 4, height_m: 3.1,
    position: { x_pct: (i % 3) * 33, y_pct: Math.floor(i / 3) * 50, w_pct: 33, h_pct: 50 },
    features: 'window, door to hallway', requested_sockets: count,
  }));
  let n = 0;
  const placements = socketsPerRoom.flatMap((count, i) =>
    Array.from({ length: count }, (_, j) => ({
      socket_id: `S${++n}`, room_id: `r${i + 1}`, room_name: `Room ${i + 1}`, x_pct: 10 + j, y_pct: 20 + j,
      wall: walls[j % 4], height_mm: 300, type: 'standard_16a', gang: 1 + (j % 2), circuit: `C${i + 1}`, notes: '',
    })),
  );
  const circuits = rooms.map((room, i) => ({
    id: `C${i + 1}`, type: 'standard', breaker: '16A MCB', cable: '3x2.5mm²', rcd: '30mA', rcd_group: `rcd_${1 + Math.floor(i / 3)}`,
    sockets: placements.filter((p) => p.room_id === room.id).map((p) => p.socket_id),
  }));
  const wiring = rooms.map((room, i) => ({
    circuit_id: `C${i + 1}`, cable_type: 'NYM-J 3×2.5mm²', from: 'switchboard', to_room: room.name, to_room_id: room.id,
    wire_count: 3, wire_colors: ['Brown (L)', 'Blue (N)', 'Green-Yellow (PE)'], estimated_length_m: 8 + 3 * i,
    max_length_m: 27, passes_through: ['Hallway'], notes: '',
  }));
  return { rooms, placements: { placements, circuits, wiring, total_sockets: n, total_circuits: circuits.length, total_cable_m: 120 } };
}

type Request = { messages: { content: string }[]; max_completion_tokens: number };

function deferredClient() {
  const pending: { resolve: (reply: Reply) => void; request: Request }[] = [];
  const create = vi.fn(
    (request: Request) => new Promise<Reply>((resolve) => pending.push({ resolve, request })),
  );
  const client = { chat: { completions: { create } } } as never;
  return { client, create, pending };
}

function answeringClient(answer: (request: Request) => string) {
  const requests: Request[] = [];
  const create = vi.fn(async (request: Request) => {
    requests.push(request);
    return reply(answer(request));
  });
  return { client: { chat: { completions: { create } } } as never, requests };
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

  it('also caps rooms per batch, so a plan of socket-less rooms cannot outgrow a part', () => {
    const { rooms, placements } = plan(Array.from({ length: 10 }, () => 0));
    const roomParts = planSpecificationParts(rooms, placements).slice(1, -2);

    expect(roomParts.map((p) => p.rooms.length)).toEqual([MAX_ROOMS_PER_ROOM_BATCH, 10 - MAX_ROOMS_PER_ROOM_BATCH]);
  });

  it('sends socket and room geometry only to the room sections, as compact JSON', async () => {
    const { rooms, placements } = plan([8, 7, 5]);
    const { client, requests } = answeringClient(() => 'part');
    await generateSpecification(client, 'gpt-6-luna', 'PROMPT', rooms, placements);

    const scopes = planSpecificationParts(rooms, placements).map((p) => p.scope);
    expect(requests).toHaveLength(scopes.length);
    requests.forEach((request, i) => {
      const data = request.messages[1].content;
      const roomSection = scopes[i].includes('room subsection');
      expect(data.includes('"x_pct"'), scopes[i]).toBe(roomSection);
      expect(data.includes('"position"'), scopes[i]).toBe(roomSection);
      expect(data.includes('"wiring"'), scopes[i]).toBe(!roomSection);
      expect(data).not.toMatch(/\n +"/);
    });
  });

  it('keeps one copy of a section heading that a later part restates', async () => {
    const { rooms, placements } = plan([8, 7]);
    const { client } = answeringClient((request) => {
      const part = Number(request.messages[1].content.match(/Generate part (\d+)/)?.[1]);
      const body: Record<number, string> = {
        1: '# Electrical Installation Specification\n\n## 1. Project Overview\nTwo rooms.',
        2: '## 2. Room-by-Room Specification\n\n### 2.1. Room 1\n#### Kitchen detail',
        3: '## 2. Room-by-Room Specification\n\n### 2.2. Room 2',
        4: '## 3. Circuit Schedule',
        5: '## 6. Material List',
      };
      return body[part];
    });

    const spec = await generateSpecification(client, 'gpt-6-luna', 'PROMPT', rooms, placements);

    expect(spec.match(/^## 2\. /gm)).toHaveLength(1);
    expect(spec).toContain('### 2.1. Room 1\n#### Kitchen detail');
    expect(spec).toContain('### 2.2. Room 2');
    expect(spec.indexOf('## 2.')).toBeLessThan(spec.indexOf('### 2.2.'));
  });

  it("reserves at most 60k of gpt-6-luna's 150k tokens per minute for one description", async () => {
    // Azure counts each request's prompt (about 4 characters a token) plus its
    // token ceiling against the quota as the request arrives. Two people working
    // at once, plus the calculate step, must fit; the flat 4,000-token ceilings
    // with pretty-printed data reserved about 72k.
    const { rooms, placements } = plan([8, 7, 5, 5, 2, 2]);
    const generation = answeringClient(() => 'part');
    await generateSpecification(generation.client, 'gpt-6-luna', buildSpecPrompt('LV', countryInfo('LV'), 'apartment'), rooms, placements);
    const english = Array.from({ length: 8 }, (_, s) =>
      [`## ${s + 1}. Section`, ...Array.from({ length: 24 }, (_, r) => `| ${r + 1} | S${r + 1} | North wall, left section | 300mm | Standard 16A | Single | C1 |`)].join('\n'),
    ).join('\n\n');
    const translation = answeringClient(() => 'translated');
    await translateSpecification(translation.client, 'gpt-6-luna', english, 'Latvian');

    const requests = [...generation.requests, ...translation.requests];
    const reserved = requests.reduce(
      (sum, r) => sum + Math.ceil(r.messages.reduce((chars, m) => chars + m.content.length, 0) / 4) + r.max_completion_tokens,
      0,
    );
    expect(english.length).toBeGreaterThan(14000);
    expect(reserved).toBeLessThan(60000);
    // Headroom: Latvian measured about 0.5 output tokens per English character.
    for (const request of translation.requests) {
      const chunk = request.messages[1].content.split('Keep every detail:\n\n')[1];
      expect(request.max_completion_tokens).toBeGreaterThanOrEqual(Math.min(4000, chunk.length * 0.75));
    }
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
