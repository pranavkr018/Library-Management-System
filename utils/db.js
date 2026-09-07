import "dotenv/config";

import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: process.env.DB_PASSWORD,
    database: "library_management"
});


export default pool;