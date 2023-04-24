// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { Buffer } from "../buffer.ts";
import { assert } from "../../testing/asserts.ts";
import { ERR_INVALID_ARG_VALUE } from "../internal/errors.ts";
export function read(fd, optOrBuffer, offsetOrCallback, length, position, callback) {
    let cb;
    let offset = 0, buffer;
    if (length == null) {
        length = 0;
    }
    if (typeof offsetOrCallback === "function") {
        cb = offsetOrCallback;
    } else if (typeof optOrBuffer === "function") {
        cb = optOrBuffer;
    } else {
        offset = offsetOrCallback;
        cb = callback;
    }
    if (!cb) throw new Error("No callback function supplied");
    if (optOrBuffer instanceof Buffer || optOrBuffer instanceof Uint8Array) {
        buffer = optOrBuffer;
    } else if (typeof optOrBuffer === "function") {
        offset = 0;
        buffer = Buffer.alloc(16384);
        length = buffer.byteLength;
        position = null;
    } else {
        const opt = optOrBuffer;
        offset = opt.offset ?? 0;
        buffer = opt.buffer ?? Buffer.alloc(16384);
        length = opt.length ?? buffer.byteLength;
        position = opt.position ?? null;
    }
    assert(offset >= 0, "offset should be greater or equal to 0");
    assert(offset + length <= buffer.byteLength, `buffer doesn't have enough data: byteLength = ${buffer.byteLength}, offset + length = ${offset + length}`);
    if (buffer.byteLength == 0) {
        throw new ERR_INVALID_ARG_VALUE("buffer", buffer, "is empty and cannot be written");
    }
    let err = null, numberOfBytesRead = null;
    if (position) {
        Deno.seekSync(fd, position, Deno.SeekMode.Current);
    }
    try {
        numberOfBytesRead = Deno.readSync(fd, buffer);
    } catch (error) {
        err = error instanceof Error ? error : new Error("[non-error thrown]");
    }
    if (err) {
        callback(err);
    } else {
        const data = Buffer.from(buffer.buffer, offset, length);
        cb(null, numberOfBytesRead, data);
    }
    return;
}
export function readSync(fd, buffer, offsetOrOpt, length, position) {
    let offset = 0;
    if (length == null) {
        length = 0;
    }
    if (buffer.byteLength == 0) {
        throw new ERR_INVALID_ARG_VALUE("buffer", buffer, "is empty and cannot be written");
    }
    if (typeof offsetOrOpt === "number") {
        offset = offsetOrOpt;
    } else {
        const opt = offsetOrOpt;
        offset = opt.offset ?? 0;
        length = opt.length ?? buffer.byteLength;
        position = opt.position ?? null;
    }
    assert(offset >= 0, "offset should be greater or equal to 0");
    assert(offset + length <= buffer.byteLength, `buffer doesn't have enough data: byteLength = ${buffer.byteLength}, offset + length = ${offset + length}`);
    if (position) {
        Deno.seekSync(fd, position, Deno.SeekMode.Current);
    }
    const numberOfBytesRead = Deno.readSync(fd, buffer);
    return numberOfBytesRead ?? 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEzMi4wL25vZGUvX2ZzL19mc19yZWFkLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vYnVmZmVyLnRzXCI7XG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiLi4vLi4vdGVzdGluZy9hc3NlcnRzLnRzXCI7XG5pbXBvcnQgeyBFUlJfSU5WQUxJRF9BUkdfVkFMVUUgfSBmcm9tIFwiLi4vaW50ZXJuYWwvZXJyb3JzLnRzXCI7XG5cbnR5cGUgcmVhZE9wdGlvbnMgPSB7XG4gIGJ1ZmZlcjogQnVmZmVyIHwgVWludDhBcnJheTtcbiAgb2Zmc2V0OiBudW1iZXI7XG4gIGxlbmd0aDogbnVtYmVyO1xuICBwb3NpdGlvbjogbnVtYmVyIHwgbnVsbDtcbn07XG5cbnR5cGUgcmVhZFN5bmNPcHRpb25zID0ge1xuICBvZmZzZXQ6IG51bWJlcjtcbiAgbGVuZ3RoOiBudW1iZXI7XG4gIHBvc2l0aW9uOiBudW1iZXIgfCBudWxsO1xufTtcblxudHlwZSBCaW5hcnlDYWxsYmFjayA9IChcbiAgZXJyOiBFcnJvciB8IG51bGwsXG4gIGJ5dGVzUmVhZDogbnVtYmVyIHwgbnVsbCxcbiAgZGF0YT86IEJ1ZmZlcixcbikgPT4gdm9pZDtcbnR5cGUgQ2FsbGJhY2sgPSBCaW5hcnlDYWxsYmFjaztcblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWQoZmQ6IG51bWJlciwgY2FsbGJhY2s6IENhbGxiYWNrKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiByZWFkKFxuICBmZDogbnVtYmVyLFxuICBvcHRpb25zOiByZWFkT3B0aW9ucyxcbiAgY2FsbGJhY2s6IENhbGxiYWNrLFxuKTogdm9pZDtcbmV4cG9ydCBmdW5jdGlvbiByZWFkKFxuICBmZDogbnVtYmVyLFxuICBidWZmZXI6IEJ1ZmZlciB8IFVpbnQ4QXJyYXksXG4gIG9mZnNldDogbnVtYmVyLFxuICBsZW5ndGg6IG51bWJlcixcbiAgcG9zaXRpb246IG51bWJlciB8IG51bGwsXG4gIGNhbGxiYWNrOiBDYWxsYmFjayxcbik6IHZvaWQ7XG5leHBvcnQgZnVuY3Rpb24gcmVhZChcbiAgZmQ6IG51bWJlcixcbiAgb3B0T3JCdWZmZXI/OiBCdWZmZXIgfCBVaW50OEFycmF5IHwgcmVhZE9wdGlvbnMgfCBDYWxsYmFjayxcbiAgb2Zmc2V0T3JDYWxsYmFjaz86IG51bWJlciB8IENhbGxiYWNrLFxuICBsZW5ndGg/OiBudW1iZXIsXG4gIHBvc2l0aW9uPzogbnVtYmVyIHwgbnVsbCxcbiAgY2FsbGJhY2s/OiBDYWxsYmFjayxcbik6IHZvaWQge1xuICBsZXQgY2I6IENhbGxiYWNrIHwgdW5kZWZpbmVkO1xuICBsZXQgb2Zmc2V0ID0gMCxcbiAgICBidWZmZXI6IEJ1ZmZlciB8IFVpbnQ4QXJyYXk7XG5cbiAgaWYgKGxlbmd0aCA9PSBudWxsKSB7XG4gICAgbGVuZ3RoID0gMDtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb2Zmc2V0T3JDYWxsYmFjayA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY2IgPSBvZmZzZXRPckNhbGxiYWNrO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBvcHRPckJ1ZmZlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgY2IgPSBvcHRPckJ1ZmZlcjtcbiAgfSBlbHNlIHtcbiAgICBvZmZzZXQgPSBvZmZzZXRPckNhbGxiYWNrIGFzIG51bWJlcjtcbiAgICBjYiA9IGNhbGxiYWNrO1xuICB9XG5cbiAgaWYgKCFjYikgdGhyb3cgbmV3IEVycm9yKFwiTm8gY2FsbGJhY2sgZnVuY3Rpb24gc3VwcGxpZWRcIik7XG5cbiAgaWYgKG9wdE9yQnVmZmVyIGluc3RhbmNlb2YgQnVmZmVyIHx8IG9wdE9yQnVmZmVyIGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgIGJ1ZmZlciA9IG9wdE9yQnVmZmVyO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBvcHRPckJ1ZmZlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgb2Zmc2V0ID0gMDtcbiAgICBidWZmZXIgPSBCdWZmZXIuYWxsb2MoMTYzODQpO1xuICAgIGxlbmd0aCA9IGJ1ZmZlci5ieXRlTGVuZ3RoO1xuICAgIHBvc2l0aW9uID0gbnVsbDtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBvcHQgPSBvcHRPckJ1ZmZlciBhcyByZWFkT3B0aW9ucztcbiAgICBvZmZzZXQgPSBvcHQub2Zmc2V0ID8/IDA7XG4gICAgYnVmZmVyID0gb3B0LmJ1ZmZlciA/PyBCdWZmZXIuYWxsb2MoMTYzODQpO1xuICAgIGxlbmd0aCA9IG9wdC5sZW5ndGggPz8gYnVmZmVyLmJ5dGVMZW5ndGg7XG4gICAgcG9zaXRpb24gPSBvcHQucG9zaXRpb24gPz8gbnVsbDtcbiAgfVxuXG4gIGFzc2VydChvZmZzZXQgPj0gMCwgXCJvZmZzZXQgc2hvdWxkIGJlIGdyZWF0ZXIgb3IgZXF1YWwgdG8gMFwiKTtcbiAgYXNzZXJ0KFxuICAgIG9mZnNldCArIGxlbmd0aCA8PSBidWZmZXIuYnl0ZUxlbmd0aCxcbiAgICBgYnVmZmVyIGRvZXNuJ3QgaGF2ZSBlbm91Z2ggZGF0YTogYnl0ZUxlbmd0aCA9ICR7YnVmZmVyLmJ5dGVMZW5ndGh9LCBvZmZzZXQgKyBsZW5ndGggPSAke1xuICAgICAgb2Zmc2V0ICsgbGVuZ3RoXG4gICAgfWAsXG4gICk7XG5cbiAgaWYgKGJ1ZmZlci5ieXRlTGVuZ3RoID09IDApIHtcbiAgICB0aHJvdyBuZXcgRVJSX0lOVkFMSURfQVJHX1ZBTFVFKFxuICAgICAgXCJidWZmZXJcIixcbiAgICAgIGJ1ZmZlcixcbiAgICAgIFwiaXMgZW1wdHkgYW5kIGNhbm5vdCBiZSB3cml0dGVuXCIsXG4gICAgKTtcbiAgfVxuXG4gIGxldCBlcnI6IEVycm9yIHwgbnVsbCA9IG51bGwsXG4gICAgbnVtYmVyT2ZCeXRlc1JlYWQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIGlmIChwb3NpdGlvbikge1xuICAgIERlbm8uc2Vla1N5bmMoZmQsIHBvc2l0aW9uLCBEZW5vLlNlZWtNb2RlLkN1cnJlbnQpO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBudW1iZXJPZkJ5dGVzUmVhZCA9IERlbm8ucmVhZFN5bmMoZmQsIGJ1ZmZlcik7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgZXJyID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yIDogbmV3IEVycm9yKFwiW25vbi1lcnJvciB0aHJvd25dXCIpO1xuICB9XG5cbiAgaWYgKGVycikge1xuICAgIChjYWxsYmFjayBhcyAoZXJyOiBFcnJvcikgPT4gdm9pZCkoZXJyKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBkYXRhID0gQnVmZmVyLmZyb20oYnVmZmVyLmJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgpO1xuICAgIGNiKG51bGwsIG51bWJlck9mQnl0ZXNSZWFkLCBkYXRhKTtcbiAgfVxuXG4gIHJldHVybjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRTeW5jKFxuICBmZDogbnVtYmVyLFxuICBidWZmZXI6IEJ1ZmZlciB8IFVpbnQ4QXJyYXksXG4gIG9mZnNldDogbnVtYmVyLFxuICBsZW5ndGg6IG51bWJlcixcbiAgcG9zaXRpb246IG51bWJlciB8IG51bGwsXG4pOiBudW1iZXI7XG5leHBvcnQgZnVuY3Rpb24gcmVhZFN5bmMoXG4gIGZkOiBudW1iZXIsXG4gIGJ1ZmZlcjogQnVmZmVyIHwgVWludDhBcnJheSxcbiAgb3B0OiByZWFkU3luY09wdGlvbnMsXG4pOiBudW1iZXI7XG5leHBvcnQgZnVuY3Rpb24gcmVhZFN5bmMoXG4gIGZkOiBudW1iZXIsXG4gIGJ1ZmZlcjogQnVmZmVyIHwgVWludDhBcnJheSxcbiAgb2Zmc2V0T3JPcHQ/OiBudW1iZXIgfCByZWFkU3luY09wdGlvbnMsXG4gIGxlbmd0aD86IG51bWJlcixcbiAgcG9zaXRpb24/OiBudW1iZXIgfCBudWxsLFxuKTogbnVtYmVyIHtcbiAgbGV0IG9mZnNldCA9IDA7XG5cbiAgaWYgKGxlbmd0aCA9PSBudWxsKSB7XG4gICAgbGVuZ3RoID0gMDtcbiAgfVxuXG4gIGlmIChidWZmZXIuYnl0ZUxlbmd0aCA9PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVSUl9JTlZBTElEX0FSR19WQUxVRShcbiAgICAgIFwiYnVmZmVyXCIsXG4gICAgICBidWZmZXIsXG4gICAgICBcImlzIGVtcHR5IGFuZCBjYW5ub3QgYmUgd3JpdHRlblwiLFxuICAgICk7XG4gIH1cblxuICBpZiAodHlwZW9mIG9mZnNldE9yT3B0ID09PSBcIm51bWJlclwiKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0T3JPcHQ7XG4gIH0gZWxzZSB7XG4gICAgY29uc3Qgb3B0ID0gb2Zmc2V0T3JPcHQgYXMgcmVhZFN5bmNPcHRpb25zO1xuICAgIG9mZnNldCA9IG9wdC5vZmZzZXQgPz8gMDtcbiAgICBsZW5ndGggPSBvcHQubGVuZ3RoID8/IGJ1ZmZlci5ieXRlTGVuZ3RoO1xuICAgIHBvc2l0aW9uID0gb3B0LnBvc2l0aW9uID8/IG51bGw7XG4gIH1cblxuICBhc3NlcnQob2Zmc2V0ID49IDAsIFwib2Zmc2V0IHNob3VsZCBiZSBncmVhdGVyIG9yIGVxdWFsIHRvIDBcIik7XG4gIGFzc2VydChcbiAgICBvZmZzZXQgKyBsZW5ndGggPD0gYnVmZmVyLmJ5dGVMZW5ndGgsXG4gICAgYGJ1ZmZlciBkb2Vzbid0IGhhdmUgZW5vdWdoIGRhdGE6IGJ5dGVMZW5ndGggPSAke2J1ZmZlci5ieXRlTGVuZ3RofSwgb2Zmc2V0ICsgbGVuZ3RoID0gJHtcbiAgICAgIG9mZnNldCArIGxlbmd0aFxuICAgIH1gLFxuICApO1xuXG4gIGlmIChwb3NpdGlvbikge1xuICAgIERlbm8uc2Vla1N5bmMoZmQsIHBvc2l0aW9uLCBEZW5vLlNlZWtNb2RlLkN1cnJlbnQpO1xuICB9XG5cbiAgY29uc3QgbnVtYmVyT2ZCeXRlc1JlYWQgPSBEZW5vLnJlYWRTeW5jKGZkLCBidWZmZXIpO1xuXG4gIHJldHVybiBudW1iZXJPZkJ5dGVzUmVhZCA/PyAwO1xufVxu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