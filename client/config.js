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
    // walletFile,
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

  static async create(
    opts
    // scanSpread,
    // logfile,
    // logLevel,
    // factory,
    // tracker,
    // web3,
    // eac,
    // provider,
    // walletFile,
    // password,
    // autostart
  ) {
    let conf = new Config(opts)
    if (opts.walletFile) {
      if (typeof opts.walletFile === "string" || typeof opts.walletFile === Object) {
        conf.wallet = new Wallet(opts.web3)
        conf.wallet.decryptA(opts.walletFile, opts.password)
      }
    } else {
      conf.wallet = false
    }
    return conf
  }
}

module.exports = Config
