import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SqlEngineModule } from './modules/sql-engine/sql-engine.module.js';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';

@Module({
    imports: [SqlEngineModule],
    controllers: [AppController],
    providers: [
        AppService,
        {
            provide: APP_INTERCEPTOR,
            useClass: ApiResponseInterceptor,
        },
        {
            provide: APP_FILTER,
            useClass: ApiExceptionFilter,
        },
    ],
})
export class AppModule {}
