import Config from './Config';

export default class Util {
  config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  estimateGas(opts: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.config.web3.eth.estimateGas(opts, (e: any,r: any) => {
        if (e) reject(e);
        else resolve(r);
      })
    })
  }

  networkGasPrice(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.config.web3.eth.gasPrice((e: any, r: any) => {
        if (e) reject(e);
        else resolve(r);
      })
    })
  }
}