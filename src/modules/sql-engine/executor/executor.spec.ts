import { Executor } from './executor.js';
import { TableManager } from '../../storage/table-manager/table-manager.js';
import { CHAR, DatatypeEnum } from '../../storage/dto/datatype.dto.js';

describe('Executor', () => {
    it('should be defined', () => {
        expect(new Executor({} as TableManager)).toBeDefined();
    });

    it('should create CHAR values with CHAR serialization semantics', () => {
        const executor = new Executor({} as TableManager);
        const getDatatypeInstance = Reflect.get(
            executor,
            'getDatatypeInstance',
        ) as (
            datatype: DatatypeEnum,
            size: number,
            value?: unknown,
            isNull?: boolean,
        ) => CHAR;

        const datatype = getDatatypeInstance.call(
            executor,
            DatatypeEnum.CHAR,
            20,
            'John Doe',
        );

        expect(datatype).toBeInstanceOf(CHAR);
        expect(new CHAR('', 20).deserialize(datatype.serialize()).value).toBe(
            'John Doe',
        );
    });
});
