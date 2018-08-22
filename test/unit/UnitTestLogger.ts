import { expect } from 'chai';
import { Config } from '../../src/index';
import { mockConfig } from '../helpers';

describe('Logger Unit Tests', async () => {
  const config: Config = await mockConfig();

  // There's really no way to test these reliably
  describe('debug()', () => {
    it('prints a debug message', async () => {
      expect(config.logger.debug('debug message'));
    });
  });

  describe('error()', () => {
    it('prints a error message', async () => {
      expect(config.logger.error('error message'));
    });
  });

  describe('info()', () => {
    it('prints a info message', async () => {
      expect(config.logger.info('info message'));
    });
  });
});
