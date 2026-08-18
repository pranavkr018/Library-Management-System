import AppError from "./AppError.js";

class ConflictError extends AppError{
    constructor(message){
        super(message, 409);
    }
}

export default ConflictError;