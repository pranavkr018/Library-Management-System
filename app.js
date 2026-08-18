import express from "express";
import bookRoutes from "./routes/bookRoutes.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

app.use(express.json());

app.use("/books", bookRoutes);

app.use(errorHandler);


app.listen(3000, () => {
    console.log("Server started at http://localhost:3000");
});