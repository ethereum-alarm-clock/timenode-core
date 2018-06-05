import Config from './config';

export default class Router {
    config: Config;

    constructor(config: Config) {
        this.config = config;
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

    isProfitableClaim(txRequest) {
        
    }
}