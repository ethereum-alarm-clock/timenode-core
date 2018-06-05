import Cache from './cache';
import Wallet from './wallet';

interface Config_Params {
  autostart: boolean;
  eac: any;
  factory: any;
  logger: any;
  password: any;
  provider: any;
  scanSpread: number|null;
  walletStores: any;
  web3: any;
}

class Config {
  cache: any;
  eac: any;
  factory:any;
  logger: any;
  provider: any;
  scanning: boolean;
  scanSpread: any;
  wallet: any;
  web3: any;

  /**
   * 
   * @param opts 
   */
  constructor(
    opts: Config_Params,
  ) {
    this.scanSpread = opts.scanSpread || 50

    // If logfile and loglevel are provided (in a node environment)
    if (opts.logger) {
      this.logger = opts.logger
    } else {
      // Otherwise just log everything to the console.
      this.logger = {
        debug: (msg) => console.log(msg),
        cache: (msg) => console.log(msg),
        info: (msg) => console.log(msg),
        error: (msg) => console.log(msg)
      }
    }

    this.cache = new Cache(this.logger)

    // These are all required options
    this.factory = opts.factory
    this.web3 = opts.web3
    this.eac = opts.eac
    this.provider = opts.provider
    if (!this.factory ||
        !this.web3 ||
        !this.eac ||
        !this.provider) {
      throw new Error("Missing a required variable to the Config constructor. Please make sure you are passing in the correct object.")
    }

    // Set autostart
    this.scanning = opts.autostart || false;

  }

  static create(
    opts: Config_Params,
  ): Config {
    let conf = new Config(opts)
    if (opts.walletStores && typeof opts.walletStores.length !== 'undefined' && opts.walletStores.length > 0) {
      opts.walletStores.forEach( (store, index ) => {
        if (typeof store === 'object') {
          opts.walletStores[index] = JSON.stringify(store);
        }
      })
      conf.wallet = new Wallet(opts.web3)
      conf.wallet.decrypt(opts.walletStores, opts.password)
    } else  {
      conf.wallet = false
    }
    return conf
  }
}

export default Config;
