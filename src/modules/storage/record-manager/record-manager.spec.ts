import { RecordManager } from './record-manager.js';
import { PageManager } from '../page-manager/page-manager.js';
import {
    BOOLEAN,
    CHAR,
    Datatype,
    DATETIME,
    DOUBLE,
    INT,
    SERIAL,
    TIMESTAMP,
    VARCHAR,
} from '../dto/datatype.dto.js';
import { DatatypeException } from '../exceptions/data-input.exception.js';
import { RID } from '../dto/rid.dto.js';
import { NotFoundException } from '@nestjs/common';

describe('RecordManager', () => {
    const pageManagerMock = {
        addRecord: vi.fn(),
        getRecord: vi.fn(),
        deleteRecord: vi.fn(),
        updateRecord: vi.fn(),
        getPageRecords: vi.fn(),
    } as unknown as PageManager & {
        addRecord: () => Promise<RID>;
        getRecord: () => Promise<Buffer | null>;
        deleteRecord: () => Promise<void>;
        updateRecord: () => Promise<RID>;
        getPageRecords: () => Promise<Buffer[]>;
    };

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should be defined', () => {
        expect(new RecordManager(pageManagerMock)).toBeDefined();
    });

    it('should serialize and deserialize a record correctly', () => {
        const record = [
            new INT(42),
            new VARCHAR('Hello', 10),
            new BOOLEAN(true),
            new DOUBLE(3.14),
            new TIMESTAMP(new Date('2023-01-01T00:00:00Z')),
            new DATETIME(new Date('2023-01-01T00:00:00Z')),
            new CHAR('A', 1),
            new SERIAL(123),
        ];

        const recordManager = new RecordManager(pageManagerMock);
        const serialized = recordManager['serializeRecord'](record);
        const deserialized = recordManager['deserializeRecord'](
            serialized,
            record,
        );

        expect(deserialized.length).toBe(record.length);
    });

    it('should spy on the page manager mock passed to it', async () => {
        const recordManager = new RecordManager(pageManagerMock);
        const createPageSpy = vi.spyOn(pageManagerMock, 'addRecord');
        const tableName = 'test_table';

        await recordManager.insertRecord(tableName, [
            new INT(1),
            new CHAR('A', 1),
        ]);

        const recordBuffer = Buffer.concat([
            new INT(1).serialize(),
            new CHAR('A', 1).serialize(),
        ]);

        expect(recordManager).toBeDefined();
        expect(createPageSpy).toHaveBeenCalledOnce();
        expect(createPageSpy).toHaveBeenCalledWith(tableName, recordBuffer);
    });

    it('should spy on the page manager mock passed to it for getRecord', async () => {
        const recordManager = new RecordManager(pageManagerMock);
        const getRecordSpy = vi.spyOn(pageManagerMock, 'getRecord');

        const tableName = 'test_table';
        const rid: RID = { pageId: 1, slotNumber: 0 };
        await recordManager.retrieveRecord(tableName, rid, [
            new INT(1),
            new CHAR('A', 1),
        ]);

        expect(recordManager).toBeDefined();
        expect(getRecordSpy).toHaveBeenCalledOnce();
        expect(getRecordSpy).toHaveBeenCalledWith(tableName, rid);
    });

    it('should spy on the page manager mock passed to it for updateRecord', async () => {
        const recordManager = new RecordManager(pageManagerMock);

        const getRecordReturnValue = Buffer.concat([
            new INT(1).serialize(),
            new CHAR('A', 1).serialize(),
        ]);

        const getRecordSpy = vi
            .spyOn(pageManagerMock, 'getRecord')
            .mockResolvedValue(getRecordReturnValue);

        const updateRecordSpy = vi.spyOn(pageManagerMock, 'updateRecord');

        const tableName = 'test_table';
        const rid: RID = { pageId: 1, slotNumber: 0 };
        await recordManager.updateRecord(tableName, rid, [
            new INT(2),
            new CHAR('B', 1),
        ]);

        const updatedRecordBuffer = Buffer.concat([
            new INT(2).serialize(),
            new CHAR('B', 1).serialize(),
        ]);

        expect(recordManager).toBeDefined();
        expect(getRecordSpy).toHaveBeenCalledOnce();
        expect(getRecordSpy).toHaveBeenCalledWith(tableName, rid);

        expect(updateRecordSpy).toHaveBeenCalledOnce();
        expect(updateRecordSpy).toHaveBeenCalledAfter(getRecordSpy);
        expect(updateRecordSpy).toHaveBeenCalledWith(
            tableName,
            rid,
            updatedRecordBuffer,
        );
    });

    it('should spy on the page manager mock passed to it for deleteRecord', async () => {
        const recordManager = new RecordManager(pageManagerMock);
        const deleteRecordSpy = vi.spyOn(pageManagerMock, 'deleteRecord');

        const tableName = 'test_table';
        const rid: RID = { pageId: 1, slotNumber: 0 };

        await recordManager.deleteRecord(tableName, rid);

        expect(recordManager).toBeDefined();
        expect(deleteRecordSpy).toHaveBeenCalledOnce();
        expect(deleteRecordSpy).toHaveBeenCalledWith(tableName, rid);
    });

    it('should spy on the page manager mock passed to it for scanRecords', async () => {
        const recordManager = new RecordManager(pageManagerMock);
        const firstPageRecords = [
            Buffer.concat([
                new INT(1).serialize(),
                new CHAR('A', 1).serialize(),
            ]),
        ];

        const secondPageRecords: Buffer[] = [];
        const getPageRecordsSpy = vi
            .spyOn(pageManagerMock, 'getPageRecords')
            .mockResolvedValueOnce(firstPageRecords)
            .mockResolvedValueOnce(secondPageRecords);

        const tableName = 'test_table';

        await recordManager.scanRecords(tableName, [
            new INT(0),
            new CHAR('', 1),
        ]);

        expect(recordManager).toBeDefined();

        expect(
            recordManager['pageStreamerGenerator'](1, tableName),
        ).toBeDefined();

        expect(getPageRecordsSpy).toHaveBeenCalledTimes(2);
        expect(getPageRecordsSpy).toHaveBeenNthCalledWith(1, 'test_table', 1);
        expect(getPageRecordsSpy).toHaveBeenNthCalledWith(2, 'test_table', 2);
    });

    it('should throw an error when trying to update a non-existent record', async () => {
        const recordManager = new RecordManager(pageManagerMock);
        const getRecordSpy = vi
            .spyOn(pageManagerMock, 'getRecord')
            .mockResolvedValue(null);

        const tableName = 'test_table';
        const rid: RID = { pageId: 1, slotNumber: 0 };

        await expect(
            recordManager.updateRecord(tableName, rid, [new INT(2)]),
        ).rejects.toThrow(
            new NotFoundException(
                `Record with ID ${rid.pageId}-${rid.slotNumber} not found in table ${tableName}.`,
            ),
        );

        expect(getRecordSpy).toHaveBeenCalledOnce();
        expect(getRecordSpy).toHaveBeenCalledWith(tableName, rid);
    });

    it('should return null when retrieving a non-existent record', async () => {
        const recordManager = new RecordManager(pageManagerMock);
        const getRecordSpy = vi
            .spyOn(pageManagerMock, 'getRecord')
            .mockResolvedValue(null);
        const tableName = 'test_table';
        const rid: RID = { pageId: 1, slotNumber: 0 };

        await expect(
            recordManager.retrieveRecord(tableName, rid, [new INT(0)]),
        ).resolves.toBeNull();

        expect(getRecordSpy).toHaveBeenCalledWith(tableName, rid);
    });

    it('should throw when retrieving multiple records and one does not exist', async () => {
        const recordManager = new RecordManager(pageManagerMock);
        const rid: RID = { pageId: 1, slotNumber: 0 };
        vi.spyOn(pageManagerMock, 'getRecord').mockResolvedValue(null);

        await expect(
            recordManager.retrieveMultipleRecords(
                'test_table',
                [rid],
                [new INT(0)],
            ),
        ).rejects.toThrow(
            new NotFoundException(
                `Record with ID ${rid.pageId}-${rid.slotNumber} not found in table test_table.`,
            ),
        );
    });

    it('should spy on the page manager mock passed to it for retrieveMultipleRecords and check if record deserialized correctly', async () => {
        const recordManager = new RecordManager(pageManagerMock);
        const firstRecord = Buffer.concat([
            new INT(1).serialize(),
            new CHAR('A', 1).serialize(),
        ]);

        const secondRecord = Buffer.concat([
            new INT(2).serialize(),
            new CHAR('B', 1).serialize(),
        ]);

        const thirdRecord = Buffer.concat([
            new INT(100).serialize(),
            new CHAR('C', 1).serialize(),
        ]);

        const getRecordSpy = vi
            .spyOn(pageManagerMock, 'getRecord')
            .mockResolvedValueOnce(firstRecord)
            .mockResolvedValueOnce(secondRecord)
            .mockResolvedValueOnce(thirdRecord);

        const tableName = 'test_table';
        const rids: RID[] = [
            { pageId: 1, slotNumber: 2 },
            { pageId: 2, slotNumber: 1 },
            { pageId: 1, slotNumber: 0 },
        ];

        const records = await recordManager.retrieveMultipleRecords(
            tableName,
            rids,
            [new INT(0), new CHAR('', 1)],
        );

        expect(recordManager).toBeDefined();
        expect(getRecordSpy).toHaveBeenCalledTimes(3);
        expect(getRecordSpy).toHaveBeenNthCalledWith(1, tableName, {
            pageId: 1,
            slotNumber: 0,
        });
        expect(getRecordSpy).toHaveBeenNthCalledWith(2, tableName, {
            pageId: 1,
            slotNumber: 2,
        });
        expect(getRecordSpy).toHaveBeenNthCalledWith(3, tableName, {
            pageId: 2,
            slotNumber: 1,
        });

        expect(records.length).toBe(3);
        expect(records[0][0].value).toBe(1);
        expect(records[0][1].value).toBe('A');
        expect(records[1][0].value).toBe(2);
        expect(records[1][1].value).toBe('B');
        expect(records[2][0].value).toBe(100);
        expect(records[2][1].value).toBe('C');

        expect(records[0][0]).toBeInstanceOf(INT);
        expect(records[0][1]).toBeInstanceOf(CHAR);
        expect(records[1][0]).toBeInstanceOf(INT);
        expect(records[1][1]).toBeInstanceOf(CHAR);
        expect(records[2][0]).toBeInstanceOf(INT);
        expect(records[2][1]).toBeInstanceOf(CHAR);
    });
});

