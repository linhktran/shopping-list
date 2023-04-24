import { postgres } from "../deps.js";

// PostgreSQL needs to stop before this external access could work
let sql;
if (Deno.env.get("DATABASE_URL")) {
  sql = postgres(Deno.env.get("DATABASE_URL"));
} else {
  sql = postgres({});
}

export { sql };