import { DatatypeException } from '../exceptions/datatype.exception.js';

export enum DatatypeEnum {
    SERIAL = 'SERIAL',
    INT = 'INT',
    DOUBLE = 'DOUBLE',
    VARCHAR = 'VARCHAR',
    BOOLEAN = 'BOOLEAN',
    TIMESTAMP = 'TIMESTAMP',
    DATETIME = 'DATETIME',
    CHAR = 'CHAR',
}

export abstract class Datatype<T> {
    private _value: T;
    private _type: DatatypeEnum;
    private _size: number;

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
        buffer.writeUInt32BE(this.value, 0);
        return buffer;
    }
    public deserialize(buffer: Buffer): Datatype<number> {
        const value = buffer.readUInt32BE(0);
        this.value = value;
        return this;
    }
    constructor(value: number) {
        if (value < 0) {
            throw new DatatypeException(
                'Value must be a non-negative integer for SERIAL type',
            );
        }
        super(value, DatatypeEnum.SERIAL, 4);
    }
}

export class INT extends Datatype<number> {
    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.writeInt32BE(this.value, 0);
        return buffer;
    }
    public deserialize(buffer: Buffer): Datatype<number> {
        const value = buffer.readInt32BE(0);
        this.value = value;
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

        super(value, DatatypeEnum.INT, 4);
    }
}

export class DOUBLE extends Datatype<number> {
    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.writeDoubleBE(this.value, 0);
        return buffer;
    }
    public deserialize(buffer: Buffer): Datatype<number> {
        const value = buffer.readDoubleBE(0);
        this.value = value;
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
        super(value, DatatypeEnum.DOUBLE, 8);
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
        buffer.write(this.value, 0, this.size, 'utf16le');
        return buffer;
    }
    public deserialize(buffer: Buffer): Datatype<string> {
        const value = buffer
            .toString('utf16le', 0, buffer.length)
            .replace(/\0/g, '');
        this.value = value;
        this.size = value.length * 2;
        return this;
    }

    constructor(value: string, length: number) {
        if (value.length > length) {
            throw new Error(
                `Value length exceeds the specified length of ${length}`,
            );
        }
        super(value, DatatypeEnum.VARCHAR, value.length * 2); // Assuming 2 bytes per character for UTF-16 encoding
    }
}

export class BOOLEAN extends Datatype<boolean> {
    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.writeUInt8(this.value ? 1 : 0, 0);
        return buffer;
    }
    public deserialize(buffer: Buffer): Datatype<boolean> {
        const value = buffer.readUInt8(0) === 1;
        this.value = value;
        return this;
    }
    constructor(value: boolean) {
        super(value, DatatypeEnum.BOOLEAN, 1);
    }
}

export class TIMESTAMP extends Datatype<Date> {
    constructor(value: Date) {
        super(value, DatatypeEnum.TIMESTAMP, 8);
    }

    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.writeBigInt64BE(BigInt(this.value.getTime()), 0);
        return buffer;
    }

    public deserialize(buffer: Buffer): Datatype<Date> {
        const timestamp = buffer.readBigInt64BE(0);
        this.value = new Date(Number(timestamp));
        return this;
    }
}

export class DATETIME extends Datatype<Date> {
    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.writeBigInt64BE(BigInt(this.value.getTime()), 0);
        return buffer;
    }
    public deserialize(buffer: Buffer): Datatype<Date> {
        const timestamp = buffer.readBigInt64BE(0);
        this.value = new Date(Number(timestamp));
        return this;
    }
    constructor(value: Date) {
        super(value, DatatypeEnum.DATETIME, 8);
    }
}

export class CHAR extends Datatype<string> {
    public serialize(): Buffer {
        const buffer = Buffer.alloc(this.size);
        buffer.write(this.value, 0, this.size, 'utf16le');
        return buffer;
    }
    public deserialize(buffer: Buffer): Datatype<string> {
        const value = buffer
            .toString('utf16le', 0, this.size)
            .replace(/\0/g, '');
        this.value = value;
        return this;
    }

    constructor(value: string, length: number) {
        if (value.length > length) {
            throw new Error(
                `Value length exceeds the specified length of ${length}`,
            );
        }
        super(value, DatatypeEnum.CHAR, length * 2); // Assuming 2 bytes per character for UTF-16 encoding
    }
}
