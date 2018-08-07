import * as ethWallet from 'ethereumjs-wallet';
import { fromCallback } from 'bluebird';
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
  tx: string;
}

interface AccountStateMap {
  [Account: string]: AccountState;
}

interface V3Wallet {
  privKey: any;
  getAddressString(): string;
  toV3(password: string, opts: object): string;
}

export class Wallet {
  public logger: ILogger;
  public nonce: number = 0;
  public web3: any;
  public walletStates: AccountStateMap = {};
  private accounts: V3Wallet[] = [];

  constructor(web3: any, logger?: ILogger) {
    this.logger = logger;
    this.web3 = web3;
  }

  public getBalanceOf(address: string): Promise<BigNumber> {
    return fromCallback((callback: any) => this.web3.eth.getBalance(address, callback));
  }

  public create(numAccounts: number) {
    for (let i = 0; i < numAccounts; i++) {
      const wallet = ethWallet.generate();
      this.add(wallet);
    }
  }

  public add(wallet: any) {
    const address = wallet.getAddressString();

    if (!this.accounts.some(a => a.getAddressString() === address)) {
      this.accounts.push(wallet);
      this.walletStates[address] = {} as AccountState;
    }

    return wallet;
  }

  public encrypt(password: string, opts: object) {
    return this.accounts.map(wallet => wallet.toV3(password, opts));
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

  public decrypt(encryptedKeyStores: (string | object)[], password: string) {
    encryptedKeyStores.forEach(keyStore => {
      const wallet = ethWallet.fromV3(keyStore, password, true);

      if (wallet) {
        this.add(wallet);
      } else {
        throw new Error("Couldn't decrypt key store. Wrong password?");
      }
    });
  }

  /**
   * sendFromNext will send a transaction from the account in this wallet that is next according to this.nonce
   * @param {TransactionParams} opts {to, value, gas, gasPrice, data}
   * @returns {Promise<IWalletReceipt>} A promise which will resolve to the transaction receipt
   */
  public sendFromNext(opts: any): Promise<IWalletReceipt> {
    const next = this.nonce++ % this.accounts.length;

    return this.sendFromIndex(next, opts);
  }

  public getNonce(account: string): Promise<string> {
    return fromCallback((callback: any) => this.web3.eth.getTransactionCount(account, callback));
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

  public isWalletAbleToSendTx(idx: number): boolean {
    if (this.accounts[idx] === undefined) {
      throw new Error('Index is outside range of addresses.');
    }

    const from: string = this.accounts[idx].getAddressString();
    const state = this.walletStates[from];

    this.logger.debug(`Wallet:isWalletAbleToSendTx: idx=${idx} wallet=${from} tx=${state.tx}`);

    return !state.sendingTxInProgress;
  }

  public isNextAccountFree(): boolean {
    return this.isWalletAbleToSendTx(this.nonce % this.accounts.length);
  }

  public async sendFromIndex(idx: number, opts: any): Promise<IWalletReceipt> {
    if (this.accounts[idx] === undefined) {
      throw new Error('Index is outside range of addresses.');
    }

    const account = this.accounts[idx];
    const from: string = account.getAddressString();

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
    const signedTx = await this.signTransaction(account, nonce, opts);

    if (!this.isWalletAbleToSendTx(idx)) {
      return {
        from,
        error: TxSendErrors.SENDING_IN_PROGRESS
      };
    }

    let receipt;
    try {
      this.walletStates[from].sendingTxInProgress = true;
      const hash = await this.sendRawTransaction(signedTx);
      this.walletStates[from].tx = hash;

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
      this.walletStates[from].tx = '';
    }

    return receipt;
  }

  public getAccounts(): V3Wallet[] {
    return this.accounts;
  }

  public getAddresses(): string[] {
    return this.accounts.map(account => account.getAddressString());
  }

  public isKnownAddress(address: string): boolean {
    return this.getAddresses().some(addr => addr === address);
  }

  public sendRawTransaction(tx: any): Promise<any> {
    const serialized = '0x'.concat(tx.serialize().toString('hex'));

    return fromCallback((callback: any) => this.web3.eth.sendRawTransaction(serialized, callback));
  }

  private async signTransaction(from: V3Wallet, nonce: number | string, opts: any): Promise<any> {
    const params = {
      nonce,
      from: from.getAddressString(),
      to: opts.to,
      gas: this.web3.toHex(opts.gas),
      gasPrice: this.web3.toHex(opts.gasPrice),
      value: this.web3.toHex(opts.value),
      data: opts.data
    };

    const tx = new ethTx(params);
    tx.sign(Buffer.from(from.privKey, 'hex'));

    return tx;
  }
}
