import express from "express";
import * as bookService from "./services/bookService.js";
import bookRoutes from "./routes/bookRoutes.js";
import errorHandler from "./middlewares/errorHandler.js";

const app = express();

app.use(express.json());


// app.get("/books", async (req, res) => {
//     try{
//         const books = await bookService.getAllBooks();
//         res.status(200).json(allBooks);
//     }catch(err){
//         res.status(500).json({error: err.message});
//     }
// });

// app.post("/books", async (req, res) => {
//     try{
//         const newBook = await bookService.addBook(req.body);
//         res.status(201).json(newBook);
//     }catch(err){
//         res.status(400).json({error: err.message});
//     }
// });


app.use("/books", bookRoutes)


app.use(errorHandler)



app.listen(3000, () => {
    console.log("Server started at http://localhost:3000");
});