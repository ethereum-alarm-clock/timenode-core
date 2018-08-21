import BigNumber from 'bignumber.js';
import { expect, assert } from 'chai';
import * as loki from 'lokijs';
import { StatsDB } from '../../src/Stats';
import { StatsEntryAction, StatsEntryResult } from '../../src/Stats/StatsDB';

describe('Stats Unit Tests', () => {
  const account_1: string = '0xd0700ed9f4d178adf25b45f7fa8a4ec7c230b098';
  const account_2: string = '0x0054a7eef4dc5d729115c71cba074151b3d41804';

  const tx_1: string = '0xaa55bf414ecef0285dcece4ddf78a0ee8beb6707';
  const tx_2: string = '0x9b7b4a8fdafda1b688c22fcb6f4bc97ed29ff676';
  let stats: StatsDB;

  const reset = async () => {
    stats = new StatsDB(new loki('stats.db'));
  };

  beforeEach(reset);

  describe('discovered()', () => {
    it('inserts discovered', async () => {
      stats.discovered(account_1, tx_1);
      stats.discovered(account_2, tx_1);

      const account_1Discovered = stats.getDiscovered(account_1);

      assert.lengthOf(account_1Discovered, 1);
    });
  });
});
