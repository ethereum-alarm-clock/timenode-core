const BigNumber = require("bignumber.js")
const hasPending = require("./pending.js")
const { Util } = require("eac.js-lib")()

const claim = async (conf, txRequest) => {
  const log = conf.logger
  const { web3 } = conf

  // All the checks have been done in routing, now we follow through on the actions.
  const claimPaymentModifier = (await txRequest.claimPaymentModifier()).dividedToIntegerBy(100)
  const paymentWhenClaimed = txRequest.bounty
    .times(claimPaymentModifier)
    .floor()
  const claimDeposit = txRequest.requiredDeposit
  const data = txRequest.claimData
  const sender = web3.eth.defaultAccount
  const gasToClaim = await Util.estimateGas(web3, {
    from: sender,
    to: txRequest.address,
    value: claimDeposit.toString(),
    data,
  })
  const currentGasPrice = new BigNumber(await Util.getGasPrice(web3))
  const gasCostToClaim = currentGasPrice.times(gasToClaim)

  if (gasCostToClaim.greaterThan(paymentWhenClaimed)) {
    log.debug(`Not profitable to claim. Returning`)
    log.debug(`gasCostToClaim: ${web3.fromWei(gasCostToClaim.toString())} | paymentWhenClaimed: ${web3.fromWei(paymentWhenClaimed.toString())}`)
    return Promise.resolve({ status: "0x0" })
  }

  // The dice roll was originally implemented in the Python client, which I followed
  // for inspiration here.
  const diceroll = Math.floor(Math.random() * 100)

  if (diceroll >= txRequest.claimPaymentModifier()) {
    log.debug(`Fate insists you wait until later.`)
    return Promise.resolve({ status: "0x0" })
  }

  log.info(`Attempting the claim of transaction request at address ${
    txRequest.address
  } | Payment: ${paymentWhenClaimed}`)
  conf.cache.set(txRequest.address, 102)

  if (conf.wallet) {
    // Wallet is enabled, claim from the next index.
    return conf.wallet.sendFromNext(
        txRequest.address,
        claimDeposit,
        gasToClaim + 21000,
        await Util.getGasPrice(web3),
        data
    )
  } else {
      // Wallet disabled, claim from default account
      return txRequest.claim().send({
          from: web3.eth.defaultAccount,
          value: claimDeposit,
          gas: gasToClaim + 21000,
          gasPrice: await Util.getGasPrice(web3),
      })
  }
}

const execute = async (conf, txRequest) => {
  const log = conf.logger
  const { web3 } = conf

  // txRequest.callGas + 180000 is the exact amount of gas needed by the transaction
  // to execute, however delegate call only recieves 63/64 of the total gas sent
  // so we send a bit extra
  const executeGas = txRequest.callGas.add(180000).div(64).times(65).round()
  const gasLimit = new BigNumber(web3.eth.getBlock("latest").gasLimit)

  const { gasPrice } = txRequest

  if (executeGas.greaterThan(gasLimit)) {
    return Promise.reject(new Error("Execution gas exceeds the network gas limit."))
  }

  log.info(`Attempting the execution of transaction request at address ${txRequest.address}`)
  conf.cache.set(txRequest.address, -1)

  if (conf.wallet) {
    const executeData = txRequest.executeData
    const walletClaimIndex =  conf.wallet.getAccounts().indexOf(txRequest.claimedBy)

    if (walletClaimIndex !== -1) {
        return conf.wallet.sendFromIndex(
            walletClaimIndex,
            txRequest.address,
            0,
            executeGas,
            gasPrice,
            executeData
        )
    } else {
        return conf.wallet.sendFromNext(
            txRequest.address,
            0,
            executeGas,
            gasPrice,
            executeData
        )
    }
  } else {
      return txRequest.execute({
          from: web3.eth.defaultAccount,
          value: 0,
          gas: executeGas,
          gasPrice: gasPrice
      })
  }
}

const cleanup = async (conf, txRequest) => {
  // const log = conf.logger
  const { web3 } = conf

  const txRequestBalance = await txRequest.getBalance()

  // If a transaction request has been executed it will route into this option.
  if (txRequestBalance.equals(0)) {
    // set for removal from cache
    conf.cache.set(txRequest.address, 99)
    return
  }

  if (!txRequest.isCancelled) {
    const sender = conf.wallet
      ? conf.wallet.getAccounts()[0]
      : web3.eth.defaultAccount
    const gasToCancel = await Util.estimateGas(web3, {
      from: sender,
      to: txRequest.address,
      value: "0",
      data: txRequest.cancelData,
    })
    const currentGasPrice = new BigNumber(await Util.getGasPrice(web3))
    const gasCostToCancel = currentGasPrice.times(gasToCancel)

    if (conf.wallet) {
      const ownerIndex = conf.wallet.getAccounts().indexOf(txRequest.getOwner())
      if (ownerIndex !== -1) {
          conf.wallet.sendFromIndex(
              ownerIndex,
              txRequest.address,
              0,
              gasToCancel + 21000,
              await web3.eth.getGasPrice(),
              cancelData
          )
      } else {
          // The more likely scenario is that one of our accounts is not the
          // owner of the expired transaction in which case, we check to see
          // if we will not lost money for sending this transaction then send
          // it from any account.
          if (gasCostToCancel.greaterThan(txRequestBalance)) {
              // The transaction request does not have enough money to compensate.
              return
          }
          conf.wallet.sendFromNext(
              txRequest.address,
              0,
              gasToCancel + 21000,
              await web3.eth.getGasPrice(),
              cancelData
          )
      }
    } else {
      if (txRequest.isClaimedBy(web3.eth.defaultAccount)) {
        txRequest.cancel({
          from: web3.eth.defaultAccount,
          value: 0,
          gas: gasToCancel + 21000,
          gasPrice: await Util.getGasPrice(web3),
        })
      } else {
        if (gasCostToCancel.greaterThan(txRequestBalance)) {
          return
        }
        txRequest.cancel({
          from: web3.eth.defaultAccount,
          value: 0,
          gas: gasToCancel + 21000,
          gasPrice: await Util.getGasPrice(web3),
        })
      }
    }
  }
  // Set all requests that make it here ready for deletion.
  conf.cache.set(txRequest.address, 99)
}

