const { assert } = require('./helpers/assert');
const expect = require('chai').expect;
const { TimeNode } = require('../index');
const standardConfig = require('./helpers/standardConfig');

describe('TimeNode', () => {
  timenode = null;

  it('starts a basic timenode', () => {
    const config = standardConfig();
    this.timenode = new TimeNode(config);
    expect(this.timenode).to.exist;
  })

  it('starts scanning', async () => {
    await this.timenode.startScanning();
    expect(this.timenode.scanner.scanning).to.be.true;
  })

  it('stops scanning', async () => {
    await this.timenode.stopScanning();
    expect(this.timenode.scanner.scanning).to.be.false;
  })
})
