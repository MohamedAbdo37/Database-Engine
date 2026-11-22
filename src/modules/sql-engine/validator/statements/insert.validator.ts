import { Injectable } from '@nestjs/common';
import { Validator, ValidatorIF } from '../validator.js';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import { InsertAST, InsertColumn } from '../../parser/ast/dml/insert.ast.js';
import { Catalog, CatalogColumn } from '../../../storage/dto/catalog.dto.js';
import { DatatypeEnum } from '../../../storage/dto/datatype.dto.js';
import { ExecutionErrorException } from '../../exceptions/execution-error.exc.js';

@Injectable()
export class InsertValidator implements ValidatorIF {
    constructor(private readonly tableManager: TableManager) {}

    public async validate(ast: InsertAST): Promise<void> {
        await Validator.validateIsTableExists(ast.tableName, this.tableManager);

        const tableSchema = await this.tableManager.getTableSchema(
            ast.tableName,
        );
        let schemaChanged = false;

        for (const row of ast.rows) {
            const providedColumns = new Set<string>();

            for (const column of row.columns) {
                const schemaColumn = this.getInsertSchemaColumn(
                    ast.tableName,
                    column,
                    tableSchema,
                );

                if (providedColumns.has(column.name)) {
                    throw new ExecutionErrorException(
                        `Column '${column.name}' is provided more than once in the INSERT statement.`,
                    );
                }
                providedColumns.add(column.name);

                this.validateProvidedColumnValue(
                    ast.tableName,
                    column,
                    schemaColumn,
                );
            }

            for (const schemaColumn of tableSchema.columns) {
                if (providedColumns.has(schemaColumn.name)) {
                    continue;
                }

                if (schemaColumn.datatype === DatatypeEnum.SERIAL) {
                    schemaColumn.value++;
                    row.columns.push({
                        name: schemaColumn.name,
                        value: schemaColumn.value,
                        isNullable: false,
                    });
                    schemaChanged = true;
                    continue;
                }

                this.validateMissingInsertColumn(ast.tableName, schemaColumn);
            }
        }

        if (schemaChanged) {
            await this.tableManager.updateCatalog(tableSchema);
        }
    }

    private validateProvidedColumnValue(
        tableName: string,
        column: InsertColumn,
        schemaColumn: CatalogColumn,
    ): void {
        if (column.isNullable) {
            this.validateNullableInsertColumn(tableName, column, schemaColumn);
            return;
        }

        if (
            (schemaColumn.datatype === DatatypeEnum.INT ||
                schemaColumn.datatype === DatatypeEnum.SERIAL ||
                schemaColumn.datatype === DatatypeEnum.DOUBLE) &&
            typeof column.value !== 'number'
        ) {
            throw new ExecutionErrorException(
                `Invalid value for column '${column.name}' in table '${tableName}'.`,
            );
        }

        if (
            (schemaColumn.datatype === DatatypeEnum.VARCHAR ||
                schemaColumn.datatype === DatatypeEnum.CHAR) &&
            typeof column.value === 'string' &&
            schemaColumn.value >= 0 &&
            column.value.length > schemaColumn.value
        ) {
            throw new ExecutionErrorException(
                `Value for column '${column.name}' exceeds the defined length ${schemaColumn.value}.`,
            );
        }
    }

    private getInsertSchemaColumn(
        tableName: string,
        column: InsertColumn,
        tableSchema: Catalog,
    ): CatalogColumn {
        const schemaColumn = tableSchema.getColumnByName(column.name);
        if (!schemaColumn) {
            throw new ExecutionErrorException(
                `Column '${column.name}' does not exist in table '${tableName}'.`,
            );
        }

        return schemaColumn;
    }

    private validateNullableInsertColumn(
        tableName: string,
        column: InsertColumn,
        schemaColumn: CatalogColumn,
    ): void {
        if (column.isNullable && !schemaColumn.isNullable) {
            throw new ExecutionErrorException(
                `Column '${column.name}' cannot be null in table '${tableName}'.`,
            );
        }
    }

    private validateMissingInsertColumn(
        tableName: string,
        schemaColumn: CatalogColumn,
    ): void {
        if (!schemaColumn.isNullable && schemaColumn.defaultValue === null) {
            throw new ExecutionErrorException(
                `Column '${schemaColumn.name}' is required in table '${tableName}' and cannot be null.`,
            );
        }
    }
}
