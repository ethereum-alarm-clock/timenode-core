const assert = require('chai').assert
const { Analytics } = require('../client/analytics')

const KEENKCONSTS = {
    WRITEKEY: '',
    READKEY: ''
};
const nodeAddress = '0x47863b9E8C590323768E4352A78Ca759BBd37E8B';

class Web3 {
  constructor() {
    this.exists = true
  }

  get version () {
    return {
      getNetwork(callback) {
        callback (null, 3);
      }
    }
  }
}

describe('Analysis', () => {
  const web3 = new Web3();

  const analytics = new Analytics(KEENKCONSTS.WRITEKEY, KEENKCONSTS.READKEY, web3)

  describe('#getActiveNetwork()', () => {
    it('should fetch the active network Id', async () => {
      const expectedNetworkId = 3;
      await analytics.getActiveNetwork();
      const networkId = analytics.networkId;

      assert.equal(networkId, expectedNetworkId)
    })
  })

  describe('#startAnalytics()', () => {

    it('required functions should exist', () => {
      const notifyNetworkNodeActive = typeof analytics.notifyNetworkNodeActive;
      const pollActiveEacnodesCount = typeof analytics.pollActiveEacnodesCount;

      assert.equal(notifyNetworkNodeActive, 'function');
      assert.equal(pollActiveEacnodesCount, 'function');
    })

    // it('should attempt to start analytics', async () => {
    //   await analytics.startAnalytics(nodeAddress);

    //   assert.notEqual(analytics.notifyInterval, null);
    //   assert.notEqual(analytics.pollInterval, null);
    // })
  })

  describe('#stopAnalytics()', () => {

    // it('required functions should exist', () => {
    //   assert.notEqual(analytics.notifyInterval, null);
    //   assert.notEqual(analytics.pollInterval, null);
    // })

    // it('should attempt to stop analytics', async () => {
    //   await analytics.stopAnalytics();

    //   assert.equal(analytics.notifyInterval, null);
    //   assert.equal(analytics.pollInterval, null);
    // })
  })

})