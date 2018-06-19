import { expect } from 'chai';
import { mockConfig } from './helpers/mockConfig';

describe('Config', () => {
  it('creates a config from standard params', () => {
    const config = mockConfig();
    expect(config).to.exist;
  }).timeout(10000);
})
