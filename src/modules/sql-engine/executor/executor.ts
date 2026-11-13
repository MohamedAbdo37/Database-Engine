import { Injectable } from '@nestjs/common';
import {
    Catalog,
    CatalogColumn,
    CatalogIndex,
} from '../../storage/dto/catalog.dto.js';
import { TableManager } from '../../storage/table-manager/table-manager.js';
import { DDLType, MainClassAST } from '../parser/ast/ast.class.js';
import { ColumnConstraintEnum } from '../parser/ast/ddl/column-definition.ast.js';
import { CreateTableAST } from '../parser/ast/ddl/create-table.ast.js';
import { ExecutionErrorException } from '../exceptions/execution-error.exc.js';
import { DropTableAST } from '../parser/ast/ddl/drop-table.ast.js';

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
        for (const columnDef of ast.columns) {
            const columnValue =
                columnDef.length !== undefined ? columnDef.length : -1;
            const catalogColumn: CatalogColumn = new CatalogColumn(
                columnDef.name,
                columnDef.datatype,
                columnDef.constraints.includes(
                    ColumnConstraintEnum.PRIMARY_KEY,
                ),
                columnDef.constraints.includes(ColumnConstraintEnum.UNIQUE),
                !columnDef.constraints.includes(
                    ColumnConstraintEnum.NOT_NULLABLE,
                ),
                columnValue,
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
}
