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
      const found = this.getStats(account);
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
    const found = this.getStats(account);
    found.claimed += 1;
    found.costs = found.costs.plus(cost);

    this.collection.update(found);
  }

  // Takes the account which has executed a transaction.
  public updateExecuted(account: string, bounty: BigNumber, cost: BigNumber) {
    const found = this.getStats(account);

    if (!found) {
      return;
    }

    found.executed += 1;
    found.executedTransactions.push({ timestamp: Date.now() });

    found.bounties = found.bounties.plus(bounty);
    found.costs = found.costs.plus(cost);

    this.collection.update(found);
  }

  public addFailedExecution(account: string, transactionAddress: string) {
    this.update(account, 'failedExecutions', transactionAddress);
  }

  public addFailedClaim(account: string, transactionAddress: string) {
    this.update(account, 'failedClaims', transactionAddress);
  }

  public async incrementDiscovered(account: string) {
    const found = this.getStats(account);

    if (!found) {
      return;
    }

    found.discovered += 1;

    this.collection.update(found);
  }

  public getStats(account?: string) {
    if (account) {
      return this.collection.find({ account })[0];
    }
    return this.collection.data;
  }

  public clearStats() {
    try {
      this.collection.clear();
    } catch (error) {
      throw error;
    }
  }

  public resetStats(accounts: string[]) {
    this.clearStats();
    this.initialize(accounts);
  }

  private update(account: string, table: string, value: string) {
    const found = this.getStats(account);

    if (!found[table]) {
      found[table] = [];
    }

    if (found.failedClaims.indexOf(value) !== -1) {
      return;
    }

    found.failedClaims.push(value);

    this.db.getCollection(COLLECTION_NAME).update(found);
  }
}
