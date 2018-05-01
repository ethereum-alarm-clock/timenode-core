const { Cache, CACHE_STATE } = require('../client/cache')
const { Config } = require('../index')
const { routeTxRequest, ROUTING_RESULT } = require('../client/routing')

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
	"0x416299AAde6443e6F6e8ab67126e65a7F606eeF5",
	"0xF910faC699d8e5A19Ec9B1d750c9593F466D3694",
	"0xC4011E55471b232B61F1a746b20FCa1713Efec74",
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

	getBalance() {
		return new BigNumber(120000)
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
			web3: {
				exists: true,
				eth: {
					defaultAccount: '0x89174A102f1aDba064Db5324198902B2Ee7952eB',
					estimateGas: () => 50000
				}
			},
      provider: 'provider',
		})

		it('routes `isCancelled`', async() => {
			const TR_1 = new TxRequest(tx[0])
			TR_1.isCancelled = true
			const res = await routeTxRequest(config, TR_1)

			expect(res).to.equal(ROUTING_RESULT.CANCELLED)
		})

		it('routes `beforeClaimWindow()`', async() => {
			const TR_2 = new TxRequest(tx[1])
			TR_2.claimWindowStart = new BigNumber(20)
			// claimWindowStart > now ?
			const res = await routeTxRequest(config, TR_2)

			expect(res).to.equal(2)
		})

		it('routes `inClaimWindow()`', async() => {
			const TR_3 = new TxRequest(tx[2])
			config.cache.set(tx[2], CACHE_STATE.ATTEMPTED_CLAIM)
			TR_3.claimWindowStart = new BigNumber(5)
			TR_3.inClaimWindow = () => true
			const res = await routeTxRequest(config, TR_3)

			expect(res).to.equal(3)
		})

		it('routes `isClaimed`', async() => {
			const TR_4 = new TxRequest(tx[3])
			config.cache.set(tx[3], 3000)
			TR_4.claimWindowStart = new BigNumber(5)
			TR_4.inClaimWindow = () => true
			TR_4.isClaimed = true
			const res = await routeTxRequest(config, TR_4)

			expect(res).to.equal(4)
			expect(config.cache.get(tx[3])).to.equal(CACHE_STATE.CLAIMED)
		})

		it('routes `claim()`', async() => {
			const TR_5 = new TxRequest(tx[4])
			config.cache.set(tx[4], 3000)
			TR_5.claimWindowStart = new BigNumber(5)
			TR_5.inClaimWindow = () => true
			const res = await routeTxRequest(config, TR_5)

			expect(res).to.equal(5)
		})

		it('routes `inFreezePeriod()`', async() => {
			const TR_6 = new TxRequest(tx[5])
			TR_6.claimWindowStart = new BigNumber(5)
			TR_6.inClaimWindow = () => false
			TR_6.inFreezePeriod = () => true
			const res = await routeTxRequest(config, TR_6)

			expect(res).to.equal(6)
		})

		it('routes `inExecutionWindow()`', async() => {
			const TR_7 = new TxRequest(tx[6])
			config.cache.set(tx[6], 3000)
			TR_7.claimWindowStart = new BigNumber(5)
			TR_7.inClaimWindow = () => false
			TR_7.inFreezePeriod = () => false
			TR_7.inExecutionWindow = () => true
			TR_7.wasCalled = true
			const res = await routeTxRequest(config, TR_7)

			expect(res).to.equal(7)
		})

		it('routes `execute()`', () => {

		})

		it('routes `afterExecutionWindow()`', () => {

		})
	})
})