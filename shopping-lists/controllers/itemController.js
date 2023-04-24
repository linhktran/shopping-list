import * as itemService from "../services/itemService.js";
import * as requestUtils from "../utils/requestUtils.js";

const responseDetails = {
  headers: { "Content-Type": "text/html;charset=UTF-8" },
};

const addItem = async (request) => {
  const formData = await request.formData();
  const name = formData.get("name");
  const url = new URL(request.url);
  const urlParts = url.pathname.split("/");

  await itemService.addItem(urlParts[2], name);

  return requestUtils.redirectTo(`/lists/${urlParts[2]}`);
};

const collectItem = async (request) => {
  const url = new URL(request.url);
  const urlParts = url.pathname.split("/");
  await itemService.collectById(urlParts[2], urlParts[4]);

  return requestUtils.redirectTo(`/lists/${urlParts[2]}`);
};

export { addItem, collectItem };