#!/usr/bin/env node

const program = require("commander")
const alarmClient = require("../client/main")
const createWallet = require('../wallet/createWallet.js')
const fundAccounts = require('../wallet/fundWallet')
const drainWallet = require('../wallet/drainWallet.js')
const BigNumber = require("bignumber.js")
const clear = require("clear")
const ora = require("ora")
const readlineSync = require("readline-sync")
const ethUtil = require("ethereumjs-util")

// Parse the command line options using commander.
program
  .version("1.3.1")
  .option(
  "--scan <spread>",
  "sets the scanning spread (ie +- from current block",
  75
  )
  .option(
  "-m, --milliseconds <ms>",
  "tells the client to scan every <ms> seconds",
  4000
  )
  .option("--logfile [path]", "specifies the output logifle", "default")
  .option("--logLevel [0,1,2,3]", "sets the log level", 2)
  .option(
  "--provider <string>",
  "set the HttpProvider to use",
  "http://localhost:8545"
  )
  .option("-s, --schedule", "schedules a transactions")
  .option("--block")
  .option("--timestamp")
  .option('-w, --wallet [path]', 'specify the path to the keyfile you would like to unlock')
  .option('-p, --password [string]', 'the password to unlock your keystore file')
  .option("-c, --client", "starts the executing client")
  .option('--createWallet', 'guides you through creating a new wallet.')
  .option('--fundWallet <ether amt>', 'funds each account in wallet the <ether amt>')
  .option('--drainWallet <target>', 'sends the target address all ether in the wallet')
  .option("--autostart", "starts scanning automatically")
  .parse(process.argv)

// Create the web3 object by using the chosen provider, defaults to localhost:8545
const Web3 = require("web3")

const provider = new Web3.providers.HttpProvider(`${program.provider}`)
const web3 = new Web3(provider)

const eac = require('../index')(web3)

