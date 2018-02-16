const Config = require("./config")
const Repl = require("./repl")
const Scanner = require("./scanning")
const StatsDB = require("./statsdb")

/**
 * The main driver function that begins the client operation.
 * @param {Web3} web3 An instantiated web3 object.
 * @param {EAC} eac An instantiated eac object.
 * @param {String} provider The supplied provider host for the web3 instance. (Ex. 'http://localhost:8545)
 * @param {Number} scanSpread The spread +- of the current block number to scan.
 * @param {Number} ms Milliseconds between each conduction of a blockchain scan.
 * @param {String} logfile The file that the logging utility will log to, or 'console' for logging to console.
 * @param {Number} logLevel The level of logging allowed.
 * @param {String} chain The name of the chain, accepted values are 'ropsten', 'rinkeby' and 'kovan'.
 * @param {String} walletFile Path to the encrypted wallet file.
 * @param {String} pw Password to decrypt wallet.
 * @param {Boolean} autoStart Enables automatic scanning.
 */
const main = async (
  web3,
  eac,
  provider,
  scanSpread,
  ms,
  logfile,
  logLevel,
  walletFile,
  pw,
  autostart
) => {
  // Assigns chain to the name of the network ID
  const chain = await eac.Util.getChainName()

  // Loads the contracts
  const requestFactory = await eac.requestFactory()
  const requestTracker = await eac.requestTracker()

  // Parses the logfile
  if (logfile === "console") {
    console.log("Logging to console")
  }
  if (logfile === "default") {
    logfile = `${require("os").homedir()}/.eac.log`
  }

  // Loads conf
  let conf = await Config.create({
    scanSpread, // conf.scanSpread
    logfile, // conf.logger.logfile
    logLevel, // conf.logger.logLevel
    requestFactory, // conf.factory
    requestTracker, // conf.tracker
    web3, // conf.web3
    eac, // conf.eac
    provider, // conf.provider
    walletFile, // conf.wallet
    pw, // wallet password
    autostart
  })

  conf.client = "parity"
  conf.chain = chain

  // Creates StatsDB
  conf.statsdb = new StatsDB(conf.web3)

  // Determines wallet support
  if (conf.wallet) {
    console.log('Wallet support: Enabled')
    console.log('\nExecuting from accounts:')
    conf.wallet.getAccounts().forEach(async account => {
        console.log(`${account} | Balance: ${web3.fromWei(await eac.Util.getBalance(account))}`)
    })
    conf.statsdb.initialize(conf.wallet.getAccounts())
  } else { 
    console.log('Wallet support: Disabled')
    // Loads the default account.
    const account = web3.eth.accounts[0]
    /* eslint-disable */
    web3.eth.defaultAccount = account
    /* eslin-enable */
    if (!eac.Util.checkValidAddress(web3.eth.defaultAccount)) {
      throw new Error("Wallet is disabled but you do not have a local account unlocked.")
    }
    console.log(`\nExecuting from account: ${account} | Balance: ${web3.fromWei(await eac.Util.getBalance(account))}`)
    conf.statsdb.initialize([account])
  }

  // Begin
  Scanner.startScanning(ms, conf)

  // Waits a bit before starting the repl so that the accounts have time to print.
  setTimeout(() => Repl.start(conf, ms), 1200)
}

module.exports = main
