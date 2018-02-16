const { Cache } = require("./cache.js")
const LightWallet = require("./lightWallet.js")
const { Logger } = require("./logger.js")

class Config {
  constructor(
    scanSpread,
    logfile,
    logLevel,
    factory,
    tracker,
    web3,
    eac,
    provider,
    walletFile,
    password,
    autostart
  ) {
    this.scanSpread = scanSpread
    this.logger = new Logger(logfile, logLevel)

    this.cache = new Cache(this.logger)
    this.factory = factory
    this.tracker = tracker
    this.web3 = web3
    this.eac = eac
    this.provider = provider
    this.scanning = autostart
  }

  static async create(
    scanSpread,
    logfile,
    logLevel,
    factory,
    tracker,
    web3,
    eac,
    provider,
    walletFile,
    password,
    autostart
  ) {
    let conf = new Config(
      scanSpread,
      logfile,
      logLevel,
      factory,
      tracker,
      web3,
      eac,
      provider,
      walletFile,
      password,
      autostart
    )
    if (walletFile) {
      await conf.instantiateWallet(walletFile, password)
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
