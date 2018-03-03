const Cache = require('../client/cache')
const { Config } = require('../index')
const { routeTxRequest } = require('../client/routing')

const RequestFactoryMock = require('./helpers/RequestFactoryMock')
const RequestTrackerMock = require('./helpers/RequestTrackerMock')

const BigNumber = require('bignumber.js')
const eac = require("eac.js-lib")()
const { expect } = require('chai')

const tx = [
	"0x47863b9E8C590323768E4352A78Ca759BBd37E8B",
	"0xE5CDce77122865032Ba5f584eAF393f06a493045",
	"0x002f7D343c75166856b6459c6a1967969AFc62e7",
	"0xCa3e42CC90F3f6ED038C43f57D701df4027D7D83",
	"0xbB0B08590a6546A1742Fb37573B3f26C22ACF533",
	"0x082E13494f12EBB7206FBf67E22A6E1975A1A669",
	"0x09536dEA53e6D58d9844ec683854c40400435C8b",
]

const logger = {
	debug: x => 'debug',
	log: x => 'log',
	info: x => 'info',
	cache: x => 'cache',
	error: x => 'error',
}

class TxRequest {
	constructor(address) {
		this.address = address
	}

	fillData() {

	}

	now() {
		return new BigNumber(10)
	}

  beforeClaimWindow() {
    const now =  this.now()
    return this.claimWindowStart.greaterThan(now)
  }
}

describe('Routing', () => {
	describe('#routeTxRequest', () => {
		const config = Config.create({
			logger,
			factory: new RequestFactoryMock(),
			tracker: new RequestTrackerMock(tx),
			eac,
			cache: new Cache(logger),
			web3: {exists: true},
      provider: 'provider',
		})

		it('routes `isCancelled`', () => {
			const TR_1 = new TxRequest(tx[0])
			TR_1.isCancelled = true
			routeTxRequest(config, TR_1)
			.then(res => {
				expect(res).to.equal(1)
			})
		})

		it('routes `beforeClaimWindow()`', () => {
			const TR_2 = new TxRequest(tx[1])
			TR_2.claimWindowStart = new BigNumber(20)
			// claimWindowStart > now ?
			routeTxRequest(config, TR_2)
			.then(res => {
				expect(res).to.equal(2)
			})
		})

		it('routes `inClaimWindow()`', () => {
			const TR_3 = new TxRequest(tx[2])
			config.cache.set(tx[2], 102)
			TR_3.claimWindowStart = new BigNumber(5)
			TR_3.inClaimWindow = () => true
			routeTxRequest(config, TR_3)
			.then(res => {
				expect(res).to.equal(3)
			})
		})

		it('routes `isClaimed`', () => {
			const TR_4 = new TxRequest(tx[3])
			config.cache.set(tx[3], 3000)
			TR_4.claimWindowStart = new BigNumber(5)
			TR_4.inClaimWindow = () => true
			TR_4.isClaimed = true
			routeTxRequest(config, TR_4)
			.then(res => {
				expect(res).to.equal(4)
				expect(config.cache.get(tx[3])).to.equal(103)
			})
		})

		it('routes `claim()`', () => {
			const TR_5 = new TxRequest(tx[4])
			config.cache.set(tx[4], 3000)
			TR_5.claimWindowStart = new BigNumber(5)
			TR_5.inClaimWindow = () => true
			routeTxRequest(config, TR_5)
			.then(res => {
				expect(res).to.equal(5)
			})
		})

		it('routes `inFreezePeriod()`', () => {

		})

		it('routes `inExecutionWindow()`', () => {

		})

		it('routes `execute()`', () => {

		})

		it('routes `afterExecutionWindow()`', () => {

		})
	})
})