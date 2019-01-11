import BigNumber from 'bignumber.js';
import { EthGasStationInfo } from '@ethereum-alarm-clock/lib';

export class NormalizedTimes {
  private gasStats: EthGasStationInfo;
  private temporalUnit: number;

  constructor(gasStats: EthGasStationInfo, temporalUnit: number) {
    this.gasStats = gasStats;
    this.temporalUnit = temporalUnit;
  }

  public pickGasPrice(timeLeft: BigNumber): BigNumber {
    if (timeLeft > this.safeLow) {
      return this.gasStats.safeLow;
    } else if (timeLeft > this.avg) {
      return this.gasStats.average;
    } else if (timeLeft > this.fast) {
      return this.gasStats.fast;
    } else if (timeLeft > this.fastest) {
      return this.gasStats.fastest;
    } else {
      return null;
    }
  }

  private get safeLow(): BigNumber {
    return this.normalize(this.gasStats.safeLow);
  }

  private get avg(): BigNumber {
    return this.normalize(this.gasStats.average);
  }

  private get fast(): BigNumber {
    return this.normalize(this.gasStats.fast);
  }

  private get fastest(): BigNumber {
    return this.normalize(this.gasStats.fastest);
  }

  private normalize(value: BigNumber): BigNumber {
    return this.isBlock ? this.normalizeToBlock(value) : this.normalizeToTimestamp(value);
  }

  private normalizeToBlock(value: BigNumber): BigNumber {
    return value.div(this.gasStats.blockTime).decimalPlaces(0);
  }

  private normalizeToTimestamp(value: BigNumber): BigNumber {
    return value.multipliedBy(10);
  }

  private get isBlock() {
    return this.temporalUnit === 1;
  }
}
