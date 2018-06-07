import BigNumber from 'bignumber.js';

import Actions from './actions';
import Config from './config';

enum Status {
    BeforeClaimWindow,
    ClaimWindow,
    FreezePeriod,
    ExecutionWindow,
    Executed,
    Done,
}

export default class Router {
    actions: Actions;
    config: Config;
    txRequestStates: Object;

    transitions: Object;

    constructor(config: Config, actions: any) {
        this.actions = actions;
        this.config = config;

        this.transitions[Status.BeforeClaimWindow] = this.beforeClaimWindow;
        this.transitions[Status.ClaimWindow] = this.claimWindow;
        this.transitions[Status.FreezePeriod] = this.freezePeriod;
        this.transitions[Status.ExecutionWindow] = this.executionWindow;
        this.transitions[Status.Executed] = this.executed;
    }

    async beforeClaimWindow(txRequest): Promise<Status> {
        if (txRequest.isCancelled) {
            // TODO Status.CleanUp?
            return Status.Executed;
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
            // check profitability FIRST
            // ... here
            //TODO do we care about return value?
            await this.actions.claim(txRequest)
        } catch (e) {
            // TODO handle gracefully?
            throw new Error(e);
        }

        return Status.FreezePeriod;
    }

    async freezePeriod(txRequest): Promise<Status> {
        if (await txRequest.inFreezePeriod()) {
            return Status.FreezePeriod;
        }

        if (await txRequest.inExecutionWindow()) {
            return Status.ExecutionWindow;
        }
    }

    async executionWindow(txRequest): Promise<Status> {
        if (txRequest.wasCalled) {
            return Status.Executed;
        }

        const reserved = await txRequest.inReservedWindow();
        if (reserved && !this.isLocalClaim(txRequest)) {
            return Status.ExecutionWindow;
        }

        try {
            await this.actions.execute(txRequest);
        } catch (e) {
            //TODO handle gracefully?
            throw new Error(e);
        }

        return Status.Executed;
    }

    async executed(txRequest): Promise<Status> {
        await this.actions.cleanup(txRequest);
        return Status.Done;
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