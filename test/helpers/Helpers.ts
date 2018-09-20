export const getHelperMethods = (web3: any) => {
  function sendRpc(method: any, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      web3.currentProvider.sendAsync(
        {
          jsonrpc: '2.0',
          method,
          params: params || [],
          id: new Date().getTime()
        },
        (err: any, res: any) => {
          if (err) {
            reject(err);
          }
          resolve(res);
        }
      );
    });
  }

  function waitUntilBlock(seconds: any, targetBlock: any) {
    return new Promise((resolve, reject) => {
      const asyncIterator = function _asyncIterator() {
        return web3.eth.getBlock('latest', (err: any, ref: any) => {
          if (err) {
            reject(err);
          }

          const num = ref.number;

          if (num >= targetBlock - 1) {
            return sendRpc('evm_increaseTime', [seconds])
              .then(() => sendRpc('evm_mine'))
              .then(resolve);
          }
          return sendRpc('evm_mine').then(asyncIterator);
        });
      };
      asyncIterator();
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
    return await revertSnapshot(snapshot);
  }

  return { waitUntilBlock, withSnapshotRevert };
};
