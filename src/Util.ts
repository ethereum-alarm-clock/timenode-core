import { IBlock } from './Types';

export default class W3Util {
  public web3: any;

  constructor(web3: any) {
    this.web3 = web3;
  }

  public estimateGas(opts: any): Promise<any> {
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

  public networkGasPrice(): Promise<any> {
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

  public getReceipt(txHash: any): Promise<any> {
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

  public getBlockNumber(): Promise<any> {
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

  public getBlock(blockNumber = 'latest'): Promise<IBlock> {
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
          id: 1,
          method: 'eth_getFilterLogs',
          params: []
        },
        (err: any) => {
          if (err !== null) {
            resolve(false);
          }
          resolve(true);
        }
      );
    });
  }
}
