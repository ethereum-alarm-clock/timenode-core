/* tslint:disable:no-unused-expression */
import { assert, expect } from 'chai';
import * as TypeMoq from 'typemoq';

import { Config } from '../../src';
import IRouter from '../../src/Router';
import Scanner from '../../src/Scanner';
import { mockConfig } from '../helpers';
import { Util } from '@ethereum-alarm-clock/lib';

let config: Config;
let scanner: Scanner;

const reset = async () => {
  const router = TypeMoq.Mock.ofType<IRouter>();
  config = await mockConfig();

  scanner = new Scanner(config, router.object);
};

beforeEach(reset);

describe('Scanner Unit Tests', () => {
  it('initializes the Scanner', () => {
    scanner = new Scanner(config, null);
    expect(scanner).to.exist;
  });

  describe('start()', async () => {
    it('returns true for scanning and chainScanner/cacheScanner', async () => {
      await scanner.start();
      assert.isTrue(scanner.scanning);
      expect(scanner.cacheInterval).to.exist;
      expect(scanner.chainInterval).to.exist;
    }).timeout(5000);

    it('returns true when watching disabled', async () => {
      const originalIsWatchingEnabled = Util.isWatchingEnabled;

      Util.isWatchingEnabled = () => Promise.resolve(false);
      expect(scanner.start).to.throw;

      Util.isWatchingEnabled = originalIsWatchingEnabled;
    }).timeout(5000);
  });

  describe('stop()', async () => {
    it('returns false for scanning and chainScanner/cacheScanner', async () => {
      await scanner.start();
      await scanner.stop();
      assert.isNotTrue(scanner.scanning);
      assert.equal(scanner.cacheInterval[0], null);
      assert.equal(scanner.chainInterval[0], null);
    }).timeout(50000);
  });
});
