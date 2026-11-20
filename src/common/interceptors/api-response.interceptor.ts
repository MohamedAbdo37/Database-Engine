import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

export interface StandardResponse<T> {
    success: true;
    statusCode: number;
    data: T;
    message?: string;
    timestamp: string;
}

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
    T,
    StandardResponse<T>
> {
    intercept(
        context: ExecutionContext,
        next: CallHandler<any>,
    ): Observable<StandardResponse<T>> | Promise<Observable<any>> {
        const res = context.switchToHttp().getResponse();
        const statusCode = res.statusCode;

        return next.handle().pipe(
            map((data) => {
                if (
                    data &&
                    typeof data === 'object' &&
                    'data' in data &&
                    'message' in data &&
                    Object.keys(data).length === 2
                ) {
                    return {
                        success: true,
                        data: data.data,
                        message: data.message,
                        statusCode: statusCode,
                        timestamp: new Date().toISOString(),
                    };
                }
                const response: StandardResponse<any> = {
                    success: true,
                    statusCode: statusCode,
                    data: data,
                    timestamp: new Date().toISOString(),
                };
                return response;
            }),
        );
    }
}
