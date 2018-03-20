const KeenAnalysis = require('keen-analysis');
const KeenTracking = require('keen-tracking');

const COLLECTIONS = {
    EACNODES: 'eacnodes'
};

// 5 minutes in milliseconds
const ACTIVE_EACNODES_POLLING_INTERVAL = 5 * 60 * 1000;

class Analytics {

    constructor(web3) {
        this.projectId = process.env.KEEN_PROJECT_ID;
        this.writeKey = process.env.KEEN_WRITE_KEY;
        this.readKey = process.env.KEEN_READ_KEY;

        this._web3 = web3;

        this.activeEacnodes = 0;
        this.client = null;
        this.networkId = null;

        this.initialize();
    }

    async getActiveNetwork () {
        this._web3.version.getNetwork( (err,res) => {
            if (err) {
                return;
            }
            this.networkId = res;
        })
    }

    async initialize() {
        await this.getActiveNetwork();

        this.analysisClient = new KeenAnalysis({
            projectId: this.projectId,
            readKey: this.readKey,
            requestType: 'xhr'
        });

        this.trackingClient = new KeenTracking({
            projectId: this.projectId,
            writeKey: this.writeKey,
            requestType: 'xhr'
        });
    }

    async awaitInitialized() {
        if (!this.analysisClient || !this.trackingClient) {
            return new Promise( (resolve) => {
                setTimeout(async () => {
                    resolve(await this.awaitInitialized());
                }, 700);
            })
        }
        return true;
    }

    async startAnalytics(nodeAddress) {
        nodeAddress = this._web3.sha3(nodeAddress);
        await this.awaitInitialized();
        this.notifyNetworkNodeActive(nodeAddress);
        this.pollActiveEacnodesCount();
    }

    stopAnalytics() {
        if (this.notifyInterval) {
            clearInterval(this.notifyInterval);
            this.notifyInterval = null;
        }
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    sendActiveTimeNodeEvent(nodeAddress, networkId = this.networkId) {
        const event = {
            nodeAddress,
            networkId,
            status: 'active'
        };
        this.trackingClient.addEvent(COLLECTIONS.EACNODES, event);
    }

    notifyNetworkNodeActive(nodeAddress, networkId = this.networkId) {
        this.sendActiveTimeNodeEvent(nodeAddress, networkId)
        this.notifyInterval = setInterval(() => this.sendActiveTimeNodeEvent(nodeAddress, networkId), ACTIVE_EACNODES_POLLING_INTERVAL);
    }

    getActiveEacnodesCount(networkId) {
        const count = new KeenAnalysis.Query('count_unique', {
            event_collection: COLLECTIONS.EACNODES,
            target_property: 'nodeAddress',
            timeframe: 'previous_5_minutes',
            filters: [
                {
                    property_name: 'networkId',
                    operator: 'eq',
                    property_value: networkId
                },
                {
                    property_name: 'status',
                    operator: 'eq',
                    property_value: 'active'
                }
            ]
        });

        this.analysisClient.run(count, (err, response) => {
            this.activeEacnodes = response.result;
        });
    }

    async pollActiveEacnodesCount() {
        await this.getActiveEacnodesCount(this.networkId);

        this.pollInterval = setInterval(() => this.getActiveEacnodesCount(this.networkId), ACTIVE_EACNODES_POLLING_INTERVAL);
    }
}

module.exports = { Analytics };