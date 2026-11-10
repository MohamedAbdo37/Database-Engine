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
    datatype: DatatypeEnum;
    isPrimary: boolean;
    isUnique: boolean;
    value: number;
    isNullable: boolean;

    constructor(
        name: string,
        datatype: DatatypeEnum,
        isPrimary: boolean,
        isUnique: boolean,
        isNullable: boolean,
        value?: number,
    ) {
        this.name = name;
        this.datatype = datatype;
        this.isPrimary = isPrimary;
        this.isUnique = isUnique;
        this.isNullable = isNullable;
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
        const buffer = Buffer.alloc(16 + this.name.length * 2);
        let offset = 0;
        buffer.writeInt16BE(this.datatype, offset);
        buffer.writeInt8(this.isPrimary ? 1 : 0, offset + 2);
        buffer.writeInt8(this.isUnique ? 1 : 0, offset + 5);
        buffer.writeInt8(this.isNullable ? 1 : 0, offset + 9);
        buffer.writeInt32BE(this.value, offset + 14);
        buffer.writeUInt16BE(this.name.length, offset);
        buffer.write(this.name, offset + 16, 'utf16le');

        return buffer;
    }

    public static deserialize(buffer: Buffer): CatalogColumn {
        const datatype = buffer.readInt16BE(0);
        const isPrimary = buffer.readInt8(2) === 1;
        const isUnique = buffer.readInt8(5) === 1;
        const isNullable = buffer.readInt8(9) === 1;
        const value = buffer.readInt32BE(14);
        const nameLength = buffer.readUInt16BE(0);
        const name = buffer.toString('utf16le', 16, 16 + nameLength * 2);

        return new CatalogColumn(
            name,
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
        const columnsnameLength = this.columns.reduce(
            (acc, column) => acc + column.name.length,
            0,
        );
        const indexesnameLength = this.indexes.reduce(
            (acc, index) => acc + index.name.length,
            0,
        );
        const totalLength =
            4 +
            tableNameLength * 2 +
            4 +
            columnsnameLength * 2 +
            this.columns.length * 13 +
            4 +
            indexesnameLength * 2 +
            this.indexes.length +
            this.indexes.reduce(
                (acc, index) => acc + index.columnsID.length * 4,
                0,
            );

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
            buffer.writeInt8(index.isUnique ? 1 : 0, offset);
            buffer.writeUInt16BE(index.columnsID.length, offset + 1);
            for (let i = 0; i < index.columnsID.length; i++) {
                buffer.writeUInt16BE(index.columnsID[i], offset + 3 + i * 2);
            }
            buffer.writeUInt16BE(index.name.length, offset);
            buffer.write(
                index.name,
                offset + 3 + 2 * index.columnsID.length,
                'utf16le',
            );

            offset =
                offset + 3 + 2 * (index.columnsID.length + index.name.length);
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
            const isUnique = buffer.readInt8(offset) === 1;
            const columnsIDLength = buffer.readUInt16BE(offset + 1);
            let columnsID: number[] = [];
            for (let j = 0; j < columnsIDLength; j++) {
                columnsID.push(buffer.readUInt16BE(offset + 3 + j * 2));
            }
            const nameLength = buffer.readUInt16BE(offset);
            const name = buffer.toString(
                'utf16le',
                offset + 3 + 2 * columnsIDLength,
                offset + 3 + 2 * (columnsIDLength + nameLength),
            );

            indexes.push({ name, columnsID, isUnique });
            offset = offset + 3 + 2 * (columnsIDLength + nameLength);
        }

        const tableName = buffer.toString(
            'utf16le',
            offset,
            4 + tableNameLength * 2,
        );

        return new Catalog(tableName, columns, indexes);
    }
}

export interface IndexSchema extends DBObjects {}
