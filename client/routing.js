const BigNumber = require('bignumber.js')
const hasPending = require('./pending.js')
const { Util } = require('eac.js-lib')()

const isClaimedByUs = (conf, txRequest) => {
  const ourClaim = conf.wallet ?
                    conf.wallet.getAddresses().indexOf(txRequest.claimedBy) > -1
                    :
                    txRequest.isClaimedBy(conf.web3.eth.defaultAccount)

  if (!ourClaim) conf.logger.debug(`[${txRequest.address}] In reserve window and not claimed by our account.`)

  return ourClaim
}

const getSender = conf => conf.wallet ? conf.wallet.getAddresses()[0] : conf.web3.eth.defaultAccount

const isProfitableToClaim = async (conf, txRequest, gasToClaim) => {
  const { web3 } = conf
  const claimPaymentModifier = await txRequest.claimPaymentModifier()
  const paymentWhenClaimed = txRequest.bounty
    .times(claimPaymentModifier)
    .dividedToIntegerBy(100)

  const currentGasPrice = new BigNumber(await Util.getGasPrice(web3))
  const gasCostToClaim = currentGasPrice.times(gasToClaim)

  if (gasCostToClaim.greaterThan(paymentWhenClaimed)) {
    conf.logger.debug(`[${txRequest.address}] Not profitable to claim. gasCostToClaim: ${gasCostToClaim} | paymentWhenClaimed: ${paymentWhenClaimed}`)
    return { profitable: false, paymentWhenClaimed: 0 }
  }

  return { profitable: true, paymentWhenClaimed }
}

