import { Injectable } from '@nestjs/common';
import { ExecutorIF } from '../executor.js';
import { TableManager } from '../../../storage/table-manager/table-manager.js';
import {
    Catalog,
    CatalogColumn,
    CatalogIndex,
} from '../../../storage/dto/catalog.dto.js';
import { DatatypeEnum } from '../../../storage/dto/datatype.dto.js';
import { CreateTableAST } from '../../parser/ast/ddl/create-table.ast.js';
import { ColumnConstraintEnum } from '../../parser/ast/ddl/column-definition.ast.js';

@Injectable()
export class CreateExecutor implements ExecutorIF {
    constructor(private readonly tableManager: TableManager) {}

    public async execute(ast: CreateTableAST): Promise<void> {
        const catalogColumns: CatalogColumn[] = [];
        for (const [id, columnDef] of ast.columns.entries()) {
            const columnValue =
                columnDef.datatype === DatatypeEnum.SERIAL
                    ? 0
                    : columnDef.length !== undefined
                      ? columnDef.length
                      : -1;
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
}