const main = async (_) => {
  if (program.createWallet) {

    const numAccounts = readlineSync.question('How many accounts would you like in your wallet? [1 - 10]\n> ')

    function isNumber(n) { return !isNaN(parseFloat(n)) && !isNaN(n - 0) }

    if (!isNumber(numAccounts) || numAccounts > 10 || numAccounts <= 0) {
      console.error('  error: must specify a number between 1 - 10 for number of accounts')
      process.exit(1)
    }

    const file = readlineSync.question('Where would you like to save the encrypted keys? Please provide a valid filename or path.\n> ')
    const password = readlineSync.question("Please enter a password for the keyfile. Write this down!\n> ")

    createWallet(web3, numAccounts, file, password)

  } else if (program.fundWallet) {
    if (!program.wallet
      || ! program.password) {
      console.log('\n  error: must supply the `--wallet <keyfile>` and `--password <pw>` flags\n')
      process.exit(1)
      }

    if (!await eac.Util.checkForUnlockedAccount()) process.exit(1)

    const spinner = ora('Sending the funding transactions...').start()
    fundAccounts(web3, program.fundWallet, program.wallet, program.password)
    // .then(Res => console.log(Res))
    .then(res => {
      res.forEach(txObj => {
        if (txObj.status != '0x1') {
          console.log(`\n  error: funding to ${txObj.to} failed... must retry manually\n`)
        }
      })
      spinner.succeed('Accounts funded!')
    })
    .catch(err => spinner.fail(err))

  } else if (program.drainWallet) {
    if (!program.wallet
      || !program.password) {
      console.log('\n  error: must supply the `--wallet <keyfile>` and `--password <pw>` flags\n')
      process.exit(1)
    }

    if (!ethUtil.isValidAddress(program.drainWallet)) {
      console.log(`\n  error: input ${program.drainWallet} not valid Ethereum address`)
      process.exit(1)
    }

    const spinner = ora('Sending transactions...').start()
    const gasPrice = await eac.Util.getGasPrice()

    try {
      await drainWallet(web3, gasPrice, program.drainWallet, program.wallet, program.password)
      spinner.succeed('Wallet drained!')
    } catch (err) {
      spinner.fail(err)
    }
  } else if (program.client) {
    clear()
    console.log("⏰ ⏰ ⏰ Welcome to the Ethereum Alarm Clock client ⏰ ⏰ ⏰\n")

    if (!await eac.Util.checkNetworkID()) {
      console.log("  error: must be running a local node on the Ropsten or Kovan networks")
      process.exit(1)
    }

    alarmClient(
      web3,
      eac,
      program.provider,
      program.scan,
      program.milliseconds,
      program.logfile,
      program.logLevel, // 1 = debug, 2 = info, 3 = error
      program.wallet,
      program.password,
      program.autostart
    ).catch((err) => {
      throw err
    })
  } else if (program.schedule) {
    if (!await eac.Util.checkNetworkID()) {
      console.log("  error: must be running a localnode on the Ropsten or Kovan networks")
      process.exit(1)
    }
    if (!await eac.Util.checkForUnlockedAccount()) process.exit(1)

    const eacScheduler = await eac.scheduler()

    // Starts the scheduling wizard.
    clear()
    console.log("🧙 🧙 🧙  Schedule a transaction  🧙 🧙 🧙\n")

    let temporalUnit
    if (program.block) {
      temporalUnit = 1
    } else if (program.timestamp) {
      temporalUnit = 2
    } else {
      const unit = readlineSync.question("Do you want to use block or timestamps as the unit? [block/timestamp]\n")
      if (unit.toLowerCase() === "block") {
        temporalUnit = 1
      } else if (unit.toLowerCase() === "timestamp") {
        temporalUnit = 2
      } else {
        throw new Error("Invalid temporal unit.")
      }
    }

    let toAddress = readlineSync.question("Enter the recipient address:\n")
    if (!toAddress) {
      toAddress = "0xbbf5029fd710d227630c8b7d338051b8e76d50b3"
    }

    // Validate the address
    toAddress = ethUtil.addHexPrefix(toAddress)
    if (!eac.Util.checkValidAddress(toAddress)) {
      console.log("Not a valid address")
      console.log("[FATAL] exiting...")
      process.exit(1)
    }

    let callData = readlineSync.question("Enter call data: [press enter to skip]\n")

    if (!callData) {
      callData = "0x0"
    }
    callData = web3.toHex(callData)

    let callGas = readlineSync.question(`Enter the call gas: [press enter for recommended]\n`)

    if (!callGas) {
      callGas = 3000000
    }

    let callValue = readlineSync.question("Enter call value:\n")

    if (!callValue) {
      callValue = 123454321
    }

    let windowSize = readlineSync.question("Enter window size:\n")

    if (!windowSize) {
      windowSize = 255
    }

    const blockNum = await eac.Util.getBlockNumber()
    let windowStart = readlineSync.question(`Enter window start: [Current block number - ${blockNum}\n`)

    if (!windowStart) {
      windowStart = blockNum + 50
    }

    if (windowStart < blockNum + 25) {
      console.log("That window start time is too soon!")
      process.exit(1)
    }

    let gasPrice = readlineSync.question("Enter a gas price:\n")

    if (!gasPrice) {
      gasPrice = web3.toWei("50", "gwei")
    }

    let fee = readlineSync.question("Enter fee amount:\n")

    if (!fee) {
      fee = 33
    }

    let bounty = readlineSync.question("Enter bounty amount:\n")

    if (!bounty) {
      bounty = 10
    }

    let requiredDeposit = readlineSync.question("Enter required claim deposit:\n")

    if (!requiredDeposit) {
      requiredDeposit = web3.toWei("20", "finney")
    }

    clear()

    const endowment = eac.Util.calcEndowment(
      new BigNumber(callGas),
      new BigNumber(callValue),
      new BigNumber(gasPrice),
      new BigNumber(fee),
      new BigNumber(bounty)
    )

    console.log(`
toAddress       - ${toAddress}
callData        - ${callData}
callGas         - ${callGas}
callValue       - ${callValue}
windowSize      - ${windowSize}
windowStart     - ${windowStart}
gasPrice        - ${gasPrice}
fee             - ${fee}
bounty          - ${bounty}
requiredDeposit - ${requiredDeposit}

Sending from ${web3.eth.defaultAccount}
Endowment: ${web3.fromWei(endowment.toString())}
`)

    const confirm = readlineSync.question("Are all of these variables correct? [Y/n]\n")
    if (confirm === "" || confirm.toLowerCase() === "y") {
      // / Do nothing, just continue
    } else {
      console.log("quitting!")
      setTimeout(() => process.exit(1), 1500)
      return
    }

    eacScheduler.initSender({
      from: web3.eth.defaultAccount,
      gas: 3000000,
      value: endowment,
    })

    console.log("\n")
    const spinner = ora("Sending transaction! Waiting for a response...").start()

    temporalUnit === 1
      ? eacScheduler
        .blockSchedule(
        toAddress,
        callData,
        callGas,
        callValue,
        windowSize,
        windowStart,
        gasPrice,
        fee,
        bounty,
        requiredDeposit
        )
        .then((receipt) => {
          if (receipt.status !== '0x1') {
            spinner.fail(`Transaction was mined but failed. No transaction scheduled.`)
            process.exit(1)
          }
          spinner.succeed(`Transaction successful! Hash: ${receipt.transactionHash}\n`)
          console.log(`Address of the transaction request: ${eac.Util.getTxRequestFromReceipt(receipt)}`)
        })
        .catch((err) => {
          spinner.fail(err)
        })
      : eacScheduler
        .timestampSchedule(
        toAddress,
        callData,
        callGas,
        callValue,
        windowSize,
        windowStart,
        gasPrice,
        fee,
        bounty,
        requiredDeposit
        )
        .then((receipt) => {
          if (receipt.status !== '0x1') {
            spinner.fail(`Transaction was mined but failed. No transaction scheduled.`)
            process.exit(1)
          }
          spinner.succeed(`Transaction successful! Hash: ${receipt.transactionHash}\n`)
          console.log(`Address of the transaction request: ${eac.Util.getTxRequestFromReceipt(receipt)}`)
        })
        .catch((err) => {
          spinner.fail(err)
        })
  } else {
    console.log("\n  error: please start eac in either client `-c` or sheduling `-s` mode")
    process.exit(1)
  }
}

main().catch((e) => {
  if (e.toString().indexOf("Invalid JSON RPC") !== -1) {
    console.log(`  error: invalid RPC response, please make sure a local node is running.`)
  } else {
    console.log(`[FATAL] ${e}`)
  }
  process.exit(1)
})
