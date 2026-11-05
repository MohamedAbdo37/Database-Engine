import { DatabaseType } from '../../parser/query-structure.class.js';

export interface DBObjects {}

export interface CatalogSchema extends DBObjects {
    tableName: string;
    columns: {
        name: string;
        datatype: DatabaseType;
        isPrimary: boolean;
        primaryOrder?: number;
        isUnique: boolean;
        isNullable: boolean;
    }[];

    dataFile: string;

    indexes: {
        name: string;
        columns: string[];
        isUnique: boolean;
        file: string;
    }[];
}

export interface IndexSchema extends DBObjects {}

export interface pageHeader {}