/**
 * Takes in a txRequest object and routes it to the thread that will act on it,
 * or returns if no action can be taken.
 * @param {Config} conf
 * @param {TxRequest} txRequest
 */
const routeTxRequest = async (conf, txRequest) => {
  const log = conf.logger
  const { web3 } = conf

  // Return early the transaction already has a pending transaction
  // in the transaction pool
  if (await hasPending(conf, txRequest)) {
    log.info(`Ignoring txRequest with pending transaction in the transaction pool.`)
    return
  }

  // Return early if the transaction request has been cancelled
  if (txRequest.isCancelled) {
    log.debug(`Ignorning already cancelled txRequest.`)
    return
  }

  // Return early if the transaction request is before claim window,
  // and therefore not actionable upon
  if (await txRequest.beforeClaimWindow()) {
    log.debug(`Ignoring txRequest not in claim window.`)
    return
  }

  // If the transaction request is in the claim window, we check if
  // it already claimed and if not, we claim it
  if (await txRequest.inClaimWindow()) {
    // The client set the txRequest to `attempted claim` and watch
    // for the result and either marked successfully `claimed` or not.
    // Using the cache codes is a primitive way to accomplish this.
    if (conf.cache.get(txRequest.address) <= 102) {
      // Already set in cache as having a claim request.
      return
    }
    if (txRequest.isClaimed) {
      // Already claimed, do not attempt to claim it again.
      log.debug(`TxRequest in claimWindow but is already claimed!`)
      // Set it to the cache number so it won't do this again.
      conf.cache.set(txRequest.address, 103)
      return
    }

    claim(conf, txRequest)
      .then((receipt) => {
        // If success set to claimed
        if (receipt.status == 1) {
          log.info(`Transaction request at ${txRequest.address} claimed!`)
          conf.cache.set(txRequest.address, 103)
          web3.eth.getTransaction(receipt.transactionHash, (err, txObj) => {
            if (!err) {
              conf.statsdb.updateClaimed(txObj.from)
            } else {
              log.error(err)
            }
          })
        } else
        // Or find the reason why it failed TODO
        {}
      })
      .catch(err => log.error(err))
    return
  }

  // If the transaction request is in the freeze period, it is not
  // actionable upon and we return early
  if (await txRequest.inFreezePeriod()) {
    log.debug(`Ignoring frozen txRequest. Now ${await txRequest.now()} | Window start: ${
      txRequest.windowStart
    }`)
    return
  }

  // If the transaction request is in the execution window, we can
  // attempt an execution of it
  if (await txRequest.inExecutionWindow()) {
    log.debug(``)
    if (conf.cache.get(txRequest.address) <= 99) return // waiting to be cleaned
    if (txRequest.wasCalled) {
      log.debug(`Already called.`)
      cleanup(conf, txRequest)
      return
    }
    if ((await txRequest.inReservedWindow()) && txRequest.isClaimed) {
      if (!txRequest.isClaimedBy(web3.eth.defaultAccount)) {
        log.debug(`In reserve window and not claimed by our account.`)
        return
      }
    }
    // This hacks the cache to set all executed requests to store the value
    // of -1 if it has been executed.
    if (conf.cache.get(txRequest.address) <= 101) {
      log.debug(`Skipping already executed txRequest.`)
      return
    }
    execute(conf, txRequest)
      .then((receipt) => {
        if (receipt.status == 1) {
          log.info(`Transaction request at ${txRequest.address} executed!`)
          conf.cache.set(txRequest.address, 100)
          web3.eth.getTransaction(receipt.transactionHash, (err, txObj) => {
            if (!err) {
              conf.statsdb.updateExecuted(txObj.from)
            } else {
              log.error(err)
            }
          })
        } else
        // Or find the reason why it failed TODO
        {}
      })
      .catch(err => log.error(err))
    return
  }

  // If the transaction request is expired, we try to clean it
  if (await txRequest.afterExecutionWindow()) {
    log.debug(`Cleaning up expired txRequest and removing from cache.`)
    cleanup(conf, txRequest)
  }
}

module.exports.routeTxRequest = routeTxRequest
