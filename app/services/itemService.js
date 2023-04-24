import { sql } from "../database/database.js";

const addItem = async (listId, name) => {
  await sql`INSERT INTO shopping_list_items (shopping_list_id, name) VALUES (${listId}, ${name})`;
};

const collectById = async (listId, itemId) => {
  await sql`UPDATE shopping_list_items SET collected = true WHERE id = ${ itemId } AND shopping_list_id = ${ listId }`;
};

const findAllItems = async (listId) => {
  return await sql`SELECT * FROM shopping_list_items WHERE shopping_list_id = ${ listId } ORDER BY collected, name`;
};

export { addItem, collectById, findAllItems };