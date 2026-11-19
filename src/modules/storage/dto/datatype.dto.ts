import { DatatypeException } from '../exceptions/data-input.exception.js';

export enum DatatypeEnum {
    SERIAL = 0,
    INT = 1,
    DOUBLE = 2,
    VARCHAR = 3,
    BOOLEAN = 4,
    TIMESTAMP = 5,
    DATETIME = 6,
    CHAR = 7,
}

export abstract class Datatype<T> {
    static CHAR(executor: any, CHAR: any, arg2: number, arg3: string): any {
        throw new Error('Method not implemented.');
    }
    static serialize(): any {
        throw new Error('Method not implemented.');
    }
    protected _value: T;
    private _type: DatatypeEnum;
    private _size: number;
    private _isNull: boolean = false;

    constructor(value: T, type: DatatypeEnum, size: number) {
        this._value = value;
        this._type = type;
        this._size = size;
    }

    public abstract get value(): T;
    public abstract set value(val: T);

    public get type(): DatatypeEnum {
        return this._type;
    }
    public get size(): number {
        return this._size;
    }
    protected set size(size: number) {
        this._size = size;
    }

    public get isNull(): boolean {
        return this._isNull;
    }

    public set isNull(value: boolean) {
        this._isNull = value;
    }

    public abstract serialize(): Buffer;
    public abstract deserialize(buffer: Buffer): Datatype<T>;

    equals(other: Datatype<T>): boolean {
        return (
            this.type === other.type &&
            this.size === other.size &&
            this.value === other.value
        );
    }

    public static getDatatypeInstance(
        datatype: DatatypeEnum,
        size: number,
        value?: any,
        isNull?: boolean,
    ): Datatype<any> {
        switch (datatype) {
            case DatatypeEnum.SERIAL:
                return new SERIAL(value ?? 1, isNull);
            case DatatypeEnum.INT:
                return new INT(value ?? 0, isNull);
            case DatatypeEnum.DOUBLE:
                return new DOUBLE(value ?? 0, isNull);
            case DatatypeEnum.VARCHAR:
                return new VARCHAR(value ?? '', size, isNull);
            case DatatypeEnum.BOOLEAN:
                return new BOOLEAN(value ?? false, isNull);
            case DatatypeEnum.TIMESTAMP:
                return new TIMESTAMP(value ?? new Date(0), isNull);
            case DatatypeEnum.DATETIME:
                return new DATETIME(value ?? new Date(0), isNull);
            case DatatypeEnum.CHAR:
                return new CHAR(value ?? '', size, isNull);
            default:
                throw new Error(`Unsupported datatype: ${datatype}`);
        }
    }
}

export class SERIAL extends Datatype<number> {
    public get value(): number {
        if (this.isNull) {
            throw new DatatypeException(
                'Cannot get value of a null SERIAL datatype',
            );
        }
        return this._value;
    }
    public set value(val: number) {
        if (val < 0) {
            throw new DatatypeException(
                'Value must be a non-negative integer for SERIAL type',
            );
        }
        this._value = Math.trunc(val);
        this.isNull = false;
    }

    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.writeUInt8(this.isNull ? 1 : 0, 0);
        if (!this.isNull) buffer.writeUInt32BE(this.value, 1);
        return buffer;
    }
    public deserialize(buffer: Buffer): Datatype<number> {
        const isNull = buffer.readUInt8(0) === 1;
        this.isNull = isNull;
        if (!isNull) {
            const value = buffer.readUInt32BE(1);
            this.value = value;
        }
        return this;
    }
    constructor(value: number, isNull: boolean = false) {
        super(0, DatatypeEnum.SERIAL, 5);
        if (isNull) {
            this.isNull = true;
            return;
        }
        this.value = value;
    }
}

export class INT extends Datatype<number> {
    public get value(): number {
        if (this.isNull) {
            throw new DatatypeException(
                'Cannot get value of a null INT datatype',
            );
        }

        return this._value;
    }

    public set value(val: number) {
        if (val < Number.MIN_SAFE_INTEGER)
            throw new DatatypeException(
                `Value ${val} is less than the minimum safe integer limit for INT type`,
            );

        if (val > Number.MAX_SAFE_INTEGER)
            throw new DatatypeException(
                `Value ${val} exceeds the maximum safe integer limit for INT type`,
            );
        this._value = Math.trunc(val);
        this.isNull = false;
    }
    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.writeUInt8(this.isNull ? 1 : 0, 0);
        if (!this.isNull) buffer.writeInt32BE(this.value, 1);
        return buffer;
    }
    public deserialize(buffer: Buffer): Datatype<number> {
        const isNull = buffer.readUInt8(0) === 1;
        this.isNull = isNull;
        if (!isNull) {
            const value = buffer.readInt32BE(1);
            this.value = value;
        }
        return this;
    }
    constructor(value: number, isNull: boolean = false) {
        super(0, DatatypeEnum.INT, 5);
        if (isNull) {
            this.isNull = true;
            return;
        }
        this.value = value;
    }
}

