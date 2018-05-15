const Cache = require("./cache.js")
const Wallet = require('./wallet.js')

/**
 * @param Opts {Object}
 */
class Config {
  constructor(
    opts
    // scanSpread,
    // logfile,
    // logLevel,
    // factory,
    // tracker,
    // web3,
    // eac,
    // provider,
    // walletStores,
    // password,
    // autostart,
    // profitabilityIndex
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
    this.scanning = opts.autostart
    
    this.profitabilityIndex = opts.profitabilityIndex

  }

  static create(
    opts
    // scanSpread,
    // logfile,
    // logLevel,
    // factory,
    // tracker,
    // web3,
    // eac,
    // provider,
    // walletStores,
    // password,
    // autostart,
    // profitabilityIndex
  ) {
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

module.exports = Config
