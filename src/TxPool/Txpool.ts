import Config from '../Config';
import { Pool, ITxPoolTxDetails } from './Pool';
import W3Util from '../Util';

const SCAN_INTERVAL = 5000;

export default class TxPool {
    public config: Config;
    public logger: any;
    public pool: any = [];
    public subs: any = {};
    public util: W3Util;
  
    constructor(config: Config) {
      this.config = config;
      this.pool = new Pool();
      this.util = config.util;
    }

    public running () {
        return !this.pool.isEmpty() || this.subs.pending || this.subs.latest;
    }

    public async start () {
        if (this.running()) {
            await this.stop();
        }
        await this.watchPending();
        await this.watchLatest();
        await this.clearMined();
    }

    public async stop () {
        if (this.subs.pending) {
            await this.subs.pending.stopWatching();
        }
        if (this.subs.latest) {
            await this.subs.latest.stopWatching();
        }
        if (this.subs.mined) {
            clearInterval(this.subs.mined);
        }
        this.pool.wipe();
        this.subs = {};
    }

    public async watchPending () {
        this.subs.pending = await this.config.web3.eth.filter('pending');
        this.subs.pending.watch( async (err: any, res: any) => {
            if (err) {
                return this.config.logger.error(err);
            }

            if (this.pool.preSet(res)){
                try {
                    const tx:any = await this.util.getTransaction(res);
                    if (!tx || tx.blockNumber || tx.blockHash) {
                        return this.pool.del(res);
                    }

                    const poolDetails: ITxPoolTxDetails = {
                        from: tx.from,
                        to: tx.to,
                        input: tx.input,
                        gasPrice: tx.gasPrice,
                        timestamp: new Date().getTime(),
                        transactionHash: tx.hash,
                    }

                    if (this.pool.has(res, 'transactionHash')) {
                        this.pool.set(res, poolDetails);
                    }
                } catch (e) {
                    return this.config.logger.error(e);
                }
            }
        })
    }

    public async watchLatest () {
        this.subs.latest = await this.config.web3.eth.filter({fromBlock: 'latest', toBlock: 'pending'});
        this.subs.latest.watch( async (err: any, res: any) => {
            if (err) {
                return this.config.logger.error(err);
            }

            this.pool.del(res.transactionHash);
        })
    }

    public async clearMined () {
        this.subs.mined = setInterval(
            () => {
                this.pool.stored()
                .filter( (hash: string) => this.pool.get(hash, 'transactionHash').length > 0 )
                .forEach( async (hash: string) => {
                    try {
                        const tx: any = await this.util.getTransaction(hash);
                        if (!tx || tx.blockNumber || tx.blockHash) {
                            return this.pool.del(hash);
                        }
                    } catch (e) {
                        return this.config.logger.error(e);
                    }
                })
            }, SCAN_INTERVAL
        )
    }
}