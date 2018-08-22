import { expect } from 'chai';
import { mockConfig } from '../helpers';

if (process.env.RUN_ONLY_OPTIONAL_TESTS !== 'true') {
  describe('Config', () => {
    it('creates a config from standard params', async () => {
      const config = await mockConfig();
      expect(config).to.exist; // tslint:disable-line no-unused-expression
    }).timeout(10000);
  });
}
