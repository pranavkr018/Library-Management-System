import * as bookService from "../services/bookService.js";


async function getAllBooks(req, res, next){
    return bookService.getAllBooks();
}