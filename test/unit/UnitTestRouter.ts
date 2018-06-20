import { expect } from 'chai';

import { Config } from '../../src/index';
import { mockConfig, MockTxRequest } from '../helpers';
import Actions from '../../src/Actions';
import Router from '../../src/Router';

describe('Router Unit Tests', () => {
    const config: Config = mockConfig();
    const actions: Actions = new Actions(config);
    let router: Router;

    it('initializes the Router', () => {
        router = new Router(config, actions);
        expect(router).to.exist;
    });

})
