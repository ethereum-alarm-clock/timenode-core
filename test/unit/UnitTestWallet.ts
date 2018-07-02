import { expect, assert } from 'chai';
import { Config, Wallet } from '../../src/index';
import { mockConfig } from '../helpers';
import * as ethWallet from 'ethereumjs-wallet';

describe('Wallet Unit Tests', () => {
  let config: Config;
  let wallet: Wallet;
  let myAccount: string;

  const reset = async () => {
    config = mockConfig();
    wallet = new Wallet(config.web3);

    myAccount = config.wallet.getAddresses()[0];
  };

  beforeEach(reset);

  describe('getBalanceOf()', () => {
    it('returns the balance of the current account', async () => {
      const balance = await wallet.getBalanceOf(myAccount);
      expect(balance).to.exist;
    });
  });

  describe('create()', () => {
    it('creates a number of wallets', () => {
      wallet.create(5);
      assert.equal(wallet.getAccounts().length, 5);
    });
  });

  describe('add()', () => {
    it('creates a new wallet', () => {
      const newWallet = wallet.add(ethWallet.generate());
      expect(wallet[newWallet.getAddressString()]).to.exist;
    });
  });

  describe('rm()', () => {
    it('removes a wallet', () => {
      const newWallet = wallet.add(ethWallet.generate());
      expect(wallet[newWallet.getAddressString()]).to.exist;

      const result = wallet.rm(newWallet.getAddressString());
      assert.isTrue(result);
      expect(wallet[newWallet.getAddressString()]).to.not.exist;
    });
  });

  describe('loadPrivateKeys()', () => {
    it('creates a wallet from a private key', () => {
      assert.equal(wallet.length, 0);

      const privKey = 'fdf2e15fd858d9d81e31baa1fe76de9c7d49af0018a1322aa2b9e493b02afa26';
      wallet.loadPrivateKeys([privKey]);

      assert.equal(wallet.length, 1);
    });
  });
});
