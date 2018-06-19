import BigNumber from 'bignumber.js';

// / Wrapper over a lokijs persistent storage to keep track of the stats of executing accounts.
export class StatsDB {
  /**
   * Creates an instance of StatsDB.
   * @param {any} web3
   * @param {any} db Any storage solution that exposes find, update, insert
   * @memberof StatsDB
   */

  db: any;
  web3: any;
  eac: any;
  stats: any;

  constructor(web3: any, db: any) {
    this.db = db;
    this.web3 = web3;
    this.eac = require('eac.js-lib')(web3);

    const fetchedStats = this.db.getCollection('stats');
    this.stats =
      fetchedStats !== null ? fetchedStats : this.db.addCollection('stats');
  }

  // / Takes an array of addresses and stores them as new stats objects.
  initialize(accounts: Array<String>) {
    accounts.forEach(async (account) => {
      const found = this.stats.find({ account })[0];
      if (found) {
        const bounties = found.bounties || 0;
        const costs = found.costs || 0;

        found.bounties = new BigNumber(bounties);
        found.costs = new BigNumber(costs);
      } else {
        this.stats.insert({
          account,
          claimed: 0,
          executed: 0,
          bounties: new BigNumber(0),
          costs: new BigNumber(0),
          executedTransactions: []
        });
      }
    });
  }

  // / Takes the account which has claimed a transaction.
  async updateClaimed(account: String, cost: BigNumber) {
    const found = this.stats.find({ account })[0];
    found.claimed += 1;
    found.costs = found.costs.plus(cost);

    this.stats.update(found);
  }

  // / Takes the account which has executed a transaction.
  async updateExecuted(account: String, bounty: BigNumber, cost: BigNumber) {
    const found = this.stats.find({ account })[0];
    found.executed += 1;
    found.executedTransactions.push({ timestamp: Date.now() });

    found.bounties = found.bounties.plus(bounty);
    found.costs = found.costs.plus(cost);

    this.stats.update(found);
  }

  // / Gets the stats
  // @returns an array of the DB objs
  getStats() {
    return this.stats.data;
  }
}
