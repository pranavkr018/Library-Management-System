import "dotenv/config";
import express from "express";
import authRoutes from "./routes/authRoutes.js";
import bookRoutes from "./routes/bookRoutes.js";
import errorHandler from "./middleware/errorHandler.js";

import authMiddleware from "./middleware/authMiddleware.js";


const app = express();

app.use(express.json());


app.use("/auth", authRoutes);

app.use("/books", bookRoutes);

app.use(errorHandler);


app.listen(3000, () => {
    console.log("Server started at http://localhost:3000");
});