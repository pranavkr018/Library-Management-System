import path from "path"
import { readJSON, writeJSON } from "../utils/fileHelper.js";

const BOOK_FILE_PATH = path.resolve("data", "books.json");

//Get All Books
async function getAllBooks(){
    return readJSON(BOOK_FILE_PATH);
}

//----------------------------------------------------------------
//Helper Functions
function validateBook(book){
    if(typeof book.title !== "string" || book.title.trim().length === 0)
        throw new Error("Title is required.");
    
    if(typeof book.author !== "string" || book.author.trim().length === 0)
        throw new Error("Author is required.");
    
    if(typeof book.category !== "string" || book.category.trim().length === 0)
        throw new Error("Category is required.");
    
    if(!Number.isInteger(book.totalCopies) || book.totalCopies <= 0)
        throw new Error("Total copies must be a positive integer.");
}

function normalize(text){
    return text.trim().toLowerCase();
}

function sanitizeBook(book){
    return {
        ...book,
        title: book.title.trim(),
        author: book.author.trim(),
        category: book.category.trim()
    };
}

function findDuplicateBook(books, book, currId){
    return books.find(b => b.id !== currId && normalize(b.title) === normalize(book.title) && normalize(b.author) === normalize(book.author) && normalize(b.category) === normalize(book.category));
}

function generateId(books){
    if(books.length === 0) return 1;
    return Math.max(...books.map(book => book.id)) + 1;
}

function validateId(id){
    if(!Number.isInteger(id) || id <= 0)
        throw new Error("Book ID must be a positive integer.");
}

function validateUpdateData(updatedData){
    if("id" in updatedData)
        throw new Error("Book ID cannot be modified.");

    if("availableCopies" in updatedData)
        throw new Error("Available copies cannot be modified directly.");
}
//----------------------------------------------------------------

//Add a Book
async function addBook(book){
    validateBook(book);

    const books = await getAllBooks();

    const existingBook = findDuplicateBook(books, book);

    if(existingBook){
        existingBook.totalCopies += book.totalCopies;
        existingBook.availableCopies += book.totalCopies;

        await writeJSON(BOOK_FILE_PATH, books);

        return existingBook;
    }

    const newBook = sanitizeBook({
        id: generateId(books),
        ...book,
        availableCopies: book.totalCopies
    });

    books.push(newBook);

    await writeJSON(BOOK_FILE_PATH, books);

    return newBook;
}

//Find Book by Id
async function findBookById(id){
    validateId(id);

    const books = await getAllBooks();

    return books.find(b =>  b.id === id) ?? null;

}

//Update Book
async function updateBook(id, updatedData){
    validateId(id);
    validateUpdateData(updatedData);

    const books = await getAllBooks();

    const targetBook = books.find(b => b.id === id);

    if(!targetBook)
        return null;

    const updatedBook = sanitizeBook({
        ...targetBook, 
        ...updatedData
    });

    validateBook(updatedBook)

    const borrowedCopies = targetBook.totalCopies - targetBook.availableCopies;

    if(updatedBook.totalCopies < borrowedCopies)
        throw new Error("Total copies cannot be less than borrowed copies.");

    const duplicate = findDuplicateBook(books, updatedBook, id);

    if(duplicate)
        throw new Error("Updating this book would create a duplicate.");

    updatedBook.availableCopies = updatedBook.totalCopies - borrowedCopies;

    Object.assign(targetBook, updatedBook);
    
    await writeJSON(BOOK_FILE_PATH, books);

    return targetBook;
}


//Delete a Book
async function deleteBook(id){
    validateId(id);

    const books = await getAllBooks();

    const targetBook = books.find(b => b.id === id);

    if(!targetBook) 
        return null;

    if(targetBook.availableCopies !== targetBook.totalCopies)
        throw new Error("Book cannot be deleted because some copies are currently borrowed.");

    const updatedBooks = books.filter(b => b.id !== id);

    await writeJSON(BOOK_FILE_PATH, updatedBooks);

    return targetBook;
}

export {getAllBooks, findBookById, addBook, updateBook, deleteBook};