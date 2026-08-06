import express from "express";
import * as bookController from "../controllers/bookController.js";

const router = express.Router();

function asyncHandler(controller){
    return function(req, res, next){
        controller(req, res, next)
            .catch(next);
    };
}

router.get("/", async (req, res) => {
    try{
        const books = await bookService.getAllBooks();
        res.status(200).json(allBooks);
    }catch(err){
        res.status(500).json({error: err.message});
    }
});

router.post("/", async (req, res) => {
    try{
        const newBook = await bookService.addBook(req.body);
        res.status(201).json(newBook);
    }catch(err){
        res.status(400).json({error: err.message});
    }
});

export default router;