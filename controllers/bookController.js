import * as bookService from "../services/bookService.js";


async function getAllBooks(req, res){
    const filters = {...req.query,
        sortBy: req.query.sortBy ?? "title",
        order: req.query.order ?? "asc",
        page: Number(req.query.page ?? 1),
        limit: Number(req.query.limit ?? 10)
    };
    const books = await bookService.getAllBooks(filters);
    res.status(200).json(books);
}

async function getBookById(req, res) {
    const id = Number(req.params.id);
    const targetBook = await bookService.findBookById(id);
    res.status(200).json(targetBook);
}

async function createBook(req, res){
    const newBook = await bookService.addBook(req.body);
    res.status(201).json(newBook);
}

async function updateBook(req, res) {
    const id = Number(req.params.id);
    const updatedBook = await bookService.updateBook(id, req.body);
    res.status(200).json(updatedBook);
}

async function deleteBook(req, res) {
    const id = Number(req.params.id);
    const deletedBook = await bookService.deleteBook(id);
    res.status(200).json(deletedBook);
}

async function borrowBook(req, res){
    const id = Number(req.params.id);
    const borrowedBook = await bookService.borrowBook(id);
    res.status(200).json(borrowedBook);
}

async function returnBook(req, res){
    const id = Number(req.params.id);
    const returnedBook = await bookService.returnBook(id);
    res.status(200).json(returnedBook);
}



export {getAllBooks, getBookById, createBook, updateBook, deleteBook, borrowBook, returnBook};