export class DOUBLE extends Datatype<number> {
    public get value(): number {
        if (this.isNull) {
            throw new DatatypeException(
                'Cannot get value of a null DOUBLE datatype',
            );
        }

        return this._value;
    }
    public set value(val: number) {
        if (Math.abs(val) < Number.EPSILON) val = 0;
        if (val < Number.MIN_SAFE_INTEGER)
            throw new DatatypeException(
                `Value ${val} is less than the minimum safe value limit for DOUBLE type`,
            );
        if (val > Number.MAX_SAFE_INTEGER)
            throw new DatatypeException(
                `Value ${val} exceeds the maximum safe value limit for DOUBLE type`,
            );

        this._value = val;
        this.isNull = false;
    }

    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.writeUInt8(this.isNull ? 1 : 0, 0);
        if (!this.isNull) {
            buffer.writeDoubleBE(this.value, 1);
        }
        return buffer;
    }

    public deserialize(buffer: Buffer): Datatype<number> {
        const isNull = buffer.readUInt8(0) === 1;
        this.isNull = isNull;
        if (!isNull) {
            const value = buffer.readDoubleBE(1);
            this.value = value;
        }
        return this;
    }

    constructor(value: number, isNull: boolean = false) {
        super(0, DatatypeEnum.DOUBLE, 9);
        if (isNull) {
            this.isNull = true;
            return;
        }

        this.value = value;
    }

    equals(other: Datatype<number>): boolean {
        if (this.type !== other.type || this.size !== other.size) {
            return false;
        }

        if (Math.abs(this.value - other.value) < Number.EPSILON) {
            return true;
        }

        return false;
    }
}

export class VARCHAR extends Datatype<string> {
    public length: number;

    public get value(): string {
        if (this.isNull) {
            throw new DatatypeException(
                'Cannot get value of a null VARCHAR datatype',
            );
        }

        return this._value;
    }
    public set value(val: string) {
        if (val.length > this.length) {
            throw new Error(
                `Value length exceeds the specified length of ${this.length} characters for VARCHAR type`,
            );
        }

        this._value = val;
        this.size = new TextEncoder().encode(val).length + 3;
        this.isNull = false;
    }

    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.writeUInt8(this.isNull ? 1 : 0, 0);
        if (this.isNull) return buffer;

        buffer.writeUInt16BE(this.size, 1);
        buffer.write(this.value, 3, this.size, 'utf-8');
        return buffer;
    }
    public deserialize(buffer: Buffer): Datatype<string> {
        this.isNull = buffer.readUInt8(0) === 1;
        if (this.isNull) return this;
        this.size = buffer.readUInt16BE(1);
        if (this.size > 4047) {
            throw new DatatypeException(
                `Size ${this.size} exceeds the maximum allowed size of 4047 bytes for VARCHAR type`,
            );
        }

        const value = buffer.toString('utf-8', 3, this.size).replace(/\0/g, '');
        this.value = value;
        return this;
    }

    constructor(value: string, length: number, isNull: boolean = false) {
        if (length <= 0) {
            throw new Error(
                `Length must be a positive integer greater than zero`,
            );
        }

        if (length > 1018) {
            throw new Error(
                `Length exceeds the maximum allowed length of 1018 characters`,
            );
        }

        if (isNull) {
            super('', DatatypeEnum.VARCHAR, 3);
            this.isNull = true;
            this.length = length;
            return;
        }

        if (value.length > length) {
            throw new Error(
                `Value length exceeds the specified length of ${length} characters for VARCHAR type`,
            );
        }

        super(
            value,
            DatatypeEnum.VARCHAR,
            new TextEncoder().encode(value).length + 3,
        );
        this.length = length;
    }
}

export class BOOLEAN extends Datatype<boolean> {
    public get value(): boolean {
        if (this.isNull) {
            throw new DatatypeException(
                'Cannot get value of a null BOOLEAN datatype',
            );
        }

        return this._value;
    }

