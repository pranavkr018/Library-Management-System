import AuthorizationError from "../errors/AuthorizationError.js";

function authorize(requiredRole){
    return function(req, res, next){
        if(req.user.role !== requiredRole)
            throw new AuthorizationError("You are not authorized to perform this action.");

        next();
    };
}















export default authorize;