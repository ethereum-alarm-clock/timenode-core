export interface ILogger {
  debug(message: string, txRequest?: string): void;
  error(message: string, txRequest?: string): void;
  info(message: string, txRequest?: string): void;
}
