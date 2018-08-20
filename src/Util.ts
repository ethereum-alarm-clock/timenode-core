import { IBlock, ITxRequest } from './Types';
import BigNumber from 'bignumber.js';

export default class W3Util {
  public web3: any;

  constructor(web3: any) {
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
      this.web3.eth.estimateGas(opts, (e: any, r: any) => {
        if (e) {
          reject(e);
        } else {
          resolve(r);
        }
      });
    });
  }

  public networkGasPrice(): Promise<BigNumber> {
    return new Promise((resolve, reject) => {
      this.web3.eth.getGasPrice((e: any, r: any) => {
        if (e) {
          reject(e);
        } else {
          resolve(r);
        }
      });
    });
  }

  public getReceipt(txHash: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.web3.eth.getTransactionReceipt(txHash, (e: any, r: any) => {
        if (e) {
          reject(e);
        } else {
          resolve(r);
        }
      });
    });
  }

  public getBlockNumber(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.web3.eth.getBlockNumber((e: any, r: any) => {
        if (e) {
          reject(e);
        } else {
          resolve(r);
        }
      });
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

  public isWatchingEnabled(): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this.web3.currentProvider.sendAsync(
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

  public getTransaction(txHash: string): Promise<{}> {
    return new Promise<{}> ((resolve, reject) => {
      this.web3.eth.getTransaction(txHash, (err: any, tx: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(tx);
        }
      })
    })
  }

  public stopFilter (filter: any): Promise<boolean> {
    return new Promise<boolean> ((resolve, reject) => {
      filter.stopWatching((err: any, res: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      })
    })
  }
}
