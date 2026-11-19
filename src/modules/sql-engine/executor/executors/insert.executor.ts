import { Injectable } from '@nestjs/common';
import { ExecutorIF } from '../executor.js';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import {
    InsertAST,
    InsertColumn,
    InsertRow,
} from '../../parser/ast/dml/insert.ast.js';
import { Catalog, CatalogColumn } from '../../../storage/dto/catalog.dto.js';
import { Datatype, DatatypeEnum } from '../../../storage/dto/datatype.dto.js';

@Injectable()
export class InsertExecutor implements ExecutorIF {
    constructor(private readonly tableManager: TableManager) {}

    public async execute(ast: InsertAST): Promise<void> {
        const [tableSchema, recordSchema] = await Promise.all([
            this.tableManager.getTableSchema(ast.tableName),
            this.tableManager.getCatalogSchemaRecord(ast.tableName),
        ]);

        const records = ast.rows.map((row) =>
            this.createInsertRecord(
                row,
                tableSchema,
                recordSchema,
            ),
        );

        await this.tableManager.insertRecords(ast.tableName, records);
    }

    private createInsertRecord(
        row: InsertRow,
        tableSchema: Catalog,
        recordSchema: Datatype<any>[],
    ): Datatype<any>[] {
        const record = recordSchema.map(
            (field) =>
                Object.assign(
                    Object.create(Object.getPrototypeOf(field)),
                    field,
                ) as Datatype<any>,
        );

        const providedColumns = new Set<string>();

        for (const column of row.columns) {
            this.applyProvidedColumn(column, tableSchema, record);
            providedColumns.add(column.name);
        }

        for (const column of tableSchema.columns) {
            if (!providedColumns.has(column.name)) {
                this.applyMissingColumn(column, record);
            }
        }

        return record;
    }

    private applyProvidedColumn(
        column: InsertColumn,
        tableSchema: Catalog,
        record: Datatype<any>[],
    ): void {
        const schemaColumn = tableSchema.getColumnByName(column.name)!;

        if (column.isNullable) {
            if (!schemaColumn.isNullable) {
                record[schemaColumn.id].value = schemaColumn.defaultValue;
            } else if (schemaColumn.defaultValue === null) {
                record[schemaColumn.id].isNull = true;
            } else {
                record[schemaColumn.id].value = schemaColumn.defaultValue;
            }
            return;
        }

        record[schemaColumn.id].value = column.value;
    }

    private applyMissingColumn(
        column: CatalogColumn,
        record: Datatype<any>[],
    ): void {
        if (column.datatype === DatatypeEnum.SERIAL) {
            record[column.id].value = column.value;
            return;
        }

        if (column.defaultValue !== null) {
            record[column.id].value = column.defaultValue;
        } else {
            record[column.id].isNull = true;
        }
    }
}
