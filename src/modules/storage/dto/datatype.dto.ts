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
    private _value: T;
    private _type: DatatypeEnum;
    private _size: number;
    private _isNull: boolean = false;

    constructor(value: T, type: DatatypeEnum, size: number) {
        this._value = value;
        this._type = type;
        this._size = size;
    }

    public get value(): T {
        return this._value;
    }
    protected set value(val: T) {
        this._value = val;
    }
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
}

export class SERIAL extends Datatype<number> {
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
    constructor(value: number) {
        if (value < 0) {
            throw new DatatypeException(
                'Value must be a non-negative integer for SERIAL type',
            );
        }
        super(value, DatatypeEnum.SERIAL, 5);
    }
}

export class INT extends Datatype<number> {
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
    constructor(value: number) {
        if (value < Number.MIN_SAFE_INTEGER)
            throw new DatatypeException(
                `Value ${value} is less than the minimum safe integer limit for INT type`,
            );

        if (value > Number.MAX_SAFE_INTEGER)
            throw new DatatypeException(
                `Value ${value} exceeds the maximum safe integer limit for INT type`,
            );

        super(value, DatatypeEnum.INT, 5);
    }
}

export class DOUBLE extends Datatype<number> {
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

    constructor(value: number) {
        if (Math.abs(value) < Number.EPSILON) value = 0;
        if (value < Number.MIN_SAFE_INTEGER)
            throw new DatatypeException(
                `Value ${value} is less than the minimum safe value limit for DOUBLE type`,
            );
        if (value > Number.MAX_SAFE_INTEGER)
            throw new DatatypeException(
                `Value ${value} exceeds the maximum safe value limit for DOUBLE type`,
            );
        super(value, DatatypeEnum.DOUBLE, 9);
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

    constructor(value: string, length: number) {
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

        if (value.length > length) {
            throw new Error(
                `Value length exceeds the specified length of ${length}`,
            );
        }
        super(
            value,
            DatatypeEnum.VARCHAR,
            new TextEncoder().encode(value).length + 3,
        );
    }
}

export class BOOLEAN extends Datatype<boolean> {
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
    constructor(value: boolean) {
        super(value, DatatypeEnum.BOOLEAN, 2);
    }
}

export class TIMESTAMP extends Datatype<Date> {
    constructor(value: Date) {
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
    constructor(value: Date) {
        super(value, DatatypeEnum.DATETIME, 9);
    }
}

export class CHAR extends Datatype<string> {
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

    constructor(value: string, length: number) {
        if (length <= 0) {
            throw new Error(
                `Length must be a positive integer greater than zero`,
            );
        }
        if (value.length > length) {
            throw new Error(
                `Value length exceeds the specified length of ${length}`,
            );
        }
        super(value, DatatypeEnum.CHAR, length * 2 + 1); // Assuming 2 bytes per character for UTF-16 encoding
    }
}
