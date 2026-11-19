import { Executor } from './executor.js';
import { TableManager } from '../../storage/table-manager/table-manager.js';
import { CHAR, DatatypeEnum } from '../../storage/dto/datatype.dto.js';

describe('Executor', () => {
    it('should be defined', () => {
        expect(Object.create(Executor.prototype) as Executor).toBeDefined();
    });
});
