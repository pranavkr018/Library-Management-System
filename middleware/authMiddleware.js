import jwt from "jsonwebtoken";
import AuthenticationError from "../errors/AuthenticationError.js";

function authMiddleware(req, res, next){
    const authHeader = req.headers.authorization;

    if(!authHeader || !authHeader.startsWith("Bearer "))
        throw new AuthenticationError("Authentication required.");

    const token = authHeader.split(" ")[1];

    try{
        const decoded = jwt.verify(     // to prevent jwt to throw it's own error, we wrap it in a try-catch to wrap our error handling.
            token,
            process.env.JWT_SECRET_KEY
        );
    
        req.user = decoded;
        next();

    }catch(err){
        throw new AuthenticationError("Invalid or expired token.");
    }
}


export default authMiddleware;