import Config from '../Config';
import { Pool, ITxPoolTxDetails } from './Pool';

export default class TxPool {
    public config: Config;
    public logger: any;
    public pool: any = [];
    public subs: any = {};
  
    constructor(config: Config) {
      this.config = config;
      this.pool = new Pool();
    }

    public async start () {
        this.pool.wipe();
        await this.watchPending();
        await this.watchLatest();
    }

    public stop () {
        this.subs.pending.stopWatching();
        this.subs.latest.stopWatching();
        this.pool.wipe();
    }

    public async watchPending () {
        this.subs.pending = await this.config.web3.eth.filter('pending');
        this.subs.pending.watch( async (err: any, res: any) => {
            if (err) {
                return this.config.logger.error(err);
            }

            if (!this.pool.has(res, 'transactionHash')) {
                await this.config.web3.eth.getTransaction(res,
                    (txErr: any, tx: any) => {

                        const poolDetails: ITxPoolTxDetails = {
                            from: tx.from,
                            to: tx.to,
                            input: tx.input,
                            gasPrice: tx.gasPrice,
                            timestamp: new Date().getTime(),
                            transactionHash: tx.hash,
                        }
                        this.pool.set(res, poolDetails);
                    });
            }
        })
    }

    public async watchLatest () {
        this.subs.latest = await this.config.web3.eth.filter('latest');
        this.subs.latest.watch( async (err: any, res: any) => {
            if (err) {
                return this.config.logger.error(err);
            }

            if (this.pool.has(res, 'transactionHash')) {
                this.pool.del(res);
            }
        })
    }
}