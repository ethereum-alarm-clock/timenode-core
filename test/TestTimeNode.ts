import { expect } from 'chai';
import { TimeNode } from '../src/index';
import { mockConfig } from './helpers/mockConfig';

describe('TimeNode', () => {
  it('starts a basic timenode', () => {
    const config = mockConfig();
    this.timenode = new TimeNode(config);
    expect(this.timenode).to.exist;
  });

  it('starts scanning', async () => {
    await this.timenode.startScanning();
    expect(this.timenode.scanner.scanning).to.be.true;
  });

  // it('stops scanning', async () => {
  //   await this.timenode.stopScanning();
  //   expect(this.timenode.scanner.scanning).to.be.false;
  // })
})
