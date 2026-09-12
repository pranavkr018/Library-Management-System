import * as authService from "../services/authService.js";


async function register(req, res){
    const user = await authService.registerUser(req.body);
    res.status(201).json(user);
}

async function login(req, res){
    const result = await authService.loginUser(req.body);
    res.status(200).json(result);
}


export {register, login};