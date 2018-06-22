// TODO this is only temporary
export interface ITxRequest {
  address: string;

  refreshData(): Promise<any>;
}
