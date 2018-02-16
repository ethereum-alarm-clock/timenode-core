const { Cache } = require("./cache.js")
const LightWallet = require("./lightWallet.js")
const { Logger } = require("./logger.js")

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
    this.scanSpread = opts.scanSpread
    this.logger = new Logger(opts.logfile, opts.logLevel)

    this.cache = new Cache(this.logger)
    this.factory = opts.factory
    this.tracker = opts.tracker
    this.web3 = opts.web3
    this.eac = opts.eac
    this.provider = opts.provider
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
      await conf.instantiateWallet(opts.walletFile, opts.password)
      return conf
    } else {
      conf.wallet = false
      return conf
    }
  }

  async instantiateWallet(file, password) {
    if (file === "none") {
      return false
    }
    const wallet = new LightWallet(this.web3)
    await wallet.decryptAndLoad(file, password)
    this.wallet = wallet 
  }
}

module.exports = Config
