import { expect } from 'chai';

import { Config } from '../../src/index';
import { mockConfig, MockTxRequestTimestamp } from '../helpers';
import Actions from '../../src/Actions';

describe('Actions Unit Tests', () => {
    const config: Config = mockConfig();
    const tx: any = MockTxRequestTimestamp();
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
