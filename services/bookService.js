import pool from "../utils/db.js";

import ValidationError from "../errors/ValidationError.js";
import NotFoundError from "../errors/NotFoundError.js";
import ConflictError from "../errors/ConflictError.js";
import BusinessRuleError from "../errors/BusinessRuleError.js";


//----------------------------------------------------------------
//HELPER FUNCTIONS

function validateId(id){
    if(!Number.isInteger(id) || id <= 0)
        throw new ValidationError("Book ID must be a positive integer.");
}

function sanitizeBookData(book){
    return {
        ...book,
        title: book.title.trim(),
        author: book.author.trim(),
        category: book.category.trim()
    };
}

function validateBookData(book){
    if("id" in book || "availableCopies" in book)
        throw new ValidationError("Book Id and Available Copies cannot be created or modified.");

    const allowedFields = ["title", "author", "category", "totalCopies"];

    Object.keys(book).forEach(field => {
        if(!allowedFields.includes(field)){
            throw new ValidationError(`Field ${field} is unavailable to create or modify.`);
        }

        if(field === "totalCopies"){
            if(!Number.isInteger(book[field]) || book[field] < 0)
                throw new ValidationError("Total copies must be a non-negative integer.");
        }
        else if(typeof book[field] !== "string" || book[field].trim().length === 0){
            throw new ValidationError(`Field ${field} contains inappropriate or missing data.`);
        }
    });

    if(Object.keys(book).length === 0)
        throw new ValidationError("No valid fields to create or modify.");
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

//Get Books
async function getBooks(filters){
    const page = filters.page;
    const limit = filters.limit;

    validatePageAndLimit(page, limit);

    const conditions = [];
    const values = [];

    if(filters.title){
        conditions.push(`title ILIKE $${values.length + 1}`);
        values.push(`%${filters.title}%`);
    }

    if(filters.author){
        conditions.push(`author ILIKE $${values.length + 1}`);
        values.push(`%${filters.author}%`);
    }

    if(filters.category){
        conditions.push(`category ILIKE $${values.length + 1}`);
        values.push(`%${filters.category}%`);
    }

    const sortColumns = {
        title: "title",
        author: "author",
        category: "category",
        totalCopies: "total_copies",
        availableCopies: "available_copies"
    };

    const sortBy = filters.sortBy ?? "title";
    const order = filters.order ?? "asc";

    const sortColumn = sortColumns[sortBy] ?? sortColumns.title;
    const sortOrder = order === "desc" ? "DESC" : "ASC";

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM books ${whereClause}`, 
        values
    );

    const total = Number(countResult.rows[0].count);

    const totalPages = Math.ceil(total / limit);

    const offset = (page - 1) * limit;

    const dataResults = await pool.query(
        `SELECT id, title, author, category, total_copies AS "totalCopies", available_copies AS "availableCopies" 
        FROM books ${whereClause} 
        ORDER BY ${sortColumn} ${sortOrder}, id ASC 
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, 

        [...values, limit, offset]
    );

    return {
        data: dataResults.rows,
        pagination: {
            page,
            limit,
            total,
            totalPages
        }
    };
}

//Find Book by Id
async function findBookById(id){
    validateId(id);

    const bookResult = await pool.query(
        `SELECT id, title, author, category, total_copies AS "totalCopies", available_copies AS "availableCopies" 
        FROM books WHERE id = $1`, 
        [id]
    );

    if(bookResult.rows.length === 0){
        throw new NotFoundError("Book not found.");
    }

    return {
        data: bookResult.rows[0]
    };
}

//Create a Book
async function createBook(book){
    if("id" in book || "availableCopies" in book)
        throw new ValidationError("Book id and Available copies cannot be created.")

    validateBookData(book);

    const sanitizedBook = sanitizeBookData(book);

    const bookData = [
        sanitizedBook.title, 
        sanitizedBook.author, 
        sanitizedBook.category, 
        sanitizedBook.totalCopies
    ];

    try{
        const newBookResult = await pool.query(
            `INSERT INTO books (title, author, category, total_copies, available_copies) 
            VALUES ($1, $2, $3, $4, $4) 
            RETURNING id, title, author, category, total_copies AS "totalCopies", available_copies AS "availableCopies"`, 

            bookData
        );
    
        return newBookResult.rows[0];
    }
    catch(error){
        if(error.code === "23505" && error.constraint === "unique_book"){
            throw new ConflictError("Book already exists. Modify the existing book instead.")
        }

        throw error;
    }
}

//Update Book
async function updateBook(id, data){
    validateId(id);

    const client = await pool.connect();

    try{
        await client.query("BEGIN");

        const bookResult = await client.query(
            `SELECT 
            title, author, category, total_copies as "totalCopies", available_copies as "availableCopies" 
            FROM books WHERE id = $1 
            FOR UPDATE`, 
            [id]
        );

        if(bookResult.rows.length === 0){
            throw new NotFoundError("Book not found.");
        }

        validateBookData(data);

        const sanitizedData = sanitizeBookData(data);

        const updateData = {
            ...bookResult.rows[0],
            ...sanitizedData
        }
        
        const borrowedCopies = bookResult.rows[0].totalCopies - bookResult.rows[0].availableCopies;

        if("totalCopies" in data && updateData.totalCopies < borrowedCopies){
            throw new BusinessRuleError("Total copies cannot be less than borrowed copies.");
        }

        const newAvailableCopies = updateData.totalCopies - borrowedCopies;

        const updatedBook = await client.query(
            `UPDATE books SET title = $1, author = $2, category = $3, total_copies = $4, available_copies = $5 
            WHERE id = $6 
            RETURNING id, title, author, category, total_copies AS "totalCopies", available_copies AS "availableCopies"`, 

            [updateData.title, updateData.author, updateData.category, updateData.totalCopies, newAvailableCopies, id]
        );

        await client.query("COMMIT");

        return updatedBook.rows[0];
    }
    catch(error){
        await client.query("ROLLBACK");

        if(error.code === "23505" && error.constraint === "unique_book"){
            throw new ConflictError("Book already exists.")
        }

        throw error;
    }
    finally{
        client.release();
    }
}


//Delete a Book
async function deleteBook(id){
    validateId(id);

    const client = await pool.connect();

    try{
        await client.query("BEGIN");

        const bookCheck = await client.query(
            `SELECT 1 FROM books WHERE id = $1 FOR UPDATE`, 
            [id]
        );

        if(bookCheck.rows.length === 0){
            throw new NotFoundError("Book not found.");
        }

        const borrowingHistoryCheck = await client.query(
            `SELECT EXISTS (SELECT 1 FROM borrowings WHERE book_id = $1)`, 
            [id]
        );

        if(borrowingHistoryCheck.rows[0].exists){
            throw new ConflictError("Book cannot be deleted because it was borrowed at least once");
        }

        const deletedBook = await client.query(
            `DELETE FROM books WHERE id = $1 
            RETURNING id, title, author, category, total_copies AS "totalCopies", available_copies AS "availableCopies"`, 
            [id]
        );

        await client.query("COMMIT");

        return deletedBook.rows[0];
    }
    catch(error){
        await client.query("ROLLBACK");

        throw error;
    }
    finally{
        client.release();
    }
}



export {getBooks, findBookById, createBook, updateBook, deleteBook};