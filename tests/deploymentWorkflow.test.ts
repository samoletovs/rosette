import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/azure-static-web-apps-nice-water-04d37a403.yml', import.meta.url),
  'utf8',
);

describe('deployment concurrency contract', () => {
  it('gives PR preview cleanup a different group from a production push', () => {
    expect(workflow.match(/^\s*group:\s*(.+)$/m)?.[1]).toBe(
      '${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}',
    );
  });

  it('does not let production or closed-PR events cancel an existing deployment', () => {
    expect(workflow.match(/^\s*cancel-in-progress:\s*(.+)$/m)?.[1]).toBe(
      "${{ github.event_name == 'pull_request' && github.event.action != 'closed' }}",
    );
  });
});
