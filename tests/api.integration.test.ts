import { describe, expect, it } from 'vitest';
import { httpHandlers } from './mocks/azure-functions';

import '../api/src/functions/analyze';
import '../api/src/functions/calculate';
import '../api/src/functions/proposePlacements';
import '../api/src/functions/standards';
import '../api/src/functions/upload';

const handler = (name: string) => {
  const endpoint = httpHandlers.get(name);
  if (!endpoint) throw new Error(`Endpoint not registered: ${name}`);
  return endpoint;
};

describe('API endpoints', () => {
  it('registers critical endpoints', () => {
    expect([...httpHandlers.keys()]).toEqual(
      expect.arrayContaining(['analyze', 'calculate', 'proposePlacements', 'standards', 'upload'])
    );
  });

  it('returns all countries and an individual country standard', async () => {
    const standards = handler('standards');

    const countries = await standards({ params: {} });
    expect(countries).toMatchObject({
      status: 200,
      jsonBody: { countries: expect.arrayContaining([expect.objectContaining({ code: 'LV' })]) },
    });

    const latvia = await standards({ params: { country: 'lv' } });
    expect(latvia).toMatchObject({ status: 200, jsonBody: { country_code: 'LV' } });
  });

  it('rejects an unsupported country standard', async () => {
    const response = await handler('standards')({ params: { country: 'XX' } });
    expect(response).toEqual({ status: 404, jsonBody: { error: 'Standards not found for: XX' } });
  });

  it.each([
    ['analyze', { propertyType: 'apartment' }, 'imageUrl is required'],
    ['calculate', { countryCode: 'LV' }, 'rooms and countryCode required'],
    ['proposePlacements', { countryCode: 'LV' }, 'rooms and countryCode required'],
  ])('validates required input for %s', async (endpoint, body, error) => {
    const response = await handler(endpoint)({ json: async () => body });
    expect(response).toEqual({ status: 400, jsonBody: { error } });
  });

  it('rejects a disallowed upload type before accessing storage', async () => {
    const response = await handler('upload')({
      formData: async () => ({
        get: () => ({ type: 'text/plain', size: 1, name: 'floorplan.txt' }),
      }),
    });

    expect(response).toEqual({
      status: 400,
      jsonBody: { error: 'File type not supported. Use PNG, JPEG, WebP, or PDF.' },
    });
  });
});
