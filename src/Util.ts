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
      this.web3.eth.gasPrice((e: any, r: any) => {
        if (e) reject(e);
        else resolve(r);
      });
    });
  }
}
