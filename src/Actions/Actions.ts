import BigNumber from 'bignumber.js';
import Config from '../Config';
import hasPending = require('../pending.js');

export default class Actions {
  config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async claim(txRequest): Promise<any> {
    const requiredDeposit = txRequest.requiredDeposit;
    // TODO make this a constant
    const claimData = txRequest.claimData;

    // TODO: estimate gas
    // const estimateGas = await Util.estimateGas()
    const opts = {
      to: txRequest.address,
      value: requiredDeposit,
      //TODO estimate gas above
      gas: 3000000,
      //TODO estimate gas above
      gasPrice: 12,
      data: claimData,
    };

    if (await hasPending(this.config, txRequest)) {
      return {
        ignore: true,
      };
    }

    const txHash = await this.config.wallet.sendFromNext(opts);
    //TODO get transaction object from txHash
  }

  async execute(txRequest): Promise<any> {
    const gasToExecute = txRequest.callGas
      .add(180000)
      .div(64)
      .times(65)
      .round();
    // TODO Check that the gasToExecue < gasLimit of latest block w/ some margin

    // TODO make this a constant
    const executeData = txRequest.executeData;

    const claimIndex = this.config.wallet
      .getAddresses()
      .indexOf(txRequest.claimedBy);

    const opts = {
      to: txRequest.address,
      value: 0,
      gas: gasToExecute,
      // TODO estimate gas above
      gasPrice: 12,
      data: executeData,
    };

    if (await hasPending(this.config, txRequest)) {
      return {
        ignore: true,
      };
    }

    const txHash = await this.config.wallet.sendFromIndex(opts);
  }

  async cleanup(txRequest): Promise<boolean> {
    // Check if there is any ether left in a txRequest.
    const txRequestBalance = await txRequest.getBalance();

    if (txRequestBalance.equals(0)) {
      return true;
    }

    if (txRequest.isCancelled) {
      return true;
    } else {
      // Cancel it!
      // TODO estimate gas here
      const gasToCancel = 12;

      // Get latest block gas price.
      const currentGasPrice = new BigNumber(12);

      // TODO real numbers
      const gasCostToCancel = currentGasPrice.times(gasToCancel);

      const opts = {
        to: txRequest.address,
        value: 0,
        gas: gasToCancel + 21000,
        gasPrice: currentGasPrice,
        data: txRequest.cancelData, // TODO make constant
      };

      let transactionHash;
      // Check to see if any of our accounts is the owner.
      const ownerIndex = this.config.wallet
        .getAddresses()
        .indexOf(txRequest.owner);
      if (ownerIndex !== -1) {
        transactionHash = await this.config.wallet.sendFromIndex(
          ownerIndex,
          opts
        );
      } else {
        if (gasCostToCancel.greaterThan(txRequestBalance)) {
          // The txRequest doesn't have high enough balance to compensate.
          // It's now considered dust.
          return true;
        }
        transactionHash = await this.config.wallet.sendFromNext(opts);
      }

      //TODO get tx Obj from hash
    }
  }
}
