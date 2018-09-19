import { assert } from 'chai';

import { createWallet, createWalletKeystore } from '../helpers';

// tslint:disable-next-line:no-hardcoded-credentials
const password = 'password123';

if (process.env.RUN_ONLY_OPTIONAL_TESTS !== 'true') {
  describe('CreateWallet', () => {
    it('creates a new wallet', () => {
      const wallet = createWallet(1);
      assert.exists(wallet);
    });

    it('creates a new encrypted wallet', () => {
      const wallet = createWalletKeystore(1, password);
      assert.exists(wallet);
    });
  });
}
