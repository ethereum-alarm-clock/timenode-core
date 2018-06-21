import { ILogger } from './ILogger';
import * as moment from 'moment';

declare const console: any;

export class DefaultLogger implements ILogger {
  cache(msg: String): void {
    this.formatPrint(msg, 'CACHE');
  }

  debug(msg: String): void {
    this.formatPrint(msg, 'DEBUG');
  }

  error(msg: String): void {
    this.formatPrint(msg, 'ERROR');
  }

  info(msg: String): void {
    this.formatPrint(msg, 'INFO');
  }

  formatPrint(msg: String, kind: String): void {
    console.log(kind, this.timestamp(), msg);
  }

  timestamp(): any {
    return Math.floor(Date.now() / 1000);
    // return moment().format('HH:mm:ss');
  }
}
