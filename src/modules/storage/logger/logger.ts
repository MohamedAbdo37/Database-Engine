import { Injectable } from '@nestjs/common';
import { FileManager } from '../file-manager/file-manager.js';

@Injectable()
export class Logger {
    constructor(private readonly fileManager: FileManager) {}
    public async logSuccessDDL(query: string): Promise<void> {
        query = query.replace(/\s+/g, ' ').trim();
        const logMessage = `[${new Date().toISOString()}] | DDL | type: SUCCESS | query: ${query}`;
        await this.fileManager.appendToLogFile(logMessage);
    }

    public async logErrorDDL(query: string, error: Error): Promise<void> {
        query = query.replace(/\s+/g, ' ').trim();
        const logMessage = `[${new Date().toISOString()}] | DDL | type: ERROR | query: ${query} | error: ${error.message}`;
        await this.fileManager.appendToLogFile(logMessage);
    }

    public async logSuccessDML(query: string): Promise<void> {
        query = query.replace(/\s+/g, ' ').trim();
        const logMessage = `[${new Date().toISOString()}] | DML | type: SUCCESS | query: ${query}`;
        await this.fileManager.appendToLogFile(logMessage);
    }

    public async logErrorDML(query: string, error: Error): Promise<void> {
        query = query.replace(/\s+/g, ' ').trim();
        const logMessage = `[${new Date().toISOString()}] | DML | type: ERROR | query: ${query} | error: ${error.message}`;
        await this.fileManager.appendToLogFile(logMessage);
    }
}