describe('DataType Serialization and Deserialization', () => {
    it('should serialize and deserialize TIMESTAMP correctly', () => {
        const timestamp = new Date();
        const datatype = new TIMESTAMP(timestamp);
        const serialized = datatype.serialize();
        const deserialized = new TIMESTAMP(new Date()).deserialize(serialized);

        expect(deserialized.value.getTime()).toBe(timestamp.getTime());
    });

    it('should serialize and deserialize BOOLEAN correctly', () => {
        const datatypeTrue = new BOOLEAN(true);
        const serializedTrue = datatypeTrue.serialize();
        const deserializedTrue = new BOOLEAN(false).deserialize(serializedTrue);

        expect(deserializedTrue.value).toBe(true);
    });

    it('should serialize and deserialize BOOLEAN correctly for false', () => {
        const datatypeFalse = new BOOLEAN(false);
        const serializedFalse = datatypeFalse.serialize();
        const deserializedFalse = new BOOLEAN(true).deserialize(
            serializedFalse,
        );

        expect(deserializedFalse.value).toBe(false);
    });

    it('should serialize and deserialize DATETIME correctly', () => {
        const datetime = new Date();
        const datatype = new DATETIME(datetime);
        const serialized = datatype.serialize();
        const deserialized = new DATETIME(new Date()).deserialize(serialized);

        expect(deserialized.value.getTime()).toBe(datetime.getTime());
    });

    it('should serialize and deserialize CHAR correctly', () => {
        const charValue = 'A';
        const datatype = new CHAR(charValue, 1);
        const serialized = datatype.serialize();
        const deserialized = new CHAR('', 1).deserialize(serialized);

        expect(deserialized.value).toBe(charValue);
    });

    it('should serialize and deserialize CHAR correctly for longer strings', () => {
        const charValue = 'Hello';
        const datatype = new CHAR(charValue, 5);
        const serialized = datatype.serialize();
        const deserialized = new CHAR('', 5).deserialize(serialized);

        expect(deserialized.value).toBe(charValue);
    });

    it('should serialize and deserialize CHAR correctly for strings shorter than the specified size', () => {
        const charValue = 'Hi';
        const datatype = new CHAR(charValue, 5);
        const serialized = datatype.serialize();
        const deserialized = new CHAR('', 5).deserialize(serialized);

        expect(deserialized.value).toBe(charValue);
    });

    it('should serialize and deserialize CHAR correctly for empty strings', () => {
        const charValue = '';
        const datatype = new CHAR(charValue, 5);
        const serialized = datatype.serialize();
        const deserialized = new CHAR('', 5).deserialize(serialized);

        expect(deserialized.value).toBe(charValue);
    });

    it('should serialize and deserialize CHAR correctly for strings with null characters', () => {
        const charValue = 'A\0B\0C';
        const datatype = new CHAR(charValue, 5);
        const serialized = datatype.serialize();
        const deserialized = new CHAR('', 5).deserialize(serialized);

        expect(deserialized.value).toBe(charValue.replace(/\0/g, ''));
    });

    it('should throw an error when trying to create a CHAR with a value longer than the specified length', () => {
        const charValue = 'TooLong';
        expect(() => new CHAR(charValue, 5)).toThrowError(
            `Value length exceeds the specified length of 5`,
        );
    });

    it('should serialize and deserialize CHAR correctly for strings with special characters', () => {
        const charValue = 'A!@#';
        const datatype = new CHAR(charValue, 5);
        const serialized = datatype.serialize();
        const deserialized = new CHAR('', 5).deserialize(serialized);

        expect(deserialized.value).toBe(charValue);
    });

    it('should serialize and deserialize CHAR correctly for strings with spaces', () => {
        const charValue = 'A B C';
        const datatype = new CHAR(charValue, 5);
        const serialized = datatype.serialize();
        const deserialized = new CHAR('', 5).deserialize(serialized);

        expect(deserialized.value).toBe(charValue);
    });

    it('should serialize and deserialize CHAR correctly for strings with unicode characters', () => {
        const charValue = 'A\u00A9B';
        const datatype = new CHAR(charValue, 5);
        const serialized = datatype.serialize();
        const deserialized = new CHAR('', 5).deserialize(serialized);

        expect(deserialized.value).toBe(charValue);
    });

    it('should serialize and deserialize CHAR correctly for strings with emojis', () => {
        const charValue = 'A😀B';
        const datatype = new CHAR(charValue, 5);
        const serialized = datatype.serialize();
        const deserialized = new CHAR('', 5).deserialize(serialized);

        expect(deserialized.value).toBe(charValue);
    });

    it('should serialize and deserialize INT correctly', () => {
        const intValue = 42;
        const datatype = new INT(intValue);
        const serialized = datatype.serialize();
        const deserialized = new INT(0).deserialize(serialized);

        expect(deserialized.value).toBe(intValue);
    });

    it('should serialize and deserialize INT correctly for negative values', () => {
        const intValue = -42;
        const datatype = new INT(intValue);
        const serialized = datatype.serialize();
        const deserialized = new INT(0).deserialize(serialized);

        expect(deserialized.value).toBe(intValue);
    });

    it('should serialize and deserialize INT correctly for zero', () => {
        const intValue = 0;
        const datatype = new INT(intValue);
        const serialized = datatype.serialize();
        const deserialized = new INT(0).deserialize(serialized);

        expect(deserialized.value).toBe(intValue);
    });

    it('should serialize and deserialize INT correctly for large values', () => {
        const intValue = 2147483647;
        const datatype = new INT(intValue);
        const serialized = datatype.serialize();
        const deserialized = new INT(0).deserialize(serialized);

        expect(deserialized.value).toBe(intValue);
    });

    it('should serialize and deserialize DOUBLE correctly', () => {
        const doubleValue = 3.14159;
        const datatype = new DOUBLE(doubleValue);
        const serialized = datatype.serialize();
        const deserialized = new DOUBLE(0).deserialize(serialized);

        expect(deserialized.value).toBeCloseTo(doubleValue, 5);
    });

    it('should serialize and deserialize DOUBLE correctly for negative values', () => {
        const doubleValue = -3.14159;
        const datatype = new DOUBLE(doubleValue);
        const serialized = datatype.serialize();
        const deserialized = new DOUBLE(0).deserialize(serialized);

        expect(deserialized.value).toBeCloseTo(doubleValue, 5);
    });

    it('should serialize and deserialize DOUBLE correctly for zero', () => {
        const doubleValue = 0.0;
        const datatype = new DOUBLE(doubleValue);
        const serialized = datatype.serialize();
        const deserialized = new DOUBLE(0).deserialize(serialized);

        expect(deserialized.value).toBeCloseTo(doubleValue, 5);
    });

    it('should serialize and deserialize DOUBLE correctly for large values', () => {
        const doubleValue = Number.MAX_SAFE_INTEGER - 0.12345;
        const datatype = new DOUBLE(doubleValue);
        const serialized = datatype.serialize();
        const deserialized = new DOUBLE(0).deserialize(serialized);

        expect(deserialized.value).toBeCloseTo(doubleValue, 5);
    });

    it('should throw an error when trying to create a DOUBLE with a value less than the minimum safe integer limit', () => {
        const doubleValue = Number.MIN_SAFE_INTEGER - 1;
        expect(() => new DOUBLE(doubleValue)).toThrow(DatatypeException);
        expect(() => new DOUBLE(doubleValue)).toThrow(
            `Value ${doubleValue} is less than the minimum safe value limit for DOUBLE type`,
        );
    });

    it('should throw an error when trying to create a DOUBLE with a value greater than the maximum safe integer limit', () => {
        const doubleValue = Number.MAX_SAFE_INTEGER + 1;
        expect(() => new DOUBLE(doubleValue)).toThrow(DatatypeException);
        expect(() => new DOUBLE(doubleValue)).toThrow(
            `Value ${doubleValue} exceeds the maximum safe value limit for DOUBLE type`,
        );
    });

    it('should throw an error when trying to create an INT with a value less than the minimum safe integer limit', () => {
        const intValue = Number.MIN_SAFE_INTEGER - 1;
        expect(() => new INT(intValue)).toThrow(DatatypeException);
        expect(() => new INT(intValue)).toThrow(
            `Value ${intValue} is less than the minimum safe integer limit for INT type`,
        );
    });

    it('should throw an error when trying to create an INT with a value greater than the maximum safe integer limit', () => {
        const intValue = Number.MAX_SAFE_INTEGER + 1;
        expect(() => new INT(intValue)).toThrow(DatatypeException);
        expect(() => new INT(intValue)).toThrow(
            `Value ${intValue} exceeds the maximum safe integer limit for INT type`,
        );
    });

    it('should throw an error when trying to create a SERIAL with a negative value', () => {
        const serialValue = -1;
        expect(() => new SERIAL(serialValue)).toThrow(DatatypeException);
        expect(() => new SERIAL(serialValue)).toThrow(
            'Value must be a non-negative integer for SERIAL type',
        );
    });

    it('should serialize and deserialize SERIAL correctly', () => {
        const serialValue = 123;
        const datatype = new SERIAL(serialValue);
        const serialized = datatype.serialize();
        const deserialized = new SERIAL(0).deserialize(serialized);

        expect(deserialized.value).toBe(serialValue);
    });

    it('should serialize and deserialize SERIAL correctly for zero', () => {
        const serialValue = 0;
        const datatype = new SERIAL(serialValue);
        const serialized = datatype.serialize();
        const deserialized = new SERIAL(0).deserialize(serialized);

        expect(deserialized.value).toBe(serialValue);
    });

    it('should serialize and deserialize SERIAL correctly for large values', () => {
        const serialValue = 4294967295;
        const datatype = new SERIAL(serialValue);
        const serialized = datatype.serialize();
        const deserialized = new SERIAL(0).deserialize(serialized);

        expect(deserialized.value).toBe(serialValue);
    });

    it('should serialize and deserialize VARCHAR correctly', () => {
        const varcharValue = 'Hello, World!';
        const datatype = new VARCHAR(varcharValue, 20);
        const serialized = datatype.serialize();
        const deserialized = new VARCHAR('', 20).deserialize(serialized);

        expect(deserialized.size).toBe(serialized.length);
        expect(deserialized.value).toBe(varcharValue);
    });

    it('should reject a VARCHAR with a non-positive length', () => {
        expect(() => new VARCHAR('', 0)).toThrow(
            'Length must be a positive integer greater than zero',
        );
    });

    it('should reject a VARCHAR exceeding the maximum length', () => {
        expect(() => new VARCHAR('', 1019)).toThrow(
            'Length exceeds the maximum allowed length of 1018 characters',
        );
    });

    it('should reject a VARCHAR value longer than its declared length', () => {
        expect(() => new VARCHAR('Hello', 4)).toThrow(
            'Value length exceeds the specified length of 4',
        );
    });

    it('should reject a VARCHAR buffer with an invalid serialized size', () => {
        const serialized = Buffer.alloc(4048);
        serialized.writeUInt16BE(4048, 1);

        expect(() => new VARCHAR('', 20).deserialize(serialized)).toThrow(
            DatatypeException,
        );
    });

    it('should reject a truncated serialized record', () => {
        const recordManager = new RecordManager({} as PageManager);

        expect(() =>
            recordManager['deserializeRecord'](Buffer.alloc(1), [new INT(0)]),
        ).toThrow(RangeError);
    });
});

