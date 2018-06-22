import { ILogger } from './ILogger';

declare const console: any;

export class DefaultLogger implements ILogger {
  public cache(msg: string): void {
    this.formatPrint(msg, 'CACHE');
  }

  public debug(msg: string): void {
    this.formatPrint(msg, 'DEBUG');
  }

  public error(msg: string): void {
    this.formatPrint(msg, 'ERROR');
  }

  public info(msg: string): void {
    this.formatPrint(msg, 'INFO');
  }

  private formatPrint(msg: string, kind: string): void {
    console.log(kind, this.timestamp(), msg);
  }

  private timestamp(): number {
    return Math.floor(Date.now() / 1000);
  }
}
