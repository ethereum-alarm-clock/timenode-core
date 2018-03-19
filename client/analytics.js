const Keen = require('keen-js');

const COLLECTIONS = {
    EACNODES: 'eacnodes'
};

const KEENKCONSTS = {
    PROJECTID: 'eacnodes'
};

// 5 minutes in milliseconds
const ACTIVE_EACNODES_POLLING_INTERVAL = 5 * 60 * 1000;

class Analytics {

    constructor(writeKey, readKey, web3) {
        this.projectId = KEENKCONSTS.PROJECTID;
        this.writeKey = writeKey;
        this.readKey = readKey;

        this._web3 = web3;

        this.activeEacnodes = 0;
        this.projectId = '';
        this.writeKey = '';
        this.readKey = '';
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

        this.client = new Keen({
            projectId: this.projectId,
            writeKey: this.writeKey,
            readKey: this.readKey
        });
    }

    startAnalytics(nodeAddress) {
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
        this.client.addEvent(COLLECTIONS.EACNODES, event);
    }

    notifyNetworkNodeActive(nodeAddress, networkId = this.networkId) {
        this.sendActiveTimeNodeEvent(nodeAddress, networkId)
        this.notifyInterval = setInterval(() => this.sendActiveTimeNodeEvent(nodeAddress, networkId));
    }

    getActiveEacnodesCount(networkId) {
        const count = new Keen.Query('count_unique', {
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

        this.client.run(count, (err, response) => {
            this.activeEacnodes = response.result;
        });
    }

    async pollActiveEacnodesCount() {
        await this.getActiveEacnodesCount(this.networkId);

        this.pollInterval = setInterval(() => this.getActiveEacnodesCount(this.networkId), ACTIVE_EACNODES_POLLING_INTERVAL);
    }
}

module.exports = { Analytics };