export default class W3Util {
  web3: any;

  constructor(web3: any) {
    this.web3 = web3;
  }

  estimateGas(opts: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.web3.eth.estimateGas(opts, (e: any, r: any) => {
        if (e) reject(e);
        else resolve(r);
      });
    });
  }

  networkGasPrice(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.web3.eth.getGasPrice((e: any, r: any) => {
        if (e) reject(e);
        else resolve(r);
      });
    });
  }

  getReceipt(txHash: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.web3.eth.getTransactionReceipt(txHash, (e: any, r: any) => {
        if (e) reject(e);
        else resolve(r);
      });
    });
  }

  getBlockNumber(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.web3.eth.getBlockNumber((e: any, r: any) => {
        if (e) reject(e);
        else resolve(r);
      });
    });
  }
}
