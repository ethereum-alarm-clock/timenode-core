import { expect } from 'chai';
import Cache from '../../src/Cache';
import { DefaultLogger } from '../../src/Logger';

if (process.env.RUN_ONLY_OPTIONAL_TESTS !== 'true') {
  describe('Cache', () => {
    let cache: Cache<any>;
    beforeEach(() => {
      cache = new Cache(new DefaultLogger());
    });

    it('stores and reads the key,value', () => {
      cache.set('key', 'value');

      const result = cache.get('key');
      expect(result).to.equals('value');
    });

    it('return proper length', () => {
      cache.set('key', 'value');

      const result = cache.length();
      expect(result).to.equals(1);
    });

    it('returns stored values', () => {
      cache.set('key', 'value');
      cache.set('key2', 'value2');

      const results = cache.stored();

      expect(results.length).to.equals(2);
      expect(results[0]).to.equals('key');
      expect(results[1]).to.equals('key2');
    });
  });
}