const claim = async (conf, txRequest) => {
  const log = conf.logger
  const { web3 } = conf

  // All the checks have been done in routing, now we follow through on the actions.
  const claimDeposit = txRequest.requiredDeposit
  const data = txRequest.claimData
  const sender = getSender(conf)
  const gasToClaim = await Util.estimateGas(web3, {
    from: sender,
    to: txRequest.address,
    value: claimDeposit.toString(),
    data,
  })

  const { profitable, paymentWhenClaimed } = await isProfitableToClaim(conf, txRequest, gasToClaim)
  if (!profitable) return Promise.resolve({ ignore: true })

  // The dice roll was originally implemented in the Python client, which I followed
  // for inspiration here.
  const diceroll = Math.floor(Math.random() * 100)

  if (diceroll >= txRequest.claimPaymentModifier()) {
    log.debug(`Fate insists you wait until later.`)
    return Promise.resolve({ ignore: true })
  }

  log.info(`[${txRequest.address}] Attempting the claim | Payment: ${paymentWhenClaimed}`)
  conf.cache.set(txRequest.address, 102)

  // FIXME: This is only a temporary check for now until we solve the
  // claiming mechanism problem.
  if (await hasPending(conf, txRequest)) {
    return
  }

  if (conf.wallet) {
    // Wallet is enabled, claim from the next index.
    return conf.wallet.sendFromNext({
        to: txRequest.address,
        value: claimDeposit,
        gas: gasToClaim + 21000,
        gasPrice: await Util.getGasPrice(web3),
        data
    })
  } else {
      // Wallet disabled, claim from default account
      return Promise.resolve({
        receipt: txRequest.claim({
          from: web3.eth.defaultAccount,
          value: claimDeposit,
          gas: gasToClaim + 21000,
          gasPrice: await Util.getGasPrice(web3),
      }),
        from: web3.eth.defaultAccount
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
  const gasLimit = new BigNumber(web3.eth.getBlock('latest').gasLimit)

  const { gasPrice } = txRequest

  if (executeGas.greaterThan(gasLimit)) {
    return Promise.reject(new Error(`[${txRequest.address}] Execution gas exceeds the network gas limit.`))
  }

  log.info(`[${txRequest.address}] Attempting the execution.`)
  conf.cache.set(txRequest.address, -1)

  if (conf.wallet) {
    const executeData = txRequest.executeData
    const walletClaimIndex =  conf.wallet.getAddresses().indexOf(txRequest.claimedBy)
    const opts = {
      to: txRequest.address,
      gas: executeGas,
      gasPrice,
      data: executeData,
      value: 0
    }

    if (walletClaimIndex !== -1) {
        // Returns a receipt
        return conf.wallet.sendFromIndex(
            walletClaimIndex,
            opts
        )
    } else {
        // Returns a receipt
        return conf.wallet.sendFromNext(opts)
    }
  } else {
      return Promise.resolve({
        receipt: await txRequest.execute({
          from: web3.eth.defaultAccount,
          value: 0,
          gas: executeGas,
          gasPrice: gasPrice
        }),
        from: web3.eth.defaultAccount
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
    const sender = getSender(conf)
    const gasToCancel = await Util.estimateGas(web3, {
      from: sender,
      to: txRequest.address,
      value: '0',
      data: txRequest.cancelData,
    })
    const currentGasPrice = new BigNumber(await Util.getGasPrice(web3))
    const gasCostToCancel = currentGasPrice.times(gasToCancel)
    const opts = {
      to: txRequest.address,
      value: 0,
      gas: gasToCancel + 21000,
      gasPrice: await web3.eth.getGasPrice(),
      data: txRequest.cancelData
    }

    if (conf.wallet) {
      const ownerIndex = conf.wallet.getAddresses().indexOf(txRequest.getOwner())
      if (ownerIndex !== -1) {
          conf.wallet.sendFromIndex(
              ownerIndex,
              opts
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
          conf.wallet.sendFromNext(opts)
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

const isExecuted = receipt => {
  if (receipt) {
    const executedEvent = '0x3e504bb8b225ad41f613b0c3c4205cdd752d1615b4d77cd1773417282fcfb5d9'
    return receipt.logs[0].topics.indexOf(executedEvent) > -1
  }

  return false
}

/**
 * Takes in a txRequest object and routes it to the thread that will act on it,
 * or returns if no action can be taken.
 * @param {Config} conf
 * @param {TxRequest} txRequest
 * @returns {Number} Magic number for what happened during routing. (Only used in tests.)
 */
const routeTxRequest = async (conf, txRequest) => {
  const log = conf.logger

  // Return early the transaction already has a pending transaction
  // in the transaction pool
  if (await hasPending(conf, txRequest)) {
    log.info(`[${txRequest.address}] Ignoring txRequest with pending transaction in the transaction pool.`)
    return 0
  }

  // Return early if the transaction request has been cancelled
  if (txRequest.isCancelled) {
    log.debug(`[${txRequest.address}] Ignorning already cancelled txRequest.`)
    return 1
  }

  // Return early if the transaction request is before claim window,
  // and therefore not actionable upon
  if (await txRequest.beforeClaimWindow()) {
    log.debug(`[${txRequest.address}] Ignoring txRequest not in claim window.`)
    return 2
  }

  // If the transaction request is in the claim window, we check if
  // it already claimed and if not, we claim it
  if (await txRequest.inClaimWindow()) {
    // The client set the txRequest to `attempted claim` and watch
    // for the result and either marked successfully `claimed` or not.
    // Using the cache codes is a primitive way to accomplish this.
    if (conf.cache.get(txRequest.address) <= 102) {
      // Already set in cache as having a claim request.
      return 3
    }
    if (txRequest.isClaimed) {
      // Already claimed, do not attempt to claim it again.
      log.debug(`[${txRequest.address}] TxRequest in claimWindow but is already claimed.`)
      // Set it to the cache number so it won't do this again.
      conf.cache.set(txRequest.address, 103)
      return 4
    }

    claim(conf, txRequest)
      .then(result => {
        const { receipt, from, ignore } = result

        receipt.then(result => {
          if (result && result.status == 1) {
            const gas = result.gasUsed * txRequest.data.txData.gasPrice

            log.info(`[${txRequest.address}] Claimed!`)
            conf.cache.set(txRequest.address, 103)
            conf.statsdb.updateClaimed(from, gas)
          } else if (!result && !ignore) {
            log.error(`[${txRequest.address}] Claiming failed.`)
          }
        })
      })
      .catch(err => log.error(err))
    return 5
  }

  // If the transaction request is in the freeze period, it is not
  // actionable upon and we return early
  if (await txRequest.inFreezePeriod()) {
    log.debug(`[${txRequest.address}] Ignoring frozen txRequest. Now ${await txRequest.now()} | Window start: ${
      txRequest.windowStart
    }`)
    return 6
  }

  // If the transaction request is in the execution window, we can
  // attempt an execution of it
  if (await txRequest.inExecutionWindow()) {
    if (conf.cache.get(txRequest.address) <= 99) return // waiting to be cleaned
    if (txRequest.wasCalled) {
      log.debug(`[${txRequest.address}] Already called.`)
      cleanup(conf, txRequest)
      return 7
    }
    if ((await txRequest.inReservedWindow()) && txRequest.isClaimed && !isClaimedByUs(conf, txRequest)) {
      return 8
    }
    // This hacks the cache to set all executed requests to store the value
    // of -1 if it has been executed.
    if (conf.cache.get(txRequest.address) <= 101) {
      log.debug(`[${txRequest.address}] Already executed.`)
      return 9
    }
    execute(conf, txRequest)
      .then(result => {
        const { web3 } = conf
        const { receipt, from } = result

        if (receipt) {
          if (receipt.status == 1) {
            const data = receipt.logs[0].data
            if (isExecuted(receipt)) {
              const timeBounty = web3.toDecimal(data.slice(0, 66))

              log.info(`[${txRequest.address}] Executed.`)
              conf.cache.set(txRequest.address, 100)
              conf.statsdb.updateExecuted(from, timeBounty, 0)
            } else {
              log.info(`[${txRequest.address}] Execution failed. Transaction already executed.`)
            }
          } else if ([0, '0x00', false].includes(receipt.status)) {
            const gas = result.gasUsed * txRequest.data.txData.gasPrice

            conf.statsdb.updateExecuted(from, 0, gas)
            log.info(`[${txRequest.address}] Transaction reverted.`)
          }
        } else {
          log.error(`[${txRequest.address}] Execution failed.`)
        }
      })
      .catch(err => log.error(err))
    return 10
  }

  // If the transaction request is expired, we try to clean it
  if (await txRequest.afterExecutionWindow()) {
    log.debug(`[${txRequest.address}] Cleaning up expired txRequest and removing from cache.`)
    cleanup(conf, txRequest)
    return 11
  }
}

module.exports.routeTxRequest = routeTxRequest
