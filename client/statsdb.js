const BigNumber = require('bignumber.js')

// / Wrapper over a lokijs persistent storage to keep track of the stats of executing accounts.
class StatsDB {
  /**
   * Creates an instance of StatsDB.
   * @param {any} web3
   * @param {any} db Any storage solution that exposes find, update, insert
   * @memberof StatsDB
   */
  constructor(web3, db) {
    this.db = db
    this.web3 = web3
    this.eac = require('eac.js-lib')(web3)

    const fetchedStats = this.db.getCollection('stats')
    this.stats = fetchedStats !== null ? fetchedStats : this.db.addCollection('stats')
  }

  // / Takes an array of addresses and stores them as new stats objects.
  initialize(accounts) {
    accounts.forEach(async (account) => {
      const found = this.stats.find({ account })[0]
      if (found) {
        found.bounties = new BigNumber(found.bounties)
        found.costs = new BigNumber(found.costs)
      } else {
        this.stats.insert({
          account,
          claimed: 0,
          executed: 0,
          bounties: 0,
          costs: 0,
          executedTransactions: []
        })
      }
    })
  }

  // / Takes the account which has claimed a transaction.
  async updateClaimed(account, cost) {
    const found = this.stats.find({ account })[0]
    found.claimed += 1
    found.costs += cost

    this.stats.update(found)
  }

  // / Takes the account which has executed a transaction.
  async updateExecuted(account, bounty, cost) {
    const found = this.stats.find({ account })[0]
    found.executed += 1
    found.executedTransactions.push({ timestamp: Date.now() })

    found.bounties += bounty
    found.costs += cost

    this.stats.update(found)
  }

  // / Gets the stats
  // @returns an array of the DB objs
  getStats() {
    return this.stats.data
  }
}

module.exports = StatsDB