describe('Null datatype serialization and deserialization', () => {
    it('should serialize and deserialize a null SERIAL', () => {
        const datatype = new SERIAL(123);
        datatype.isNull = true;

        const deserialized = new SERIAL(0).deserialize(datatype.serialize());

        expect(deserialized.isNull).toBe(true);
    });

    it('should serialize and deserialize a null INT', () => {
        const datatype = new INT(42);
        datatype.isNull = true;

        const deserialized = new INT(0).deserialize(datatype.serialize());

        expect(deserialized.isNull).toBe(true);
    });

    it('should serialize and deserialize a null DOUBLE', () => {
        const datatype = new DOUBLE(3.14);
        datatype.isNull = true;

        const deserialized = new DOUBLE(0).deserialize(datatype.serialize());

        expect(deserialized.isNull).toBe(true);
    });

    it('should serialize and deserialize a null VARCHAR', () => {
        const datatype = new VARCHAR('value', 20);
        datatype.isNull = true;

        const deserialized = new VARCHAR('', 20).deserialize(
            datatype.serialize(),
        );

        expect(deserialized.isNull).toBe(true);
    });

    it('should serialize and deserialize a null BOOLEAN', () => {
        const datatype = new BOOLEAN(true);
        datatype.isNull = true;

        const deserialized = new BOOLEAN(false).deserialize(
            datatype.serialize(),
        );

        expect(deserialized.isNull).toBe(true);
    });

    it('should serialize and deserialize a null TIMESTAMP', () => {
        const datatype = new TIMESTAMP(new Date());
        datatype.isNull = true;

        const deserialized = new TIMESTAMP(new Date(0)).deserialize(
            datatype.serialize(),
        );

        expect(deserialized.isNull).toBe(true);
    });

    it('should serialize and deserialize a null DATETIME', () => {
        const datatype = new DATETIME(new Date());
        datatype.isNull = true;

        const deserialized = new DATETIME(new Date(0)).deserialize(
            datatype.serialize(),
        );

        expect(deserialized.isNull).toBe(true);
    });

    it('should serialize and deserialize a null CHAR', () => {
        const datatype = new CHAR('value', 5);
        datatype.isNull = true;

        const deserialized = new CHAR('', 5).deserialize(datatype.serialize());

        expect(deserialized.isNull).toBe(true);
    });

    it('should preserve null and non-null fields in a record', () => {
        const record = [
            new INT(42),
            new VARCHAR('hidden', 20),
            new BOOLEAN(true),
            new DOUBLE(3.14),
            new CHAR('hidden', 6),
            new SERIAL(123),
            new TIMESTAMP(new Date('2023-01-01T00:00:00Z')),
            new DATETIME(new Date('2024-01-01T00:00:00Z')),
        ];
        record[1].isNull = true;
        record[4].isNull = true;
        record[6].isNull = true;

        const recordManager = new RecordManager({} as PageManager);
        const serialized = recordManager['serializeRecord'](record);
        const deserialized = recordManager['deserializeRecord'](
            serialized,
            record,
        );

        expect(deserialized.map((field) => field.isNull)).toEqual([
            false,
            true,
            false,
            false,
            true,
            false,
            true,
            false,
        ]);
        expect(deserialized[0].value).toBe(42);
        expect(deserialized[2].value).toBe(true);
        expect(deserialized[3].value).toBe(3.14);
        expect(deserialized[5].value).toBe(123);
        expect(deserialized[7].value).toEqual(
            new Date('2024-01-01T00:00:00Z'),
        );
    });
});
