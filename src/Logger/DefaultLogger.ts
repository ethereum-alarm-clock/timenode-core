import { ILogger } from './ILogger';

declare const console: any;

export class DefaultLogger implements ILogger {
  public cache(msg: String): void {
    this.formatPrint(msg, 'CACHE');
  }

  public debug(msg: String): void {
    this.formatPrint(msg, 'DEBUG');
  }

  public error(msg: String): void {
    this.formatPrint(msg, 'ERROR');
  }

  public info(msg: String): void {
    this.formatPrint(msg, 'INFO');
  }

  public formatPrint(msg: String, kind: String): void {
    console.log(kind, this.timestamp(), msg);
  }

  public timestamp(): any {
    return Math.floor(Date.now() / 1000);
  }
}
