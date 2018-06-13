import { expect } from 'chai';
import { TimeNode } from '../src/index';
import { mockConfig } from './helpers/mockConfig';

describe('TimeNode', () => {
  it('starts a basic timenode', () => {
    const config = mockConfig();
    this.timenode = new TimeNode(config);
    expect(this.timenode).to.exist;
  }).timeout(10000);

  it('starts scanning', async () => {
    const started = await this.timenode.startScanning();
    console.log(started);
    console.log('lol')
    expect(started).to.be.true;
  });

  // it('stops scanning', async () => {
  //   await this.timenode.stopScanning();
  //   expect(this.timenode.scanner.scanning).to.be.false;
  // })
})
