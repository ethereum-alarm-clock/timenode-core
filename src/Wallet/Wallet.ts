import * as ethWallet from 'ethereumjs-wallet';
import { BigNumber } from 'bignumber.js';

import IWalletReceipt from './IWalletReceipt';

declare const Buffer: any;
declare const setTimeout: any;

interface AccountState {
  sendingTxInProgress: boolean;
}

interface AccountStateMap {
  [Account: string]: AccountState;
}

export default class Wallet {
  length: number;
  nonce: number;
  web3: any;
  walletStates: AccountStateMap;

  constructor(web3: any) {
    this.length = 0;
    this.nonce = 0;
    this.web3 = web3;
    this.walletStates = {};
  }

  getBalanceOf(address: string): Promise<BigNumber> {
    return new Promise((resolve) => {
      const balance = this.web3.eth.getBalance(address);

      resolve(balance);
    });
  }

  _findSafeIndex(pointer = 0): number {
    pointer = pointer;
    if (this.hasOwnProperty(pointer)) {
      return this._findSafeIndex(pointer + 1);
    } else {
      return pointer;
    }
  }

  _currentIndexes() {
    const keys = Object.keys(this);
    const indexes = keys
      .map((key) => parseInt(key, 10))
      .filter((n) => n < 9e20)
      .slice(0, this.length);
    return indexes;
  }

  create(numAccounts: number) {
    for (let i = 0; i < numAccounts; i++) {
      const wallet = ethWallet.generate();
      this.add(wallet);
    }
    return this;
  }

  add(wallet: any) {
    if (!this[wallet.getAddressString()]) {
      const idx = this._findSafeIndex();
      wallet.index = idx;

      this[idx] = wallet;
      this[wallet.getAddressString()] = wallet;
      this[wallet.getAddressString().toLowerCase()] = wallet;
      this.length++;
      return wallet;
    }

    return this[wallet.getAddressString()];
  }

  rm(addressOrIndex: string | number) {
    const wallet = this[addressOrIndex];

    if (wallet && wallet.getAddressString()) {
      delete this[wallet.getAddressString()];
      delete this[wallet.getAddressString().toLowerCase()];
      delete this[wallet.index];
      this.length--;
      return true;
    }

    return false;
  }

  clear() {
    const indexes = this._currentIndexes();

    indexes.forEach((idx) => {
      this.rm(idx);
    });

    return this;
  }

  encrypt(password: String, opts: Object) {
    const indexes = this._currentIndexes();

    return indexes.map((idx) => this[idx].toV3(password, opts));
  }

  loadPrivateKeys(privateKeys: Array<String>) {
    privateKeys.forEach((privateKey) => {
      const wallet = ethWallet.fromPrivateKey(Buffer.from(privateKey, 'hex'));

      if (wallet) {
        this.add(wallet);
      } else {
        throw new Error("Couldn't load private key.");
      }
    });
  }

  decrypt(encryptedKeystores: Array<String | Object>, password: String) {
    encryptedKeystores.forEach((keystore) => {
      const wallet = ethWallet.fromV3(keystore, password, true);

      if (wallet) {
        this.add(wallet);
      } else {
        throw new Error("Couldn't decrypt keystore. Wrong password?");
      }
    });
  }

  /**
   * sendFromNext will send a transaction from the account in this wallet that is next according to this.nonce
   * @param {TransactionParams} opts {to, value, gas, gasPrice, data}
   * @returns {Promise<string>} A promise which will resolve to the transaction hash
   */
  sendFromNext(opts: any) {
    const next = this.nonce++ % this.length;

    return this.sendFromIndex(next, opts);
  }

  getNonce(account: String) {
    return new Promise<string>((resolve, reject) => {
      this.web3.eth.getTransactionCount(account, (err: Error, res: any) => {
        if (err) reject(err);
        resolve(res);
      });
    });
  }

  sendRawTransaction(tx: any) {
    return new Promise((resolve, reject) => {
      this.web3.eth.sendRawTransaction(
        '0x'.concat(tx.serialize().toString('hex')),
        (err: Error, res: any) => {
          if (err) reject(err);
          resolve(res);
        }
      );
    });
  }

  async getTransactionReceipt(hash: any, from: String): Promise<any> {
    let transactionReceiptAsync: any;
    const _this = this;
    transactionReceiptAsync = async function(
      hash: any,
      resolve: any,
      reject: any
    ) {
      try {
        const getTransactionReceipt = (hash: any) => {
          return new Promise((resolve) => {
            _this.web3.eth.getTransactionReceipt(
              hash,
              (err: Error, res: any) => {
                if (!err) resolve(res);
              }
            );
          });
        };
        var receipt = await getTransactionReceipt(hash);
        if (receipt == null) {
          setTimeout(function() {
            transactionReceiptAsync(hash, resolve, reject);
          }, 500);
        } else {
          resolve({ receipt, from });
        }
      } catch (e) {
        reject(e);
      }
    };
    return new Promise(async (resolve, reject) => {
      await transactionReceiptAsync(hash, resolve, reject);
    });
  }

  signTransaction(from: string, nonce: number | string, opts: any) {
    return new Promise((resolve) => {
      const params = {
        nonce,
        from,
        to: opts.to,
        gas: this.web3.toHex(opts.gas),
        gasPrice: this.web3.toHex(opts.gasPrice),
        value: this.web3.toHex(opts.value),
        data: opts.data
      };

      const ethTx = require('ethereumjs-tx');
      const tx = new ethTx(params);
      const privKey = this[from].privKey;
      tx.sign(Buffer.from(privKey, 'hex'));

      resolve(tx);
    });
  }

  isWalletAbleToSendTx(idx: number) {
    if (idx >= this.length) {
      throw new Error('Index is outside range of addresses.');
    }

    const from: string = this.getAccounts()[idx].getAddressString();

    return (
      !this.walletStates[from] || !this.walletStates[from].sendingTxInProgress
    );
  }

  isNextAccountFree() {
    return this.isWalletAbleToSendTx(this.nonce % this.length);
  }

  async sendFromIndex(idx: number, opts: any): Promise<any> {
    if (idx >= this.length) {
      throw new Error('Index is outside range of addresses.');
    }

    const from: string = this.getAccounts()[idx].getAddressString();

    const balance = await this.getBalanceOf(from);

    if (balance.eq(0)) {
      throw `Account ${from} has not enough funds to send transaction.`;
    }

    const nonce = await this.getNonce(from);

    const signedTx = await this.signTransaction(from, nonce, opts);

    if (
      this.walletStates[from] &&
      this.walletStates[from].sendingTxInProgress
    ) {
      throw `Sending transaction is already in progress. Please wait for account: "${from}" to complete tx.`;
    }

    let receipt;
    try {
      if (!this.walletStates[from]) {
        this.walletStates[from] = {} as AccountState;
      }

      this.walletStates[from].sendingTxInProgress = true;

      const hash = await this.sendRawTransaction(signedTx);

      receipt = await this.getTransactionReceipt(hash, from);
      console.log('Wallet::sendFromIndex(): receipt', receipt);
    } catch (error) {
      throw error;
    } finally {
      this.walletStates[from].sendingTxInProgress = false;
    }

    return receipt;
  }

  getAccounts() {
    return this._currentIndexes().map((idx) => this[idx]);
  }

  getAddresses() {
    return this.getAccounts().map((account) => account.getAddressString());
  }

  isKnownAddress(address: String) {
    return this.getAddresses().some((addr) => addr === address);
  }
}
