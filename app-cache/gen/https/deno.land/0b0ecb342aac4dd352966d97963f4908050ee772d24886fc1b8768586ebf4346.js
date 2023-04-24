// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
/**
 * This implementation is inspired by POSIX and Golang but does not port
 * implementation code. */ var State;
(function(State) {
    State[State["PASSTHROUGH"] = 0] = "PASSTHROUGH";
    State[State["PERCENT"] = 1] = "PERCENT";
    State[State["POSITIONAL"] = 2] = "POSITIONAL";
    State[State["PRECISION"] = 3] = "PRECISION";
    State[State["WIDTH"] = 4] = "WIDTH";
})(State || (State = {}));
var WorP;
(function(WorP) {
    WorP[WorP["WIDTH"] = 0] = "WIDTH";
    WorP[WorP["PRECISION"] = 1] = "PRECISION";
})(WorP || (WorP = {}));
class Flags {
    plus;
    dash;
    sharp;
    space;
    zero;
    lessthan;
    width = -1;
    precision = -1;
}
const min = Math.min;
const UNICODE_REPLACEMENT_CHARACTER = "\ufffd";
const DEFAULT_PRECISION = 6;
const FLOAT_REGEXP = /(-?)(\d)\.?(\d*)e([+-])(\d+)/;
var F;
(function(F) {
    F[F["sign"] = 1] = "sign";
    F[F["mantissa"] = 2] = "mantissa";
    F[F["fractional"] = 3] = "fractional";
    F[F["esign"] = 4] = "esign";
    F[F["exponent"] = 5] = "exponent";
})(F || (F = {}));
class Printf {
    format;
    args;
    i;
    state = State.PASSTHROUGH;
    verb = "";
    buf = "";
    argNum = 0;
    flags = new Flags();
    haveSeen;
    // barf, store precision and width errors for later processing ...
    tmpError;
    constructor(format, ...args){
        this.format = format;
        this.args = args;
        this.haveSeen = Array.from({
            length: args.length
        });
        this.i = 0;
    }
    doPrintf() {
        for(; this.i < this.format.length; ++this.i){
            const c = this.format[this.i];
            switch(this.state){
                case State.PASSTHROUGH:
                    if (c === "%") {
                        this.state = State.PERCENT;
                    } else {
                        this.buf += c;
                    }
                    break;
                case State.PERCENT:
                    if (c === "%") {
                        this.buf += c;
                        this.state = State.PASSTHROUGH;
                    } else {
                        this.handleFormat();
                    }
                    break;
                default:
                    throw Error("Should be unreachable, certainly a bug in the lib.");
            }
        }
        // check for unhandled args
        let extras = false;
        let err = "%!(EXTRA";
        for(let i = 0; i !== this.haveSeen.length; ++i){
            if (!this.haveSeen[i]) {
                extras = true;
                err += ` '${Deno.inspect(this.args[i])}'`;
            }
        }
        err += ")";
        if (extras) {
            this.buf += err;
        }
        return this.buf;
    }
    // %[<positional>]<flag>...<verb>
    handleFormat() {
        this.flags = new Flags();
        const flags = this.flags;
        for(; this.i < this.format.length; ++this.i){
            const c = this.format[this.i];
            switch(this.state){
                case State.PERCENT:
                    switch(c){
                        case "[":
                            this.handlePositional();
                            this.state = State.POSITIONAL;
                            break;
                        case "+":
                            flags.plus = true;
                            break;
                        case "<":
                            flags.lessthan = true;
                            break;
                        case "-":
                            flags.dash = true;
                            flags.zero = false; // only left pad zeros, dash takes precedence
                            break;
                        case "#":
                            flags.sharp = true;
                            break;
                        case " ":
                            flags.space = true;
                            break;
                        case "0":
                            // only left pad zeros, dash takes precedence
                            flags.zero = !flags.dash;
                            break;
                        default:
                            if ("1" <= c && c <= "9" || c === "." || c === "*") {
                                if (c === ".") {
                                    this.flags.precision = 0;
                                    this.state = State.PRECISION;
                                    this.i++;
                                } else {
                                    this.state = State.WIDTH;
                                }
                                this.handleWidthAndPrecision(flags);
                            } else {
                                this.handleVerb();
                                return; // always end in verb
                            }
                    } // switch c
                    break;
                case State.POSITIONAL:
                    // TODO(bartlomieju): either a verb or * only verb for now
                    if (c === "*") {
                        const worp = this.flags.precision === -1 ? WorP.WIDTH : WorP.PRECISION;
                        this.handleWidthOrPrecisionRef(worp);
                        this.state = State.PERCENT;
                        break;
                    } else {
                        this.handleVerb();
                        return; // always end in verb
                    }
                default:
                    throw new Error(`Should not be here ${this.state}, library bug!`);
            } // switch state
        }
    }
    /**
   * Handle width or precision
   * @param wOrP
   */ handleWidthOrPrecisionRef(wOrP) {
        if (this.argNum >= this.args.length) {
            // handle Positional should have already taken care of it...
            return;
        }
        const arg = this.args[this.argNum];
        this.haveSeen[this.argNum] = true;
        if (typeof arg === "number") {
            switch(wOrP){
                case WorP.WIDTH:
                    this.flags.width = arg;
                    break;
                default:
                    this.flags.precision = arg;
            }
        } else {
            const tmp = wOrP === WorP.WIDTH ? "WIDTH" : "PREC";
            this.tmpError = `%!(BAD ${tmp} '${this.args[this.argNum]}')`;
        }
        this.argNum++;
    }
    /**
   * Handle width and precision
   * @param flags
   */ handleWidthAndPrecision(flags) {
        const fmt = this.format;
        for(; this.i !== this.format.length; ++this.i){
            const c = fmt[this.i];
            switch(this.state){
                case State.WIDTH:
                    switch(c){
                        case ".":
                            // initialize precision, %9.f -> precision=0
                            this.flags.precision = 0;
                            this.state = State.PRECISION;
                            break;
                        case "*":
                            this.handleWidthOrPrecisionRef(WorP.WIDTH);
                            break;
                        default:
                            {
                                const val = parseInt(c);
                                // most likely parseInt does something stupid that makes
                                // it unusable for this scenario ...
                                // if we encounter a non (number|*|.) we're done with prec & wid
                                if (isNaN(val)) {
                                    this.i--;
                                    this.state = State.PERCENT;
                                    return;
                                }
                                flags.width = flags.width == -1 ? 0 : flags.width;
                                flags.width *= 10;
                                flags.width += val;
                            }
                    } // switch c
                    break;
                case State.PRECISION:
                    {
                        if (c === "*") {
                            this.handleWidthOrPrecisionRef(WorP.PRECISION);
                            break;
                        }
                        const val1 = parseInt(c);
                        if (isNaN(val1)) {
                            // one too far, rewind
                            this.i--;
                            this.state = State.PERCENT;
                            return;
                        }
                        flags.precision *= 10;
                        flags.precision += val1;
                        break;
                    }
                default:
                    throw new Error("can't be here. bug.");
            } // switch state
        }
    }
    /** Handle positional */ handlePositional() {
        if (this.format[this.i] !== "[") {
            // sanity only
            throw new Error("Can't happen? Bug.");
        }
        let positional = 0;
        const format = this.format;
        this.i++;
        let err = false;
        for(; this.i !== this.format.length; ++this.i){
            if (format[this.i] === "]") {
                break;
            }
            positional *= 10;
            const val = parseInt(format[this.i]);
            if (isNaN(val)) {
                //throw new Error(
                //  `invalid character in positional: ${format}[${format[this.i]}]`
                //);
                this.tmpError = "%!(BAD INDEX)";
                err = true;
            }
            positional += val;
        }
        if (positional - 1 >= this.args.length) {
            this.tmpError = "%!(BAD INDEX)";
            err = true;
        }
        this.argNum = err ? this.argNum : positional - 1;
        return;
    }
    /** Handle less than */ handleLessThan() {
        // deno-lint-ignore no-explicit-any
        const arg = this.args[this.argNum];
        if ((arg || {}).constructor.name !== "Array") {
            throw new Error(`arg ${arg} is not an array. Todo better error handling`);
        }
        let str = "[ ";
        for(let i = 0; i !== arg.length; ++i){
            if (i !== 0) str += ", ";
            str += this._handleVerb(arg[i]);
        }
        return str + " ]";
    }
    /** Handle verb */ handleVerb() {
        const verb = this.format[this.i];
        this.verb = verb;
        if (this.tmpError) {
            this.buf += this.tmpError;
            this.tmpError = undefined;
            if (this.argNum < this.haveSeen.length) {
                this.haveSeen[this.argNum] = true; // keep track of used args
            }
        } else if (this.args.length <= this.argNum) {
            this.buf += `%!(MISSING '${verb}')`;
        } else {
            const arg = this.args[this.argNum]; // check out of range
            this.haveSeen[this.argNum] = true; // keep track of used args
            if (this.flags.lessthan) {
                this.buf += this.handleLessThan();
            } else {
                this.buf += this._handleVerb(arg);
            }
        }
        this.argNum++; // if there is a further positional, it will reset.
        this.state = State.PASSTHROUGH;
    }
    // deno-lint-ignore no-explicit-any
    _handleVerb(arg) {
        switch(this.verb){
            case "t":
                return this.pad(arg.toString());
            case "b":
                return this.fmtNumber(arg, 2);
            case "c":
                return this.fmtNumberCodePoint(arg);
            case "d":
                return this.fmtNumber(arg, 10);
            case "o":
                return this.fmtNumber(arg, 8);
            case "x":
                return this.fmtHex(arg);
            case "X":
                return this.fmtHex(arg, true);
            case "e":
                return this.fmtFloatE(arg);
            case "E":
                return this.fmtFloatE(arg, true);
            case "f":
            case "F":
                return this.fmtFloatF(arg);
            case "g":
                return this.fmtFloatG(arg);
            case "G":
                return this.fmtFloatG(arg, true);
            case "s":
                return this.fmtString(arg);
            case "T":
                return this.fmtString(typeof arg);
            case "v":
                return this.fmtV(arg);
            case "j":
                return this.fmtJ(arg);
            default:
                return `%!(BAD VERB '${this.verb}')`;
        }
    }
    /**
   * Pad a string
   * @param s text to pad
   */ pad(s) {
        const padding = this.flags.zero ? "0" : " ";
        if (this.flags.dash) {
            return s.padEnd(this.flags.width, padding);
        }
        return s.padStart(this.flags.width, padding);
    }
    /**
   * Pad a number
   * @param nStr
   * @param neg
   */ padNum(nStr, neg) {
        let sign;
        if (neg) {
            sign = "-";
        } else if (this.flags.plus || this.flags.space) {
            sign = this.flags.plus ? "+" : " ";
        } else {
            sign = "";
        }
        const zero = this.flags.zero;
        if (!zero) {
            // sign comes in front of padding when padding w/ zero,
            // in from of value if padding with spaces.
            nStr = sign + nStr;
        }
        const pad = zero ? "0" : " ";
        const len = zero ? this.flags.width - sign.length : this.flags.width;
        if (this.flags.dash) {
            nStr = nStr.padEnd(len, pad);
        } else {
            nStr = nStr.padStart(len, pad);
        }
        if (zero) {
            // see above
            nStr = sign + nStr;
        }
        return nStr;
    }
    /**
   * Format a number
   * @param n
   * @param radix
   * @param upcase
   */ fmtNumber(n, radix, upcase = false) {
        let num = Math.abs(n).toString(radix);
        const prec = this.flags.precision;
        if (prec !== -1) {
            this.flags.zero = false;
            num = n === 0 && prec === 0 ? "" : num;
            while(num.length < prec){
                num = "0" + num;
            }
        }
        let prefix = "";
        if (this.flags.sharp) {
            switch(radix){
                case 2:
                    prefix += "0b";
                    break;
                case 8:
                    // don't annotate octal 0 with 0...
                    prefix += num.startsWith("0") ? "" : "0";
                    break;
                case 16:
                    prefix += "0x";
                    break;
                default:
                    throw new Error("cannot handle base: " + radix);
            }
        }
        // don't add prefix in front of value truncated by precision=0, val=0
        num = num.length === 0 ? num : prefix + num;
        if (upcase) {
            num = num.toUpperCase();
        }
        return this.padNum(num, n < 0);
    }
    /**
   * Format number with code points
   * @param n
   */ fmtNumberCodePoint(n) {
        let s = "";
        try {
            s = String.fromCodePoint(n);
        } catch  {
            s = UNICODE_REPLACEMENT_CHARACTER;
        }
        return this.pad(s);
    }
    /**
   * Format special float
   * @param n
   */ fmtFloatSpecial(n) {
        // formatting of NaN and Inf are pants-on-head
        // stupid and more or less arbitrary.
        if (isNaN(n)) {
            this.flags.zero = false;
            return this.padNum("NaN", false);
        }
        if (n === Number.POSITIVE_INFINITY) {
            this.flags.zero = false;
            this.flags.plus = true;
            return this.padNum("Inf", false);
        }
        if (n === Number.NEGATIVE_INFINITY) {
            this.flags.zero = false;
            return this.padNum("Inf", true);
        }
        return "";
    }
    /**
   * Round fraction to precision
   * @param fractional
   * @param precision
   * @returns tuple of fractional and round
   */ roundFractionToPrecision(fractional, precision) {
        let round = false;
        if (fractional.length > precision) {
            fractional = "1" + fractional; // prepend a 1 in case of leading 0
            let tmp = parseInt(fractional.substr(0, precision + 2)) / 10;
            tmp = Math.round(tmp);
            fractional = Math.floor(tmp).toString();
            round = fractional[0] === "2";
            fractional = fractional.substr(1); // remove extra 1
        } else {
            while(fractional.length < precision){
                fractional += "0";
            }
        }
        return [
            fractional,
            round
        ];
    }
    /**
   * Format float E
   * @param n
   * @param upcase
   */ fmtFloatE(n, upcase = false) {
        const special = this.fmtFloatSpecial(n);
        if (special !== "") {
            return special;
        }
        const m = n.toExponential().match(FLOAT_REGEXP);
        if (!m) {
            throw Error("can't happen, bug");
        }
        let fractional = m[F.fractional];
        const precision = this.flags.precision !== -1 ? this.flags.precision : DEFAULT_PRECISION;
        let rounding = false;
        [fractional, rounding] = this.roundFractionToPrecision(fractional, precision);
        let e = m[F.exponent];
        let esign = m[F.esign];
        // scientific notation output with exponent padded to minlen 2
        let mantissa = parseInt(m[F.mantissa]);
        if (rounding) {
            mantissa += 1;
            if (10 <= mantissa) {
                mantissa = 1;
                const r = parseInt(esign + e) + 1;
                e = r.toString();
                esign = r < 0 ? "-" : "+";
            }
        }
        e = e.length == 1 ? "0" + e : e;
        const val = `${mantissa}.${fractional}${upcase ? "E" : "e"}${esign}${e}`;
        return this.padNum(val, n < 0);
    }
    /**
   * Format float F
   * @param n
   */ fmtFloatF(n) {
        const special = this.fmtFloatSpecial(n);
        if (special !== "") {
            return special;
        }
        // stupid helper that turns a number into a (potentially)
        // VERY long string.
        function expandNumber(n) {
            if (Number.isSafeInteger(n)) {
                return n.toString() + ".";
            }
            const t = n.toExponential().split("e");
            let m = t[0].replace(".", "");
            const e = parseInt(t[1]);
            if (e < 0) {
                let nStr = "0.";
                for(let i = 0; i !== Math.abs(e) - 1; ++i){
                    nStr += "0";
                }
                return nStr += m;
            } else {
                const splIdx = e + 1;
                while(m.length < splIdx){
                    m += "0";
                }
                return m.substr(0, splIdx) + "." + m.substr(splIdx);
            }
        }
        // avoiding sign makes padding easier
        const val = expandNumber(Math.abs(n));
        const arr = val.split(".");
        let dig = arr[0];
        let fractional = arr[1];
        const precision = this.flags.precision !== -1 ? this.flags.precision : DEFAULT_PRECISION;
        let round = false;
        [fractional, round] = this.roundFractionToPrecision(fractional, precision);
        if (round) {
            dig = (parseInt(dig) + 1).toString();
        }
        return this.padNum(`${dig}.${fractional}`, n < 0);
    }
    /**
   * Format float G
   * @param n
   * @param upcase
   */ fmtFloatG(n, upcase = false) {
        const special = this.fmtFloatSpecial(n);
        if (special !== "") {
            return special;
        }
        // The double argument representing a floating-point number shall be
        // converted in the style f or e (or in the style F or E in
        // the case of a G conversion specifier), depending on the
        // value converted and the precision. Let P equal the
        // precision if non-zero, 6 if the precision is omitted, or 1
        // if the precision is zero. Then, if a conversion with style E would
        // have an exponent of X:
        //     - If P > X>=-4, the conversion shall be with style f (or F )
        //     and precision P -( X+1).
        //     - Otherwise, the conversion shall be with style e (or E )
        //     and precision P -1.
        // Finally, unless the '#' flag is used, any trailing zeros shall be
        // removed from the fractional portion of the result and the
        // decimal-point character shall be removed if there is no
        // fractional portion remaining.
        // A double argument representing an infinity or NaN shall be
        // converted in the style of an f or F conversion specifier.
        // https://pubs.opengroup.org/onlinepubs/9699919799/functions/fprintf.html
        let P = this.flags.precision !== -1 ? this.flags.precision : DEFAULT_PRECISION;
        P = P === 0 ? 1 : P;
        const m = n.toExponential().match(FLOAT_REGEXP);
        if (!m) {
            throw Error("can't happen");
        }
        const X = parseInt(m[F.exponent]) * (m[F.esign] === "-" ? -1 : 1);
        let nStr = "";
        if (P > X && X >= -4) {
            this.flags.precision = P - (X + 1);
            nStr = this.fmtFloatF(n);
            if (!this.flags.sharp) {
                nStr = nStr.replace(/\.?0*$/, "");
            }
        } else {
            this.flags.precision = P - 1;
            nStr = this.fmtFloatE(n);
            if (!this.flags.sharp) {
                nStr = nStr.replace(/\.?0*e/, upcase ? "E" : "e");
            }
        }
        return nStr;
    }
    /**
   * Format string
   * @param s
   */ fmtString(s) {
        if (this.flags.precision !== -1) {
            s = s.substr(0, this.flags.precision);
        }
        return this.pad(s);
    }
    /**
   * Format hex
   * @param val
   * @param upper
   */ fmtHex(val, upper = false) {
        // allow others types ?
        switch(typeof val){
            case "number":
                return this.fmtNumber(val, 16, upper);
            case "string":
                {
                    const sharp = this.flags.sharp && val.length !== 0;
                    let hex = sharp ? "0x" : "";
                    const prec = this.flags.precision;
                    const end = prec !== -1 ? min(prec, val.length) : val.length;
                    for(let i = 0; i !== end; ++i){
                        if (i !== 0 && this.flags.space) {
                            hex += sharp ? " 0x" : " ";
                        }
                        // TODO(bartlomieju): for now only taking into account the
                        // lower half of the codePoint, ie. as if a string
                        // is a list of 8bit values instead of UCS2 runes
                        const c = (val.charCodeAt(i) & 0xff).toString(16);
                        hex += c.length === 1 ? `0${c}` : c;
                    }
                    if (upper) {
                        hex = hex.toUpperCase();
                    }
                    return this.pad(hex);
                }
            default:
                throw new Error("currently only number and string are implemented for hex");
        }
    }
    /**
   * Format value
   * @param val
   */ fmtV(val) {
        if (this.flags.sharp) {
            const options = this.flags.precision !== -1 ? {
                depth: this.flags.precision
            } : {};
            return this.pad(Deno.inspect(val, options));
        } else {
            const p = this.flags.precision;
            return p === -1 ? val.toString() : val.toString().substr(0, p);
        }
    }
    /**
   * Format JSON
   * @param val
   */ fmtJ(val) {
        return JSON.stringify(val);
    }
}
/**
 * Converts and format a variable number of `args` as is specified by `format`.
 * `sprintf` returns the formatted string.
 *
 * @param format
 * @param args
 */ export function sprintf(format, ...args) {
    const printf = new Printf(format, ...args);
    return printf.doPrintf();
}
/**
 * Converts and format a variable number of `args` as is specified by `format`.
 * `printf` writes the formatted string to standard output.
 * @param format
 * @param args
 */ export function printf(format, ...args) {
    const s = sprintf(format, ...args);
    Deno.stdout.writeSync(new TextEncoder().encode(s));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEzMi4wL2ZtdC9wcmludGYudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8qKlxuICogVGhpcyBpbXBsZW1lbnRhdGlvbiBpcyBpbnNwaXJlZCBieSBQT1NJWCBhbmQgR29sYW5nIGJ1dCBkb2VzIG5vdCBwb3J0XG4gKiBpbXBsZW1lbnRhdGlvbiBjb2RlLiAqL1xuXG5lbnVtIFN0YXRlIHtcbiAgUEFTU1RIUk9VR0gsXG4gIFBFUkNFTlQsXG4gIFBPU0lUSU9OQUwsXG4gIFBSRUNJU0lPTixcbiAgV0lEVEgsXG59XG5cbmVudW0gV29yUCB7XG4gIFdJRFRILFxuICBQUkVDSVNJT04sXG59XG5cbmNsYXNzIEZsYWdzIHtcbiAgcGx1cz86IGJvb2xlYW47XG4gIGRhc2g/OiBib29sZWFuO1xuICBzaGFycD86IGJvb2xlYW47XG4gIHNwYWNlPzogYm9vbGVhbjtcbiAgemVybz86IGJvb2xlYW47XG4gIGxlc3N0aGFuPzogYm9vbGVhbjtcbiAgd2lkdGggPSAtMTtcbiAgcHJlY2lzaW9uID0gLTE7XG59XG5cbmNvbnN0IG1pbiA9IE1hdGgubWluO1xuY29uc3QgVU5JQ09ERV9SRVBMQUNFTUVOVF9DSEFSQUNURVIgPSBcIlxcdWZmZmRcIjtcbmNvbnN0IERFRkFVTFRfUFJFQ0lTSU9OID0gNjtcbmNvbnN0IEZMT0FUX1JFR0VYUCA9IC8oLT8pKFxcZClcXC4/KFxcZCopZShbKy1dKShcXGQrKS87XG5cbmVudW0gRiB7XG4gIHNpZ24gPSAxLFxuICBtYW50aXNzYSxcbiAgZnJhY3Rpb25hbCxcbiAgZXNpZ24sXG4gIGV4cG9uZW50LFxufVxuXG5jbGFzcyBQcmludGYge1xuICBmb3JtYXQ6IHN0cmluZztcbiAgYXJnczogdW5rbm93bltdO1xuICBpOiBudW1iZXI7XG5cbiAgc3RhdGU6IFN0YXRlID0gU3RhdGUuUEFTU1RIUk9VR0g7XG4gIHZlcmIgPSBcIlwiO1xuICBidWYgPSBcIlwiO1xuICBhcmdOdW0gPSAwO1xuICBmbGFnczogRmxhZ3MgPSBuZXcgRmxhZ3MoKTtcblxuICBoYXZlU2VlbjogYm9vbGVhbltdO1xuXG4gIC8vIGJhcmYsIHN0b3JlIHByZWNpc2lvbiBhbmQgd2lkdGggZXJyb3JzIGZvciBsYXRlciBwcm9jZXNzaW5nIC4uLlxuICB0bXBFcnJvcj86IHN0cmluZztcblxuICBjb25zdHJ1Y3Rvcihmb3JtYXQ6IHN0cmluZywgLi4uYXJnczogdW5rbm93bltdKSB7XG4gICAgdGhpcy5mb3JtYXQgPSBmb3JtYXQ7XG4gICAgdGhpcy5hcmdzID0gYXJncztcbiAgICB0aGlzLmhhdmVTZWVuID0gQXJyYXkuZnJvbSh7IGxlbmd0aDogYXJncy5sZW5ndGggfSk7XG4gICAgdGhpcy5pID0gMDtcbiAgfVxuXG4gIGRvUHJpbnRmKCk6IHN0cmluZyB7XG4gICAgZm9yICg7IHRoaXMuaSA8IHRoaXMuZm9ybWF0Lmxlbmd0aDsgKyt0aGlzLmkpIHtcbiAgICAgIGNvbnN0IGMgPSB0aGlzLmZvcm1hdFt0aGlzLmldO1xuICAgICAgc3dpdGNoICh0aGlzLnN0YXRlKSB7XG4gICAgICAgIGNhc2UgU3RhdGUuUEFTU1RIUk9VR0g6XG4gICAgICAgICAgaWYgKGMgPT09IFwiJVwiKSB7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEVSQ0VOVDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5idWYgKz0gYztcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgU3RhdGUuUEVSQ0VOVDpcbiAgICAgICAgICBpZiAoYyA9PT0gXCIlXCIpIHtcbiAgICAgICAgICAgIHRoaXMuYnVmICs9IGM7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEFTU1RIUk9VR0g7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlRm9ybWF0KCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IEVycm9yKFwiU2hvdWxkIGJlIHVucmVhY2hhYmxlLCBjZXJ0YWlubHkgYSBidWcgaW4gdGhlIGxpYi5cIik7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGNoZWNrIGZvciB1bmhhbmRsZWQgYXJnc1xuICAgIGxldCBleHRyYXMgPSBmYWxzZTtcbiAgICBsZXQgZXJyID0gXCIlIShFWFRSQVwiO1xuICAgIGZvciAobGV0IGkgPSAwOyBpICE9PSB0aGlzLmhhdmVTZWVuLmxlbmd0aDsgKytpKSB7XG4gICAgICBpZiAoIXRoaXMuaGF2ZVNlZW5baV0pIHtcbiAgICAgICAgZXh0cmFzID0gdHJ1ZTtcbiAgICAgICAgZXJyICs9IGAgJyR7RGVuby5pbnNwZWN0KHRoaXMuYXJnc1tpXSl9J2A7XG4gICAgICB9XG4gICAgfVxuICAgIGVyciArPSBcIilcIjtcbiAgICBpZiAoZXh0cmFzKSB7XG4gICAgICB0aGlzLmJ1ZiArPSBlcnI7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmJ1ZjtcbiAgfVxuXG4gIC8vICVbPHBvc2l0aW9uYWw+XTxmbGFnPi4uLjx2ZXJiPlxuICBoYW5kbGVGb3JtYXQoKTogdm9pZCB7XG4gICAgdGhpcy5mbGFncyA9IG5ldyBGbGFncygpO1xuICAgIGNvbnN0IGZsYWdzID0gdGhpcy5mbGFncztcbiAgICBmb3IgKDsgdGhpcy5pIDwgdGhpcy5mb3JtYXQubGVuZ3RoOyArK3RoaXMuaSkge1xuICAgICAgY29uc3QgYyA9IHRoaXMuZm9ybWF0W3RoaXMuaV07XG4gICAgICBzd2l0Y2ggKHRoaXMuc3RhdGUpIHtcbiAgICAgICAgY2FzZSBTdGF0ZS5QRVJDRU5UOlxuICAgICAgICAgIHN3aXRjaCAoYykge1xuICAgICAgICAgICAgY2FzZSBcIltcIjpcbiAgICAgICAgICAgICAgdGhpcy5oYW5kbGVQb3NpdGlvbmFsKCk7XG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QT1NJVElPTkFMO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCIrXCI6XG4gICAgICAgICAgICAgIGZsYWdzLnBsdXMgPSB0cnVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCI8XCI6XG4gICAgICAgICAgICAgIGZsYWdzLmxlc3N0aGFuID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiLVwiOlxuICAgICAgICAgICAgICBmbGFncy5kYXNoID0gdHJ1ZTtcbiAgICAgICAgICAgICAgZmxhZ3MuemVybyA9IGZhbHNlOyAvLyBvbmx5IGxlZnQgcGFkIHplcm9zLCBkYXNoIHRha2VzIHByZWNlZGVuY2VcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiI1wiOlxuICAgICAgICAgICAgICBmbGFncy5zaGFycCA9IHRydWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIiBcIjpcbiAgICAgICAgICAgICAgZmxhZ3Muc3BhY2UgPSB0cnVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCIwXCI6XG4gICAgICAgICAgICAgIC8vIG9ubHkgbGVmdCBwYWQgemVyb3MsIGRhc2ggdGFrZXMgcHJlY2VkZW5jZVxuICAgICAgICAgICAgICBmbGFncy56ZXJvID0gIWZsYWdzLmRhc2g7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgaWYgKChcIjFcIiA8PSBjICYmIGMgPD0gXCI5XCIpIHx8IGMgPT09IFwiLlwiIHx8IGMgPT09IFwiKlwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKGMgPT09IFwiLlwiKSB7XG4gICAgICAgICAgICAgICAgICB0aGlzLmZsYWdzLnByZWNpc2lvbiA9IDA7XG4gICAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUFJFQ0lTSU9OO1xuICAgICAgICAgICAgICAgICAgdGhpcy5pKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XSURUSDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVXaWR0aEFuZFByZWNpc2lvbihmbGFncyk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVWZXJiKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuOyAvLyBhbHdheXMgZW5kIGluIHZlcmJcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIH0gLy8gc3dpdGNoIGNcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBTdGF0ZS5QT1NJVElPTkFMOlxuICAgICAgICAgIC8vIFRPRE8oYmFydGxvbWllanUpOiBlaXRoZXIgYSB2ZXJiIG9yICogb25seSB2ZXJiIGZvciBub3dcbiAgICAgICAgICBpZiAoYyA9PT0gXCIqXCIpIHtcbiAgICAgICAgICAgIGNvbnN0IHdvcnAgPSB0aGlzLmZsYWdzLnByZWNpc2lvbiA9PT0gLTFcbiAgICAgICAgICAgICAgPyBXb3JQLldJRFRIXG4gICAgICAgICAgICAgIDogV29yUC5QUkVDSVNJT047XG4gICAgICAgICAgICB0aGlzLmhhbmRsZVdpZHRoT3JQcmVjaXNpb25SZWYod29ycCk7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEVSQ0VOVDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZVZlcmIoKTtcbiAgICAgICAgICAgIHJldHVybjsgLy8gYWx3YXlzIGVuZCBpbiB2ZXJiXG4gICAgICAgICAgfVxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU2hvdWxkIG5vdCBiZSBoZXJlICR7dGhpcy5zdGF0ZX0sIGxpYnJhcnkgYnVnIWApO1xuICAgICAgfSAvLyBzd2l0Y2ggc3RhdGVcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIHdpZHRoIG9yIHByZWNpc2lvblxuICAgKiBAcGFyYW0gd09yUFxuICAgKi9cbiAgaGFuZGxlV2lkdGhPclByZWNpc2lvblJlZih3T3JQOiBXb3JQKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuYXJnTnVtID49IHRoaXMuYXJncy5sZW5ndGgpIHtcbiAgICAgIC8vIGhhbmRsZSBQb3NpdGlvbmFsIHNob3VsZCBoYXZlIGFscmVhZHkgdGFrZW4gY2FyZSBvZiBpdC4uLlxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBhcmcgPSB0aGlzLmFyZ3NbdGhpcy5hcmdOdW1dO1xuICAgIHRoaXMuaGF2ZVNlZW5bdGhpcy5hcmdOdW1dID0gdHJ1ZTtcbiAgICBpZiAodHlwZW9mIGFyZyA9PT0gXCJudW1iZXJcIikge1xuICAgICAgc3dpdGNoICh3T3JQKSB7XG4gICAgICAgIGNhc2UgV29yUC5XSURUSDpcbiAgICAgICAgICB0aGlzLmZsYWdzLndpZHRoID0gYXJnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRoaXMuZmxhZ3MucHJlY2lzaW9uID0gYXJnO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0bXAgPSB3T3JQID09PSBXb3JQLldJRFRIID8gXCJXSURUSFwiIDogXCJQUkVDXCI7XG4gICAgICB0aGlzLnRtcEVycm9yID0gYCUhKEJBRCAke3RtcH0gJyR7dGhpcy5hcmdzW3RoaXMuYXJnTnVtXX0nKWA7XG4gICAgfVxuICAgIHRoaXMuYXJnTnVtKys7XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlIHdpZHRoIGFuZCBwcmVjaXNpb25cbiAgICogQHBhcmFtIGZsYWdzXG4gICAqL1xuICBoYW5kbGVXaWR0aEFuZFByZWNpc2lvbihmbGFnczogRmxhZ3MpOiB2b2lkIHtcbiAgICBjb25zdCBmbXQgPSB0aGlzLmZvcm1hdDtcbiAgICBmb3IgKDsgdGhpcy5pICE9PSB0aGlzLmZvcm1hdC5sZW5ndGg7ICsrdGhpcy5pKSB7XG4gICAgICBjb25zdCBjID0gZm10W3RoaXMuaV07XG4gICAgICBzd2l0Y2ggKHRoaXMuc3RhdGUpIHtcbiAgICAgICAgY2FzZSBTdGF0ZS5XSURUSDpcbiAgICAgICAgICBzd2l0Y2ggKGMpIHtcbiAgICAgICAgICAgIGNhc2UgXCIuXCI6XG4gICAgICAgICAgICAgIC8vIGluaXRpYWxpemUgcHJlY2lzaW9uLCAlOS5mIC0+IHByZWNpc2lvbj0wXG4gICAgICAgICAgICAgIHRoaXMuZmxhZ3MucHJlY2lzaW9uID0gMDtcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBSRUNJU0lPTjtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiKlwiOlxuICAgICAgICAgICAgICB0aGlzLmhhbmRsZVdpZHRoT3JQcmVjaXNpb25SZWYoV29yUC5XSURUSCk7XG4gICAgICAgICAgICAgIC8vIGZvcmNlIC4gb3IgZmxhZyBhdCB0aGlzIHBvaW50XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgICBjb25zdCB2YWwgPSBwYXJzZUludChjKTtcbiAgICAgICAgICAgICAgLy8gbW9zdCBsaWtlbHkgcGFyc2VJbnQgZG9lcyBzb21ldGhpbmcgc3R1cGlkIHRoYXQgbWFrZXNcbiAgICAgICAgICAgICAgLy8gaXQgdW51c2FibGUgZm9yIHRoaXMgc2NlbmFyaW8gLi4uXG4gICAgICAgICAgICAgIC8vIGlmIHdlIGVuY291bnRlciBhIG5vbiAobnVtYmVyfCp8Likgd2UncmUgZG9uZSB3aXRoIHByZWMgJiB3aWRcbiAgICAgICAgICAgICAgaWYgKGlzTmFOKHZhbCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmktLTtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEVSQ0VOVDtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZmxhZ3Mud2lkdGggPSBmbGFncy53aWR0aCA9PSAtMSA/IDAgOiBmbGFncy53aWR0aDtcbiAgICAgICAgICAgICAgZmxhZ3Mud2lkdGggKj0gMTA7XG4gICAgICAgICAgICAgIGZsYWdzLndpZHRoICs9IHZhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IC8vIHN3aXRjaCBjXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgU3RhdGUuUFJFQ0lTSU9OOiB7XG4gICAgICAgICAgaWYgKGMgPT09IFwiKlwiKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZVdpZHRoT3JQcmVjaXNpb25SZWYoV29yUC5QUkVDSVNJT04pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHZhbCA9IHBhcnNlSW50KGMpO1xuICAgICAgICAgIGlmIChpc05hTih2YWwpKSB7XG4gICAgICAgICAgICAvLyBvbmUgdG9vIGZhciwgcmV3aW5kXG4gICAgICAgICAgICB0aGlzLmktLTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QRVJDRU5UO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmbGFncy5wcmVjaXNpb24gKj0gMTA7XG4gICAgICAgICAgZmxhZ3MucHJlY2lzaW9uICs9IHZhbDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhbid0IGJlIGhlcmUuIGJ1Zy5cIik7XG4gICAgICB9IC8vIHN3aXRjaCBzdGF0ZVxuICAgIH1cbiAgfVxuXG4gIC8qKiBIYW5kbGUgcG9zaXRpb25hbCAqL1xuICBoYW5kbGVQb3NpdGlvbmFsKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmZvcm1hdFt0aGlzLmldICE9PSBcIltcIikge1xuICAgICAgLy8gc2FuaXR5IG9ubHlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IGhhcHBlbj8gQnVnLlwiKTtcbiAgICB9XG4gICAgbGV0IHBvc2l0aW9uYWwgPSAwO1xuICAgIGNvbnN0IGZvcm1hdCA9IHRoaXMuZm9ybWF0O1xuICAgIHRoaXMuaSsrO1xuICAgIGxldCBlcnIgPSBmYWxzZTtcbiAgICBmb3IgKDsgdGhpcy5pICE9PSB0aGlzLmZvcm1hdC5sZW5ndGg7ICsrdGhpcy5pKSB7XG4gICAgICBpZiAoZm9ybWF0W3RoaXMuaV0gPT09IFwiXVwiKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgcG9zaXRpb25hbCAqPSAxMDtcbiAgICAgIGNvbnN0IHZhbCA9IHBhcnNlSW50KGZvcm1hdFt0aGlzLmldKTtcbiAgICAgIGlmIChpc05hTih2YWwpKSB7XG4gICAgICAgIC8vdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAvLyAgYGludmFsaWQgY2hhcmFjdGVyIGluIHBvc2l0aW9uYWw6ICR7Zm9ybWF0fVske2Zvcm1hdFt0aGlzLmldfV1gXG4gICAgICAgIC8vKTtcbiAgICAgICAgdGhpcy50bXBFcnJvciA9IFwiJSEoQkFEIElOREVYKVwiO1xuICAgICAgICBlcnIgPSB0cnVlO1xuICAgICAgfVxuICAgICAgcG9zaXRpb25hbCArPSB2YWw7XG4gICAgfVxuICAgIGlmIChwb3NpdGlvbmFsIC0gMSA+PSB0aGlzLmFyZ3MubGVuZ3RoKSB7XG4gICAgICB0aGlzLnRtcEVycm9yID0gXCIlIShCQUQgSU5ERVgpXCI7XG4gICAgICBlcnIgPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLmFyZ051bSA9IGVyciA/IHRoaXMuYXJnTnVtIDogcG9zaXRpb25hbCAtIDE7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLyoqIEhhbmRsZSBsZXNzIHRoYW4gKi9cbiAgaGFuZGxlTGVzc1RoYW4oKTogc3RyaW5nIHtcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIGNvbnN0IGFyZyA9IHRoaXMuYXJnc1t0aGlzLmFyZ051bV0gYXMgYW55O1xuICAgIGlmICgoYXJnIHx8IHt9KS5jb25zdHJ1Y3Rvci5uYW1lICE9PSBcIkFycmF5XCIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXJnICR7YXJnfSBpcyBub3QgYW4gYXJyYXkuIFRvZG8gYmV0dGVyIGVycm9yIGhhbmRsaW5nYCk7XG4gICAgfVxuICAgIGxldCBzdHIgPSBcIlsgXCI7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgIT09IGFyZy5sZW5ndGg7ICsraSkge1xuICAgICAgaWYgKGkgIT09IDApIHN0ciArPSBcIiwgXCI7XG4gICAgICBzdHIgKz0gdGhpcy5faGFuZGxlVmVyYihhcmdbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gc3RyICsgXCIgXVwiO1xuICB9XG5cbiAgLyoqIEhhbmRsZSB2ZXJiICovXG4gIGhhbmRsZVZlcmIoKTogdm9pZCB7XG4gICAgY29uc3QgdmVyYiA9IHRoaXMuZm9ybWF0W3RoaXMuaV07XG4gICAgdGhpcy52ZXJiID0gdmVyYjtcbiAgICBpZiAodGhpcy50bXBFcnJvcikge1xuICAgICAgdGhpcy5idWYgKz0gdGhpcy50bXBFcnJvcjtcbiAgICAgIHRoaXMudG1wRXJyb3IgPSB1bmRlZmluZWQ7XG4gICAgICBpZiAodGhpcy5hcmdOdW0gPCB0aGlzLmhhdmVTZWVuLmxlbmd0aCkge1xuICAgICAgICB0aGlzLmhhdmVTZWVuW3RoaXMuYXJnTnVtXSA9IHRydWU7IC8vIGtlZXAgdHJhY2sgb2YgdXNlZCBhcmdzXG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0aGlzLmFyZ3MubGVuZ3RoIDw9IHRoaXMuYXJnTnVtKSB7XG4gICAgICB0aGlzLmJ1ZiArPSBgJSEoTUlTU0lORyAnJHt2ZXJifScpYDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgYXJnID0gdGhpcy5hcmdzW3RoaXMuYXJnTnVtXTsgLy8gY2hlY2sgb3V0IG9mIHJhbmdlXG4gICAgICB0aGlzLmhhdmVTZWVuW3RoaXMuYXJnTnVtXSA9IHRydWU7IC8vIGtlZXAgdHJhY2sgb2YgdXNlZCBhcmdzXG4gICAgICBpZiAodGhpcy5mbGFncy5sZXNzdGhhbikge1xuICAgICAgICB0aGlzLmJ1ZiArPSB0aGlzLmhhbmRsZUxlc3NUaGFuKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmJ1ZiArPSB0aGlzLl9oYW5kbGVWZXJiKGFyZyk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuYXJnTnVtKys7IC8vIGlmIHRoZXJlIGlzIGEgZnVydGhlciBwb3NpdGlvbmFsLCBpdCB3aWxsIHJlc2V0LlxuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVNTVEhST1VHSDtcbiAgfVxuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIF9oYW5kbGVWZXJiKGFyZzogYW55KTogc3RyaW5nIHtcbiAgICBzd2l0Y2ggKHRoaXMudmVyYikge1xuICAgICAgY2FzZSBcInRcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMucGFkKGFyZy50b1N0cmluZygpKTtcbiAgICAgIGNhc2UgXCJiXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdE51bWJlcihhcmcgYXMgbnVtYmVyLCAyKTtcbiAgICAgIGNhc2UgXCJjXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdE51bWJlckNvZGVQb2ludChhcmcgYXMgbnVtYmVyKTtcbiAgICAgIGNhc2UgXCJkXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdE51bWJlcihhcmcgYXMgbnVtYmVyLCAxMCk7XG4gICAgICBjYXNlIFwib1wiOlxuICAgICAgICByZXR1cm4gdGhpcy5mbXROdW1iZXIoYXJnIGFzIG51bWJlciwgOCk7XG4gICAgICBjYXNlIFwieFwiOlxuICAgICAgICByZXR1cm4gdGhpcy5mbXRIZXgoYXJnKTtcbiAgICAgIGNhc2UgXCJYXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdEhleChhcmcsIHRydWUpO1xuICAgICAgY2FzZSBcImVcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10RmxvYXRFKGFyZyBhcyBudW1iZXIpO1xuICAgICAgY2FzZSBcIkVcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10RmxvYXRFKGFyZyBhcyBudW1iZXIsIHRydWUpO1xuICAgICAgY2FzZSBcImZcIjpcbiAgICAgIGNhc2UgXCJGXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdEZsb2F0RihhcmcgYXMgbnVtYmVyKTtcbiAgICAgIGNhc2UgXCJnXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdEZsb2F0RyhhcmcgYXMgbnVtYmVyKTtcbiAgICAgIGNhc2UgXCJHXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdEZsb2F0RyhhcmcgYXMgbnVtYmVyLCB0cnVlKTtcbiAgICAgIGNhc2UgXCJzXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdFN0cmluZyhhcmcgYXMgc3RyaW5nKTtcbiAgICAgIGNhc2UgXCJUXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdFN0cmluZyh0eXBlb2YgYXJnKTtcbiAgICAgIGNhc2UgXCJ2XCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdFYoYXJnKTtcbiAgICAgIGNhc2UgXCJqXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdEooYXJnKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBgJSEoQkFEIFZFUkIgJyR7dGhpcy52ZXJifScpYDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUGFkIGEgc3RyaW5nXG4gICAqIEBwYXJhbSBzIHRleHQgdG8gcGFkXG4gICAqL1xuICBwYWQoczogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBwYWRkaW5nID0gdGhpcy5mbGFncy56ZXJvID8gXCIwXCIgOiBcIiBcIjtcblxuICAgIGlmICh0aGlzLmZsYWdzLmRhc2gpIHtcbiAgICAgIHJldHVybiBzLnBhZEVuZCh0aGlzLmZsYWdzLndpZHRoLCBwYWRkaW5nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcy5wYWRTdGFydCh0aGlzLmZsYWdzLndpZHRoLCBwYWRkaW5nKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYWQgYSBudW1iZXJcbiAgICogQHBhcmFtIG5TdHJcbiAgICogQHBhcmFtIG5lZ1xuICAgKi9cbiAgcGFkTnVtKG5TdHI6IHN0cmluZywgbmVnOiBib29sZWFuKTogc3RyaW5nIHtcbiAgICBsZXQgc2lnbjogc3RyaW5nO1xuICAgIGlmIChuZWcpIHtcbiAgICAgIHNpZ24gPSBcIi1cIjtcbiAgICB9IGVsc2UgaWYgKHRoaXMuZmxhZ3MucGx1cyB8fCB0aGlzLmZsYWdzLnNwYWNlKSB7XG4gICAgICBzaWduID0gdGhpcy5mbGFncy5wbHVzID8gXCIrXCIgOiBcIiBcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgc2lnbiA9IFwiXCI7XG4gICAgfVxuICAgIGNvbnN0IHplcm8gPSB0aGlzLmZsYWdzLnplcm87XG4gICAgaWYgKCF6ZXJvKSB7XG4gICAgICAvLyBzaWduIGNvbWVzIGluIGZyb250IG9mIHBhZGRpbmcgd2hlbiBwYWRkaW5nIHcvIHplcm8sXG4gICAgICAvLyBpbiBmcm9tIG9mIHZhbHVlIGlmIHBhZGRpbmcgd2l0aCBzcGFjZXMuXG4gICAgICBuU3RyID0gc2lnbiArIG5TdHI7XG4gICAgfVxuXG4gICAgY29uc3QgcGFkID0gemVybyA/IFwiMFwiIDogXCIgXCI7XG4gICAgY29uc3QgbGVuID0gemVybyA/IHRoaXMuZmxhZ3Mud2lkdGggLSBzaWduLmxlbmd0aCA6IHRoaXMuZmxhZ3Mud2lkdGg7XG5cbiAgICBpZiAodGhpcy5mbGFncy5kYXNoKSB7XG4gICAgICBuU3RyID0gblN0ci5wYWRFbmQobGVuLCBwYWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBuU3RyID0gblN0ci5wYWRTdGFydChsZW4sIHBhZCk7XG4gICAgfVxuXG4gICAgaWYgKHplcm8pIHtcbiAgICAgIC8vIHNlZSBhYm92ZVxuICAgICAgblN0ciA9IHNpZ24gKyBuU3RyO1xuICAgIH1cbiAgICByZXR1cm4gblN0cjtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtYXQgYSBudW1iZXJcbiAgICogQHBhcmFtIG5cbiAgICogQHBhcmFtIHJhZGl4XG4gICAqIEBwYXJhbSB1cGNhc2VcbiAgICovXG4gIGZtdE51bWJlcihuOiBudW1iZXIsIHJhZGl4OiBudW1iZXIsIHVwY2FzZSA9IGZhbHNlKTogc3RyaW5nIHtcbiAgICBsZXQgbnVtID0gTWF0aC5hYnMobikudG9TdHJpbmcocmFkaXgpO1xuICAgIGNvbnN0IHByZWMgPSB0aGlzLmZsYWdzLnByZWNpc2lvbjtcbiAgICBpZiAocHJlYyAhPT0gLTEpIHtcbiAgICAgIHRoaXMuZmxhZ3MuemVybyA9IGZhbHNlO1xuICAgICAgbnVtID0gbiA9PT0gMCAmJiBwcmVjID09PSAwID8gXCJcIiA6IG51bTtcbiAgICAgIHdoaWxlIChudW0ubGVuZ3RoIDwgcHJlYykge1xuICAgICAgICBudW0gPSBcIjBcIiArIG51bTtcbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IHByZWZpeCA9IFwiXCI7XG4gICAgaWYgKHRoaXMuZmxhZ3Muc2hhcnApIHtcbiAgICAgIHN3aXRjaCAocmFkaXgpIHtcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIHByZWZpeCArPSBcIjBiXCI7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgODpcbiAgICAgICAgICAvLyBkb24ndCBhbm5vdGF0ZSBvY3RhbCAwIHdpdGggMC4uLlxuICAgICAgICAgIHByZWZpeCArPSBudW0uc3RhcnRzV2l0aChcIjBcIikgPyBcIlwiIDogXCIwXCI7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTY6XG4gICAgICAgICAgcHJlZml4ICs9IFwiMHhcIjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjYW5ub3QgaGFuZGxlIGJhc2U6IFwiICsgcmFkaXgpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBkb24ndCBhZGQgcHJlZml4IGluIGZyb250IG9mIHZhbHVlIHRydW5jYXRlZCBieSBwcmVjaXNpb249MCwgdmFsPTBcbiAgICBudW0gPSBudW0ubGVuZ3RoID09PSAwID8gbnVtIDogcHJlZml4ICsgbnVtO1xuICAgIGlmICh1cGNhc2UpIHtcbiAgICAgIG51bSA9IG51bS50b1VwcGVyQ2FzZSgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wYWROdW0obnVtLCBuIDwgMCk7XG4gIH1cblxuICAvKipcbiAgICogRm9ybWF0IG51bWJlciB3aXRoIGNvZGUgcG9pbnRzXG4gICAqIEBwYXJhbSBuXG4gICAqL1xuICBmbXROdW1iZXJDb2RlUG9pbnQobjogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBsZXQgcyA9IFwiXCI7XG4gICAgdHJ5IHtcbiAgICAgIHMgPSBTdHJpbmcuZnJvbUNvZGVQb2ludChuKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHMgPSBVTklDT0RFX1JFUExBQ0VNRU5UX0NIQVJBQ1RFUjtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucGFkKHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCBzcGVjaWFsIGZsb2F0XG4gICAqIEBwYXJhbSBuXG4gICAqL1xuICBmbXRGbG9hdFNwZWNpYWwobjogbnVtYmVyKTogc3RyaW5nIHtcbiAgICAvLyBmb3JtYXR0aW5nIG9mIE5hTiBhbmQgSW5mIGFyZSBwYW50cy1vbi1oZWFkXG4gICAgLy8gc3R1cGlkIGFuZCBtb3JlIG9yIGxlc3MgYXJiaXRyYXJ5LlxuXG4gICAgaWYgKGlzTmFOKG4pKSB7XG4gICAgICB0aGlzLmZsYWdzLnplcm8gPSBmYWxzZTtcbiAgICAgIHJldHVybiB0aGlzLnBhZE51bShcIk5hTlwiLCBmYWxzZSk7XG4gICAgfVxuICAgIGlmIChuID09PSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkpIHtcbiAgICAgIHRoaXMuZmxhZ3MuemVybyA9IGZhbHNlO1xuICAgICAgdGhpcy5mbGFncy5wbHVzID0gdHJ1ZTtcbiAgICAgIHJldHVybiB0aGlzLnBhZE51bShcIkluZlwiLCBmYWxzZSk7XG4gICAgfVxuICAgIGlmIChuID09PSBOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFkpIHtcbiAgICAgIHRoaXMuZmxhZ3MuemVybyA9IGZhbHNlO1xuICAgICAgcmV0dXJuIHRoaXMucGFkTnVtKFwiSW5mXCIsIHRydWUpO1xuICAgIH1cbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuXG4gIC8qKlxuICAgKiBSb3VuZCBmcmFjdGlvbiB0byBwcmVjaXNpb25cbiAgICogQHBhcmFtIGZyYWN0aW9uYWxcbiAgICogQHBhcmFtIHByZWNpc2lvblxuICAgKiBAcmV0dXJucyB0dXBsZSBvZiBmcmFjdGlvbmFsIGFuZCByb3VuZFxuICAgKi9cbiAgcm91bmRGcmFjdGlvblRvUHJlY2lzaW9uKFxuICAgIGZyYWN0aW9uYWw6IHN0cmluZyxcbiAgICBwcmVjaXNpb246IG51bWJlcixcbiAgKTogW3N0cmluZywgYm9vbGVhbl0ge1xuICAgIGxldCByb3VuZCA9IGZhbHNlO1xuICAgIGlmIChmcmFjdGlvbmFsLmxlbmd0aCA+IHByZWNpc2lvbikge1xuICAgICAgZnJhY3Rpb25hbCA9IFwiMVwiICsgZnJhY3Rpb25hbDsgLy8gcHJlcGVuZCBhIDEgaW4gY2FzZSBvZiBsZWFkaW5nIDBcbiAgICAgIGxldCB0bXAgPSBwYXJzZUludChmcmFjdGlvbmFsLnN1YnN0cigwLCBwcmVjaXNpb24gKyAyKSkgLyAxMDtcbiAgICAgIHRtcCA9IE1hdGgucm91bmQodG1wKTtcbiAgICAgIGZyYWN0aW9uYWwgPSBNYXRoLmZsb29yKHRtcCkudG9TdHJpbmcoKTtcbiAgICAgIHJvdW5kID0gZnJhY3Rpb25hbFswXSA9PT0gXCIyXCI7XG4gICAgICBmcmFjdGlvbmFsID0gZnJhY3Rpb25hbC5zdWJzdHIoMSk7IC8vIHJlbW92ZSBleHRyYSAxXG4gICAgfSBlbHNlIHtcbiAgICAgIHdoaWxlIChmcmFjdGlvbmFsLmxlbmd0aCA8IHByZWNpc2lvbikge1xuICAgICAgICBmcmFjdGlvbmFsICs9IFwiMFwiO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gW2ZyYWN0aW9uYWwsIHJvdW5kXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtYXQgZmxvYXQgRVxuICAgKiBAcGFyYW0gblxuICAgKiBAcGFyYW0gdXBjYXNlXG4gICAqL1xuICBmbXRGbG9hdEUobjogbnVtYmVyLCB1cGNhc2UgPSBmYWxzZSk6IHN0cmluZyB7XG4gICAgY29uc3Qgc3BlY2lhbCA9IHRoaXMuZm10RmxvYXRTcGVjaWFsKG4pO1xuICAgIGlmIChzcGVjaWFsICE9PSBcIlwiKSB7XG4gICAgICByZXR1cm4gc3BlY2lhbDtcbiAgICB9XG5cbiAgICBjb25zdCBtID0gbi50b0V4cG9uZW50aWFsKCkubWF0Y2goRkxPQVRfUkVHRVhQKTtcbiAgICBpZiAoIW0pIHtcbiAgICAgIHRocm93IEVycm9yKFwiY2FuJ3QgaGFwcGVuLCBidWdcIik7XG4gICAgfVxuICAgIGxldCBmcmFjdGlvbmFsID0gbVtGLmZyYWN0aW9uYWxdO1xuICAgIGNvbnN0IHByZWNpc2lvbiA9IHRoaXMuZmxhZ3MucHJlY2lzaW9uICE9PSAtMVxuICAgICAgPyB0aGlzLmZsYWdzLnByZWNpc2lvblxuICAgICAgOiBERUZBVUxUX1BSRUNJU0lPTjtcbiAgICBsZXQgcm91bmRpbmcgPSBmYWxzZTtcbiAgICBbZnJhY3Rpb25hbCwgcm91bmRpbmddID0gdGhpcy5yb3VuZEZyYWN0aW9uVG9QcmVjaXNpb24oXG4gICAgICBmcmFjdGlvbmFsLFxuICAgICAgcHJlY2lzaW9uLFxuICAgICk7XG5cbiAgICBsZXQgZSA9IG1bRi5leHBvbmVudF07XG4gICAgbGV0IGVzaWduID0gbVtGLmVzaWduXTtcbiAgICAvLyBzY2llbnRpZmljIG5vdGF0aW9uIG91dHB1dCB3aXRoIGV4cG9uZW50IHBhZGRlZCB0byBtaW5sZW4gMlxuICAgIGxldCBtYW50aXNzYSA9IHBhcnNlSW50KG1bRi5tYW50aXNzYV0pO1xuICAgIGlmIChyb3VuZGluZykge1xuICAgICAgbWFudGlzc2EgKz0gMTtcbiAgICAgIGlmICgxMCA8PSBtYW50aXNzYSkge1xuICAgICAgICBtYW50aXNzYSA9IDE7XG4gICAgICAgIGNvbnN0IHIgPSBwYXJzZUludChlc2lnbiArIGUpICsgMTtcbiAgICAgICAgZSA9IHIudG9TdHJpbmcoKTtcbiAgICAgICAgZXNpZ24gPSByIDwgMCA/IFwiLVwiIDogXCIrXCI7XG4gICAgICB9XG4gICAgfVxuICAgIGUgPSBlLmxlbmd0aCA9PSAxID8gXCIwXCIgKyBlIDogZTtcbiAgICBjb25zdCB2YWwgPSBgJHttYW50aXNzYX0uJHtmcmFjdGlvbmFsfSR7dXBjYXNlID8gXCJFXCIgOiBcImVcIn0ke2VzaWdufSR7ZX1gO1xuICAgIHJldHVybiB0aGlzLnBhZE51bSh2YWwsIG4gPCAwKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtYXQgZmxvYXQgRlxuICAgKiBAcGFyYW0gblxuICAgKi9cbiAgZm10RmxvYXRGKG46IG51bWJlcik6IHN0cmluZyB7XG4gICAgY29uc3Qgc3BlY2lhbCA9IHRoaXMuZm10RmxvYXRTcGVjaWFsKG4pO1xuICAgIGlmIChzcGVjaWFsICE9PSBcIlwiKSB7XG4gICAgICByZXR1cm4gc3BlY2lhbDtcbiAgICB9XG5cbiAgICAvLyBzdHVwaWQgaGVscGVyIHRoYXQgdHVybnMgYSBudW1iZXIgaW50byBhIChwb3RlbnRpYWxseSlcbiAgICAvLyBWRVJZIGxvbmcgc3RyaW5nLlxuICAgIGZ1bmN0aW9uIGV4cGFuZE51bWJlcihuOiBudW1iZXIpOiBzdHJpbmcge1xuICAgICAgaWYgKE51bWJlci5pc1NhZmVJbnRlZ2VyKG4pKSB7XG4gICAgICAgIHJldHVybiBuLnRvU3RyaW5nKCkgKyBcIi5cIjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdCA9IG4udG9FeHBvbmVudGlhbCgpLnNwbGl0KFwiZVwiKTtcbiAgICAgIGxldCBtID0gdFswXS5yZXBsYWNlKFwiLlwiLCBcIlwiKTtcbiAgICAgIGNvbnN0IGUgPSBwYXJzZUludCh0WzFdKTtcbiAgICAgIGlmIChlIDwgMCkge1xuICAgICAgICBsZXQgblN0ciA9IFwiMC5cIjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgIT09IE1hdGguYWJzKGUpIC0gMTsgKytpKSB7XG4gICAgICAgICAgblN0ciArPSBcIjBcIjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKG5TdHIgKz0gbSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBzcGxJZHggPSBlICsgMTtcbiAgICAgICAgd2hpbGUgKG0ubGVuZ3RoIDwgc3BsSWR4KSB7XG4gICAgICAgICAgbSArPSBcIjBcIjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbS5zdWJzdHIoMCwgc3BsSWR4KSArIFwiLlwiICsgbS5zdWJzdHIoc3BsSWR4KTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gYXZvaWRpbmcgc2lnbiBtYWtlcyBwYWRkaW5nIGVhc2llclxuICAgIGNvbnN0IHZhbCA9IGV4cGFuZE51bWJlcihNYXRoLmFicyhuKSkgYXMgc3RyaW5nO1xuICAgIGNvbnN0IGFyciA9IHZhbC5zcGxpdChcIi5cIik7XG4gICAgbGV0IGRpZyA9IGFyclswXTtcbiAgICBsZXQgZnJhY3Rpb25hbCA9IGFyclsxXTtcblxuICAgIGNvbnN0IHByZWNpc2lvbiA9IHRoaXMuZmxhZ3MucHJlY2lzaW9uICE9PSAtMVxuICAgICAgPyB0aGlzLmZsYWdzLnByZWNpc2lvblxuICAgICAgOiBERUZBVUxUX1BSRUNJU0lPTjtcbiAgICBsZXQgcm91bmQgPSBmYWxzZTtcbiAgICBbZnJhY3Rpb25hbCwgcm91bmRdID0gdGhpcy5yb3VuZEZyYWN0aW9uVG9QcmVjaXNpb24oZnJhY3Rpb25hbCwgcHJlY2lzaW9uKTtcbiAgICBpZiAocm91bmQpIHtcbiAgICAgIGRpZyA9IChwYXJzZUludChkaWcpICsgMSkudG9TdHJpbmcoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucGFkTnVtKGAke2RpZ30uJHtmcmFjdGlvbmFsfWAsIG4gPCAwKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtYXQgZmxvYXQgR1xuICAgKiBAcGFyYW0gblxuICAgKiBAcGFyYW0gdXBjYXNlXG4gICAqL1xuICBmbXRGbG9hdEcobjogbnVtYmVyLCB1cGNhc2UgPSBmYWxzZSk6IHN0cmluZyB7XG4gICAgY29uc3Qgc3BlY2lhbCA9IHRoaXMuZm10RmxvYXRTcGVjaWFsKG4pO1xuICAgIGlmIChzcGVjaWFsICE9PSBcIlwiKSB7XG4gICAgICByZXR1cm4gc3BlY2lhbDtcbiAgICB9XG5cbiAgICAvLyBUaGUgZG91YmxlIGFyZ3VtZW50IHJlcHJlc2VudGluZyBhIGZsb2F0aW5nLXBvaW50IG51bWJlciBzaGFsbCBiZVxuICAgIC8vIGNvbnZlcnRlZCBpbiB0aGUgc3R5bGUgZiBvciBlIChvciBpbiB0aGUgc3R5bGUgRiBvciBFIGluXG4gICAgLy8gdGhlIGNhc2Ugb2YgYSBHIGNvbnZlcnNpb24gc3BlY2lmaWVyKSwgZGVwZW5kaW5nIG9uIHRoZVxuICAgIC8vIHZhbHVlIGNvbnZlcnRlZCBhbmQgdGhlIHByZWNpc2lvbi4gTGV0IFAgZXF1YWwgdGhlXG4gICAgLy8gcHJlY2lzaW9uIGlmIG5vbi16ZXJvLCA2IGlmIHRoZSBwcmVjaXNpb24gaXMgb21pdHRlZCwgb3IgMVxuICAgIC8vIGlmIHRoZSBwcmVjaXNpb24gaXMgemVyby4gVGhlbiwgaWYgYSBjb252ZXJzaW9uIHdpdGggc3R5bGUgRSB3b3VsZFxuICAgIC8vIGhhdmUgYW4gZXhwb25lbnQgb2YgWDpcblxuICAgIC8vICAgICAtIElmIFAgPiBYPj0tNCwgdGhlIGNvbnZlcnNpb24gc2hhbGwgYmUgd2l0aCBzdHlsZSBmIChvciBGIClcbiAgICAvLyAgICAgYW5kIHByZWNpc2lvbiBQIC0oIFgrMSkuXG5cbiAgICAvLyAgICAgLSBPdGhlcndpc2UsIHRoZSBjb252ZXJzaW9uIHNoYWxsIGJlIHdpdGggc3R5bGUgZSAob3IgRSApXG4gICAgLy8gICAgIGFuZCBwcmVjaXNpb24gUCAtMS5cblxuICAgIC8vIEZpbmFsbHksIHVubGVzcyB0aGUgJyMnIGZsYWcgaXMgdXNlZCwgYW55IHRyYWlsaW5nIHplcm9zIHNoYWxsIGJlXG4gICAgLy8gcmVtb3ZlZCBmcm9tIHRoZSBmcmFjdGlvbmFsIHBvcnRpb24gb2YgdGhlIHJlc3VsdCBhbmQgdGhlXG4gICAgLy8gZGVjaW1hbC1wb2ludCBjaGFyYWN0ZXIgc2hhbGwgYmUgcmVtb3ZlZCBpZiB0aGVyZSBpcyBub1xuICAgIC8vIGZyYWN0aW9uYWwgcG9ydGlvbiByZW1haW5pbmcuXG5cbiAgICAvLyBBIGRvdWJsZSBhcmd1bWVudCByZXByZXNlbnRpbmcgYW4gaW5maW5pdHkgb3IgTmFOIHNoYWxsIGJlXG4gICAgLy8gY29udmVydGVkIGluIHRoZSBzdHlsZSBvZiBhbiBmIG9yIEYgY29udmVyc2lvbiBzcGVjaWZpZXIuXG4gICAgLy8gaHR0cHM6Ly9wdWJzLm9wZW5ncm91cC5vcmcvb25saW5lcHVicy85Njk5OTE5Nzk5L2Z1bmN0aW9ucy9mcHJpbnRmLmh0bWxcblxuICAgIGxldCBQID0gdGhpcy5mbGFncy5wcmVjaXNpb24gIT09IC0xXG4gICAgICA/IHRoaXMuZmxhZ3MucHJlY2lzaW9uXG4gICAgICA6IERFRkFVTFRfUFJFQ0lTSU9OO1xuICAgIFAgPSBQID09PSAwID8gMSA6IFA7XG5cbiAgICBjb25zdCBtID0gbi50b0V4cG9uZW50aWFsKCkubWF0Y2goRkxPQVRfUkVHRVhQKTtcbiAgICBpZiAoIW0pIHtcbiAgICAgIHRocm93IEVycm9yKFwiY2FuJ3QgaGFwcGVuXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IFggPSBwYXJzZUludChtW0YuZXhwb25lbnRdKSAqIChtW0YuZXNpZ25dID09PSBcIi1cIiA/IC0xIDogMSk7XG4gICAgbGV0IG5TdHIgPSBcIlwiO1xuICAgIGlmIChQID4gWCAmJiBYID49IC00KSB7XG4gICAgICB0aGlzLmZsYWdzLnByZWNpc2lvbiA9IFAgLSAoWCArIDEpO1xuICAgICAgblN0ciA9IHRoaXMuZm10RmxvYXRGKG4pO1xuICAgICAgaWYgKCF0aGlzLmZsYWdzLnNoYXJwKSB7XG4gICAgICAgIG5TdHIgPSBuU3RyLnJlcGxhY2UoL1xcLj8wKiQvLCBcIlwiKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5mbGFncy5wcmVjaXNpb24gPSBQIC0gMTtcbiAgICAgIG5TdHIgPSB0aGlzLmZtdEZsb2F0RShuKTtcbiAgICAgIGlmICghdGhpcy5mbGFncy5zaGFycCkge1xuICAgICAgICBuU3RyID0gblN0ci5yZXBsYWNlKC9cXC4/MCplLywgdXBjYXNlID8gXCJFXCIgOiBcImVcIik7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuU3RyO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCBzdHJpbmdcbiAgICogQHBhcmFtIHNcbiAgICovXG4gIGZtdFN0cmluZyhzOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmICh0aGlzLmZsYWdzLnByZWNpc2lvbiAhPT0gLTEpIHtcbiAgICAgIHMgPSBzLnN1YnN0cigwLCB0aGlzLmZsYWdzLnByZWNpc2lvbik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnBhZChzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtYXQgaGV4XG4gICAqIEBwYXJhbSB2YWxcbiAgICogQHBhcmFtIHVwcGVyXG4gICAqL1xuICBmbXRIZXgodmFsOiBzdHJpbmcgfCBudW1iZXIsIHVwcGVyID0gZmFsc2UpOiBzdHJpbmcge1xuICAgIC8vIGFsbG93IG90aGVycyB0eXBlcyA/XG4gICAgc3dpdGNoICh0eXBlb2YgdmFsKSB7XG4gICAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdE51bWJlcih2YWwgYXMgbnVtYmVyLCAxNiwgdXBwZXIpO1xuICAgICAgY2FzZSBcInN0cmluZ1wiOiB7XG4gICAgICAgIGNvbnN0IHNoYXJwID0gdGhpcy5mbGFncy5zaGFycCAmJiB2YWwubGVuZ3RoICE9PSAwO1xuICAgICAgICBsZXQgaGV4ID0gc2hhcnAgPyBcIjB4XCIgOiBcIlwiO1xuICAgICAgICBjb25zdCBwcmVjID0gdGhpcy5mbGFncy5wcmVjaXNpb247XG4gICAgICAgIGNvbnN0IGVuZCA9IHByZWMgIT09IC0xID8gbWluKHByZWMsIHZhbC5sZW5ndGgpIDogdmFsLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgIT09IGVuZDsgKytpKSB7XG4gICAgICAgICAgaWYgKGkgIT09IDAgJiYgdGhpcy5mbGFncy5zcGFjZSkge1xuICAgICAgICAgICAgaGV4ICs9IHNoYXJwID8gXCIgMHhcIiA6IFwiIFwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBUT0RPKGJhcnRsb21pZWp1KTogZm9yIG5vdyBvbmx5IHRha2luZyBpbnRvIGFjY291bnQgdGhlXG4gICAgICAgICAgLy8gbG93ZXIgaGFsZiBvZiB0aGUgY29kZVBvaW50LCBpZS4gYXMgaWYgYSBzdHJpbmdcbiAgICAgICAgICAvLyBpcyBhIGxpc3Qgb2YgOGJpdCB2YWx1ZXMgaW5zdGVhZCBvZiBVQ1MyIHJ1bmVzXG4gICAgICAgICAgY29uc3QgYyA9ICh2YWwuY2hhckNvZGVBdChpKSAmIDB4ZmYpLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgICBoZXggKz0gYy5sZW5ndGggPT09IDEgPyBgMCR7Y31gIDogYztcbiAgICAgICAgfVxuICAgICAgICBpZiAodXBwZXIpIHtcbiAgICAgICAgICBoZXggPSBoZXgudG9VcHBlckNhc2UoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5wYWQoaGV4KTtcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBcImN1cnJlbnRseSBvbmx5IG51bWJlciBhbmQgc3RyaW5nIGFyZSBpbXBsZW1lbnRlZCBmb3IgaGV4XCIsXG4gICAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCB2YWx1ZVxuICAgKiBAcGFyYW0gdmFsXG4gICAqL1xuICBmbXRWKHZhbDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBzdHJpbmcge1xuICAgIGlmICh0aGlzLmZsYWdzLnNoYXJwKSB7XG4gICAgICBjb25zdCBvcHRpb25zID0gdGhpcy5mbGFncy5wcmVjaXNpb24gIT09IC0xXG4gICAgICAgID8geyBkZXB0aDogdGhpcy5mbGFncy5wcmVjaXNpb24gfVxuICAgICAgICA6IHt9O1xuICAgICAgcmV0dXJuIHRoaXMucGFkKERlbm8uaW5zcGVjdCh2YWwsIG9wdGlvbnMpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcCA9IHRoaXMuZmxhZ3MucHJlY2lzaW9uO1xuICAgICAgcmV0dXJuIHAgPT09IC0xID8gdmFsLnRvU3RyaW5nKCkgOiB2YWwudG9TdHJpbmcoKS5zdWJzdHIoMCwgcCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCBKU09OXG4gICAqIEBwYXJhbSB2YWxcbiAgICovXG4gIGZtdEoodmFsOiB1bmtub3duKTogc3RyaW5nIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsKTtcbiAgfVxufVxuXG4vKipcbiAqIENvbnZlcnRzIGFuZCBmb3JtYXQgYSB2YXJpYWJsZSBudW1iZXIgb2YgYGFyZ3NgIGFzIGlzIHNwZWNpZmllZCBieSBgZm9ybWF0YC5cbiAqIGBzcHJpbnRmYCByZXR1cm5zIHRoZSBmb3JtYXR0ZWQgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSBmb3JtYXRcbiAqIEBwYXJhbSBhcmdzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzcHJpbnRmKGZvcm1hdDogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pOiBzdHJpbmcge1xuICBjb25zdCBwcmludGYgPSBuZXcgUHJpbnRmKGZvcm1hdCwgLi4uYXJncyk7XG4gIHJldHVybiBwcmludGYuZG9QcmludGYoKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0cyBhbmQgZm9ybWF0IGEgdmFyaWFibGUgbnVtYmVyIG9mIGBhcmdzYCBhcyBpcyBzcGVjaWZpZWQgYnkgYGZvcm1hdGAuXG4gKiBgcHJpbnRmYCB3cml0ZXMgdGhlIGZvcm1hdHRlZCBzdHJpbmcgdG8gc3RhbmRhcmQgb3V0cHV0LlxuICogQHBhcmFtIGZvcm1hdFxuICogQHBhcmFtIGFyZ3NcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByaW50Zihmb3JtYXQ6IHN0cmluZywgLi4uYXJnczogdW5rbm93bltdKTogdm9pZCB7XG4gIGNvbnN0IHMgPSBzcHJpbnRmKGZvcm1hdCwgLi4uYXJncyk7XG4gIERlbm8uc3Rkb3V0LndyaXRlU3luYyhuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUocykpO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRTs7d0JBRXdCLEdBRXhCLElBQUE7VUFBSyxLQUFLO0lBQUwsTUFBQSxNQUNILGlCQUFBLEtBQUE7SUFERyxNQUFBLE1BRUgsYUFBQSxLQUFBO0lBRkcsTUFBQSxNQUdILGdCQUFBLEtBQUE7SUFIRyxNQUFBLE1BSUgsZUFBQSxLQUFBO0lBSkcsTUFBQSxNQUtILFdBQUEsS0FBQTtHQUxHLFVBQUE7SUFRTDtVQUFLLElBQUk7SUFBSixLQUFBLEtBQ0gsV0FBQSxLQUFBO0lBREcsS0FBQSxLQUVILGVBQUEsS0FBQTtHQUZHLFNBQUE7QUFLTCxNQUFNO0lBQ0osS0FBZTtJQUNmLEtBQWU7SUFDZixNQUFnQjtJQUNoQixNQUFnQjtJQUNoQixLQUFlO0lBQ2YsU0FBbUI7SUFDbkIsUUFBUSxDQUFDLEVBQUU7SUFDWCxZQUFZLENBQUMsRUFBRTtBQUNqQjtBQUVBLE1BQU0sTUFBTSxLQUFLLEdBQUc7QUFDcEIsTUFBTSxnQ0FBZ0M7QUFDdEMsTUFBTSxvQkFBb0I7QUFDMUIsTUFBTSxlQUFlO0lBRXJCO1VBQUssQ0FBQztJQUFELEVBQUEsRUFDSCxVQUFPLEtBQVA7SUFERyxFQUFBLEVBRUgsY0FBQSxLQUFBO0lBRkcsRUFBQSxFQUdILGdCQUFBLEtBQUE7SUFIRyxFQUFBLEVBSUgsV0FBQSxLQUFBO0lBSkcsRUFBQSxFQUtILGNBQUEsS0FBQTtHQUxHLE1BQUE7QUFRTCxNQUFNO0lBQ0osT0FBZTtJQUNmLEtB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