import { mkdir, readFile, writeFile } from 'fs/promises';
import { IOException } from '../exceptions/io-exception.js';
import { Catalog, CatalogIndex, DBObjects } from '../dto/catalog.dto.js';
import {
    closeSync,
    existsSync,
    fstatSync,
    openSync,
    readSync,
    writeSync,
} from 'fs';
import { DirectoryPage, Page, PAGE_SIZE, TablePage } from '../dto/page.dto.js';
import { PageType } from '../dto/page-type.dto.js';
import { Injectable } from '@nestjs/common';

const DATA_FOLDER = './src/data';

@Injectable()
export class FileManager {
    private fileDescriptor: number | null = null;

    private async saveObjectToFile(
        path: string,
        obj: DBObjects,
    ): Promise<void> {
        const bytes = obj.serialize();
        await writeFile(path, bytes).catch((error: IOException) => {
            throw new IOException(
                `Failed to write object to file ${path}: ${error instanceof Error ? error.message : String(error)}`,
            );
        });
    }

    private async createFolder(folderPath: string): Promise<void> {
        try {
            await mkdir(folderPath, { recursive: true });
            console.log(`Folder ${folderPath} created successfully.`);
        } catch (error) {
            throw new IOException(
                `Failed to create folder ${folderPath}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    public async initializeDataFolder(): Promise<void> {
        await this.createFolder(DATA_FOLDER);
        await Promise.all([
            this.createFolder(`${DATA_FOLDER}/catalog`),
            this.createFolder(`${DATA_FOLDER}/table`),
            this.createFolder(`${DATA_FOLDER}/index`),
        ]);
    }

    public isFileOpen(): boolean {
        return this.fileDescriptor !== null;
    }

    public async createTableDateFile(tableName: string): Promise<void> {
        const dataFilePath = `./src/data/table/${tableName}.dat`;
        if (!existsSync(dataFilePath)) {
            await writeFile(dataFilePath, Buffer.alloc(0)).catch(
                (error: IOException) => {
                    throw new IOException(
                        `Failed to create data file ${dataFilePath}: ${error instanceof Error ? error.message : String(error)}`,
                    );
                },
            );
        }
    }

    public async createIndexFile(
        tableName: string,
        index: CatalogIndex,
    ): Promise<void> {
        // TODO: Implement index file creation logic based on the schema
        // For now, just create an empty index file for the table
        const indexFilePath = `./src/data/index/${tableName}/${index.name}.idx`;
        if (!existsSync(indexFilePath)) {
            await writeFile(indexFilePath, Buffer.alloc(0)).catch(
                (error: IOException) => {
                    throw new IOException(
                        `Failed to create index file ${indexFilePath}: ${error instanceof Error ? error.message : String(error)}`,
                    );
                },
            );
        }
    }

    public async writeCatalogSchemaFile(schema: Catalog): Promise<void> {
        const catalogFilePath = `./src/data/catalog/${schema.tableName}.dat`;
        await this.saveObjectToFile(catalogFilePath, schema);
    }

    public async readCatalogSchema(tableName: string): Promise<Catalog> {
        const filePath = `./src/data/catalog/${tableName}.dat`;
        const bytes = await readFile(filePath).catch((error: IOException) => {
            throw new IOException(
                `Failed to read catalog schema file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
            );
        });
        return Catalog.deserialize(bytes);
    }

    public async openTableFile(tableName: string): Promise<void> {
        const filePath = `./src/data/table/${tableName}.dat`;
        if (!existsSync(filePath)) {
            await writeFile(filePath, Buffer.alloc(0));
        }

        this.fileDescriptor = openSync(filePath, 'r+');
    }

    public async closeTableFile(): Promise<void> {
        if (this.fileDescriptor !== null) {
            closeSync(this.fileDescriptor);
            this.fileDescriptor = null;
        }
    }

    public async writePage(page: Page): Promise<void> {
        if (this.fileDescriptor === null)
            throw new IOException('File is not open for writing.');
        const buffer = page.serialize();

        const offset = page.getPageId() * PAGE_SIZE;
        writeSync(this.fileDescriptor, buffer, 0, PAGE_SIZE, offset);
    }

    public async readPage(pageId: number, type: PageType): Promise<Page> {
        if (this.fileDescriptor === null)
            throw new IOException('File is not open for reading.');

        const offset = pageId * PAGE_SIZE;
        const stat = fstatSync(this.fileDescriptor);
        if (offset > stat.size) {
            throw new IOException(
                `Page with ID ${pageId} does not exist in the file.`,
            );
        }
        const buffer = Buffer.alloc(PAGE_SIZE);

        readSync(this.fileDescriptor, buffer, 0, PAGE_SIZE, offset);

        switch (type) {
            case PageType.DIRECTORY:
                return new DirectoryPage('').deserialize(buffer);
            case PageType.TABLE:
                return new TablePage(pageId).deserialize(buffer);
            default:
                throw new IOException(`Unknown page type: ${type}`);
        }
    }
}
