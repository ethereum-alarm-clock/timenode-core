import BigNumber from 'bignumber.js';

enum StatsEntryAction {
  Discover,
  Claim,
  Execute
}

enum StatsEntryResult {
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
  private COLLECTION_NAME: string = 'timenode-stats';
  private db: any;

  constructor(db: any) {
    this.db = db;

    if (!this.collection) {
      this.db.addCollection(this.COLLECTION_NAME);
    }
  }

  private get collection() {
    return this.db.getCollection(this.COLLECTION_NAME);
  }

  public discovered(from: string, txAddress: string) {
    if (this.exists(from, txAddress, StatsEntryAction.Discover)) {
      return;
    }

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

  public claimed(from: string, txAddress: string, cost: BigNumber, success: boolean) {
    this.insert({
      from,
      txAddress,
      timestamp: new Date().getTime(),
      action: StatsEntryAction.Claim,
      cost,
      bounty: new BigNumber(0),
      result: success ? StatsEntryResult.OK : StatsEntryResult.NOK
    });
  }

  public executed(
    from: string,
    txAddress: string,
    cost: BigNumber,
    bounty: BigNumber,
    success: boolean
  ) {
    this.insert({
      from,
      txAddress,
      timestamp: new Date().getTime(),
      action: StatsEntryAction.Execute,
      cost,
      bounty,
      result: success ? StatsEntryResult.OK : StatsEntryResult.NOK
    });
  }

  public getFailedExecutions(from: string): IStatsEntry[] {
    return this.select(from, StatsEntryAction.Execute, StatsEntryResult.NOK).data();
  }

  public getSuccessfulExecutions(from: string): IStatsEntry[] {
    return this.select(from, StatsEntryAction.Execute, StatsEntryResult.OK).data();
  }

  public getFailedClaims(from: string): IStatsEntry[] {
    return this.select(from, StatsEntryAction.Claim, StatsEntryResult.NOK).data();
  }

  public getSuccessfulClaims(from: string): IStatsEntry[] {
    return this.select(from, StatsEntryAction.Claim, StatsEntryResult.OK).data();
  }

  public getDiscovered(from: string): IStatsEntry[] {
    return this.select(from, StatsEntryAction.Discover, StatsEntryResult.OK).data();
  }

  public clear(from: string) {
    this.collection
      .chain()
      .find({ from })
      .remove();
  }

  public clearAll() {
    this.collection.clear();
  }

  public totalCost(from: string) {
    return this.collection
      .chain()
      .where((item: IStatsEntry) => item.from === from && item.cost.gt(0))
      .mapReduce(
        (item: IStatsEntry) => item.cost,
        (costs: BigNumber[]) => costs.reduce((sum, cost) => sum.add(cost), new BigNumber(0))
      );
  }

  public totalBounty(from: string): BigNumber {
    return this.select(from, StatsEntryAction.Execute, StatsEntryResult.OK).mapReduce(
      (item: IStatsEntry) => item.bounty,
      (bounties: BigNumber[]) => bounties.reduce((sum, bounty) => sum.add(bounty), new BigNumber(0))
    );
  }

  private select(from: string, action: StatsEntryAction, result: StatsEntryResult): any {
    return this.collection.chain().find({ from, action, result });
  }

  private exists(from: string, txAddress: string, action: StatsEntryAction): boolean {
    return this.collection.find({ from, txAddress, action }).length >= 1;
  }

  private insert(entry: IStatsEntry) {
    this.collection.insert(entry);
  }
}
