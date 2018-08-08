import { ILogger } from './ILogger';

declare const console: any;

export class DefaultLogger implements ILogger {
  public debug(msg: string, txRequest: string = ''): void {
    this.formatPrint('DEBUG', msg, txRequest);
  }

  public error(msg: string, txRequest: string = ''): void {
    this.formatPrint('ERROR', msg, txRequest);
  }

  public info(msg: string, txRequest: string = ''): void {
    this.formatPrint('INFO', msg, txRequest);
  }

  private formatPrint(kind: string, msg: string, txRequest: string = ''): void {
    console.log(`${this.now()} [${kind}]${txRequest ? ` [${txRequest}]` : ''} ${msg}`);
  }

  private now(): string {
    return new Date().toISOString();
  }
}
