import path from "path"
import { readJSON, writeJSON } from "../utils/fileHelper.js";
import ValidationError from "../errors/ValidationError.js";
import NotFoundError from "../errors/NotFoundError.js";
import ConflictError from "../errors/ConflictError.js";
import BusinessRuleError from "../errors/BusinessRuleError.js";

const BOOK_FILE_PATH = path.resolve("data", "books.json");


//----------------------------------------------------------------
//HELPER FUNCTIONS

function generateId(books){
    if(books.length === 0) return 1;
    return Math.max(...books.map(book => book.id)) + 1;
}

function validateId(id){
    if(!Number.isInteger(id) || id <= 0)
        throw new ValidationError("Book ID must be a positive integer.");
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
    return books.find(b => b.id !== currId 
        && normalize(b.title) === normalize(book.title) 
        && normalize(b.author) === normalize(book.author) 
        && normalize(b.category) === normalize(book.category)
    );
}

function validateBook(book){
    // if(book.id)
    //     throw new ValidationError("Id cannot be created by user.")

    if(typeof book.title !== "string" || book.title.trim().length === 0)
        throw new ValidationError("Title is required.");
    
    if(typeof book.author !== "string" || book.author.trim().length === 0)
        throw new ValidationError("Author is required.");
    
    if(typeof book.category !== "string" || book.category.trim().length === 0)
        throw new ValidationError("Category is required.");
    
    if(!Number.isInteger(book.totalCopies) || book.totalCopies <= 0)
        throw new ValidationError("Total copies must be a positive integer.");
}


function validateUpdateData(updatedData){
    if("id" in updatedData)
        throw new ValidationError("Book ID cannot be modified.");
    
    if("availableCopies" in updatedData)
        throw new ValidationError("Available copies cannot be modified directly.");
}

function validatePageAndLimit(page, limit){
    if(!Number.isInteger(page) || page < 1)
        throw new ValidationError("Page must be a positive integer.");

    if(!Number.isInteger(limit) || limit < 1)
        throw new ValidationError("Limit must be a positive integer.");

    if(limit > 100)
        throw new ValidationError("Limit cannot exceed 100.");
}

//----------------------------------------------------------------


//PUBLIC APIS

//Get All Books
async function getAllBooks(filters){
    const books = await readJSON(BOOK_FILE_PATH);

    const page = filters.page;
    const limit = filters.limit;

    validatePageAndLimit(page, limit);

    //filtering
    const title = filters.title?.toLowerCase();
    const author = filters.author?.toLowerCase();
    const category = filters.category?.toLowerCase();
    
    const filteredBooks = books.filter(book => {
        if(title && !book.title.toLowerCase().includes(title)) return false;
        if(author && !book.author.toLowerCase().includes(author)) return false;
        if(category && !book.category.toLowerCase().includes(category)) return false;

        return true;
    });
    
    //sorting
    const sortBy = filters.sortBy.toLowerCase();

    const validSortFields = ["title", "author", "category", "totalcopies"];

    if(!validSortFields.includes(sortBy)){
        throw new BusinessRuleError(`Cannot sort on "${filters.sortBy}". Available sortBy options: title, author, category, totalCopies.`)
    }

    const order = filters.order?.toLowerCase() ?? "asc";

    if(!["asc", "desc"].includes(order)){
        throw new BusinessRuleError(`Cannot sort in "${filters.order}" order! Available order options: asc, desc.`);
    }

    filteredBooks.sort((book1, book2) => {
        if(sortBy === "totalcopies"){
            return order === "asc" ? book1.totalCopies - book2.totalCopies : book2.totalCopies - book1.totalCopies;
        }

        return order === "asc" ? book1[sortBy].localeCompare(book2[sortBy]) : book2[sortBy].localeCompare(book1[sortBy]);
    });

    //paginating
    const offset = (page-1) * limit;

    return filteredBooks.slice(offset, offset + limit);
}

//Add a Book
async function addBook(book){
    validateBook(book);
    
    const books = await readJSON(BOOK_FILE_PATH);

    const existingBook = findDuplicateBook(books, book);

    if(existingBook){
        existingBook.totalCopies += book.totalCopies;
        existingBook.availableCopies += book.totalCopies;

        await writeJSON(BOOK_FILE_PATH, books);
        
        return existingBook;
    }
    
    const newBook = sanitizeBook({
        id: generateId(books),
        title: book.title,
        author: book.author,
        category: book.category,
        totalCopies: book.totalCopies,
        availableCopies: book.totalCopies
    });

    books.push(newBook);
    
    await writeJSON(BOOK_FILE_PATH, books);
    
    return newBook;
}

//Find Book by Id
async function findBookById(id){
    validateId(id);

    const books = await readJSON(BOOK_FILE_PATH);
    const targetBook = books.find(book => book.id === id);

    if(!targetBook){
        throw new NotFoundError("Book not found.")
    }

    return targetBook;

}

//Update Book
async function updateBook(id, updatedData){
    validateId(id);
    validateUpdateData(updatedData);

    const books = await readJSON(BOOK_FILE_PATH);
    const targetBook = books.find(book => book.id === id);    // not using findBookById() because we want the reference of the target book in books, not a copy of the target book.

    if(!targetBook)
        throw new NotFoundError("Book not found.");

    const updatedBook = sanitizeBook({
        ...targetBook, 
        ...updatedData,
    });

    validateBook(updatedBook);

    const borrowedCopies = targetBook.totalCopies - targetBook.availableCopies;

    if(updatedBook.totalCopies < borrowedCopies)
        throw new BusinessRuleError("Total copies cannot be less than borrowed copies.");

    const duplicate = findDuplicateBook(books, updatedBook, id);

    if(duplicate)
        throw new ConflictError("Updating this book would create a duplicate.");

    updatedBook.availableCopies = updatedBook.totalCopies - borrowedCopies;

    Object.assign(targetBook, updatedBook);
    
    await writeJSON(BOOK_FILE_PATH, books);

    return targetBook;
}


//Delete a Book
async function deleteBook(id){
    validateId(id);

    const books = await readJSON(BOOK_FILE_PATH);;

    const targetBook = books.find(book => book.id === id);

    if(!targetBook) 
        throw new NotFoundError("Book not found.");

    if(targetBook.availableCopies !== targetBook.totalCopies)
        throw new BusinessRuleError("Book cannot be deleted because some copies are currently borrowed.");

    const updatedBooks = books.filter(book => book.id !== id);

    await writeJSON(BOOK_FILE_PATH, updatedBooks);

    return targetBook;
}


//Borrow a book
async function borrowBook(id){
    validateId(id);

    const books = await readJSON(BOOK_FILE_PATH);

    const targetBook = books.find(book => book.id === id);

    if(!targetBook) 
        throw new NotFoundError("Book not found.");

    if(targetBook.availableCopies === 0)
        throw new BusinessRuleError("Book cannot be borrowed because no copies are currently available.");

    targetBook.availableCopies--;

    await writeJSON(BOOK_FILE_PATH, books);

    return targetBook;
}


//Return a book
async function returnBook(id){
    validateId(id);

    const books = await readJSON(BOOK_FILE_PATH);

    const targetBook = books.find(book => book.id === id);

    if(!targetBook) 
        throw new NotFoundError("Book not found.");

    if(targetBook.availableCopies === targetBook.totalCopies)
        throw new BusinessRuleError("Book cannot be returned because no copies are currently borrowed.");

    targetBook.availableCopies++;

    await writeJSON(BOOK_FILE_PATH, books);

    return targetBook;
}



export {getAllBooks, findBookById, addBook, updateBook, deleteBook, borrowBook, returnBook};