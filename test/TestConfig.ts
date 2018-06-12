import { assert } from './helpers/assert';
import { mockConfig } from './helpers/mockConfig';

describe('Config', () => {
  it('creates a config from standard params', () => {
    const config = mockConfig();
    assert(config);
  }).timeout(10000);
})
