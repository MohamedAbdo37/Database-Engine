import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
} from '@nestjs/common';

export interface StandardErrorResponse {
    success: false;
    statusCode: number;
    message: string;
    timestamp: string;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();

        let statusCode = exception?.status || 500;
        let message = exception?.message || 'Internal Server Error';
        let error = 'InternalServerError';

        if (
            exception instanceof Error &&
            (exception.name === 'SyntaxErrorException' ||
                exception.name === 'SyntaxError')
        ) {
            statusCode = HttpStatus.BAD_REQUEST;
            error = exception.name;
        }

        if (exception instanceof HttpException) {
            statusCode = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
                error = exception.name;
            } else if (
                typeof exceptionResponse === 'object' &&
                exceptionResponse !== null
            ) {
                const body = exceptionResponse as Record<string, any>;

                if (Array.isArray(body.message)) {
                    message = body.message.join(', ');
                } else if (typeof body.message === 'string') {
                    message = body.message;
                } else {
                    message = exception.message || 'Internal Server Error';
                }

                error =
                    typeof body.error === 'string'
                        ? body.error
                        : exception.name || HttpStatus[statusCode] || 'Error';
            }
        } else if (exception instanceof Error) {
            error = exception.name || HttpStatus[statusCode] || 'Error';
            message = exception.message || 'Internal Server Error';
        }

        const errorResponse: StandardErrorResponse = {
            success: false,
            statusCode: statusCode,
            message: message,
            timestamp: new Date().toISOString(),
        };

        return response.status(statusCode).json(errorResponse);
    }
}
