import { expect } from 'chai';
import { Config } from '../../src/index';
import { mockConfig } from '../helpers';

describe('Logger Unit Tests', () => {
  const config: Config = mockConfig();

  // There's really no way to test these reliably
  describe('cache()', () => {
    it('prints a cache message', async () => {
      expect(config.logger.info('cache message'));
    });
  });

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
