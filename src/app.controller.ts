import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
} from '@nestjs/common';
import { AppService } from './app.service.js';
import { RecordManager } from './modules/storage/record-manager/record-manager.js';
import { CHAR, INT } from './modules/storage/dto/datatype.dto.js';
import { Tokenizer } from './modules/sql-engine/tokenizer/tokenizer.js';
import { Token } from './modules/sql-engine/tokenizer/token.class.js';
import { SqlEngineService } from './modules/sql-engine/sql-engine.service.js';

@Controller()
export class AppController {
    constructor(
        private readonly appService: AppService,
        private readonly recordManager: RecordManager,
        private readonly tokenizer: Tokenizer,
        private readonly sqlEngine: SqlEngineService,
    ) {}

    @Get()
    getHello(): string {
        return this.appService.getHello();
    }

    @Post('execute/ddl')
    @HttpCode(HttpStatus.OK)
    async executeDDL(@Body() body: { query: string }): Promise<string> {
        return await this.sqlEngine.executeDDL(body.query);
    }

    @Post('execute/dml')
    @HttpCode(HttpStatus.OK)
    async executeDML(
        @Body() body: { query: string },
    ): Promise<Record<string, unknown>[] | string> {
        return await this.sqlEngine.executeDML(body.query);
    }

    // @Get('test-tokenizer')
    // async testTokenizer(): Promise<Token[]> {
    //     const sqlQuery = 'SELECT * FROM users WHERE age > 30';
    //     const tokens = this.tokenizer.tokenize(sqlQuery);
    //     return tokens;
    // }

    // @Get('test-storage')
    // async testStorage(): Promise<Record<string, any>[] | string | null> {
    //     // await this.pageManager
    //     //     .createNewTable(
    //     //         new CatalogSchema('test_table', [
    //     //             {
    //     //                 name: 'id',
    //     //                 datatype: DatatypeEnum.INT,
    //     //                 isPrimary: true,
    //     //                 isUnique: true,
    //     //                 value: 0,
    //     //                 isNullable: false,
    //     //             },
    //     //             {
    //     //                 name: 'name',
    //     //                 datatype: DatatypeEnum.CHAR,
    //     //                 isPrimary: false,
    //     //                 isUnique: false,
    //     //                 value: 20,
    //     //                 isNullable: true,
    //     //             },
    //     //         ]),
    //     //     )
    //     //     .catch((error: Error) => {
    //     //         console.error(`Error creating new table: ${error.message}`);
    //     //         return `Error creating new table: ${error.message}`;
    //     //     });

    //     // return 'Table created successfully. You can now insert records into the table.';

    //     // let rid: RID = await this.recordManager.insertRecord('test_table', [
    //     //     new INT(2),
    //     //     new CHAR('John Doe', 20),
    //     // ]);

    //     // return `Record inserted with RID: Page ID = ${rid.pageId}, Slot Number = ${rid.slotNumber}`;
    //     // await this.recordManager.retrieveRecord('test_table', rid, [
    //     //     new INT(0),
    //     //     new CHAR('', 20),
    //     // ]);

    //     // rid = await this.recordManager.updateRecord('test_table', rid, [
    //     //     new INT(3),
    //     //     new CHAR('Jane Doe', 20),
    //     // ]);

    //     // await this.recordManager.retrieveRecord('test_table', rid, [
    //     //     new INT(0),
    //     //     new CHAR('', 20),
    //     // ]);

    //     const records = await this.recordManager.retrieveMultipleRecords(
    //         'test',
    //         [
    //             { pageId: 1, slotNumber: 0 },
    //             { pageId: 1, slotNumber: 1 },
    //             { pageId: 1, slotNumber: 2 },
    //             { pageId: 1, slotNumber: 3 },
    //             // { pageId: 1, slotNumber: 4 },
    //             // { pageId: 1, slotNumber: 5 },
    //         ],
    //         [new INT(0), new CHAR('', 20)],
    //     );
    //     return records.map((record) => ({
    //         id: record[0].value,
    //         name: record[1].value,
    //     }));
    // }

    // @Get('test-sql-engine-select')
    // async testExecutorSelect(): Promise<any> {
    //     const sqlQuery = `select * from test`;
    //     // where id = 1 order by name asc
    //     let resultTable: Record<string, unknown>[] | string =
    //         await this.sqlEngine.executeDML(sqlQuery);

    //     if (!resultTable) {
    //         return 'No results found.';
    //     }

    //     return resultTable;
    // }

    // @Get('test-sql-engine')
    // async testExecutor(): Promise<string> {
    //     const sqlQuery = `create table if not exists test_table (
    //         id int primary key,
    //         name char(20) not null
    //     // );`;

    //     // const sqlQuery = `drop table if exists test_table;`;
    //     try {
    //         await this.sqlEngine.executeDDL(sqlQuery);
    //     } catch (error: any) {
    //         return `Error executing DDL query: ${error.message}`;
    //     }

    //     return 'DDL query executed successfully.';
    // }

    // @Get('test-sql-engine-insert')
    // async testExecutorInsert(): Promise<string> {
    //     const sqlQuery = `insert into test (id, name) values (3, 'Johnny Doe');`;
    //     try {
    //         await this.sqlEngine.executeDML(sqlQuery);
    //     } catch (error: any) {
    //         return `Error executing DML query: ${error.message}`;
    //     }

    //     return 'DML query executed successfully.';
    // }

    // @Get('test-sql-engine-update')
    // async testExecutorUpdate(): Promise<string> {
    //     try {
    //         // await this.sqlEngine.executeDDL(`drop table if exists test`);

    //         // await this.testExecutor();

    //         // await this.sqlEngine.executeDML(
    //         //     `insert into test (id, name) values (1, 'Johnny Doe');`,
    //         // );
    //         // await this.sqlEngine.executeDML(
    //         //     `insert into test (id, name) values (1, 'Johnny Doe');`,
    //         // );
    //         // await this.sqlEngine.executeDML(
    //         //     `insert into test (id, name) values (2, 'Johnny Doe');`,
    //         // );
    //         // await this.sqlEngine.executeDML(
    //         //     `insert into test (id, name) values (2, 'Johnny Doe');`,
    //         // );

    //         const sqlQuery = `update test set name = 'John Doe_2' where id = 1;`;
    //         await this.sqlEngine.executeDML(sqlQuery);
    //     } catch (error: any) {
    //         return `Error executing DML query: ${error.message}`;
    //     }

    //     return 'DML query executed successfully.';
    // }

    // @Get('test-sql-engine-delete')
    // async testExecutorDelete(): Promise<string> {
    //     try {
    //         const sqlQuery = `delete from test where id = 3;`;
    //         await this.sqlEngine.executeDML(sqlQuery);
    //     } catch (error: any) {
    //         return `Error executing DML query: ${error.message}`;
    //     }

    //     return 'DML query executed successfully.';
    // }
}
