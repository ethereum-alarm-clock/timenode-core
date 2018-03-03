const { BigNumber } = require("bignumber.js")
const RequestData = require("./requestData")
const Constants = require("../constants")
const Util = require("../util")()

class TxRequest {
  constructor(address, web3) {
    if (!Util.checkNotNullAddress(address)) {
      throw new Error("Attempted to instantiate a TxRequest class from a null address.")
    }
    this.web3 = web3
    this.instance = this.web3.eth
      .contract(Util.getABI("TransactionRequestCore"))
      .at(address)
  }

  get address() {
    return this.instance.address
  }

  /**
   * Window centric getters
   */

  get claimWindowSize() {
    return this.data.schedule.claimWindowSize
  }

  get claimWindowStart() {
    return this.windowStart.minus(this.freezePeriod).minus(this.claimWindowSize)
  }

  get claimWindowEnd() {
    return this.claimWindowStart.plus(this.claimWindowSize)
  }

  get freezePeriod() {
    return this.data.schedule.freezePeriod
  }

  get freezePeriodStart() {
    return this.windowStart.plus(this.claimWindowSize)
  }

  get freezePeriodEnd() {
    return this.claimWindowEnd.plus(this.freezePeriod)
  }

  get temporalUnit() {
    return this.data.schedule.temporalUnit
  }

  get windowSize() {
    return this.data.schedule.windowSize
  }

  get windowStart() {
    return this.data.schedule.windowStart
  }

  get reservedWindowSize() {
    return this.data.schedule.reservedWindowSize
  }

  get reservedWindowEnd() {
    return this.windowStart.plus(this.reservedWindowSize)
  }

  get executionWindowEnd() {
    return this.windowStart.plus(this.windowSize)
  }

  /**
   * Dynamic getters
   */

  async now() {
    if (this.temporalUnit == 1) {
      return new BigNumber(await Util.getBlockNumber(this.web3))
    } else if (this.temporalUnit == 2) {
      const timestamp = await Util.getTimestamp(this.web3)
      return new BigNumber(timestamp)
    }
    throw new Error(`Unrecognized temporal unit: ${this.temporalUnit}`)
  }

  async beforeClaimWindow() {
    const now = await this.now()
    return this.claimWindowStart.greaterThan(now)
  }

  async inClaimWindow() {
    const now = await this.now()
    return (
      this.claimWindowStart.lessThanOrEqualTo(now) &&
      this.claimWindowEnd.greaterThan(now)
    )
  }

  async inFreezePeriod() {
    const now = await this.now()
    return (
      this.claimWindowEnd.lessThanOrEqualTo(now) &&
      this.freezePeriodEnd.greaterThan(now)
    )
  }

  async inExecutionWindow() {
    const now = await this.now()
    return (
      this.windowStart.lessThanOrEqualTo(now) &&
      this.executionWindowEnd.greaterThanOrEqualTo(now)
    )
  }

  async inReservedWindow() {
    const now = await this.now()
    return (
      this.windowStart.lessThanOrEqualTo(now) &&
      this.reservedWindowEnd.greaterThan(now)
    )
  }

  async afterExecutionWindow() {
    const now = await this.now()
    return this.executionWindowEnd.lessThan(now)
  }

  /**
   *
   */
  createdAt() {

  }

  executedAt() {

  }

  /**
   * Claim props/methods
   */

  get claimedBy() {
    return this.data.claimData.claimedBy
  }

  get isClaimed() {
    return this.data.claimData.claimedBy !== Constants.NULL_ADDRESS
  }

  isClaimedBy(address) {
    return this.claimedBy === address
  }

  get requiredDeposit() {
    return this.data.claimData.requiredDeposit
  }

  async claimPaymentModifier() {
    const now = await this.now()
    const elapsed = now.minus(this.claimWindowStart)
    return elapsed.times(100).dividedToIntegerBy(this.claimWindowSize)
  }

  /**
   * Meta
   */

  get isCancelled() {
    return this.data.meta.isCancelled
  }

  get wasCalled() {
    return this.data.meta.wasCalled
  }

  get wasSuccessful() {
      return this.data.meta.wasSuccessful
  }

  get owner() {
    return this.data.meta.owner
  }

  /**
   * TxData
   */

  get toAddress() {
    return this.data.txData.toAddress
  }

  get callGas() {
    return this.data.txData.callGas
  }

  get callValue() {
    return this.data.txData.callValue
  }

