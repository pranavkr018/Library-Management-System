import * as bookService from "../services/bookService.js";
// import * as borrowingService from "../services/borrowingService.js";


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

// async function borrowBook(req, res){
//     const bookId = Number(req.params.id);
//     const userId = req.user.id;

//     const borrowedRecord = await borrowingService.borrowBook(bookId, userId);

//     res.status(201).json(borrowedRecord);
// }

// async function returnBook(req, res){
//     const bookId = Number(req.params.id);
//     const userId = req.user.id;

//     const returnedRecord = await borrowingService.returnBook(bookId, userId);

//     res.status(200).json(returnedRecord);
// }

// async function getBorrowings(req, res){
//     const userId = req.user.id;
//     const role = req.user.role;
//     const filters = {
//         ...req.query,
//         borrowerId: role === "user" ? userId : Number(req.query.borrowerId),
//         sortBy: req.query.sortBy ?? "borrowedAt",
//         order: req.query.order ?? "asc",
//         page: Number(req.query.page ?? 1),
//         limit: Number(req.query.limit ?? 10)
//     };

//     const borrowingHistory = await borrowingService.getBorrowings(userId, role, filters);

//     res.status(200).json(borrowingHistory);
// }



export {getBooks, getBookById, createBook, updateBook, deleteBook};