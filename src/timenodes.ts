import Actions from './actions';
import Config from './config';
import Scanner from './scanner';
import Router from './router';

export default class TimeNode {
    actions: Actions;
    config: Config;
    scanner: Scanner;
    router: Router;

    constructor(config: Config) {
        this.actions = new Actions(config);
        this.config = config;
        this.scanner = new Scanner(this.config);
        this.router = new Router(this.config)

    }
}