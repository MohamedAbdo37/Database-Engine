import { Executor } from './executor.js';
import { TableManager } from '../../storage/table-manager/table-manager.js';

describe('Executor', () => {
    it('should be defined', () => {
        expect(new Executor({} as TableManager)).toBeDefined();
    });
});
