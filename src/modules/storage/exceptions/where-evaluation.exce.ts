export class WhereEvaluationException extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WhereEvaluationException';
    }
}
