/* eslint no-await-in-loop: "off" */
const { routeTxRequest } = require('./routing.js')

class Scanner {
  constructor(ms, config) {
    this.ms = ms
    this.config = config
    this.log = config.logger
    this.cache = config.cache
    this.web3 = config.web3
    this.eac = config.eac

    this.requestTracker = this.config.tracker
    this.requestFactory = this.config.factory
    this.requestTracker.setFactory(this.requestFactory.address)

    this.log.info(`Scanning request tracker at ${this.config.tracker.address}`)
    this.log.info(`Validating results with factory at ${this.config.factory.address}`)
    this.log.info(`Scanning every ${this.ms / 1000} seconds.`)

    this.started = false
  }

  start() {
		// Reset the intervals if already started.
		if (this.started) this.stop()

		// Set interval for scanning for new transaction requests on the blockchain.
    this.blockchainScanning = setInterval(async () => {
			await this.scanBlockchain().catch(err => this.log.error(err))
		}, this.ms)

		// Set interval for scanning for actionable transaction requests in the cache.
		this.cacheScanning = setInterval(() => {
			this.scanCache().catch(err => this.log.error(err))
		}, this.ms + 1000)

		// Immediately execute both scans.
    this.scanBlockchain().catch(err => this.log.error(err))
    this.scanCache().catch(err => this.log.error(err))

		// Mark that we've started.
    this.started = true
    this.log.info('Scanning STARTED')
  }

  stop() {
		// Clear scanning intervasls.
    clearInterval(this.blockchainScanning)
    clearInterval(this.cacheScanning)

		// Mark that we've stopped.
    this.started = false
    this.log.info('Scanning STOPPED')
  }

  async scanBlockchain() {
    const latestBlock = await this.getBlock('latest')
    const { leftBlock, rightBlock } = this.getWindowForBlock(latestBlock.number)

    const leftTimestamp = (await this.getBlock(leftBlock)).timestamp
    const rightTimestamp = this.getRightTimestamp(leftTimestamp, latestBlock.timestamp)

    this.log.debug(`Scanning bounds from | blocks: ${leftBlock} to ${rightBlock} | timestamps: ${leftTimestamp} to ${rightTimestamp}`)

    this.scanBlocks(leftBlock, rightBlock)
    this.scanTimeStamps(leftTimestamp, rightTimestamp)
  }

  getWindowForBlock(latest) {
    const leftBlock = latest - this.config.scanSpread
    const rightBlock = leftBlock + (this.config.scanSpread * 2)

    return { leftBlock, rightBlock }
  }

  getRightTimestamp(leftTimestamp, latestTimestamp) {
    return 2 * latestTimestamp - leftTimestamp
  }

	/**
	 * Verifies that a transaction request is valid.
	 * @param {String} requestAddress Address of the transaction request.
	 */
  isCorrect(requestAddress) {
		// We hit the NULL_ADDRESS so there are no more transaction requests in the tracker.
    if (requestAddress === this.eac.Constants.NULL_ADDRESS) {
      this.log.debug('No new request discovered.')
      return false
    } else if (!this.eac.Util.checkValidAddress(requestAddress)) {
			// This should, conceivably, never happen unless there is a bug in eac.js-lib.
      throw new Error(`[${requestAddress}] Received invalid response from Request Tracker`)
    }

    return true
  }


  async fill(requestAddress) {
    const trackerWindowStart = await this.requestTracker.windowStartFor(requestAddress)
    const txRequest = await this.eac.transactionRequest(requestAddress)
    await txRequest.fillData()

    if (!txRequest.windowStart.equals(trackerWindowStart)) {
      this.log.error(`[${requestAddress}] Data mismatch between txRequest and requestTracker. Double check contract addresses.`)
      return null
    }

    return txRequest
  }

  async scanBlocks(left, right) {
    let firstRequestAddress = await this.requestTracker.previousFromRight(right)
    return this.scan(
      left,
      right,
      firstRequestAddress,
      windowStart => windowStart >= left,
      windowStart => {
        if (windowStart < left && windowStart > 105) {
          this.log.debug(`Scan exit condition hit! Previous window start preceeds left bound. WindowStart: ${
            windowStart
          } | left: ${left}`)

          return true
        }
        return false
      },
      currentRequestAddress => this.requestTracker.previousRequest(currentRequestAddress)
    )
  }

  async scanTimeStamps(left, right) {
    let firstRequestAddress = await this.requestTracker.nextFromLeft(left)
    return this.scan(
      left,
      right,
      firstRequestAddress,
      windowStart => windowStart <= right,
      windowStart => {
        if (windowStart > right) {
          this.log.debug(`Scan exit condition hit! Next window start exceeds right bound. WindowStart: ${
            windowStart
          } | right: ${right}`)

          return true
        }
        return false
      },
      currentRequestAddress => this.requestTracker.nextRequest(currentRequestAddress)
    )
  }

  /**
   * Scan is the main driver function of the Scanner class.
   * @param {Number} left The left bound to scan.
   * @param {Number} right The right bound to scan.
   * @param {String} firstRequest Address of a transaction request to start scanning from.
   * @param {Function} shouldStore A function taking windowStart and returning True is the transaction request should be stored.
   * @param {Function} atBound A function taking windowStart and returning True if scanning should continue and False if at bounds.
   * @param {Function} getNext A function taking the currentRequestAddress and returning the next request address.
   * @returns {void}
   */
  async scan(left, right, firstRequest, shouldStore, atBound, getNext) {
    let currentRequestAddress = firstRequest

    // Return if NULL_ADDRESS and no new transaction requests found.
    if (!this.isCorrect(currentRequestAddress)) return

    // Loop the cache storage logic while we still get valid transaction requests.
    while (currentRequestAddress !== this.eac.Constants.NULL_ADDRESS) {
      this.log.debug(`[${currentRequestAddress}] Discovered.`)
      if (!this.cache.has(currentRequestAddress)) {
        // If it's not already in cache, find windowStart.
        const txRequest = await this.fill(currentRequestAddress)

        if (txRequest && shouldStore(txRequest.windowStart)) {
          // If the windowStart returns True to `shouldStore(...)`, store it.
          this.store(txRequest)
        }
      } else {
        // Else, we have it in storage and can get the windowStart from our cache.
        const windowStart = parseInt(this.cache.get(currentRequestAddress))

        if (atBound(windowStart)) {
          // Stop looping if we hit the bounds.
          break
        }
      }

      // Get the next transaction request.
      currentRequestAddress = await getNext(currentRequestAddress)

      // Hearbeat
      if (currentRequestAddress === this.eac.Constants.NULL_ADDRESS) {
        this.log.debug('No new requests discovered.')
        break
      }
    }
  }

  async scanCache() {
    if (this.cache.len() === 0) return // nothing stored in cache

		// Get all transaction requests stored in cache and turn them into TransactionRequest objects.
    const allTxRequests = this.cache
      .stored()
      .map(address => this.eac.transactionRequest(address))

		// Get fresh data on our transaction requests and route them into appropiate action.
    Promise.all(allTxRequests).then((txRequests) => {
      txRequests.forEach((txRequest) => {
        txRequest.refreshData().then(() => routeTxRequest(this.config, txRequest))
      })
    })
  }

  getBlock(number = 'latest') {
    return new Promise((resolve, reject) => {
      this.web3.eth.getBlock(number, (err, block) => {
        if (!err) resolve(block)
        else reject(err)
      })
    })
  }

  store(txRequest) {
    this.log.info(`[${txRequest.address}] Storing.`)
    this.cache.set(txRequest.address, txRequest.windowStart)
  }
}

module.exports = { Scanner }