import * as ethWallet from 'ethereumjs-wallet';
import { BigNumber } from 'bignumber.js';
import { ILogger } from '../Logger';
import { TxSendErrors } from '../Enum/TxSendErrors';
const ethTx = require('ethereumjs-tx');

import { IWalletReceipt } from './IWalletReceipt';

declare const Buffer: any;
declare const require: any;
declare const console: any;
declare const setTimeout: any;

interface AccountState {
  sendingTxInProgress: boolean;
}

interface AccountStateMap {
  [Account: string]: AccountState;
}

export class Wallet {
  public length: number;
  public logger: ILogger;
  public nonce: number;
  public web3: any;
  public walletStates: AccountStateMap;

  constructor(web3: any, logger?: ILogger) {
    this.length = 0;
    this.logger = logger;
    this.nonce = 0;
    this.web3 = web3;
    this.walletStates = {};
  }

  public getBalanceOf(address: string): Promise<BigNumber> {
    return new Promise(resolve => {
      const balance = this.web3.eth.getBalance(address);

      resolve(balance);
    });
  }

  public _findSafeIndex(pointer = 0): number {
    pointer = pointer;
    if (this.hasOwnProperty(pointer)) {
      return this._findSafeIndex(pointer + 1);
    } else {
      return pointer;
    }
  }

  public _currentIndexes() {
    const keys = Object.keys(this);
    const indexes = keys
      .map(key => parseInt(key, 10))
      .filter(n => n < 9e20)
      .slice(0, this.length);
    return indexes;
  }

  public create(numAccounts: number) {
    for (let i = 0; i < numAccounts; i++) {
      const wallet = ethWallet.generate();
      this.add(wallet);
    }
    return this;
  }

  public add(wallet: any) {
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

  public rm(addressOrIndex: string | number): boolean {
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

  public clear() {
    const indexes = this._currentIndexes();

    indexes.forEach(idx => {
      this.rm(idx);
    });

    return this;
  }

  public encrypt(password: string, opts: object) {
    const indexes = this._currentIndexes();

    return indexes.map(idx => this[idx].toV3(password, opts));
  }

  public loadPrivateKeys(privateKeys: string[]) {
    privateKeys.forEach(privateKey => {
      const wallet = ethWallet.fromPrivateKey(Buffer.from(privateKey, 'hex'));

      if (wallet) {
        this.add(wallet);
      } else {
        throw new Error("Couldn't load private key.");
      }
    });
  }

  public decrypt(encryptedKeystores: (string | object)[], password: string) {
    encryptedKeystores.forEach(keystore => {
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
   * @returns {Promise<IWalletReceipt>} A promise which will resolve to the transaction receipt
   */
  public sendFromNext(opts: any): Promise<IWalletReceipt> {
    const next = this.nonce++ % this.length;

    return this.sendFromIndex(next, opts);
  }

  public getNonce(account: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.web3.eth.getTransactionCount(account, (err: Error, res: any) => {
        if (err) {
          reject(err);
        }
        resolve(res);
      });
    });
  }

  public sendRawTransaction(tx: any) {
    return new Promise((resolve, reject) => {
      this.web3.eth.sendRawTransaction(
        '0x'.concat(tx.serialize().toString('hex')),
        (err: Error, res: any) => {
          if (err) {
            reject(err);
          }
          resolve(res);
        }
      );
    });
  }

  public async getTransactionReceipt(hash: any, from: string): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        this.web3.eth.getTransactionReceipt(hash, (err: Error, receipt: any) => {
          if (err) {
            return;
          }

          if (receipt === null) {
            setTimeout(() => {
              resolve(this.getTransactionReceipt(hash, from));
            }, 500);
          } else {
            resolve({ receipt, from });
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  public signTransaction(from: string, nonce: number | string, opts: any): Promise<any> {
    return new Promise(resolve => {
      const params = {
        nonce,
        from,
        to: opts.to,
        gas: this.web3.toHex(opts.gas),
        gasPrice: this.web3.toHex(opts.gasPrice),
        value: this.web3.toHex(opts.value),
        data: opts.data
      };

      const tx = new ethTx(params);
      const privKey = this[from].privKey;
      tx.sign(Buffer.from(privKey, 'hex'));

      resolve(tx);
    });
  }

  public isWalletAbleToSendTx(idx: number): boolean {
    if (idx >= this.length) {
      throw new Error('Index is outside range of addresses.');
    }

    const from: string = this.getAccounts()[idx].getAddressString();

    return !this.walletStates[from] || !this.walletStates[from].sendingTxInProgress;
  }

  public isNextAccountFree() {
    return this.isWalletAbleToSendTx(this.nonce % this.length);
  }

  public async sendFromIndex(idx: number, opts: any): Promise<IWalletReceipt> {
    if (idx >= this.length) {
      throw new Error('Index is outside range of addresses.');
    }

    const from: string = this.getAddresses()[idx];

    const balance = await this.getBalanceOf(from);

    if (balance.eq(0)) {
      if (this.logger) {
        this.logger.info(`${TxSendErrors.NOT_ENOUGH_FUNDS} ${from}`);
      }
      return {
        from,
        error: TxSendErrors.NOT_ENOUGH_FUNDS
      };
    }

    const nonce = this.web3.toHex(await this.getNonce(from));

    const signedTx = await this.signTransaction(from, nonce, opts);

    if (this.walletStates[from] && this.walletStates[from].sendingTxInProgress) {
      if (this.logger) {
        this.logger.debug(`${TxSendErrors.SENDING_IN_PROGRESS} ${from}`);
      }
      return {
        from,
        error: TxSendErrors.SENDING_IN_PROGRESS
      };
    }

    let receipt;
    try {
      if (!this.walletStates[from]) {
        this.walletStates[from] = {} as AccountState;
      }

      this.walletStates[from].sendingTxInProgress = true;

      const hash = await this.sendRawTransaction(signedTx);

      receipt = await this.getTransactionReceipt(hash, from);
    } catch (error) {
      if (this.logger) {
        this.logger.debug(error);
      } else {
        console.log(error);
      }
      return {
        from,
        error: TxSendErrors.UNKNOWN_ERROR
      };
    } finally {
      this.walletStates[from].sendingTxInProgress = false;
    }

    return receipt;
  }

  public getAccounts() {
    return this._currentIndexes().map(idx => this[idx]);
  }

  public getAddresses(): string[] {
    return this.getAccounts().map(account => account.getAddressString());
  }

  public isKnownAddress(address: string): boolean {
    return this.getAddresses().some(addr => addr === address);
  }
}
