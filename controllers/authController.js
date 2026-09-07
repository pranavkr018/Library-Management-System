import * as authService from "../services/authService.js";


async function register(req, res){
    const user = await authService.registerUser(req.body);
    res.status(201).json(user);
}

async function login(req, res){
    const user = await authService.loginUser(req.body);
    res.status(200).json(user);
}


export {register, login};