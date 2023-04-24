// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
export var DiffType;
(function(DiffType) {
    DiffType["removed"] = "removed";
    DiffType["common"] = "common";
    DiffType["added"] = "added";
})(DiffType || (DiffType = {}));
const REMOVED = 1;
const COMMON = 2;
const ADDED = 3;
function createCommon(A, B, reverse) {
    const common = [];
    if (A.length === 0 || B.length === 0) return [];
    for(let i = 0; i < Math.min(A.length, B.length); i += 1){
        if (A[reverse ? A.length - i - 1 : i] === B[reverse ? B.length - i - 1 : i]) {
            common.push(A[reverse ? A.length - i - 1 : i]);
        } else {
            return common;
        }
    }
    return common;
}
/**
 * Renders the differences between the actual and expected values
 * @param A Actual value
 * @param B Expected value
 */ export function diff(A, B) {
    const prefixCommon = createCommon(A, B);
    const suffixCommon = createCommon(A.slice(prefixCommon.length), B.slice(prefixCommon.length), true).reverse();
    A = suffixCommon.length ? A.slice(prefixCommon.length, -suffixCommon.length) : A.slice(prefixCommon.length);
    B = suffixCommon.length ? B.slice(prefixCommon.length, -suffixCommon.length) : B.slice(prefixCommon.length);
    const swapped = B.length > A.length;
    [A, B] = swapped ? [
        B,
        A
    ] : [
        A,
        B
    ];
    const M = A.length;
    const N = B.length;
    if (!M && !N && !suffixCommon.length && !prefixCommon.length) return [];
    if (!N) {
        return [
            ...prefixCommon.map((c)=>({
                    type: DiffType.common,
                    value: c
                })),
            ...A.map((a)=>({
                    type: swapped ? DiffType.added : DiffType.removed,
                    value: a
                })),
            ...suffixCommon.map((c)=>({
                    type: DiffType.common,
                    value: c
                }))
        ];
    }
    const offset = N;
    const delta = M - N;
    const size = M + N + 1;
    const fp = Array.from({
        length: size
    }, ()=>({
            y: -1,
            id: -1
        }));
    /**
   * INFO:
   * This buffer is used to save memory and improve performance.
   * The first half is used to save route and last half is used to save diff
   * type.
   * This is because, when I kept new uint8array area to save type,performance
   * worsened.
   */ const routes = new Uint32Array((M * N + size + 1) * 2);
    const diffTypesPtrOffset = routes.length / 2;
    let ptr = 0;
    let p = -1;
    function backTrace(A, B, current, swapped) {
        const M = A.length;
        const N = B.length;
        const result = [];
        let a = M - 1;
        let b = N - 1;
        let j = routes[current.id];
        let type = routes[current.id + diffTypesPtrOffset];
        while(true){
            if (!j && !type) break;
            const prev = j;
            if (type === REMOVED) {
                result.unshift({
                    type: swapped ? DiffType.removed : DiffType.added,
                    value: B[b]
                });
                b -= 1;
            } else if (type === ADDED) {
                result.unshift({
                    type: swapped ? DiffType.added : DiffType.removed,
                    value: A[a]
                });
                a -= 1;
            } else {
                result.unshift({
                    type: DiffType.common,
                    value: A[a]
                });
                a -= 1;
                b -= 1;
            }
            j = routes[prev];
            type = routes[prev + diffTypesPtrOffset];
        }
        return result;
    }
    function createFP(slide, down, k, M) {
        if (slide && slide.y === -1 && down && down.y === -1) {
            return {
                y: 0,
                id: 0
            };
        }
        if (down && down.y === -1 || k === M || (slide && slide.y) > (down && down.y) + 1) {
            const prev = slide.id;
            ptr++;
            routes[ptr] = prev;
            routes[ptr + diffTypesPtrOffset] = ADDED;
            return {
                y: slide.y,
                id: ptr
            };
        } else {
            const prev1 = down.id;
            ptr++;
            routes[ptr] = prev1;
            routes[ptr + diffTypesPtrOffset] = REMOVED;
            return {
                y: down.y + 1,
                id: ptr
            };
        }
    }
    function snake(k, slide, down, _offset, A, B) {
        const M = A.length;
        const N = B.length;
        if (k < -N || M < k) return {
            y: -1,
            id: -1
        };
        const fp = createFP(slide, down, k, M);
        while(fp.y + k < M && fp.y < N && A[fp.y + k] === B[fp.y]){
            const prev = fp.id;
            ptr++;
            fp.id = ptr;
            fp.y += 1;
            routes[ptr] = prev;
            routes[ptr + diffTypesPtrOffset] = COMMON;
        }
        return fp;
    }
    while(fp[delta + offset].y < N){
        p = p + 1;
        for(let k = -p; k < delta; ++k){
            fp[k + offset] = snake(k, fp[k - 1 + offset], fp[k + 1 + offset], offset, A, B);
        }
        for(let k1 = delta + p; k1 > delta; --k1){
            fp[k1 + offset] = snake(k1, fp[k1 - 1 + offset], fp[k1 + 1 + offset], offset, A, B);
        }
        fp[delta + offset] = snake(delta, fp[delta - 1 + offset], fp[delta + 1 + offset], offset, A, B);
    }
    return [
        ...prefixCommon.map((c)=>({
                type: DiffType.common,
                value: c
            })),
        ...backTrace(A, B, fp[delta + offset], swapped),
        ...suffixCommon.map((c)=>({
                type: DiffType.common,
                value: c
            }))
    ];
}
/**
 * Renders the differences between the actual and expected strings
 * Partially inspired from https://github.com/kpdecker/jsdiff
 * @param A Actual string
 * @param B Expected string
 */ export function diffstr(A, B) {
    function unescape(string) {
        // unescape invisible characters.
        // ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#escape_sequences
        return string.replaceAll("\b", "\\b").replaceAll("\f", "\\f").replaceAll("\t", "\\t").replaceAll("\v", "\\v").replaceAll(/\r\n|\r|\n/g, (str)=>str === "\r" ? "\\r" : str === "\n" ? "\\n\n" : "\\r\\n\r\n");
    }
    function tokenize(string, { wordDiff =false  } = {}) {
        if (wordDiff) {
            // Split string on whitespace symbols
            const tokens = string.split(/([^\S\r\n]+|[()[\]{}'"\r\n]|\b)/);
            // Extended Latin character set
            const words = /^[a-zA-Z\u{C0}-\u{FF}\u{D8}-\u{F6}\u{F8}-\u{2C6}\u{2C8}-\u{2D7}\u{2DE}-\u{2FF}\u{1E00}-\u{1EFF}]+$/u;
            // Join boundary splits that we do not consider to be boundaries and merge empty strings surrounded by word chars
            for(let i = 0; i < tokens.length - 1; i++){
                if (!tokens[i + 1] && tokens[i + 2] && words.test(tokens[i]) && words.test(tokens[i + 2])) {
                    tokens[i] += tokens[i + 2];
                    tokens.splice(i + 1, 2);
                    i--;
                }
            }
            return tokens.filter((token)=>token);
        } else {
            // Split string on new lines symbols
            const tokens1 = [], lines = string.split(/(\n|\r\n)/);
            // Ignore final empty token when text ends with a newline
            if (!lines[lines.length - 1]) {
                lines.pop();
            }
            // Merge the content and line separators into single tokens
            for(let i1 = 0; i1 < lines.length; i1++){
                if (i1 % 2) {
                    tokens1[tokens1.length - 1] += lines[i1];
                } else {
                    tokens1.push(lines[i1]);
                }
            }
            return tokens1;
        }
    }
    // Create details by filtering relevant word-diff for current line
    // and merge "space-diff" if surrounded by word-diff for cleaner displays
    function createDetails(line, tokens) {
        return tokens.filter(({ type  })=>type === line.type || type === DiffType.common).map((result, i, t)=>{
            if (result.type === DiffType.common && t[i - 1] && t[i - 1]?.type === t[i + 1]?.type && /\s+/.test(result.value)) {
                result.type = t[i - 1].type;
            }
            return result;
        });
    }
    // Compute multi-line diff
    const diffResult = diff(tokenize(`${unescape(A)}\n`), tokenize(`${unescape(B)}\n`));
    const added = [], removed = [];
    for (const result of diffResult){
        if (result.type === DiffType.added) {
            added.push(result);
        }
        if (result.type === DiffType.removed) {
            removed.push(result);
        }
    }
    // Compute word-diff
    const aLines = added.length < removed.length ? added : removed;
    const bLines = aLines === removed ? added : removed;
    for (const a of aLines){
        let tokens = [], b;
        // Search another diff line with at least one common token
        while(bLines.length){
            b = bLines.shift();
            tokens = diff(tokenize(a.value, {
                wordDiff: true
            }), tokenize(b?.value ?? "", {
                wordDiff: true
            }));
            if (tokens.some(({ type , value  })=>type === DiffType.common && value.trim().length)) {
                break;
            }
        }
        // Register word-diff details
        a.details = createDetails(a, tokens);
        if (b) {
            b.details = createDetails(b, tokens);
        }
    }
    return diffResult;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEzMi4wL3Rlc3RpbmcvX2RpZmYudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cblxuaW50ZXJmYWNlIEZhcnRoZXN0UG9pbnQge1xuICB5OiBudW1iZXI7XG4gIGlkOiBudW1iZXI7XG59XG5cbmV4cG9ydCBlbnVtIERpZmZUeXBlIHtcbiAgcmVtb3ZlZCA9IFwicmVtb3ZlZFwiLFxuICBjb21tb24gPSBcImNvbW1vblwiLFxuICBhZGRlZCA9IFwiYWRkZWRcIixcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEaWZmUmVzdWx0PFQ+IHtcbiAgdHlwZTogRGlmZlR5cGU7XG4gIHZhbHVlOiBUO1xuICBkZXRhaWxzPzogQXJyYXk8RGlmZlJlc3VsdDxUPj47XG59XG5cbmNvbnN0IFJFTU9WRUQgPSAxO1xuY29uc3QgQ09NTU9OID0gMjtcbmNvbnN0IEFEREVEID0gMztcblxuZnVuY3Rpb24gY3JlYXRlQ29tbW9uPFQ+KEE6IFRbXSwgQjogVFtdLCByZXZlcnNlPzogYm9vbGVhbik6IFRbXSB7XG4gIGNvbnN0IGNvbW1vbiA9IFtdO1xuICBpZiAoQS5sZW5ndGggPT09IDAgfHwgQi5sZW5ndGggPT09IDApIHJldHVybiBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1pbihBLmxlbmd0aCwgQi5sZW5ndGgpOyBpICs9IDEpIHtcbiAgICBpZiAoXG4gICAgICBBW3JldmVyc2UgPyBBLmxlbmd0aCAtIGkgLSAxIDogaV0gPT09IEJbcmV2ZXJzZSA/IEIubGVuZ3RoIC0gaSAtIDEgOiBpXVxuICAgICkge1xuICAgICAgY29tbW9uLnB1c2goQVtyZXZlcnNlID8gQS5sZW5ndGggLSBpIC0gMSA6IGldKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGNvbW1vbjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGNvbW1vbjtcbn1cblxuLyoqXG4gKiBSZW5kZXJzIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHRoZSBhY3R1YWwgYW5kIGV4cGVjdGVkIHZhbHVlc1xuICogQHBhcmFtIEEgQWN0dWFsIHZhbHVlXG4gKiBAcGFyYW0gQiBFeHBlY3RlZCB2YWx1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZGlmZjxUPihBOiBUW10sIEI6IFRbXSk6IEFycmF5PERpZmZSZXN1bHQ8VD4+IHtcbiAgY29uc3QgcHJlZml4Q29tbW9uID0gY3JlYXRlQ29tbW9uKEEsIEIpO1xuICBjb25zdCBzdWZmaXhDb21tb24gPSBjcmVhdGVDb21tb24oXG4gICAgQS5zbGljZShwcmVmaXhDb21tb24ubGVuZ3RoKSxcbiAgICBCLnNsaWNlKHByZWZpeENvbW1vbi5sZW5ndGgpLFxuICAgIHRydWUsXG4gICkucmV2ZXJzZSgpO1xuICBBID0gc3VmZml4Q29tbW9uLmxlbmd0aFxuICAgID8gQS5zbGljZShwcmVmaXhDb21tb24ubGVuZ3RoLCAtc3VmZml4Q29tbW9uLmxlbmd0aClcbiAgICA6IEEuc2xpY2UocHJlZml4Q29tbW9uLmxlbmd0aCk7XG4gIEIgPSBzdWZmaXhDb21tb24ubGVuZ3RoXG4gICAgPyBCLnNsaWNlKHByZWZpeENvbW1vbi5sZW5ndGgsIC1zdWZmaXhDb21tb24ubGVuZ3RoKVxuICAgIDogQi5zbGljZShwcmVmaXhDb21tb24ubGVuZ3RoKTtcbiAgY29uc3Qgc3dhcHBlZCA9IEIubGVuZ3RoID4gQS5sZW5ndGg7XG4gIFtBLCBCXSA9IHN3YXBwZWQgPyBbQiwgQV0gOiBbQSwgQl07XG4gIGNvbnN0IE0gPSBBLmxlbmd0aDtcbiAgY29uc3QgTiA9IEIubGVuZ3RoO1xuICBpZiAoIU0gJiYgIU4gJiYgIXN1ZmZpeENvbW1vbi5sZW5ndGggJiYgIXByZWZpeENvbW1vbi5sZW5ndGgpIHJldHVybiBbXTtcbiAgaWYgKCFOKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIC4uLnByZWZpeENvbW1vbi5tYXAoXG4gICAgICAgIChjKTogRGlmZlJlc3VsdDx0eXBlb2YgYz4gPT4gKHsgdHlwZTogRGlmZlR5cGUuY29tbW9uLCB2YWx1ZTogYyB9KSxcbiAgICAgICksXG4gICAgICAuLi5BLm1hcChcbiAgICAgICAgKGEpOiBEaWZmUmVzdWx0PHR5cGVvZiBhPiA9PiAoe1xuICAgICAgICAgIHR5cGU6IHN3YXBwZWQgPyBEaWZmVHlwZS5hZGRlZCA6IERpZmZUeXBlLnJlbW92ZWQsXG4gICAgICAgICAgdmFsdWU6IGEsXG4gICAgICAgIH0pLFxuICAgICAgKSxcbiAgICAgIC4uLnN1ZmZpeENvbW1vbi5tYXAoXG4gICAgICAgIChjKTogRGlmZlJlc3VsdDx0eXBlb2YgYz4gPT4gKHsgdHlwZTogRGlmZlR5cGUuY29tbW9uLCB2YWx1ZTogYyB9KSxcbiAgICAgICksXG4gICAgXTtcbiAgfVxuICBjb25zdCBvZmZzZXQgPSBOO1xuICBjb25zdCBkZWx0YSA9IE0gLSBOO1xuICBjb25zdCBzaXplID0gTSArIE4gKyAxO1xuICBjb25zdCBmcDogRmFydGhlc3RQb2ludFtdID0gQXJyYXkuZnJvbShcbiAgICB7IGxlbmd0aDogc2l6ZSB9LFxuICAgICgpID0+ICh7IHk6IC0xLCBpZDogLTEgfSksXG4gICk7XG4gIC8qKlxuICAgKiBJTkZPOlxuICAgKiBUaGlzIGJ1ZmZlciBpcyB1c2VkIHRvIHNhdmUgbWVtb3J5IGFuZCBpbXByb3ZlIHBlcmZvcm1hbmNlLlxuICAgKiBUaGUgZmlyc3QgaGFsZiBpcyB1c2VkIHRvIHNhdmUgcm91dGUgYW5kIGxhc3QgaGFsZiBpcyB1c2VkIHRvIHNhdmUgZGlmZlxuICAgKiB0eXBlLlxuICAgKiBUaGlzIGlzIGJlY2F1c2UsIHdoZW4gSSBrZXB0IG5ldyB1aW50OGFycmF5IGFyZWEgdG8gc2F2ZSB0eXBlLHBlcmZvcm1hbmNlXG4gICAqIHdvcnNlbmVkLlxuICAgKi9cbiAgY29uc3Qgcm91dGVzID0gbmV3IFVpbnQzMkFycmF5KChNICogTiArIHNpemUgKyAxKSAqIDIpO1xuICBjb25zdCBkaWZmVHlwZXNQdHJPZmZzZXQgPSByb3V0ZXMubGVuZ3RoIC8gMjtcbiAgbGV0IHB0ciA9IDA7XG4gIGxldCBwID0gLTE7XG5cbiAgZnVuY3Rpb24gYmFja1RyYWNlPFQ+KFxuICAgIEE6IFRbXSxcbiAgICBCOiBUW10sXG4gICAgY3VycmVudDogRmFydGhlc3RQb2ludCxcbiAgICBzd2FwcGVkOiBib29sZWFuLFxuICApOiBBcnJheTx7XG4gICAgdHlwZTogRGlmZlR5cGU7XG4gICAgdmFsdWU6IFQ7XG4gIH0+IHtcbiAgICBjb25zdCBNID0gQS5sZW5ndGg7XG4gICAgY29uc3QgTiA9IEIubGVuZ3RoO1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgIGxldCBhID0gTSAtIDE7XG4gICAgbGV0IGIgPSBOIC0gMTtcbiAgICBsZXQgaiA9IHJvdXRlc1tjdXJyZW50LmlkXTtcbiAgICBsZXQgdHlwZSA9IHJvdXRlc1tjdXJyZW50LmlkICsgZGlmZlR5cGVzUHRyT2Zmc2V0XTtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKCFqICYmICF0eXBlKSBicmVhaztcbiAgICAgIGNvbnN0IHByZXYgPSBqO1xuICAgICAgaWYgKHR5cGUgPT09IFJFTU9WRUQpIHtcbiAgICAgICAgcmVzdWx0LnVuc2hpZnQoe1xuICAgICAgICAgIHR5cGU6IHN3YXBwZWQgPyBEaWZmVHlwZS5yZW1vdmVkIDogRGlmZlR5cGUuYWRkZWQsXG4gICAgICAgICAgdmFsdWU6IEJbYl0sXG4gICAgICAgIH0pO1xuICAgICAgICBiIC09IDE7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IEFEREVEKSB7XG4gICAgICAgIHJlc3VsdC51bnNoaWZ0KHtcbiAgICAgICAgICB0eXBlOiBzd2FwcGVkID8gRGlmZlR5cGUuYWRkZWQgOiBEaWZmVHlwZS5yZW1vdmVkLFxuICAgICAgICAgIHZhbHVlOiBBW2FdLFxuICAgICAgICB9KTtcbiAgICAgICAgYSAtPSAxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0LnVuc2hpZnQoeyB0eXBlOiBEaWZmVHlwZS5jb21tb24sIHZhbHVlOiBBW2FdIH0pO1xuICAgICAgICBhIC09IDE7XG4gICAgICAgIGIgLT0gMTtcbiAgICAgIH1cbiAgICAgIGogPSByb3V0ZXNbcHJldl07XG4gICAgICB0eXBlID0gcm91dGVzW3ByZXYgKyBkaWZmVHlwZXNQdHJPZmZzZXRdO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlRlAoXG4gICAgc2xpZGU6IEZhcnRoZXN0UG9pbnQsXG4gICAgZG93bjogRmFydGhlc3RQb2ludCxcbiAgICBrOiBudW1iZXIsXG4gICAgTTogbnVtYmVyLFxuICApOiBGYXJ0aGVzdFBvaW50IHtcbiAgICBpZiAoc2xpZGUgJiYgc2xpZGUueSA9PT0gLTEgJiYgZG93biAmJiBkb3duLnkgPT09IC0xKSB7XG4gICAgICByZXR1cm4geyB5OiAwLCBpZDogMCB9O1xuICAgIH1cbiAgICBpZiAoXG4gICAgICAoZG93biAmJiBkb3duLnkgPT09IC0xKSB8fFxuICAgICAgayA9PT0gTSB8fFxuICAgICAgKHNsaWRlICYmIHNsaWRlLnkpID4gKGRvd24gJiYgZG93bi55KSArIDFcbiAgICApIHtcbiAgICAgIGNvbnN0IHByZXYgPSBzbGlkZS5pZDtcbiAgICAgIHB0cisrO1xuICAgICAgcm91dGVzW3B0cl0gPSBwcmV2O1xuICAgICAgcm91dGVzW3B0ciArIGRpZmZUeXBlc1B0ck9mZnNldF0gPSBBRERFRDtcbiAgICAgIHJldHVybiB7IHk6IHNsaWRlLnksIGlkOiBwdHIgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcHJldiA9IGRvd24uaWQ7XG4gICAgICBwdHIrKztcbiAgICAgIHJvdXRlc1twdHJdID0gcHJldjtcbiAgICAgIHJvdXRlc1twdHIgKyBkaWZmVHlwZXNQdHJPZmZzZXRdID0gUkVNT1ZFRDtcbiAgICAgIHJldHVybiB7IHk6IGRvd24ueSArIDEsIGlkOiBwdHIgfTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzbmFrZTxUPihcbiAgICBrOiBudW1iZXIsXG4gICAgc2xpZGU6IEZhcnRoZXN0UG9pbnQsXG4gICAgZG93bjogRmFydGhlc3RQb2ludCxcbiAgICBfb2Zmc2V0OiBudW1iZXIsXG4gICAgQTogVFtdLFxuICAgIEI6IFRbXSxcbiAgKTogRmFydGhlc3RQb2ludCB7XG4gICAgY29uc3QgTSA9IEEubGVuZ3RoO1xuICAgIGNvbnN0IE4gPSBCLmxlbmd0aDtcbiAgICBpZiAoayA8IC1OIHx8IE0gPCBrKSByZXR1cm4geyB5OiAtMSwgaWQ6IC0xIH07XG4gICAgY29uc3QgZnAgPSBjcmVhdGVGUChzbGlkZSwgZG93biwgaywgTSk7XG4gICAgd2hpbGUgKGZwLnkgKyBrIDwgTSAmJiBmcC55IDwgTiAmJiBBW2ZwLnkgKyBrXSA9PT0gQltmcC55XSkge1xuICAgICAgY29uc3QgcHJldiA9IGZwLmlkO1xuICAgICAgcHRyKys7XG4gICAgICBmcC5pZCA9IHB0cjtcbiAgICAgIGZwLnkgKz0gMTtcbiAgICAgIHJvdXRlc1twdHJdID0gcHJldjtcbiAgICAgIHJvdXRlc1twdHIgKyBkaWZmVHlwZXNQdHJPZmZzZXRdID0gQ09NTU9OO1xuICAgIH1cbiAgICByZXR1cm4gZnA7XG4gIH1cblxuICB3aGlsZSAoZnBbZGVsdGEgKyBvZmZzZXRdLnkgPCBOKSB7XG4gICAgcCA9IHAgKyAxO1xuICAgIGZvciAobGV0IGsgPSAtcDsgayA8IGRlbHRhOyArK2spIHtcbiAgICAgIGZwW2sgKyBvZmZzZXRdID0gc25ha2UoXG4gICAgICAgIGssXG4gICAgICAgIGZwW2sgLSAxICsgb2Zmc2V0XSxcbiAgICAgICAgZnBbayArIDEgKyBvZmZzZXRdLFxuICAgICAgICBvZmZzZXQsXG4gICAgICAgIEEsXG4gICAgICAgIEIsXG4gICAgICApO1xuICAgIH1cbiAgICBmb3IgKGxldCBrID0gZGVsdGEgKyBwOyBrID4gZGVsdGE7IC0taykge1xuICAgICAgZnBbayArIG9mZnNldF0gPSBzbmFrZShcbiAgICAgICAgayxcbiAgICAgICAgZnBbayAtIDEgKyBvZmZzZXRdLFxuICAgICAgICBmcFtrICsgMSArIG9mZnNldF0sXG4gICAgICAgIG9mZnNldCxcbiAgICAgICAgQSxcbiAgICAgICAgQixcbiAgICAgICk7XG4gICAgfVxuICAgIGZwW2RlbHRhICsgb2Zmc2V0XSA9IHNuYWtlKFxuICAgICAgZGVsdGEsXG4gICAgICBmcFtkZWx0YSAtIDEgKyBvZmZzZXRdLFxuICAgICAgZnBbZGVsdGEgKyAxICsgb2Zmc2V0XSxcbiAgICAgIG9mZnNldCxcbiAgICAgIEEsXG4gICAgICBCLFxuICAgICk7XG4gIH1cbiAgcmV0dXJuIFtcbiAgICAuLi5wcmVmaXhDb21tb24ubWFwKFxuICAgICAgKGMpOiBEaWZmUmVzdWx0PHR5cGVvZiBjPiA9PiAoeyB0eXBlOiBEaWZmVHlwZS5jb21tb24sIHZhbHVlOiBjIH0pLFxuICAgICksXG4gICAgLi4uYmFja1RyYWNlKEEsIEIsIGZwW2RlbHRhICsgb2Zmc2V0XSwgc3dhcHBlZCksXG4gICAgLi4uc3VmZml4Q29tbW9uLm1hcChcbiAgICAgIChjKTogRGlmZlJlc3VsdDx0eXBlb2YgYz4gPT4gKHsgdHlwZTogRGlmZlR5cGUuY29tbW9uLCB2YWx1ZTogYyB9KSxcbiAgICApLFxuICBdO1xufVxuXG4vKipcbiAqIFJlbmRlcnMgdGhlIGRpZmZlcmVuY2VzIGJldHdlZW4gdGhlIGFjdHVhbCBhbmQgZXhwZWN0ZWQgc3RyaW5nc1xuICogUGFydGlhbGx5IGluc3BpcmVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2twZGVja2VyL2pzZGlmZlxuICogQHBhcmFtIEEgQWN0dWFsIHN0cmluZ1xuICogQHBhcmFtIEIgRXhwZWN0ZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaWZmc3RyKEE6IHN0cmluZywgQjogc3RyaW5nKSB7XG4gIGZ1bmN0aW9uIHVuZXNjYXBlKHN0cmluZzogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyB1bmVzY2FwZSBpbnZpc2libGUgY2hhcmFjdGVycy5cbiAgICAvLyByZWY6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL1N0cmluZyNlc2NhcGVfc2VxdWVuY2VzXG4gICAgcmV0dXJuIHN0cmluZ1xuICAgICAgLnJlcGxhY2VBbGwoXCJcXGJcIiwgXCJcXFxcYlwiKVxuICAgICAgLnJlcGxhY2VBbGwoXCJcXGZcIiwgXCJcXFxcZlwiKVxuICAgICAgLnJlcGxhY2VBbGwoXCJcXHRcIiwgXCJcXFxcdFwiKVxuICAgICAgLnJlcGxhY2VBbGwoXCJcXHZcIiwgXCJcXFxcdlwiKVxuICAgICAgLnJlcGxhY2VBbGwoIC8vIGRvZXMgbm90IHJlbW92ZSBsaW5lIGJyZWFrc1xuICAgICAgICAvXFxyXFxufFxccnxcXG4vZyxcbiAgICAgICAgKHN0cikgPT4gc3RyID09PSBcIlxcclwiID8gXCJcXFxcclwiIDogc3RyID09PSBcIlxcblwiID8gXCJcXFxcblxcblwiIDogXCJcXFxcclxcXFxuXFxyXFxuXCIsXG4gICAgICApO1xuICB9XG5cbiAgZnVuY3Rpb24gdG9rZW5pemUoc3RyaW5nOiBzdHJpbmcsIHsgd29yZERpZmYgPSBmYWxzZSB9ID0ge30pOiBzdHJpbmdbXSB7XG4gICAgaWYgKHdvcmREaWZmKSB7XG4gICAgICAvLyBTcGxpdCBzdHJpbmcgb24gd2hpdGVzcGFjZSBzeW1ib2xzXG4gICAgICBjb25zdCB0b2tlbnMgPSBzdHJpbmcuc3BsaXQoLyhbXlxcU1xcclxcbl0rfFsoKVtcXF17fSdcIlxcclxcbl18XFxiKS8pO1xuICAgICAgLy8gRXh0ZW5kZWQgTGF0aW4gY2hhcmFjdGVyIHNldFxuICAgICAgY29uc3Qgd29yZHMgPVxuICAgICAgICAvXlthLXpBLVpcXHV7QzB9LVxcdXtGRn1cXHV7RDh9LVxcdXtGNn1cXHV7Rjh9LVxcdXsyQzZ9XFx1ezJDOH0tXFx1ezJEN31cXHV7MkRFfS1cXHV7MkZGfVxcdXsxRTAwfS1cXHV7MUVGRn1dKyQvdTtcblxuICAgICAgLy8gSm9pbiBib3VuZGFyeSBzcGxpdHMgdGhhdCB3ZSBkbyBub3QgY29uc2lkZXIgdG8gYmUgYm91bmRhcmllcyBhbmQgbWVyZ2UgZW1wdHkgc3RyaW5ncyBzdXJyb3VuZGVkIGJ5IHdvcmQgY2hhcnNcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgIXRva2Vuc1tpICsgMV0gJiYgdG9rZW5zW2kgKyAyXSAmJiB3b3Jkcy50ZXN0KHRva2Vuc1tpXSkgJiZcbiAgICAgICAgICB3b3Jkcy50ZXN0KHRva2Vuc1tpICsgMl0pXG4gICAgICAgICkge1xuICAgICAgICAgIHRva2Vuc1tpXSArPSB0b2tlbnNbaSArIDJdO1xuICAgICAgICAgIHRva2Vucy5zcGxpY2UoaSArIDEsIDIpO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRva2Vucy5maWx0ZXIoKHRva2VuKSA9PiB0b2tlbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFNwbGl0IHN0cmluZyBvbiBuZXcgbGluZXMgc3ltYm9sc1xuICAgICAgY29uc3QgdG9rZW5zID0gW10sIGxpbmVzID0gc3RyaW5nLnNwbGl0KC8oXFxufFxcclxcbikvKTtcblxuICAgICAgLy8gSWdub3JlIGZpbmFsIGVtcHR5IHRva2VuIHdoZW4gdGV4dCBlbmRzIHdpdGggYSBuZXdsaW5lXG4gICAgICBpZiAoIWxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdKSB7XG4gICAgICAgIGxpbmVzLnBvcCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBNZXJnZSB0aGUgY29udGVudCBhbmQgbGluZSBzZXBhcmF0b3JzIGludG8gc2luZ2xlIHRva2Vuc1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaSAlIDIpIHtcbiAgICAgICAgICB0b2tlbnNbdG9rZW5zLmxlbmd0aCAtIDFdICs9IGxpbmVzW2ldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRva2Vucy5wdXNoKGxpbmVzW2ldKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRva2VucztcbiAgICB9XG4gIH1cblxuICAvLyBDcmVhdGUgZGV0YWlscyBieSBmaWx0ZXJpbmcgcmVsZXZhbnQgd29yZC1kaWZmIGZvciBjdXJyZW50IGxpbmVcbiAgLy8gYW5kIG1lcmdlIFwic3BhY2UtZGlmZlwiIGlmIHN1cnJvdW5kZWQgYnkgd29yZC1kaWZmIGZvciBjbGVhbmVyIGRpc3BsYXlzXG4gIGZ1bmN0aW9uIGNyZWF0ZURldGFpbHMoXG4gICAgbGluZTogRGlmZlJlc3VsdDxzdHJpbmc+LFxuICAgIHRva2VuczogQXJyYXk8RGlmZlJlc3VsdDxzdHJpbmc+PixcbiAgKSB7XG4gICAgcmV0dXJuIHRva2Vucy5maWx0ZXIoKHsgdHlwZSB9KSA9PlxuICAgICAgdHlwZSA9PT0gbGluZS50eXBlIHx8IHR5cGUgPT09IERpZmZUeXBlLmNvbW1vblxuICAgICkubWFwKChyZXN1bHQsIGksIHQpID0+IHtcbiAgICAgIGlmIChcbiAgICAgICAgKHJlc3VsdC50eXBlID09PSBEaWZmVHlwZS5jb21tb24pICYmICh0W2kgLSAxXSkgJiZcbiAgICAgICAgKHRbaSAtIDFdPy50eXBlID09PSB0W2kgKyAxXT8udHlwZSkgJiYgL1xccysvLnRlc3QocmVzdWx0LnZhbHVlKVxuICAgICAgKSB7XG4gICAgICAgIHJlc3VsdC50eXBlID0gdFtpIC0gMV0udHlwZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSk7XG4gIH1cblxuICAvLyBDb21wdXRlIG11bHRpLWxpbmUgZGlmZlxuICBjb25zdCBkaWZmUmVzdWx0ID0gZGlmZihcbiAgICB0b2tlbml6ZShgJHt1bmVzY2FwZShBKX1cXG5gKSxcbiAgICB0b2tlbml6ZShgJHt1bmVzY2FwZShCKX1cXG5gKSxcbiAgKTtcblxuICBjb25zdCBhZGRlZCA9IFtdLCByZW1vdmVkID0gW107XG4gIGZvciAoY29uc3QgcmVzdWx0IG9mIGRpZmZSZXN1bHQpIHtcbiAgICBpZiAocmVzdWx0LnR5cGUgPT09IERpZmZUeXBlLmFkZGVkKSB7XG4gICAgICBhZGRlZC5wdXNoKHJlc3VsdCk7XG4gICAgfVxuICAgIGlmIChyZXN1bHQudHlwZSA9PT0gRGlmZlR5cGUucmVtb3ZlZCkge1xuICAgICAgcmVtb3ZlZC5wdXNoKHJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgLy8gQ29tcHV0ZSB3b3JkLWRpZmZcbiAgY29uc3QgYUxpbmVzID0gYWRkZWQubGVuZ3RoIDwgcmVtb3ZlZC5sZW5ndGggPyBhZGRlZCA6IHJlbW92ZWQ7XG4gIGNvbnN0IGJMaW5lcyA9IGFMaW5lcyA9PT0gcmVtb3ZlZCA/IGFkZGVkIDogcmVtb3ZlZDtcbiAgZm9yIChjb25zdCBhIG9mIGFMaW5lcykge1xuICAgIGxldCB0b2tlbnMgPSBbXSBhcyBBcnJheTxEaWZmUmVzdWx0PHN0cmluZz4+LFxuICAgICAgYjogdW5kZWZpbmVkIHwgRGlmZlJlc3VsdDxzdHJpbmc+O1xuICAgIC8vIFNlYXJjaCBhbm90aGVyIGRpZmYgbGluZSB3aXRoIGF0IGxlYXN0IG9uZSBjb21tb24gdG9rZW5cbiAgICB3aGlsZSAoYkxpbmVzLmxlbmd0aCkge1xuICAgICAgYiA9IGJMaW5lcy5zaGlmdCgpO1xuICAgICAgdG9rZW5zID0gZGlmZihcbiAgICAgICAgdG9rZW5pemUoYS52YWx1ZSwgeyB3b3JkRGlmZjogdHJ1ZSB9KSxcbiAgICAgICAgdG9rZW5pemUoYj8udmFsdWUgPz8gXCJcIiwgeyB3b3JkRGlmZjogdHJ1ZSB9KSxcbiAgICAgICk7XG4gICAgICBpZiAoXG4gICAgICAgIHRva2Vucy5zb21lKCh7IHR5cGUsIHZhbHVlIH0pID0+XG4gICAgICAgICAgdHlwZSA9PT0gRGlmZlR5cGUuY29tbW9uICYmIHZhbHVlLnRyaW0oKS5sZW5ndGhcbiAgICAgICAgKVxuICAgICAgKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBSZWdpc3RlciB3b3JkLWRpZmYgZGV0YWlsc1xuICAgIGEuZGV0YWlscyA9IGNyZWF0ZURldGFpbHMoYSwgdG9rZW5zKTtcbiAgICBpZiAoYikge1xuICAgICAgYi5kZXRhaWxzID0gY3JlYXRlRGV0YWlscyhiLCB0b2tlbnMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkaWZmUmVzdWx0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxxQ0FBcUM7QUFFckMsV0FLTztVQUFLLFFBQVE7SUFBUixTQUNWLGFBQUE7SUFEVSxTQUVWLFlBQUE7SUFGVSxTQUdWLFdBQUE7R0FIVSxhQUFBO0FBWVosTUFBTSxVQUFVO0FBQ2hCLE1BQU0sU0FBUztBQUNmLE1BQU0sUUFBUTtBQUVkLFNBQVMsYUFBZ0IsQ0FBTSxFQUFFLENBQU0sRUFBRSxPQUFpQixFQUFPO0lBQy9ELE1BQU0sU0FBUyxFQUFFO0lBQ2pCLElBQUksRUFBRSxNQUFNLEtBQUssS0FBSyxFQUFFLE1BQU0sS0FBSyxHQUFHLE9BQU8sRUFBRTtJQUMvQyxJQUFLLElBQUksSUFBSSxHQUFHLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSxNQUFNLEdBQUcsS0FBSyxFQUFHO1FBQ3hELElBQ0UsQ0FBQyxDQUFDLFVBQVUsRUFBRSxNQUFNLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxVQUFVLEVBQUUsTUFBTSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsRUFDdkU7WUFDQSxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLE1BQU0sR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDO1FBQy9DLE9BQU87WUFDTCxPQUFPO1FBQ1QsQ0FBQztJQUNIO0lBQ0EsT0FBTztBQUNUO0FBRUE7Ozs7Q0FJQyxHQUNELE9BQU8sU0FBUyxLQUFRLENBQU0sRUFB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