/* eslint no-await-in-loop: "off" */
const { routeTxRequest } = require("./routing.js")

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
    if (this.started) this.stop()
  
    this.blockChainScanning = setInterval(async () => await this.scanBlockchain().catch(err => this.log.error(err)), this.ms)
    this.cacheScanning = setInterval(() => this.scanCache().catch(err => this.log.error(err)), this.ms + 1000)
  
    this.started = true
    this.log.info('Scanning STARTED')
  }
  
  stop() {
    clearInterval(this.blockChainScanning)
    clearInterval(this.cacheScanning)
    
    this.started = false
    this.log.info('Scanning STOPPED')
  }

  async scanBlockchain() {
    const latestBlock = await this.getBlock("latest")
    const leftBlock = latestBlock.number - this.config.scanSpread
    const rightBlock = leftBlock + (this.config.scanSpread * 2)
  
    const leftTimestamp = (await this.getBlock(leftBlock)).timestamp
    const avgBlockTime = Math.floor(latestBlock.timestamp - (leftTimestamp / this.config.scanSpread))
    const rightTimestamp = Math.floor(leftTimestamp + (avgBlockTime * this.config.scanSpread * 2))
  
    this.log.debug(`Scanning bounds from 
  [debug] blocks: ${leftBlock} to ${rightBlock}
  [debug] timestamps: ${leftTimestamp} tp ${rightTimestamp}`)
  
    this.scan(leftBlock, rightBlock)
    this.scan(leftTimestamp, rightTimestamp)
  }

  async scan(left, right) {
    let nextRequestAddress = await this.requestTracker.nextFromLeft(left)
  
    if (nextRequestAddress === this.eac.Constants.NULL_ADDRESS) {
      this.log.debug("No new requests.")
      return
    } else if (!this.eac.Util.checkValidAddress(nextRequestAddress)) {
      throw new Error(`Received invalid response from Request Tracker | Response: ${nextRequestAddress}`)
    }
  
    while (nextRequestAddress !== this.eac.Constants.NULL_ADDRESS) {
      this.log.debug(`Found request - ${nextRequestAddress}`)
      if (!this.cache.has(nextRequestAddress)) {
        const trackerWindowStart = await this.requestTracker.windowStartFor(nextRequestAddress)
        const txRequest = await this.eac.transactionRequest(nextRequestAddress)
        await txRequest.fillData()
  
        if (!txRequest.windowStart.equals(trackerWindowStart)) {
          // The data between the txRequest we have and from the requestTracker do not match.
          log.error(`Data mismatch between txRequest and requestTracker. Double check contract addresses.`)
        } else if (txRequest.windowStart.lessThanOrEqualTo(right)) {
          // This request is within bounds, store it.
          this.store(txRequest)
        }
      } else {
        const windowStart = parseInt(this.cache.get(nextRequestAddress)) //window start won't change after schedule
  
        if (windowStart > right) {
          this.log.debug(`Scan exit condition hit! Next window start exceeds right bound. WindowStart: ${
            windowStart
          } | right: ${right}`)
          break
        }
      }
  
      nextRequestAddress = await this.requestTracker.nextRequest(nextRequestAddress)
  
      // Hearbeat
      if (nextRequestAddress === this.eac.Constants.NULL_ADDRESS) {
        this.log.debug("No new requests.")
      }
    }
  }

  async scanCache() {
    if (this.cache.len() === 0) return // nothing stored in cache
  
    const allTxRequests = this.cache
      .stored()
      .map(address => this.eac.transactionRequest(address))
  
    Promise.all(allTxRequests).then((txRequests) => {
      txRequests.forEach((txRequest) => {
        txRequest.refreshData().then(() => routeTxRequest(this.config, txRequest))
      })
    })
  }

  getBlock(number = "latest") {
    return new Promise((resolve, reject) => {
      this.web3.eth.getBlock(number, (err, block) => {
        if (!err) resolve(block)
        else reject(err)
      })
    })
  }

  store(txRequest) {
    this.log.info(`Storing found transaction request at address ${txRequest.address}`)
    this.cache.set(txRequest.address, txRequest.windowStart)
  }
}

module.exports = { Scanner }