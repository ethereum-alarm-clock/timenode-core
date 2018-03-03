const eac = require("eac.js-lib")()

class RequestTrackerMock {
	constructor(initTx) {
		this.tx = initTx
	}

	addTx(tx) {
		this.tx.concat(tx)
	}

	setFactory(address) {

	}

	nextFromLeft(left) {
		if (++left >= this.tx.length) return eac.Constants.NULL_ADDRESS

		return this.tx[left]
	}

	windowStartFor(address) {
		return 10
	}

	nextRequest(address) {
		let i = this.tx.findIndex(a => a === address)

		return ++i == this.tx.length ? eac.Constants.NULL_ADDRESS : this.tx[i]
	}

	previousRequest(address) {
		let i = this.tx.findIndex(a => a === address)

		return --i < 0 ? eac.Constants.NULL_ADDRESS : this.tx[i]
	}

	get address() {
		return "{tracker address}"
	}
}

module.exports = RequestTrackerMock