import BigNumber from 'bignumber.js';

declare const require: any;

const COLLECTION_NAME: string = 'timenode-stats';

export enum StatsEntryAction {
  Discover,
  Claim,
  Execute
}

export enum StatsEntryResult {
  NOK,
  OK
}

export interface IStatsEntry {
  from: string;
  txAddress: string;
  timestamp: number;
  action: StatsEntryAction;
  cost: BigNumber;
  bounty: BigNumber;
  result: StatsEntryResult;
}

export class StatsDB {
  public db: any;

  constructor(db: any) {
    this.db = db;

    if (!this.collection) {
      this.db.addCollection(COLLECTION_NAME);
    }
  }

  public discovered(from: string, txAddress: string) {
    this.insert({
      from,
      txAddress,
      timestamp: new Date().getTime(),
      action: StatsEntryAction.Discover,
      cost: new BigNumber(0),
      bounty: new BigNumber(0),
      result: StatsEntryResult.OK
    });
  }

  public getDiscovered(from: string): IStatsEntry[] {
    return this.select(from, StatsEntryAction.Discover, StatsEntryResult.OK);
  }

  private get collection() {
    return this.db.getCollection(COLLECTION_NAME);
  }

  public select(from: string, action: StatsEntryAction, result: StatsEntryResult): IStatsEntry[] {
    return this.collection.find({ from, action, result });
  }

  private insert(entry: IStatsEntry) {
    this.collection.insert(entry);
  }
}
