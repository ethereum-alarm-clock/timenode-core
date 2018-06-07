const standardConfig = require('./helpers/standardConfig');

describe('Config', () => {
    it('creates a config from standard params', () => {
        const config = standardConfig();
        assert(config);
    })
})
