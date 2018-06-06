import BigNumber = require('bignumber.js');

import Config from './config';

enum Status {
    BeforeClaimWindow,
    ClaimWindow,
    FreezePeriod,
    ExecutionWindow,
    Executed,
}

export default class Router {
    config: Config;
    txRequestStates: Object;

    transitions: Object;

    constructor(config: Config) {
        this.config = config;

        this.transitions[Status.BeforeClaimWindow] = this.beforeClaimWindow();
        this.transitions[Status.ClaimWindow] = this.claimWindow();
        this.transitions[Status.FreezePeriod] = this.freezePeriod();
        this.transitions[Status.ExecutionWindow] = this.executionWindow();
        this.transitions[Status.Executed] = this.executed();
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
        let nextStatus: Status = this.transitions[status]();

        while (nextStatus !== status) {
            status = nextStatus;
            nextStatus = this.transitions[status]
        }

        this.txRequestStates[txRequest.address] = nextStatus;
        return
    }


}