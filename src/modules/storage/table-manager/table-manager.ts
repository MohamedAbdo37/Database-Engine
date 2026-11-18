import { Injectable } from '@nestjs/common';
import { CatalogManager } from '../catalog-manager/catalog-manager.js';
import { Catalog } from '../dto/catalog.dto.js';
import { Datatype } from '../dto/datatype.dto.js';
import { RID } from '../dto/rid.dto.js';
import { IndexManager } from '../index-manager/index-manager.js';
import { PageManager } from '../page-manager/page-manager.js';
import { RecordManager } from '../record-manager/record-manager.js';
import { Column, Row, Table } from './table.dto.js';
import { WhereEvaluationException } from '../exceptions/where-evaluation.exce.js';

export enum WhereOperator {
    EQUALS = '=',
    NOT_EQUALS = '!=',
    GREATER_THAN = '>',
    LESS_THAN = '<',
    GREATER_THAN_OR_EQUAL = '>=',
    LESS_THAN_OR_EQUAL = '<=',
}

@Injectable()
export class TableManager {
    constructor(
        private readonly pageManager: PageManager,
        private readonly indexManager: IndexManager,
        private readonly catalogManager: CatalogManager,
        private readonly recordManager: RecordManager,
    ) {}

    private getValueByIndex(column: any | Table, index: number): any {
        if (column instanceof Table) {
            if (column.columns.length === 0) {
                throw new WhereEvaluationException(
                    'The provided table has no columns. Cannot retrieve value by index.',
                );
            }
            return column.getRowByIndex(index)?.data[0].value;
        }
        return column;
    }

    private isValidComparison(
        leftValue: any,
        rightValue: any,
        operator: WhereOperator,
    ): boolean {
        if (
            leftValue !== null &&
            rightValue !== null &&
            typeof leftValue !== typeof rightValue
        ) {
            throw new WhereEvaluationException(
                `Type mismatch: left operand is of type ${typeof leftValue}, while right operand is of type ${typeof rightValue}.`,
            );
        }

        switch (operator) {
            case WhereOperator.EQUALS:
                return leftValue === rightValue;
            case WhereOperator.NOT_EQUALS:
                return leftValue !== rightValue;
            case WhereOperator.GREATER_THAN:
                return leftValue > rightValue;
            case WhereOperator.LESS_THAN:
                return leftValue < rightValue;
            case WhereOperator.GREATER_THAN_OR_EQUAL:
                return leftValue >= rightValue;
            case WhereOperator.LESS_THAN_OR_EQUAL:
                return leftValue <= rightValue;
            default:
                throw new WhereEvaluationException(
                    `Unsupported operator: ${operator}`,
                );
        }
    }

    public async isTableExists(tableName: string): Promise<boolean> {
        try {
            await this.catalogManager.getCatalog(tableName);
            return true;
        } catch {
            return false;
        }
    }
    public async createTable(schema: Catalog): Promise<void> {
        await this.pageManager.createNewTable(schema);
        await this.indexManager.createIndexFile(
            schema.tableName,
            schema.columns[0].name,
            [0],
            `${schema.tableName}_${schema.columns[0].name}_unique`,
            true,
        );
        await this.catalogManager.createCatalog(schema);
    }

    public async dropTable(tableName: string): Promise<void> {
        await this.catalogManager.dropTable(tableName);
    }

    public async getTableSchema(tableName: string): Promise<Catalog> {
        const schema = await this.catalogManager.getCatalog(tableName);
        return schema;
    }

    public async insertRecords(
        tableName: string,
        records: Datatype<any>[][],
    ): Promise<RID[]> {
        const schema =
            await this.catalogManager.getCatalogSchemaRecord(tableName);
        if (records[0].length !== schema.length) {
            throw new Error(
                `Record length (${records[0].length}) does not match schema length (${schema.length})`,
            );
        }

        return await this.recordManager.insertRecords(tableName, records);
    }

    public async updateRecord(
        tableName: string,
        recordId: RID,
        schema: Datatype<any>[],
        updatedRecord: any[],
    ): Promise<RID> {
        if (updatedRecord.length !== schema.length) {
            throw new Error(
                `Updated record length (${updatedRecord.length}) does not match schema length (${schema.length})`,
            );
        }
        const record: Datatype<any>[] = [];

        for (let i = 0; i < updatedRecord.length; i++) {
            const datatype = schema[i];
            datatype.value = updatedRecord[i];
            record.push(datatype);
        }

        return await this.recordManager.updateRecord(
            tableName,
            recordId,
            record,
        );
    }

    public async updateRecords(
        tableName: string,
        schema: Datatype<any>[],
        updatedRecords: Row[],
    ): Promise<RID[]> {
        if (updatedRecords.length === 0) {
            return [];
        }

        if (updatedRecords[0].data.length !== schema.length) {
            throw new Error(
                `Record length (${updatedRecords[0].data.length}) does not match schema length (${schema.length})`,
            );
        }

        return await this.recordManager.updateRecords(
            tableName,
            updatedRecords,
        );
    }

    public async deleteRecord(tableName: string, recordId: RID): Promise<void> {
        await this.recordManager.deleteRecord(tableName, recordId);
    }

    public async deleteRecords(
        tableName: string,
        records: Row[],
    ): Promise<void> {
        const recordIds = records.map((record) => record.rid);
        await this.recordManager.deleteRecords(tableName, recordIds);
    }

    public async getCatalogSchemaRecord(
        tableName: string,
    ): Promise<Datatype<any>[]> {
        return await this.catalogManager.getCatalogSchemaRecord(tableName);
    }

    public async getRecord(
        tableName: string,
        recordId: RID,
        table: Table,
    ): Promise<Table> {
        const schema = await this.getCatalogSchemaRecord(tableName);

        const record = await this.recordManager.retrieveRecord(
            tableName,
            recordId,
            schema,
        );

        if (!record) return table;

        table.addRowToTableView(recordId, record);

        return table;
    }

    public whereEvaluate(
        table: Table,
        operator: WhereOperator,
        right: Column | any,
        left: Column | any,
    ): Table {
        const filteredTable = new Table(table.name, table.columns);
        let rightSide: any | Table;
        let leftSide: any | Table;

        if (right !== null && typeof right === 'object' && 'name' in right)
            rightSide = table.getColumns([(right as Column).name]);
        else rightSide = right;

        if (left !== null && typeof left === 'object' && 'name' in left)
            leftSide = table.getColumns([(left as Column).name]);
        else leftSide = left;

        for (let i = 0; i < table.size.rows; i++) {
            const leftValue = this.getValueByIndex(leftSide, i);
            const rightValue = this.getValueByIndex(rightSide, i);

            if (this.isValidComparison(leftValue, rightValue, operator)) {
                const row = table.getRowByIndex(i);
                if (row) {
                    filteredTable.addRowToTableView(row.rid, row.data);
                }
            }
        }

        return filteredTable;
    }

    public async scanTable(tableName: string): Promise<Table> {
        const recordSchema = await this.getCatalogSchemaRecord(tableName);
        const schema = await this.getTableSchema(tableName);
        const columns: Column[] = schema.columns.map((col, index) => ({
            name: col.name,
            datatype: recordSchema[index],
            id: index,
            isPrimary: col.isPrimary,
        }));

        const table = new Table(tableName, columns);
        const records = await this.recordManager.scanRecords(
            tableName,
            recordSchema,
        );

        table.addMultipleRowsToTableView(records);

        return table;
    }
}
