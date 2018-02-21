const assert = require('chai').assert
const BigNumber = require("bignumber.js")
const scanning = require('../client/scanning')
const Cache = require('../client/cache')
let eac = require("eac.js-lib")()

const tx = [
  "0x47863b9E8C590323768E4352A78Ca759BBd37E8B",
  "0xE5CDce77122865032Ba5f584eAF393f06a493045",
  "0x002f7D343c75166856b6459c6a1967969AFc62e7"
]

class TxRequest {
  constructor(address) {
    this.address = address
  }

  fillData() {

  }

  get windowStart() {
    return new BigNumber(10)
  }
}

class RequestTracker {
  setFactory(address) {

  }

  nextFromLeft(left) {
    if (++left >= tx.length) return eac.Constants.NULL_ADDRESS

    return tx[left]
  }

  windowStartFor(address) {
    return 10
  }

  nextRequest(address) {
    let i = tx.findIndex(a => a === address)

    return ++i == tx.length ? eac.Constants.NULL_ADDRESS : tx[i]
  }

  get address() {
    return "{tracker address}"
  }
}

class RequestFactory {
  setFactory(address) {

  }

  nextFromLeft(left) {

  }

  get address() {
    return "{factory address}"
  }

  isKnownRequest(address) {
    return true
  }
}

const logger = {
  debug: x => {},
  log: x => {},
  info: x => {},
  cache: x => {}
}

describe('Scanning', () => {
  describe('#scan()', () => {
    eac.transactionRequest = address => new TxRequest(address)

    const { scan } = scanning
    const conf = {
      logger,
      tracker: new RequestTracker(),
      factory: new RequestFactory(),
      eac,
      cache: new Cache(logger)
    }

    it('should cache 2 last transactions', async () => {
      await scan(conf, 0, 10)

      assert.isFalse(conf.cache.has(tx[0]), `Transaction ${tx[0]} in cache`)

      tx.slice(1).map(t => {
        assert.isTrue(conf.cache.has(t), `Transaction ${t} not in cache`)
      })
    });
  });
});