import { CatalogManager } from '../catalog-manager/catalog-manager.js';
import { Catalog } from '../dto/catalog.dto.js';
import { Datatype } from '../dto/datatype.dto.js';
import { RID } from '../dto/rid.dto.js';
import { IndexManager } from '../index-manager/index-manager.js';
import { PageManager } from '../page-manager/page-manager.js';
import { RecordManager } from '../record-manager/record-manager.js';
import { Table } from './table.dto.js';

export class TableManager {
    constructor(
        private readonly pageManager: PageManager,
        private readonly indexManager: IndexManager,
        private readonly catalogManager: CatalogManager,
        private readonly recordManager: RecordManager,
    ) {}

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
        await this.indexManager.deleteIndexFile(tableName);
        await this.pageManager.deleteTable(tableName);
        await this.catalogManager.deleteCatalog(tableName);
    }

    public async getTableSchema(tableName: string): Promise<Catalog> {
        const schema = await this.catalogManager.getCatalog(tableName);
        return schema;
    }

    public async insertRecord(
        tableName: string,
        record: Datatype<any>[],
    ): Promise<RID> {
        const schema =
            await this.catalogManager.getCatalogSchemaRecord(tableName);
        if (record.length !== schema.length) {
            throw new Error(
                `Record length (${record.length}) does not match schema length (${schema.length})`,
            );
        }

        return await this.recordManager.insertRecord(tableName, record);
    }

    public async updateRecord(
        tableName: string,
        recordId: RID,
        updatedRecord: Datatype<any>[],
    ): Promise<RID> {
        const schema =
            await this.catalogManager.getCatalogSchemaRecord(tableName);
        if (updatedRecord.length !== schema.length) {
            throw new Error(
                `Updated record length (${updatedRecord.length}) does not match schema length (${schema.length})`,
            );
        }
        return await this.recordManager.updateRecord(
            tableName,
            recordId,
            updatedRecord,
        );
    }

    public async deleteRecord(tableName: string, recordId: RID): Promise<void> {
        await this.recordManager.deleteRecord(tableName, recordId);
    }

    public async getRecord(
        tableName: string,
        recordId: RID,
        table: Table,
    ): Promise<Table> {
        const schema =
            await this.catalogManager.getCatalogSchemaRecord(tableName);
        const record = await this.recordManager.retrieveRecord(
            tableName,
            recordId,
            schema,
        );

        if (!record) return table;

        table.data = [record];

        return table;
    }

    public async scanTable(tableName: string, table: Table): Promise<Table> {
        // TODO: Implement the logic to scan all records in the table and populate the Table object
        return table;
    }
}
