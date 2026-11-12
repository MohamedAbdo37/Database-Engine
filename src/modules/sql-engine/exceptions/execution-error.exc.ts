export class ExecutionErrorException extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExecutionErrorException';
    }
}
