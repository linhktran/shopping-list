import { sql } from "../database/database.js";

const listNumber = async () => {
    const rows = await sql`SELECT COUNT(*) AS count FROM shopping_lists`;
    return rows[0].count;
};

const itemNumber = async () => {
    const rows = await sql`SELECT COUNT(*) AS count FROM shopping_list_items`;
    return rows[0].count;
};

export { listNumber, itemNumber };