  get gasPrice() {
    return this.data.txData.gasPrice
  }

  get fee() {
    return this.data.paymentData.fee
  }

  get bounty() {
    return this.data.paymentData.bounty
  }

  /**
   * Call Data
   */

  callData() {
    return new Promise((resolve, reject) => {
      this.instance.callData.call((err, callData) => {
        if (!err) resolve(callData)
        else reject(err)
      })
    })
  }

  /**
   * Data management
   */

  async fillData() {
    const requestData = await RequestData.from(this.instance)
    this.data = requestData
    return true
  }

  async refreshData() {
    if (!this.data) {
      return this.fillData()
    }
    return this.data.refresh()
  }

  /**
   * ABI convenience functions
   */

  get claimData() {
    return this.instance.claim.getData()
  }

  get executeData() {
    return this.instance.execute.getData()
  }

  get cancelData() {
    return this.instance.cancel.getData()
  }

  /**
   * Action Wrappers
   */

  /**
   * @param {Object} params Transaction object including `from`, `gas`, `gasPrice` and `value`.
   */
  claim(params) {
    return new Promise((resolve, reject) => {
      this.instance.claim(params, (err, txHash) => {
        if (err) reject(err)
        else {
          Util.waitForTransactionToBeMined(this.web3, txHash)
            .then(receipt => resolve(receipt))
            .catch(e => reject(e))
        }
      })
    })
  }

  /**
   * @param {Object} params Transaction object including `from`, `gas`, `gasPrice` and `value`.
   */
  execute(params) {
    return new Promise((resolve, reject) => {
      this.instance.execute(params, (err, txHash) => {
        if (err) reject(err)
        else {
          Util.waitForTransactionToBeMined(this.web3, txHash)
            .then(receipt => resolve(receipt))
            .catch(e => reject(e))
        }
      })
    })
  }

  /**
   * @param {Object} params Transaction object including `from`, `gas`, `gasPrice` and `value`.
   */
  cancel(params) {
    return new Promise((resolve, reject) => {
      this.instance.cancel(params, (err, txHash) => {
        if (err) reject(err)
        else {
          Util.waitForTransactionToBeMined(this.web3, txHash)
            .then(receipt => resolve(receipt))
            .catch(e => reject(e))
        }
      })
    })
  }

  /**
   * Proxy
   * @param {string} toAddress Ethereum address
   * @param {string} data Hex encoded data for the transaction to proxy
   * @param {Object} params Transaction object including `from`, `gas`, `gasPrice` and `value`.
   */
  proxy(toAddress, data, params) {
    return new Promise((resolve, reject) => {
      this.instance.proxy(toAddress, data, params, (err, txHash) => {
        if (err) reject(err)
        else {
          Util.waitForTransactionToBeMined(this.web3, txHash)
            .then(resolve) // resolves the receipt
            .catch(reject) // rejects the error
        }
      })
    })
  }

  /**
   * Pull Payments
   */

  refundClaimDeposit(params) {
    return new Promise((resolve, reject) => {
      this.instance.refundClaimDeposit(params, (err, txHash) => {
        if (err) reject(err)
        else {
          Util.waitForTransactionToBeMined(this.web3, txHash)
            .then(resolve)
            .catch(reject)
        }
      })
    })
  }

  sendFee(params) {
    return new Promise((resolve, reject) => {
      this.instance.sendFee(params, (err, txHash) => {
        if (err) reject(err)
        else {
          Util.waitForTransactionToBeMined(this.web3, txHash)
            .then(resolve)
            .catch(reject)
        }
      })
    })
  }

  sendBounty(params) {
    return new Promise((resolve, reject) => {
      this.instance.sendBounty(params, (err, txHash) => {
        if (err) reject(err)
        else {
          Util.waitForTransactionToBeMined(this.web3, txHash)
            .then(resolve)
            .catch(reject)
        }
      })
    })
  }

  sendOwnerEther(params) {
    return new Promise((resolve, reject) => {
      this.instance.sendOwnerEther(params, (err, txHash) => {
        if (err) reject(err)
        else {
          Util.waitForTransactionToBeMined(this.web3, txHash)
            .then(resolve)
            .catch(reject)
        }
      })
    })
  }

  /**
   * Misc.
   */

  async getBalance() {
    const bal = await Util.getBalance(this.web3, this.address)
    return new BigNumber(bal)
  }
}

module.exports = TxRequest
