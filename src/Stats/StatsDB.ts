import BigNumber from 'bignumber.js';

declare const require: any;

const COLLECTION_NAME: string = 'stats';

// Wrapper over *some* storage solution (we use lokijs) to keep track of TimeNode actions
export class StatsDB {
  public db: any;
  public eac: any;
  public web3: any;

  constructor(web3: any, db: any) {
    this.db = db;
    this.web3 = web3;
    // Must instantiate eac.js-lib like this for now for packaging to work.
    this.eac = require('eac.js-lib')(web3);

    const fetchedStats = this.collection;

    if (!fetchedStats) {
      this.db.addCollection(COLLECTION_NAME);
    }
  }

  public get collection() {
    return this.db.getCollection(COLLECTION_NAME);
  }

  // Takes an array of addresses and stores them as new stats objects.
  public initialize(accounts: string[]) {
    accounts.forEach(account => {
      const found = this.collection.find({ account })[0];
      if (found) {
        found.bounties = new BigNumber(found.bounties || 0);
        found.costs = new BigNumber(found.costs || 0);
      } else {
        this.collection.insert({
          account,
          claimed: 0,
          discovered: 0,
          executed: 0,
          bounties: new BigNumber(0),
          costs: new BigNumber(0),
          executedTransactions: [],
          failedClaims: []
        });
      }
    });
  }

  // Takes the account which has claimed a transaction.
  public updateClaimed(account: string, cost: BigNumber) {
    const found = this.collection.find({ account })[0];
    found.claimed += 1;
    found.costs = found.costs.plus(cost);

    this.collection.update(found);
  }

  // Takes the account which has executed a transaction.
  public updateExecuted(account: string, bounty: BigNumber, cost: BigNumber) {
    const found = this.collection.find({ account })[0];

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

    this.collection.update(found);
  }

  public addFailedClaim(account: string, transactionAddress: string) {
    const found = this.collection.find({ account })[0];

    if (!found) {
      return;
    }

    if (!found.failedClaims) {
      found.failedClaims = [];
    }

    if (found.failedClaims.indexOf(transactionAddress) !== -1) {
      return;
    }

    found.failedClaims.push(transactionAddress);

    this.collection.update(found);
  }

  public async incrementDiscovered(account: string) {
    const found = this.collection.find({ account })[0];

    if (!found) {
      return;
    }

    found.discovered += 1;

    this.collection.update(found);
  }

  // Gets the stats
  // @returns an array of the DB objs
  public getStats() {
    return this.collection.data;
  }

  public clearStats() {
    this.collection.clear();
  }

  public resetStats(accounts: string[]) {
    this.clearStats();
    this.initialize(accounts);
  }
}
