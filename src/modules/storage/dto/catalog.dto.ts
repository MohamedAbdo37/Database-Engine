import {
    BOOLEAN,
    CHAR,
    Datatype,
    DatatypeEnum,
    DATETIME,
    DOUBLE,
    INT,
    SERIAL,
    TIMESTAMP,
    VARCHAR,
} from './datatype.dto.js';

export interface DBObjects {
    serialize(): Buffer;
}

export class CatalogColumn {
    name: string;
    id: number;
    datatype: DatatypeEnum;
    isPrimary: boolean;
    isUnique: boolean;
    value: number;
    isNullable: boolean;

    constructor(
        name: string,
        id: number,
        datatype: DatatypeEnum,
        isPrimary: boolean,
        isUnique: boolean,
        isNullable: boolean,
        value?: number,
    ) {
        this.name = name;
        this.id = id;
        this.datatype = datatype;
        this.isPrimary = isPrimary;
        if (!isPrimary) {
            this.isUnique = isUnique;
            this.isNullable = isNullable;
        } else {
            this.isUnique = true;
            this.isNullable = false;
        }
        this.value = value || -1;
    }

    public getColumnDatatypeObject(): Datatype<any> {
        switch (this.datatype) {
            case DatatypeEnum.SERIAL:
                return new SERIAL(0);

            case DatatypeEnum.INT:
                return new INT(0);

            case DatatypeEnum.DOUBLE:
                return new DOUBLE(0);

            case DatatypeEnum.CHAR:
                return new CHAR('', this.value);

            case DatatypeEnum.VARCHAR:
                return new VARCHAR('', this.value);

            case DatatypeEnum.BOOLEAN:
                return new BOOLEAN(false);

            case DatatypeEnum.TIMESTAMP:
                return new TIMESTAMP(new Date());

            case DatatypeEnum.DATETIME:
                return new DATETIME(new Date());

            default:
                throw new Error(`Unsupported datatype: ${this.datatype}`);
        }
    }

    public serialize(): Buffer {
        const buffer = Buffer.alloc(18 + this.name.length * 2);
        let offset = 0;
        buffer.writeInt16BE(this.datatype, 0);
        buffer.writeInt8(this.isPrimary ? 1 : 0, 2);
        buffer.writeInt8(this.isUnique ? 1 : 0, 3);
        buffer.writeInt8(this.isNullable ? 1 : 0, 4);
        buffer.writeInt32BE(this.value, 5);
        buffer.writeUInt8(this.id, 9);
        offset = 10;
        buffer.writeUInt16BE(this.name.length, offset);
        buffer.write(this.name, offset + 2, 'utf16le');

        return buffer;
    }

    public static deserialize(buffer: Buffer): CatalogColumn {
        const datatype = buffer.readInt16BE(0);
        const isPrimary = buffer.readInt8(2) === 1;
        const isUnique = buffer.readInt8(3) === 1;
        const isNullable = buffer.readInt8(4) === 1;
        const value = buffer.readInt32BE(5);
        const id = buffer.readUInt8(9);
        const nameLength = buffer.readUInt16BE(10);
        const name = buffer.toString('utf16le', 12, 12 + nameLength * 2);

        return new CatalogColumn(
            name,
            id,
            datatype,
            isPrimary,
            isUnique,
            isNullable,
            value,
        );
    }
}

export interface CatalogIndex {
    name: string;
    columnsID: number[];
    isUnique: boolean;
}

export class Catalog implements DBObjects {
    tableName: string;
    numberOfColumns: number;
    numberOfIndexes: number;

    constructor(
        tableName: string,
        columns: CatalogColumn[],
        indexes: CatalogIndex[] | null = [],
    ) {
        this.tableName = tableName;
        this.columns = columns;
        this.numberOfColumns = columns.length;
        if (indexes) {
            this.indexes = indexes;
            this.numberOfIndexes = indexes.length;
        } else {
            this.indexes = [];
            this.numberOfIndexes = 0;
        }
    }

    columns: CatalogColumn[];

    indexes: CatalogIndex[];

    serialize(): Buffer {
        const tableNameLength = this.tableName.length;
        const totalLength =
            12 +
            this.columns.reduce(
                (acc, column) => acc + 16 + column.name.length * 2,
                0,
            ) +
            this.indexes.reduce(
                (acc, index) =>
                    acc +
                    5 +
                    index.columnsID.length * 2 +
                    index.name.length * 2,
                0,
            ) +
            tableNameLength * 2;

        const buffer = Buffer.alloc(totalLength);

        buffer.writeInt32BE(tableNameLength, 0);
        buffer.writeInt32BE(this.numberOfColumns, 4);
        buffer.writeInt32BE(this.numberOfIndexes, 8);

        let offset = 12;
        for (const column of this.columns) {
            column.serialize().copy(buffer, offset);
            offset = offset + 16 + column.name.length * 2;
        }

        for (const index of this.indexes) {
            buffer.writeUInt16BE(index.name.length, offset);
            buffer.writeInt8(index.isUnique ? 1 : 0, offset + 2);
            buffer.writeUInt16BE(index.columnsID.length, offset + 3);
            for (let i = 0; i < index.columnsID.length; i++) {
                buffer.writeUInt16BE(index.columnsID[i], offset + 5 + i * 2);
            }
            buffer.write(
                index.name,
                offset + 5 + 2 * index.columnsID.length,
                'utf16le',
            );

            offset += 5 + 2 * (index.columnsID.length + index.name.length);
        }

        buffer.write(this.tableName, offset, 'utf16le');

        return buffer;
    }

    static deserialize(buffer: Buffer): Catalog {
        const tableNameLength = buffer.readInt32BE(0);
        const numberOfColumns = buffer.readInt32BE(4);
        const numberOfIndexes = buffer.readInt32BE(8);

        let offset = 12;
        let columns: CatalogColumn[] = [];
        for (let i = 0; i < numberOfColumns; i++) {
            const column = CatalogColumn.deserialize(buffer.subarray(offset));
            columns.push(column);

            offset = offset + 16 + column.name.length * 2;
        }

        let indexes: CatalogIndex[] = [];
        for (let i = 0; i < numberOfIndexes; i++) {
            const nameLength = buffer.readUInt16BE(offset);
            const isUnique = buffer.readInt8(offset + 2) === 1;
            const columnsIDLength = buffer.readUInt16BE(offset + 3);
            let columnsID: number[] = [];
            for (let j = 0; j < columnsIDLength; j++) {
                columnsID.push(buffer.readUInt16BE(offset + 5 + j * 2));
            }
            const name = buffer.toString(
                'utf16le',
                offset + 5 + 2 * columnsIDLength,
                offset + 5 + 2 * (columnsIDLength + nameLength),
            );

            indexes.push({ name, columnsID, isUnique });
            offset += 5 + 2 * (columnsIDLength + nameLength);
        }

        const tableName = buffer.toString(
            'utf16le',
            offset,
            offset + tableNameLength * 2,
        );

        return new Catalog(tableName, columns, indexes);
    }
}

export interface IndexSchema extends DBObjects {}
