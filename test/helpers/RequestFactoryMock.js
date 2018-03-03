class RequestFactoryMock {
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

module.exports = RequestFactoryMock