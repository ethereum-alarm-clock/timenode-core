const assert = require('chai').assert
const BigNumber = require('bignumber.js')
const { Scanner } = require('../client/scanner')
const { Cache } = require('../client/cache')
const eac = require('eac.js-lib')()

const RequestFactoryMock = require('./helpers/RequestFactoryMock')
const RequestTrackerMock = require('./helpers/RequestTrackerMock')

const tx = [
  '0x47863b9E8C590323768E4352A78Ca759BBd37E8B',
  '0xE5CDce77122865032Ba5f584eAF393f06a493045',
  '0x002f7D343c75166856b6459c6a1967969AFc62e7',
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

  beforeClaimWindow() {
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
  const conf = {
    logger,
    tracker: new RequestTrackerMock(tx),
    factory: new RequestFactoryMock(),
    eac,
    cache: new Cache(logger),
    web3: {
      exists: true,
      version: {
        getNetwork(){
          return (null,42);
        }
      }
    },
    provider: 'provider',
    scanSpread: 100
  }

  const scanner = new Scanner(100, conf)

  describe('#getWindowForBlock', () => {
    it('should calculate window for blocks', () => {
      const latest = 1000
      const expectedLeft = 1000 - conf.scanSpread
      const expectedRight = 1000 + conf.scanSpread

      const { leftBlock, rightBlock } = scanner.getWindowForBlock(latest)

      assert.equal(expectedLeft, leftBlock)
      assert.equal(expectedRight, rightBlock)
    })
  })

  describe('#getRightTimestamp', () => {
    it('should calculate right bound of scanning window', () => {
      const getRightTimestamp = (leftTimestamp, latestTimestamp) => {
        const avgBlockTime = Math.floor((latestTimestamp - leftTimestamp) / conf.scanSpread)
        const rightTimestamp = Math.floor(leftTimestamp + (avgBlockTime * conf.scanSpread * 2))

        return rightTimestamp
      }

      const left = 1000000
      const latest = left + 1000 * 15
      const expectedRight = 2 * latest - left
      const expectedRightOldImpl = getRightTimestamp(left, latest)

      const right = scanner.getRightTimestamp(left, latest)

      assert.equal(expectedRight, right)
      assert.equal(expectedRightOldImpl, right)
    })

  })

  describe('#scanTimeStamps()', () => {
    eac.transactionRequest = address => new TxRequest(address)

    it('should cache 2 last transactions', async () => {
      await scanner.scanTimeStamps(0, 10)

      assert.isFalse(conf.cache.has(tx[0]), `Transaction ${tx[0]} in cache`)

      tx.slice(1).map(t => {
        assert.isTrue(conf.cache.has(t), `Transaction ${t} not in cache`)
      })
    })
  })

  // Unable to run, as it requires an actual web3 instance
  // describe('#watchBlockchain()', async () => {
  //   it('should start Request watcher', async () => {
  //     await scanner.watchBlockchain()
  //     assert.notEqual(scanner.requestWatcher ,null, `Failed to start Requests watcher`)
  //   })

  //   it('should stop Request watcher', async () => {
  //     scanner.requestWatcher.stopWatching( (e,r) => {
  //       assert.isTrue(r,`Failed to stop watcher`)
  //     })
  //   })
  // })
})