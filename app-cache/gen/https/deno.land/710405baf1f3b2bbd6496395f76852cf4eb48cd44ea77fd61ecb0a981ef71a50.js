import { copyProps } from "./utils.ts";
/**
 * Handles storage and accessing of values
 *
 * In this case, we use it to store compiled template functions
 * Indexed by their `name` or `filename`
 */ class Cacher {
    constructor(cache){
        this.cache = cache;
    }
    define(key, val) {
        this.cache[key] = val;
    }
    get(key) {
        // string | array.
        // TODO: allow array of keys to look down
        // TODO: create plugin to allow referencing helpers, filters with dot notation
        return this.cache[key];
    }
    remove(key) {
        delete this.cache[key];
    }
    reset() {
        this.cache = {};
    }
    load(cacheObj) {
        copyProps(this.cache, cacheObj);
    }
    cache;
}
export { Cacher };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvZXRhQHYyLjAuMC9zdG9yYWdlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNvcHlQcm9wcyB9IGZyb20gXCIuL3V0aWxzLnRzXCI7XG5cbi8qKlxuICogSGFuZGxlcyBzdG9yYWdlIGFuZCBhY2Nlc3Npbmcgb2YgdmFsdWVzXG4gKlxuICogSW4gdGhpcyBjYXNlLCB3ZSB1c2UgaXQgdG8gc3RvcmUgY29tcGlsZWQgdGVtcGxhdGUgZnVuY3Rpb25zXG4gKiBJbmRleGVkIGJ5IHRoZWlyIGBuYW1lYCBvciBgZmlsZW5hbWVgXG4gKi9cbmNsYXNzIENhY2hlcjxUPiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY2FjaGU6IFJlY29yZDxzdHJpbmcsIFQ+KSB7fVxuICBkZWZpbmUoa2V5OiBzdHJpbmcsIHZhbDogVCk6IHZvaWQge1xuICAgIHRoaXMuY2FjaGVba2V5XSA9IHZhbDtcbiAgfVxuICBnZXQoa2V5OiBzdHJpbmcpOiBUIHtcbiAgICAvLyBzdHJpbmcgfCBhcnJheS5cbiAgICAvLyBUT0RPOiBhbGxvdyBhcnJheSBvZiBrZXlzIHRvIGxvb2sgZG93blxuICAgIC8vIFRPRE86IGNyZWF0ZSBwbHVnaW4gdG8gYWxsb3cgcmVmZXJlbmNpbmcgaGVscGVycywgZmlsdGVycyB3aXRoIGRvdCBub3RhdGlvblxuICAgIHJldHVybiB0aGlzLmNhY2hlW2tleV07XG4gIH1cbiAgcmVtb3ZlKGtleTogc3RyaW5nKTogdm9pZCB7XG4gICAgZGVsZXRlIHRoaXMuY2FjaGVba2V5XTtcbiAgfVxuICByZXNldCgpOiB2b2lkIHtcbiAgICB0aGlzLmNhY2hlID0ge307XG4gIH1cbiAgbG9hZChjYWNoZU9iajogUmVjb3JkPHN0cmluZywgVD4pOiB2b2lkIHtcbiAgICBjb3B5UHJvcHModGhpcy5jYWNoZSwgY2FjaGVPYmopO1xuICB9XG59XG5cbmV4cG9ydCB7IENhY2hlciB9O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsU0FBUyxRQUFRLGFBQWE7QUFFdkM7Ozs7O0NBS0MsR0FDRCxNQUFNO0lBQ0osWUFBb0IsTUFBMEI7cUJBQTFCO0lBQTJCO0lBQy9DLE9BQU8sR0FBVyxFQUFFLEdBQU0sRUFBUTtRQUNoQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRztJQUNwQjtJQUNBLElBQUksR0FBVyxFQUFLO1FBQ2xCLGtCQUFrQjtRQUNsQix5Q0FBeUM7UUFDekMsOEVBQThFO1FBQzlFLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJO0lBQ3hCO0lBQ0EsT0FBTyxHQUFXLEVBQVE7UUFDeEIsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUk7SUFDeEI7SUFDQSxRQUFjO1FBQ1osSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDO0lBQ2hCO0lBQ0EsS0FBSyxRQUEyQixFQUFRO1FBQ3RDLFVBQVUsSUFBSSxDQUFDLEtBQUssRUFBRTtJQUN4QjtJQWxCb0I7QUFtQnRCO0FBRUEsU0FBUyxNQUFNLEdBQUcifQ==