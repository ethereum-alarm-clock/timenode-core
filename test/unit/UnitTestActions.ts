import { expect } from 'chai';

import { Config } from '../../src/index';
import { mockConfig, MockTxRequest } from '../helpers';
import Actions from '../../src/Actions';

describe('Actions Unit Tests', () => {
    const config: Config = mockConfig();
    const tx: any = MockTxRequest();
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
