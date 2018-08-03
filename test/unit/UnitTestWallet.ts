/* tslint:disable:no-unused-expression */
import { expect, assert } from 'chai';
import { Config, Wallet } from '../../src/index';
import { mockConfig } from '../helpers';
import * as ethWallet from 'ethereumjs-wallet';
import { BigNumber } from 'bignumber.js';
import * as Bb from 'bluebird';
import { TxSendErrors } from '../../src/Enum/TxSendErrors';
import { DefaultLogger } from '../../src/Logger';
import { isTransactionStatusSuccessful } from '../../src/Actions/Helpers';

const PRIVKEY = 'fdf2e15fd858d9d81e31baa1fe76de9c7d49af0018a1322aa2b9e493b02afa26';

describe('Wallet Unit Tests', () => {
  let config: Config;
  let wallet: Wallet;
  let myAccount: string;
  let opts: object;

  const reset = async () => {
    config = mockConfig();
    wallet = new Wallet(config.web3);
    wallet.logger = new DefaultLogger();

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
      expect(wallet.isKnownAddress(newWallet.getAddressString())).to.be.true;
    });

    it('returns an existing wallet if already exists', () => {
      const newWallet = wallet.add(ethWallet.generate());
      expect(wallet.isKnownAddress(newWallet.getAddressString())).to.be.true;

      const oldWallet = wallet.add(newWallet);
      assert.equal(oldWallet.getAddressString(), newWallet.getAddressString());
    });
  });

  describe('encrypt()', () => {
    it('clears all wallets', () => {
      wallet.add(ethWallet.generate());
      const encryptedWallets = wallet.encrypt('testpasswd123', {});

      assert.equal(encryptedWallets.length, 1);
      encryptedWallets.forEach(encryptedWallet =>
        expect(encryptedWallet).to.haveOwnProperty('crypto')
      );
    });
  });

  describe('loadPrivateKeys()', () => {
    it('creates a wallet from a private key', () => {
      const privKey = PRIVKEY;
      wallet.loadPrivateKeys([privKey]);

      assert.equal(
        wallet.getAddresses()[0].toLowerCase(),
        '0x487a54e1d033db51c8ee8c03edac2a0f8a6892c6'
      );
    });

    it('throws an error in case invalid key', () => {
      const privKey = PRIVKEY.substring(0, PRIVKEY.length - 1);
      expect(() => wallet.loadPrivateKeys([privKey])).to.throw();
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

  describe('sendFromIndex()', () => {
    it('returns error if index invalid', async () => {
      wallet.create(1);
      let err;

      try {
        await wallet.sendFromIndex(2, opts);
      } catch (e) {
        err = e;
      }

      expect(err.message).to.equal('Index is outside range of addresses.');
    });

    it('returns error when not enough balance on account and logs', async () => {
      wallet.create(1);

      const receipt = await wallet.sendFromIndex(0, opts);
      assert.equal(receipt.error, TxSendErrors.NOT_ENOUGH_FUNDS);
    });

    it('returns error when not enough balance on account and doesnt log', async () => {
      wallet.create(1);
      wallet.logger = null;

      const receipt = await wallet.sendFromIndex(0, opts);
      assert.equal(receipt.error, TxSendErrors.NOT_ENOUGH_FUNDS);
    });

    it('returns error when sending a Tx is in progress', async () => {
      wallet.create(1);
      const idx = 0;
      const address = wallet.getAddresses()[idx];
      wallet.walletStates[address] = {
        sendingTxInProgress: true
      };

      // Fund new wallet
      await new Promise(resolve => {
        config.web3.eth.sendTransaction(
          {
            from: myAccount,
            to: address,
            value: config.web3.toWei('0.5', 'ether')
          },
          resolve
        );
      });

      const receipt = await wallet.sendFromIndex(idx, opts);
      assert.equal(receipt.error, TxSendErrors.SENDING_IN_PROGRESS);
    });

    it('allows to send another transaction when previous one reverted', async () => {
      wallet.create(1);
      const idx = 0;
      const address = wallet.getAddresses()[idx];

      // Fund new wallet
      await new Promise(resolve => {
        config.web3.eth.sendTransaction(
          {
            from: myAccount,
            to: address,
            value: config.web3.toWei('0.5', 'ether')
          },
          resolve
        );
      });

      let receipt = await wallet.sendFromIndex(
        idx,
        Object.assign({}, opts, {
          data: '0x1234'
        })
      );
      assert.equal(receipt.error, TxSendErrors.UNKNOWN_ERROR);
      assert.isFalse(wallet.walletStates[address].sendingTxInProgress);

      receipt = await wallet.sendFromIndex(idx, opts);
      assert.ok(isTransactionStatusSuccessful(receipt.receipt.status));
    });

    it('returns receipt when is able to send the transaction', async () => {
      wallet.create(1);
      const idx = 0;
      const address = wallet.getAddresses()[idx];

      const txHash = (await Bb.fromCallback((callback: any) =>
        config.web3.eth.sendTransaction(
          {
            from: myAccount,
            to: address,
            value: config.web3.toWei('0.5', 'ether')
          },
          callback
        )
      )) as string;
      assert.equal(txHash.length, 66);

      const receipt = await wallet.sendFromIndex(idx, opts);
      expect(receipt).to.haveOwnProperty('from');
      expect(receipt).to.haveOwnProperty('receipt');
    });
  });

  describe('sendFromNext()', () => {
    it('generates the next index and sends from it', async () => {
      wallet.create(5);
      const receipt = await wallet.sendFromNext(opts);
      expect(receipt.error).to.exist;
    });
  });
});
