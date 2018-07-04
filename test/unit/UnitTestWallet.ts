import { expect, assert } from 'chai';
import { Config, Wallet } from '../../src/index';
import { mockConfig } from '../helpers';
import * as ethWallet from 'ethereumjs-wallet';
import { BigNumber } from 'bignumber.js';
import * as Bb from 'bluebird';

describe('Wallet Unit Tests', () => {
  let config: Config;
  let wallet: Wallet;
  let myAccount: string;
  let opts: object;

  const reset = async () => {
    config = mockConfig();
    wallet = new Wallet(config.web3);

    const accounts = await Bb.fromCallback((callback: any) =>
      config.web3.eth.getAccounts(callback)
    );

    myAccount = accounts[0];
    opts = {
      to: myAccount,
      gas: new BigNumber(150000),
      gasPrice: new BigNumber(config.web3.toWei(21, 'gwei')),
      value: new BigNumber(config.web3.toWei(0.1, 'ether'))
    };
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

      assert.equal(
        wallet.getAddresses()[0].toLowerCase(),
        '0x487a54e1d033db51c8ee8c03edac2a0f8a6892c6'
      );
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
    it('returns a list of accounts', () => {
      wallet.create(5);
      assert.equal(wallet.getAccounts().length, 5);
    });

    it('returned account properly formatted', () => {
      wallet.create(1);

      const account = wallet.getAccounts()[0];
      expect(account).to.haveOwnProperty('_privKey');
      expect(account).to.haveOwnProperty('_pubKey');
    });
  });

  describe('getAddresses()', () => {
    it('returns a list of addresses', () => {
      wallet.create(5);
      assert.equal(wallet.getAddresses().length, 5);

      const address = wallet.getAddresses()[0];
      assert.equal(typeof address, 'string');
    });
  });

  describe('isKnownAddress()', () => {
    it('returns true if address is known', () => {
      wallet.create(1);
      const address = wallet.getAddresses()[0];

      assert.isTrue(wallet.isKnownAddress(address));
    });

    it('returns false if address is not known', () => {
      assert.isFalse(wallet.isKnownAddress('0x0000000000000000000000000000000000000000'));
    });
  });

  describe('isWalletAbleToSendTx()', () => {
    it('returns true if no states', () => {
      wallet.create(1);
      assert.isTrue(wallet.isWalletAbleToSendTx(0));
    });

    it('returns false if wallet state set', () => {
      wallet.create(1);
      const address = wallet.getAddresses()[0];

      wallet.walletStates[address] = {
        sendingTxInProgress: true
      };
      assert.isFalse(wallet.isWalletAbleToSendTx(0));
    });

    it('errors if wallet not within range', () => {
      wallet.create(1);
      expect(() => wallet.isWalletAbleToSendTx(1)).to.throw();
    });
  });

  describe('signTransaction()', () => {
    it('signs a transaction', async () => {
      wallet.create(1);
      const from = wallet.getAddresses()[0];
      const nonce = config.web3.toHex(await wallet.getNonce(from));

      const sig = await wallet.signTransaction(from, nonce, opts);
      expect(sig).to.haveOwnProperty('r');
      expect(sig).to.haveOwnProperty('s');
      expect(sig).to.haveOwnProperty('v');
    });
  });

  describe('sendFromIndex()', () => {
    it('returns ignore when not enough balance on account', async () => {
      wallet.create(1);

      const receipt = await wallet.sendFromIndex(0, opts);
      assert.equal(receipt.ignore, true);
    });

    it('returns ignore when sendint a Tx is in progress', async () => {
      wallet.create(1);
      const idx = 0;
      const address = wallet.getAddresses()[idx];
      wallet.walletStates[address] = {
        sendingTxInProgress: true
      };

      const receipt = await wallet.sendFromIndex(idx, opts);
      assert.equal(receipt.ignore, true);
    });

    it('returns receipt when is able to send the transaction', async () => {
      wallet.create(1);
      const idx = 0;
      const address = wallet.getAddresses()[idx];

      const txHash = await Bb.fromCallback((callback: any) =>
        config.web3.eth.sendTransaction(
          {
            from: myAccount,
            to: address,
            value: config.web3.toWei('0.5', 'ether')
          },
          callback
        )
      );
      assert.equal(txHash.length, 66);

      const receipt = await wallet.sendFromIndex(idx, opts);
      expect(receipt).to.haveOwnProperty('from');
      expect(receipt).to.haveOwnProperty('receipt');
    });
  });

  describe('sendFromNext()', () => {
    it('generates a random index and sends from it', async () => {
      wallet.create(5);
      const receipt = await wallet.sendFromNext(opts);
      assert.equal(receipt.ignore, true);
    });
  });
});
