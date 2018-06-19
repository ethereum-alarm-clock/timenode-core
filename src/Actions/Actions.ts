import BigNumber from 'bignumber.js';
import Config from '../Config';
import hasPending from './Pending';

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(
    address.length - 5,
    address.length
  )}`;
}

export default class Actions {
  config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async claim(txRequest: any): Promise<any> {
    const requiredDeposit = txRequest.requiredDeposit;
    // TODO make this a constant
    const claimData = txRequest.claimData;

    const gasEstimate = await this.config.util.estimateGas({
      to: txRequest.address,
      data: claimData
    });

    const estGasPrice =
      (await this.config.util.networkGasPrice()) * gasEstimate;

    const opts = {
      to: txRequest.address,
      value: requiredDeposit,
      gas: gasEstimate,
      gasPrice: estGasPrice,
      data: claimData
    };

    if (await hasPending(this.config, txRequest)) {
      return {
        ignore: true
      };
    }

    if (this.config.wallet.isNextAccountFree()) {
      // this.config.logger.debug(
      //   `Actions::claim(${shortenAddress(txRequest.address)})::Wallet with index 0 able to send tx.`
      // );

      try {
        const txHash: any = await this.config.wallet.sendFromNext(opts);

        if (txHash.receipt.status === '0x1') {
          await txRequest.refreshData();
          return txRequest.isClaimed;
        }

        return false;
      } catch (error) {
        this.config.logger.debug(
          `Actions::claim(${shortenAddress(
            txRequest.address
          )})::sendFromIndex error: ${error}`
        );
      }
    } else {
      this.config.logger.debug(
        `Actions::claim(${shortenAddress(
          txRequest.address
        )})::Wallet with index 0 is not able to send tx.`
      );
    }

    //TODO get transaction object from txHash
  }

  async execute(txRequest: any): Promise<any> {
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
      gasPrice: txRequest.gasPrice,
      data: executeData
    };

    if (await hasPending(this.config, txRequest)) {
      return {
        ignore: true
      };
    }

    if (await txRequest.inReservedWindow()) {
      const accounts = this.config.wallet.getAccounts();
      accounts.forEach(async (account, idx) => {
        if (account === txRequest.claimedBy) {
          const txHash: any = await this.config.sendFromIndex(idx, opts);

          if (txHash.receipt.status === '0x1') {
            await txRequest.refreshData();

            return txRequest.wasSuccessful;
          }

          return false;
        }
      });
    }

    if (this.config.wallet.isNextAccountFree()) {
      const txHash: any = await this.config.wallet.sendFromNext(opts);

      if (txHash.receipt.status === '0x1') {
        await txRequest.refreshData();

        return txRequest.wasSuccessful;
      }

      return false;
    } else {
      this.config.logger.debug(
        'Actions::execute()::Wallet with index 0 is not able to send tx.'
      );
    }
  }

  async cleanup(txRequest: any): Promise<boolean> {
    throw Error('Not implemented according to latest EAC changes.');

    // Check if there is any ether left in a txRequest.
    const txRequestBalance = await txRequest.getBalance();

    if (txRequestBalance.equals(0)) {
      return true;
    }

    if (txRequest.isCancelled) {
      return true;
    } else {
      // Cancel it!
      const gasEstimate = await this.config.util.estimateGas({
        to: txRequest.address,
        data: txRequest.cancelData
      });

      // Get latest block gas price.
      const estGasPrice = await this.config.util.networkGasPrice();

      const gasCostToCancel = estGasPrice.times(gasEstimate);

      const opts = {
        to: txRequest.address,
        value: 0,
        gas: gasEstimate + 21000,
        gasPrice: estGasPrice,
        data: txRequest.cancelData // TODO make constant
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
