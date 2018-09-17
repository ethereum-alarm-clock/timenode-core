import * as ethWallet from 'ethereumjs-wallet';
import { fromCallback } from 'bluebird';
import { ILogger, DefaultLogger } from '../Logger';
import { TxSendErrors } from '../Enum/TxSendErrors';
const ethTx = require('ethereumjs-tx');

import { IWalletReceipt } from './IWalletReceipt';
import { Address } from '../Types';
import ITransactionOptions from '../Types/ITransactionOptions';
import { ITransactionReceipt } from '../Types/ITransactionReceipt';
import { ITransactionReceiptAwaiter, TransactionReceiptAwaiter } from './TransactionReceiptAwaiter';
import W3Util from '../Util';

declare const Buffer: any;
declare const require: any;
//declare const setTimeout: any;

interface AccountState {
  sendingTxInProgress: boolean;
  to: string;
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
  public walletStates: Map<string, AccountState> = new Map<string, AccountState>();
  private accounts: V3Wallet[] = [];
  private transactionReceiptAwaiter: ITransactionReceiptAwaiter;
  private util: W3Util;

  constructor(
    web3: any,
    logger: ILogger = new DefaultLogger(),
    transactionReceiptAwaiter: ITransactionReceiptAwaiter = new TransactionReceiptAwaiter(web3),
    util: W3Util
  ) {
    this.logger = logger;
    this.web3 = web3;
    this.transactionReceiptAwaiter = transactionReceiptAwaiter;
    this.util = util;
  }

  get nextAccount(): V3Wallet {
    return this.accounts[this.nonce % this.accounts.length];
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
      this.walletStates.set(address, {} as AccountState);
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
      keyStore = typeof keyStore === 'object' ? JSON.stringify(keyStore) : keyStore;
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

  // public async getTransactionReceipt(hash: any, from: string): Promise<any> {
  //   return new Promise((resolve, reject) => {
  //     try {
  //       this.web3.eth.getTransactionReceipt(hash, (err: Error, receipt: any) => {
  //         if (err) {
  //           return;
  //         }

  //         if (receipt === null) {
  //           setTimeout(() => {
  //             resolve(this.getTransactionReceipt(hash, from));
  //           }, 500);
  //         } else {
  //           resolve({ receipt, from });
  //         }
  //       });
  //     } catch (e) {
  //       reject(e);
  //     }
  //   });
  // }

  public isWalletAbleToSendTx(idx: number): boolean {
    if (this.accounts[idx] === undefined) {
      throw new Error('Index is outside range of addresses.');
    }

    const from: string = this.accounts[idx].getAddressString();
    return !this.walletStates.get(from).sendingTxInProgress;
  }

  public isAccountAbleToSendTx(account: Address): boolean {
    return !this.walletStates.get(account).sendingTxInProgress;
  }

  public isNextAccountFree(): boolean {
    return this.isWalletAbleToSendTx(this.nonce % this.accounts.length);
  }

  public hasPendingTransaction(to: string): boolean {
    return Array.from(this.walletStates.values()).some((state: any) => state.to === to);
  }

  public async sendFromIndex(idx: number, opts: any): Promise<IWalletReceipt> {
    if (this.accounts[idx] === undefined) {
      throw new Error('Index is outside range of addresses.');
    }

    const account = this.accounts[idx];
    const from: string = account.getAddressString();
    return this.sendFromAccount(from, opts);
  }

  public async sendFromAccount(from: Address, opts: ITransactionOptions): Promise<IWalletReceipt> {
    if (this.hasPendingTransaction(opts.to)) {
      return {
        from,
        status: TxSendErrors.IN_PROGRESS
      };
    }

    const balance = await this.util.balanceOf(from);

    if (balance.eq(0)) {
      this.logger.info(`${TxSendErrors.NOT_ENOUGH_FUNDS} ${from}`);
      return {
        from,
        status: TxSendErrors.NOT_ENOUGH_FUNDS
      };
    }

    const nonce = this.web3.toHex(await this.getNonce(from));
    const v3Wallet = this.accounts.find((wallet: V3Wallet) => {
      return wallet.getAddressString() === from;
    });
    const signedTx = await this.signTransaction(v3Wallet, nonce, opts);

    if (!this.isAccountAbleToSendTx(from)) {
      return {
        from,
        status: TxSendErrors.WALLET_BUSY
      };
    }

    let receipt: ITransactionReceipt;
    try {
      this.walletStates.set(from, { sendingTxInProgress: true, to: opts.to });

      this.logger.debug(`Tx: ${JSON.stringify(signedTx)}`);

      const hash = await this.sendRawTransaction(signedTx);
      receipt = await this.transactionReceiptAwaiter.waitForConfirmations(hash);

      this.logger.debug(`Receipt: ${JSON.stringify(receipt)}`);
    } catch (error) {
      this.logger.error(error, opts.to);
      return {
        from,
        status: TxSendErrors.UNKNOWN_ERROR
      };
    } finally {
      this.walletStates.set(from, {} as AccountState);
    }

    const status = this.isTransactionStatusSuccessful(receipt)
      ? TxSendErrors.OK
      : TxSendErrors.FAILED;

    return { receipt, from, status };
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

  private isTransactionStatusSuccessful(receipt: ITransactionReceipt): boolean {
    if (receipt) {
      return [1, '0x1', '0x01'].indexOf(receipt.status) !== -1;
    }
    return false;
  }
}
