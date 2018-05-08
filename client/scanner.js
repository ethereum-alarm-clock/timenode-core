/* eslint no-await-in-loop: 'off' */
const { routeTxRequest } = require('./routing.js')
const clientVersion = require('../package.json').version;
const SCAN_DELAY = 1;
const { CACHE_STATE } = require('./cache.js')

class Scanner {
  constructor(ms, config) {
    this.ms = ms
    this.config = config
    this.log = config.logger
    this.cache = config.cache
    this.web3 = config.web3
    this.eac = config.eac
    this.logNetwork();

    this.requestTracker = this.config.tracker
    this.requestFactory = this.config.factory
    this.requestTracker.setFactory(this.requestFactory.address)

    this.log.info(`eac.js-client : version ${clientVersion}`)
    this.log.info(`Scanning request tracker at ${this.config.tracker.address}`)
    this.log.info(`Validating results with factory at ${this.config.factory.address}`)
    this.log.info(`Scanning every ${this.ms * SCAN_DELAY / 1000} seconds.`)

    this.started = false
  }

  logNetwork() {
    const Networks = {
      0: 'Private',
      1: 'Mainnet',
      2: 'Mordern',
      3: 'Ropsten',
      4: 'Rinkeby',
      42: 'Kovan'

    }
    this.web3.version.getNetwork( (err,res) => {
      if (err) {
        this.log.error(`Unable to connect to a Network`)
      }
      this.log.info(`Network : ${Networks[res || 0]} Network`)
    });
  }

  start() {
		// Reset the intervals if already started.
		if (this.started) this.stop()

    // Set interval for scanning for new transaction requests on the blockchain.
    // Scanning runs less frequently as a check for the watch function
    this.blockchainScanning = setInterval(async () => {
			await this.scanBlockchain().catch(err => this.log.error(err))
    }, this.ms * SCAN_DELAY)

		// Set interval for scanning for actionable transaction requests in the cache.
		this.cacheScanning = setInterval(() => {
			this.scanCache().catch(err => this.log.error(err))
		}, this.ms )

		// Immediately execute both scans.
    this.scanBlockchain().catch(err => this.log.error(err))
    this.scanCache().catch(err => this.log.error(err))
    this.watchBlockchain();

		// Mark that we've started.
    this.started = true
    this.log.info('Scanning STARTED')
  }

  async stop() {
		// Clear scanning intervasls.
    clearInterval(this.blockchainScanning)
    clearInterval(this.cacheScanning);
    if (this.requestWatcher) {
      await this.requestFactory.stopWatch(this.requestWatcher)
      this.log.info('Watching STOPPED')
    }

		// Mark that we've stopped.
    this.started = false
    this.log.info('Scanning STOPPED')
  }

  isValidBlock(block) {
    if (!block) {
      return false
    }

    return true
  }

  async isExecutable(txRequest) {
    return await txRequest.beforeClaimWindow() || await txRequest.inClaimWindow() || await txRequest.inFreezePeriod() || await txRequest.inExecutionWindow()
  }

  async scanBlockchain() {
    const latestBlockObject = await this.getBlock('latest')
    const { leftBlock, rightBlock } = this.getWindowForBlock(latestBlockObject.number)

    const leftBlockObject = await this.getBlock(leftBlock)
    const leftTimestamp = leftBlockObject.timestamp
    const rightTimestamp = this.getRightTimestamp(leftTimestamp, latestBlockObject.timestamp)

    this.log.debug(`Scanning bounds from | blocks: ${leftBlock} to ${rightBlock} | timestamps: ${leftTimestamp} to ${rightTimestamp}`)

    await this.scanBlocks(leftBlock, rightBlock)
    await this.scanTimeStamps(leftTimestamp, rightTimestamp)
  }

  getWindowForBlock(latest) {
    const leftBlock = this.getLeftBlock(latest)
    const rightBlock = leftBlock + (this.config.scanSpread * 2)

    return { leftBlock, rightBlock }
  }

  getLeftBlock(latest) {
    const leftBlock = latest - this.config.scanSpread
    return leftBlock < 0 ? 0 : leftBlock
  }

  getRightTimestamp(leftTimestamp, latestTimestamp) {
    return 2 * latestTimestamp - leftTimestamp
  }

  async watchBlockchain() {
    this.web3.currentProvider.sendAsync({
      jsonrpc: '2.0', id: 1, method: 'eth_getFilterLogs', params: []
    }, async (e) => {

      if (e !== null) {
        this.log.info(`Watching DISABLED`)
        return;
      }

      const latestBlock = await this.getBlock('latest')
      const startBlock = this.getLeftBlock(latestBlock.number)

      this.log.info(`Watching STARTED`)
      this.log.debug(`Watching for new Requests from | block: ${startBlock} `)

      this.watchBlocks(startBlock)
    });
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
      // try get the value from cache, fallback to -1 as default
      let windowStart = parseInt(this.cache.get(currentRequestAddress, -1))

      if (windowStart === -1) {
        // If it's not already in cache, find windowStart.
        const txRequest = await this.fill(currentRequestAddress)
        windowStart = txRequest.windowStart

        if (txRequest && shouldStore(windowStart) && this.isExecutable(txRequest)) {
          // If the windowStart returns True to `shouldStore(...)`, store it.
          this.store(txRequest)
        }
      }

      // always check if we already hit bounds
      if (atBound(windowStart)) {
        // Stop looping if we hit the bounds.
        break
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

  /**
   * Watch for new transactions as they are created.
   * @param {Number} fromBlock The block from which to begin watch.
   * @returns {void}
   */
  async watchBlocks(fromBlock) {
    const requestFactory = await this.eac.requestFactory();
    this.requestWatcher = await requestFactory.watchRequests(fromBlock,
      async (request) => {
        if (!this.isCorrect(request)) return;

        this.log.debug(`[${request}] Discovered.`)
        if (!this.cache.has(request)) {
          // If it's not already in cache, find windowStart.
          const txRequest = await this.fill(request)

          if (txRequest && await this.isExecutable(txRequest) ) {
            // If the isExecutable returns True, store it.
            this.store(txRequest)
            routeTxRequest(this.config, txRequest)
          }
        }
    })
  }

  async scanCache() {
    if (this.cache.len() === 0) return // nothing stored in cache

		// Get all transaction requests stored in cache and turn them into TransactionRequest objects.
    const allTxRequests = this.cache
      .stored()
      .filter(address => this.cache.get(address) > CACHE_STATE.EXPIRED)
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
        if (!err)
          if (block) resolve(block)
          else reject(`Returned block ${number} is null`)
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