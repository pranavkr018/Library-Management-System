import AppError from "./AppError.js";

class BusinessRuleError extends AppError{
    constructor(message){
        super(message, 422);
    }
}

export default BusinessRuleError;