    public set value(val: boolean) {
        this._value = val;
        this.isNull = false;
    }
    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.writeUInt8(this.isNull ? 1 : 0, 0);
        if (this.isNull) return buffer;
        buffer.writeUInt8(this.value ? 1 : 0, 1);
        return buffer;
    }
    public deserialize(buffer: Buffer): Datatype<boolean> {
        const isNull = buffer.readUInt8(0) === 1;
        this.isNull = isNull;
        if (isNull) return this;
        const value = buffer.readUInt8(1) === 1;
        this.value = value;
        return this;
    }
    constructor(value: boolean, isNull: boolean = false) {
        if (isNull) {
            super(false, DatatypeEnum.BOOLEAN, 2);
            this.isNull = true;
            return;
        }
        super(value, DatatypeEnum.BOOLEAN, 2);
    }
}

export class TIMESTAMP extends Datatype<Date> {
    public get value(): Date {
        if (this.isNull) {
            throw new DatatypeException(
                'Cannot get value of a null TIMESTAMP datatype',
            );
        }

        return this._value;
    }
    public set value(val: Date) {
        if (isNaN(val.getTime())) {
            throw new DatatypeException(
                `Invalid Date object provided for TIMESTAMP type`,
            );
        }

        this._value = val;
        this.isNull = false;
    }

    constructor(value: Date, isNull: boolean = false) {
        if (isNull) {
            super(new Date(0), DatatypeEnum.TIMESTAMP, 9);
            this.isNull = true;
            return;
        }
        if (isNaN(value.getTime())) {
            throw new DatatypeException(
                `Invalid Date object provided for TIMESTAMP type`,
            );
        }
        super(value, DatatypeEnum.TIMESTAMP, 9);
    }

    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.writeUInt8(this.isNull ? 1 : 0, 0);
        if (this.isNull) return buffer;
        buffer.writeBigInt64BE(BigInt(this.value.getTime()), 1);
        return buffer;
    }

    public deserialize(buffer: Buffer): Datatype<Date> {
        const isNull = buffer.readUInt8(0) === 1;
        this.isNull = isNull;
        if (isNull) return this;
        const timestamp = buffer.readBigInt64BE(1);
        this.value = new Date(Number(timestamp));
        return this;
    }
}

export class DATETIME extends Datatype<Date> {
    public get value(): Date {
        if (this.isNull) {
            throw new DatatypeException(
                'Cannot get value of a null DATETIME datatype',
            );
        }

        return this._value;
    }
    public set value(val: Date) {
        if (isNaN(val.getTime())) {
            throw new DatatypeException(
                `Invalid Date object provided for DATETIME type`,
            );
        }
        this._value = val;
        this.isNull = false;
    }

    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.writeUInt8(this.isNull ? 1 : 0, 0);
        if (this.isNull) return buffer;
        buffer.writeBigInt64BE(BigInt(this.value.getTime()), 1);
        return buffer;
    }
    public deserialize(buffer: Buffer): Datatype<Date> {
        const isNull = buffer.readUInt8(0) === 1;
        this.isNull = isNull;
        if (isNull) return this;
        const timestamp = buffer.readBigInt64BE(1);
        this.value = new Date(Number(timestamp));
        return this;
    }

    constructor(value: Date, isNull: boolean = false) {
        if (isNull) {
            super(new Date(0), DatatypeEnum.DATETIME, 9);
            this.isNull = true;
            return;
        }
        super(value, DatatypeEnum.DATETIME, 9);
    }
}

export class CHAR extends Datatype<string> {
    public length: number;

    public get value(): string {
        if (this.isNull) {
            throw new DatatypeException(
                'Cannot get value of a null CHAR datatype',
            );
        }

        return this._value;
    }
    public set value(val: string) {
        if (val.length > this.length) {
            throw new Error(
                `Value length exceeds the specified length of ${this.length}`,
            );
        }

        this._value = val;
        this.isNull = false;
    }
    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.writeUInt8(this.isNull ? 1 : 0, 0);
        if (this.isNull) return buffer;
        buffer.write(this.value, 1, this.size - 1, 'utf16le');
        return buffer;
    }
    public deserialize(buffer: Buffer): Datatype<string> {
        const isNull = buffer.readUInt8(0) === 1;
        this.isNull = isNull;
        if (isNull) return this;
        const value = buffer
            .toString('utf16le', 1, this.size)
            .replace(/\0/g, '');
        this.value = value;
        return this;
    }

    constructor(value: string, length: number, isNull: boolean = false) {
        if (length <= 0) {
            throw new Error(
                `Length must be a positive integer greater than zero`,
            );
        }

        if (isNull) {
            super('', DatatypeEnum.CHAR, length * 2 + 1);
            this.isNull = true;
            this.length = length;
            return;
        }
        if (value.length > length) {
            throw new Error(
                `Value length exceeds the specified length of ${length}`,
            );
        }
        super(value, DatatypeEnum.CHAR, length * 2 + 1); // Assuming 2 bytes per character for UTF-16 encoding
        this.length = length;
    }
}
