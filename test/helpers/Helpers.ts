import Web3 = require('web3');
import { JsonRPCResponse } from 'web3/providers';

export const getHelperMethods = (web3: Web3) => {
  function sendRpc(method: any, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send(
        {
          jsonrpc: '2.0',
          method,
          params: params || [],
          id: new Date().getTime()
        },
        Object.assign((err: Error, res: JsonRPCResponse) => resolve(res))
      );
    });
  }

  function takeSnapshot(): Promise<number> {
    return sendRpc('evm_snapshot').then(res => res.result);
  }

  function revertSnapshot(id: number): Promise<boolean> {
    return sendRpc('evm_revert', id).then(res => res.result);
  }

  async function withSnapshotRevert(fn: any): Promise<boolean> {
    const snapshot = await takeSnapshot();
    try {
      await fn();
    } catch (error) {
      console.log(`Error ${error} in withSnapshotRevert`);
    }
    return revertSnapshot(snapshot);
  }

  return { withSnapshotRevert };
};
