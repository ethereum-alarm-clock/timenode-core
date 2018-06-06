import BigNumber = require('bignumber.js');

import Config from './config';

enum Status {
    BeforeClaimWindow,
    ClaimWindow,
    FreezePeriod,
    ExecutionWindow,
    Executed,
    CleanUp,
}

// TODO rename Router -> TimeNode and place the scanner object here
export default class Router {
    config: Config;
    txRequestStates: Object;

    // TODO rename transitions -> processes
    transitions: Object;

    constructor(config: Config) {
        this.config = config;

        this.transitions[Status.BeforeClaimWindow] = this.beforeClaimWindow();
        this.transitions[Status.ClaimWindow] = this.claimWindow();
        this.transitions[Status.FreezePeriod] = this.freezePeriod();
        this.transitions[Status.ExecutionWindow] = this.executionWindow();
        this.transitions[Status.Executed] = this.executed();
    }

    async beforeClaimWindow(txRequest): Promise<Status> {
        if (txRequest.isCancelled) {
            return Status.CleanUp;
        }

        if (await txRequest.beforeClaimWindow()) {
            return Status.BeforeClaimWindow;
        }

        return Status.ClaimWindow;
    }

    async claimWindow(txRequest): Promise<Status> {
        //TODO check inClaimWindow

        if (txRequest.isClaimed) {
            return Status.FreezePeriod;
        }

        try {
            await this.claim(txRequest)
        } catch (e) {
            // TODO handle gracefully?
            throw new Error(e);
        }

        return Status.FreezePeriod;
    }

    async claim(txRequest): Promise<any> {
        const requiredDeposit = txRequest.requiredDeposit;
        // TODO make this a constant
        const claimData = txRequest.claimData;

        // TODO: estimate gas
        // const estimateGas = await Util.estimateGas()

        // TODO: check profitability
        const profitable = await this.isProfitableClaim(txRequest);
        if (!profitable) {
            return {
                profitable,
            }
        }

        const opts = {
            to: txRequest.address,
            value: requiredDeposit,
            //TODO estimate gas above
            gas: 3000000,
            //TODO estimate gas above
            gasPrice: 12,
            data: claimData,
        }

        const txHash = await this.config.wallet.sendFromNext(opts)
        //TODO get transaction object from txHash


    }

    isLocalClaim(txRequest) {
        let localClaim;
        // TODO add function on config `hasWallet(): boolean`
        if (this.config.wallet) {
            localClaim = this.config.wallet.isKnownAddress(txRequest.claimedBy);
        } else {
            localClaim = txRequest.isClaimedBy(this.config.web3.defaultAccount);
        }

        if (!localClaim) {
            this.config.logger.debug(
                `[${txRequest.address}] In reserve window and not claimed by this TimeNode.`
            );
        }

        return localClaim;
    }

    async isProfitableClaim(txRequest) {
        const claimPaymentModifier = await txRequest.claimPaymentModifier();
        const paymentWhenClaimed = txRequest.bounty.times(
            claimPaymentModifier,
        ).dividedToIntegerBy(100);

        // TODO

    }

    // TODO do not return void
    async route(txRequest): Promise<void> {
        let status: Status = this.txRequestStates[txRequest.address] || Status.BeforeClaimWindow;
        let nextStatus: Status = await this.transitions[status](txRequest);

        while (nextStatus !== status) {
            status = nextStatus;
            nextStatus = await this.transitions[status](txRequest);
        }

        this.txRequestStates[txRequest.address] = nextStatus;
        return
    }


}