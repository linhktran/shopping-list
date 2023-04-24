import { renderFile } from "https://deno.land/x/eta@v2.0.0/mod.ts";
import * as mainService from "../services/mainService.js";

const responseDetails = {
    headers: { "Content-Type": "text/html;charset=UTF-8" },
};

const viewStats = async (request) => {
    const data = {
        lists: await mainService.listNumber(),
        items: await mainService.itemNumber(),
    };

    return new Response(await renderFile("main.eta", data), responseDetails);
};

export { viewStats }