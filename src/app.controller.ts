import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
} from '@nestjs/common';
import { AppService } from './app.service.js';
import { SqlEngineService } from './modules/sql-engine/sql-engine.service.js';

@Controller()
export class AppController {
    constructor(
        private readonly appService: AppService,
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
}
