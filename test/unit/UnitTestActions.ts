import { expect } from 'chai';

import { Config } from '../../src/index';
import { mockConfig, MockTxRequest } from '../helpers';
import Actions from '../../src/Actions';

describe('Actions Unit Tests', async () => {
    const config: Config = mockConfig();
    const tx: any = await MockTxRequest(config.web3);
    let actions: Actions;

    it('initializes the Actions with a Config', () => {
        actions = new Actions(config);
        expect(actions).to.exist;
    });

    // it('claim action', () => {
    //     const claimingResult = actions.claim(tx);
    //     expect(claimingResult).to.be.true;
    // });
})
