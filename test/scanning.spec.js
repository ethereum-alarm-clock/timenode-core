const assert = require('chai').assert
const BigNumber = require("bignumber.js")
const { Scanner } = require('../client/scanner')
const Cache = require('../client/cache')
const eac = require("eac.js-lib")()


const RequestFactoryMock = require('./helpers/RequestFactoryMock')
const RequestTrackerMock = require('./helpers/RequestTrackerMock')

const tx = [
  "0x47863b9E8C590323768E4352A78Ca759BBd37E8B",
  "0xE5CDce77122865032Ba5f584eAF393f06a493045",
  "0x002f7D343c75166856b6459c6a1967969AFc62e7",
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

const logger = {
  debug: x => {},
  log: x => {},
  info: x => {},
  cache: x => {}
}

// describe('Scanning', () => {
//   describe('#scan()', () => {
//     eac.transactionRequest = address => new TxRequest(address)

//     const conf = {
//       logger,
//       tracker: new RequestTrackerMock(tx),
//       factory: new RequestFactoryMock(),
//       eac,
//       cache: new Cache(logger),
//       web3: {exists: true},
//       provider: 'provider',
//     }

//     const scanner = new Scanner(100, conf)

//     it('should cache 2 last transactions', async () => {
//       await scanner.scanTimeStamps(0, 10)

//       assert.isFalse(conf.cache.has(tx[0]), `Transaction ${tx[0]} in cache`)

//       tx.slice(1).map(t => {
//         assert.isTrue(conf.cache.has(t), `Transaction ${t} not in cache`)
//       })
//     });
//   });
// });