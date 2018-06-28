import BigNumber from 'bignumber.js';
// import * as EAC from 'eac.js-lib';

// Wrapper over *some* storage solution (we use lokijs) to keep track of TimeNode actions
export class StatsDB {
  public db: any;
  public eac: any;
  public stats: any;
  public web3: any;

  constructor(web3: any, db: any) {
    this.db = db;
    this.web3 = web3;
    // Must instantiate eac.js-lib like this for now for packaging to work.
    this.eac = require('eac.js-lib')(web3);

    const fetchedStats = this.db.getCollection('stats');
    this.stats = fetchedStats !== null ? fetchedStats : this.db.addCollection('stats');
  }

  // Takes an array of addresses and stores them as new stats objects.
  public initialize(accounts: string[]) {
    accounts.forEach(async account => {
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

  // Takes the account which has claimed a transaction.
  public async updateClaimed(account: string, cost: BigNumber) {
    const found = this.stats.find({ account })[0];
    found.claimed += 1;
    found.costs = found.costs.plus(cost);

    this.stats.update(found);
  }

  // Takes the account which has executed a transaction.
  public async updateExecuted(account: string, bounty: BigNumber, cost: BigNumber) {
    const found = this.stats.find({ account })[0];

    if (!found) {
      return;
    }

    // Only increment executed if transaction was actually executed, we check by
    // seeing if any bounty was paid. Otherwise, don't increment.
    if (bounty !== new BigNumber(0)) {
      found.executed += 1;
    }

    found.executedTransactions.push({ timestamp: Date.now() });

    found.bounties = found.bounties.plus(bounty);
    found.costs = found.costs.plus(cost);

    this.stats.update(found);
  }

  // Gets the stats
  // @returns an array of the DB objs
  public getStats() {
    return this.stats.data;
  }
}
