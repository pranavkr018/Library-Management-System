import fs from "fs/promises";

async function readJSON(filePath){
    const fileContent = await fs.readFile(filePath, "utf-8")
    return JSON.parse(fileContent);      // array of objects
}


async function writeJSON(filePath, fileContent){
    const jsonData = JSON.stringify(fileContent, null, 2);
    await fs.writeFile(filePath, jsonData, "utf-8");
}


export { readJSON, writeJSON};