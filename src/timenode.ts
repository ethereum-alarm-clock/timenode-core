import Actions from './actions';
import Config from './config';
import { Networks } from './Enum';
import Scanner from './scanner';
import Router from './router';
import Version from './version';

export default class TimeNode {
    actions: Actions;
    config: Config;
    scanner: Scanner;
    router: Router;

    constructor(config: Config) {
        this.startupMessage();

        this.actions = new Actions(config);
        this.config = config;
        this.router = new Router(this.config, this.actions);
        this.scanner = new Scanner(this.config, this.router);

    }

    startupMessage(): void {
        this.config.logger.info('EAC-TimeNode')
        this.config.logger.info('Version: ' + Version);
    }

    logNetwork(): void {
        this.config.web3.version.getNetwork((e,r) => {
            if (e) {
                throw new Error(e);
            }
            else {
                this.config.logger.info('Operating on ' + Networks[r])
            }
        })
    }

    async startScanning(): Promise<boolean> {
        // If already scanning, hard-reset the Scanner module.
        if (this.scanner.scanning) {
            this.scanner.stop();
        }

        return this.scanner.start();
    }

    stopScanning(): boolean {
        return this.scanner.stop();
    }
}