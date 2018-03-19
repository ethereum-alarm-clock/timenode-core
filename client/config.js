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
    // walletStore,
    // password,
    // autostart
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
    this.tracker = opts.tracker
    this.web3 = opts.web3
    this.eac = opts.eac
    this.provider = opts.provider
    this.analyticsOn = opts.analytics || true
    if (!this.factory ||
        !this.tracker ||
        !this.web3 ||
        !this.eac ||
        !this.provider) {
      throw new Error("Missing a required variable to the Config constructor. Please make sure you are passing in the correct object.")
    }

    // Set autostart
    this.scanning = opts.autostart

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
    // walletStore,
    // password,
    // autostart
  ) {
    let conf = new Config(opts)
    if (opts.walletStore ) {
      if (typeof opts.walletStore === 'object') {
        opts.walletStore = JSON.stringify(opts.walletStore);
      }
      conf.wallet = new Wallet(opts.web3)
      conf.wallet.decrypt([opts.walletStore], opts.password)
    } else  {
      conf.wallet = false
    }
    return conf
  }
}

module.exports = Config
