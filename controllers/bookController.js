import * as bookService from "../services/bookService.js";


async function getBooks(req, res){
    const filters = {...req.query,
        sortBy: req.query.sortBy ?? "title",
        order: req.query.order ?? "asc",
        page: Number(req.query.page ?? 1),
        limit: Number(req.query.limit ?? 10)
    };

    const books = await bookService.getBooks(filters);

    res.status(200).json(books);
}

async function getBookById(req, res) {
    const id = Number(req.params.id);

    const targetBook = await bookService.findBookById(id);

    res.status(200).json(targetBook);
}

async function createBook(req, res){
    const newBook = await bookService.createBook(req.body);
    
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



export {getBooks, getBookById, createBook, updateBook, deleteBook};