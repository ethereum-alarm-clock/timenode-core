import BigNumber from 'bignumber.js';
import * as Web3 from 'web3';
import * as Web3WsProvider from 'web3-providers-ws';

import { IBlock, ITxRequest } from './Types';

export default class W3Util {

  public static isHTTPConnection(url: string) : boolean {
    return url.includes('http://') || url.includes('https://');
  }

  public static isWSConnection(url: string) : boolean {
    return url.includes('ws://') || url.includes('wss://');
  }

  public static getWeb3FromProviderUrl(providerUrl: string) {
    let provider: any;

    if (this.isHTTPConnection(providerUrl)) {
      provider = new Web3.providers.HttpProvider(providerUrl);
    } else if (this.isWSConnection(providerUrl)) {
      provider = new Web3WsProvider(providerUrl);
      provider.__proto__.sendAsync = provider.__proto__.sendAsync || provider.__proto__.send;
    }

    return new Web3(provider);
  }

  public static isWatchingEnabled(web3: any): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      web3.currentProvider.sendAsync(
        {
          jsonrpc: '2.0',
          id: new Date().getTime(),
          method: 'eth_getFilterLogs',
          params: ['0x16'] // we need to provide at least 1 argument, this is test data
        },
        (err: any) => {
          resolve(err === null);
        }
      );
    });
  }

  public static testProvider(providerUrl: string): Promise<boolean> {
    const web3 = W3Util.getWeb3FromProviderUrl(providerUrl);
    return W3Util.isWatchingEnabled(web3);
  }

  public web3: any;

  constructor(web3?: any) {
    this.web3 = web3;
  }

  public calculateGasAmount(txRequest: ITxRequest): BigNumber {
    return txRequest.callGas
      .add(180000)
      .div(64)
      .times(65)
      .round();
  }

  public estimateGas(opts: any): Promise<number> {
    return new Promise((resolve, reject) => {
      this.web3.eth.estimateGas(opts, (e: any, r: any) => (e ? reject(e) : resolve(r)));
    });
  }

  public networkGasPrice(): Promise<BigNumber> {
    return new Promise((resolve, reject) => {
      this.web3.eth.getGasPrice((e: any, r: any) => (e ? reject(e) : resolve(r)));
    });
  }

  public getReceipt(txHash: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.web3.eth.getTransactionReceipt(txHash, (e: any, r: any) => (e ? reject(e) : resolve(r)));
    });
  }

  public getBlockNumber(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.web3.eth.getBlockNumber((e: any, r: any) => (e ? reject(e) : resolve(r)));
    });
  }

  public getBlock(blockNumber: string | number = 'latest'): Promise<IBlock> {
    return new Promise((resolve, reject) => {
      this.web3.eth.getBlock(blockNumber, (err: any, block: IBlock) => {
        if (!err) {
          if (block) {
            resolve(block);
          } else {
            reject(`Returned block ${blockNumber} is null`);
          }
        } else {
          reject(err);
        }
      });
    });
  }

  /*
   * Takes an average of the last 100 blocks and estimates the
   * blocktime.
   */
  public async getAverageBlockTime(): Promise<number> {
    const numLookbackBlocks: number = 100;
    const times: number[] = [];
    
    const blockPromises: Promise<IBlock>[] = [];
    const currentBlockNumber: number = await this.getBlockNumber();
    const firstBlock: IBlock = await this.getBlock(currentBlockNumber - numLookbackBlocks);
    
    for (let i = currentBlockNumber - numLookbackBlocks; i < currentBlockNumber; i++) {
      blockPromises.push(this.getBlock(i));
    }

    const resolvedBlocks: IBlock[] = await Promise.all(blockPromises);

    let prevTimestamp = firstBlock.timestamp;
    resolvedBlocks.forEach((block: IBlock) => {
      const time = block.timestamp - prevTimestamp;
      console.log(prevTimestamp);
      prevTimestamp = block.timestamp;
      times.push(time);
    });
    
    return Math.round(times.reduce((a, b) => a + b) / times.length);
  }

  public isWatchingEnabled(): Promise<boolean> {
    return W3Util.isWatchingEnabled(this.web3);
  }

  public getTransaction(txHash: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.web3.eth.getTransaction(txHash, (e: any, r: any) => (e ? reject(e) : resolve(r)));
    });
  }

  public stopFilter(filter: any): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      filter.stopWatching((e: any, r: any) => (e ? reject(e) : resolve(r)));
    });
  }

  public balanceOf(address: string): Promise<BigNumber> {
    return new Promise<BigNumber>((resolve, reject) => {
      this.web3.eth.getBalance(address, (e: any, r: any) => (e ? reject(e) : resolve(r)));
    });
  }

  public getTransactionCount(account: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.web3.eth.getTransactionCount(account, (e: any, r: any) => (e ? reject(e) : resolve(r)));
    });
  }

  public sendRawTransaction(transaction: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.web3.eth.sendRawTransaction(
        transaction,
        (e: any, r: any) => (e ? reject(e) : resolve(r))
      );
    });
  }

  public toHex(input: any): string {
    return this.web3.toHex(input);
  }
}
