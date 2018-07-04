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

  describe('getNonce()', () => {
    it('returns a nonce', async () => {
      const nonce = await wallet.getNonce(myAccount);
      expect(nonce).to.exist;
      assert.equal(typeof nonce, 'number');
    });
  });

  describe('getAccounts()', () => {
    it('returns a list of accounts', async () => {
      wallet.create(5);
      assert.equal(wallet.getAccounts().length, 5);
    });

    it('returned account properly formatted', async () => {
      wallet.create(1);

      const account = wallet.getAccounts()[0];
      expect(account).to.haveOwnProperty('_privKey');
      expect(account).to.haveOwnProperty('_pubKey');
    });
  });

  describe('getAddresses()', () => {
    it('returns a list of addresses', async () => {
      wallet.create(5);
      assert.equal(wallet.getAddresses().length, 5);

      const address = wallet.getAddresses()[0];
      assert.equal(typeof address, 'string');
    });
  });

  describe('isKnownAddress()', () => {
    it('returns true if address is known', async () => {
      wallet.create(1);
      const address = wallet.getAddresses()[0];

      assert.isTrue(wallet.isKnownAddress(address));
    });

    it('returns false if address is not known', async () => {
      assert.isFalse(wallet.isKnownAddress('0x0000000000000000000000000000000000000000'));
    });
  });

  describe('isWalletAbleToSendTx()', () => {
    it('returns true if no states', async () => {
      wallet.create(1);
      assert.isTrue(wallet.isWalletAbleToSendTx(0));
    });

    it('returns false if wallet state set', async () => {
      wallet.create(1);
      const address = wallet.getAddresses()[0];

      wallet.walletStates[address] = {
        sendingTxInProgress: true
      };
      assert.isFalse(wallet.isWalletAbleToSendTx(0));
    });

    it('errors if wallet not within range', async () => {
      wallet.create(1);
      expect(() => wallet.isWalletAbleToSendTx(1)).to.throw();
    });
  });
});
