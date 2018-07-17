import { expect } from 'chai';
import Cache from '../../src/Cache';
import { DefaultLogger } from '../../src/Logger';
import { BigNumber } from 'bignumber.js';

if (process.env.RUN_ONLY_OPTIONAL_TESTS !== 'true') {
  describe('Cache', () => {
    let cache: Cache;
    beforeEach(() => {
      cache = new Cache(new DefaultLogger());
    });

    const EXAMPLE_VALUE = {
      windowStart: new BigNumber(0),
      claimedBy: '',
      wasCalled: false
    };

    const EXAMPLE_VALUE_2 = {
      windowStart: new BigNumber(2),
      claimedBy: '',
      wasCalled: true
    };

    it('stores and reads the key,value', () => {
      cache.set('key', EXAMPLE_VALUE);

      const result = cache.get('key');
      expect(result).to.equals(EXAMPLE_VALUE);
    });

    it('return proper length', () => {
      cache.set('key', EXAMPLE_VALUE);

      const result = cache.length();
      expect(result).to.equals(1);
    });

    it('returns stored values', () => {
      cache.set('key', EXAMPLE_VALUE);
      cache.set('key2', EXAMPLE_VALUE_2);

      const results = cache.stored();

      expect(results.length).to.equals(2);
      expect(results[0]).to.equals('key');
      expect(results[1]).to.equals('key2');
    });
  });
}
