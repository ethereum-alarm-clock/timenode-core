import BigNumber from 'bignumber.js';
import * as Web3 from 'web3';
import * as Web3WsProvider from 'web3-providers-ws';
import fetch from 'node-fetch';

import { IBlock, IService, IServices, ITxRequest } from './Types';
import { Networks } from './Enum';

function apiCall(url: string): Promise<any> {
  return fetch(url)
    .then((response :any) => {
      if (!response.ok) {
        return new Error(response.statusText);
      }
      return response.json();
    })
}

const SERVICES: IServices = {//should return GWEI value of the gasPrice
  [Networks.Mainnet]: [
    {
      api: 'https://dev.blockscale.net/api/gasexpress.json',
      field: 'standard',
      morph: (val: any): number => {
        const GWEI = 10e+9;
        return Number(val* GWEI); 
      }
    },
    {
      api: 'https://ethgasstation.info/json/ethgasAPI.json',
      field: 'average',
      morph: (val: any): number => {
        const GWEI = 10e+9;
        return Number(val* GWEI)/10; 
      }
    }
  ]
};

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

  public getNetworkId(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.web3.version.getNetwork((e: any, r: any) => (e ? reject(e) : resolve(r)));
    });
  }

  public fetchExternalApiNetworkPrice (networkId: string): Promise<any> {
    const services = SERVICES[networkId];
    return new Promise(async(resolve, reject) => {
      for ( let s = 0; s < services.length; s++) {
        const service: IService = services[s]
        try {
          const data: any = await apiCall(service.api);
          resolve(service.morph ? service.morph(data[service.field]) : data[service.field]);
          break;
        } catch (e) {
          if (s === (services.length-1)) {
            reject(new Error('No result from services'));
          }
          continue;
        }
      }
    });
  }

  public externalApiNetworkPrice (): Promise<BigNumber> {
    return new Promise(async(resolve, reject) => {
      try {
        const networkId = await this.getNetworkId();
        if (!SERVICES[networkId]) {
          reject('No external service for networkId');
        }
        const apiResult = await this.fetchExternalApiNetworkPrice(networkId);
        resolve(new BigNumber(apiResult));
      } catch (e) {
        reject(e);
      }
    });
  }

  public networkGasPrice(): Promise<BigNumber> {
    return new Promise(async(resolve, reject) => {
      try {
        const externalPrice = await this.externalApiNetworkPrice();
        if (!externalPrice) {
          throw new Error('fetching from external Api services failed!!!');
        } else {
          resolve(externalPrice);
        }
      } catch (e) {
        this.web3.eth.getGasPrice((e: any, r: any) => (e ? reject(e) : resolve(r)));
      }
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
