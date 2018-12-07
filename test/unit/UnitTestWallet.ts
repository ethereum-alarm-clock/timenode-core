import { assert } from 'chai';
import { Config, Wallet } from '../../src/index';
import { mockConfig } from '../helpers';
import * as ethWallet from 'ethereumjs-wallet';
import { BigNumber } from 'bignumber.js';
import { TxSendStatus } from '../../src/Enum/';
import { isTransactionStatusSuccessful } from '../../src/Actions/Helpers';
import { AccountState, TransactionState } from '../../src/Wallet/AccountState';
import { Operation } from '../../src/Types/Operation';
import ITransactionOptions from '../../src/Types/ITransactionOptions';
import { IWalletReceipt } from '../../src/Wallet';

const PRIVATE_KEY = 'fdf2e15fd858d9d81e31baa1fe76de9c7d49af0018a1322aa2b9e493b02afa26';

let config: Config;
let wallet: Wallet;
let myAccount: string;
let opts: ITransactionOptions;

const createTestWallet = (
  accountState = new AccountState()
) => {
  return new Wallet(config.util, accountState);
};

const fundWallet = async (address: string) => {
  await new Promise(resolve => {
    config.web3.eth.sendTransaction(
      {
        from: myAccount,
        to: address,
        value: config.web3.utils.toWei('0.5', 'ether')
      },
      () => setTimeout(resolve, 1000)
    );
  });
};

const reset = async () => {
  config = await mockConfig();
  wallet = createTestWallet();

  const accounts = await config.web3.eth.getAccounts();

  myAccount = accounts[0];
  opts = {
    to: myAccount,
    gas: new BigNumber('150000'),
    gasPrice: new BigNumber(config.web3.utils.toWei('21', 'gwei')),
    value: new BigNumber(config.web3.utils.toWei('0.1', 'ether')),
    operation: Operation.CLAIM,
    data: ''
  };
};

beforeEach(reset);

// tslint:disable-next-line:no-big-function
describe('Wallet Unit Tests', () => {
  describe('create()', () => {
    it('creates a number of wallets', () => {
      wallet.create(5);
      assert.equal(wallet.getAccounts().length, 5);
    });
  });

  describe('add()', () => {
    it('creates a new wallet', () => {
      const newWallet = wallet.add(ethWallet.generate());
      assert.isTrue(wallet.isKnownAddress(newWallet.getAddressString()));
    });

    it('returns an existing wallet if already exists', () => {
      const newWallet = wallet.add(ethWallet.generate());
      assert.isTrue(wallet.isKnownAddress(newWallet.getAddressString()));

      const oldWallet = wallet.add(newWallet);
      assert.equal(oldWallet.getAddressString(), newWallet.getAddressString());
    });
  });

  describe('encrypt()', () => {
    it('clears all wallets', () => {
      wallet.add(ethWallet.generate());
      const encryptedWallets = wallet.encrypt('testpasswd123', {});

      assert.equal(encryptedWallets.length, 1);
      encryptedWallets.forEach(encryptedWallet => assert.property(encryptedWallet, 'crypto'));
    });
  });

  describe('loadPrivateKeys()', () => {
    it('creates a wallet from a private key', () => {
      const privateKey = PRIVATE_KEY;
      wallet.loadPrivateKeys([privateKey]);

      assert.equal(
        wallet.getAddresses()[0].toLowerCase(),
        '0x487a54e1d033db51c8ee8c03edac2a0f8a6892c6'
      );
    });

    it('throws an error in case invalid key', () => {
      const privateKey = PRIVATE_KEY.substring(0, PRIVATE_KEY.length - 1);
      assert.throw(() => wallet.loadPrivateKeys([privateKey]));
    });
  });

  describe('getNonce()', () => {
    it('returns a nonce', async () => {
      const nonce = await wallet.getNonce(myAccount);
      assert.exists(nonce);
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
      assert.property(account, '_privKey');
      assert.property(account, '_pubKey');
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
      const accountState = new AccountState();
      wallet = createTestWallet(accountState);
      wallet.create(1);
      const address = wallet.getAddresses()[0];

      accountState.set(address, '0x1234', Operation.CLAIM, TransactionState.PENDING);

      assert.isFalse(wallet.isWalletAbleToSendTx(0));
    });

    it('errors if wallet not within range', () => {
      wallet.create(1);
      assert.throw(() => wallet.isWalletAbleToSendTx(1));
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

      assert.equal(err.message, 'Index is outside range of addresses.');
    });

    it('returns error when not enough balance on account and logs', async () => {
      wallet.create(1);

      const { status } = await wallet.sendFromIndex(0, opts);
      assert.equal(status, TxSendStatus.NOT_ENOUGH_FUNDS);
    });

    it('returns error when not enough balance on account and doesnt log', async () => {
      wallet.create(1);

      const receipt = await wallet.sendFromIndex(0, opts);
      assert.equal(receipt.status, TxSendStatus.NOT_ENOUGH_FUNDS);
    });

    it('returns error when sending a Tx is in progress', async () => {
      const accountState = new AccountState();
      wallet = createTestWallet(accountState);
      wallet.create(1);

      const idx = 0;
      const address = wallet.getAddresses()[idx];

      accountState.set(address, address, opts.operation, TransactionState.PENDING);

      await fundWallet(address);

      const receipt = await wallet.sendFromIndex(idx, opts);
      assert.equal(receipt.status, TxSendStatus.BUSY);
    });

    it('allows to send another transaction when previous one reverted', async () => {
      wallet.create(1);
      const idx = 0;
      const address = wallet.getAddresses()[idx];

      // Fund new wallet
      await fundWallet(address);

      let receipt = await wallet.sendFromIndex(
        idx,
        Object.assign({}, opts, {
          gas: new BigNumber('15e64') // Setting a ridiculously high gas limit will trigger a revert
        })
      );
      assert.equal(receipt.status, TxSendStatus.UNKNOWN_ERROR);

      receipt = await wallet.sendFromIndex(idx, opts);

      assert.isTrue(isTransactionStatusSuccessful(receipt.receipt.status));
    }).timeout(10000);

    it('returns receipt when is able to send the transaction', async () => {
      wallet.create(1);
      const idx = 0;
      const address = wallet.getAddresses()[idx];

      await fundWallet(address);

      let receipt: IWalletReceipt;

      if (wallet.hasPendingTransaction(opts.to, opts.operation)) {
        await new Promise(resolve => {
          setTimeout(async () => {
            receipt = await wallet.sendFromIndex(idx, opts);
            resolve();
          }, 1000);
        });
      } else {
        receipt = await wallet.sendFromIndex(idx, opts);
      }

      assert.property(receipt, 'from');
      assert.property(receipt, 'receipt');
    }).timeout(10000);
  });

  describe('sendFromNext()', () => {
    it('generates the next index and sends from it', async () => {
      wallet.create(5);
      const receipt = await wallet.sendFromNext(opts);
      assert.exists(receipt.status);
    });
  });
});
