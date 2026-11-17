import { Injectable } from '@nestjs/common';
import {
    Catalog,
    CatalogColumn,
    CatalogIndex,
} from '../../storage/dto/catalog.dto.js';
import { TableManager } from '../../storage/table-manager/table-manager.js';
import { DDLType, DMLType, MainClassAST } from '../parser/ast/ast.class.js';
import { ColumnConstraintEnum } from '../parser/ast/ddl/column-definition.ast.js';
import { CreateTableAST } from '../parser/ast/ddl/create-table.ast.js';
import { ExecutionErrorException } from '../exceptions/execution-error.exc.js';
import { DropTableAST } from '../parser/ast/ddl/drop-table.ast.js';
import {
    InsertAST,
    InsertColumn,
    InsertRow,
} from '../parser/ast/dml/insert.ast.js';
import {
    Datatype,
    DatatypeEnum,
    VARCHAR,
} from '../../storage/dto/datatype.dto.js';

@Injectable()
export class Executor {
    constructor(private readonly tableManager: TableManager) {}

    public async execute(ast: MainClassAST): Promise<void> {
        switch (ast.type) {
            case DDLType.CREATE_TABLE:
                await this.executeCreateTable(ast as CreateTableAST);
                break;
            case DDLType.DROP_TABLE:
                await this.executeDropTable(ast as DropTableAST);
                break;
            case DDLType.ALTER_TABLE:
                // Implement alter table logic here
                break;
            case DMLType.INSERT:
                await this.executeInsert(ast as InsertAST);
                break;
            default:
                throw new Error(`Unsupported AST type: ${ast.type}`);
        }
    }

    private async executeCreateTable(ast: CreateTableAST): Promise<void> {
        const isTableExists = await this.tableManager.isTableExists(
            ast.tableName,
        );

        if (isTableExists) {
            if (ast.ifNotExists) {
                console.log(
                    `Table '${ast.tableName}' already exists. Skipping creation as 'IF NOT EXISTS' clause is specified.`,
                );
                return;
            }

            throw new ExecutionErrorException(
                `Table '${ast.tableName}' already exists. Use 'IF NOT EXISTS' clause to avoid this error.`,
            );
        }

        const catalogColumns: CatalogColumn[] = [];
        for (const [id, columnDef] of ast.columns.entries()) {
            const columnValue =
                columnDef.length !== undefined ? columnDef.length : -1;
            const catalogColumn: CatalogColumn = new CatalogColumn(
                columnDef.name,
                id,
                columnDef.datatype,
                columnDef.constraints.includes(
                    ColumnConstraintEnum.PRIMARY_KEY,
                ),
                columnDef.constraints.includes(ColumnConstraintEnum.UNIQUE),
                !columnDef.constraints.includes(
                    ColumnConstraintEnum.NOT_NULLABLE,
                ),
                columnValue,
                columnDef.defaultValue,
            );
            catalogColumns.push(catalogColumn);
        }
        const catalogIndexes: CatalogIndex[] = [];

        for (const column of catalogColumns) {
            if (column.isPrimary || column.isUnique) {
                const index: CatalogIndex = {
                    name: `${ast.tableName}_${column.name}_unique`,
                    columnsID: [catalogColumns.indexOf(column)],
                    isUnique: true,
                };
                catalogIndexes.push(index);
            }
        }

        const catalog: Catalog = new Catalog(
            ast.tableName,
            catalogColumns,
            catalogIndexes,
        );
        await this.tableManager.createTable(catalog);
    }

    private async executeDropTable(ast: DropTableAST): Promise<void> {
        const isTableExists = await this.tableManager.isTableExists(
            ast.tableName,
        );

        if (!isTableExists) {
            if (ast.ifExists) {
                console.log(
                    `Table '${ast.tableName}' does not exist. Skipping drop as 'IF EXISTS' clause is specified.`,
                );
                return;
            }

            throw new ExecutionErrorException(
                `Table '${ast.tableName}' does not exist. Use 'IF EXISTS' clause to avoid this error.`,
            );
        }

        await this.tableManager.dropTable(ast.tableName);
    }

    private async executeInsert(ast: InsertAST): Promise<void> {
        const isTableExists = await this.tableManager.isTableExists(
            ast.tableName,
        );

        if (!isTableExists) {
            throw new ExecutionErrorException(
                `Table '${ast.tableName}' does not exist. Cannot perform insert operation.`,
            );
        }

        const [tableSchema, recordSchema] = await Promise.all([
            this.tableManager.getTableSchema(ast.tableName),
            this.tableManager.getCatalogSchemaRecord(ast.tableName),
        ]);

        for (const field of recordSchema) {
            console.log(
                `Field: ${field}, Value: ${field.value}, IsNull: ${field.isNull}, Type: ${field.type}, Size: ${field.size},` +
                    (field.type === DatatypeEnum.CHAR ||
                    field.type === DatatypeEnum.VARCHAR
                        ? ` length: ${(field as VARCHAR).length}`
                        : ''),
            );
        }

        const records = ast.rows.map((row) =>
            this.createInsertRecord(
                ast.tableName,
                row,
                tableSchema,
                recordSchema,
            ),
        );

        await this.tableManager.insertRecords(ast.tableName, records);
    }

    private createInsertRecord(
        tableName: string,
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
            this.applyProvidedColumn(tableName, column, tableSchema, record);
            providedColumns.add(column.name);
        }

        for (const column of tableSchema.columns) {
            if (!providedColumns.has(column.name)) {
                this.applyMissingColumn(tableName, column, record);
            }
        }

        return record;
    }

    private applyProvidedColumn(
        tableName: string,
        column: InsertColumn,
        tableSchema: Catalog,
        record: Datatype<any>[],
    ): void {
        const schemaColumn = tableSchema.getColumnByName(column.name);
        if (!schemaColumn) {
            throw new ExecutionErrorException(
                `Column '${column.name}' does not exist in table '${tableName}'.`,
            );
        }

        if (column.isNullable && !schemaColumn.isNullable) {
            if (schemaColumn.defaultValue === null) {
                throw new ExecutionErrorException(
                    `Column '${column.name}' cannot be null in table '${tableName}'.`,
                );
            }
            record[schemaColumn.id].value = schemaColumn.defaultValue;
            return;
        }

        if (column.isNullable) {
            if (schemaColumn.defaultValue === null) {
                record[schemaColumn.id].isNull = true;
            } else {
                record[schemaColumn.id].value = schemaColumn.defaultValue;
            }
            return;
        }

        record[schemaColumn.id].value = column.value;
    }

    private applyMissingColumn(
        tableName: string,
        column: CatalogColumn,
        record: Datatype<any>[],
    ): void {
        if (column.datatype === DatatypeEnum.SERIAL) {
            column.value++;
            record[column.id].value = column.value;
            return;
        }

        if (!column.isNullable && column.defaultValue === null) {
            throw new ExecutionErrorException(
                `Column '${column.name}' is required and cannot be null in table '${tableName}'.`,
            );
        }

        if (column.defaultValue !== null) {
            record[column.id].value = column.defaultValue;
        } else {
            record[column.id].isNull = true;
        }
    }
}
