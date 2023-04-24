// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
/**
 * Test whether or not the given path exists by checking with the file system
 */ export async function exists(filePath) {
    try {
        await Deno.lstat(filePath);
        return true;
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return false;
        }
        throw err;
    }
}
/**
 * Test whether or not the given path exists by checking with the file system
 */ export function existsSync(filePath) {
    try {
        Deno.lstatSync(filePath);
        return true;
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return false;
        }
        throw err;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjk3LjAvZnMvZXhpc3RzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjEgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vKipcbiAqIFRlc3Qgd2hldGhlciBvciBub3QgdGhlIGdpdmVuIHBhdGggZXhpc3RzIGJ5IGNoZWNraW5nIHdpdGggdGhlIGZpbGUgc3lzdGVtXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleGlzdHMoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICB0cnkge1xuICAgIGF3YWl0IERlbm8ubHN0YXQoZmlsZVBhdGgpO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoZXJyIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuTm90Rm91bmQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0aHJvdyBlcnI7XG4gIH1cbn1cblxuLyoqXG4gKiBUZXN0IHdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiBwYXRoIGV4aXN0cyBieSBjaGVja2luZyB3aXRoIHRoZSBmaWxlIHN5c3RlbVxuICovXG5leHBvcnQgZnVuY3Rpb24gZXhpc3RzU3luYyhmaWxlUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHRyeSB7XG4gICAgRGVuby5sc3RhdFN5bmMoZmlsZVBhdGgpO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoZXJyIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuTm90Rm91bmQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdGhyb3cgZXJyO1xuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFOztDQUVDLEdBQ0QsT0FBTyxlQUFlLE9BQU8sUUFBZ0IsRUFBb0I7SUFDL0QsSUFBSTtRQUNGLE1BQU0sS0FBSyxLQUFLLENBQUM7UUFDakIsT0FBTyxJQUFJO0lBQ2IsRUFBRSxPQUFPLEtBQUs7UUFDWixJQUFJLGVBQWUsS0FBSyxNQUFNLENBQUMsUUFBUSxFQUFFO1lBQ3ZDLE9BQU8sS0FBSztRQUNkLENBQUM7UUFFRCxNQUFNLElBQUk7SUFDWjtBQUNGLENBQUM7QUFFRDs7Q0FFQyxHQUNELE9BQU8sU0FBUyxXQUFXLFFBQWdCLEVBQVc7SUFDcEQsSUFBSTtRQUNGLEtBQUssU0FBUyxDQUFDO1FBQ2YsT0FBTyxJQUFJO0lBQ2IsRUFBRSxPQUFPLEtBQUs7UUFDWixJQUFJLGVBQWUsS0FBSyxNQUFNLENBQUMsUUFBUSxFQUFFO1lBQ3ZDLE9BQU8sS0FBSztRQUNkLENBQUM7UUFDRCxNQUFNLElBQUk7SUFDWjtBQUNGLENBQUMifQ==