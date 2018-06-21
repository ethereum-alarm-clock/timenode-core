import { expect } from 'chai';
import { TimeNode, Config } from '../../src/index';
import { mockConfig } from '../helpers';

describe('TimeNode Unit Tests', () => {
    const config: Config = mockConfig();    
    let timenode: TimeNode;

    it('initializes a basic timenode', () => {
        timenode = new TimeNode(config);
        expect(timenode).to.exist;
    });

    it('starts scanning', async () => {
        const result: Boolean = await timenode.startScanning();
        expect(result).to.be.true;
        expect(timenode.scanner.scanning).to.be.true;
    });

    it('stops scanning', async () => {
        await timenode.stopScanning();
        expect(timenode.scanner.scanning).to.be.false;
    });
})
