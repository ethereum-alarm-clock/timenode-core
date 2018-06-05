import Cache = require('./cache');
import Wallet = require('./wallet');

interface ConfigParams {
  autostart: boolean;
  eac: any;
  factory: any;
  logger: any;
  password: any;
  provider: any;
  scanSpread: number | null;
  walletStores: any;
  web3: any;
}

class Config {
  cache: any;
  eac: any;
  factory: any;
  logger: any;
  provider: any;
  scanning: boolean;
  scanSpread: any;
  wallet: any;
  web3: any;

  /**
   * Creates a new Config object.
   * @param {ConfigParams} params The parameters to create a new Config object.
   */
  constructor(params: ConfigParams) {
    this.scanSpread = params.scanSpread || 50;

    // If logfile and loglevel are provided (in a node environment)
    if (params.logger) {
      this.logger = params.logger;
    } else {
      // Otherwise just log everything to the console.
      this.logger = {
        debug: (msg) => console.log(msg),
        cache: (msg) => console.log(msg),
        info: (msg) => console.log(msg),
        error: (msg) => console.log(msg),
      };
    }

    this.cache = new Cache(this.logger);

    // These are all required options
    this.factory = params.factory;
    this.web3 = params.web3;
    this.eac = params.eac;
    this.provider = params.provider;
    if (!this.factory || !this.web3 || !this.eac || !this.provider) {
      throw new Error(
        'Missing a required variable to the Config constructor. Please make sure you are passing in the correct object.'
      );
    }

    // Set autostart
    this.scanning = params.autostart || false;
  }

  static create(params: ConfigParams): Config {
    // Use the constructor to create the initial Config object.
    let conf: Config = new Config(params);

    if (
      params.walletStores &&
      typeof params.walletStores.length !== 'undefined' &&
      params.walletStores.length > 0
    ) {
      params.walletStores.forEach((store, index) => {
        if (typeof store === 'object') {
          params.walletStores[index] = JSON.stringify(store);
        }
      });
      conf.wallet = new Wallet(params.web3);
      conf.wallet.decrypt(params.walletStores, params.password);
    } else {
      conf.wallet = false;
    }
    return conf;
  }
}

export default Config;
