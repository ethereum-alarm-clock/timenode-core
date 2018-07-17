import { expect } from 'chai';
import { mockConfig } from '../helpers';

if (process.env.RUN_ONLY_OPTIONAL_TESTS !== 'true') {
  describe('Config', () => {
    it('creates a config from standard params', () => {
      const config = mockConfig();
      expect(config).to.exist;
    }).timeout(10000);
  });
}
