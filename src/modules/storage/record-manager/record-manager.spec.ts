import { RecordManager } from './record-manager.js';
import { PageManager } from '../page-manager/page-manager.js';
import {
    BOOLEAN,
    CHAR,
    DATETIME,
    DOUBLE,
    INT,
    SERIAL,
    TIMESTAMP,
    VARCHAR,
} from '../dto/datatype.dto.js';
import e from 'express';
import { DatatypeException } from '../exceptions/datatype.exception.js';

describe('RecordManager', () => {
    const pageManagerMock = {
        addRecord: vi.fn(),
    } satisfies PageManager & { addRecord: () => void };
    const createPageSpy = vi.spyOn(pageManagerMock, 'addRecord');

    it('should be defined', () => {
        expect(new RecordManager(pageManagerMock)).toBeDefined();
    });

    it('should spy on the page manager mock passed to it', () => {
        const recordManager = new RecordManager(pageManagerMock);

        pageManagerMock.addRecord();

        expect(recordManager).toBeDefined();
        expect(createPageSpy).toHaveBeenCalledOnce();
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

        expect(deserialized.value).toBe(varcharValue);
        expect(deserialized.size).toBe(varcharValue.length * 2);
    });
});
