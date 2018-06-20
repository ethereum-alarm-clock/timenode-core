import { expect } from 'chai';
import { mockConfig } from './helpers/mockConfig';

if (!process.env.RUN_ONLY_OPTIONAL_TESTS) {
  describe('Config', () => {
    it('creates a config from standard params', () => {
      const config = mockConfig();
      expect(config).to.exist;
    }).timeout(10000);
  })
}
