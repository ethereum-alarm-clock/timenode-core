import * as fs from 'fs';

export const clearStats = () => {
  fs.unlink('stats.db', error => {
    if (error) {
      return;
    }
    console.log('Deleted stats.db.');
  });
};
