import { assert } from 'chai';
import { createWallet, createWalletKeystore, providerUrl } from '../helpers';
import * as Web3 from 'web3';

const provider = new Web3.providers.HttpProvider(providerUrl);
const web3 = new Web3(provider);

const password = 'password123';

if (process.env.RUN_ONLY_OPTIONAL_TESTS !== 'true') {
  describe('CreateWallet', () => {
    it('creates a new wallet', () => {
      const wallet = createWallet(web3, 1);
      assert.exists(wallet);
    });

    it('creates a new encrypted wallet', () => {
      const wallet = createWalletKeystore(web3, 1, password);
      assert.exists(wallet);
    });
  });
}
