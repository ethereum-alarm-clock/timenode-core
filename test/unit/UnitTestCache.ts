import { expect, assert } from 'chai';
import Cache from '../../src/Cache';
import { DefaultLogger } from '../../src/Logger';

describe('Cache unit tests', () => {
  let cache: Cache<any>;

  beforeEach(() => {
    cache = new Cache(new DefaultLogger());
  });

  describe('get()', () => {
    it('get the key value', () => {
      cache.set('key', 'value');
      const result = cache.get('key');
      expect(result).to.equals('value');
    });

    it('throws an error if value is undefined', () => {
      cache.set('key', undefined);
      expect(() => cache.get('key')).to.throw();
    });

    it('returns `d` if value and `d` is undefined', () => {
      cache.set('key', undefined);
      const d = () => console.log('callback');
      const result = cache.get('key', d);
      assert.equal(result, d);
    });
  });

  describe('length()', () => {
    it('return proper length', () => {
      cache.set('key', 'value');
      const result = cache.length();
      expect(result).to.equals(1);
    });
  });

  describe('stored()', () => {
    it('returns stored values', () => {
      cache.set('key', 'value');
      cache.set('key2', 'value2');

      const results = cache.stored();

      expect(results.length).to.equals(2);
      expect(results[0]).to.equals('key');
      expect(results[1]).to.equals('key2');
    });
  });

  describe('del()', () => {
    it('returns stored values', () => {
      const key = 'key';
      cache.set(key, 'value');
      cache.del(key);
      expect(() => cache.get(key)).to.throw();
    });
  });

  describe('has()', () => {
    it('returns true when value is in cache', () => {
      cache.set('key', 'value');
      assert.isTrue(cache.has('key'));
    });

    it('returns false when value is not in cache', () => {
      assert.isFalse(cache.has('key'));
    });
  });
});
