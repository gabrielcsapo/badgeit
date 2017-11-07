require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return (b64.length * 3 / 4) - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr((len * 3 / 4) - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0; i < l; i += 4) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (isArrayBuffer(value)) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if (isArrayBufferView(obj) || 'length' in obj) {
      if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (isArrayBufferView(string) || isArrayBuffer(string)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffers from another context (i.e. an iframe) do not pass the `instanceof` check
// but they should be treated as valid. See: https://github.com/feross/buffer/issues/166
function isArrayBuffer (obj) {
  return obj instanceof ArrayBuffer ||
    (obj != null && obj.constructor != null && obj.constructor.name === 'ArrayBuffer' &&
      typeof obj.byteLength === 'number')
}

// Node 0.10 supports `ArrayBuffer` but lacks `ArrayBuffer.isView`
function isArrayBufferView (obj) {
  return (typeof ArrayBuffer.isView === 'function') && ArrayBuffer.isView(obj)
}

function numberIsNaN (obj) {
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":1,"ieee754":4}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],5:[function(require,module,exports){
(function (global){
/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    promiseTag = '[object Promise]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to match `RegExp` flags from their coerced string values. */
var reFlags = /\w*$/;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
typedArrayTags[errorTag] = typedArrayTags[funcTag] =
typedArrayTags[mapTag] = typedArrayTags[numberTag] =
typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
typedArrayTags[setTag] = typedArrayTags[stringTag] =
typedArrayTags[weakMapTag] = false;

/** Used to identify `toStringTag` values supported by `_.clone`. */
var cloneableTags = {};
cloneableTags[argsTag] = cloneableTags[arrayTag] =
cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] =
cloneableTags[boolTag] = cloneableTags[dateTag] =
cloneableTags[float32Tag] = cloneableTags[float64Tag] =
cloneableTags[int8Tag] = cloneableTags[int16Tag] =
cloneableTags[int32Tag] = cloneableTags[mapTag] =
cloneableTags[numberTag] = cloneableTags[objectTag] =
cloneableTags[regexpTag] = cloneableTags[setTag] =
cloneableTags[stringTag] = cloneableTags[symbolTag] =
cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] =
cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
cloneableTags[errorTag] = cloneableTags[funcTag] =
cloneableTags[weakMapTag] = false;

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = moduleExports && freeGlobal.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    return freeProcess && freeProcess.binding('util');
  } catch (e) {}
}());

/* Node.js helper references. */
var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

/**
 * Adds the key-value `pair` to `map`.
 *
 * @private
 * @param {Object} map The map to modify.
 * @param {Array} pair The key-value pair to add.
 * @returns {Object} Returns `map`.
 */
function addMapEntry(map, pair) {
  // Don't return `map.set` because it's not chainable in IE 11.
  map.set(pair[0], pair[1]);
  return map;
}

/**
 * Adds `value` to `set`.
 *
 * @private
 * @param {Object} set The set to modify.
 * @param {*} value The value to add.
 * @returns {Object} Returns `set`.
 */
function addSetEntry(set, value) {
  // Don't return `set.add` because it's not chainable in IE 11.
  set.add(value);
  return set;
}

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  switch (args.length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

/**
 * A specialized version of `_.forEach` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns `array`.
 */
function arrayEach(array, iteratee) {
  var index = -1,
      length = array ? array.length : 0;

  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

/**
 * A specialized version of `_.reduce` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {*} [accumulator] The initial value.
 * @param {boolean} [initAccum] Specify using the first element of `array` as
 *  the initial value.
 * @returns {*} Returns the accumulated value.
 */
function arrayReduce(array, iteratee, accumulator, initAccum) {
  var index = -1,
      length = array ? array.length : 0;

  if (initAccum && length) {
    accumulator = array[++index];
  }
  while (++index < length) {
    accumulator = iteratee(accumulator, array[index], index, array);
  }
  return accumulator;
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/**
 * Converts `map` to its key-value pairs.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the key-value pairs.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to detect overreaching core-js shims. */
var coreJsData = root['__core-js_shared__'];

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString.call(Object);

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined,
    Symbol = root.Symbol,
    Uint8Array = root.Uint8Array,
    getPrototype = overArg(Object.getPrototypeOf, Object),
    objectCreate = Object.create,
    propertyIsEnumerable = objectProto.propertyIsEnumerable,
    splice = arrayProto.splice;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetSymbols = Object.getOwnPropertySymbols,
    nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined,
    nativeKeys = overArg(Object.keys, Object),
    nativeMax = Math.max;

/* Built-in method references that are verified to be native. */
var DataView = getNative(root, 'DataView'),
    Map = getNative(root, 'Map'),
    Promise = getNative(root, 'Promise'),
    Set = getNative(root, 'Set'),
    WeakMap = getNative(root, 'WeakMap'),
    nativeCreate = getNative(Object, 'create');

/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = toSource(DataView),
    mapCtorString = toSource(Map),
    promiseCtorString = toSource(Promise),
    setCtorString = toSource(Set),
    weakMapCtorString = toSource(WeakMap);

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  return this.has(key) && delete this.__data__[key];
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? data[key] !== undefined : hasOwnProperty.call(data, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
  return this;
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
}

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  return true;
}

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
      length = entries ? entries.length : 0;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map || ListCache),
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  return getMapData(this, key)['delete'](key);
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  getMapData(this, key).set(key, value);
  return this;
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  this.__data__ = new ListCache(entries);
}

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new ListCache;
}

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  return this.__data__['delete'](key);
}

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key);
}

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key);
}

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var cache = this.__data__;
  if (cache instanceof ListCache) {
    var pairs = cache.__data__;
    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
      pairs.push([key, value]);
      return this;
    }
    cache = this.__data__ = new MapCache(pairs);
  }
  cache.set(key, value);
  return this;
}

// Add methods to `Stack`.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  // Safari 9 makes `arguments.length` enumerable in strict mode.
  var result = (isArray(value) || isArguments(value))
    ? baseTimes(value.length, String)
    : [];

  var length = result.length,
      skipIndexes = !!length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * This function is like `assignValue` except that it doesn't assign
 * `undefined` values.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignMergeValue(object, key, value) {
  if ((value !== undefined && !eq(object[key], value)) ||
      (typeof key == 'number' && value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
      (value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * The base implementation of `_.assign` without support for multiple sources
 * or `customizer` functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @returns {Object} Returns `object`.
 */
function baseAssign(object, source) {
  return object && copyObject(source, keys(source), object);
}

/**
 * The base implementation of `_.clone` and `_.cloneDeep` which tracks
 * traversed objects.
 *
 * @private
 * @param {*} value The value to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @param {boolean} [isFull] Specify a clone including symbols.
 * @param {Function} [customizer] The function to customize cloning.
 * @param {string} [key] The key of `value`.
 * @param {Object} [object] The parent object of `value`.
 * @param {Object} [stack] Tracks traversed objects and their clone counterparts.
 * @returns {*} Returns the cloned value.
 */
function baseClone(value, isDeep, isFull, customizer, key, object, stack) {
  var result;
  if (customizer) {
    result = object ? customizer(value, key, object, stack) : customizer(value);
  }
  if (result !== undefined) {
    return result;
  }
  if (!isObject(value)) {
    return value;
  }
  var isArr = isArray(value);
  if (isArr) {
    result = initCloneArray(value);
    if (!isDeep) {
      return copyArray(value, result);
    }
  } else {
    var tag = getTag(value),
        isFunc = tag == funcTag || tag == genTag;

    if (isBuffer(value)) {
      return cloneBuffer(value, isDeep);
    }
    if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
      if (isHostObject(value)) {
        return object ? value : {};
      }
      result = initCloneObject(isFunc ? {} : value);
      if (!isDeep) {
        return copySymbols(value, baseAssign(result, value));
      }
    } else {
      if (!cloneableTags[tag]) {
        return object ? value : {};
      }
      result = initCloneByTag(value, tag, baseClone, isDeep);
    }
  }
  // Check for circular references and return its corresponding clone.
  stack || (stack = new Stack);
  var stacked = stack.get(value);
  if (stacked) {
    return stacked;
  }
  stack.set(value, result);

  if (!isArr) {
    var props = isFull ? getAllKeys(value) : keys(value);
  }
  arrayEach(props || value, function(subValue, key) {
    if (props) {
      key = subValue;
      subValue = value[key];
    }
    // Recursively populate clone (susceptible to call stack limits).
    assignValue(result, key, baseClone(subValue, isDeep, isFull, customizer, key, value, stack));
  });
  return result;
}

/**
 * The base implementation of `_.create` without support for assigning
 * properties to the created object.
 *
 * @private
 * @param {Object} prototype The object to inherit from.
 * @returns {Object} Returns the new object.
 */
function baseCreate(proto) {
  return isObject(proto) ? objectCreate(proto) : {};
}

/**
 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
 * symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @param {Function} symbolsFunc The function to get the symbols of `object`.
 * @returns {Array} Returns the array of property names and symbols.
 */
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
  var result = keysFunc(object);
  return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
}

/**
 * The base implementation of `getTag`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  return objectToString.call(value);
}

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = (isFunction(value) || isHostObject(value)) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[objectToString.call(value)];
}

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

/**
 * The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeysIn(object) {
  if (!isObject(object)) {
    return nativeKeysIn(object);
  }
  var isProto = isPrototype(object),
      result = [];

  for (var key in object) {
    if (!(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * The base implementation of `_.merge` without support for multiple sources.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {number} srcIndex The index of `source`.
 * @param {Function} [customizer] The function to customize merged values.
 * @param {Object} [stack] Tracks traversed source values and their merged
 *  counterparts.
 */
function baseMerge(object, source, srcIndex, customizer, stack) {
  if (object === source) {
    return;
  }
  if (!(isArray(source) || isTypedArray(source))) {
    var props = baseKeysIn(source);
  }
  arrayEach(props || source, function(srcValue, key) {
    if (props) {
      key = srcValue;
      srcValue = source[key];
    }
    if (isObject(srcValue)) {
      stack || (stack = new Stack);
      baseMergeDeep(object, source, key, srcIndex, baseMerge, customizer, stack);
    }
    else {
      var newValue = customizer
        ? customizer(object[key], srcValue, (key + ''), object, source, stack)
        : undefined;

      if (newValue === undefined) {
        newValue = srcValue;
      }
      assignMergeValue(object, key, newValue);
    }
  });
}

/**
 * A specialized version of `baseMerge` for arrays and objects which performs
 * deep merges and tracks traversed objects enabling objects with circular
 * references to be merged.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {string} key The key of the value to merge.
 * @param {number} srcIndex The index of `source`.
 * @param {Function} mergeFunc The function to merge values.
 * @param {Function} [customizer] The function to customize assigned values.
 * @param {Object} [stack] Tracks traversed source values and their merged
 *  counterparts.
 */
function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
  var objValue = object[key],
      srcValue = source[key],
      stacked = stack.get(srcValue);

  if (stacked) {
    assignMergeValue(object, key, stacked);
    return;
  }
  var newValue = customizer
    ? customizer(objValue, srcValue, (key + ''), object, source, stack)
    : undefined;

  var isCommon = newValue === undefined;

  if (isCommon) {
    newValue = srcValue;
    if (isArray(srcValue) || isTypedArray(srcValue)) {
      if (isArray(objValue)) {
        newValue = objValue;
      }
      else if (isArrayLikeObject(objValue)) {
        newValue = copyArray(objValue);
      }
      else {
        isCommon = false;
        newValue = baseClone(srcValue, true);
      }
    }
    else if (isPlainObject(srcValue) || isArguments(srcValue)) {
      if (isArguments(objValue)) {
        newValue = toPlainObject(objValue);
      }
      else if (!isObject(objValue) || (srcIndex && isFunction(objValue))) {
        isCommon = false;
        newValue = baseClone(srcValue, true);
      }
      else {
        newValue = objValue;
      }
    }
    else {
      isCommon = false;
    }
  }
  if (isCommon) {
    // Recursively merge objects and arrays (susceptible to call stack limits).
    stack.set(srcValue, newValue);
    mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
    stack['delete'](srcValue);
  }
  assignMergeValue(object, key, newValue);
}

/**
 * The base implementation of `_.rest` which doesn't validate or coerce arguments.
 *
 * @private
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 */
function baseRest(func, start) {
  start = nativeMax(start === undefined ? (func.length - 1) : start, 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        array = Array(length);

    while (++index < length) {
      array[index] = args[start + index];
    }
    index = -1;
    var otherArgs = Array(start + 1);
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = array;
    return apply(func, this, otherArgs);
  };
}

/**
 * Creates a clone of  `buffer`.
 *
 * @private
 * @param {Buffer} buffer The buffer to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Buffer} Returns the cloned buffer.
 */
function cloneBuffer(buffer, isDeep) {
  if (isDeep) {
    return buffer.slice();
  }
  var result = new buffer.constructor(buffer.length);
  buffer.copy(result);
  return result;
}

/**
 * Creates a clone of `arrayBuffer`.
 *
 * @private
 * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
 * @returns {ArrayBuffer} Returns the cloned array buffer.
 */
function cloneArrayBuffer(arrayBuffer) {
  var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
  new Uint8Array(result).set(new Uint8Array(arrayBuffer));
  return result;
}

/**
 * Creates a clone of `dataView`.
 *
 * @private
 * @param {Object} dataView The data view to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned data view.
 */
function cloneDataView(dataView, isDeep) {
  var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
  return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
}

/**
 * Creates a clone of `map`.
 *
 * @private
 * @param {Object} map The map to clone.
 * @param {Function} cloneFunc The function to clone values.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned map.
 */
function cloneMap(map, isDeep, cloneFunc) {
  var array = isDeep ? cloneFunc(mapToArray(map), true) : mapToArray(map);
  return arrayReduce(array, addMapEntry, new map.constructor);
}

/**
 * Creates a clone of `regexp`.
 *
 * @private
 * @param {Object} regexp The regexp to clone.
 * @returns {Object} Returns the cloned regexp.
 */
function cloneRegExp(regexp) {
  var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
  result.lastIndex = regexp.lastIndex;
  return result;
}

/**
 * Creates a clone of `set`.
 *
 * @private
 * @param {Object} set The set to clone.
 * @param {Function} cloneFunc The function to clone values.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned set.
 */
function cloneSet(set, isDeep, cloneFunc) {
  var array = isDeep ? cloneFunc(setToArray(set), true) : setToArray(set);
  return arrayReduce(array, addSetEntry, new set.constructor);
}

/**
 * Creates a clone of the `symbol` object.
 *
 * @private
 * @param {Object} symbol The symbol object to clone.
 * @returns {Object} Returns the cloned symbol object.
 */
function cloneSymbol(symbol) {
  return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
}

/**
 * Creates a clone of `typedArray`.
 *
 * @private
 * @param {Object} typedArray The typed array to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned typed array.
 */
function cloneTypedArray(typedArray, isDeep) {
  var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
  return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
}

/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function copyArray(source, array) {
  var index = -1,
      length = source.length;

  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property identifiers to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object, customizer) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : undefined;

    assignValue(object, key, newValue === undefined ? source[key] : newValue);
  }
  return object;
}

/**
 * Copies own symbol properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy symbols from.
 * @param {Object} [object={}] The object to copy symbols to.
 * @returns {Object} Returns `object`.
 */
function copySymbols(source, object) {
  return copyObject(source, getSymbols(source), object);
}

/**
 * Creates a function like `_.assign`.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return baseRest(function(object, sources) {
    var index = -1,
        length = sources.length,
        customizer = length > 1 ? sources[length - 1] : undefined,
        guard = length > 2 ? sources[2] : undefined;

    customizer = (assigner.length > 3 && typeof customizer == 'function')
      ? (length--, customizer)
      : undefined;

    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    object = Object(object);
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, index, customizer);
      }
    }
    return object;
  });
}

/**
 * Creates an array of own enumerable property names and symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names and symbols.
 */
function getAllKeys(object) {
  return baseGetAllKeys(object, keys, getSymbols);
}

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

/**
 * Creates an array of the own enumerable symbol properties of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
var getSymbols = nativeGetSymbols ? overArg(nativeGetSymbols, Object) : stubArray;

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
var getTag = baseGetTag;

// Fallback for data views, maps, sets, and weak maps in IE 11,
// for data views in Edge < 14, and promises in Node.js.
if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
    (Map && getTag(new Map) != mapTag) ||
    (Promise && getTag(Promise.resolve()) != promiseTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = objectToString.call(value),
        Ctor = result == objectTag ? value.constructor : undefined,
        ctorString = Ctor ? toSource(Ctor) : undefined;

    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString: return dataViewTag;
        case mapCtorString: return mapTag;
        case promiseCtorString: return promiseTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

/**
 * Initializes an array clone.
 *
 * @private
 * @param {Array} array The array to clone.
 * @returns {Array} Returns the initialized clone.
 */
function initCloneArray(array) {
  var length = array.length,
      result = array.constructor(length);

  // Add properties assigned by `RegExp#exec`.
  if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
    result.index = array.index;
    result.input = array.input;
  }
  return result;
}

/**
 * Initializes an object clone.
 *
 * @private
 * @param {Object} object The object to clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneObject(object) {
  return (typeof object.constructor == 'function' && !isPrototype(object))
    ? baseCreate(getPrototype(object))
    : {};
}

/**
 * Initializes an object clone based on its `toStringTag`.
 *
 * **Note:** This function only supports cloning values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to clone.
 * @param {string} tag The `toStringTag` of the object to clone.
 * @param {Function} cloneFunc The function to clone values.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneByTag(object, tag, cloneFunc, isDeep) {
  var Ctor = object.constructor;
  switch (tag) {
    case arrayBufferTag:
      return cloneArrayBuffer(object);

    case boolTag:
    case dateTag:
      return new Ctor(+object);

    case dataViewTag:
      return cloneDataView(object, isDeep);

    case float32Tag: case float64Tag:
    case int8Tag: case int16Tag: case int32Tag:
    case uint8Tag: case uint8ClampedTag: case uint16Tag: case uint32Tag:
      return cloneTypedArray(object, isDeep);

    case mapTag:
      return cloneMap(object, isDeep, cloneFunc);

    case numberTag:
    case stringTag:
      return new Ctor(object);

    case regexpTag:
      return cloneRegExp(object);

    case setTag:
      return cloneSet(object, isDeep, cloneFunc);

    case symbolTag:
      return cloneSymbol(object);
  }
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call,
 *  else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
        ? (isArrayLike(object) && isIndex(index, object.length))
        : (type == 'string' && index in object)
      ) {
    return eq(object[index], value);
  }
  return false;
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Used by `_.defaultsDeep` to customize its `_.merge` use.
 *
 * @private
 * @param {*} objValue The destination value.
 * @param {*} srcValue The source value.
 * @param {string} key The key of the property to merge.
 * @param {Object} object The parent object of `objValue`.
 * @param {Object} source The parent object of `srcValue`.
 * @param {Object} [stack] Tracks traversed source values and their merged
 *  counterparts.
 * @returns {*} Returns the value to assign.
 */
function mergeDefaults(objValue, srcValue, key, object, source, stack) {
  if (isObject(objValue) && isObject(srcValue)) {
    // Recursively merge objects and arrays (susceptible to call stack limits).
    stack.set(srcValue, objValue);
    baseMerge(objValue, srcValue, undefined, mergeDefaults, stack);
    stack['delete'](srcValue);
  }
  return objValue;
}

/**
 * This function is like
 * [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * except that it includes inherited enumerable properties.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function nativeKeysIn(object) {
  var result = [];
  if (object != null) {
    for (var key in Object(object)) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to process.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = nativeIsBuffer || stubFalse;

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8-9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @since 0.8.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  if (!isObjectLike(value) ||
      objectToString.call(value) != objectTag || isHostObject(value)) {
    return false;
  }
  var proto = getPrototype(value);
  if (proto === null) {
    return true;
  }
  var Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return (typeof Ctor == 'function' &&
    Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString);
}

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

/**
 * Converts `value` to a plain object flattening inherited enumerable string
 * keyed properties of `value` to own properties of the plain object.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {Object} Returns the converted plain object.
 * @example
 *
 * function Foo() {
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.assign({ 'a': 1 }, new Foo);
 * // => { 'a': 1, 'b': 2 }
 *
 * _.assign({ 'a': 1 }, _.toPlainObject(new Foo));
 * // => { 'a': 1, 'b': 2, 'c': 3 }
 */
function toPlainObject(value) {
  return copyObject(value, keysIn(value));
}

/**
 * This method is like `_.defaults` except that it recursively assigns
 * default properties.
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @memberOf _
 * @since 3.10.0
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns {Object} Returns `object`.
 * @see _.defaults
 * @example
 *
 * _.defaultsDeep({ 'a': { 'b': 2 } }, { 'a': { 'b': 1, 'c': 3 } });
 * // => { 'a': { 'b': 2, 'c': 3 } }
 */
var defaultsDeep = baseRest(function(args) {
  args.push(undefined, mergeDefaults);
  return apply(mergeWith, undefined, args);
});

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
}

/**
 * This method is like `_.merge` except that it accepts `customizer` which
 * is invoked to produce the merged values of the destination and source
 * properties. If `customizer` returns `undefined`, merging is handled by the
 * method instead. The `customizer` is invoked with seven arguments:
 * (objValue, srcValue, key, object, source, stack).
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} sources The source objects.
 * @param {Function} customizer The function to customize assigned values.
 * @returns {Object} Returns `object`.
 * @example
 *
 * function customizer(objValue, srcValue) {
 *   if (_.isArray(objValue)) {
 *     return objValue.concat(srcValue);
 *   }
 * }
 *
 * var object = { 'a': [1], 'b': [2] };
 * var other = { 'a': [3], 'b': [4] };
 *
 * _.mergeWith(object, other, customizer);
 * // => { 'a': [1, 3], 'b': [2, 4] }
 */
var mergeWith = createAssigner(function(object, source, srcIndex, customizer) {
  baseMerge(object, source, srcIndex, customizer);
});

/**
 * This method returns a new empty array.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {Array} Returns the new empty array.
 * @example
 *
 * var arrays = _.times(2, _.stubArray);
 *
 * console.log(arrays);
 * // => [[], []]
 *
 * console.log(arrays[0] === arrays[1]);
 * // => false
 */
function stubArray() {
  return [];
}

/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

module.exports = defaultsDeep;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],6:[function(require,module,exports){
(function (Buffer){
/**
 * https://opentype.js.org v0.7.3 | (c) Frederik De Bleser and other contributors | MIT License | Uses tiny-inflate by Devon Govett
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.opentype = global.opentype || {})));
}(this, (function (exports) { 'use strict';

var TINF_OK = 0;
var TINF_DATA_ERROR = -3;

function Tree() {
  this.table = new Uint16Array(16);   /* table of code length counts */
  this.trans = new Uint16Array(288);  /* code -> symbol translation table */
}

function Data(source, dest) {
  this.source = source;
  this.sourceIndex = 0;
  this.tag = 0;
  this.bitcount = 0;
  
  this.dest = dest;
  this.destLen = 0;
  
  this.ltree = new Tree();  /* dynamic length/symbol tree */
  this.dtree = new Tree();  /* dynamic distance tree */
}

/* --------------------------------------------------- *
 * -- uninitialized global data (static structures) -- *
 * --------------------------------------------------- */

var sltree = new Tree();
var sdtree = new Tree();

/* extra bits and base tables for length codes */
var length_bits = new Uint8Array(30);
var length_base = new Uint16Array(30);

/* extra bits and base tables for distance codes */
var dist_bits = new Uint8Array(30);
var dist_base = new Uint16Array(30);

/* special ordering of code length codes */
var clcidx = new Uint8Array([
  16, 17, 18, 0, 8, 7, 9, 6,
  10, 5, 11, 4, 12, 3, 13, 2,
  14, 1, 15
]);

/* used by tinf_decode_trees, avoids allocations every call */
var code_tree = new Tree();
var lengths = new Uint8Array(288 + 32);

/* ----------------------- *
 * -- utility functions -- *
 * ----------------------- */

/* build extra bits and base tables */
function tinf_build_bits_base(bits, base, delta, first) {
  var i, sum;

  /* build bits table */
  for (i = 0; i < delta; ++i) { bits[i] = 0; }
  for (i = 0; i < 30 - delta; ++i) { bits[i + delta] = i / delta | 0; }

  /* build base table */
  for (sum = first, i = 0; i < 30; ++i) {
    base[i] = sum;
    sum += 1 << bits[i];
  }
}

/* build the fixed huffman trees */
function tinf_build_fixed_trees(lt, dt) {
  var i;

  /* build fixed length tree */
  for (i = 0; i < 7; ++i) { lt.table[i] = 0; }

  lt.table[7] = 24;
  lt.table[8] = 152;
  lt.table[9] = 112;

  for (i = 0; i < 24; ++i) { lt.trans[i] = 256 + i; }
  for (i = 0; i < 144; ++i) { lt.trans[24 + i] = i; }
  for (i = 0; i < 8; ++i) { lt.trans[24 + 144 + i] = 280 + i; }
  for (i = 0; i < 112; ++i) { lt.trans[24 + 144 + 8 + i] = 144 + i; }

  /* build fixed distance tree */
  for (i = 0; i < 5; ++i) { dt.table[i] = 0; }

  dt.table[5] = 32;

  for (i = 0; i < 32; ++i) { dt.trans[i] = i; }
}

/* given an array of code lengths, build a tree */
var offs = new Uint16Array(16);

function tinf_build_tree(t, lengths, off, num) {
  var i, sum;

  /* clear code length count table */
  for (i = 0; i < 16; ++i) { t.table[i] = 0; }

  /* scan symbol lengths, and sum code length counts */
  for (i = 0; i < num; ++i) { t.table[lengths[off + i]]++; }

  t.table[0] = 0;

  /* compute offset table for distribution sort */
  for (sum = 0, i = 0; i < 16; ++i) {
    offs[i] = sum;
    sum += t.table[i];
  }

  /* create code->symbol translation table (symbols sorted by code) */
  for (i = 0; i < num; ++i) {
    if (lengths[off + i]) { t.trans[offs[lengths[off + i]]++] = i; }
  }
}

/* ---------------------- *
 * -- decode functions -- *
 * ---------------------- */

/* get one bit from source stream */
function tinf_getbit(d) {
  /* check if tag is empty */
  if (!d.bitcount--) {
    /* load next tag */
    d.tag = d.source[d.sourceIndex++];
    d.bitcount = 7;
  }

  /* shift bit out of tag */
  var bit = d.tag & 1;
  d.tag >>>= 1;

  return bit;
}

/* read a num bit value from a stream and add base */
function tinf_read_bits(d, num, base) {
  if (!num)
    { return base; }

  while (d.bitcount < 24) {
    d.tag |= d.source[d.sourceIndex++] << d.bitcount;
    d.bitcount += 8;
  }

  var val = d.tag & (0xffff >>> (16 - num));
  d.tag >>>= num;
  d.bitcount -= num;
  return val + base;
}

/* given a data stream and a tree, decode a symbol */
function tinf_decode_symbol(d, t) {
  while (d.bitcount < 24) {
    d.tag |= d.source[d.sourceIndex++] << d.bitcount;
    d.bitcount += 8;
  }
  
  var sum = 0, cur = 0, len = 0;
  var tag = d.tag;

  /* get more bits while code value is above sum */
  do {
    cur = 2 * cur + (tag & 1);
    tag >>>= 1;
    ++len;

    sum += t.table[len];
    cur -= t.table[len];
  } while (cur >= 0);
  
  d.tag = tag;
  d.bitcount -= len;

  return t.trans[sum + cur];
}

/* given a data stream, decode dynamic trees from it */
function tinf_decode_trees(d, lt, dt) {
  var hlit, hdist, hclen;
  var i, num, length;

  /* get 5 bits HLIT (257-286) */
  hlit = tinf_read_bits(d, 5, 257);

  /* get 5 bits HDIST (1-32) */
  hdist = tinf_read_bits(d, 5, 1);

  /* get 4 bits HCLEN (4-19) */
  hclen = tinf_read_bits(d, 4, 4);

  for (i = 0; i < 19; ++i) { lengths[i] = 0; }

  /* read code lengths for code length alphabet */
  for (i = 0; i < hclen; ++i) {
    /* get 3 bits code length (0-7) */
    var clen = tinf_read_bits(d, 3, 0);
    lengths[clcidx[i]] = clen;
  }

  /* build code length tree */
  tinf_build_tree(code_tree, lengths, 0, 19);

  /* decode code lengths for the dynamic trees */
  for (num = 0; num < hlit + hdist;) {
    var sym = tinf_decode_symbol(d, code_tree);

    switch (sym) {
      case 16:
        /* copy previous code length 3-6 times (read 2 bits) */
        var prev = lengths[num - 1];
        for (length = tinf_read_bits(d, 2, 3); length; --length) {
          lengths[num++] = prev;
        }
        break;
      case 17:
        /* repeat code length 0 for 3-10 times (read 3 bits) */
        for (length = tinf_read_bits(d, 3, 3); length; --length) {
          lengths[num++] = 0;
        }
        break;
      case 18:
        /* repeat code length 0 for 11-138 times (read 7 bits) */
        for (length = tinf_read_bits(d, 7, 11); length; --length) {
          lengths[num++] = 0;
        }
        break;
      default:
        /* values 0-15 represent the actual code lengths */
        lengths[num++] = sym;
        break;
    }
  }

  /* build dynamic trees */
  tinf_build_tree(lt, lengths, 0, hlit);
  tinf_build_tree(dt, lengths, hlit, hdist);
}

/* ----------------------------- *
 * -- block inflate functions -- *
 * ----------------------------- */

/* given a stream and two trees, inflate a block of data */
function tinf_inflate_block_data(d, lt, dt) {
  while (1) {
    var sym = tinf_decode_symbol(d, lt);

    /* check for end of block */
    if (sym === 256) {
      return TINF_OK;
    }

    if (sym < 256) {
      d.dest[d.destLen++] = sym;
    } else {
      var length, dist, offs;
      var i;

      sym -= 257;

      /* possibly get more bits from length code */
      length = tinf_read_bits(d, length_bits[sym], length_base[sym]);

      dist = tinf_decode_symbol(d, dt);

      /* possibly get more bits from distance code */
      offs = d.destLen - tinf_read_bits(d, dist_bits[dist], dist_base[dist]);

      /* copy match */
      for (i = offs; i < offs + length; ++i) {
        d.dest[d.destLen++] = d.dest[i];
      }
    }
  }
}

/* inflate an uncompressed block of data */
function tinf_inflate_uncompressed_block(d) {
  var length, invlength;
  var i;
  
  /* unread from bitbuffer */
  while (d.bitcount > 8) {
    d.sourceIndex--;
    d.bitcount -= 8;
  }

  /* get length */
  length = d.source[d.sourceIndex + 1];
  length = 256 * length + d.source[d.sourceIndex];

  /* get one's complement of length */
  invlength = d.source[d.sourceIndex + 3];
  invlength = 256 * invlength + d.source[d.sourceIndex + 2];

  /* check length */
  if (length !== (~invlength & 0x0000ffff))
    { return TINF_DATA_ERROR; }

  d.sourceIndex += 4;

  /* copy block */
  for (i = length; i; --i)
    { d.dest[d.destLen++] = d.source[d.sourceIndex++]; }

  /* make sure we start next block on a byte boundary */
  d.bitcount = 0;

  return TINF_OK;
}

/* inflate stream from source to dest */
function tinf_uncompress(source, dest) {
  var d = new Data(source, dest);
  var bfinal, btype, res;

  do {
    /* read final block flag */
    bfinal = tinf_getbit(d);

    /* read block type (2 bits) */
    btype = tinf_read_bits(d, 2, 0);

    /* decompress block */
    switch (btype) {
      case 0:
        /* decompress uncompressed block */
        res = tinf_inflate_uncompressed_block(d);
        break;
      case 1:
        /* decompress block with fixed huffman trees */
        res = tinf_inflate_block_data(d, sltree, sdtree);
        break;
      case 2:
        /* decompress block with dynamic huffman trees */
        tinf_decode_trees(d, d.ltree, d.dtree);
        res = tinf_inflate_block_data(d, d.ltree, d.dtree);
        break;
      default:
        res = TINF_DATA_ERROR;
    }

    if (res !== TINF_OK)
      { throw new Error('Data error'); }

  } while (!bfinal);

  if (d.destLen < d.dest.length) {
    if (typeof d.dest.slice === 'function')
      { return d.dest.slice(0, d.destLen); }
    else
      { return d.dest.subarray(0, d.destLen); }
  }
  
  return d.dest;
}

/* -------------------- *
 * -- initialization -- *
 * -------------------- */

/* build fixed huffman trees */
tinf_build_fixed_trees(sltree, sdtree);

/* build extra bits and base tables */
tinf_build_bits_base(length_bits, length_base, 4, 3);
tinf_build_bits_base(dist_bits, dist_base, 2, 1);

/* fix a special case */
length_bits[28] = 0;
length_base[28] = 258;

var index = tinf_uncompress;

// The Bounding Box object

function derive(v0, v1, v2, v3, t) {
    return Math.pow(1 - t, 3) * v0 +
        3 * Math.pow(1 - t, 2) * t * v1 +
        3 * (1 - t) * Math.pow(t, 2) * v2 +
        Math.pow(t, 3) * v3;
}
/**
 * A bounding box is an enclosing box that describes the smallest measure within which all the points lie.
 * It is used to calculate the bounding box of a glyph or text path.
 *
 * On initialization, x1/y1/x2/y2 will be NaN. Check if the bounding box is empty using `isEmpty()`.
 *
 * @exports opentype.BoundingBox
 * @class
 * @constructor
 */
function BoundingBox() {
    this.x1 = Number.NaN;
    this.y1 = Number.NaN;
    this.x2 = Number.NaN;
    this.y2 = Number.NaN;
}

/**
 * Returns true if the bounding box is empty, that is, no points have been added to the box yet.
 */
BoundingBox.prototype.isEmpty = function() {
    return isNaN(this.x1) || isNaN(this.y1) || isNaN(this.x2) || isNaN(this.y2);
};

/**
 * Add the point to the bounding box.
 * The x1/y1/x2/y2 coordinates of the bounding box will now encompass the given point.
 * @param {number} x - The X coordinate of the point.
 * @param {number} y - The Y coordinate of the point.
 */
BoundingBox.prototype.addPoint = function(x, y) {
    if (typeof x === 'number') {
        if (isNaN(this.x1) || isNaN(this.x2)) {
            this.x1 = x;
            this.x2 = x;
        }
        if (x < this.x1) {
            this.x1 = x;
        }
        if (x > this.x2) {
            this.x2 = x;
        }
    }
    if (typeof y === 'number') {
        if (isNaN(this.y1) || isNaN(this.y2)) {
            this.y1 = y;
            this.y2 = y;
        }
        if (y < this.y1) {
            this.y1 = y;
        }
        if (y > this.y2) {
            this.y2 = y;
        }
    }
};

/**
 * Add a X coordinate to the bounding box.
 * This extends the bounding box to include the X coordinate.
 * This function is used internally inside of addBezier.
 * @param {number} x - The X coordinate of the point.
 */
BoundingBox.prototype.addX = function(x) {
    this.addPoint(x, null);
};

/**
 * Add a Y coordinate to the bounding box.
 * This extends the bounding box to include the Y coordinate.
 * This function is used internally inside of addBezier.
 * @param {number} y - The Y coordinate of the point.
 */
BoundingBox.prototype.addY = function(y) {
    this.addPoint(null, y);
};

/**
 * Add a Bézier curve to the bounding box.
 * This extends the bounding box to include the entire Bézier.
 * @param {number} x0 - The starting X coordinate.
 * @param {number} y0 - The starting Y coordinate.
 * @param {number} x1 - The X coordinate of the first control point.
 * @param {number} y1 - The Y coordinate of the first control point.
 * @param {number} x2 - The X coordinate of the second control point.
 * @param {number} y2 - The Y coordinate of the second control point.
 * @param {number} x - The ending X coordinate.
 * @param {number} y - The ending Y coordinate.
 */
BoundingBox.prototype.addBezier = function(x0, y0, x1, y1, x2, y2, x, y) {
    var this$1 = this;

    // This code is based on http://nishiohirokazu.blogspot.com/2009/06/how-to-calculate-bezier-curves-bounding.html
    // and https://github.com/icons8/svg-path-bounding-box

    var p0 = [x0, y0];
    var p1 = [x1, y1];
    var p2 = [x2, y2];
    var p3 = [x, y];

    this.addPoint(x0, y0);
    this.addPoint(x, y);

    for (var i = 0; i <= 1; i++) {
        var b = 6 * p0[i] - 12 * p1[i] + 6 * p2[i];
        var a = -3 * p0[i] + 9 * p1[i] - 9 * p2[i] + 3 * p3[i];
        var c = 3 * p1[i] - 3 * p0[i];

        if (a === 0) {
            if (b === 0) { continue; }
            var t = -c / b;
            if (0 < t && t < 1) {
                if (i === 0) { this$1.addX(derive(p0[i], p1[i], p2[i], p3[i], t)); }
                if (i === 1) { this$1.addY(derive(p0[i], p1[i], p2[i], p3[i], t)); }
            }
            continue;
        }

        var b2ac = Math.pow(b, 2) - 4 * c * a;
        if (b2ac < 0) { continue; }
        var t1 = (-b + Math.sqrt(b2ac)) / (2 * a);
        if (0 < t1 && t1 < 1) {
            if (i === 0) { this$1.addX(derive(p0[i], p1[i], p2[i], p3[i], t1)); }
            if (i === 1) { this$1.addY(derive(p0[i], p1[i], p2[i], p3[i], t1)); }
        }
        var t2 = (-b - Math.sqrt(b2ac)) / (2 * a);
        if (0 < t2 && t2 < 1) {
            if (i === 0) { this$1.addX(derive(p0[i], p1[i], p2[i], p3[i], t2)); }
            if (i === 1) { this$1.addY(derive(p0[i], p1[i], p2[i], p3[i], t2)); }
        }
    }
};

/**
 * Add a quadratic curve to the bounding box.
 * This extends the bounding box to include the entire quadratic curve.
 * @param {number} x0 - The starting X coordinate.
 * @param {number} y0 - The starting Y coordinate.
 * @param {number} x1 - The X coordinate of the control point.
 * @param {number} y1 - The Y coordinate of the control point.
 * @param {number} x - The ending X coordinate.
 * @param {number} y - The ending Y coordinate.
 */
BoundingBox.prototype.addQuad = function(x0, y0, x1, y1, x, y) {
    var cp1x = x0 + 2 / 3 * (x1 - x0);
    var cp1y = y0 + 2 / 3 * (y1 - y0);
    var cp2x = cp1x + 1 / 3 * (x - x0);
    var cp2y = cp1y + 1 / 3 * (y - y0);
    this.addBezier(x0, y0, cp1x, cp1y, cp2x, cp2y, x, y);
};

// Geometric objects

/**
 * A bézier path containing a set of path commands similar to a SVG path.
 * Paths can be drawn on a context using `draw`.
 * @exports opentype.Path
 * @class
 * @constructor
 */
function Path() {
    this.commands = [];
    this.fill = 'black';
    this.stroke = null;
    this.strokeWidth = 1;
}

/**
 * @param  {number} x
 * @param  {number} y
 */
Path.prototype.moveTo = function(x, y) {
    this.commands.push({
        type: 'M',
        x: x,
        y: y
    });
};

/**
 * @param  {number} x
 * @param  {number} y
 */
Path.prototype.lineTo = function(x, y) {
    this.commands.push({
        type: 'L',
        x: x,
        y: y
    });
};

/**
 * Draws cubic curve
 * @function
 * curveTo
 * @memberof opentype.Path.prototype
 * @param  {number} x1 - x of control 1
 * @param  {number} y1 - y of control 1
 * @param  {number} x2 - x of control 2
 * @param  {number} y2 - y of control 2
 * @param  {number} x - x of path point
 * @param  {number} y - y of path point
 */

/**
 * Draws cubic curve
 * @function
 * bezierCurveTo
 * @memberof opentype.Path.prototype
 * @param  {number} x1 - x of control 1
 * @param  {number} y1 - y of control 1
 * @param  {number} x2 - x of control 2
 * @param  {number} y2 - y of control 2
 * @param  {number} x - x of path point
 * @param  {number} y - y of path point
 * @see curveTo
 */
Path.prototype.curveTo = Path.prototype.bezierCurveTo = function(x1, y1, x2, y2, x, y) {
    this.commands.push({
        type: 'C',
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        x: x,
        y: y
    });
};

/**
 * Draws quadratic curve
 * @function
 * quadraticCurveTo
 * @memberof opentype.Path.prototype
 * @param  {number} x1 - x of control
 * @param  {number} y1 - y of control
 * @param  {number} x - x of path point
 * @param  {number} y - y of path point
 */

/**
 * Draws quadratic curve
 * @function
 * quadTo
 * @memberof opentype.Path.prototype
 * @param  {number} x1 - x of control
 * @param  {number} y1 - y of control
 * @param  {number} x - x of path point
 * @param  {number} y - y of path point
 */
Path.prototype.quadTo = Path.prototype.quadraticCurveTo = function(x1, y1, x, y) {
    this.commands.push({
        type: 'Q',
        x1: x1,
        y1: y1,
        x: x,
        y: y
    });
};

/**
 * Closes the path
 * @function closePath
 * @memberof opentype.Path.prototype
 */

/**
 * Close the path
 * @function close
 * @memberof opentype.Path.prototype
 */
Path.prototype.close = Path.prototype.closePath = function() {
    this.commands.push({
        type: 'Z'
    });
};

/**
 * Add the given path or list of commands to the commands of this path.
 * @param  {Array} pathOrCommands - another opentype.Path, an opentype.BoundingBox, or an array of commands.
 */
Path.prototype.extend = function(pathOrCommands) {
    if (pathOrCommands.commands) {
        pathOrCommands = pathOrCommands.commands;
    } else if (pathOrCommands instanceof BoundingBox) {
        var box = pathOrCommands;
        this.moveTo(box.x1, box.y1);
        this.lineTo(box.x2, box.y1);
        this.lineTo(box.x2, box.y2);
        this.lineTo(box.x1, box.y2);
        this.close();
        return;
    }

    Array.prototype.push.apply(this.commands, pathOrCommands);
};

/**
 * Calculate the bounding box of the path.
 * @returns {opentype.BoundingBox}
 */
Path.prototype.getBoundingBox = function() {
    var this$1 = this;

    var box = new BoundingBox();

    var startX = 0;
    var startY = 0;
    var prevX = 0;
    var prevY = 0;
    for (var i = 0; i < this.commands.length; i++) {
        var cmd = this$1.commands[i];
        switch (cmd.type) {
            case 'M':
                box.addPoint(cmd.x, cmd.y);
                startX = prevX = cmd.x;
                startY = prevY = cmd.y;
                break;
            case 'L':
                box.addPoint(cmd.x, cmd.y);
                prevX = cmd.x;
                prevY = cmd.y;
                break;
            case 'Q':
                box.addQuad(prevX, prevY, cmd.x1, cmd.y1, cmd.x, cmd.y);
                prevX = cmd.x;
                prevY = cmd.y;
                break;
            case 'C':
                box.addBezier(prevX, prevY, cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
                prevX = cmd.x;
                prevY = cmd.y;
                break;
            case 'Z':
                prevX = startX;
                prevY = startY;
                break;
            default:
                throw new Error('Unexpected path command ' + cmd.type);
        }
    }
    if (box.isEmpty()) {
        box.addPoint(0, 0);
    }
    return box;
};

/**
 * Draw the path to a 2D context.
 * @param {CanvasRenderingContext2D} ctx - A 2D drawing context.
 */
Path.prototype.draw = function(ctx) {
    var this$1 = this;

    ctx.beginPath();
    for (var i = 0; i < this.commands.length; i += 1) {
        var cmd = this$1.commands[i];
        if (cmd.type === 'M') {
            ctx.moveTo(cmd.x, cmd.y);
        } else if (cmd.type === 'L') {
            ctx.lineTo(cmd.x, cmd.y);
        } else if (cmd.type === 'C') {
            ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
        } else if (cmd.type === 'Q') {
            ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
        } else if (cmd.type === 'Z') {
            ctx.closePath();
        }
    }

    if (this.fill) {
        ctx.fillStyle = this.fill;
        ctx.fill();
    }

    if (this.stroke) {
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();
    }
};

/**
 * Convert the Path to a string of path data instructions
 * See http://www.w3.org/TR/SVG/paths.html#PathData
 * @param  {number} [decimalPlaces=2] - The amount of decimal places for floating-point values
 * @return {string}
 */
Path.prototype.toPathData = function(decimalPlaces) {
    var this$1 = this;

    decimalPlaces = decimalPlaces !== undefined ? decimalPlaces : 2;

    function floatToString(v) {
        if (Math.round(v) === v) {
            return '' + Math.round(v);
        } else {
            return v.toFixed(decimalPlaces);
        }
    }

    function packValues() {
        var arguments$1 = arguments;

        var s = '';
        for (var i = 0; i < arguments.length; i += 1) {
            var v = arguments$1[i];
            if (v >= 0 && i > 0) {
                s += ' ';
            }

            s += floatToString(v);
        }

        return s;
    }

    var d = '';
    for (var i = 0; i < this.commands.length; i += 1) {
        var cmd = this$1.commands[i];
        if (cmd.type === 'M') {
            d += 'M' + packValues(cmd.x, cmd.y);
        } else if (cmd.type === 'L') {
            d += 'L' + packValues(cmd.x, cmd.y);
        } else if (cmd.type === 'C') {
            d += 'C' + packValues(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
        } else if (cmd.type === 'Q') {
            d += 'Q' + packValues(cmd.x1, cmd.y1, cmd.x, cmd.y);
        } else if (cmd.type === 'Z') {
            d += 'Z';
        }
    }

    return d;
};

/**
 * Convert the path to an SVG <path> element, as a string.
 * @param  {number} [decimalPlaces=2] - The amount of decimal places for floating-point values
 * @return {string}
 */
Path.prototype.toSVG = function(decimalPlaces) {
    var svg = '<path d="';
    svg += this.toPathData(decimalPlaces);
    svg += '"';
    if (this.fill && this.fill !== 'black') {
        if (this.fill === null) {
            svg += ' fill="none"';
        } else {
            svg += ' fill="' + this.fill + '"';
        }
    }

    if (this.stroke) {
        svg += ' stroke="' + this.stroke + '" stroke-width="' + this.strokeWidth + '"';
    }

    svg += '/>';
    return svg;
};

/**
 * Convert the path to a DOM element.
 * @param  {number} [decimalPlaces=2] - The amount of decimal places for floating-point values
 * @return {SVGPathElement}
 */
Path.prototype.toDOMElement = function(decimalPlaces) {
    var temporaryPath = this.toPathData(decimalPlaces);
    var newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    newPath.setAttribute('d', temporaryPath);

    return newPath;
};

// Run-time checking of preconditions.

function fail(message) {
    throw new Error(message);
}

// Precondition function that checks if the given predicate is true.
// If not, it will throw an error.
function argument(predicate, message) {
    if (!predicate) {
        fail(message);
    }
}

var check = { fail: fail, argument: argument, assert: argument };

// Data types used in the OpenType font file.
// All OpenType fonts use Motorola-style byte ordering (Big Endian)

var LIMIT16 = 32768; // The limit at which a 16-bit number switches signs == 2^15
var LIMIT32 = 2147483648; // The limit at which a 32-bit number switches signs == 2 ^ 31

/**
 * @exports opentype.decode
 * @class
 */
var decode = {};
/**
 * @exports opentype.encode
 * @class
 */
var encode = {};
/**
 * @exports opentype.sizeOf
 * @class
 */
var sizeOf = {};

// Return a function that always returns the same value.
function constant(v) {
    return function() {
        return v;
    };
}

// OpenType data types //////////////////////////////////////////////////////

/**
 * Convert an 8-bit unsigned integer to a list of 1 byte.
 * @param {number}
 * @returns {Array}
 */
encode.BYTE = function(v) {
    check.argument(v >= 0 && v <= 255, 'Byte value should be between 0 and 255.');
    return [v];
};
/**
 * @constant
 * @type {number}
 */
sizeOf.BYTE = constant(1);

/**
 * Convert a 8-bit signed integer to a list of 1 byte.
 * @param {string}
 * @returns {Array}
 */
encode.CHAR = function(v) {
    return [v.charCodeAt(0)];
};

/**
 * @constant
 * @type {number}
 */
sizeOf.CHAR = constant(1);

/**
 * Convert an ASCII string to a list of bytes.
 * @param {string}
 * @returns {Array}
 */
encode.CHARARRAY = function(v) {
    var b = [];
    for (var i = 0; i < v.length; i += 1) {
        b[i] = v.charCodeAt(i);
    }

    return b;
};

/**
 * @param {Array}
 * @returns {number}
 */
sizeOf.CHARARRAY = function(v) {
    return v.length;
};

/**
 * Convert a 16-bit unsigned integer to a list of 2 bytes.
 * @param {number}
 * @returns {Array}
 */
encode.USHORT = function(v) {
    return [(v >> 8) & 0xFF, v & 0xFF];
};

/**
 * @constant
 * @type {number}
 */
sizeOf.USHORT = constant(2);

/**
 * Convert a 16-bit signed integer to a list of 2 bytes.
 * @param {number}
 * @returns {Array}
 */
encode.SHORT = function(v) {
    // Two's complement
    if (v >= LIMIT16) {
        v = -(2 * LIMIT16 - v);
    }

    return [(v >> 8) & 0xFF, v & 0xFF];
};

/**
 * @constant
 * @type {number}
 */
sizeOf.SHORT = constant(2);

/**
 * Convert a 24-bit unsigned integer to a list of 3 bytes.
 * @param {number}
 * @returns {Array}
 */
encode.UINT24 = function(v) {
    return [(v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
};

/**
 * @constant
 * @type {number}
 */
sizeOf.UINT24 = constant(3);

/**
 * Convert a 32-bit unsigned integer to a list of 4 bytes.
 * @param {number}
 * @returns {Array}
 */
encode.ULONG = function(v) {
    return [(v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
};

/**
 * @constant
 * @type {number}
 */
sizeOf.ULONG = constant(4);

/**
 * Convert a 32-bit unsigned integer to a list of 4 bytes.
 * @param {number}
 * @returns {Array}
 */
encode.LONG = function(v) {
    // Two's complement
    if (v >= LIMIT32) {
        v = -(2 * LIMIT32 - v);
    }

    return [(v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
};

/**
 * @constant
 * @type {number}
 */
sizeOf.LONG = constant(4);

encode.FIXED = encode.ULONG;
sizeOf.FIXED = sizeOf.ULONG;

encode.FWORD = encode.SHORT;
sizeOf.FWORD = sizeOf.SHORT;

encode.UFWORD = encode.USHORT;
sizeOf.UFWORD = sizeOf.USHORT;

/**
 * Convert a 32-bit Apple Mac timestamp integer to a list of 8 bytes, 64-bit timestamp.
 * @param {number}
 * @returns {Array}
 */
encode.LONGDATETIME = function(v) {
    return [0, 0, 0, 0, (v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
};

/**
 * @constant
 * @type {number}
 */
sizeOf.LONGDATETIME = constant(8);

/**
 * Convert a 4-char tag to a list of 4 bytes.
 * @param {string}
 * @returns {Array}
 */
encode.TAG = function(v) {
    check.argument(v.length === 4, 'Tag should be exactly 4 ASCII characters.');
    return [v.charCodeAt(0),
            v.charCodeAt(1),
            v.charCodeAt(2),
            v.charCodeAt(3)];
};

/**
 * @constant
 * @type {number}
 */
sizeOf.TAG = constant(4);

// CFF data types ///////////////////////////////////////////////////////////

encode.Card8 = encode.BYTE;
sizeOf.Card8 = sizeOf.BYTE;

encode.Card16 = encode.USHORT;
sizeOf.Card16 = sizeOf.USHORT;

encode.OffSize = encode.BYTE;
sizeOf.OffSize = sizeOf.BYTE;

encode.SID = encode.USHORT;
sizeOf.SID = sizeOf.USHORT;

// Convert a numeric operand or charstring number to a variable-size list of bytes.
/**
 * Convert a numeric operand or charstring number to a variable-size list of bytes.
 * @param {number}
 * @returns {Array}
 */
encode.NUMBER = function(v) {
    if (v >= -107 && v <= 107) {
        return [v + 139];
    } else if (v >= 108 && v <= 1131) {
        v = v - 108;
        return [(v >> 8) + 247, v & 0xFF];
    } else if (v >= -1131 && v <= -108) {
        v = -v - 108;
        return [(v >> 8) + 251, v & 0xFF];
    } else if (v >= -32768 && v <= 32767) {
        return encode.NUMBER16(v);
    } else {
        return encode.NUMBER32(v);
    }
};

/**
 * @param {number}
 * @returns {number}
 */
sizeOf.NUMBER = function(v) {
    return encode.NUMBER(v).length;
};

/**
 * Convert a signed number between -32768 and +32767 to a three-byte value.
 * This ensures we always use three bytes, but is not the most compact format.
 * @param {number}
 * @returns {Array}
 */
encode.NUMBER16 = function(v) {
    return [28, (v >> 8) & 0xFF, v & 0xFF];
};

/**
 * @constant
 * @type {number}
 */
sizeOf.NUMBER16 = constant(3);

/**
 * Convert a signed number between -(2^31) and +(2^31-1) to a five-byte value.
 * This is useful if you want to be sure you always use four bytes,
 * at the expense of wasting a few bytes for smaller numbers.
 * @param {number}
 * @returns {Array}
 */
encode.NUMBER32 = function(v) {
    return [29, (v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
};

/**
 * @constant
 * @type {number}
 */
sizeOf.NUMBER32 = constant(5);

/**
 * @param {number}
 * @returns {Array}
 */
encode.REAL = function(v) {
    var value = v.toString();

    // Some numbers use an epsilon to encode the value. (e.g. JavaScript will store 0.0000001 as 1e-7)
    // This code converts it back to a number without the epsilon.
    var m = /\.(\d*?)(?:9{5,20}|0{5,20})\d{0,2}(?:e(.+)|$)/.exec(value);
    if (m) {
        var epsilon = parseFloat('1e' + ((m[2] ? +m[2] : 0) + m[1].length));
        value = (Math.round(v * epsilon) / epsilon).toString();
    }

    var nibbles = '';
    for (var i = 0, ii = value.length; i < ii; i += 1) {
        var c = value[i];
        if (c === 'e') {
            nibbles += value[++i] === '-' ? 'c' : 'b';
        } else if (c === '.') {
            nibbles += 'a';
        } else if (c === '-') {
            nibbles += 'e';
        } else {
            nibbles += c;
        }
    }

    nibbles += (nibbles.length & 1) ? 'f' : 'ff';
    var out = [30];
    for (var i$1 = 0, ii$1 = nibbles.length; i$1 < ii$1; i$1 += 2) {
        out.push(parseInt(nibbles.substr(i$1, 2), 16));
    }

    return out;
};

/**
 * @param {number}
 * @returns {number}
 */
sizeOf.REAL = function(v) {
    return encode.REAL(v).length;
};

encode.NAME = encode.CHARARRAY;
sizeOf.NAME = sizeOf.CHARARRAY;

encode.STRING = encode.CHARARRAY;
sizeOf.STRING = sizeOf.CHARARRAY;

/**
 * @param {DataView} data
 * @param {number} offset
 * @param {number} numBytes
 * @returns {string}
 */
decode.UTF8 = function(data, offset, numBytes) {
    var codePoints = [];
    var numChars = numBytes;
    for (var j = 0; j < numChars; j++, offset += 1) {
        codePoints[j] = data.getUint8(offset);
    }

    return String.fromCharCode.apply(null, codePoints);
};

/**
 * @param {DataView} data
 * @param {number} offset
 * @param {number} numBytes
 * @returns {string}
 */
decode.UTF16 = function(data, offset, numBytes) {
    var codePoints = [];
    var numChars = numBytes / 2;
    for (var j = 0; j < numChars; j++, offset += 2) {
        codePoints[j] = data.getUint16(offset);
    }

    return String.fromCharCode.apply(null, codePoints);
};

/**
 * Convert a JavaScript string to UTF16-BE.
 * @param {string}
 * @returns {Array}
 */
encode.UTF16 = function(v) {
    var b = [];
    for (var i = 0; i < v.length; i += 1) {
        var codepoint = v.charCodeAt(i);
        b[b.length] = (codepoint >> 8) & 0xFF;
        b[b.length] = codepoint & 0xFF;
    }

    return b;
};

/**
 * @param {string}
 * @returns {number}
 */
sizeOf.UTF16 = function(v) {
    return v.length * 2;
};

// Data for converting old eight-bit Macintosh encodings to Unicode.
// This representation is optimized for decoding; encoding is slower
// and needs more memory. The assumption is that all opentype.js users
// want to open fonts, but saving a font will be comparatively rare
// so it can be more expensive. Keyed by IANA character set name.
//
// Python script for generating these strings:
//
//     s = u''.join([chr(c).decode('mac_greek') for c in range(128, 256)])
//     print(s.encode('utf-8'))
/**
 * @private
 */
var eightBitMacEncodings = {
    'x-mac-croatian':  // Python: 'mac_croatian'
    'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®Š™´¨≠ŽØ∞±≤≥∆µ∂∑∏š∫ªºΩžø' +
    '¿¡¬√ƒ≈Ć«Č… ÀÃÕŒœĐ—“”‘’÷◊©⁄€‹›Æ»–·‚„‰ÂćÁčÈÍÎÏÌÓÔđÒÚÛÙıˆ˜¯πË˚¸Êæˇ',
    'x-mac-cyrillic':  // Python: 'mac_cyrillic'
    'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°Ґ£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµґЈЄєЇїЉљЊњ' +
    'јЅ¬√ƒ≈∆«»… ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю',
    'x-mac-gaelic': // http://unicode.org/Public/MAPPINGS/VENDORS/APPLE/GAELIC.TXT
    'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØḂ±≤≥ḃĊċḊḋḞḟĠġṀæø' +
    'ṁṖṗɼƒſṠ«»… ÀÃÕŒœ–—“”‘’ṡẛÿŸṪ€‹›Ŷŷṫ·Ỳỳ⁊ÂÊÁËÈÍÎÏÌÓÔ♣ÒÚÛÙıÝýŴŵẄẅẀẁẂẃ',
    'x-mac-greek':  // Python: 'mac_greek'
    'Ä¹²É³ÖÜ΅àâä΄¨çéèêë£™îï•½‰ôö¦€ùûü†ΓΔΘΛΞΠß®©ΣΪ§≠°·Α±≤≥¥ΒΕΖΗΙΚΜΦΫΨΩ' +
    'άΝ¬ΟΡ≈Τ«»… ΥΧΆΈœ–―“”‘’÷ΉΊΌΎέήίόΏύαβψδεφγηιξκλμνοπώρστθωςχυζϊϋΐΰ\u00AD',
    'x-mac-icelandic':  // Python: 'mac_iceland'
    'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûüÝ°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø' +
    '¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€ÐðÞþý·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ',
    'x-mac-inuit': // http://unicode.org/Public/MAPPINGS/VENDORS/APPLE/INUIT.TXT
    'ᐃᐄᐅᐆᐊᐋᐱᐲᐳᐴᐸᐹᑉᑎᑏᑐᑑᑕᑖᑦᑭᑮᑯᑰᑲᑳᒃᒋᒌᒍᒎᒐᒑ°ᒡᒥᒦ•¶ᒧ®©™ᒨᒪᒫᒻᓂᓃᓄᓅᓇᓈᓐᓯᓰᓱᓲᓴᓵᔅᓕᓖᓗ' +
    'ᓘᓚᓛᓪᔨᔩᔪᔫᔭ… ᔮᔾᕕᕖᕗ–—“”‘’ᕘᕙᕚᕝᕆᕇᕈᕉᕋᕌᕐᕿᖀᖁᖂᖃᖄᖅᖏᖐᖑᖒᖓᖔᖕᙱᙲᙳᙴᙵᙶᖖᖠᖡᖢᖣᖤᖥᖦᕼŁł',
    'x-mac-ce':  // Python: 'mac_latin2'
    'ÄĀāÉĄÖÜáąČäčĆćéŹźĎíďĒēĖóėôöõúĚěü†°Ę£§•¶ß®©™ę¨≠ģĮįĪ≤≥īĶ∂∑łĻļĽľĹĺŅ' +
    'ņŃ¬√ńŇ∆«»… ňŐÕőŌ–—“”‘’÷◊ōŔŕŘ‹›řŖŗŠ‚„šŚśÁŤťÍŽžŪÓÔūŮÚůŰűŲųÝýķŻŁżĢˇ',
    macintosh:  // Python: 'mac_roman'
    'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø' +
    '¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ',
    'x-mac-romanian':  // Python: 'mac_romanian'
    'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ĂȘ∞±≤≥¥µ∂∑∏π∫ªºΩăș' +
    '¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›Țț‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ',
    'x-mac-turkish':  // Python: 'mac_turkish'
    'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø' +
    '¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸĞğİıŞş‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙˆ˜¯˘˙˚¸˝˛ˇ'
};

/**
 * Decodes an old-style Macintosh string. Returns either a Unicode JavaScript
 * string, or 'undefined' if the encoding is unsupported. For example, we do
 * not support Chinese, Japanese or Korean because these would need large
 * mapping tables.
 * @param {DataView} dataView
 * @param {number} offset
 * @param {number} dataLength
 * @param {string} encoding
 * @returns {string}
 */
decode.MACSTRING = function(dataView, offset, dataLength, encoding) {
    var table = eightBitMacEncodings[encoding];
    if (table === undefined) {
        return undefined;
    }

    var result = '';
    for (var i = 0; i < dataLength; i++) {
        var c = dataView.getUint8(offset + i);
        // In all eight-bit Mac encodings, the characters 0x00..0x7F are
        // mapped to U+0000..U+007F; we only need to look up the others.
        if (c <= 0x7F) {
            result += String.fromCharCode(c);
        } else {
            result += table[c & 0x7F];
        }
    }

    return result;
};

// Helper function for encode.MACSTRING. Returns a dictionary for mapping
// Unicode character codes to their 8-bit MacOS equivalent. This table
// is not exactly a super cheap data structure, but we do not care because
// encoding Macintosh strings is only rarely needed in typical applications.
var macEncodingTableCache = typeof WeakMap === 'function' && new WeakMap();
var macEncodingCacheKeys;
var getMacEncodingTable = function (encoding) {
    // Since we use encoding as a cache key for WeakMap, it has to be
    // a String object and not a literal. And at least on NodeJS 2.10.1,
    // WeakMap requires that the same String instance is passed for cache hits.
    if (!macEncodingCacheKeys) {
        macEncodingCacheKeys = {};
        for (var e in eightBitMacEncodings) {
            /*jshint -W053 */  // Suppress "Do not use String as a constructor."
            macEncodingCacheKeys[e] = new String(e);
        }
    }

    var cacheKey = macEncodingCacheKeys[encoding];
    if (cacheKey === undefined) {
        return undefined;
    }

    // We can't do "if (cache.has(key)) {return cache.get(key)}" here:
    // since garbage collection may run at any time, it could also kick in
    // between the calls to cache.has() and cache.get(). In that case,
    // we would return 'undefined' even though we do support the encoding.
    if (macEncodingTableCache) {
        var cachedTable = macEncodingTableCache.get(cacheKey);
        if (cachedTable !== undefined) {
            return cachedTable;
        }
    }

    var decodingTable = eightBitMacEncodings[encoding];
    if (decodingTable === undefined) {
        return undefined;
    }

    var encodingTable = {};
    for (var i = 0; i < decodingTable.length; i++) {
        encodingTable[decodingTable.charCodeAt(i)] = i + 0x80;
    }

    if (macEncodingTableCache) {
        macEncodingTableCache.set(cacheKey, encodingTable);
    }

    return encodingTable;
};

/**
 * Encodes an old-style Macintosh string. Returns a byte array upon success.
 * If the requested encoding is unsupported, or if the input string contains
 * a character that cannot be expressed in the encoding, the function returns
 * 'undefined'.
 * @param {string} str
 * @param {string} encoding
 * @returns {Array}
 */
encode.MACSTRING = function(str, encoding) {
    var table = getMacEncodingTable(encoding);
    if (table === undefined) {
        return undefined;
    }

    var result = [];
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);

        // In all eight-bit Mac encodings, the characters 0x00..0x7F are
        // mapped to U+0000..U+007F; we only need to look up the others.
        if (c >= 0x80) {
            c = table[c];
            if (c === undefined) {
                // str contains a Unicode character that cannot be encoded
                // in the requested encoding.
                return undefined;
            }
        }
        result[i] = c;
        // result.push(c);
    }

    return result;
};

/**
 * @param {string} str
 * @param {string} encoding
 * @returns {number}
 */
sizeOf.MACSTRING = function(str, encoding) {
    var b = encode.MACSTRING(str, encoding);
    if (b !== undefined) {
        return b.length;
    } else {
        return 0;
    }
};

// Helper for encode.VARDELTAS
function isByteEncodable(value) {
    return value >= -128 && value <= 127;
}

// Helper for encode.VARDELTAS
function encodeVarDeltaRunAsZeroes(deltas, pos, result) {
    var runLength = 0;
    var numDeltas = deltas.length;
    while (pos < numDeltas && runLength < 64 && deltas[pos] === 0) {
        ++pos;
        ++runLength;
    }
    result.push(0x80 | (runLength - 1));
    return pos;
}

// Helper for encode.VARDELTAS
function encodeVarDeltaRunAsBytes(deltas, offset, result) {
    var runLength = 0;
    var numDeltas = deltas.length;
    var pos = offset;
    while (pos < numDeltas && runLength < 64) {
        var value = deltas[pos];
        if (!isByteEncodable(value)) {
            break;
        }

        // Within a byte-encoded run of deltas, a single zero is best
        // stored literally as 0x00 value. However, if we have two or
        // more zeroes in a sequence, it is better to start a new run.
        // Fore example, the sequence of deltas [15, 15, 0, 15, 15]
        // becomes 6 bytes (04 0F 0F 00 0F 0F) when storing the zero
        // within the current run, but 7 bytes (01 0F 0F 80 01 0F 0F)
        // when starting a new run.
        if (value === 0 && pos + 1 < numDeltas && deltas[pos + 1] === 0) {
            break;
        }

        ++pos;
        ++runLength;
    }
    result.push(runLength - 1);
    for (var i = offset; i < pos; ++i) {
        result.push((deltas[i] + 256) & 0xff);
    }
    return pos;
}

// Helper for encode.VARDELTAS
function encodeVarDeltaRunAsWords(deltas, offset, result) {
    var runLength = 0;
    var numDeltas = deltas.length;
    var pos = offset;
    while (pos < numDeltas && runLength < 64) {
        var value = deltas[pos];

        // Within a word-encoded run of deltas, it is easiest to start
        // a new run (with a different encoding) whenever we encounter
        // a zero value. For example, the sequence [0x6666, 0, 0x7777]
        // needs 7 bytes when storing the zero inside the current run
        // (42 66 66 00 00 77 77), and equally 7 bytes when starting a
        // new run (40 66 66 80 40 77 77).
        if (value === 0) {
            break;
        }

        // Within a word-encoded run of deltas, a single value in the
        // range (-128..127) should be encoded within the current run
        // because it is more compact. For example, the sequence
        // [0x6666, 2, 0x7777] becomes 7 bytes when storing the value
        // literally (42 66 66 00 02 77 77), but 8 bytes when starting
        // a new run (40 66 66 00 02 40 77 77).
        if (isByteEncodable(value) && pos + 1 < numDeltas && isByteEncodable(deltas[pos + 1])) {
            break;
        }

        ++pos;
        ++runLength;
    }
    result.push(0x40 | (runLength - 1));
    for (var i = offset; i < pos; ++i) {
        var val = deltas[i];
        result.push(((val + 0x10000) >> 8) & 0xff, (val + 0x100) & 0xff);
    }
    return pos;
}

/**
 * Encode a list of variation adjustment deltas.
 *
 * Variation adjustment deltas are used in ‘gvar’ and ‘cvar’ tables.
 * They indicate how points (in ‘gvar’) or values (in ‘cvar’) get adjusted
 * when generating instances of variation fonts.
 *
 * @see https://www.microsoft.com/typography/otspec/gvar.htm
 * @see https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6gvar.html
 * @param {Array}
 * @return {Array}
 */
encode.VARDELTAS = function(deltas) {
    var pos = 0;
    var result = [];
    while (pos < deltas.length) {
        var value = deltas[pos];
        if (value === 0) {
            pos = encodeVarDeltaRunAsZeroes(deltas, pos, result);
        } else if (value >= -128 && value <= 127) {
            pos = encodeVarDeltaRunAsBytes(deltas, pos, result);
        } else {
            pos = encodeVarDeltaRunAsWords(deltas, pos, result);
        }
    }
    return result;
};

// Convert a list of values to a CFF INDEX structure.
// The values should be objects containing name / type / value.
/**
 * @param {Array} l
 * @returns {Array}
 */
encode.INDEX = function(l) {
    //var offset, offsets, offsetEncoder, encodedOffsets, encodedOffset, data,
    //    i, v;
    // Because we have to know which data type to use to encode the offsets,
    // we have to go through the values twice: once to encode the data and
    // calculate the offsets, then again to encode the offsets using the fitting data type.
    var offset = 1; // First offset is always 1.
    var offsets = [offset];
    var data = [];
    for (var i = 0; i < l.length; i += 1) {
        var v = encode.OBJECT(l[i]);
        Array.prototype.push.apply(data, v);
        offset += v.length;
        offsets.push(offset);
    }

    if (data.length === 0) {
        return [0, 0];
    }

    var encodedOffsets = [];
    var offSize = (1 + Math.floor(Math.log(offset) / Math.log(2)) / 8) | 0;
    var offsetEncoder = [undefined, encode.BYTE, encode.USHORT, encode.UINT24, encode.ULONG][offSize];
    for (var i$1 = 0; i$1 < offsets.length; i$1 += 1) {
        var encodedOffset = offsetEncoder(offsets[i$1]);
        Array.prototype.push.apply(encodedOffsets, encodedOffset);
    }

    return Array.prototype.concat(encode.Card16(l.length),
                           encode.OffSize(offSize),
                           encodedOffsets,
                           data);
};

/**
 * @param {Array}
 * @returns {number}
 */
sizeOf.INDEX = function(v) {
    return encode.INDEX(v).length;
};

/**
 * Convert an object to a CFF DICT structure.
 * The keys should be numeric.
 * The values should be objects containing name / type / value.
 * @param {Object} m
 * @returns {Array}
 */
encode.DICT = function(m) {
    var d = [];
    var keys = Object.keys(m);
    var length = keys.length;

    for (var i = 0; i < length; i += 1) {
        // Object.keys() return string keys, but our keys are always numeric.
        var k = parseInt(keys[i], 0);
        var v = m[k];
        // Value comes before the key.
        d = d.concat(encode.OPERAND(v.value, v.type));
        d = d.concat(encode.OPERATOR(k));
    }

    return d;
};

/**
 * @param {Object}
 * @returns {number}
 */
sizeOf.DICT = function(m) {
    return encode.DICT(m).length;
};

/**
 * @param {number}
 * @returns {Array}
 */
encode.OPERATOR = function(v) {
    if (v < 1200) {
        return [v];
    } else {
        return [12, v - 1200];
    }
};

/**
 * @param {Array} v
 * @param {string}
 * @returns {Array}
 */
encode.OPERAND = function(v, type) {
    var d = [];
    if (Array.isArray(type)) {
        for (var i = 0; i < type.length; i += 1) {
            check.argument(v.length === type.length, 'Not enough arguments given for type' + type);
            d = d.concat(encode.OPERAND(v[i], type[i]));
        }
    } else {
        if (type === 'SID') {
            d = d.concat(encode.NUMBER(v));
        } else if (type === 'offset') {
            // We make it easy for ourselves and always encode offsets as
            // 4 bytes. This makes offset calculation for the top dict easier.
            d = d.concat(encode.NUMBER32(v));
        } else if (type === 'number') {
            d = d.concat(encode.NUMBER(v));
        } else if (type === 'real') {
            d = d.concat(encode.REAL(v));
        } else {
            throw new Error('Unknown operand type ' + type);
            // FIXME Add support for booleans
        }
    }

    return d;
};

encode.OP = encode.BYTE;
sizeOf.OP = sizeOf.BYTE;

// memoize charstring encoding using WeakMap if available
var wmm = typeof WeakMap === 'function' && new WeakMap();

/**
 * Convert a list of CharString operations to bytes.
 * @param {Array}
 * @returns {Array}
 */
encode.CHARSTRING = function(ops) {
    // See encode.MACSTRING for why we don't do "if (wmm && wmm.has(ops))".
    if (wmm) {
        var cachedValue = wmm.get(ops);
        if (cachedValue !== undefined) {
            return cachedValue;
        }
    }

    var d = [];
    var length = ops.length;

    for (var i = 0; i < length; i += 1) {
        var op = ops[i];
        d = d.concat(encode[op.type](op.value));
    }

    if (wmm) {
        wmm.set(ops, d);
    }

    return d;
};

/**
 * @param {Array}
 * @returns {number}
 */
sizeOf.CHARSTRING = function(ops) {
    return encode.CHARSTRING(ops).length;
};

// Utility functions ////////////////////////////////////////////////////////

/**
 * Convert an object containing name / type / value to bytes.
 * @param {Object}
 * @returns {Array}
 */
encode.OBJECT = function(v) {
    var encodingFunction = encode[v.type];
    check.argument(encodingFunction !== undefined, 'No encoding function for type ' + v.type);
    return encodingFunction(v.value);
};

/**
 * @param {Object}
 * @returns {number}
 */
sizeOf.OBJECT = function(v) {
    var sizeOfFunction = sizeOf[v.type];
    check.argument(sizeOfFunction !== undefined, 'No sizeOf function for type ' + v.type);
    return sizeOfFunction(v.value);
};

/**
 * Convert a table object to bytes.
 * A table contains a list of fields containing the metadata (name, type and default value).
 * The table itself has the field values set as attributes.
 * @param {opentype.Table}
 * @returns {Array}
 */
encode.TABLE = function(table) {
    var d = [];
    var length = table.fields.length;
    var subtables = [];
    var subtableOffsets = [];

    for (var i = 0; i < length; i += 1) {
        var field = table.fields[i];
        var encodingFunction = encode[field.type];
        check.argument(encodingFunction !== undefined, 'No encoding function for field type ' + field.type + ' (' + field.name + ')');
        var value = table[field.name];
        if (value === undefined) {
            value = field.value;
        }

        var bytes = encodingFunction(value);

        if (field.type === 'TABLE') {
            subtableOffsets.push(d.length);
            d = d.concat([0, 0]);
            subtables.push(bytes);
        } else {
            d = d.concat(bytes);
        }
    }

    for (var i$1 = 0; i$1 < subtables.length; i$1 += 1) {
        var o = subtableOffsets[i$1];
        var offset = d.length;
        check.argument(offset < 65536, 'Table ' + table.tableName + ' too big.');
        d[o] = offset >> 8;
        d[o + 1] = offset & 0xff;
        d = d.concat(subtables[i$1]);
    }

    return d;
};

/**
 * @param {opentype.Table}
 * @returns {number}
 */
sizeOf.TABLE = function(table) {
    var numBytes = 0;
    var length = table.fields.length;

    for (var i = 0; i < length; i += 1) {
        var field = table.fields[i];
        var sizeOfFunction = sizeOf[field.type];
        check.argument(sizeOfFunction !== undefined, 'No sizeOf function for field type ' + field.type + ' (' + field.name + ')');
        var value = table[field.name];
        if (value === undefined) {
            value = field.value;
        }

        numBytes += sizeOfFunction(value);

        // Subtables take 2 more bytes for offsets.
        if (field.type === 'TABLE') {
            numBytes += 2;
        }
    }

    return numBytes;
};

encode.RECORD = encode.TABLE;
sizeOf.RECORD = sizeOf.TABLE;

// Merge in a list of bytes.
encode.LITERAL = function(v) {
    return v;
};

sizeOf.LITERAL = function(v) {
    return v.length;
};

// Table metadata

/**
 * @exports opentype.Table
 * @class
 * @param {string} tableName
 * @param {Array} fields
 * @param {Object} options
 * @constructor
 */
function Table(tableName, fields, options) {
    var this$1 = this;

    for (var i = 0; i < fields.length; i += 1) {
        var field = fields[i];
        this$1[field.name] = field.value;
    }

    this.tableName = tableName;
    this.fields = fields;
    if (options) {
        var optionKeys = Object.keys(options);
        for (var i$1 = 0; i$1 < optionKeys.length; i$1 += 1) {
            var k = optionKeys[i$1];
            var v = options[k];
            if (this$1[k] !== undefined) {
                this$1[k] = v;
            }
        }
    }
}

/**
 * Encodes the table and returns an array of bytes
 * @return {Array}
 */
Table.prototype.encode = function() {
    return encode.TABLE(this);
};

/**
 * Get the size of the table.
 * @return {number}
 */
Table.prototype.sizeOf = function() {
    return sizeOf.TABLE(this);
};

/**
 * @private
 */
function ushortList(itemName, list, count) {
    if (count === undefined) {
        count = list.length;
    }
    var fields = new Array(list.length + 1);
    fields[0] = {name: itemName + 'Count', type: 'USHORT', value: count};
    for (var i = 0; i < list.length; i++) {
        fields[i + 1] = {name: itemName + i, type: 'USHORT', value: list[i]};
    }
    return fields;
}

/**
 * @private
 */
function tableList(itemName, records, itemCallback) {
    var count = records.length;
    var fields = new Array(count + 1);
    fields[0] = {name: itemName + 'Count', type: 'USHORT', value: count};
    for (var i = 0; i < count; i++) {
        fields[i + 1] = {name: itemName + i, type: 'TABLE', value: itemCallback(records[i], i)};
    }
    return fields;
}

/**
 * @private
 */
function recordList(itemName, records, itemCallback) {
    var count = records.length;
    var fields = [];
    fields[0] = {name: itemName + 'Count', type: 'USHORT', value: count};
    for (var i = 0; i < count; i++) {
        fields = fields.concat(itemCallback(records[i], i));
    }
    return fields;
}

// Common Layout Tables

/**
 * @exports opentype.Coverage
 * @class
 * @param {opentype.Table}
 * @constructor
 * @extends opentype.Table
 */
function Coverage(coverageTable) {
    if (coverageTable.format === 1) {
        Table.call(this, 'coverageTable',
            [{name: 'coverageFormat', type: 'USHORT', value: 1}]
            .concat(ushortList('glyph', coverageTable.glyphs))
        );
    } else {
        check.assert(false, 'Can\'t create coverage table format 2 yet.');
    }
}
Coverage.prototype = Object.create(Table.prototype);
Coverage.prototype.constructor = Coverage;

function ScriptList(scriptListTable) {
    Table.call(this, 'scriptListTable',
        recordList('scriptRecord', scriptListTable, function(scriptRecord, i) {
            var script = scriptRecord.script;
            var defaultLangSys = script.defaultLangSys;
            check.assert(!!defaultLangSys, 'Unable to write GSUB: script ' + scriptRecord.tag + ' has no default language system.');
            return [
                {name: 'scriptTag' + i, type: 'TAG', value: scriptRecord.tag},
                {name: 'script' + i, type: 'TABLE', value: new Table('scriptTable', [
                    {name: 'defaultLangSys', type: 'TABLE', value: new Table('defaultLangSys', [
                        {name: 'lookupOrder', type: 'USHORT', value: 0},
                        {name: 'reqFeatureIndex', type: 'USHORT', value: defaultLangSys.reqFeatureIndex}]
                        .concat(ushortList('featureIndex', defaultLangSys.featureIndexes)))}
                    ].concat(recordList('langSys', script.langSysRecords, function(langSysRecord, i) {
                        var langSys = langSysRecord.langSys;
                        return [
                            {name: 'langSysTag' + i, type: 'TAG', value: langSysRecord.tag},
                            {name: 'langSys' + i, type: 'TABLE', value: new Table('langSys', [
                                {name: 'lookupOrder', type: 'USHORT', value: 0},
                                {name: 'reqFeatureIndex', type: 'USHORT', value: langSys.reqFeatureIndex}
                                ].concat(ushortList('featureIndex', langSys.featureIndexes)))}
                        ];
                    })))}
            ];
        })
    );
}
ScriptList.prototype = Object.create(Table.prototype);
ScriptList.prototype.constructor = ScriptList;

/**
 * @exports opentype.FeatureList
 * @class
 * @param {opentype.Table}
 * @constructor
 * @extends opentype.Table
 */
function FeatureList(featureListTable) {
    Table.call(this, 'featureListTable',
        recordList('featureRecord', featureListTable, function(featureRecord, i) {
            var feature = featureRecord.feature;
            return [
                {name: 'featureTag' + i, type: 'TAG', value: featureRecord.tag},
                {name: 'feature' + i, type: 'TABLE', value: new Table('featureTable', [
                    {name: 'featureParams', type: 'USHORT', value: feature.featureParams} ].concat(ushortList('lookupListIndex', feature.lookupListIndexes)))}
            ];
        })
    );
}
FeatureList.prototype = Object.create(Table.prototype);
FeatureList.prototype.constructor = FeatureList;

/**
 * @exports opentype.LookupList
 * @class
 * @param {opentype.Table}
 * @param {Object}
 * @constructor
 * @extends opentype.Table
 */
function LookupList(lookupListTable, subtableMakers) {
    Table.call(this, 'lookupListTable', tableList('lookup', lookupListTable, function(lookupTable) {
        var subtableCallback = subtableMakers[lookupTable.lookupType];
        check.assert(!!subtableCallback, 'Unable to write GSUB lookup type ' + lookupTable.lookupType + ' tables.');
        return new Table('lookupTable', [
            {name: 'lookupType', type: 'USHORT', value: lookupTable.lookupType},
            {name: 'lookupFlag', type: 'USHORT', value: lookupTable.lookupFlag}
        ].concat(tableList('subtable', lookupTable.subtables, subtableCallback)));
    }));
}
LookupList.prototype = Object.create(Table.prototype);
LookupList.prototype.constructor = LookupList;

// Record = same as Table, but inlined (a Table has an offset and its data is further in the stream)
// Don't use offsets inside Records (probable bug), only in Tables.
var table = {
    Table: Table,
    Record: Table,
    Coverage: Coverage,
    ScriptList: ScriptList,
    FeatureList: FeatureList,
    LookupList: LookupList,
    ushortList: ushortList,
    tableList: tableList,
    recordList: recordList,
};

// Parsing utility functions

// Retrieve an unsigned byte from the DataView.
function getByte(dataView, offset) {
    return dataView.getUint8(offset);
}

// Retrieve an unsigned 16-bit short from the DataView.
// The value is stored in big endian.
function getUShort(dataView, offset) {
    return dataView.getUint16(offset, false);
}

// Retrieve a signed 16-bit short from the DataView.
// The value is stored in big endian.
function getShort(dataView, offset) {
    return dataView.getInt16(offset, false);
}

// Retrieve an unsigned 32-bit long from the DataView.
// The value is stored in big endian.
function getULong(dataView, offset) {
    return dataView.getUint32(offset, false);
}

// Retrieve a 32-bit signed fixed-point number (16.16) from the DataView.
// The value is stored in big endian.
function getFixed(dataView, offset) {
    var decimal = dataView.getInt16(offset, false);
    var fraction = dataView.getUint16(offset + 2, false);
    return decimal + fraction / 65535;
}

// Retrieve a 4-character tag from the DataView.
// Tags are used to identify tables.
function getTag(dataView, offset) {
    var tag = '';
    for (var i = offset; i < offset + 4; i += 1) {
        tag += String.fromCharCode(dataView.getInt8(i));
    }

    return tag;
}

// Retrieve an offset from the DataView.
// Offsets are 1 to 4 bytes in length, depending on the offSize argument.
function getOffset(dataView, offset, offSize) {
    var v = 0;
    for (var i = 0; i < offSize; i += 1) {
        v <<= 8;
        v += dataView.getUint8(offset + i);
    }

    return v;
}

// Retrieve a number of bytes from start offset to the end offset from the DataView.
function getBytes(dataView, startOffset, endOffset) {
    var bytes = [];
    for (var i = startOffset; i < endOffset; i += 1) {
        bytes.push(dataView.getUint8(i));
    }

    return bytes;
}

// Convert the list of bytes to a string.
function bytesToString(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 1) {
        s += String.fromCharCode(bytes[i]);
    }

    return s;
}

var typeOffsets = {
    byte: 1,
    uShort: 2,
    short: 2,
    uLong: 4,
    fixed: 4,
    longDateTime: 8,
    tag: 4
};

// A stateful parser that changes the offset whenever a value is retrieved.
// The data is a DataView.
function Parser(data, offset) {
    this.data = data;
    this.offset = offset;
    this.relativeOffset = 0;
}

Parser.prototype.parseByte = function() {
    var v = this.data.getUint8(this.offset + this.relativeOffset);
    this.relativeOffset += 1;
    return v;
};

Parser.prototype.parseChar = function() {
    var v = this.data.getInt8(this.offset + this.relativeOffset);
    this.relativeOffset += 1;
    return v;
};

Parser.prototype.parseCard8 = Parser.prototype.parseByte;

Parser.prototype.parseUShort = function() {
    var v = this.data.getUint16(this.offset + this.relativeOffset);
    this.relativeOffset += 2;
    return v;
};

Parser.prototype.parseCard16 = Parser.prototype.parseUShort;
Parser.prototype.parseSID = Parser.prototype.parseUShort;
Parser.prototype.parseOffset16 = Parser.prototype.parseUShort;

Parser.prototype.parseShort = function() {
    var v = this.data.getInt16(this.offset + this.relativeOffset);
    this.relativeOffset += 2;
    return v;
};

Parser.prototype.parseF2Dot14 = function() {
    var v = this.data.getInt16(this.offset + this.relativeOffset) / 16384;
    this.relativeOffset += 2;
    return v;
};

Parser.prototype.parseULong = function() {
    var v = getULong(this.data, this.offset + this.relativeOffset);
    this.relativeOffset += 4;
    return v;
};

Parser.prototype.parseFixed = function() {
    var v = getFixed(this.data, this.offset + this.relativeOffset);
    this.relativeOffset += 4;
    return v;
};

Parser.prototype.parseString = function(length) {
    var dataView = this.data;
    var offset = this.offset + this.relativeOffset;
    var string = '';
    this.relativeOffset += length;
    for (var i = 0; i < length; i++) {
        string += String.fromCharCode(dataView.getUint8(offset + i));
    }

    return string;
};

Parser.prototype.parseTag = function() {
    return this.parseString(4);
};

// LONGDATETIME is a 64-bit integer.
// JavaScript and unix timestamps traditionally use 32 bits, so we
// only take the last 32 bits.
// + Since until 2038 those bits will be filled by zeros we can ignore them.
Parser.prototype.parseLongDateTime = function() {
    var v = getULong(this.data, this.offset + this.relativeOffset + 4);
    // Subtract seconds between 01/01/1904 and 01/01/1970
    // to convert Apple Mac timestamp to Standard Unix timestamp
    v -= 2082844800;
    this.relativeOffset += 8;
    return v;
};

Parser.prototype.parseVersion = function() {
    var major = getUShort(this.data, this.offset + this.relativeOffset);

    // How to interpret the minor version is very vague in the spec. 0x5000 is 5, 0x1000 is 1
    // This returns the correct number if minor = 0xN000 where N is 0-9
    var minor = getUShort(this.data, this.offset + this.relativeOffset + 2);
    this.relativeOffset += 4;
    return major + minor / 0x1000 / 10;
};

Parser.prototype.skip = function(type, amount) {
    if (amount === undefined) {
        amount = 1;
    }

    this.relativeOffset += typeOffsets[type] * amount;
};

///// Parsing lists and records ///////////////////////////////

// Parse a list of 16 bit unsigned integers. The length of the list can be read on the stream
// or provided as an argument.
Parser.prototype.parseOffset16List =
Parser.prototype.parseUShortList = function(count) {
    if (count === undefined) { count = this.parseUShort(); }
    var offsets = new Array(count);
    var dataView = this.data;
    var offset = this.offset + this.relativeOffset;
    for (var i = 0; i < count; i++) {
        offsets[i] = dataView.getUint16(offset);
        offset += 2;
    }

    this.relativeOffset += count * 2;
    return offsets;
};

// Parses a list of 16 bit signed integers.
Parser.prototype.parseShortList = function(count) {
    var list = new Array(count);
    var dataView = this.data;
    var offset = this.offset + this.relativeOffset;
    for (var i = 0; i < count; i++) {
        list[i] = dataView.getInt16(offset);
        offset += 2;
    }

    this.relativeOffset += count * 2;
    return list;
};

// Parses a list of bytes.
Parser.prototype.parseByteList = function(count) {
    var list = new Array(count);
    var dataView = this.data;
    var offset = this.offset + this.relativeOffset;
    for (var i = 0; i < count; i++) {
        list[i] = dataView.getUint8(offset++);
    }

    this.relativeOffset += count;
    return list;
};

/**
 * Parse a list of items.
 * Record count is optional, if omitted it is read from the stream.
 * itemCallback is one of the Parser methods.
 */
Parser.prototype.parseList = function(count, itemCallback) {
    var this$1 = this;

    if (!itemCallback) {
        itemCallback = count;
        count = this.parseUShort();
    }
    var list = new Array(count);
    for (var i = 0; i < count; i++) {
        list[i] = itemCallback.call(this$1);
    }
    return list;
};

/**
 * Parse a list of records.
 * Record count is optional, if omitted it is read from the stream.
 * Example of recordDescription: { sequenceIndex: Parser.uShort, lookupListIndex: Parser.uShort }
 */
Parser.prototype.parseRecordList = function(count, recordDescription) {
    var this$1 = this;

    // If the count argument is absent, read it in the stream.
    if (!recordDescription) {
        recordDescription = count;
        count = this.parseUShort();
    }
    var records = new Array(count);
    var fields = Object.keys(recordDescription);
    for (var i = 0; i < count; i++) {
        var rec = {};
        for (var j = 0; j < fields.length; j++) {
            var fieldName = fields[j];
            var fieldType = recordDescription[fieldName];
            rec[fieldName] = fieldType.call(this$1);
        }
        records[i] = rec;
    }
    return records;
};

// Parse a data structure into an object
// Example of description: { sequenceIndex: Parser.uShort, lookupListIndex: Parser.uShort }
Parser.prototype.parseStruct = function(description) {
    var this$1 = this;

    if (typeof description === 'function') {
        return description.call(this);
    } else {
        var fields = Object.keys(description);
        var struct = {};
        for (var j = 0; j < fields.length; j++) {
            var fieldName = fields[j];
            var fieldType = description[fieldName];
            struct[fieldName] = fieldType.call(this$1);
        }
        return struct;
    }
};

Parser.prototype.parsePointer = function(description) {
    var structOffset = this.parseOffset16();
    if (structOffset > 0) {                         // NULL offset => return undefined
        return new Parser(this.data, this.offset + structOffset).parseStruct(description);
    }
    return undefined;
};

/**
 * Parse a list of offsets to lists of 16-bit integers,
 * or a list of offsets to lists of offsets to any kind of items.
 * If itemCallback is not provided, a list of list of UShort is assumed.
 * If provided, itemCallback is called on each item and must parse the item.
 * See examples in tables/gsub.js
 */
Parser.prototype.parseListOfLists = function(itemCallback) {
    var this$1 = this;

    var offsets = this.parseOffset16List();
    var count = offsets.length;
    var relativeOffset = this.relativeOffset;
    var list = new Array(count);
    for (var i = 0; i < count; i++) {
        var start = offsets[i];
        if (start === 0) {                  // NULL offset
            list[i] = undefined;            // Add i as owned property to list. Convenient with assert.
            continue;
        }
        this$1.relativeOffset = start;
        if (itemCallback) {
            var subOffsets = this$1.parseOffset16List();
            var subList = new Array(subOffsets.length);
            for (var j = 0; j < subOffsets.length; j++) {
                this$1.relativeOffset = start + subOffsets[j];
                subList[j] = itemCallback.call(this$1);
            }
            list[i] = subList;
        } else {
            list[i] = this$1.parseUShortList();
        }
    }
    this.relativeOffset = relativeOffset;
    return list;
};

///// Complex tables parsing //////////////////////////////////

// Parse a coverage table in a GSUB, GPOS or GDEF table.
// https://www.microsoft.com/typography/OTSPEC/chapter2.htm
// parser.offset must point to the start of the table containing the coverage.
Parser.prototype.parseCoverage = function() {
    var this$1 = this;

    var startOffset = this.offset + this.relativeOffset;
    var format = this.parseUShort();
    var count = this.parseUShort();
    if (format === 1) {
        return {
            format: 1,
            glyphs: this.parseUShortList(count)
        };
    } else if (format === 2) {
        var ranges = new Array(count);
        for (var i = 0; i < count; i++) {
            ranges[i] = {
                start: this$1.parseUShort(),
                end: this$1.parseUShort(),
                index: this$1.parseUShort()
            };
        }
        return {
            format: 2,
            ranges: ranges
        };
    }
    throw new Error('0x' + startOffset.toString(16) + ': Coverage format must be 1 or 2.');
};

// Parse a Class Definition Table in a GSUB, GPOS or GDEF table.
// https://www.microsoft.com/typography/OTSPEC/chapter2.htm
Parser.prototype.parseClassDef = function() {
    var startOffset = this.offset + this.relativeOffset;
    var format = this.parseUShort();
    if (format === 1) {
        return {
            format: 1,
            startGlyph: this.parseUShort(),
            classes: this.parseUShortList()
        };
    } else if (format === 2) {
        return {
            format: 2,
            ranges: this.parseRecordList({
                start: Parser.uShort,
                end: Parser.uShort,
                classId: Parser.uShort
            })
        };
    }
    throw new Error('0x' + startOffset.toString(16) + ': ClassDef format must be 1 or 2.');
};

///// Static methods ///////////////////////////////////
// These convenience methods can be used as callbacks and should be called with "this" context set to a Parser instance.

Parser.list = function(count, itemCallback) {
    return function() {
        return this.parseList(count, itemCallback);
    };
};

Parser.recordList = function(count, recordDescription) {
    return function() {
        return this.parseRecordList(count, recordDescription);
    };
};

Parser.pointer = function(description) {
    return function() {
        return this.parsePointer(description);
    };
};

Parser.tag = Parser.prototype.parseTag;
Parser.byte = Parser.prototype.parseByte;
Parser.uShort = Parser.offset16 = Parser.prototype.parseUShort;
Parser.uShortList = Parser.prototype.parseUShortList;
Parser.struct = Parser.prototype.parseStruct;
Parser.coverage = Parser.prototype.parseCoverage;
Parser.classDef = Parser.prototype.parseClassDef;

///// Script, Feature, Lookup lists ///////////////////////////////////////////////
// https://www.microsoft.com/typography/OTSPEC/chapter2.htm

var langSysTable = {
    reserved: Parser.uShort,
    reqFeatureIndex: Parser.uShort,
    featureIndexes: Parser.uShortList
};

Parser.prototype.parseScriptList = function() {
    return this.parsePointer(Parser.recordList({
        tag: Parser.tag,
        script: Parser.pointer({
            defaultLangSys: Parser.pointer(langSysTable),
            langSysRecords: Parser.recordList({
                tag: Parser.tag,
                langSys: Parser.pointer(langSysTable)
            })
        })
    }));
};

Parser.prototype.parseFeatureList = function() {
    return this.parsePointer(Parser.recordList({
        tag: Parser.tag,
        feature: Parser.pointer({
            featureParams: Parser.offset16,
            lookupListIndexes: Parser.uShortList
        })
    }));
};

Parser.prototype.parseLookupList = function(lookupTableParsers) {
    return this.parsePointer(Parser.list(Parser.pointer(function() {
        var lookupType = this.parseUShort();
        check.argument(1 <= lookupType && lookupType <= 8, 'GSUB lookup type ' + lookupType + ' unknown.');
        var lookupFlag = this.parseUShort();
        var useMarkFilteringSet = lookupFlag & 0x10;
        return {
            lookupType: lookupType,
            lookupFlag: lookupFlag,
            subtables: this.parseList(Parser.pointer(lookupTableParsers[lookupType])),
            markFilteringSet: useMarkFilteringSet ? this.parseUShort() : undefined
        };
    })));
};

var parse = {
    getByte: getByte,
    getCard8: getByte,
    getUShort: getUShort,
    getCard16: getUShort,
    getShort: getShort,
    getULong: getULong,
    getFixed: getFixed,
    getTag: getTag,
    getOffset: getOffset,
    getBytes: getBytes,
    bytesToString: bytesToString,
    Parser: Parser,
};

// The `cmap` table stores the mappings from characters to glyphs.
// https://www.microsoft.com/typography/OTSPEC/cmap.htm

function parseCmapTableFormat12(cmap, p) {
    //Skip reserved.
    p.parseUShort();

    // Length in bytes of the sub-tables.
    cmap.length = p.parseULong();
    cmap.language = p.parseULong();

    var groupCount;
    cmap.groupCount = groupCount = p.parseULong();
    cmap.glyphIndexMap = {};

    for (var i = 0; i < groupCount; i += 1) {
        var startCharCode = p.parseULong();
        var endCharCode = p.parseULong();
        var startGlyphId = p.parseULong();

        for (var c = startCharCode; c <= endCharCode; c += 1) {
            cmap.glyphIndexMap[c] = startGlyphId;
            startGlyphId++;
        }
    }
}

function parseCmapTableFormat4(cmap, p, data, start, offset) {
    // Length in bytes of the sub-tables.
    cmap.length = p.parseUShort();
    cmap.language = p.parseUShort();

    // segCount is stored x 2.
    var segCount;
    cmap.segCount = segCount = p.parseUShort() >> 1;

    // Skip searchRange, entrySelector, rangeShift.
    p.skip('uShort', 3);

    // The "unrolled" mapping from character codes to glyph indices.
    cmap.glyphIndexMap = {};
    var endCountParser = new parse.Parser(data, start + offset + 14);
    var startCountParser = new parse.Parser(data, start + offset + 16 + segCount * 2);
    var idDeltaParser = new parse.Parser(data, start + offset + 16 + segCount * 4);
    var idRangeOffsetParser = new parse.Parser(data, start + offset + 16 + segCount * 6);
    var glyphIndexOffset = start + offset + 16 + segCount * 8;
    for (var i = 0; i < segCount - 1; i += 1) {
        var glyphIndex = (void 0);
        var endCount = endCountParser.parseUShort();
        var startCount = startCountParser.parseUShort();
        var idDelta = idDeltaParser.parseShort();
        var idRangeOffset = idRangeOffsetParser.parseUShort();
        for (var c = startCount; c <= endCount; c += 1) {
            if (idRangeOffset !== 0) {
                // The idRangeOffset is relative to the current position in the idRangeOffset array.
                // Take the current offset in the idRangeOffset array.
                glyphIndexOffset = (idRangeOffsetParser.offset + idRangeOffsetParser.relativeOffset - 2);

                // Add the value of the idRangeOffset, which will move us into the glyphIndex array.
                glyphIndexOffset += idRangeOffset;

                // Then add the character index of the current segment, multiplied by 2 for USHORTs.
                glyphIndexOffset += (c - startCount) * 2;
                glyphIndex = parse.getUShort(data, glyphIndexOffset);
                if (glyphIndex !== 0) {
                    glyphIndex = (glyphIndex + idDelta) & 0xFFFF;
                }
            } else {
                glyphIndex = (c + idDelta) & 0xFFFF;
            }

            cmap.glyphIndexMap[c] = glyphIndex;
        }
    }
}

// Parse the `cmap` table. This table stores the mappings from characters to glyphs.
// There are many available formats, but we only support the Windows format 4 and 12.
// This function returns a `CmapEncoding` object or null if no supported format could be found.
function parseCmapTable(data, start) {
    var cmap = {};
    cmap.version = parse.getUShort(data, start);
    check.argument(cmap.version === 0, 'cmap table version should be 0.');

    // The cmap table can contain many sub-tables, each with their own format.
    // We're only interested in a "platform 3" table. This is a Windows format.
    cmap.numTables = parse.getUShort(data, start + 2);
    var offset = -1;
    for (var i = cmap.numTables - 1; i >= 0; i -= 1) {
        var platformId = parse.getUShort(data, start + 4 + (i * 8));
        var encodingId = parse.getUShort(data, start + 4 + (i * 8) + 2);
        if (platformId === 3 && (encodingId === 0 || encodingId === 1 || encodingId === 10)) {
            offset = parse.getULong(data, start + 4 + (i * 8) + 4);
            break;
        }
    }

    if (offset === -1) {
        // There is no cmap table in the font that we support.
        throw new Error('No valid cmap sub-tables found.');
    }

    var p = new parse.Parser(data, start + offset);
    cmap.format = p.parseUShort();

    if (cmap.format === 12) {
        parseCmapTableFormat12(cmap, p);
    } else if (cmap.format === 4) {
        parseCmapTableFormat4(cmap, p, data, start, offset);
    } else {
        throw new Error('Only format 4 and 12 cmap tables are supported (found format ' + cmap.format + ').');
    }

    return cmap;
}

function addSegment(t, code, glyphIndex) {
    t.segments.push({
        end: code,
        start: code,
        delta: -(code - glyphIndex),
        offset: 0
    });
}

function addTerminatorSegment(t) {
    t.segments.push({
        end: 0xFFFF,
        start: 0xFFFF,
        delta: 1,
        offset: 0
    });
}

function makeCmapTable(glyphs) {
    var t = new table.Table('cmap', [
        {name: 'version', type: 'USHORT', value: 0},
        {name: 'numTables', type: 'USHORT', value: 1},
        {name: 'platformID', type: 'USHORT', value: 3},
        {name: 'encodingID', type: 'USHORT', value: 1},
        {name: 'offset', type: 'ULONG', value: 12},
        {name: 'format', type: 'USHORT', value: 4},
        {name: 'length', type: 'USHORT', value: 0},
        {name: 'language', type: 'USHORT', value: 0},
        {name: 'segCountX2', type: 'USHORT', value: 0},
        {name: 'searchRange', type: 'USHORT', value: 0},
        {name: 'entrySelector', type: 'USHORT', value: 0},
        {name: 'rangeShift', type: 'USHORT', value: 0}
    ]);

    t.segments = [];
    for (var i = 0; i < glyphs.length; i += 1) {
        var glyph = glyphs.get(i);
        for (var j = 0; j < glyph.unicodes.length; j += 1) {
            addSegment(t, glyph.unicodes[j], i);
        }

        t.segments = t.segments.sort(function(a, b) {
            return a.start - b.start;
        });
    }

    addTerminatorSegment(t);

    var segCount;
    segCount = t.segments.length;
    t.segCountX2 = segCount * 2;
    t.searchRange = Math.pow(2, Math.floor(Math.log(segCount) / Math.log(2))) * 2;
    t.entrySelector = Math.log(t.searchRange / 2) / Math.log(2);
    t.rangeShift = t.segCountX2 - t.searchRange;

    // Set up parallel segment arrays.
    var endCounts = [];
    var startCounts = [];
    var idDeltas = [];
    var idRangeOffsets = [];
    var glyphIds = [];

    for (var i$1 = 0; i$1 < segCount; i$1 += 1) {
        var segment = t.segments[i$1];
        endCounts = endCounts.concat({name: 'end_' + i$1, type: 'USHORT', value: segment.end});
        startCounts = startCounts.concat({name: 'start_' + i$1, type: 'USHORT', value: segment.start});
        idDeltas = idDeltas.concat({name: 'idDelta_' + i$1, type: 'SHORT', value: segment.delta});
        idRangeOffsets = idRangeOffsets.concat({name: 'idRangeOffset_' + i$1, type: 'USHORT', value: segment.offset});
        if (segment.glyphId !== undefined) {
            glyphIds = glyphIds.concat({name: 'glyph_' + i$1, type: 'USHORT', value: segment.glyphId});
        }
    }

    t.fields = t.fields.concat(endCounts);
    t.fields.push({name: 'reservedPad', type: 'USHORT', value: 0});
    t.fields = t.fields.concat(startCounts);
    t.fields = t.fields.concat(idDeltas);
    t.fields = t.fields.concat(idRangeOffsets);
    t.fields = t.fields.concat(glyphIds);

    t.length = 14 + // Subtable header
        endCounts.length * 2 +
        2 + // reservedPad
        startCounts.length * 2 +
        idDeltas.length * 2 +
        idRangeOffsets.length * 2 +
        glyphIds.length * 2;

    return t;
}

var cmap = { parse: parseCmapTable, make: makeCmapTable };

// Glyph encoding

var cffStandardStrings = [
    '.notdef', 'space', 'exclam', 'quotedbl', 'numbersign', 'dollar', 'percent', 'ampersand', 'quoteright',
    'parenleft', 'parenright', 'asterisk', 'plus', 'comma', 'hyphen', 'period', 'slash', 'zero', 'one', 'two',
    'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'colon', 'semicolon', 'less', 'equal', 'greater',
    'question', 'at', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
    'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'bracketleft', 'backslash', 'bracketright', 'asciicircum', 'underscore',
    'quoteleft', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
    'u', 'v', 'w', 'x', 'y', 'z', 'braceleft', 'bar', 'braceright', 'asciitilde', 'exclamdown', 'cent', 'sterling',
    'fraction', 'yen', 'florin', 'section', 'currency', 'quotesingle', 'quotedblleft', 'guillemotleft',
    'guilsinglleft', 'guilsinglright', 'fi', 'fl', 'endash', 'dagger', 'daggerdbl', 'periodcentered', 'paragraph',
    'bullet', 'quotesinglbase', 'quotedblbase', 'quotedblright', 'guillemotright', 'ellipsis', 'perthousand',
    'questiondown', 'grave', 'acute', 'circumflex', 'tilde', 'macron', 'breve', 'dotaccent', 'dieresis', 'ring',
    'cedilla', 'hungarumlaut', 'ogonek', 'caron', 'emdash', 'AE', 'ordfeminine', 'Lslash', 'Oslash', 'OE',
    'ordmasculine', 'ae', 'dotlessi', 'lslash', 'oslash', 'oe', 'germandbls', 'onesuperior', 'logicalnot', 'mu',
    'trademark', 'Eth', 'onehalf', 'plusminus', 'Thorn', 'onequarter', 'divide', 'brokenbar', 'degree', 'thorn',
    'threequarters', 'twosuperior', 'registered', 'minus', 'eth', 'multiply', 'threesuperior', 'copyright',
    'Aacute', 'Acircumflex', 'Adieresis', 'Agrave', 'Aring', 'Atilde', 'Ccedilla', 'Eacute', 'Ecircumflex',
    'Edieresis', 'Egrave', 'Iacute', 'Icircumflex', 'Idieresis', 'Igrave', 'Ntilde', 'Oacute', 'Ocircumflex',
    'Odieresis', 'Ograve', 'Otilde', 'Scaron', 'Uacute', 'Ucircumflex', 'Udieresis', 'Ugrave', 'Yacute',
    'Ydieresis', 'Zcaron', 'aacute', 'acircumflex', 'adieresis', 'agrave', 'aring', 'atilde', 'ccedilla', 'eacute',
    'ecircumflex', 'edieresis', 'egrave', 'iacute', 'icircumflex', 'idieresis', 'igrave', 'ntilde', 'oacute',
    'ocircumflex', 'odieresis', 'ograve', 'otilde', 'scaron', 'uacute', 'ucircumflex', 'udieresis', 'ugrave',
    'yacute', 'ydieresis', 'zcaron', 'exclamsmall', 'Hungarumlautsmall', 'dollaroldstyle', 'dollarsuperior',
    'ampersandsmall', 'Acutesmall', 'parenleftsuperior', 'parenrightsuperior', '266 ff', 'onedotenleader',
    'zerooldstyle', 'oneoldstyle', 'twooldstyle', 'threeoldstyle', 'fouroldstyle', 'fiveoldstyle', 'sixoldstyle',
    'sevenoldstyle', 'eightoldstyle', 'nineoldstyle', 'commasuperior', 'threequartersemdash', 'periodsuperior',
    'questionsmall', 'asuperior', 'bsuperior', 'centsuperior', 'dsuperior', 'esuperior', 'isuperior', 'lsuperior',
    'msuperior', 'nsuperior', 'osuperior', 'rsuperior', 'ssuperior', 'tsuperior', 'ff', 'ffi', 'ffl',
    'parenleftinferior', 'parenrightinferior', 'Circumflexsmall', 'hyphensuperior', 'Gravesmall', 'Asmall',
    'Bsmall', 'Csmall', 'Dsmall', 'Esmall', 'Fsmall', 'Gsmall', 'Hsmall', 'Ismall', 'Jsmall', 'Ksmall', 'Lsmall',
    'Msmall', 'Nsmall', 'Osmall', 'Psmall', 'Qsmall', 'Rsmall', 'Ssmall', 'Tsmall', 'Usmall', 'Vsmall', 'Wsmall',
    'Xsmall', 'Ysmall', 'Zsmall', 'colonmonetary', 'onefitted', 'rupiah', 'Tildesmall', 'exclamdownsmall',
    'centoldstyle', 'Lslashsmall', 'Scaronsmall', 'Zcaronsmall', 'Dieresissmall', 'Brevesmall', 'Caronsmall',
    'Dotaccentsmall', 'Macronsmall', 'figuredash', 'hypheninferior', 'Ogoneksmall', 'Ringsmall', 'Cedillasmall',
    'questiondownsmall', 'oneeighth', 'threeeighths', 'fiveeighths', 'seveneighths', 'onethird', 'twothirds',
    'zerosuperior', 'foursuperior', 'fivesuperior', 'sixsuperior', 'sevensuperior', 'eightsuperior', 'ninesuperior',
    'zeroinferior', 'oneinferior', 'twoinferior', 'threeinferior', 'fourinferior', 'fiveinferior', 'sixinferior',
    'seveninferior', 'eightinferior', 'nineinferior', 'centinferior', 'dollarinferior', 'periodinferior',
    'commainferior', 'Agravesmall', 'Aacutesmall', 'Acircumflexsmall', 'Atildesmall', 'Adieresissmall',
    'Aringsmall', 'AEsmall', 'Ccedillasmall', 'Egravesmall', 'Eacutesmall', 'Ecircumflexsmall', 'Edieresissmall',
    'Igravesmall', 'Iacutesmall', 'Icircumflexsmall', 'Idieresissmall', 'Ethsmall', 'Ntildesmall', 'Ogravesmall',
    'Oacutesmall', 'Ocircumflexsmall', 'Otildesmall', 'Odieresissmall', 'OEsmall', 'Oslashsmall', 'Ugravesmall',
    'Uacutesmall', 'Ucircumflexsmall', 'Udieresissmall', 'Yacutesmall', 'Thornsmall', 'Ydieresissmall', '001.000',
    '001.001', '001.002', '001.003', 'Black', 'Bold', 'Book', 'Light', 'Medium', 'Regular', 'Roman', 'Semibold'];

var cffStandardEncoding = [
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    '', '', '', '', 'space', 'exclam', 'quotedbl', 'numbersign', 'dollar', 'percent', 'ampersand', 'quoteright',
    'parenleft', 'parenright', 'asterisk', 'plus', 'comma', 'hyphen', 'period', 'slash', 'zero', 'one', 'two',
    'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'colon', 'semicolon', 'less', 'equal', 'greater',
    'question', 'at', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
    'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'bracketleft', 'backslash', 'bracketright', 'asciicircum', 'underscore',
    'quoteleft', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
    'u', 'v', 'w', 'x', 'y', 'z', 'braceleft', 'bar', 'braceright', 'asciitilde', '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    'exclamdown', 'cent', 'sterling', 'fraction', 'yen', 'florin', 'section', 'currency', 'quotesingle',
    'quotedblleft', 'guillemotleft', 'guilsinglleft', 'guilsinglright', 'fi', 'fl', '', 'endash', 'dagger',
    'daggerdbl', 'periodcentered', '', 'paragraph', 'bullet', 'quotesinglbase', 'quotedblbase', 'quotedblright',
    'guillemotright', 'ellipsis', 'perthousand', '', 'questiondown', '', 'grave', 'acute', 'circumflex', 'tilde',
    'macron', 'breve', 'dotaccent', 'dieresis', '', 'ring', 'cedilla', '', 'hungarumlaut', 'ogonek', 'caron',
    'emdash', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'AE', '', 'ordfeminine', '', '', '',
    '', 'Lslash', 'Oslash', 'OE', 'ordmasculine', '', '', '', '', '', 'ae', '', '', '', 'dotlessi', '', '',
    'lslash', 'oslash', 'oe', 'germandbls'];

var cffExpertEncoding = [
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    '', '', '', '', 'space', 'exclamsmall', 'Hungarumlautsmall', '', 'dollaroldstyle', 'dollarsuperior',
    'ampersandsmall', 'Acutesmall', 'parenleftsuperior', 'parenrightsuperior', 'twodotenleader', 'onedotenleader',
    'comma', 'hyphen', 'period', 'fraction', 'zerooldstyle', 'oneoldstyle', 'twooldstyle', 'threeoldstyle',
    'fouroldstyle', 'fiveoldstyle', 'sixoldstyle', 'sevenoldstyle', 'eightoldstyle', 'nineoldstyle', 'colon',
    'semicolon', 'commasuperior', 'threequartersemdash', 'periodsuperior', 'questionsmall', '', 'asuperior',
    'bsuperior', 'centsuperior', 'dsuperior', 'esuperior', '', '', 'isuperior', '', '', 'lsuperior', 'msuperior',
    'nsuperior', 'osuperior', '', '', 'rsuperior', 'ssuperior', 'tsuperior', '', 'ff', 'fi', 'fl', 'ffi', 'ffl',
    'parenleftinferior', '', 'parenrightinferior', 'Circumflexsmall', 'hyphensuperior', 'Gravesmall', 'Asmall',
    'Bsmall', 'Csmall', 'Dsmall', 'Esmall', 'Fsmall', 'Gsmall', 'Hsmall', 'Ismall', 'Jsmall', 'Ksmall', 'Lsmall',
    'Msmall', 'Nsmall', 'Osmall', 'Psmall', 'Qsmall', 'Rsmall', 'Ssmall', 'Tsmall', 'Usmall', 'Vsmall', 'Wsmall',
    'Xsmall', 'Ysmall', 'Zsmall', 'colonmonetary', 'onefitted', 'rupiah', 'Tildesmall', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    'exclamdownsmall', 'centoldstyle', 'Lslashsmall', '', '', 'Scaronsmall', 'Zcaronsmall', 'Dieresissmall',
    'Brevesmall', 'Caronsmall', '', 'Dotaccentsmall', '', '', 'Macronsmall', '', '', 'figuredash', 'hypheninferior',
    '', '', 'Ogoneksmall', 'Ringsmall', 'Cedillasmall', '', '', '', 'onequarter', 'onehalf', 'threequarters',
    'questiondownsmall', 'oneeighth', 'threeeighths', 'fiveeighths', 'seveneighths', 'onethird', 'twothirds', '',
    '', 'zerosuperior', 'onesuperior', 'twosuperior', 'threesuperior', 'foursuperior', 'fivesuperior',
    'sixsuperior', 'sevensuperior', 'eightsuperior', 'ninesuperior', 'zeroinferior', 'oneinferior', 'twoinferior',
    'threeinferior', 'fourinferior', 'fiveinferior', 'sixinferior', 'seveninferior', 'eightinferior',
    'nineinferior', 'centinferior', 'dollarinferior', 'periodinferior', 'commainferior', 'Agravesmall',
    'Aacutesmall', 'Acircumflexsmall', 'Atildesmall', 'Adieresissmall', 'Aringsmall', 'AEsmall', 'Ccedillasmall',
    'Egravesmall', 'Eacutesmall', 'Ecircumflexsmall', 'Edieresissmall', 'Igravesmall', 'Iacutesmall',
    'Icircumflexsmall', 'Idieresissmall', 'Ethsmall', 'Ntildesmall', 'Ogravesmall', 'Oacutesmall',
    'Ocircumflexsmall', 'Otildesmall', 'Odieresissmall', 'OEsmall', 'Oslashsmall', 'Ugravesmall', 'Uacutesmall',
    'Ucircumflexsmall', 'Udieresissmall', 'Yacutesmall', 'Thornsmall', 'Ydieresissmall'];

var standardNames = [
    '.notdef', '.null', 'nonmarkingreturn', 'space', 'exclam', 'quotedbl', 'numbersign', 'dollar', 'percent',
    'ampersand', 'quotesingle', 'parenleft', 'parenright', 'asterisk', 'plus', 'comma', 'hyphen', 'period', 'slash',
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'colon', 'semicolon', 'less',
    'equal', 'greater', 'question', 'at', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
    'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'bracketleft', 'backslash', 'bracketright',
    'asciicircum', 'underscore', 'grave', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
    'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'braceleft', 'bar', 'braceright', 'asciitilde',
    'Adieresis', 'Aring', 'Ccedilla', 'Eacute', 'Ntilde', 'Odieresis', 'Udieresis', 'aacute', 'agrave',
    'acircumflex', 'adieresis', 'atilde', 'aring', 'ccedilla', 'eacute', 'egrave', 'ecircumflex', 'edieresis',
    'iacute', 'igrave', 'icircumflex', 'idieresis', 'ntilde', 'oacute', 'ograve', 'ocircumflex', 'odieresis',
    'otilde', 'uacute', 'ugrave', 'ucircumflex', 'udieresis', 'dagger', 'degree', 'cent', 'sterling', 'section',
    'bullet', 'paragraph', 'germandbls', 'registered', 'copyright', 'trademark', 'acute', 'dieresis', 'notequal',
    'AE', 'Oslash', 'infinity', 'plusminus', 'lessequal', 'greaterequal', 'yen', 'mu', 'partialdiff', 'summation',
    'product', 'pi', 'integral', 'ordfeminine', 'ordmasculine', 'Omega', 'ae', 'oslash', 'questiondown',
    'exclamdown', 'logicalnot', 'radical', 'florin', 'approxequal', 'Delta', 'guillemotleft', 'guillemotright',
    'ellipsis', 'nonbreakingspace', 'Agrave', 'Atilde', 'Otilde', 'OE', 'oe', 'endash', 'emdash', 'quotedblleft',
    'quotedblright', 'quoteleft', 'quoteright', 'divide', 'lozenge', 'ydieresis', 'Ydieresis', 'fraction',
    'currency', 'guilsinglleft', 'guilsinglright', 'fi', 'fl', 'daggerdbl', 'periodcentered', 'quotesinglbase',
    'quotedblbase', 'perthousand', 'Acircumflex', 'Ecircumflex', 'Aacute', 'Edieresis', 'Egrave', 'Iacute',
    'Icircumflex', 'Idieresis', 'Igrave', 'Oacute', 'Ocircumflex', 'apple', 'Ograve', 'Uacute', 'Ucircumflex',
    'Ugrave', 'dotlessi', 'circumflex', 'tilde', 'macron', 'breve', 'dotaccent', 'ring', 'cedilla', 'hungarumlaut',
    'ogonek', 'caron', 'Lslash', 'lslash', 'Scaron', 'scaron', 'Zcaron', 'zcaron', 'brokenbar', 'Eth', 'eth',
    'Yacute', 'yacute', 'Thorn', 'thorn', 'minus', 'multiply', 'onesuperior', 'twosuperior', 'threesuperior',
    'onehalf', 'onequarter', 'threequarters', 'franc', 'Gbreve', 'gbreve', 'Idotaccent', 'Scedilla', 'scedilla',
    'Cacute', 'cacute', 'Ccaron', 'ccaron', 'dcroat'];

/**
 * This is the encoding used for fonts created from scratch.
 * It loops through all glyphs and finds the appropriate unicode value.
 * Since it's linear time, other encodings will be faster.
 * @exports opentype.DefaultEncoding
 * @class
 * @constructor
 * @param {opentype.Font}
 */
function DefaultEncoding(font) {
    this.font = font;
}

DefaultEncoding.prototype.charToGlyphIndex = function(c) {
    var code = c.charCodeAt(0);
    var glyphs = this.font.glyphs;
    if (glyphs) {
        for (var i = 0; i < glyphs.length; i += 1) {
            var glyph = glyphs.get(i);
            for (var j = 0; j < glyph.unicodes.length; j += 1) {
                if (glyph.unicodes[j] === code) {
                    return i;
                }
            }
        }
    }
    return null;
};

/**
 * @exports opentype.CmapEncoding
 * @class
 * @constructor
 * @param {Object} cmap - a object with the cmap encoded data
 */
function CmapEncoding(cmap) {
    this.cmap = cmap;
}

/**
 * @param  {string} c - the character
 * @return {number} The glyph index.
 */
CmapEncoding.prototype.charToGlyphIndex = function(c) {
    return this.cmap.glyphIndexMap[c.charCodeAt(0)] || 0;
};

/**
 * @exports opentype.CffEncoding
 * @class
 * @constructor
 * @param {string} encoding - The encoding
 * @param {Array} charset - The character set.
 */
function CffEncoding(encoding, charset) {
    this.encoding = encoding;
    this.charset = charset;
}

/**
 * @param  {string} s - The character
 * @return {number} The index.
 */
CffEncoding.prototype.charToGlyphIndex = function(s) {
    var code = s.charCodeAt(0);
    var charName = this.encoding[code];
    return this.charset.indexOf(charName);
};

/**
 * @exports opentype.GlyphNames
 * @class
 * @constructor
 * @param {Object} post
 */
function GlyphNames(post) {
    var this$1 = this;

    switch (post.version) {
        case 1:
            this.names = standardNames.slice();
            break;
        case 2:
            this.names = new Array(post.numberOfGlyphs);
            for (var i = 0; i < post.numberOfGlyphs; i++) {
                if (post.glyphNameIndex[i] < standardNames.length) {
                    this$1.names[i] = standardNames[post.glyphNameIndex[i]];
                } else {
                    this$1.names[i] = post.names[post.glyphNameIndex[i] - standardNames.length];
                }
            }

            break;
        case 2.5:
            this.names = new Array(post.numberOfGlyphs);
            for (var i$1 = 0; i$1 < post.numberOfGlyphs; i$1++) {
                this$1.names[i$1] = standardNames[i$1 + post.glyphNameIndex[i$1]];
            }

            break;
        case 3:
            this.names = [];
            break;
        default:
            this.names = [];
            break;
    }
}

/**
 * Gets the index of a glyph by name.
 * @param  {string} name - The glyph name
 * @return {number} The index
 */
GlyphNames.prototype.nameToGlyphIndex = function(name) {
    return this.names.indexOf(name);
};

/**
 * @param  {number} gid
 * @return {string}
 */
GlyphNames.prototype.glyphIndexToName = function(gid) {
    return this.names[gid];
};

/**
 * @alias opentype.addGlyphNames
 * @param {opentype.Font}
 */
function addGlyphNames(font) {
    var glyph;
    var glyphIndexMap = font.tables.cmap.glyphIndexMap;
    var charCodes = Object.keys(glyphIndexMap);

    for (var i = 0; i < charCodes.length; i += 1) {
        var c = charCodes[i];
        var glyphIndex = glyphIndexMap[c];
        glyph = font.glyphs.get(glyphIndex);
        glyph.addUnicode(parseInt(c));
    }

    for (var i$1 = 0; i$1 < font.glyphs.length; i$1 += 1) {
        glyph = font.glyphs.get(i$1);
        if (font.cffEncoding) {
            if (font.isCIDFont) {
                glyph.name = 'gid' + i$1;
            } else {
                glyph.name = font.cffEncoding.charset[i$1];
            }
        } else if (font.glyphNames.names) {
            glyph.name = font.glyphNames.glyphIndexToName(i$1);
        }
    }
}

// Drawing utility functions.

// Draw a line on the given context from point `x1,y1` to point `x2,y2`.
function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

var draw = { line: line };

// The `glyf` table describes the glyphs in TrueType outline format.
// http://www.microsoft.com/typography/otspec/glyf.htm

// Parse the coordinate data for a glyph.
function parseGlyphCoordinate(p, flag, previousValue, shortVectorBitMask, sameBitMask) {
    var v;
    if ((flag & shortVectorBitMask) > 0) {
        // The coordinate is 1 byte long.
        v = p.parseByte();
        // The `same` bit is re-used for short values to signify the sign of the value.
        if ((flag & sameBitMask) === 0) {
            v = -v;
        }

        v = previousValue + v;
    } else {
        //  The coordinate is 2 bytes long.
        // If the `same` bit is set, the coordinate is the same as the previous coordinate.
        if ((flag & sameBitMask) > 0) {
            v = previousValue;
        } else {
            // Parse the coordinate as a signed 16-bit delta value.
            v = previousValue + p.parseShort();
        }
    }

    return v;
}

// Parse a TrueType glyph.
function parseGlyph(glyph, data, start) {
    var p = new parse.Parser(data, start);
    glyph.numberOfContours = p.parseShort();
    glyph._xMin = p.parseShort();
    glyph._yMin = p.parseShort();
    glyph._xMax = p.parseShort();
    glyph._yMax = p.parseShort();
    var flags;
    var flag;

    if (glyph.numberOfContours > 0) {
        // This glyph is not a composite.
        var endPointIndices = glyph.endPointIndices = [];
        for (var i = 0; i < glyph.numberOfContours; i += 1) {
            endPointIndices.push(p.parseUShort());
        }

        glyph.instructionLength = p.parseUShort();
        glyph.instructions = [];
        for (var i$1 = 0; i$1 < glyph.instructionLength; i$1 += 1) {
            glyph.instructions.push(p.parseByte());
        }

        var numberOfCoordinates = endPointIndices[endPointIndices.length - 1] + 1;
        flags = [];
        for (var i$2 = 0; i$2 < numberOfCoordinates; i$2 += 1) {
            flag = p.parseByte();
            flags.push(flag);
            // If bit 3 is set, we repeat this flag n times, where n is the next byte.
            if ((flag & 8) > 0) {
                var repeatCount = p.parseByte();
                for (var j = 0; j < repeatCount; j += 1) {
                    flags.push(flag);
                    i$2 += 1;
                }
            }
        }

        check.argument(flags.length === numberOfCoordinates, 'Bad flags.');

        if (endPointIndices.length > 0) {
            var points = [];
            var point;
            // X/Y coordinates are relative to the previous point, except for the first point which is relative to 0,0.
            if (numberOfCoordinates > 0) {
                for (var i$3 = 0; i$3 < numberOfCoordinates; i$3 += 1) {
                    flag = flags[i$3];
                    point = {};
                    point.onCurve = !!(flag & 1);
                    point.lastPointOfContour = endPointIndices.indexOf(i$3) >= 0;
                    points.push(point);
                }

                var px = 0;
                for (var i$4 = 0; i$4 < numberOfCoordinates; i$4 += 1) {
                    flag = flags[i$4];
                    point = points[i$4];
                    point.x = parseGlyphCoordinate(p, flag, px, 2, 16);
                    px = point.x;
                }

                var py = 0;
                for (var i$5 = 0; i$5 < numberOfCoordinates; i$5 += 1) {
                    flag = flags[i$5];
                    point = points[i$5];
                    point.y = parseGlyphCoordinate(p, flag, py, 4, 32);
                    py = point.y;
                }
            }

            glyph.points = points;
        } else {
            glyph.points = [];
        }
    } else if (glyph.numberOfContours === 0) {
        glyph.points = [];
    } else {
        glyph.isComposite = true;
        glyph.points = [];
        glyph.components = [];
        var moreComponents = true;
        while (moreComponents) {
            flags = p.parseUShort();
            var component = {
                glyphIndex: p.parseUShort(),
                xScale: 1,
                scale01: 0,
                scale10: 0,
                yScale: 1,
                dx: 0,
                dy: 0
            };
            if ((flags & 1) > 0) {
                // The arguments are words
                if ((flags & 2) > 0) {
                    // values are offset
                    component.dx = p.parseShort();
                    component.dy = p.parseShort();
                } else {
                    // values are matched points
                    component.matchedPoints = [p.parseUShort(), p.parseUShort()];
                }

            } else {
                // The arguments are bytes
                if ((flags & 2) > 0) {
                    // values are offset
                    component.dx = p.parseChar();
                    component.dy = p.parseChar();
                } else {
                    // values are matched points
                    component.matchedPoints = [p.parseByte(), p.parseByte()];
                }
            }

            if ((flags & 8) > 0) {
                // We have a scale
                component.xScale = component.yScale = p.parseF2Dot14();
            } else if ((flags & 64) > 0) {
                // We have an X / Y scale
                component.xScale = p.parseF2Dot14();
                component.yScale = p.parseF2Dot14();
            } else if ((flags & 128) > 0) {
                // We have a 2x2 transformation
                component.xScale = p.parseF2Dot14();
                component.scale01 = p.parseF2Dot14();
                component.scale10 = p.parseF2Dot14();
                component.yScale = p.parseF2Dot14();
            }

            glyph.components.push(component);
            moreComponents = !!(flags & 32);
        }
        if (flags & 0x100) {
            // We have instructions
            glyph.instructionLength = p.parseUShort();
            glyph.instructions = [];
            for (var i$6 = 0; i$6 < glyph.instructionLength; i$6 += 1) {
                glyph.instructions.push(p.parseByte());
            }
        }
    }
}

// Transform an array of points and return a new array.
function transformPoints(points, transform) {
    var newPoints = [];
    for (var i = 0; i < points.length; i += 1) {
        var pt = points[i];
        var newPt = {
            x: transform.xScale * pt.x + transform.scale01 * pt.y + transform.dx,
            y: transform.scale10 * pt.x + transform.yScale * pt.y + transform.dy,
            onCurve: pt.onCurve,
            lastPointOfContour: pt.lastPointOfContour
        };
        newPoints.push(newPt);
    }

    return newPoints;
}

function getContours(points) {
    var contours = [];
    var currentContour = [];
    for (var i = 0; i < points.length; i += 1) {
        var pt = points[i];
        currentContour.push(pt);
        if (pt.lastPointOfContour) {
            contours.push(currentContour);
            currentContour = [];
        }
    }

    check.argument(currentContour.length === 0, 'There are still points left in the current contour.');
    return contours;
}

// Convert the TrueType glyph outline to a Path.
function getPath(points) {
    var p = new Path();
    if (!points) {
        return p;
    }

    var contours = getContours(points);

    for (var contourIndex = 0; contourIndex < contours.length; ++contourIndex) {
        var contour = contours[contourIndex];

        var prev = null;
        var curr = contour[contour.length - 1];
        var next = contour[0];

        if (curr.onCurve) {
            p.moveTo(curr.x, curr.y);
        } else {
            if (next.onCurve) {
                p.moveTo(next.x, next.y);
            } else {
                // If both first and last points are off-curve, start at their middle.
                var start = {x: (curr.x + next.x) * 0.5, y: (curr.y + next.y) * 0.5};
                p.moveTo(start.x, start.y);
            }
        }

        for (var i = 0; i < contour.length; ++i) {
            prev = curr;
            curr = next;
            next = contour[(i + 1) % contour.length];

            if (curr.onCurve) {
                // This is a straight line.
                p.lineTo(curr.x, curr.y);
            } else {
                var prev2 = prev;
                var next2 = next;

                if (!prev.onCurve) {
                    prev2 = { x: (curr.x + prev.x) * 0.5, y: (curr.y + prev.y) * 0.5 };
                    p.lineTo(prev2.x, prev2.y);
                }

                if (!next.onCurve) {
                    next2 = { x: (curr.x + next.x) * 0.5, y: (curr.y + next.y) * 0.5 };
                }

                p.lineTo(prev2.x, prev2.y);
                p.quadraticCurveTo(curr.x, curr.y, next2.x, next2.y);
            }
        }

        p.closePath();
    }
    return p;
}

function buildPath(glyphs, glyph) {
    if (glyph.isComposite) {
        for (var j = 0; j < glyph.components.length; j += 1) {
            var component = glyph.components[j];
            var componentGlyph = glyphs.get(component.glyphIndex);
            // Force the ttfGlyphLoader to parse the glyph.
            componentGlyph.getPath();
            if (componentGlyph.points) {
                var transformedPoints = (void 0);
                if (component.matchedPoints === undefined) {
                    // component positioned by offset
                    transformedPoints = transformPoints(componentGlyph.points, component);
                } else {
                    // component positioned by matched points
                    if ((component.matchedPoints[0] > glyph.points.length - 1) ||
                        (component.matchedPoints[1] > componentGlyph.points.length - 1)) {
                        throw Error('Matched points out of range in ' + glyph.name);
                    }
                    var firstPt = glyph.points[component.matchedPoints[0]];
                    var secondPt = componentGlyph.points[component.matchedPoints[1]];
                    var transform = {
                        xScale: component.xScale, scale01: component.scale01,
                        scale10: component.scale10, yScale: component.yScale,
                        dx: 0, dy: 0
                    };
                    secondPt = transformPoints([secondPt], transform)[0];
                    transform.dx = firstPt.x - secondPt.x;
                    transform.dy = firstPt.y - secondPt.y;
                    transformedPoints = transformPoints(componentGlyph.points, transform);
                }
                glyph.points = glyph.points.concat(transformedPoints);
            }
        }
    }

    return getPath(glyph.points);
}

// Parse all the glyphs according to the offsets from the `loca` table.
function parseGlyfTable(data, start, loca, font) {
    var glyphs = new glyphset.GlyphSet(font);

    // The last element of the loca table is invalid.
    for (var i = 0; i < loca.length - 1; i += 1) {
        var offset = loca[i];
        var nextOffset = loca[i + 1];
        if (offset !== nextOffset) {
            glyphs.push(i, glyphset.ttfGlyphLoader(font, i, parseGlyph, data, start + offset, buildPath));
        } else {
            glyphs.push(i, glyphset.glyphLoader(font, i));
        }
    }

    return glyphs;
}

var glyf = { getPath: getPath, parse: parseGlyfTable };

// The Glyph object

function getPathDefinition(glyph, path) {
    var _path = path || {commands: []};
    return {
        configurable: true,

        get: function() {
            if (typeof _path === 'function') {
                _path = _path();
            }

            return _path;
        },

        set: function(p) {
            _path = p;
        }
    };
}
/**
 * @typedef GlyphOptions
 * @type Object
 * @property {string} [name] - The glyph name
 * @property {number} [unicode]
 * @property {Array} [unicodes]
 * @property {number} [xMin]
 * @property {number} [yMin]
 * @property {number} [xMax]
 * @property {number} [yMax]
 * @property {number} [advanceWidth]
 */

// A Glyph is an individual mark that often corresponds to a character.
// Some glyphs, such as ligatures, are a combination of many characters.
// Glyphs are the basic building blocks of a font.
//
// The `Glyph` class contains utility methods for drawing the path and its points.
/**
 * @exports opentype.Glyph
 * @class
 * @param {GlyphOptions}
 * @constructor
 */
function Glyph(options) {
    // By putting all the code on a prototype function (which is only declared once)
    // we reduce the memory requirements for larger fonts by some 2%
    this.bindConstructorValues(options);
}

/**
 * @param  {GlyphOptions}
 */
Glyph.prototype.bindConstructorValues = function(options) {
    this.index = options.index || 0;

    // These three values cannot be deferred for memory optimization:
    this.name = options.name || null;
    this.unicode = options.unicode || undefined;
    this.unicodes = options.unicodes || options.unicode !== undefined ? [options.unicode] : [];

    // But by binding these values only when necessary, we reduce can
    // the memory requirements by almost 3% for larger fonts.
    if (options.xMin) {
        this.xMin = options.xMin;
    }

    if (options.yMin) {
        this.yMin = options.yMin;
    }

    if (options.xMax) {
        this.xMax = options.xMax;
    }

    if (options.yMax) {
        this.yMax = options.yMax;
    }

    if (options.advanceWidth) {
        this.advanceWidth = options.advanceWidth;
    }

    // The path for a glyph is the most memory intensive, and is bound as a value
    // with a getter/setter to ensure we actually do path parsing only once the
    // path is actually needed by anything.
    Object.defineProperty(this, 'path', getPathDefinition(this, options.path));
};

/**
 * @param {number}
 */
Glyph.prototype.addUnicode = function(unicode) {
    if (this.unicodes.length === 0) {
        this.unicode = unicode;
    }

    this.unicodes.push(unicode);
};

/**
 * Calculate the minimum bounding box for this glyph.
 * @return {opentype.BoundingBox}
 */
Glyph.prototype.getBoundingBox = function() {
    return this.path.getBoundingBox();
};

/**
 * Convert the glyph to a Path we can draw on a drawing context.
 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
 * @param  {Object=} options - xScale, yScale to stretch the glyph.
 * @param  {opentype.Font} if hinting is to be used, the font
 * @return {opentype.Path}
 */
Glyph.prototype.getPath = function(x, y, fontSize, options, font) {
    x = x !== undefined ? x : 0;
    y = y !== undefined ? y : 0;
    fontSize = fontSize !== undefined ? fontSize : 72;
    var commands;
    var hPoints;
    if (!options) { options = { }; }
    var xScale = options.xScale;
    var yScale = options.yScale;

    if (options.hinting && font && font.hinting) {
        // in case of hinting, the hinting engine takes care
        // of scaling the points (not the path) before hinting.
        hPoints = this.path && font.hinting.exec(this, fontSize);
        // in case the hinting engine failed hPoints is undefined
        // and thus reverts to plain rending
    }

    if (hPoints) {
        commands = glyf.getPath(hPoints).commands;
        x = Math.round(x);
        y = Math.round(y);
        // TODO in case of hinting xyScaling is not yet supported
        xScale = yScale = 1;
    } else {
        commands = this.path.commands;
        var scale = 1 / this.path.unitsPerEm * fontSize;
        if (xScale === undefined) { xScale = scale; }
        if (yScale === undefined) { yScale = scale; }
    }

    var p = new Path();
    for (var i = 0; i < commands.length; i += 1) {
        var cmd = commands[i];
        if (cmd.type === 'M') {
            p.moveTo(x + (cmd.x * xScale), y + (-cmd.y * yScale));
        } else if (cmd.type === 'L') {
            p.lineTo(x + (cmd.x * xScale), y + (-cmd.y * yScale));
        } else if (cmd.type === 'Q') {
            p.quadraticCurveTo(x + (cmd.x1 * xScale), y + (-cmd.y1 * yScale),
                               x + (cmd.x * xScale), y + (-cmd.y * yScale));
        } else if (cmd.type === 'C') {
            p.curveTo(x + (cmd.x1 * xScale), y + (-cmd.y1 * yScale),
                      x + (cmd.x2 * xScale), y + (-cmd.y2 * yScale),
                      x + (cmd.x * xScale), y + (-cmd.y * yScale));
        } else if (cmd.type === 'Z') {
            p.closePath();
        }
    }

    return p;
};

/**
 * Split the glyph into contours.
 * This function is here for backwards compatibility, and to
 * provide raw access to the TrueType glyph outlines.
 * @return {Array}
 */
Glyph.prototype.getContours = function() {
    var this$1 = this;

    if (this.points === undefined) {
        return [];
    }

    var contours = [];
    var currentContour = [];
    for (var i = 0; i < this.points.length; i += 1) {
        var pt = this$1.points[i];
        currentContour.push(pt);
        if (pt.lastPointOfContour) {
            contours.push(currentContour);
            currentContour = [];
        }
    }

    check.argument(currentContour.length === 0, 'There are still points left in the current contour.');
    return contours;
};

/**
 * Calculate the xMin/yMin/xMax/yMax/lsb/rsb for a Glyph.
 * @return {Object}
 */
Glyph.prototype.getMetrics = function() {
    var commands = this.path.commands;
    var xCoords = [];
    var yCoords = [];
    for (var i = 0; i < commands.length; i += 1) {
        var cmd = commands[i];
        if (cmd.type !== 'Z') {
            xCoords.push(cmd.x);
            yCoords.push(cmd.y);
        }

        if (cmd.type === 'Q' || cmd.type === 'C') {
            xCoords.push(cmd.x1);
            yCoords.push(cmd.y1);
        }

        if (cmd.type === 'C') {
            xCoords.push(cmd.x2);
            yCoords.push(cmd.y2);
        }
    }

    var metrics = {
        xMin: Math.min.apply(null, xCoords),
        yMin: Math.min.apply(null, yCoords),
        xMax: Math.max.apply(null, xCoords),
        yMax: Math.max.apply(null, yCoords),
        leftSideBearing: this.leftSideBearing
    };

    if (!isFinite(metrics.xMin)) {
        metrics.xMin = 0;
    }

    if (!isFinite(metrics.xMax)) {
        metrics.xMax = this.advanceWidth;
    }

    if (!isFinite(metrics.yMin)) {
        metrics.yMin = 0;
    }

    if (!isFinite(metrics.yMax)) {
        metrics.yMax = 0;
    }

    metrics.rightSideBearing = this.advanceWidth - metrics.leftSideBearing - (metrics.xMax - metrics.xMin);
    return metrics;
};

/**
 * Draw the glyph on the given context.
 * @param  {CanvasRenderingContext2D} ctx - A 2D drawing context, like Canvas.
 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
 * @param  {Object=} options - xScale, yScale to stretch the glyph.
 */
Glyph.prototype.draw = function(ctx, x, y, fontSize, options) {
    this.getPath(x, y, fontSize, options).draw(ctx);
};

/**
 * Draw the points of the glyph.
 * On-curve points will be drawn in blue, off-curve points will be drawn in red.
 * @param  {CanvasRenderingContext2D} ctx - A 2D drawing context, like Canvas.
 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
 */
Glyph.prototype.drawPoints = function(ctx, x, y, fontSize) {
    function drawCircles(l, x, y, scale) {
        var PI_SQ = Math.PI * 2;
        ctx.beginPath();
        for (var j = 0; j < l.length; j += 1) {
            ctx.moveTo(x + (l[j].x * scale), y + (l[j].y * scale));
            ctx.arc(x + (l[j].x * scale), y + (l[j].y * scale), 2, 0, PI_SQ, false);
        }

        ctx.closePath();
        ctx.fill();
    }

    x = x !== undefined ? x : 0;
    y = y !== undefined ? y : 0;
    fontSize = fontSize !== undefined ? fontSize : 24;
    var scale = 1 / this.path.unitsPerEm * fontSize;

    var blueCircles = [];
    var redCircles = [];
    var path = this.path;
    for (var i = 0; i < path.commands.length; i += 1) {
        var cmd = path.commands[i];
        if (cmd.x !== undefined) {
            blueCircles.push({x: cmd.x, y: -cmd.y});
        }

        if (cmd.x1 !== undefined) {
            redCircles.push({x: cmd.x1, y: -cmd.y1});
        }

        if (cmd.x2 !== undefined) {
            redCircles.push({x: cmd.x2, y: -cmd.y2});
        }
    }

    ctx.fillStyle = 'blue';
    drawCircles(blueCircles, x, y, scale);
    ctx.fillStyle = 'red';
    drawCircles(redCircles, x, y, scale);
};

/**
 * Draw lines indicating important font measurements.
 * Black lines indicate the origin of the coordinate system (point 0,0).
 * Blue lines indicate the glyph bounding box.
 * Green line indicates the advance width of the glyph.
 * @param  {CanvasRenderingContext2D} ctx - A 2D drawing context, like Canvas.
 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
 */
Glyph.prototype.drawMetrics = function(ctx, x, y, fontSize) {
    var scale;
    x = x !== undefined ? x : 0;
    y = y !== undefined ? y : 0;
    fontSize = fontSize !== undefined ? fontSize : 24;
    scale = 1 / this.path.unitsPerEm * fontSize;
    ctx.lineWidth = 1;

    // Draw the origin
    ctx.strokeStyle = 'black';
    draw.line(ctx, x, -10000, x, 10000);
    draw.line(ctx, -10000, y, 10000, y);

    // This code is here due to memory optimization: by not using
    // defaults in the constructor, we save a notable amount of memory.
    var xMin = this.xMin || 0;
    var yMin = this.yMin || 0;
    var xMax = this.xMax || 0;
    var yMax = this.yMax || 0;
    var advanceWidth = this.advanceWidth || 0;

    // Draw the glyph box
    ctx.strokeStyle = 'blue';
    draw.line(ctx, x + (xMin * scale), -10000, x + (xMin * scale), 10000);
    draw.line(ctx, x + (xMax * scale), -10000, x + (xMax * scale), 10000);
    draw.line(ctx, -10000, y + (-yMin * scale), 10000, y + (-yMin * scale));
    draw.line(ctx, -10000, y + (-yMax * scale), 10000, y + (-yMax * scale));

    // Draw the advance width
    ctx.strokeStyle = 'green';
    draw.line(ctx, x + (advanceWidth * scale), -10000, x + (advanceWidth * scale), 10000);
};

// The GlyphSet object

// Define a property on the glyph that depends on the path being loaded.
function defineDependentProperty(glyph, externalName, internalName) {
    Object.defineProperty(glyph, externalName, {
        get: function() {
            // Request the path property to make sure the path is loaded.
            glyph.path; // jshint ignore:line
            return glyph[internalName];
        },
        set: function(newValue) {
            glyph[internalName] = newValue;
        },
        enumerable: true,
        configurable: true
    });
}

/**
 * A GlyphSet represents all glyphs available in the font, but modelled using
 * a deferred glyph loader, for retrieving glyphs only once they are absolutely
 * necessary, to keep the memory footprint down.
 * @exports opentype.GlyphSet
 * @class
 * @param {opentype.Font}
 * @param {Array}
 */
function GlyphSet(font, glyphs) {
    var this$1 = this;

    this.font = font;
    this.glyphs = {};
    if (Array.isArray(glyphs)) {
        for (var i = 0; i < glyphs.length; i++) {
            this$1.glyphs[i] = glyphs[i];
        }
    }

    this.length = (glyphs && glyphs.length) || 0;
}

/**
 * @param  {number} index
 * @return {opentype.Glyph}
 */
GlyphSet.prototype.get = function(index) {
    if (typeof this.glyphs[index] === 'function') {
        this.glyphs[index] = this.glyphs[index]();
    }

    return this.glyphs[index];
};

/**
 * @param  {number} index
 * @param  {Object}
 */
GlyphSet.prototype.push = function(index, loader) {
    this.glyphs[index] = loader;
    this.length++;
};

/**
 * @alias opentype.glyphLoader
 * @param  {opentype.Font} font
 * @param  {number} index
 * @return {opentype.Glyph}
 */
function glyphLoader(font, index) {
    return new Glyph({index: index, font: font});
}

/**
 * Generate a stub glyph that can be filled with all metadata *except*
 * the "points" and "path" properties, which must be loaded only once
 * the glyph's path is actually requested for text shaping.
 * @alias opentype.ttfGlyphLoader
 * @param  {opentype.Font} font
 * @param  {number} index
 * @param  {Function} parseGlyph
 * @param  {Object} data
 * @param  {number} position
 * @param  {Function} buildPath
 * @return {opentype.Glyph}
 */
function ttfGlyphLoader(font, index, parseGlyph, data, position, buildPath) {
    return function() {
        var glyph = new Glyph({index: index, font: font});

        glyph.path = function() {
            parseGlyph(glyph, data, position);
            var path = buildPath(font.glyphs, glyph);
            path.unitsPerEm = font.unitsPerEm;
            return path;
        };

        defineDependentProperty(glyph, 'xMin', '_xMin');
        defineDependentProperty(glyph, 'xMax', '_xMax');
        defineDependentProperty(glyph, 'yMin', '_yMin');
        defineDependentProperty(glyph, 'yMax', '_yMax');

        return glyph;
    };
}
/**
 * @alias opentype.cffGlyphLoader
 * @param  {opentype.Font} font
 * @param  {number} index
 * @param  {Function} parseCFFCharstring
 * @param  {string} charstring
 * @return {opentype.Glyph}
 */
function cffGlyphLoader(font, index, parseCFFCharstring, charstring) {
    return function() {
        var glyph = new Glyph({index: index, font: font});

        glyph.path = function() {
            var path = parseCFFCharstring(font, glyph, charstring);
            path.unitsPerEm = font.unitsPerEm;
            return path;
        };

        return glyph;
    };
}

var glyphset = { GlyphSet: GlyphSet, glyphLoader: glyphLoader, ttfGlyphLoader: ttfGlyphLoader, cffGlyphLoader: cffGlyphLoader };

// The `CFF` table contains the glyph outlines in PostScript format.
// https://www.microsoft.com/typography/OTSPEC/cff.htm
// http://download.microsoft.com/download/8/0/1/801a191c-029d-4af3-9642-555f6fe514ee/cff.pdf
// http://download.microsoft.com/download/8/0/1/801a191c-029d-4af3-9642-555f6fe514ee/type2.pdf

// Custom equals function that can also check lists.
function equals(a, b) {
    if (a === b) {
        return true;
    } else if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }

        for (var i = 0; i < a.length; i += 1) {
            if (!equals(a[i], b[i])) {
                return false;
            }
        }

        return true;
    } else {
        return false;
    }
}

// Subroutines are encoded using the negative half of the number space.
// See type 2 chapter 4.7 "Subroutine operators".
function calcCFFSubroutineBias(subrs) {
    var bias;
    if (subrs.length < 1240) {
        bias = 107;
    } else if (subrs.length < 33900) {
        bias = 1131;
    } else {
        bias = 32768;
    }

    return bias;
}

// Parse a `CFF` INDEX array.
// An index array consists of a list of offsets, then a list of objects at those offsets.
function parseCFFIndex(data, start, conversionFn) {
    var offsets = [];
    var objects = [];
    var count = parse.getCard16(data, start);
    var objectOffset;
    var endOffset;
    if (count !== 0) {
        var offsetSize = parse.getByte(data, start + 2);
        objectOffset = start + ((count + 1) * offsetSize) + 2;
        var pos = start + 3;
        for (var i = 0; i < count + 1; i += 1) {
            offsets.push(parse.getOffset(data, pos, offsetSize));
            pos += offsetSize;
        }

        // The total size of the index array is 4 header bytes + the value of the last offset.
        endOffset = objectOffset + offsets[count];
    } else {
        endOffset = start + 2;
    }

    for (var i$1 = 0; i$1 < offsets.length - 1; i$1 += 1) {
        var value = parse.getBytes(data, objectOffset + offsets[i$1], objectOffset + offsets[i$1 + 1]);
        if (conversionFn) {
            value = conversionFn(value);
        }

        objects.push(value);
    }

    return {objects: objects, startOffset: start, endOffset: endOffset};
}

// Parse a `CFF` DICT real value.
function parseFloatOperand(parser) {
    var s = '';
    var eof = 15;
    var lookup = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', 'E', 'E-', null, '-'];
    while (true) {
        var b = parser.parseByte();
        var n1 = b >> 4;
        var n2 = b & 15;

        if (n1 === eof) {
            break;
        }

        s += lookup[n1];

        if (n2 === eof) {
            break;
        }

        s += lookup[n2];
    }

    return parseFloat(s);
}

// Parse a `CFF` DICT operand.
function parseOperand(parser, b0) {
    var b1;
    var b2;
    var b3;
    var b4;
    if (b0 === 28) {
        b1 = parser.parseByte();
        b2 = parser.parseByte();
        return b1 << 8 | b2;
    }

    if (b0 === 29) {
        b1 = parser.parseByte();
        b2 = parser.parseByte();
        b3 = parser.parseByte();
        b4 = parser.parseByte();
        return b1 << 24 | b2 << 16 | b3 << 8 | b4;
    }

    if (b0 === 30) {
        return parseFloatOperand(parser);
    }

    if (b0 >= 32 && b0 <= 246) {
        return b0 - 139;
    }

    if (b0 >= 247 && b0 <= 250) {
        b1 = parser.parseByte();
        return (b0 - 247) * 256 + b1 + 108;
    }

    if (b0 >= 251 && b0 <= 254) {
        b1 = parser.parseByte();
        return -(b0 - 251) * 256 - b1 - 108;
    }

    throw new Error('Invalid b0 ' + b0);
}

// Convert the entries returned by `parseDict` to a proper dictionary.
// If a value is a list of one, it is unpacked.
function entriesToObject(entries) {
    var o = {};
    for (var i = 0; i < entries.length; i += 1) {
        var key = entries[i][0];
        var values = entries[i][1];
        var value = (void 0);
        if (values.length === 1) {
            value = values[0];
        } else {
            value = values;
        }

        if (o.hasOwnProperty(key) && !isNaN(o[key])) {
            throw new Error('Object ' + o + ' already has key ' + key);
        }

        o[key] = value;
    }

    return o;
}

// Parse a `CFF` DICT object.
// A dictionary contains key-value pairs in a compact tokenized format.
function parseCFFDict(data, start, size) {
    start = start !== undefined ? start : 0;
    var parser = new parse.Parser(data, start);
    var entries = [];
    var operands = [];
    size = size !== undefined ? size : data.length;

    while (parser.relativeOffset < size) {
        var op = parser.parseByte();

        // The first byte for each dict item distinguishes between operator (key) and operand (value).
        // Values <= 21 are operators.
        if (op <= 21) {
            // Two-byte operators have an initial escape byte of 12.
            if (op === 12) {
                op = 1200 + parser.parseByte();
            }

            entries.push([op, operands]);
            operands = [];
        } else {
            // Since the operands (values) come before the operators (keys), we store all operands in a list
            // until we encounter an operator.
            operands.push(parseOperand(parser, op));
        }
    }

    return entriesToObject(entries);
}

// Given a String Index (SID), return the value of the string.
// Strings below index 392 are standard CFF strings and are not encoded in the font.
function getCFFString(strings, index) {
    if (index <= 390) {
        index = cffStandardStrings[index];
    } else {
        index = strings[index - 391];
    }

    return index;
}

// Interpret a dictionary and return a new dictionary with readable keys and values for missing entries.
// This function takes `meta` which is a list of objects containing `operand`, `name` and `default`.
function interpretDict(dict, meta, strings) {
    var newDict = {};
    var value;

    // Because we also want to include missing values, we start out from the meta list
    // and lookup values in the dict.
    for (var i = 0; i < meta.length; i += 1) {
        var m = meta[i];

        if (Array.isArray(m.type)) {
            var values = [];
            values.length = m.type.length;
            for (var j = 0; j < m.type.length; j++) {
                value = dict[m.op] !== undefined ? dict[m.op][j] : undefined;
                if (value === undefined) {
                    value = m.value !== undefined && m.value[j] !== undefined ? m.value[j] : null;
                }
                if (m.type[j] === 'SID') {
                    value = getCFFString(strings, value);
                }
                values[j] = value;
            }
            newDict[m.name] = values;
        } else {
            value = dict[m.op];
            if (value === undefined) {
                value = m.value !== undefined ? m.value : null;
            }

            if (m.type === 'SID') {
                value = getCFFString(strings, value);
            }
            newDict[m.name] = value;
        }
    }

    return newDict;
}

// Parse the CFF header.
function parseCFFHeader(data, start) {
    var header = {};
    header.formatMajor = parse.getCard8(data, start);
    header.formatMinor = parse.getCard8(data, start + 1);
    header.size = parse.getCard8(data, start + 2);
    header.offsetSize = parse.getCard8(data, start + 3);
    header.startOffset = start;
    header.endOffset = start + 4;
    return header;
}

var TOP_DICT_META = [
    {name: 'version', op: 0, type: 'SID'},
    {name: 'notice', op: 1, type: 'SID'},
    {name: 'copyright', op: 1200, type: 'SID'},
    {name: 'fullName', op: 2, type: 'SID'},
    {name: 'familyName', op: 3, type: 'SID'},
    {name: 'weight', op: 4, type: 'SID'},
    {name: 'isFixedPitch', op: 1201, type: 'number', value: 0},
    {name: 'italicAngle', op: 1202, type: 'number', value: 0},
    {name: 'underlinePosition', op: 1203, type: 'number', value: -100},
    {name: 'underlineThickness', op: 1204, type: 'number', value: 50},
    {name: 'paintType', op: 1205, type: 'number', value: 0},
    {name: 'charstringType', op: 1206, type: 'number', value: 2},
    {
        name: 'fontMatrix',
        op: 1207,
        type: ['real', 'real', 'real', 'real', 'real', 'real'],
        value: [0.001, 0, 0, 0.001, 0, 0]
    },
    {name: 'uniqueId', op: 13, type: 'number'},
    {name: 'fontBBox', op: 5, type: ['number', 'number', 'number', 'number'], value: [0, 0, 0, 0]},
    {name: 'strokeWidth', op: 1208, type: 'number', value: 0},
    {name: 'xuid', op: 14, type: [], value: null},
    {name: 'charset', op: 15, type: 'offset', value: 0},
    {name: 'encoding', op: 16, type: 'offset', value: 0},
    {name: 'charStrings', op: 17, type: 'offset', value: 0},
    {name: 'private', op: 18, type: ['number', 'offset'], value: [0, 0]},
    {name: 'ros', op: 1230, type: ['SID', 'SID', 'number']},
    {name: 'cidFontVersion', op: 1231, type: 'number', value: 0},
    {name: 'cidFontRevision', op: 1232, type: 'number', value: 0},
    {name: 'cidFontType', op: 1233, type: 'number', value: 0},
    {name: 'cidCount', op: 1234, type: 'number', value: 8720},
    {name: 'uidBase', op: 1235, type: 'number'},
    {name: 'fdArray', op: 1236, type: 'offset'},
    {name: 'fdSelect', op: 1237, type: 'offset'},
    {name: 'fontName', op: 1238, type: 'SID'}
];

var PRIVATE_DICT_META = [
    {name: 'subrs', op: 19, type: 'offset', value: 0},
    {name: 'defaultWidthX', op: 20, type: 'number', value: 0},
    {name: 'nominalWidthX', op: 21, type: 'number', value: 0}
];

// Parse the CFF top dictionary. A CFF table can contain multiple fonts, each with their own top dictionary.
// The top dictionary contains the essential metadata for the font, together with the private dictionary.
function parseCFFTopDict(data, strings) {
    var dict = parseCFFDict(data, 0, data.byteLength);
    return interpretDict(dict, TOP_DICT_META, strings);
}

// Parse the CFF private dictionary. We don't fully parse out all the values, only the ones we need.
function parseCFFPrivateDict(data, start, size, strings) {
    var dict = parseCFFDict(data, start, size);
    return interpretDict(dict, PRIVATE_DICT_META, strings);
}

// Returns a list of "Top DICT"s found using an INDEX list.
// Used to read both the usual high-level Top DICTs and also the FDArray
// discovered inside CID-keyed fonts.  When a Top DICT has a reference to
// a Private DICT that is read and saved into the Top DICT.
//
// In addition to the expected/optional values as outlined in TOP_DICT_META
// the following values might be saved into the Top DICT.
//
//    _subrs []        array of local CFF subroutines from Private DICT
//    _subrsBias       bias value computed from number of subroutines
//                      (see calcCFFSubroutineBias() and parseCFFCharstring())
//    _defaultWidthX   default widths for CFF characters
//    _nominalWidthX   bias added to width embedded within glyph description
//
//    _privateDict     saved copy of parsed Private DICT from Top DICT
function gatherCFFTopDicts(data, start, cffIndex, strings) {
    var topDictArray = [];
    for (var iTopDict = 0; iTopDict < cffIndex.length; iTopDict += 1) {
        var topDictData = new DataView(new Uint8Array(cffIndex[iTopDict]).buffer);
        var topDict = parseCFFTopDict(topDictData, strings);
        topDict._subrs = [];
        topDict._subrsBias = 0;
        var privateSize = topDict.private[0];
        var privateOffset = topDict.private[1];
        if (privateSize !== 0 && privateOffset !== 0) {
            var privateDict = parseCFFPrivateDict(data, privateOffset + start, privateSize, strings);
            topDict._defaultWidthX = privateDict.defaultWidthX;
            topDict._nominalWidthX = privateDict.nominalWidthX;
            if (privateDict.subrs !== 0) {
                var subrOffset = privateOffset + privateDict.subrs;
                var subrIndex = parseCFFIndex(data, subrOffset + start);
                topDict._subrs = subrIndex.objects;
                topDict._subrsBias = calcCFFSubroutineBias(topDict._subrs);
            }
            topDict._privateDict = privateDict;
        }
        topDictArray.push(topDict);
    }
    return topDictArray;
}

// Parse the CFF charset table, which contains internal names for all the glyphs.
// This function will return a list of glyph names.
// See Adobe TN #5176 chapter 13, "Charsets".
function parseCFFCharset(data, start, nGlyphs, strings) {
    var sid;
    var count;
    var parser = new parse.Parser(data, start);

    // The .notdef glyph is not included, so subtract 1.
    nGlyphs -= 1;
    var charset = ['.notdef'];

    var format = parser.parseCard8();
    if (format === 0) {
        for (var i = 0; i < nGlyphs; i += 1) {
            sid = parser.parseSID();
            charset.push(getCFFString(strings, sid));
        }
    } else if (format === 1) {
        while (charset.length <= nGlyphs) {
            sid = parser.parseSID();
            count = parser.parseCard8();
            for (var i$1 = 0; i$1 <= count; i$1 += 1) {
                charset.push(getCFFString(strings, sid));
                sid += 1;
            }
        }
    } else if (format === 2) {
        while (charset.length <= nGlyphs) {
            sid = parser.parseSID();
            count = parser.parseCard16();
            for (var i$2 = 0; i$2 <= count; i$2 += 1) {
                charset.push(getCFFString(strings, sid));
                sid += 1;
            }
        }
    } else {
        throw new Error('Unknown charset format ' + format);
    }

    return charset;
}

// Parse the CFF encoding data. Only one encoding can be specified per font.
// See Adobe TN #5176 chapter 12, "Encodings".
function parseCFFEncoding(data, start, charset) {
    var code;
    var enc = {};
    var parser = new parse.Parser(data, start);
    var format = parser.parseCard8();
    if (format === 0) {
        var nCodes = parser.parseCard8();
        for (var i = 0; i < nCodes; i += 1) {
            code = parser.parseCard8();
            enc[code] = i;
        }
    } else if (format === 1) {
        var nRanges = parser.parseCard8();
        code = 1;
        for (var i$1 = 0; i$1 < nRanges; i$1 += 1) {
            var first = parser.parseCard8();
            var nLeft = parser.parseCard8();
            for (var j = first; j <= first + nLeft; j += 1) {
                enc[j] = code;
                code += 1;
            }
        }
    } else {
        throw new Error('Unknown encoding format ' + format);
    }

    return new CffEncoding(enc, charset);
}

// Take in charstring code and return a Glyph object.
// The encoding is described in the Type 2 Charstring Format
// https://www.microsoft.com/typography/OTSPEC/charstr2.htm
function parseCFFCharstring(font, glyph, code) {
    var c1x;
    var c1y;
    var c2x;
    var c2y;
    var p = new Path();
    var stack = [];
    var nStems = 0;
    var haveWidth = false;
    var open = false;
    var x = 0;
    var y = 0;
    var subrs;
    var subrsBias;
    var defaultWidthX;
    var nominalWidthX;
    if (font.isCIDFont) {
        var fdIndex = font.tables.cff.topDict._fdSelect[glyph.index];
        var fdDict = font.tables.cff.topDict._fdArray[fdIndex];
        subrs = fdDict._subrs;
        subrsBias = fdDict._subrsBias;
        defaultWidthX = fdDict._defaultWidthX;
        nominalWidthX = fdDict._nominalWidthX;
    } else {
        subrs = font.tables.cff.topDict._subrs;
        subrsBias = font.tables.cff.topDict._subrsBias;
        defaultWidthX = font.tables.cff.topDict._defaultWidthX;
        nominalWidthX = font.tables.cff.topDict._nominalWidthX;
    }
    var width = defaultWidthX;

    function newContour(x, y) {
        if (open) {
            p.closePath();
        }

        p.moveTo(x, y);
        open = true;
    }

    function parseStems() {
        var hasWidthArg;

        // The number of stem operators on the stack is always even.
        // If the value is uneven, that means a width is specified.
        hasWidthArg = stack.length % 2 !== 0;
        if (hasWidthArg && !haveWidth) {
            width = stack.shift() + nominalWidthX;
        }

        nStems += stack.length >> 1;
        stack.length = 0;
        haveWidth = true;
    }

    function parse$$1(code) {
        var b1;
        var b2;
        var b3;
        var b4;
        var codeIndex;
        var subrCode;
        var jpx;
        var jpy;
        var c3x;
        var c3y;
        var c4x;
        var c4y;

        var i = 0;
        while (i < code.length) {
            var v = code[i];
            i += 1;
            switch (v) {
                case 1: // hstem
                    parseStems();
                    break;
                case 3: // vstem
                    parseStems();
                    break;
                case 4: // vmoveto
                    if (stack.length > 1 && !haveWidth) {
                        width = stack.shift() + nominalWidthX;
                        haveWidth = true;
                    }

                    y += stack.pop();
                    newContour(x, y);
                    break;
                case 5: // rlineto
                    while (stack.length > 0) {
                        x += stack.shift();
                        y += stack.shift();
                        p.lineTo(x, y);
                    }

                    break;
                case 6: // hlineto
                    while (stack.length > 0) {
                        x += stack.shift();
                        p.lineTo(x, y);
                        if (stack.length === 0) {
                            break;
                        }

                        y += stack.shift();
                        p.lineTo(x, y);
                    }

                    break;
                case 7: // vlineto
                    while (stack.length > 0) {
                        y += stack.shift();
                        p.lineTo(x, y);
                        if (stack.length === 0) {
                            break;
                        }

                        x += stack.shift();
                        p.lineTo(x, y);
                    }

                    break;
                case 8: // rrcurveto
                    while (stack.length > 0) {
                        c1x = x + stack.shift();
                        c1y = y + stack.shift();
                        c2x = c1x + stack.shift();
                        c2y = c1y + stack.shift();
                        x = c2x + stack.shift();
                        y = c2y + stack.shift();
                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
                    }

                    break;
                case 10: // callsubr
                    codeIndex = stack.pop() + subrsBias;
                    subrCode = subrs[codeIndex];
                    if (subrCode) {
                        parse$$1(subrCode);
                    }

                    break;
                case 11: // return
                    return;
                case 12: // flex operators
                    v = code[i];
                    i += 1;
                    switch (v) {
                        case 35: // flex
                            // |- dx1 dy1 dx2 dy2 dx3 dy3 dx4 dy4 dx5 dy5 dx6 dy6 fd flex (12 35) |-
                            c1x = x   + stack.shift();    // dx1
                            c1y = y   + stack.shift();    // dy1
                            c2x = c1x + stack.shift();    // dx2
                            c2y = c1y + stack.shift();    // dy2
                            jpx = c2x + stack.shift();    // dx3
                            jpy = c2y + stack.shift();    // dy3
                            c3x = jpx + stack.shift();    // dx4
                            c3y = jpy + stack.shift();    // dy4
                            c4x = c3x + stack.shift();    // dx5
                            c4y = c3y + stack.shift();    // dy5
                            x = c4x   + stack.shift();    // dx6
                            y = c4y   + stack.shift();    // dy6
                            stack.shift();                // flex depth
                            p.curveTo(c1x, c1y, c2x, c2y, jpx, jpy);
                            p.curveTo(c3x, c3y, c4x, c4y, x, y);
                            break;
                        case 34: // hflex
                            // |- dx1 dx2 dy2 dx3 dx4 dx5 dx6 hflex (12 34) |-
                            c1x = x   + stack.shift();    // dx1
                            c1y = y;                      // dy1
                            c2x = c1x + stack.shift();    // dx2
                            c2y = c1y + stack.shift();    // dy2
                            jpx = c2x + stack.shift();    // dx3
                            jpy = c2y;                    // dy3
                            c3x = jpx + stack.shift();    // dx4
                            c3y = c2y;                    // dy4
                            c4x = c3x + stack.shift();    // dx5
                            c4y = y;                      // dy5
                            x = c4x + stack.shift();      // dx6
                            p.curveTo(c1x, c1y, c2x, c2y, jpx, jpy);
                            p.curveTo(c3x, c3y, c4x, c4y, x, y);
                            break;
                        case 36: // hflex1
                            // |- dx1 dy1 dx2 dy2 dx3 dx4 dx5 dy5 dx6 hflex1 (12 36) |-
                            c1x = x   + stack.shift();    // dx1
                            c1y = y   + stack.shift();    // dy1
                            c2x = c1x + stack.shift();    // dx2
                            c2y = c1y + stack.shift();    // dy2
                            jpx = c2x + stack.shift();    // dx3
                            jpy = c2y;                    // dy3
                            c3x = jpx + stack.shift();    // dx4
                            c3y = c2y;                    // dy4
                            c4x = c3x + stack.shift();    // dx5
                            c4y = c3y + stack.shift();    // dy5
                            x = c4x + stack.shift();      // dx6
                            p.curveTo(c1x, c1y, c2x, c2y, jpx, jpy);
                            p.curveTo(c3x, c3y, c4x, c4y, x, y);
                            break;
                        case 37: // flex1
                            // |- dx1 dy1 dx2 dy2 dx3 dy3 dx4 dy4 dx5 dy5 d6 flex1 (12 37) |-
                            c1x = x   + stack.shift();    // dx1
                            c1y = y   + stack.shift();    // dy1
                            c2x = c1x + stack.shift();    // dx2
                            c2y = c1y + stack.shift();    // dy2
                            jpx = c2x + stack.shift();    // dx3
                            jpy = c2y + stack.shift();    // dy3
                            c3x = jpx + stack.shift();    // dx4
                            c3y = jpy + stack.shift();    // dy4
                            c4x = c3x + stack.shift();    // dx5
                            c4y = c3y + stack.shift();    // dy5
                            if (Math.abs(c4x - x) > Math.abs(c4y - y)) {
                                x = c4x + stack.shift();
                            } else {
                                y = c4y + stack.shift();
                            }

                            p.curveTo(c1x, c1y, c2x, c2y, jpx, jpy);
                            p.curveTo(c3x, c3y, c4x, c4y, x, y);
                            break;
                        default:
                            console.log('Glyph ' + glyph.index + ': unknown operator ' + 1200 + v);
                            stack.length = 0;
                    }
                    break;
                case 14: // endchar
                    if (stack.length > 0 && !haveWidth) {
                        width = stack.shift() + nominalWidthX;
                        haveWidth = true;
                    }

                    if (open) {
                        p.closePath();
                        open = false;
                    }

                    break;
                case 18: // hstemhm
                    parseStems();
                    break;
                case 19: // hintmask
                case 20: // cntrmask
                    parseStems();
                    i += (nStems + 7) >> 3;
                    break;
                case 21: // rmoveto
                    if (stack.length > 2 && !haveWidth) {
                        width = stack.shift() + nominalWidthX;
                        haveWidth = true;
                    }

                    y += stack.pop();
                    x += stack.pop();
                    newContour(x, y);
                    break;
                case 22: // hmoveto
                    if (stack.length > 1 && !haveWidth) {
                        width = stack.shift() + nominalWidthX;
                        haveWidth = true;
                    }

                    x += stack.pop();
                    newContour(x, y);
                    break;
                case 23: // vstemhm
                    parseStems();
                    break;
                case 24: // rcurveline
                    while (stack.length > 2) {
                        c1x = x + stack.shift();
                        c1y = y + stack.shift();
                        c2x = c1x + stack.shift();
                        c2y = c1y + stack.shift();
                        x = c2x + stack.shift();
                        y = c2y + stack.shift();
                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
                    }

                    x += stack.shift();
                    y += stack.shift();
                    p.lineTo(x, y);
                    break;
                case 25: // rlinecurve
                    while (stack.length > 6) {
                        x += stack.shift();
                        y += stack.shift();
                        p.lineTo(x, y);
                    }

                    c1x = x + stack.shift();
                    c1y = y + stack.shift();
                    c2x = c1x + stack.shift();
                    c2y = c1y + stack.shift();
                    x = c2x + stack.shift();
                    y = c2y + stack.shift();
                    p.curveTo(c1x, c1y, c2x, c2y, x, y);
                    break;
                case 26: // vvcurveto
                    if (stack.length % 2) {
                        x += stack.shift();
                    }

                    while (stack.length > 0) {
                        c1x = x;
                        c1y = y + stack.shift();
                        c2x = c1x + stack.shift();
                        c2y = c1y + stack.shift();
                        x = c2x;
                        y = c2y + stack.shift();
                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
                    }

                    break;
                case 27: // hhcurveto
                    if (stack.length % 2) {
                        y += stack.shift();
                    }

                    while (stack.length > 0) {
                        c1x = x + stack.shift();
                        c1y = y;
                        c2x = c1x + stack.shift();
                        c2y = c1y + stack.shift();
                        x = c2x + stack.shift();
                        y = c2y;
                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
                    }

                    break;
                case 28: // shortint
                    b1 = code[i];
                    b2 = code[i + 1];
                    stack.push(((b1 << 24) | (b2 << 16)) >> 16);
                    i += 2;
                    break;
                case 29: // callgsubr
                    codeIndex = stack.pop() + font.gsubrsBias;
                    subrCode = font.gsubrs[codeIndex];
                    if (subrCode) {
                        parse$$1(subrCode);
                    }

                    break;
                case 30: // vhcurveto
                    while (stack.length > 0) {
                        c1x = x;
                        c1y = y + stack.shift();
                        c2x = c1x + stack.shift();
                        c2y = c1y + stack.shift();
                        x = c2x + stack.shift();
                        y = c2y + (stack.length === 1 ? stack.shift() : 0);
                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
                        if (stack.length === 0) {
                            break;
                        }

                        c1x = x + stack.shift();
                        c1y = y;
                        c2x = c1x + stack.shift();
                        c2y = c1y + stack.shift();
                        y = c2y + stack.shift();
                        x = c2x + (stack.length === 1 ? stack.shift() : 0);
                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
                    }

                    break;
                case 31: // hvcurveto
                    while (stack.length > 0) {
                        c1x = x + stack.shift();
                        c1y = y;
                        c2x = c1x + stack.shift();
                        c2y = c1y + stack.shift();
                        y = c2y + stack.shift();
                        x = c2x + (stack.length === 1 ? stack.shift() : 0);
                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
                        if (stack.length === 0) {
                            break;
                        }

                        c1x = x;
                        c1y = y + stack.shift();
                        c2x = c1x + stack.shift();
                        c2y = c1y + stack.shift();
                        x = c2x + stack.shift();
                        y = c2y + (stack.length === 1 ? stack.shift() : 0);
                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
                    }

                    break;
                default:
                    if (v < 32) {
                        console.log('Glyph ' + glyph.index + ': unknown operator ' + v);
                    } else if (v < 247) {
                        stack.push(v - 139);
                    } else if (v < 251) {
                        b1 = code[i];
                        i += 1;
                        stack.push((v - 247) * 256 + b1 + 108);
                    } else if (v < 255) {
                        b1 = code[i];
                        i += 1;
                        stack.push(-(v - 251) * 256 - b1 - 108);
                    } else {
                        b1 = code[i];
                        b2 = code[i + 1];
                        b3 = code[i + 2];
                        b4 = code[i + 3];
                        i += 4;
                        stack.push(((b1 << 24) | (b2 << 16) | (b3 << 8) | b4) / 65536);
                    }
            }
        }
    }

    parse$$1(code);

    glyph.advanceWidth = width;
    return p;
}

function parseCFFFDSelect(data, start, nGlyphs, fdArrayCount) {
    var fdSelect = [];
    var fdIndex;
    var parser = new parse.Parser(data, start);
    var format = parser.parseCard8();
    if (format === 0) {
        // Simple list of nGlyphs elements
        for (var iGid = 0; iGid < nGlyphs; iGid++) {
            fdIndex = parser.parseCard8();
            if (fdIndex >= fdArrayCount) {
                throw new Error('CFF table CID Font FDSelect has bad FD index value ' + fdIndex + ' (FD count ' + fdArrayCount + ')');
            }
            fdSelect.push(fdIndex);
        }
    } else if (format === 3) {
        // Ranges
        var nRanges = parser.parseCard16();
        var first = parser.parseCard16();
        if (first !== 0) {
            throw new Error('CFF Table CID Font FDSelect format 3 range has bad initial GID ' + first);
        }
        var next;
        for (var iRange = 0; iRange < nRanges; iRange++) {
            fdIndex = parser.parseCard8();
            next = parser.parseCard16();
            if (fdIndex >= fdArrayCount) {
                throw new Error('CFF table CID Font FDSelect has bad FD index value ' + fdIndex + ' (FD count ' + fdArrayCount + ')');
            }
            if (next > nGlyphs) {
                throw new Error('CFF Table CID Font FDSelect format 3 range has bad GID ' + next);
            }
            for (; first < next; first++) {
                fdSelect.push(fdIndex);
            }
            first = next;
        }
        if (next !== nGlyphs) {
            throw new Error('CFF Table CID Font FDSelect format 3 range has bad final GID ' + next);
        }
    } else {
        throw new Error('CFF Table CID Font FDSelect table has unsupported format ' + format);
    }
    return fdSelect;
}

// Parse the `CFF` table, which contains the glyph outlines in PostScript format.
function parseCFFTable(data, start, font) {
    font.tables.cff = {};
    var header = parseCFFHeader(data, start);
    var nameIndex = parseCFFIndex(data, header.endOffset, parse.bytesToString);
    var topDictIndex = parseCFFIndex(data, nameIndex.endOffset);
    var stringIndex = parseCFFIndex(data, topDictIndex.endOffset, parse.bytesToString);
    var globalSubrIndex = parseCFFIndex(data, stringIndex.endOffset);
    font.gsubrs = globalSubrIndex.objects;
    font.gsubrsBias = calcCFFSubroutineBias(font.gsubrs);

    var topDictArray = gatherCFFTopDicts(data, start, topDictIndex.objects, stringIndex.objects);
    if (topDictArray.length !== 1) {
        throw new Error('CFF table has too many fonts in \'FontSet\' - count of fonts NameIndex.length = ' + topDictArray.length);
    }

    var topDict = topDictArray[0];
    font.tables.cff.topDict = topDict;

    if (topDict._privateDict) {
        font.defaultWidthX = topDict._privateDict.defaultWidthX;
        font.nominalWidthX = topDict._privateDict.nominalWidthX;
    }

    if (topDict.ros[0] !== undefined && topDict.ros[1] !== undefined) {
        font.isCIDFont = true;
    }

    if (font.isCIDFont) {
        var fdArrayOffset = topDict.fdArray;
        var fdSelectOffset = topDict.fdSelect;
        if (fdArrayOffset === 0 || fdSelectOffset === 0) {
            throw new Error('Font is marked as a CID font, but FDArray and/or FDSelect information is missing');
        }
        fdArrayOffset += start;
        var fdArrayIndex = parseCFFIndex(data, fdArrayOffset);
        var fdArray = gatherCFFTopDicts(data, start, fdArrayIndex.objects, stringIndex.objects);
        topDict._fdArray = fdArray;
        fdSelectOffset += start;
        topDict._fdSelect = parseCFFFDSelect(data, fdSelectOffset, font.numGlyphs, fdArray.length);
    }

    var privateDictOffset = start + topDict.private[1];
    var privateDict = parseCFFPrivateDict(data, privateDictOffset, topDict.private[0], stringIndex.objects);
    font.defaultWidthX = privateDict.defaultWidthX;
    font.nominalWidthX = privateDict.nominalWidthX;

    if (privateDict.subrs !== 0) {
        var subrOffset = privateDictOffset + privateDict.subrs;
        var subrIndex = parseCFFIndex(data, subrOffset);
        font.subrs = subrIndex.objects;
        font.subrsBias = calcCFFSubroutineBias(font.subrs);
    } else {
        font.subrs = [];
        font.subrsBias = 0;
    }

    // Offsets in the top dict are relative to the beginning of the CFF data, so add the CFF start offset.
    var charStringsIndex = parseCFFIndex(data, start + topDict.charStrings);
    font.nGlyphs = charStringsIndex.objects.length;

    var charset = parseCFFCharset(data, start + topDict.charset, font.nGlyphs, stringIndex.objects);
    if (topDict.encoding === 0) { // Standard encoding
        font.cffEncoding = new CffEncoding(cffStandardEncoding, charset);
    } else if (topDict.encoding === 1) { // Expert encoding
        font.cffEncoding = new CffEncoding(cffExpertEncoding, charset);
    } else {
        font.cffEncoding = parseCFFEncoding(data, start + topDict.encoding, charset);
    }

    // Prefer the CMAP encoding to the CFF encoding.
    font.encoding = font.encoding || font.cffEncoding;

    font.glyphs = new glyphset.GlyphSet(font);
    for (var i = 0; i < font.nGlyphs; i += 1) {
        var charString = charStringsIndex.objects[i];
        font.glyphs.push(i, glyphset.cffGlyphLoader(font, i, parseCFFCharstring, charString));
    }
}

// Convert a string to a String ID (SID).
// The list of strings is modified in place.
function encodeString(s, strings) {
    var sid;

    // Is the string in the CFF standard strings?
    var i = cffStandardStrings.indexOf(s);
    if (i >= 0) {
        sid = i;
    }

    // Is the string already in the string index?
    i = strings.indexOf(s);
    if (i >= 0) {
        sid = i + cffStandardStrings.length;
    } else {
        sid = cffStandardStrings.length + strings.length;
        strings.push(s);
    }

    return sid;
}

function makeHeader() {
    return new table.Record('Header', [
        {name: 'major', type: 'Card8', value: 1},
        {name: 'minor', type: 'Card8', value: 0},
        {name: 'hdrSize', type: 'Card8', value: 4},
        {name: 'major', type: 'Card8', value: 1}
    ]);
}

function makeNameIndex(fontNames) {
    var t = new table.Record('Name INDEX', [
        {name: 'names', type: 'INDEX', value: []}
    ]);
    t.names = [];
    for (var i = 0; i < fontNames.length; i += 1) {
        t.names.push({name: 'name_' + i, type: 'NAME', value: fontNames[i]});
    }

    return t;
}

// Given a dictionary's metadata, create a DICT structure.
function makeDict(meta, attrs, strings) {
    var m = {};
    for (var i = 0; i < meta.length; i += 1) {
        var entry = meta[i];
        var value = attrs[entry.name];
        if (value !== undefined && !equals(value, entry.value)) {
            if (entry.type === 'SID') {
                value = encodeString(value, strings);
            }

            m[entry.op] = {name: entry.name, type: entry.type, value: value};
        }
    }

    return m;
}

// The Top DICT houses the global font attributes.
function makeTopDict(attrs, strings) {
    var t = new table.Record('Top DICT', [
        {name: 'dict', type: 'DICT', value: {}}
    ]);
    t.dict = makeDict(TOP_DICT_META, attrs, strings);
    return t;
}

function makeTopDictIndex(topDict) {
    var t = new table.Record('Top DICT INDEX', [
        {name: 'topDicts', type: 'INDEX', value: []}
    ]);
    t.topDicts = [{name: 'topDict_0', type: 'TABLE', value: topDict}];
    return t;
}

function makeStringIndex(strings) {
    var t = new table.Record('String INDEX', [
        {name: 'strings', type: 'INDEX', value: []}
    ]);
    t.strings = [];
    for (var i = 0; i < strings.length; i += 1) {
        t.strings.push({name: 'string_' + i, type: 'STRING', value: strings[i]});
    }

    return t;
}

function makeGlobalSubrIndex() {
    // Currently we don't use subroutines.
    return new table.Record('Global Subr INDEX', [
        {name: 'subrs', type: 'INDEX', value: []}
    ]);
}

function makeCharsets(glyphNames, strings) {
    var t = new table.Record('Charsets', [
        {name: 'format', type: 'Card8', value: 0}
    ]);
    for (var i = 0; i < glyphNames.length; i += 1) {
        var glyphName = glyphNames[i];
        var glyphSID = encodeString(glyphName, strings);
        t.fields.push({name: 'glyph_' + i, type: 'SID', value: glyphSID});
    }

    return t;
}

function glyphToOps(glyph) {
    var ops = [];
    var path = glyph.path;
    ops.push({name: 'width', type: 'NUMBER', value: glyph.advanceWidth});
    var x = 0;
    var y = 0;
    for (var i = 0; i < path.commands.length; i += 1) {
        var dx = (void 0);
        var dy = (void 0);
        var cmd = path.commands[i];
        if (cmd.type === 'Q') {
            // CFF only supports bézier curves, so convert the quad to a bézier.
            var _13 = 1 / 3;
            var _23 = 2 / 3;

            // We're going to create a new command so we don't change the original path.
            cmd = {
                type: 'C',
                x: cmd.x,
                y: cmd.y,
                x1: _13 * x + _23 * cmd.x1,
                y1: _13 * y + _23 * cmd.y1,
                x2: _13 * cmd.x + _23 * cmd.x1,
                y2: _13 * cmd.y + _23 * cmd.y1
            };
        }

        if (cmd.type === 'M') {
            dx = Math.round(cmd.x - x);
            dy = Math.round(cmd.y - y);
            ops.push({name: 'dx', type: 'NUMBER', value: dx});
            ops.push({name: 'dy', type: 'NUMBER', value: dy});
            ops.push({name: 'rmoveto', type: 'OP', value: 21});
            x = Math.round(cmd.x);
            y = Math.round(cmd.y);
        } else if (cmd.type === 'L') {
            dx = Math.round(cmd.x - x);
            dy = Math.round(cmd.y - y);
            ops.push({name: 'dx', type: 'NUMBER', value: dx});
            ops.push({name: 'dy', type: 'NUMBER', value: dy});
            ops.push({name: 'rlineto', type: 'OP', value: 5});
            x = Math.round(cmd.x);
            y = Math.round(cmd.y);
        } else if (cmd.type === 'C') {
            var dx1 = Math.round(cmd.x1 - x);
            var dy1 = Math.round(cmd.y1 - y);
            var dx2 = Math.round(cmd.x2 - cmd.x1);
            var dy2 = Math.round(cmd.y2 - cmd.y1);
            dx = Math.round(cmd.x - cmd.x2);
            dy = Math.round(cmd.y - cmd.y2);
            ops.push({name: 'dx1', type: 'NUMBER', value: dx1});
            ops.push({name: 'dy1', type: 'NUMBER', value: dy1});
            ops.push({name: 'dx2', type: 'NUMBER', value: dx2});
            ops.push({name: 'dy2', type: 'NUMBER', value: dy2});
            ops.push({name: 'dx', type: 'NUMBER', value: dx});
            ops.push({name: 'dy', type: 'NUMBER', value: dy});
            ops.push({name: 'rrcurveto', type: 'OP', value: 8});
            x = Math.round(cmd.x);
            y = Math.round(cmd.y);
        }

        // Contours are closed automatically.
    }

    ops.push({name: 'endchar', type: 'OP', value: 14});
    return ops;
}

function makeCharStringsIndex(glyphs) {
    var t = new table.Record('CharStrings INDEX', [
        {name: 'charStrings', type: 'INDEX', value: []}
    ]);

    for (var i = 0; i < glyphs.length; i += 1) {
        var glyph = glyphs.get(i);
        var ops = glyphToOps(glyph);
        t.charStrings.push({name: glyph.name, type: 'CHARSTRING', value: ops});
    }

    return t;
}

function makePrivateDict(attrs, strings) {
    var t = new table.Record('Private DICT', [
        {name: 'dict', type: 'DICT', value: {}}
    ]);
    t.dict = makeDict(PRIVATE_DICT_META, attrs, strings);
    return t;
}

function makeCFFTable(glyphs, options) {
    var t = new table.Table('CFF ', [
        {name: 'header', type: 'RECORD'},
        {name: 'nameIndex', type: 'RECORD'},
        {name: 'topDictIndex', type: 'RECORD'},
        {name: 'stringIndex', type: 'RECORD'},
        {name: 'globalSubrIndex', type: 'RECORD'},
        {name: 'charsets', type: 'RECORD'},
        {name: 'charStringsIndex', type: 'RECORD'},
        {name: 'privateDict', type: 'RECORD'}
    ]);

    var fontScale = 1 / options.unitsPerEm;
    // We use non-zero values for the offsets so that the DICT encodes them.
    // This is important because the size of the Top DICT plays a role in offset calculation,
    // and the size shouldn't change after we've written correct offsets.
    var attrs = {
        version: options.version,
        fullName: options.fullName,
        familyName: options.familyName,
        weight: options.weightName,
        fontBBox: options.fontBBox || [0, 0, 0, 0],
        fontMatrix: [fontScale, 0, 0, fontScale, 0, 0],
        charset: 999,
        encoding: 0,
        charStrings: 999,
        private: [0, 999]
    };

    var privateAttrs = {};

    var glyphNames = [];
    var glyph;

    // Skip first glyph (.notdef)
    for (var i = 1; i < glyphs.length; i += 1) {
        glyph = glyphs.get(i);
        glyphNames.push(glyph.name);
    }

    var strings = [];

    t.header = makeHeader();
    t.nameIndex = makeNameIndex([options.postScriptName]);
    var topDict = makeTopDict(attrs, strings);
    t.topDictIndex = makeTopDictIndex(topDict);
    t.globalSubrIndex = makeGlobalSubrIndex();
    t.charsets = makeCharsets(glyphNames, strings);
    t.charStringsIndex = makeCharStringsIndex(glyphs);
    t.privateDict = makePrivateDict(privateAttrs, strings);

    // Needs to come at the end, to encode all custom strings used in the font.
    t.stringIndex = makeStringIndex(strings);

    var startOffset = t.header.sizeOf() +
        t.nameIndex.sizeOf() +
        t.topDictIndex.sizeOf() +
        t.stringIndex.sizeOf() +
        t.globalSubrIndex.sizeOf();
    attrs.charset = startOffset;

    // We use the CFF standard encoding; proper encoding will be handled in cmap.
    attrs.encoding = 0;
    attrs.charStrings = attrs.charset + t.charsets.sizeOf();
    attrs.private[1] = attrs.charStrings + t.charStringsIndex.sizeOf();

    // Recreate the Top DICT INDEX with the correct offsets.
    topDict = makeTopDict(attrs, strings);
    t.topDictIndex = makeTopDictIndex(topDict);

    return t;
}

var cff = { parse: parseCFFTable, make: makeCFFTable };

// The `head` table contains global information about the font.
// https://www.microsoft.com/typography/OTSPEC/head.htm

// Parse the header `head` table
function parseHeadTable(data, start) {
    var head = {};
    var p = new parse.Parser(data, start);
    head.version = p.parseVersion();
    head.fontRevision = Math.round(p.parseFixed() * 1000) / 1000;
    head.checkSumAdjustment = p.parseULong();
    head.magicNumber = p.parseULong();
    check.argument(head.magicNumber === 0x5F0F3CF5, 'Font header has wrong magic number.');
    head.flags = p.parseUShort();
    head.unitsPerEm = p.parseUShort();
    head.created = p.parseLongDateTime();
    head.modified = p.parseLongDateTime();
    head.xMin = p.parseShort();
    head.yMin = p.parseShort();
    head.xMax = p.parseShort();
    head.yMax = p.parseShort();
    head.macStyle = p.parseUShort();
    head.lowestRecPPEM = p.parseUShort();
    head.fontDirectionHint = p.parseShort();
    head.indexToLocFormat = p.parseShort();
    head.glyphDataFormat = p.parseShort();
    return head;
}

function makeHeadTable(options) {
    // Apple Mac timestamp epoch is 01/01/1904 not 01/01/1970
    var timestamp = Math.round(new Date().getTime() / 1000) + 2082844800;
    var createdTimestamp = timestamp;

    if (options.createdTimestamp) {
        createdTimestamp = options.createdTimestamp + 2082844800;
    }

    return new table.Table('head', [
        {name: 'version', type: 'FIXED', value: 0x00010000},
        {name: 'fontRevision', type: 'FIXED', value: 0x00010000},
        {name: 'checkSumAdjustment', type: 'ULONG', value: 0},
        {name: 'magicNumber', type: 'ULONG', value: 0x5F0F3CF5},
        {name: 'flags', type: 'USHORT', value: 0},
        {name: 'unitsPerEm', type: 'USHORT', value: 1000},
        {name: 'created', type: 'LONGDATETIME', value: createdTimestamp},
        {name: 'modified', type: 'LONGDATETIME', value: timestamp},
        {name: 'xMin', type: 'SHORT', value: 0},
        {name: 'yMin', type: 'SHORT', value: 0},
        {name: 'xMax', type: 'SHORT', value: 0},
        {name: 'yMax', type: 'SHORT', value: 0},
        {name: 'macStyle', type: 'USHORT', value: 0},
        {name: 'lowestRecPPEM', type: 'USHORT', value: 0},
        {name: 'fontDirectionHint', type: 'SHORT', value: 2},
        {name: 'indexToLocFormat', type: 'SHORT', value: 0},
        {name: 'glyphDataFormat', type: 'SHORT', value: 0}
    ], options);
}

var head = { parse: parseHeadTable, make: makeHeadTable };

// The `hhea` table contains information for horizontal layout.
// https://www.microsoft.com/typography/OTSPEC/hhea.htm

// Parse the horizontal header `hhea` table
function parseHheaTable(data, start) {
    var hhea = {};
    var p = new parse.Parser(data, start);
    hhea.version = p.parseVersion();
    hhea.ascender = p.parseShort();
    hhea.descender = p.parseShort();
    hhea.lineGap = p.parseShort();
    hhea.advanceWidthMax = p.parseUShort();
    hhea.minLeftSideBearing = p.parseShort();
    hhea.minRightSideBearing = p.parseShort();
    hhea.xMaxExtent = p.parseShort();
    hhea.caretSlopeRise = p.parseShort();
    hhea.caretSlopeRun = p.parseShort();
    hhea.caretOffset = p.parseShort();
    p.relativeOffset += 8;
    hhea.metricDataFormat = p.parseShort();
    hhea.numberOfHMetrics = p.parseUShort();
    return hhea;
}

function makeHheaTable(options) {
    return new table.Table('hhea', [
        {name: 'version', type: 'FIXED', value: 0x00010000},
        {name: 'ascender', type: 'FWORD', value: 0},
        {name: 'descender', type: 'FWORD', value: 0},
        {name: 'lineGap', type: 'FWORD', value: 0},
        {name: 'advanceWidthMax', type: 'UFWORD', value: 0},
        {name: 'minLeftSideBearing', type: 'FWORD', value: 0},
        {name: 'minRightSideBearing', type: 'FWORD', value: 0},
        {name: 'xMaxExtent', type: 'FWORD', value: 0},
        {name: 'caretSlopeRise', type: 'SHORT', value: 1},
        {name: 'caretSlopeRun', type: 'SHORT', value: 0},
        {name: 'caretOffset', type: 'SHORT', value: 0},
        {name: 'reserved1', type: 'SHORT', value: 0},
        {name: 'reserved2', type: 'SHORT', value: 0},
        {name: 'reserved3', type: 'SHORT', value: 0},
        {name: 'reserved4', type: 'SHORT', value: 0},
        {name: 'metricDataFormat', type: 'SHORT', value: 0},
        {name: 'numberOfHMetrics', type: 'USHORT', value: 0}
    ], options);
}

var hhea = { parse: parseHheaTable, make: makeHheaTable };

// The `hmtx` table contains the horizontal metrics for all glyphs.
// https://www.microsoft.com/typography/OTSPEC/hmtx.htm

// Parse the `hmtx` table, which contains the horizontal metrics for all glyphs.
// This function augments the glyph array, adding the advanceWidth and leftSideBearing to each glyph.
function parseHmtxTable(data, start, numMetrics, numGlyphs, glyphs) {
    var advanceWidth;
    var leftSideBearing;
    var p = new parse.Parser(data, start);
    for (var i = 0; i < numGlyphs; i += 1) {
        // If the font is monospaced, only one entry is needed. This last entry applies to all subsequent glyphs.
        if (i < numMetrics) {
            advanceWidth = p.parseUShort();
            leftSideBearing = p.parseShort();
        }

        var glyph = glyphs.get(i);
        glyph.advanceWidth = advanceWidth;
        glyph.leftSideBearing = leftSideBearing;
    }
}

function makeHmtxTable(glyphs) {
    var t = new table.Table('hmtx', []);
    for (var i = 0; i < glyphs.length; i += 1) {
        var glyph = glyphs.get(i);
        var advanceWidth = glyph.advanceWidth || 0;
        var leftSideBearing = glyph.leftSideBearing || 0;
        t.fields.push({name: 'advanceWidth_' + i, type: 'USHORT', value: advanceWidth});
        t.fields.push({name: 'leftSideBearing_' + i, type: 'SHORT', value: leftSideBearing});
    }

    return t;
}

var hmtx = { parse: parseHmtxTable, make: makeHmtxTable };

// The `ltag` table stores IETF BCP-47 language tags. It allows supporting
// languages for which TrueType does not assign a numeric code.
// https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6ltag.html
// http://www.w3.org/International/articles/language-tags/
// http://www.iana.org/assignments/language-subtag-registry/language-subtag-registry

function makeLtagTable(tags) {
    var result = new table.Table('ltag', [
        {name: 'version', type: 'ULONG', value: 1},
        {name: 'flags', type: 'ULONG', value: 0},
        {name: 'numTags', type: 'ULONG', value: tags.length}
    ]);

    var stringPool = '';
    var stringPoolOffset = 12 + tags.length * 4;
    for (var i = 0; i < tags.length; ++i) {
        var pos = stringPool.indexOf(tags[i]);
        if (pos < 0) {
            pos = stringPool.length;
            stringPool += tags[i];
        }

        result.fields.push({name: 'offset ' + i, type: 'USHORT', value: stringPoolOffset + pos});
        result.fields.push({name: 'length ' + i, type: 'USHORT', value: tags[i].length});
    }

    result.fields.push({name: 'stringPool', type: 'CHARARRAY', value: stringPool});
    return result;
}

function parseLtagTable(data, start) {
    var p = new parse.Parser(data, start);
    var tableVersion = p.parseULong();
    check.argument(tableVersion === 1, 'Unsupported ltag table version.');
    // The 'ltag' specification does not define any flags; skip the field.
    p.skip('uLong', 1);
    var numTags = p.parseULong();

    var tags = [];
    for (var i = 0; i < numTags; i++) {
        var tag = '';
        var offset = start + p.parseUShort();
        var length = p.parseUShort();
        for (var j = offset; j < offset + length; ++j) {
            tag += String.fromCharCode(data.getInt8(j));
        }

        tags.push(tag);
    }

    return tags;
}

var ltag = { make: makeLtagTable, parse: parseLtagTable };

// The `maxp` table establishes the memory requirements for the font.
// We need it just to get the number of glyphs in the font.
// https://www.microsoft.com/typography/OTSPEC/maxp.htm

// Parse the maximum profile `maxp` table.
function parseMaxpTable(data, start) {
    var maxp = {};
    var p = new parse.Parser(data, start);
    maxp.version = p.parseVersion();
    maxp.numGlyphs = p.parseUShort();
    if (maxp.version === 1.0) {
        maxp.maxPoints = p.parseUShort();
        maxp.maxContours = p.parseUShort();
        maxp.maxCompositePoints = p.parseUShort();
        maxp.maxCompositeContours = p.parseUShort();
        maxp.maxZones = p.parseUShort();
        maxp.maxTwilightPoints = p.parseUShort();
        maxp.maxStorage = p.parseUShort();
        maxp.maxFunctionDefs = p.parseUShort();
        maxp.maxInstructionDefs = p.parseUShort();
        maxp.maxStackElements = p.parseUShort();
        maxp.maxSizeOfInstructions = p.parseUShort();
        maxp.maxComponentElements = p.parseUShort();
        maxp.maxComponentDepth = p.parseUShort();
    }

    return maxp;
}

function makeMaxpTable(numGlyphs) {
    return new table.Table('maxp', [
        {name: 'version', type: 'FIXED', value: 0x00005000},
        {name: 'numGlyphs', type: 'USHORT', value: numGlyphs}
    ]);
}

var maxp = { parse: parseMaxpTable, make: makeMaxpTable };

// The `name` naming table.
// https://www.microsoft.com/typography/OTSPEC/name.htm

// NameIDs for the name table.
var nameTableNames = [
    'copyright',              // 0
    'fontFamily',             // 1
    'fontSubfamily',          // 2
    'uniqueID',               // 3
    'fullName',               // 4
    'version',                // 5
    'postScriptName',         // 6
    'trademark',              // 7
    'manufacturer',           // 8
    'designer',               // 9
    'description',            // 10
    'manufacturerURL',        // 11
    'designerURL',            // 12
    'license',                // 13
    'licenseURL',             // 14
    'reserved',               // 15
    'preferredFamily',        // 16
    'preferredSubfamily',     // 17
    'compatibleFullName',     // 18
    'sampleText',             // 19
    'postScriptFindFontName', // 20
    'wwsFamily',              // 21
    'wwsSubfamily'            // 22
];

var macLanguages = {
    0: 'en',
    1: 'fr',
    2: 'de',
    3: 'it',
    4: 'nl',
    5: 'sv',
    6: 'es',
    7: 'da',
    8: 'pt',
    9: 'no',
    10: 'he',
    11: 'ja',
    12: 'ar',
    13: 'fi',
    14: 'el',
    15: 'is',
    16: 'mt',
    17: 'tr',
    18: 'hr',
    19: 'zh-Hant',
    20: 'ur',
    21: 'hi',
    22: 'th',
    23: 'ko',
    24: 'lt',
    25: 'pl',
    26: 'hu',
    27: 'es',
    28: 'lv',
    29: 'se',
    30: 'fo',
    31: 'fa',
    32: 'ru',
    33: 'zh',
    34: 'nl-BE',
    35: 'ga',
    36: 'sq',
    37: 'ro',
    38: 'cz',
    39: 'sk',
    40: 'si',
    41: 'yi',
    42: 'sr',
    43: 'mk',
    44: 'bg',
    45: 'uk',
    46: 'be',
    47: 'uz',
    48: 'kk',
    49: 'az-Cyrl',
    50: 'az-Arab',
    51: 'hy',
    52: 'ka',
    53: 'mo',
    54: 'ky',
    55: 'tg',
    56: 'tk',
    57: 'mn-CN',
    58: 'mn',
    59: 'ps',
    60: 'ks',
    61: 'ku',
    62: 'sd',
    63: 'bo',
    64: 'ne',
    65: 'sa',
    66: 'mr',
    67: 'bn',
    68: 'as',
    69: 'gu',
    70: 'pa',
    71: 'or',
    72: 'ml',
    73: 'kn',
    74: 'ta',
    75: 'te',
    76: 'si',
    77: 'my',
    78: 'km',
    79: 'lo',
    80: 'vi',
    81: 'id',
    82: 'tl',
    83: 'ms',
    84: 'ms-Arab',
    85: 'am',
    86: 'ti',
    87: 'om',
    88: 'so',
    89: 'sw',
    90: 'rw',
    91: 'rn',
    92: 'ny',
    93: 'mg',
    94: 'eo',
    128: 'cy',
    129: 'eu',
    130: 'ca',
    131: 'la',
    132: 'qu',
    133: 'gn',
    134: 'ay',
    135: 'tt',
    136: 'ug',
    137: 'dz',
    138: 'jv',
    139: 'su',
    140: 'gl',
    141: 'af',
    142: 'br',
    143: 'iu',
    144: 'gd',
    145: 'gv',
    146: 'ga',
    147: 'to',
    148: 'el-polyton',
    149: 'kl',
    150: 'az',
    151: 'nn'
};

// MacOS language ID → MacOS script ID
//
// Note that the script ID is not sufficient to determine what encoding
// to use in TrueType files. For some languages, MacOS used a modification
// of a mainstream script. For example, an Icelandic name would be stored
// with smRoman in the TrueType naming table, but the actual encoding
// is a special Icelandic version of the normal Macintosh Roman encoding.
// As another example, Inuktitut uses an 8-bit encoding for Canadian Aboriginal
// Syllables but MacOS had run out of available script codes, so this was
// done as a (pretty radical) "modification" of Ethiopic.
//
// http://unicode.org/Public/MAPPINGS/VENDORS/APPLE/Readme.txt
var macLanguageToScript = {
    0: 0,  // langEnglish → smRoman
    1: 0,  // langFrench → smRoman
    2: 0,  // langGerman → smRoman
    3: 0,  // langItalian → smRoman
    4: 0,  // langDutch → smRoman
    5: 0,  // langSwedish → smRoman
    6: 0,  // langSpanish → smRoman
    7: 0,  // langDanish → smRoman
    8: 0,  // langPortuguese → smRoman
    9: 0,  // langNorwegian → smRoman
    10: 5,  // langHebrew → smHebrew
    11: 1,  // langJapanese → smJapanese
    12: 4,  // langArabic → smArabic
    13: 0,  // langFinnish → smRoman
    14: 6,  // langGreek → smGreek
    15: 0,  // langIcelandic → smRoman (modified)
    16: 0,  // langMaltese → smRoman
    17: 0,  // langTurkish → smRoman (modified)
    18: 0,  // langCroatian → smRoman (modified)
    19: 2,  // langTradChinese → smTradChinese
    20: 4,  // langUrdu → smArabic
    21: 9,  // langHindi → smDevanagari
    22: 21,  // langThai → smThai
    23: 3,  // langKorean → smKorean
    24: 29,  // langLithuanian → smCentralEuroRoman
    25: 29,  // langPolish → smCentralEuroRoman
    26: 29,  // langHungarian → smCentralEuroRoman
    27: 29,  // langEstonian → smCentralEuroRoman
    28: 29,  // langLatvian → smCentralEuroRoman
    29: 0,  // langSami → smRoman
    30: 0,  // langFaroese → smRoman (modified)
    31: 4,  // langFarsi → smArabic (modified)
    32: 7,  // langRussian → smCyrillic
    33: 25,  // langSimpChinese → smSimpChinese
    34: 0,  // langFlemish → smRoman
    35: 0,  // langIrishGaelic → smRoman (modified)
    36: 0,  // langAlbanian → smRoman
    37: 0,  // langRomanian → smRoman (modified)
    38: 29,  // langCzech → smCentralEuroRoman
    39: 29,  // langSlovak → smCentralEuroRoman
    40: 0,  // langSlovenian → smRoman (modified)
    41: 5,  // langYiddish → smHebrew
    42: 7,  // langSerbian → smCyrillic
    43: 7,  // langMacedonian → smCyrillic
    44: 7,  // langBulgarian → smCyrillic
    45: 7,  // langUkrainian → smCyrillic (modified)
    46: 7,  // langByelorussian → smCyrillic
    47: 7,  // langUzbek → smCyrillic
    48: 7,  // langKazakh → smCyrillic
    49: 7,  // langAzerbaijani → smCyrillic
    50: 4,  // langAzerbaijanAr → smArabic
    51: 24,  // langArmenian → smArmenian
    52: 23,  // langGeorgian → smGeorgian
    53: 7,  // langMoldavian → smCyrillic
    54: 7,  // langKirghiz → smCyrillic
    55: 7,  // langTajiki → smCyrillic
    56: 7,  // langTurkmen → smCyrillic
    57: 27,  // langMongolian → smMongolian
    58: 7,  // langMongolianCyr → smCyrillic
    59: 4,  // langPashto → smArabic
    60: 4,  // langKurdish → smArabic
    61: 4,  // langKashmiri → smArabic
    62: 4,  // langSindhi → smArabic
    63: 26,  // langTibetan → smTibetan
    64: 9,  // langNepali → smDevanagari
    65: 9,  // langSanskrit → smDevanagari
    66: 9,  // langMarathi → smDevanagari
    67: 13,  // langBengali → smBengali
    68: 13,  // langAssamese → smBengali
    69: 11,  // langGujarati → smGujarati
    70: 10,  // langPunjabi → smGurmukhi
    71: 12,  // langOriya → smOriya
    72: 17,  // langMalayalam → smMalayalam
    73: 16,  // langKannada → smKannada
    74: 14,  // langTamil → smTamil
    75: 15,  // langTelugu → smTelugu
    76: 18,  // langSinhalese → smSinhalese
    77: 19,  // langBurmese → smBurmese
    78: 20,  // langKhmer → smKhmer
    79: 22,  // langLao → smLao
    80: 30,  // langVietnamese → smVietnamese
    81: 0,  // langIndonesian → smRoman
    82: 0,  // langTagalog → smRoman
    83: 0,  // langMalayRoman → smRoman
    84: 4,  // langMalayArabic → smArabic
    85: 28,  // langAmharic → smEthiopic
    86: 28,  // langTigrinya → smEthiopic
    87: 28,  // langOromo → smEthiopic
    88: 0,  // langSomali → smRoman
    89: 0,  // langSwahili → smRoman
    90: 0,  // langKinyarwanda → smRoman
    91: 0,  // langRundi → smRoman
    92: 0,  // langNyanja → smRoman
    93: 0,  // langMalagasy → smRoman
    94: 0,  // langEsperanto → smRoman
    128: 0,  // langWelsh → smRoman (modified)
    129: 0,  // langBasque → smRoman
    130: 0,  // langCatalan → smRoman
    131: 0,  // langLatin → smRoman
    132: 0,  // langQuechua → smRoman
    133: 0,  // langGuarani → smRoman
    134: 0,  // langAymara → smRoman
    135: 7,  // langTatar → smCyrillic
    136: 4,  // langUighur → smArabic
    137: 26,  // langDzongkha → smTibetan
    138: 0,  // langJavaneseRom → smRoman
    139: 0,  // langSundaneseRom → smRoman
    140: 0,  // langGalician → smRoman
    141: 0,  // langAfrikaans → smRoman
    142: 0,  // langBreton → smRoman (modified)
    143: 28,  // langInuktitut → smEthiopic (modified)
    144: 0,  // langScottishGaelic → smRoman (modified)
    145: 0,  // langManxGaelic → smRoman (modified)
    146: 0,  // langIrishGaelicScript → smRoman (modified)
    147: 0,  // langTongan → smRoman
    148: 6,  // langGreekAncient → smRoman
    149: 0,  // langGreenlandic → smRoman
    150: 0,  // langAzerbaijanRoman → smRoman
    151: 0   // langNynorsk → smRoman
};

// While Microsoft indicates a region/country for all its language
// IDs, we omit the region code if it's equal to the "most likely
// region subtag" according to Unicode CLDR. For scripts, we omit
// the subtag if it is equal to the Suppress-Script entry in the
// IANA language subtag registry for IETF BCP 47.
//
// For example, Microsoft states that its language code 0x041A is
// Croatian in Croatia. We transform this to the BCP 47 language code 'hr'
// and not 'hr-HR' because Croatia is the default country for Croatian,
// according to Unicode CLDR. As another example, Microsoft states
// that 0x101A is Croatian (Latin) in Bosnia-Herzegovina. We transform
// this to 'hr-BA' and not 'hr-Latn-BA' because Latin is the default script
// for the Croatian language, according to IANA.
//
// http://www.unicode.org/cldr/charts/latest/supplemental/likely_subtags.html
// http://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
var windowsLanguages = {
    0x0436: 'af',
    0x041C: 'sq',
    0x0484: 'gsw',
    0x045E: 'am',
    0x1401: 'ar-DZ',
    0x3C01: 'ar-BH',
    0x0C01: 'ar',
    0x0801: 'ar-IQ',
    0x2C01: 'ar-JO',
    0x3401: 'ar-KW',
    0x3001: 'ar-LB',
    0x1001: 'ar-LY',
    0x1801: 'ary',
    0x2001: 'ar-OM',
    0x4001: 'ar-QA',
    0x0401: 'ar-SA',
    0x2801: 'ar-SY',
    0x1C01: 'aeb',
    0x3801: 'ar-AE',
    0x2401: 'ar-YE',
    0x042B: 'hy',
    0x044D: 'as',
    0x082C: 'az-Cyrl',
    0x042C: 'az',
    0x046D: 'ba',
    0x042D: 'eu',
    0x0423: 'be',
    0x0845: 'bn',
    0x0445: 'bn-IN',
    0x201A: 'bs-Cyrl',
    0x141A: 'bs',
    0x047E: 'br',
    0x0402: 'bg',
    0x0403: 'ca',
    0x0C04: 'zh-HK',
    0x1404: 'zh-MO',
    0x0804: 'zh',
    0x1004: 'zh-SG',
    0x0404: 'zh-TW',
    0x0483: 'co',
    0x041A: 'hr',
    0x101A: 'hr-BA',
    0x0405: 'cs',
    0x0406: 'da',
    0x048C: 'prs',
    0x0465: 'dv',
    0x0813: 'nl-BE',
    0x0413: 'nl',
    0x0C09: 'en-AU',
    0x2809: 'en-BZ',
    0x1009: 'en-CA',
    0x2409: 'en-029',
    0x4009: 'en-IN',
    0x1809: 'en-IE',
    0x2009: 'en-JM',
    0x4409: 'en-MY',
    0x1409: 'en-NZ',
    0x3409: 'en-PH',
    0x4809: 'en-SG',
    0x1C09: 'en-ZA',
    0x2C09: 'en-TT',
    0x0809: 'en-GB',
    0x0409: 'en',
    0x3009: 'en-ZW',
    0x0425: 'et',
    0x0438: 'fo',
    0x0464: 'fil',
    0x040B: 'fi',
    0x080C: 'fr-BE',
    0x0C0C: 'fr-CA',
    0x040C: 'fr',
    0x140C: 'fr-LU',
    0x180C: 'fr-MC',
    0x100C: 'fr-CH',
    0x0462: 'fy',
    0x0456: 'gl',
    0x0437: 'ka',
    0x0C07: 'de-AT',
    0x0407: 'de',
    0x1407: 'de-LI',
    0x1007: 'de-LU',
    0x0807: 'de-CH',
    0x0408: 'el',
    0x046F: 'kl',
    0x0447: 'gu',
    0x0468: 'ha',
    0x040D: 'he',
    0x0439: 'hi',
    0x040E: 'hu',
    0x040F: 'is',
    0x0470: 'ig',
    0x0421: 'id',
    0x045D: 'iu',
    0x085D: 'iu-Latn',
    0x083C: 'ga',
    0x0434: 'xh',
    0x0435: 'zu',
    0x0410: 'it',
    0x0810: 'it-CH',
    0x0411: 'ja',
    0x044B: 'kn',
    0x043F: 'kk',
    0x0453: 'km',
    0x0486: 'quc',
    0x0487: 'rw',
    0x0441: 'sw',
    0x0457: 'kok',
    0x0412: 'ko',
    0x0440: 'ky',
    0x0454: 'lo',
    0x0426: 'lv',
    0x0427: 'lt',
    0x082E: 'dsb',
    0x046E: 'lb',
    0x042F: 'mk',
    0x083E: 'ms-BN',
    0x043E: 'ms',
    0x044C: 'ml',
    0x043A: 'mt',
    0x0481: 'mi',
    0x047A: 'arn',
    0x044E: 'mr',
    0x047C: 'moh',
    0x0450: 'mn',
    0x0850: 'mn-CN',
    0x0461: 'ne',
    0x0414: 'nb',
    0x0814: 'nn',
    0x0482: 'oc',
    0x0448: 'or',
    0x0463: 'ps',
    0x0415: 'pl',
    0x0416: 'pt',
    0x0816: 'pt-PT',
    0x0446: 'pa',
    0x046B: 'qu-BO',
    0x086B: 'qu-EC',
    0x0C6B: 'qu',
    0x0418: 'ro',
    0x0417: 'rm',
    0x0419: 'ru',
    0x243B: 'smn',
    0x103B: 'smj-NO',
    0x143B: 'smj',
    0x0C3B: 'se-FI',
    0x043B: 'se',
    0x083B: 'se-SE',
    0x203B: 'sms',
    0x183B: 'sma-NO',
    0x1C3B: 'sms',
    0x044F: 'sa',
    0x1C1A: 'sr-Cyrl-BA',
    0x0C1A: 'sr',
    0x181A: 'sr-Latn-BA',
    0x081A: 'sr-Latn',
    0x046C: 'nso',
    0x0432: 'tn',
    0x045B: 'si',
    0x041B: 'sk',
    0x0424: 'sl',
    0x2C0A: 'es-AR',
    0x400A: 'es-BO',
    0x340A: 'es-CL',
    0x240A: 'es-CO',
    0x140A: 'es-CR',
    0x1C0A: 'es-DO',
    0x300A: 'es-EC',
    0x440A: 'es-SV',
    0x100A: 'es-GT',
    0x480A: 'es-HN',
    0x080A: 'es-MX',
    0x4C0A: 'es-NI',
    0x180A: 'es-PA',
    0x3C0A: 'es-PY',
    0x280A: 'es-PE',
    0x500A: 'es-PR',

    // Microsoft has defined two different language codes for
    // “Spanish with modern sorting” and “Spanish with traditional
    // sorting”. This makes sense for collation APIs, and it would be
    // possible to express this in BCP 47 language tags via Unicode
    // extensions (eg., es-u-co-trad is Spanish with traditional
    // sorting). However, for storing names in fonts, the distinction
    // does not make sense, so we give “es” in both cases.
    0x0C0A: 'es',
    0x040A: 'es',

    0x540A: 'es-US',
    0x380A: 'es-UY',
    0x200A: 'es-VE',
    0x081D: 'sv-FI',
    0x041D: 'sv',
    0x045A: 'syr',
    0x0428: 'tg',
    0x085F: 'tzm',
    0x0449: 'ta',
    0x0444: 'tt',
    0x044A: 'te',
    0x041E: 'th',
    0x0451: 'bo',
    0x041F: 'tr',
    0x0442: 'tk',
    0x0480: 'ug',
    0x0422: 'uk',
    0x042E: 'hsb',
    0x0420: 'ur',
    0x0843: 'uz-Cyrl',
    0x0443: 'uz',
    0x042A: 'vi',
    0x0452: 'cy',
    0x0488: 'wo',
    0x0485: 'sah',
    0x0478: 'ii',
    0x046A: 'yo'
};

// Returns a IETF BCP 47 language code, for example 'zh-Hant'
// for 'Chinese in the traditional script'.
function getLanguageCode(platformID, languageID, ltag) {
    switch (platformID) {
        case 0:  // Unicode
            if (languageID === 0xFFFF) {
                return 'und';
            } else if (ltag) {
                return ltag[languageID];
            }

            break;

        case 1:  // Macintosh
            return macLanguages[languageID];

        case 3:  // Windows
            return windowsLanguages[languageID];
    }

    return undefined;
}

var utf16 = 'utf-16';

// MacOS script ID → encoding. This table stores the default case,
// which can be overridden by macLanguageEncodings.
var macScriptEncodings = {
    0: 'macintosh',           // smRoman
    1: 'x-mac-japanese',      // smJapanese
    2: 'x-mac-chinesetrad',   // smTradChinese
    3: 'x-mac-korean',        // smKorean
    6: 'x-mac-greek',         // smGreek
    7: 'x-mac-cyrillic',      // smCyrillic
    9: 'x-mac-devanagai',     // smDevanagari
    10: 'x-mac-gurmukhi',     // smGurmukhi
    11: 'x-mac-gujarati',     // smGujarati
    12: 'x-mac-oriya',        // smOriya
    13: 'x-mac-bengali',      // smBengali
    14: 'x-mac-tamil',        // smTamil
    15: 'x-mac-telugu',       // smTelugu
    16: 'x-mac-kannada',      // smKannada
    17: 'x-mac-malayalam',    // smMalayalam
    18: 'x-mac-sinhalese',    // smSinhalese
    19: 'x-mac-burmese',      // smBurmese
    20: 'x-mac-khmer',        // smKhmer
    21: 'x-mac-thai',         // smThai
    22: 'x-mac-lao',          // smLao
    23: 'x-mac-georgian',     // smGeorgian
    24: 'x-mac-armenian',     // smArmenian
    25: 'x-mac-chinesesimp',  // smSimpChinese
    26: 'x-mac-tibetan',      // smTibetan
    27: 'x-mac-mongolian',    // smMongolian
    28: 'x-mac-ethiopic',     // smEthiopic
    29: 'x-mac-ce',           // smCentralEuroRoman
    30: 'x-mac-vietnamese',   // smVietnamese
    31: 'x-mac-extarabic'     // smExtArabic
};

// MacOS language ID → encoding. This table stores the exceptional
// cases, which override macScriptEncodings. For writing MacOS naming
// tables, we need to emit a MacOS script ID. Therefore, we cannot
// merge macScriptEncodings into macLanguageEncodings.
//
// http://unicode.org/Public/MAPPINGS/VENDORS/APPLE/Readme.txt
var macLanguageEncodings = {
    15: 'x-mac-icelandic',    // langIcelandic
    17: 'x-mac-turkish',      // langTurkish
    18: 'x-mac-croatian',     // langCroatian
    24: 'x-mac-ce',           // langLithuanian
    25: 'x-mac-ce',           // langPolish
    26: 'x-mac-ce',           // langHungarian
    27: 'x-mac-ce',           // langEstonian
    28: 'x-mac-ce',           // langLatvian
    30: 'x-mac-icelandic',    // langFaroese
    37: 'x-mac-romanian',     // langRomanian
    38: 'x-mac-ce',           // langCzech
    39: 'x-mac-ce',           // langSlovak
    40: 'x-mac-ce',           // langSlovenian
    143: 'x-mac-inuit',       // langInuktitut
    146: 'x-mac-gaelic'       // langIrishGaelicScript
};

function getEncoding(platformID, encodingID, languageID) {
    switch (platformID) {
        case 0:  // Unicode
            return utf16;

        case 1:  // Apple Macintosh
            return macLanguageEncodings[languageID] || macScriptEncodings[encodingID];

        case 3:  // Microsoft Windows
            if (encodingID === 1 || encodingID === 10) {
                return utf16;
            }

            break;
    }

    return undefined;
}

// Parse the naming `name` table.
// FIXME: Format 1 additional fields are not supported yet.
// ltag is the content of the `ltag' table, such as ['en', 'zh-Hans', 'de-CH-1904'].
function parseNameTable(data, start, ltag) {
    var name = {};
    var p = new parse.Parser(data, start);
    var format = p.parseUShort();
    var count = p.parseUShort();
    var stringOffset = p.offset + p.parseUShort();
    for (var i = 0; i < count; i++) {
        var platformID = p.parseUShort();
        var encodingID = p.parseUShort();
        var languageID = p.parseUShort();
        var nameID = p.parseUShort();
        var property = nameTableNames[nameID] || nameID;
        var byteLength = p.parseUShort();
        var offset = p.parseUShort();
        var language = getLanguageCode(platformID, languageID, ltag);
        var encoding = getEncoding(platformID, encodingID, languageID);
        if (encoding !== undefined && language !== undefined) {
            var text = (void 0);
            if (encoding === utf16) {
                text = decode.UTF16(data, stringOffset + offset, byteLength);
            } else {
                text = decode.MACSTRING(data, stringOffset + offset, byteLength, encoding);
            }

            if (text) {
                var translations = name[property];
                if (translations === undefined) {
                    translations = name[property] = {};
                }

                translations[language] = text;
            }
        }
    }

    var langTagCount = 0;
    if (format === 1) {
        // FIXME: Also handle Microsoft's 'name' table 1.
        langTagCount = p.parseUShort();
    }

    return name;
}

// {23: 'foo'} → {'foo': 23}
// ['bar', 'baz'] → {'bar': 0, 'baz': 1}
function reverseDict(dict) {
    var result = {};
    for (var key in dict) {
        result[dict[key]] = parseInt(key);
    }

    return result;
}

function makeNameRecord(platformID, encodingID, languageID, nameID, length, offset) {
    return new table.Record('NameRecord', [
        {name: 'platformID', type: 'USHORT', value: platformID},
        {name: 'encodingID', type: 'USHORT', value: encodingID},
        {name: 'languageID', type: 'USHORT', value: languageID},
        {name: 'nameID', type: 'USHORT', value: nameID},
        {name: 'length', type: 'USHORT', value: length},
        {name: 'offset', type: 'USHORT', value: offset}
    ]);
}

// Finds the position of needle in haystack, or -1 if not there.
// Like String.indexOf(), but for arrays.
function findSubArray(needle, haystack) {
    var needleLength = needle.length;
    var limit = haystack.length - needleLength + 1;

    loop:
    for (var pos = 0; pos < limit; pos++) {
        for (; pos < limit; pos++) {
            for (var k = 0; k < needleLength; k++) {
                if (haystack[pos + k] !== needle[k]) {
                    continue loop;
                }
            }

            return pos;
        }
    }

    return -1;
}

function addStringToPool(s, pool) {
    var offset = findSubArray(s, pool);
    if (offset < 0) {
        offset = pool.length;
        var i = 0;
        var len = s.length;
        for (; i < len; ++i) {
            pool.push(s[i]);
        }

    }

    return offset;
}

function makeNameTable(names, ltag) {
    var nameID;
    var nameIDs = [];

    var namesWithNumericKeys = {};
    var nameTableIds = reverseDict(nameTableNames);
    for (var key in names) {
        var id = nameTableIds[key];
        if (id === undefined) {
            id = key;
        }

        nameID = parseInt(id);

        if (isNaN(nameID)) {
            throw new Error('Name table entry "' + key + '" does not exist, see nameTableNames for complete list.');
        }

        namesWithNumericKeys[nameID] = names[key];
        nameIDs.push(nameID);
    }

    var macLanguageIds = reverseDict(macLanguages);
    var windowsLanguageIds = reverseDict(windowsLanguages);

    var nameRecords = [];
    var stringPool = [];

    for (var i = 0; i < nameIDs.length; i++) {
        nameID = nameIDs[i];
        var translations = namesWithNumericKeys[nameID];
        for (var lang in translations) {
            var text = translations[lang];

            // For MacOS, we try to emit the name in the form that was introduced
            // in the initial version of the TrueType spec (in the late 1980s).
            // However, this can fail for various reasons: the requested BCP 47
            // language code might not have an old-style Mac equivalent;
            // we might not have a codec for the needed character encoding;
            // or the name might contain characters that cannot be expressed
            // in the old-style Macintosh encoding. In case of failure, we emit
            // the name in a more modern fashion (Unicode encoding with BCP 47
            // language tags) that is recognized by MacOS 10.5, released in 2009.
            // If fonts were only read by operating systems, we could simply
            // emit all names in the modern form; this would be much easier.
            // However, there are many applications and libraries that read
            // 'name' tables directly, and these will usually only recognize
            // the ancient form (silently skipping the unrecognized names).
            var macPlatform = 1;  // Macintosh
            var macLanguage = macLanguageIds[lang];
            var macScript = macLanguageToScript[macLanguage];
            var macEncoding = getEncoding(macPlatform, macScript, macLanguage);
            var macName = encode.MACSTRING(text, macEncoding);
            if (macName === undefined) {
                macPlatform = 0;  // Unicode
                macLanguage = ltag.indexOf(lang);
                if (macLanguage < 0) {
                    macLanguage = ltag.length;
                    ltag.push(lang);
                }

                macScript = 4;  // Unicode 2.0 and later
                macName = encode.UTF16(text);
            }

            var macNameOffset = addStringToPool(macName, stringPool);
            nameRecords.push(makeNameRecord(macPlatform, macScript, macLanguage,
                                            nameID, macName.length, macNameOffset));

            var winLanguage = windowsLanguageIds[lang];
            if (winLanguage !== undefined) {
                var winName = encode.UTF16(text);
                var winNameOffset = addStringToPool(winName, stringPool);
                nameRecords.push(makeNameRecord(3, 1, winLanguage,
                                                nameID, winName.length, winNameOffset));
            }
        }
    }

    nameRecords.sort(function(a, b) {
        return ((a.platformID - b.platformID) ||
                (a.encodingID - b.encodingID) ||
                (a.languageID - b.languageID) ||
                (a.nameID - b.nameID));
    });

    var t = new table.Table('name', [
        {name: 'format', type: 'USHORT', value: 0},
        {name: 'count', type: 'USHORT', value: nameRecords.length},
        {name: 'stringOffset', type: 'USHORT', value: 6 + nameRecords.length * 12}
    ]);

    for (var r = 0; r < nameRecords.length; r++) {
        t.fields.push({name: 'record_' + r, type: 'RECORD', value: nameRecords[r]});
    }

    t.fields.push({name: 'strings', type: 'LITERAL', value: stringPool});
    return t;
}

var _name = { parse: parseNameTable, make: makeNameTable };

// The `OS/2` table contains metrics required in OpenType fonts.
// https://www.microsoft.com/typography/OTSPEC/os2.htm

var unicodeRanges = [
    {begin: 0x0000, end: 0x007F}, // Basic Latin
    {begin: 0x0080, end: 0x00FF}, // Latin-1 Supplement
    {begin: 0x0100, end: 0x017F}, // Latin Extended-A
    {begin: 0x0180, end: 0x024F}, // Latin Extended-B
    {begin: 0x0250, end: 0x02AF}, // IPA Extensions
    {begin: 0x02B0, end: 0x02FF}, // Spacing Modifier Letters
    {begin: 0x0300, end: 0x036F}, // Combining Diacritical Marks
    {begin: 0x0370, end: 0x03FF}, // Greek and Coptic
    {begin: 0x2C80, end: 0x2CFF}, // Coptic
    {begin: 0x0400, end: 0x04FF}, // Cyrillic
    {begin: 0x0530, end: 0x058F}, // Armenian
    {begin: 0x0590, end: 0x05FF}, // Hebrew
    {begin: 0xA500, end: 0xA63F}, // Vai
    {begin: 0x0600, end: 0x06FF}, // Arabic
    {begin: 0x07C0, end: 0x07FF}, // NKo
    {begin: 0x0900, end: 0x097F}, // Devanagari
    {begin: 0x0980, end: 0x09FF}, // Bengali
    {begin: 0x0A00, end: 0x0A7F}, // Gurmukhi
    {begin: 0x0A80, end: 0x0AFF}, // Gujarati
    {begin: 0x0B00, end: 0x0B7F}, // Oriya
    {begin: 0x0B80, end: 0x0BFF}, // Tamil
    {begin: 0x0C00, end: 0x0C7F}, // Telugu
    {begin: 0x0C80, end: 0x0CFF}, // Kannada
    {begin: 0x0D00, end: 0x0D7F}, // Malayalam
    {begin: 0x0E00, end: 0x0E7F}, // Thai
    {begin: 0x0E80, end: 0x0EFF}, // Lao
    {begin: 0x10A0, end: 0x10FF}, // Georgian
    {begin: 0x1B00, end: 0x1B7F}, // Balinese
    {begin: 0x1100, end: 0x11FF}, // Hangul Jamo
    {begin: 0x1E00, end: 0x1EFF}, // Latin Extended Additional
    {begin: 0x1F00, end: 0x1FFF}, // Greek Extended
    {begin: 0x2000, end: 0x206F}, // General Punctuation
    {begin: 0x2070, end: 0x209F}, // Superscripts And Subscripts
    {begin: 0x20A0, end: 0x20CF}, // Currency Symbol
    {begin: 0x20D0, end: 0x20FF}, // Combining Diacritical Marks For Symbols
    {begin: 0x2100, end: 0x214F}, // Letterlike Symbols
    {begin: 0x2150, end: 0x218F}, // Number Forms
    {begin: 0x2190, end: 0x21FF}, // Arrows
    {begin: 0x2200, end: 0x22FF}, // Mathematical Operators
    {begin: 0x2300, end: 0x23FF}, // Miscellaneous Technical
    {begin: 0x2400, end: 0x243F}, // Control Pictures
    {begin: 0x2440, end: 0x245F}, // Optical Character Recognition
    {begin: 0x2460, end: 0x24FF}, // Enclosed Alphanumerics
    {begin: 0x2500, end: 0x257F}, // Box Drawing
    {begin: 0x2580, end: 0x259F}, // Block Elements
    {begin: 0x25A0, end: 0x25FF}, // Geometric Shapes
    {begin: 0x2600, end: 0x26FF}, // Miscellaneous Symbols
    {begin: 0x2700, end: 0x27BF}, // Dingbats
    {begin: 0x3000, end: 0x303F}, // CJK Symbols And Punctuation
    {begin: 0x3040, end: 0x309F}, // Hiragana
    {begin: 0x30A0, end: 0x30FF}, // Katakana
    {begin: 0x3100, end: 0x312F}, // Bopomofo
    {begin: 0x3130, end: 0x318F}, // Hangul Compatibility Jamo
    {begin: 0xA840, end: 0xA87F}, // Phags-pa
    {begin: 0x3200, end: 0x32FF}, // Enclosed CJK Letters And Months
    {begin: 0x3300, end: 0x33FF}, // CJK Compatibility
    {begin: 0xAC00, end: 0xD7AF}, // Hangul Syllables
    {begin: 0xD800, end: 0xDFFF}, // Non-Plane 0 *
    {begin: 0x10900, end: 0x1091F}, // Phoenicia
    {begin: 0x4E00, end: 0x9FFF}, // CJK Unified Ideographs
    {begin: 0xE000, end: 0xF8FF}, // Private Use Area (plane 0)
    {begin: 0x31C0, end: 0x31EF}, // CJK Strokes
    {begin: 0xFB00, end: 0xFB4F}, // Alphabetic Presentation Forms
    {begin: 0xFB50, end: 0xFDFF}, // Arabic Presentation Forms-A
    {begin: 0xFE20, end: 0xFE2F}, // Combining Half Marks
    {begin: 0xFE10, end: 0xFE1F}, // Vertical Forms
    {begin: 0xFE50, end: 0xFE6F}, // Small Form Variants
    {begin: 0xFE70, end: 0xFEFF}, // Arabic Presentation Forms-B
    {begin: 0xFF00, end: 0xFFEF}, // Halfwidth And Fullwidth Forms
    {begin: 0xFFF0, end: 0xFFFF}, // Specials
    {begin: 0x0F00, end: 0x0FFF}, // Tibetan
    {begin: 0x0700, end: 0x074F}, // Syriac
    {begin: 0x0780, end: 0x07BF}, // Thaana
    {begin: 0x0D80, end: 0x0DFF}, // Sinhala
    {begin: 0x1000, end: 0x109F}, // Myanmar
    {begin: 0x1200, end: 0x137F}, // Ethiopic
    {begin: 0x13A0, end: 0x13FF}, // Cherokee
    {begin: 0x1400, end: 0x167F}, // Unified Canadian Aboriginal Syllabics
    {begin: 0x1680, end: 0x169F}, // Ogham
    {begin: 0x16A0, end: 0x16FF}, // Runic
    {begin: 0x1780, end: 0x17FF}, // Khmer
    {begin: 0x1800, end: 0x18AF}, // Mongolian
    {begin: 0x2800, end: 0x28FF}, // Braille Patterns
    {begin: 0xA000, end: 0xA48F}, // Yi Syllables
    {begin: 0x1700, end: 0x171F}, // Tagalog
    {begin: 0x10300, end: 0x1032F}, // Old Italic
    {begin: 0x10330, end: 0x1034F}, // Gothic
    {begin: 0x10400, end: 0x1044F}, // Deseret
    {begin: 0x1D000, end: 0x1D0FF}, // Byzantine Musical Symbols
    {begin: 0x1D400, end: 0x1D7FF}, // Mathematical Alphanumeric Symbols
    {begin: 0xFF000, end: 0xFFFFD}, // Private Use (plane 15)
    {begin: 0xFE00, end: 0xFE0F}, // Variation Selectors
    {begin: 0xE0000, end: 0xE007F}, // Tags
    {begin: 0x1900, end: 0x194F}, // Limbu
    {begin: 0x1950, end: 0x197F}, // Tai Le
    {begin: 0x1980, end: 0x19DF}, // New Tai Lue
    {begin: 0x1A00, end: 0x1A1F}, // Buginese
    {begin: 0x2C00, end: 0x2C5F}, // Glagolitic
    {begin: 0x2D30, end: 0x2D7F}, // Tifinagh
    {begin: 0x4DC0, end: 0x4DFF}, // Yijing Hexagram Symbols
    {begin: 0xA800, end: 0xA82F}, // Syloti Nagri
    {begin: 0x10000, end: 0x1007F}, // Linear B Syllabary
    {begin: 0x10140, end: 0x1018F}, // Ancient Greek Numbers
    {begin: 0x10380, end: 0x1039F}, // Ugaritic
    {begin: 0x103A0, end: 0x103DF}, // Old Persian
    {begin: 0x10450, end: 0x1047F}, // Shavian
    {begin: 0x10480, end: 0x104AF}, // Osmanya
    {begin: 0x10800, end: 0x1083F}, // Cypriot Syllabary
    {begin: 0x10A00, end: 0x10A5F}, // Kharoshthi
    {begin: 0x1D300, end: 0x1D35F}, // Tai Xuan Jing Symbols
    {begin: 0x12000, end: 0x123FF}, // Cuneiform
    {begin: 0x1D360, end: 0x1D37F}, // Counting Rod Numerals
    {begin: 0x1B80, end: 0x1BBF}, // Sundanese
    {begin: 0x1C00, end: 0x1C4F}, // Lepcha
    {begin: 0x1C50, end: 0x1C7F}, // Ol Chiki
    {begin: 0xA880, end: 0xA8DF}, // Saurashtra
    {begin: 0xA900, end: 0xA92F}, // Kayah Li
    {begin: 0xA930, end: 0xA95F}, // Rejang
    {begin: 0xAA00, end: 0xAA5F}, // Cham
    {begin: 0x10190, end: 0x101CF}, // Ancient Symbols
    {begin: 0x101D0, end: 0x101FF}, // Phaistos Disc
    {begin: 0x102A0, end: 0x102DF}, // Carian
    {begin: 0x1F030, end: 0x1F09F}  // Domino Tiles
];

function getUnicodeRange(unicode) {
    for (var i = 0; i < unicodeRanges.length; i += 1) {
        var range = unicodeRanges[i];
        if (unicode >= range.begin && unicode < range.end) {
            return i;
        }
    }

    return -1;
}

// Parse the OS/2 and Windows metrics `OS/2` table
function parseOS2Table(data, start) {
    var os2 = {};
    var p = new parse.Parser(data, start);
    os2.version = p.parseUShort();
    os2.xAvgCharWidth = p.parseShort();
    os2.usWeightClass = p.parseUShort();
    os2.usWidthClass = p.parseUShort();
    os2.fsType = p.parseUShort();
    os2.ySubscriptXSize = p.parseShort();
    os2.ySubscriptYSize = p.parseShort();
    os2.ySubscriptXOffset = p.parseShort();
    os2.ySubscriptYOffset = p.parseShort();
    os2.ySuperscriptXSize = p.parseShort();
    os2.ySuperscriptYSize = p.parseShort();
    os2.ySuperscriptXOffset = p.parseShort();
    os2.ySuperscriptYOffset = p.parseShort();
    os2.yStrikeoutSize = p.parseShort();
    os2.yStrikeoutPosition = p.parseShort();
    os2.sFamilyClass = p.parseShort();
    os2.panose = [];
    for (var i = 0; i < 10; i++) {
        os2.panose[i] = p.parseByte();
    }

    os2.ulUnicodeRange1 = p.parseULong();
    os2.ulUnicodeRange2 = p.parseULong();
    os2.ulUnicodeRange3 = p.parseULong();
    os2.ulUnicodeRange4 = p.parseULong();
    os2.achVendID = String.fromCharCode(p.parseByte(), p.parseByte(), p.parseByte(), p.parseByte());
    os2.fsSelection = p.parseUShort();
    os2.usFirstCharIndex = p.parseUShort();
    os2.usLastCharIndex = p.parseUShort();
    os2.sTypoAscender = p.parseShort();
    os2.sTypoDescender = p.parseShort();
    os2.sTypoLineGap = p.parseShort();
    os2.usWinAscent = p.parseUShort();
    os2.usWinDescent = p.parseUShort();
    if (os2.version >= 1) {
        os2.ulCodePageRange1 = p.parseULong();
        os2.ulCodePageRange2 = p.parseULong();
    }

    if (os2.version >= 2) {
        os2.sxHeight = p.parseShort();
        os2.sCapHeight = p.parseShort();
        os2.usDefaultChar = p.parseUShort();
        os2.usBreakChar = p.parseUShort();
        os2.usMaxContent = p.parseUShort();
    }

    return os2;
}

function makeOS2Table(options) {
    return new table.Table('OS/2', [
        {name: 'version', type: 'USHORT', value: 0x0003},
        {name: 'xAvgCharWidth', type: 'SHORT', value: 0},
        {name: 'usWeightClass', type: 'USHORT', value: 0},
        {name: 'usWidthClass', type: 'USHORT', value: 0},
        {name: 'fsType', type: 'USHORT', value: 0},
        {name: 'ySubscriptXSize', type: 'SHORT', value: 650},
        {name: 'ySubscriptYSize', type: 'SHORT', value: 699},
        {name: 'ySubscriptXOffset', type: 'SHORT', value: 0},
        {name: 'ySubscriptYOffset', type: 'SHORT', value: 140},
        {name: 'ySuperscriptXSize', type: 'SHORT', value: 650},
        {name: 'ySuperscriptYSize', type: 'SHORT', value: 699},
        {name: 'ySuperscriptXOffset', type: 'SHORT', value: 0},
        {name: 'ySuperscriptYOffset', type: 'SHORT', value: 479},
        {name: 'yStrikeoutSize', type: 'SHORT', value: 49},
        {name: 'yStrikeoutPosition', type: 'SHORT', value: 258},
        {name: 'sFamilyClass', type: 'SHORT', value: 0},
        {name: 'bFamilyType', type: 'BYTE', value: 0},
        {name: 'bSerifStyle', type: 'BYTE', value: 0},
        {name: 'bWeight', type: 'BYTE', value: 0},
        {name: 'bProportion', type: 'BYTE', value: 0},
        {name: 'bContrast', type: 'BYTE', value: 0},
        {name: 'bStrokeVariation', type: 'BYTE', value: 0},
        {name: 'bArmStyle', type: 'BYTE', value: 0},
        {name: 'bLetterform', type: 'BYTE', value: 0},
        {name: 'bMidline', type: 'BYTE', value: 0},
        {name: 'bXHeight', type: 'BYTE', value: 0},
        {name: 'ulUnicodeRange1', type: 'ULONG', value: 0},
        {name: 'ulUnicodeRange2', type: 'ULONG', value: 0},
        {name: 'ulUnicodeRange3', type: 'ULONG', value: 0},
        {name: 'ulUnicodeRange4', type: 'ULONG', value: 0},
        {name: 'achVendID', type: 'CHARARRAY', value: 'XXXX'},
        {name: 'fsSelection', type: 'USHORT', value: 0},
        {name: 'usFirstCharIndex', type: 'USHORT', value: 0},
        {name: 'usLastCharIndex', type: 'USHORT', value: 0},
        {name: 'sTypoAscender', type: 'SHORT', value: 0},
        {name: 'sTypoDescender', type: 'SHORT', value: 0},
        {name: 'sTypoLineGap', type: 'SHORT', value: 0},
        {name: 'usWinAscent', type: 'USHORT', value: 0},
        {name: 'usWinDescent', type: 'USHORT', value: 0},
        {name: 'ulCodePageRange1', type: 'ULONG', value: 0},
        {name: 'ulCodePageRange2', type: 'ULONG', value: 0},
        {name: 'sxHeight', type: 'SHORT', value: 0},
        {name: 'sCapHeight', type: 'SHORT', value: 0},
        {name: 'usDefaultChar', type: 'USHORT', value: 0},
        {name: 'usBreakChar', type: 'USHORT', value: 0},
        {name: 'usMaxContext', type: 'USHORT', value: 0}
    ], options);
}

var os2 = { parse: parseOS2Table, make: makeOS2Table, unicodeRanges: unicodeRanges, getUnicodeRange: getUnicodeRange };

// The `post` table stores additional PostScript information, such as glyph names.
// https://www.microsoft.com/typography/OTSPEC/post.htm

// Parse the PostScript `post` table
function parsePostTable(data, start) {
    var post = {};
    var p = new parse.Parser(data, start);
    post.version = p.parseVersion();
    post.italicAngle = p.parseFixed();
    post.underlinePosition = p.parseShort();
    post.underlineThickness = p.parseShort();
    post.isFixedPitch = p.parseULong();
    post.minMemType42 = p.parseULong();
    post.maxMemType42 = p.parseULong();
    post.minMemType1 = p.parseULong();
    post.maxMemType1 = p.parseULong();
    switch (post.version) {
        case 1:
            post.names = standardNames.slice();
            break;
        case 2:
            post.numberOfGlyphs = p.parseUShort();
            post.glyphNameIndex = new Array(post.numberOfGlyphs);
            for (var i = 0; i < post.numberOfGlyphs; i++) {
                post.glyphNameIndex[i] = p.parseUShort();
            }

            post.names = [];
            for (var i$1 = 0; i$1 < post.numberOfGlyphs; i$1++) {
                if (post.glyphNameIndex[i$1] >= standardNames.length) {
                    var nameLength = p.parseChar();
                    post.names.push(p.parseString(nameLength));
                }
            }

            break;
        case 2.5:
            post.numberOfGlyphs = p.parseUShort();
            post.offset = new Array(post.numberOfGlyphs);
            for (var i$2 = 0; i$2 < post.numberOfGlyphs; i$2++) {
                post.offset[i$2] = p.parseChar();
            }

            break;
    }
    return post;
}

function makePostTable() {
    return new table.Table('post', [
        {name: 'version', type: 'FIXED', value: 0x00030000},
        {name: 'italicAngle', type: 'FIXED', value: 0},
        {name: 'underlinePosition', type: 'FWORD', value: 0},
        {name: 'underlineThickness', type: 'FWORD', value: 0},
        {name: 'isFixedPitch', type: 'ULONG', value: 0},
        {name: 'minMemType42', type: 'ULONG', value: 0},
        {name: 'maxMemType42', type: 'ULONG', value: 0},
        {name: 'minMemType1', type: 'ULONG', value: 0},
        {name: 'maxMemType1', type: 'ULONG', value: 0}
    ]);
}

var post = { parse: parsePostTable, make: makePostTable };

// The `GSUB` table contains ligatures, among other things.
// https://www.microsoft.com/typography/OTSPEC/gsub.htm

var subtableParsers = new Array(9);         // subtableParsers[0] is unused

// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#SS
subtableParsers[1] = function parseLookup1() {
    var start = this.offset + this.relativeOffset;
    var substFormat = this.parseUShort();
    if (substFormat === 1) {
        return {
            substFormat: 1,
            coverage: this.parsePointer(Parser.coverage),
            deltaGlyphId: this.parseUShort()
        };
    } else if (substFormat === 2) {
        return {
            substFormat: 2,
            coverage: this.parsePointer(Parser.coverage),
            substitute: this.parseOffset16List()
        };
    }
    check.assert(false, '0x' + start.toString(16) + ': lookup type 1 format must be 1 or 2.');
};

// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#MS
subtableParsers[2] = function parseLookup2() {
    var substFormat = this.parseUShort();
    check.argument(substFormat === 1, 'GSUB Multiple Substitution Subtable identifier-format must be 1');
    return {
        substFormat: substFormat,
        coverage: this.parsePointer(Parser.coverage),
        sequences: this.parseListOfLists()
    };
};

// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#AS
subtableParsers[3] = function parseLookup3() {
    var substFormat = this.parseUShort();
    check.argument(substFormat === 1, 'GSUB Alternate Substitution Subtable identifier-format must be 1');
    return {
        substFormat: substFormat,
        coverage: this.parsePointer(Parser.coverage),
        alternateSets: this.parseListOfLists()
    };
};

// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#LS
subtableParsers[4] = function parseLookup4() {
    var substFormat = this.parseUShort();
    check.argument(substFormat === 1, 'GSUB ligature table identifier-format must be 1');
    return {
        substFormat: substFormat,
        coverage: this.parsePointer(Parser.coverage),
        ligatureSets: this.parseListOfLists(function() {
            return {
                ligGlyph: this.parseUShort(),
                components: this.parseUShortList(this.parseUShort() - 1)
            };
        })
    };
};

var lookupRecordDesc = {
    sequenceIndex: Parser.uShort,
    lookupListIndex: Parser.uShort
};

// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#CSF
subtableParsers[5] = function parseLookup5() {
    var start = this.offset + this.relativeOffset;
    var substFormat = this.parseUShort();

    if (substFormat === 1) {
        return {
            substFormat: substFormat,
            coverage: this.parsePointer(Parser.coverage),
            ruleSets: this.parseListOfLists(function() {
                var glyphCount = this.parseUShort();
                var substCount = this.parseUShort();
                return {
                    input: this.parseUShortList(glyphCount - 1),
                    lookupRecords: this.parseRecordList(substCount, lookupRecordDesc)
                };
            })
        };
    } else if (substFormat === 2) {
        return {
            substFormat: substFormat,
            coverage: this.parsePointer(Parser.coverage),
            classDef: this.parsePointer(Parser.classDef),
            classSets: this.parseListOfLists(function() {
                var glyphCount = this.parseUShort();
                var substCount = this.parseUShort();
                return {
                    classes: this.parseUShortList(glyphCount - 1),
                    lookupRecords: this.parseRecordList(substCount, lookupRecordDesc)
                };
            })
        };
    } else if (substFormat === 3) {
        var glyphCount = this.parseUShort();
        var substCount = this.parseUShort();
        return {
            substFormat: substFormat,
            coverages: this.parseList(glyphCount, Parser.pointer(Parser.coverage)),
            lookupRecords: this.parseRecordList(substCount, lookupRecordDesc)
        };
    }
    check.assert(false, '0x' + start.toString(16) + ': lookup type 5 format must be 1, 2 or 3.');
};

// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#CC
subtableParsers[6] = function parseLookup6() {
    var start = this.offset + this.relativeOffset;
    var substFormat = this.parseUShort();
    if (substFormat === 1) {
        return {
            substFormat: 1,
            coverage: this.parsePointer(Parser.coverage),
            chainRuleSets: this.parseListOfLists(function() {
                return {
                    backtrack: this.parseUShortList(),
                    input: this.parseUShortList(this.parseShort() - 1),
                    lookahead: this.parseUShortList(),
                    lookupRecords: this.parseRecordList(lookupRecordDesc)
                };
            })
        };
    } else if (substFormat === 2) {
        return {
            substFormat: 2,
            coverage: this.parsePointer(Parser.coverage),
            backtrackClassDef: this.parsePointer(Parser.classDef),
            inputClassDef: this.parsePointer(Parser.classDef),
            lookaheadClassDef: this.parsePointer(Parser.classDef),
            chainClassSet: this.parseListOfLists(function() {
                return {
                    backtrack: this.parseUShortList(),
                    input: this.parseUShortList(this.parseShort() - 1),
                    lookahead: this.parseUShortList(),
                    lookupRecords: this.parseRecordList(lookupRecordDesc)
                };
            })
        };
    } else if (substFormat === 3) {
        return {
            substFormat: 3,
            backtrackCoverage: this.parseList(Parser.pointer(Parser.coverage)),
            inputCoverage: this.parseList(Parser.pointer(Parser.coverage)),
            lookaheadCoverage: this.parseList(Parser.pointer(Parser.coverage)),
            lookupRecords: this.parseRecordList(lookupRecordDesc)
        };
    }
    check.assert(false, '0x' + start.toString(16) + ': lookup type 6 format must be 1, 2 or 3.');
};

// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#ES
subtableParsers[7] = function parseLookup7() {
    // Extension Substitution subtable
    var substFormat = this.parseUShort();
    check.argument(substFormat === 1, 'GSUB Extension Substitution subtable identifier-format must be 1');
    var extensionLookupType = this.parseUShort();
    var extensionParser = new Parser(this.data, this.offset + this.parseULong());
    return {
        substFormat: 1,
        lookupType: extensionLookupType,
        extension: subtableParsers[extensionLookupType].call(extensionParser)
    };
};

// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#RCCS
subtableParsers[8] = function parseLookup8() {
    var substFormat = this.parseUShort();
    check.argument(substFormat === 1, 'GSUB Reverse Chaining Contextual Single Substitution Subtable identifier-format must be 1');
    return {
        substFormat: substFormat,
        coverage: this.parsePointer(Parser.coverage),
        backtrackCoverage: this.parseList(Parser.pointer(Parser.coverage)),
        lookaheadCoverage: this.parseList(Parser.pointer(Parser.coverage)),
        substitutes: this.parseUShortList()
    };
};

// https://www.microsoft.com/typography/OTSPEC/gsub.htm
function parseGsubTable(data, start) {
    start = start || 0;
    var p = new Parser(data, start);
    var tableVersion = p.parseVersion();
    check.argument(tableVersion === 1, 'Unsupported GSUB table version.');
    return {
        version: tableVersion,
        scripts: p.parseScriptList(),
        features: p.parseFeatureList(),
        lookups: p.parseLookupList(subtableParsers)
    };
}

// GSUB Writing //////////////////////////////////////////////
var subtableMakers = new Array(9);

subtableMakers[1] = function makeLookup1(subtable) {
    if (subtable.substFormat === 1) {
        return new table.Table('substitutionTable', [
            {name: 'substFormat', type: 'USHORT', value: 1},
            {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)},
            {name: 'deltaGlyphID', type: 'USHORT', value: subtable.deltaGlyphId}
        ]);
    } else {
        return new table.Table('substitutionTable', [
            {name: 'substFormat', type: 'USHORT', value: 2},
            {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)}
        ].concat(table.ushortList('substitute', subtable.substitute)));
    }
    check.fail('Lookup type 1 substFormat must be 1 or 2.');
};

subtableMakers[3] = function makeLookup3(subtable) {
    check.assert(subtable.substFormat === 1, 'Lookup type 3 substFormat must be 1.');
    return new table.Table('substitutionTable', [
        {name: 'substFormat', type: 'USHORT', value: 1},
        {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)}
    ].concat(table.tableList('altSet', subtable.alternateSets, function(alternateSet) {
        return new table.Table('alternateSetTable', table.ushortList('alternate', alternateSet));
    })));
};

subtableMakers[4] = function makeLookup4(subtable) {
    check.assert(subtable.substFormat === 1, 'Lookup type 4 substFormat must be 1.');
    return new table.Table('substitutionTable', [
        {name: 'substFormat', type: 'USHORT', value: 1},
        {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)}
    ].concat(table.tableList('ligSet', subtable.ligatureSets, function(ligatureSet) {
        return new table.Table('ligatureSetTable', table.tableList('ligature', ligatureSet, function(ligature) {
            return new table.Table('ligatureTable',
                [{name: 'ligGlyph', type: 'USHORT', value: ligature.ligGlyph}]
                .concat(table.ushortList('component', ligature.components, ligature.components.length + 1))
            );
        }));
    })));
};

function makeGsubTable(gsub) {
    return new table.Table('GSUB', [
        {name: 'version', type: 'ULONG', value: 0x10000},
        {name: 'scripts', type: 'TABLE', value: new table.ScriptList(gsub.scripts)},
        {name: 'features', type: 'TABLE', value: new table.FeatureList(gsub.features)},
        {name: 'lookups', type: 'TABLE', value: new table.LookupList(gsub.lookups, subtableMakers)}
    ]);
}

var gsub = { parse: parseGsubTable, make: makeGsubTable };

// The `GPOS` table contains kerning pairs, among other things.
// https://www.microsoft.com/typography/OTSPEC/gpos.htm

// Parse the metadata `meta` table.
// https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6meta.html
function parseMetaTable(data, start) {
    var p = new parse.Parser(data, start);
    var tableVersion = p.parseULong();
    check.argument(tableVersion === 1, 'Unsupported META table version.');
    p.parseULong(); // flags - currently unused and set to 0
    p.parseULong(); // tableOffset
    var numDataMaps = p.parseULong();

    var tags = {};
    for (var i = 0; i < numDataMaps; i++) {
        var tag = p.parseTag();
        var dataOffset = p.parseULong();
        var dataLength = p.parseULong();
        var text = decode.UTF8(data, start + dataOffset, dataLength);

        tags[tag] = text;
    }
    return tags;
}

function makeMetaTable(tags) {
    var numTags = Object.keys(tags).length;
    var stringPool = '';
    var stringPoolOffset = 16 + numTags * 12;

    var result = new table.Table('meta', [
        {name: 'version', type: 'ULONG', value: 1},
        {name: 'flags', type: 'ULONG', value: 0},
        {name: 'offset', type: 'ULONG', value: stringPoolOffset},
        {name: 'numTags', type: 'ULONG', value: numTags}
    ]);

    for (var tag in tags) {
        var pos = stringPool.length;
        stringPool += tags[tag];

        result.fields.push({name: 'tag ' + tag, type: 'TAG', value: tag});
        result.fields.push({name: 'offset ' + tag, type: 'ULONG', value: stringPoolOffset + pos});
        result.fields.push({name: 'length ' + tag, type: 'ULONG', value: tags[tag].length});
    }

    result.fields.push({name: 'stringPool', type: 'CHARARRAY', value: stringPool});

    return result;
}

var meta = { parse: parseMetaTable, make: makeMetaTable };

// The `sfnt` wrapper provides organization for the tables in the font.
// It is the top-level data structure in a font.
// https://www.microsoft.com/typography/OTSPEC/otff.htm
// Recommendations for creating OpenType Fonts:
// http://www.microsoft.com/typography/otspec140/recom.htm

function log2(v) {
    return Math.log(v) / Math.log(2) | 0;
}

function computeCheckSum(bytes) {
    while (bytes.length % 4 !== 0) {
        bytes.push(0);
    }

    var sum = 0;
    for (var i = 0; i < bytes.length; i += 4) {
        sum += (bytes[i] << 24) +
            (bytes[i + 1] << 16) +
            (bytes[i + 2] << 8) +
            (bytes[i + 3]);
    }

    sum %= Math.pow(2, 32);
    return sum;
}

function makeTableRecord(tag, checkSum, offset, length) {
    return new table.Record('Table Record', [
        {name: 'tag', type: 'TAG', value: tag !== undefined ? tag : ''},
        {name: 'checkSum', type: 'ULONG', value: checkSum !== undefined ? checkSum : 0},
        {name: 'offset', type: 'ULONG', value: offset !== undefined ? offset : 0},
        {name: 'length', type: 'ULONG', value: length !== undefined ? length : 0}
    ]);
}

function makeSfntTable(tables) {
    var sfnt = new table.Table('sfnt', [
        {name: 'version', type: 'TAG', value: 'OTTO'},
        {name: 'numTables', type: 'USHORT', value: 0},
        {name: 'searchRange', type: 'USHORT', value: 0},
        {name: 'entrySelector', type: 'USHORT', value: 0},
        {name: 'rangeShift', type: 'USHORT', value: 0}
    ]);
    sfnt.tables = tables;
    sfnt.numTables = tables.length;
    var highestPowerOf2 = Math.pow(2, log2(sfnt.numTables));
    sfnt.searchRange = 16 * highestPowerOf2;
    sfnt.entrySelector = log2(highestPowerOf2);
    sfnt.rangeShift = sfnt.numTables * 16 - sfnt.searchRange;

    var recordFields = [];
    var tableFields = [];

    var offset = sfnt.sizeOf() + (makeTableRecord().sizeOf() * sfnt.numTables);
    while (offset % 4 !== 0) {
        offset += 1;
        tableFields.push({name: 'padding', type: 'BYTE', value: 0});
    }

    for (var i = 0; i < tables.length; i += 1) {
        var t = tables[i];
        check.argument(t.tableName.length === 4, 'Table name' + t.tableName + ' is invalid.');
        var tableLength = t.sizeOf();
        var tableRecord = makeTableRecord(t.tableName, computeCheckSum(t.encode()), offset, tableLength);
        recordFields.push({name: tableRecord.tag + ' Table Record', type: 'RECORD', value: tableRecord});
        tableFields.push({name: t.tableName + ' table', type: 'RECORD', value: t});
        offset += tableLength;
        check.argument(!isNaN(offset), 'Something went wrong calculating the offset.');
        while (offset % 4 !== 0) {
            offset += 1;
            tableFields.push({name: 'padding', type: 'BYTE', value: 0});
        }
    }

    // Table records need to be sorted alphabetically.
    recordFields.sort(function(r1, r2) {
        if (r1.value.tag > r2.value.tag) {
            return 1;
        } else {
            return -1;
        }
    });

    sfnt.fields = sfnt.fields.concat(recordFields);
    sfnt.fields = sfnt.fields.concat(tableFields);
    return sfnt;
}

// Get the metrics for a character. If the string has more than one character
// this function returns metrics for the first available character.
// You can provide optional fallback metrics if no characters are available.
function metricsForChar(font, chars, notFoundMetrics) {
    for (var i = 0; i < chars.length; i += 1) {
        var glyphIndex = font.charToGlyphIndex(chars[i]);
        if (glyphIndex > 0) {
            var glyph = font.glyphs.get(glyphIndex);
            return glyph.getMetrics();
        }
    }

    return notFoundMetrics;
}

function average(vs) {
    var sum = 0;
    for (var i = 0; i < vs.length; i += 1) {
        sum += vs[i];
    }

    return sum / vs.length;
}

// Convert the font object to a SFNT data structure.
// This structure contains all the necessary tables and metadata to create a binary OTF file.
function fontToSfntTable(font) {
    var xMins = [];
    var yMins = [];
    var xMaxs = [];
    var yMaxs = [];
    var advanceWidths = [];
    var leftSideBearings = [];
    var rightSideBearings = [];
    var firstCharIndex;
    var lastCharIndex = 0;
    var ulUnicodeRange1 = 0;
    var ulUnicodeRange2 = 0;
    var ulUnicodeRange3 = 0;
    var ulUnicodeRange4 = 0;

    for (var i = 0; i < font.glyphs.length; i += 1) {
        var glyph = font.glyphs.get(i);
        var unicode = glyph.unicode | 0;

        if (isNaN(glyph.advanceWidth)) {
            throw new Error('Glyph ' + glyph.name + ' (' + i + '): advanceWidth is not a number.');
        }

        if (firstCharIndex > unicode || firstCharIndex === undefined) {
            // ignore .notdef char
            if (unicode > 0) {
                firstCharIndex = unicode;
            }
        }

        if (lastCharIndex < unicode) {
            lastCharIndex = unicode;
        }

        var position = os2.getUnicodeRange(unicode);
        if (position < 32) {
            ulUnicodeRange1 |= 1 << position;
        } else if (position < 64) {
            ulUnicodeRange2 |= 1 << position - 32;
        } else if (position < 96) {
            ulUnicodeRange3 |= 1 << position - 64;
        } else if (position < 123) {
            ulUnicodeRange4 |= 1 << position - 96;
        } else {
            throw new Error('Unicode ranges bits > 123 are reserved for internal usage');
        }
        // Skip non-important characters.
        if (glyph.name === '.notdef') { continue; }
        var metrics = glyph.getMetrics();
        xMins.push(metrics.xMin);
        yMins.push(metrics.yMin);
        xMaxs.push(metrics.xMax);
        yMaxs.push(metrics.yMax);
        leftSideBearings.push(metrics.leftSideBearing);
        rightSideBearings.push(metrics.rightSideBearing);
        advanceWidths.push(glyph.advanceWidth);
    }

    var globals = {
        xMin: Math.min.apply(null, xMins),
        yMin: Math.min.apply(null, yMins),
        xMax: Math.max.apply(null, xMaxs),
        yMax: Math.max.apply(null, yMaxs),
        advanceWidthMax: Math.max.apply(null, advanceWidths),
        advanceWidthAvg: average(advanceWidths),
        minLeftSideBearing: Math.min.apply(null, leftSideBearings),
        maxLeftSideBearing: Math.max.apply(null, leftSideBearings),
        minRightSideBearing: Math.min.apply(null, rightSideBearings)
    };
    globals.ascender = font.ascender;
    globals.descender = font.descender;

    var headTable = head.make({
        flags: 3, // 00000011 (baseline for font at y=0; left sidebearing point at x=0)
        unitsPerEm: font.unitsPerEm,
        xMin: globals.xMin,
        yMin: globals.yMin,
        xMax: globals.xMax,
        yMax: globals.yMax,
        lowestRecPPEM: 3,
        createdTimestamp: font.createdTimestamp
    });

    var hheaTable = hhea.make({
        ascender: globals.ascender,
        descender: globals.descender,
        advanceWidthMax: globals.advanceWidthMax,
        minLeftSideBearing: globals.minLeftSideBearing,
        minRightSideBearing: globals.minRightSideBearing,
        xMaxExtent: globals.maxLeftSideBearing + (globals.xMax - globals.xMin),
        numberOfHMetrics: font.glyphs.length
    });

    var maxpTable = maxp.make(font.glyphs.length);

    var os2Table = os2.make({
        xAvgCharWidth: Math.round(globals.advanceWidthAvg),
        usWeightClass: font.tables.os2.usWeightClass,
        usWidthClass: font.tables.os2.usWidthClass,
        usFirstCharIndex: firstCharIndex,
        usLastCharIndex: lastCharIndex,
        ulUnicodeRange1: ulUnicodeRange1,
        ulUnicodeRange2: ulUnicodeRange2,
        ulUnicodeRange3: ulUnicodeRange3,
        ulUnicodeRange4: ulUnicodeRange4,
        fsSelection: font.tables.os2.fsSelection, // REGULAR
        // See http://typophile.com/node/13081 for more info on vertical metrics.
        // We get metrics for typical characters (such as "x" for xHeight).
        // We provide some fallback characters if characters are unavailable: their
        // ordering was chosen experimentally.
        sTypoAscender: globals.ascender,
        sTypoDescender: globals.descender,
        sTypoLineGap: 0,
        usWinAscent: globals.yMax,
        usWinDescent: Math.abs(globals.yMin),
        ulCodePageRange1: 1, // FIXME: hard-code Latin 1 support for now
        sxHeight: metricsForChar(font, 'xyvw', {yMax: Math.round(globals.ascender / 2)}).yMax,
        sCapHeight: metricsForChar(font, 'HIKLEFJMNTZBDPRAGOQSUVWXY', globals).yMax,
        usDefaultChar: font.hasChar(' ') ? 32 : 0, // Use space as the default character, if available.
        usBreakChar: font.hasChar(' ') ? 32 : 0 // Use space as the break character, if available.
    });

    var hmtxTable = hmtx.make(font.glyphs);
    var cmapTable = cmap.make(font.glyphs);

    var englishFamilyName = font.getEnglishName('fontFamily');
    var englishStyleName = font.getEnglishName('fontSubfamily');
    var englishFullName = englishFamilyName + ' ' + englishStyleName;
    var postScriptName = font.getEnglishName('postScriptName');
    if (!postScriptName) {
        postScriptName = englishFamilyName.replace(/\s/g, '') + '-' + englishStyleName;
    }

    var names = {};
    for (var n in font.names) {
        names[n] = font.names[n];
    }

    if (!names.uniqueID) {
        names.uniqueID = {en: font.getEnglishName('manufacturer') + ':' + englishFullName};
    }

    if (!names.postScriptName) {
        names.postScriptName = {en: postScriptName};
    }

    if (!names.preferredFamily) {
        names.preferredFamily = font.names.fontFamily;
    }

    if (!names.preferredSubfamily) {
        names.preferredSubfamily = font.names.fontSubfamily;
    }

    var languageTags = [];
    var nameTable = _name.make(names, languageTags);
    var ltagTable = (languageTags.length > 0 ? ltag.make(languageTags) : undefined);

    var postTable = post.make();
    var cffTable = cff.make(font.glyphs, {
        version: font.getEnglishName('version'),
        fullName: englishFullName,
        familyName: englishFamilyName,
        weightName: englishStyleName,
        postScriptName: postScriptName,
        unitsPerEm: font.unitsPerEm,
        fontBBox: [0, globals.yMin, globals.ascender, globals.advanceWidthMax]
    });

    var metaTable = (font.metas && Object.keys(font.metas).length > 0) ? meta.make(font.metas) : undefined;

    // The order does not matter because makeSfntTable() will sort them.
    var tables = [headTable, hheaTable, maxpTable, os2Table, nameTable, cmapTable, postTable, cffTable, hmtxTable];
    if (ltagTable) {
        tables.push(ltagTable);
    }
    // Optional tables
    if (font.tables.gsub) {
        tables.push(gsub.make(font.tables.gsub));
    }
    if (metaTable) {
        tables.push(metaTable);
    }

    var sfntTable = makeSfntTable(tables);

    // Compute the font's checkSum and store it in head.checkSumAdjustment.
    var bytes = sfntTable.encode();
    var checkSum = computeCheckSum(bytes);
    var tableFields = sfntTable.fields;
    var checkSumAdjusted = false;
    for (var i$1 = 0; i$1 < tableFields.length; i$1 += 1) {
        if (tableFields[i$1].name === 'head table') {
            tableFields[i$1].value.checkSumAdjustment = 0xB1B0AFBA - checkSum;
            checkSumAdjusted = true;
            break;
        }
    }

    if (!checkSumAdjusted) {
        throw new Error('Could not find head table with checkSum to adjust.');
    }

    return sfntTable;
}

var sfnt = { make: makeSfntTable, fontToTable: fontToSfntTable, computeCheckSum: computeCheckSum };

// The Layout object is the prototype of Substitution objects, and provides
// utility methods to manipulate common layout tables (GPOS, GSUB, GDEF...)

function searchTag(arr, tag) {
    /* jshint bitwise: false */
    var imin = 0;
    var imax = arr.length - 1;
    while (imin <= imax) {
        var imid = (imin + imax) >>> 1;
        var val = arr[imid].tag;
        if (val === tag) {
            return imid;
        } else if (val < tag) {
            imin = imid + 1;
        } else { imax = imid - 1; }
    }
    // Not found: return -1-insertion point
    return -imin - 1;
}

function binSearch(arr, value) {
    /* jshint bitwise: false */
    var imin = 0;
    var imax = arr.length - 1;
    while (imin <= imax) {
        var imid = (imin + imax) >>> 1;
        var val = arr[imid];
        if (val === value) {
            return imid;
        } else if (val < value) {
            imin = imid + 1;
        } else { imax = imid - 1; }
    }
    // Not found: return -1-insertion point
    return -imin - 1;
}

/**
 * @exports opentype.Layout
 * @class
 */
function Layout(font, tableName) {
    this.font = font;
    this.tableName = tableName;
}

Layout.prototype = {

    /**
     * Binary search an object by "tag" property
     * @instance
     * @function searchTag
     * @memberof opentype.Layout
     * @param  {Array} arr
     * @param  {string} tag
     * @return {number}
     */
    searchTag: searchTag,

    /**
     * Binary search in a list of numbers
     * @instance
     * @function binSearch
     * @memberof opentype.Layout
     * @param  {Array} arr
     * @param  {number} value
     * @return {number}
     */
    binSearch: binSearch,

    /**
     * Get or create the Layout table (GSUB, GPOS etc).
     * @param  {boolean} create - Whether to create a new one.
     * @return {Object} The GSUB or GPOS table.
     */
    getTable: function(create) {
        var layout = this.font.tables[this.tableName];
        if (!layout && create) {
            layout = this.font.tables[this.tableName] = this.createDefaultTable();
        }
        return layout;
    },

    /**
     * Returns all scripts in the substitution table.
     * @instance
     * @return {Array}
     */
    getScriptNames: function() {
        var layout = this.getTable();
        if (!layout) { return []; }
        return layout.scripts.map(function(script) {
            return script.tag;
        });
    },

    /**
     * Returns the best bet for a script name.
     * Returns 'DFLT' if it exists.
     * If not, returns 'latn' if it exists.
     * If neither exist, returns undefined.
     */
    getDefaultScriptName: function() {
        var layout = this.getTable();
        if (!layout) { return; }
        var hasLatn = false;
        for (var i = 0; i < layout.scripts.length; i++) {
            var name = layout.scripts[i].tag;
            if (name === 'DFLT') { return name; }
            if (name === 'latn') { hasLatn = true; }
        }
        if (hasLatn) { return 'latn'; }
    },

    /**
     * Returns all LangSysRecords in the given script.
     * @instance
     * @param {string} [script='DFLT']
     * @param {boolean} create - forces the creation of this script table if it doesn't exist.
     * @return {Object} An object with tag and script properties.
     */
    getScriptTable: function(script, create) {
        var layout = this.getTable(create);
        if (layout) {
            script = script || 'DFLT';
            var scripts = layout.scripts;
            var pos = searchTag(layout.scripts, script);
            if (pos >= 0) {
                return scripts[pos].script;
            } else if (create) {
                var scr = {
                    tag: script,
                    script: {
                        defaultLangSys: {reserved: 0, reqFeatureIndex: 0xffff, featureIndexes: []},
                        langSysRecords: []
                    }
                };
                scripts.splice(-1 - pos, 0, scr);
                return scr.script;
            }
        }
    },

    /**
     * Returns a language system table
     * @instance
     * @param {string} [script='DFLT']
     * @param {string} [language='dlft']
     * @param {boolean} create - forces the creation of this langSysTable if it doesn't exist.
     * @return {Object}
     */
    getLangSysTable: function(script, language, create) {
        var scriptTable = this.getScriptTable(script, create);
        if (scriptTable) {
            if (!language || language === 'dflt' || language === 'DFLT') {
                return scriptTable.defaultLangSys;
            }
            var pos = searchTag(scriptTable.langSysRecords, language);
            if (pos >= 0) {
                return scriptTable.langSysRecords[pos].langSys;
            } else if (create) {
                var langSysRecord = {
                    tag: language,
                    langSys: {reserved: 0, reqFeatureIndex: 0xffff, featureIndexes: []}
                };
                scriptTable.langSysRecords.splice(-1 - pos, 0, langSysRecord);
                return langSysRecord.langSys;
            }
        }
    },

    /**
     * Get a specific feature table.
     * @instance
     * @param {string} [script='DFLT']
     * @param {string} [language='dlft']
     * @param {string} feature - One of the codes listed at https://www.microsoft.com/typography/OTSPEC/featurelist.htm
     * @param {boolean} create - forces the creation of the feature table if it doesn't exist.
     * @return {Object}
     */
    getFeatureTable: function(script, language, feature, create) {
        var langSysTable = this.getLangSysTable(script, language, create);
        if (langSysTable) {
            var featureRecord;
            var featIndexes = langSysTable.featureIndexes;
            var allFeatures = this.font.tables[this.tableName].features;
            // The FeatureIndex array of indices is in arbitrary order,
            // even if allFeatures is sorted alphabetically by feature tag.
            for (var i = 0; i < featIndexes.length; i++) {
                featureRecord = allFeatures[featIndexes[i]];
                if (featureRecord.tag === feature) {
                    return featureRecord.feature;
                }
            }
            if (create) {
                var index = allFeatures.length;
                // Automatic ordering of features would require to shift feature indexes in the script list.
                check.assert(index === 0 || feature >= allFeatures[index - 1].tag, 'Features must be added in alphabetical order.');
                featureRecord = {
                    tag: feature,
                    feature: { params: 0, lookupListIndexes: [] }
                };
                allFeatures.push(featureRecord);
                featIndexes.push(index);
                return featureRecord.feature;
            }
        }
    },

    /**
     * Get the lookup tables of a given type for a script/language/feature.
     * @instance
     * @param {string} [script='DFLT']
     * @param {string} [language='dlft']
     * @param {string} feature - 4-letter feature code
     * @param {number} lookupType - 1 to 8
     * @param {boolean} create - forces the creation of the lookup table if it doesn't exist, with no subtables.
     * @return {Object[]}
     */
    getLookupTables: function(script, language, feature, lookupType, create) {
        var featureTable = this.getFeatureTable(script, language, feature, create);
        var tables = [];
        if (featureTable) {
            var lookupTable;
            var lookupListIndexes = featureTable.lookupListIndexes;
            var allLookups = this.font.tables[this.tableName].lookups;
            // lookupListIndexes are in no particular order, so use naive search.
            for (var i = 0; i < lookupListIndexes.length; i++) {
                lookupTable = allLookups[lookupListIndexes[i]];
                if (lookupTable.lookupType === lookupType) {
                    tables.push(lookupTable);
                }
            }
            if (tables.length === 0 && create) {
                lookupTable = {
                    lookupType: lookupType,
                    lookupFlag: 0,
                    subtables: [],
                    markFilteringSet: undefined
                };
                var index = allLookups.length;
                allLookups.push(lookupTable);
                lookupListIndexes.push(index);
                return [lookupTable];
            }
        }
        return tables;
    },

    /**
     * Returns the list of glyph indexes of a coverage table.
     * Format 1: the list is stored raw
     * Format 2: compact list as range records.
     * @instance
     * @param  {Object} coverageTable
     * @return {Array}
     */
    expandCoverage: function(coverageTable) {
        if (coverageTable.format === 1) {
            return coverageTable.glyphs;
        } else {
            var glyphs = [];
            var ranges = coverageTable.ranges;
            for (var i = 0; i < ranges.length; i++) {
                var range = ranges[i];
                var start = range.start;
                var end = range.end;
                for (var j = start; j <= end; j++) {
                    glyphs.push(j);
                }
            }
            return glyphs;
        }
    }

};

// The Substitution object provides utility methods to manipulate
// the GSUB substitution table.

/**
 * @exports opentype.Substitution
 * @class
 * @extends opentype.Layout
 * @param {opentype.Font}
 * @constructor
 */
function Substitution(font) {
    Layout.call(this, font, 'gsub');
}

// Check if 2 arrays of primitives are equal.
function arraysEqual(ar1, ar2) {
    var n = ar1.length;
    if (n !== ar2.length) { return false; }
    for (var i = 0; i < n; i++) {
        if (ar1[i] !== ar2[i]) { return false; }
    }
    return true;
}

// Find the first subtable of a lookup table in a particular format.
function getSubstFormat(lookupTable, format, defaultSubtable) {
    var subtables = lookupTable.subtables;
    for (var i = 0; i < subtables.length; i++) {
        var subtable = subtables[i];
        if (subtable.substFormat === format) {
            return subtable;
        }
    }
    if (defaultSubtable) {
        subtables.push(defaultSubtable);
        return defaultSubtable;
    }
    return undefined;
}

Substitution.prototype = Layout.prototype;

/**
 * Create a default GSUB table.
 * @return {Object} gsub - The GSUB table.
 */
Substitution.prototype.createDefaultTable = function() {
    // Generate a default empty GSUB table with just a DFLT script and dflt lang sys.
    return {
        version: 1,
        scripts: [{
            tag: 'DFLT',
            script: {
                defaultLangSys: { reserved: 0, reqFeatureIndex: 0xffff, featureIndexes: [] },
                langSysRecords: []
            }
        }],
        features: [],
        lookups: []
    };
};

/**
 * List all single substitutions (lookup type 1) for a given script, language, and feature.
 * @param {string} [script='DFLT']
 * @param {string} [language='dflt']
 * @param {string} feature - 4-character feature name ('aalt', 'salt', 'ss01'...)
 * @return {Array} substitutions - The list of substitutions.
 */
Substitution.prototype.getSingle = function(feature, script, language) {
    var this$1 = this;

    var substitutions = [];
    var lookupTables = this.getLookupTables(script, language, feature, 1);
    for (var idx = 0; idx < lookupTables.length; idx++) {
        var subtables = lookupTables[idx].subtables;
        for (var i = 0; i < subtables.length; i++) {
            var subtable = subtables[i];
            var glyphs = this$1.expandCoverage(subtable.coverage);
            var j = (void 0);
            if (subtable.substFormat === 1) {
                var delta = subtable.deltaGlyphId;
                for (j = 0; j < glyphs.length; j++) {
                    var glyph = glyphs[j];
                    substitutions.push({ sub: glyph, by: glyph + delta });
                }
            } else {
                var substitute = subtable.substitute;
                for (j = 0; j < glyphs.length; j++) {
                    substitutions.push({ sub: glyphs[j], by: substitute[j] });
                }
            }
        }
    }
    return substitutions;
};

/**
 * List all alternates (lookup type 3) for a given script, language, and feature.
 * @param {string} [script='DFLT']
 * @param {string} [language='dflt']
 * @param {string} feature - 4-character feature name ('aalt', 'salt'...)
 * @return {Array} alternates - The list of alternates
 */
Substitution.prototype.getAlternates = function(feature, script, language) {
    var this$1 = this;

    var alternates = [];
    var lookupTables = this.getLookupTables(script, language, feature, 3);
    for (var idx = 0; idx < lookupTables.length; idx++) {
        var subtables = lookupTables[idx].subtables;
        for (var i = 0; i < subtables.length; i++) {
            var subtable = subtables[i];
            var glyphs = this$1.expandCoverage(subtable.coverage);
            var alternateSets = subtable.alternateSets;
            for (var j = 0; j < glyphs.length; j++) {
                alternates.push({ sub: glyphs[j], by: alternateSets[j] });
            }
        }
    }
    return alternates;
};

/**
 * List all ligatures (lookup type 4) for a given script, language, and feature.
 * The result is an array of ligature objects like { sub: [ids], by: id }
 * @param {string} feature - 4-letter feature name ('liga', 'rlig', 'dlig'...)
 * @param {string} [script='DFLT']
 * @param {string} [language='dflt']
 * @return {Array} ligatures - The list of ligatures.
 */
Substitution.prototype.getLigatures = function(feature, script, language) {
    var this$1 = this;

    var ligatures = [];
    var lookupTables = this.getLookupTables(script, language, feature, 4);
    for (var idx = 0; idx < lookupTables.length; idx++) {
        var subtables = lookupTables[idx].subtables;
        for (var i = 0; i < subtables.length; i++) {
            var subtable = subtables[i];
            var glyphs = this$1.expandCoverage(subtable.coverage);
            var ligatureSets = subtable.ligatureSets;
            for (var j = 0; j < glyphs.length; j++) {
                var startGlyph = glyphs[j];
                var ligSet = ligatureSets[j];
                for (var k = 0; k < ligSet.length; k++) {
                    var lig = ligSet[k];
                    ligatures.push({
                        sub: [startGlyph].concat(lig.components),
                        by: lig.ligGlyph
                    });
                }
            }
        }
    }
    return ligatures;
};

/**
 * Add or modify a single substitution (lookup type 1)
 * Format 2, more flexible, is always used.
 * @param {string} feature - 4-letter feature name ('liga', 'rlig', 'dlig'...)
 * @param {Object} substitution - { sub: id, delta: number } for format 1 or { sub: id, by: id } for format 2.
 * @param {string} [script='DFLT']
 * @param {string} [language='dflt']
 */
Substitution.prototype.addSingle = function(feature, substitution, script, language) {
    var lookupTable = this.getLookupTables(script, language, feature, 1, true)[0];
    var subtable = getSubstFormat(lookupTable, 2, {                // lookup type 1 subtable, format 2, coverage format 1
        substFormat: 2,
        coverage: {format: 1, glyphs: []},
        substitute: []
    });
    check.assert(subtable.coverage.format === 1, 'Ligature: unable to modify coverage table format ' + subtable.coverage.format);
    var coverageGlyph = substitution.sub;
    var pos = this.binSearch(subtable.coverage.glyphs, coverageGlyph);
    if (pos < 0) {
        pos = -1 - pos;
        subtable.coverage.glyphs.splice(pos, 0, coverageGlyph);
        subtable.substitute.splice(pos, 0, 0);
    }
    subtable.substitute[pos] = substitution.by;
};

/**
 * Add or modify an alternate substitution (lookup type 1)
 * @param {string} feature - 4-letter feature name ('liga', 'rlig', 'dlig'...)
 * @param {Object} substitution - { sub: id, by: [ids] }
 * @param {string} [script='DFLT']
 * @param {string} [language='dflt']
 */
Substitution.prototype.addAlternate = function(feature, substitution, script, language) {
    var lookupTable = this.getLookupTables(script, language, feature, 3, true)[0];
    var subtable = getSubstFormat(lookupTable, 1, {                // lookup type 3 subtable, format 1, coverage format 1
        substFormat: 1,
        coverage: {format: 1, glyphs: []},
        alternateSets: []
    });
    check.assert(subtable.coverage.format === 1, 'Ligature: unable to modify coverage table format ' + subtable.coverage.format);
    var coverageGlyph = substitution.sub;
    var pos = this.binSearch(subtable.coverage.glyphs, coverageGlyph);
    if (pos < 0) {
        pos = -1 - pos;
        subtable.coverage.glyphs.splice(pos, 0, coverageGlyph);
        subtable.alternateSets.splice(pos, 0, 0);
    }
    subtable.alternateSets[pos] = substitution.by;
};

/**
 * Add a ligature (lookup type 4)
 * Ligatures with more components must be stored ahead of those with fewer components in order to be found
 * @param {string} feature - 4-letter feature name ('liga', 'rlig', 'dlig'...)
 * @param {Object} ligature - { sub: [ids], by: id }
 * @param {string} [script='DFLT']
 * @param {string} [language='dflt']
 */
Substitution.prototype.addLigature = function(feature, ligature, script, language) {
    var lookupTable = this.getLookupTables(script, language, feature, 4, true)[0];
    var subtable = lookupTable.subtables[0];
    if (!subtable) {
        subtable = {                // lookup type 4 subtable, format 1, coverage format 1
            substFormat: 1,
            coverage: { format: 1, glyphs: [] },
            ligatureSets: []
        };
        lookupTable.subtables[0] = subtable;
    }
    check.assert(subtable.coverage.format === 1, 'Ligature: unable to modify coverage table format ' + subtable.coverage.format);
    var coverageGlyph = ligature.sub[0];
    var ligComponents = ligature.sub.slice(1);
    var ligatureTable = {
        ligGlyph: ligature.by,
        components: ligComponents
    };
    var pos = this.binSearch(subtable.coverage.glyphs, coverageGlyph);
    if (pos >= 0) {
        // ligatureSet already exists
        var ligatureSet = subtable.ligatureSets[pos];
        for (var i = 0; i < ligatureSet.length; i++) {
            // If ligature already exists, return.
            if (arraysEqual(ligatureSet[i].components, ligComponents)) {
                return;
            }
        }
        // ligature does not exist: add it.
        ligatureSet.push(ligatureTable);
    } else {
        // Create a new ligatureSet and add coverage for the first glyph.
        pos = -1 - pos;
        subtable.coverage.glyphs.splice(pos, 0, coverageGlyph);
        subtable.ligatureSets.splice(pos, 0, [ligatureTable]);
    }
};

/**
 * List all feature data for a given script and language.
 * @param {string} feature - 4-letter feature name
 * @param {string} [script='DFLT']
 * @param {string} [language='dflt']
 * @return {Array} substitutions - The list of substitutions.
 */
Substitution.prototype.getFeature = function(feature, script, language) {
    if (/ss\d\d/.test(feature)) {               // ss01 - ss20
        return this.getSingle(feature, script, language);
    }
    switch (feature) {
        case 'aalt':
        case 'salt':
            return this.getSingle(feature, script, language)
                    .concat(this.getAlternates(feature, script, language));
        case 'dlig':
        case 'liga':
        case 'rlig': return this.getLigatures(feature, script, language);
    }
    return undefined;
};

/**
 * Add a substitution to a feature for a given script and language.
 * @param {string} feature - 4-letter feature name
 * @param {Object} sub - the substitution to add (an object like { sub: id or [ids], by: id or [ids] })
 * @param {string} [script='DFLT']
 * @param {string} [language='dflt']
 */
Substitution.prototype.add = function(feature, sub, script, language) {
    if (/ss\d\d/.test(feature)) {               // ss01 - ss20
        return this.addSingle(feature, sub, script, language);
    }
    switch (feature) {
        case 'aalt':
        case 'salt':
            if (typeof sub.by === 'number') {
                return this.addSingle(feature, sub, script, language);
            }
            return this.addAlternate(feature, sub, script, language);
        case 'dlig':
        case 'liga':
        case 'rlig':
            return this.addLigature(feature, sub, script, language);
    }
    return undefined;
};

function isBrowser() {
    return typeof window !== 'undefined';
}

function nodeBufferToArrayBuffer(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }

    return ab;
}

function arrayBufferToNodeBuffer(ab) {
    var buffer = new Buffer(ab.byteLength);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
    }

    return buffer;
}

function checkArgument(expression, message) {
    if (!expression) {
        throw message;
    }
}

/* A TrueType font hinting interpreter.
*
* (c) 2017 Axel Kittenberger
*
* This interpreter has been implemented according to this documentation:
* https://developer.apple.com/fonts/TrueType-Reference-Manual/RM05/Chap5.html
*
* According to the documentation F24DOT6 values are used for pixels.
* That means calculation is 1/64 pixel accurate and uses integer operations.
* However, Javascript has floating point operations by default and only
* those are available. One could make a case to simulate the 1/64 accuracy
* exactly by truncating after every division operation
* (for example with << 0) to get pixel exactly results as other TrueType
* implementations. It may make sense since some fonts are pixel optimized
* by hand using DELTAP instructions. The current implementation doesn't
* and rather uses full floating point precision.
*
* xScale, yScale and rotation is currently ignored.
*
* A few non-trivial instructions are missing as I didn't encounter yet
* a font that used them to test a possible implementation.
*
* Some fonts seem to use undocumented features regarding the twilight zone.
* Only some of them are implemented as they were encountered.
*
* The exports.DEBUG statements are removed on the minified distribution file.
*/
var instructionTable;
var exec;
var execGlyph;
var execComponent;

/*
* Creates a hinting object.
*
* There ought to be exactly one
* for each truetype font that is used for hinting.
*/
function Hinting(font) {
    // the font this hinting object is for
    this.font = font;

    // cached states
    this._fpgmState  =
    this._prepState  =
        undefined;

    // errorState
    // 0 ... all okay
    // 1 ... had an error in a glyf,
    //       continue working but stop spamming
    //       the console
    // 2 ... error at prep, stop hinting at this ppem
    // 3 ... error at fpeg, stop hinting for this font at all
    this._errorState = 0;
}

/*
* Not rounding.
*/
function roundOff(v) {
    return v;
}

/*
* Rounding to grid.
*/
function roundToGrid(v) {
    //Rounding in TT is supposed to "symmetrical around zero"
    return Math.sign(v) * Math.round(Math.abs(v));
}

/*
* Rounding to double grid.
*/
function roundToDoubleGrid(v) {
    return Math.sign(v) * Math.round(Math.abs(v * 2)) / 2;
}

/*
* Rounding to half grid.
*/
function roundToHalfGrid(v) {
    return Math.sign(v) * (Math.round(Math.abs(v) + 0.5) - 0.5);
}

/*
* Rounding to up to grid.
*/
function roundUpToGrid(v) {
    return Math.sign(v) * Math.ceil(Math.abs(v));
}

/*
* Rounding to down to grid.
*/
function roundDownToGrid(v) {
    return Math.sign(v) * Math.floor(Math.abs(v));
}

/*
* Super rounding.
*/
var roundSuper = function (v) {
    var period = this.srPeriod;
    var phase = this.srPhase;
    var threshold = this.srThreshold;
    var sign = 1;

    if (v < 0) {
        v = -v;
        sign = -1;
    }

    v += threshold - phase;

    v = Math.trunc(v / period) * period;

    v += phase;

    // according to http://xgridfit.sourceforge.net/round.html
    if (sign > 0 && v < 0) { return phase; }
    if (sign < 0 && v > 0) { return -phase; }

    return v * sign;
};

/*
* Unit vector of x-axis.
*/
var xUnitVector = {
    x: 1,

    y: 0,

    axis: 'x',

    // Gets the projected distance between two points.
    // o1/o2 ... if true, respective original position is used.
    distance: function (p1, p2, o1, o2) {
        return (o1 ? p1.xo : p1.x) - (o2 ? p2.xo : p2.x);
    },

    // Moves point p so the moved position has the same relative
    // position to the moved positions of rp1 and rp2 than the
    // original positions had.
    //
    // See APPENDIX on INTERPOLATE at the bottom of this file.
    interpolate: function (p, rp1, rp2, pv) {
        var do1;
        var do2;
        var doa1;
        var doa2;
        var dm1;
        var dm2;
        var dt;

        if (!pv || pv === this) {
            do1 = p.xo - rp1.xo;
            do2 = p.xo - rp2.xo;
            dm1 = rp1.x - rp1.xo;
            dm2 = rp2.x - rp2.xo;
            doa1 = Math.abs(do1);
            doa2 = Math.abs(do2);
            dt = doa1 + doa2;

            if (dt === 0) {
                p.x = p.xo + (dm1 + dm2) / 2;
                return;
            }

            p.x = p.xo + (dm1 * doa2 + dm2 * doa1) / dt;
            return;
        }

        do1 = pv.distance(p, rp1, true, true);
        do2 = pv.distance(p, rp2, true, true);
        dm1 = pv.distance(rp1, rp1, false, true);
        dm2 = pv.distance(rp2, rp2, false, true);
        doa1 = Math.abs(do1);
        doa2 = Math.abs(do2);
        dt = doa1 + doa2;

        if (dt === 0) {
            xUnitVector.setRelative(p, p, (dm1 + dm2) / 2, pv, true);
            return;
        }

        xUnitVector.setRelative(p, p, (dm1 * doa2 + dm2 * doa1) / dt, pv, true);
    },

    // Slope of line normal to this
    normalSlope: Number.NEGATIVE_INFINITY,

    // Sets the point 'p' relative to point 'rp'
    // by the distance 'd'.
    //
    // See APPENDIX on SETRELATIVE at the bottom of this file.
    //
    // p   ... point to set
    // rp  ... reference point
    // d   ... distance on projection vector
    // pv  ... projection vector (undefined = this)
    // org ... if true, uses the original position of rp as reference.
    setRelative: function (p, rp, d, pv, org) {
        if (!pv || pv === this) {
            p.x = (org ? rp.xo : rp.x) + d;
            return;
        }

        var rpx = org ? rp.xo : rp.x;
        var rpy = org ? rp.yo : rp.y;
        var rpdx = rpx + d * pv.x;
        var rpdy = rpy + d * pv.y;

        p.x = rpdx + (p.y - rpdy) / pv.normalSlope;
    },

    // Slope of vector line.
    slope: 0,

    // Touches the point p.
    touch: function (p) {
        p.xTouched = true;
    },

    // Tests if a point p is touched.
    touched: function (p) {
        return p.xTouched;
    },

    // Untouches the point p.
    untouch: function (p) {
        p.xTouched = false;
    }
};

/*
* Unit vector of y-axis.
*/
var yUnitVector = {
    x: 0,

    y: 1,

    axis: 'y',

    // Gets the projected distance between two points.
    // o1/o2 ... if true, respective original position is used.
    distance: function (p1, p2, o1, o2) {
        return (o1 ? p1.yo : p1.y) - (o2 ? p2.yo : p2.y);
    },

    // Moves point p so the moved position has the same relative
    // position to the moved positions of rp1 and rp2 than the
    // original positions had.
    //
    // See APPENDIX on INTERPOLATE at the bottom of this file.
    interpolate: function (p, rp1, rp2, pv) {
        var do1;
        var do2;
        var doa1;
        var doa2;
        var dm1;
        var dm2;
        var dt;

        if (!pv || pv === this) {
            do1 = p.yo - rp1.yo;
            do2 = p.yo - rp2.yo;
            dm1 = rp1.y - rp1.yo;
            dm2 = rp2.y - rp2.yo;
            doa1 = Math.abs(do1);
            doa2 = Math.abs(do2);
            dt = doa1 + doa2;

            if (dt === 0) {
                p.y = p.yo + (dm1 + dm2) / 2;
                return;
            }

            p.y = p.yo + (dm1 * doa2 + dm2 * doa1) / dt;
            return;
        }

        do1 = pv.distance(p, rp1, true, true);
        do2 = pv.distance(p, rp2, true, true);
        dm1 = pv.distance(rp1, rp1, false, true);
        dm2 = pv.distance(rp2, rp2, false, true);
        doa1 = Math.abs(do1);
        doa2 = Math.abs(do2);
        dt = doa1 + doa2;

        if (dt === 0) {
            yUnitVector.setRelative(p, p, (dm1 + dm2) / 2, pv, true);
            return;
        }

        yUnitVector.setRelative(p, p, (dm1 * doa2 + dm2 * doa1) / dt, pv, true);
    },

    // Slope of line normal to this.
    normalSlope: 0,

    // Sets the point 'p' relative to point 'rp'
    // by the distance 'd'
    //
    // See APPENDIX on SETRELATIVE at the bottom of this file.
    //
    // p   ... point to set
    // rp  ... reference point
    // d   ... distance on projection vector
    // pv  ... projection vector (undefined = this)
    // org ... if true, uses the original position of rp as reference.
    setRelative: function (p, rp, d, pv, org) {
        if (!pv || pv === this) {
            p.y = (org ? rp.yo : rp.y) + d;
            return;
        }

        var rpx = org ? rp.xo : rp.x;
        var rpy = org ? rp.yo : rp.y;
        var rpdx = rpx + d * pv.x;
        var rpdy = rpy + d * pv.y;

        p.y = rpdy + pv.normalSlope * (p.x - rpdx);
    },

    // Slope of vector line.
    slope: Number.POSITIVE_INFINITY,

    // Touches the point p.
    touch: function (p) {
        p.yTouched = true;
    },

    // Tests if a point p is touched.
    touched: function (p) {
        return p.yTouched;
    },

    // Untouches the point p.
    untouch: function (p) {
        p.yTouched = false;
    }
};

Object.freeze(xUnitVector);
Object.freeze(yUnitVector);

/*
* Creates a unit vector that is not x- or y-axis.
*/
function UnitVector(x, y) {
    this.x = x;
    this.y = y;
    this.axis = undefined;
    this.slope = y / x;
    this.normalSlope = -x / y;
    Object.freeze(this);
}

/*
* Gets the projected distance between two points.
* o1/o2 ... if true, respective original position is used.
*/
UnitVector.prototype.distance = function(p1, p2, o1, o2) {
    return (
        this.x * xUnitVector.distance(p1, p2, o1, o2) +
        this.y * yUnitVector.distance(p1, p2, o1, o2)
    );
};

/*
* Moves point p so the moved position has the same relative
* position to the moved positions of rp1 and rp2 than the
* original positions had.
*
* See APPENDIX on INTERPOLATE at the bottom of this file.
*/
UnitVector.prototype.interpolate = function(p, rp1, rp2, pv) {
    var dm1;
    var dm2;
    var do1;
    var do2;
    var doa1;
    var doa2;
    var dt;

    do1 = pv.distance(p, rp1, true, true);
    do2 = pv.distance(p, rp2, true, true);
    dm1 = pv.distance(rp1, rp1, false, true);
    dm2 = pv.distance(rp2, rp2, false, true);
    doa1 = Math.abs(do1);
    doa2 = Math.abs(do2);
    dt = doa1 + doa2;

    if (dt === 0) {
        this.setRelative(p, p, (dm1 + dm2) / 2, pv, true);
        return;
    }

    this.setRelative(p, p, (dm1 * doa2 + dm2 * doa1) / dt, pv, true);
};

/*
* Sets the point 'p' relative to point 'rp'
* by the distance 'd'
*
* See APPENDIX on SETRELATIVE at the bottom of this file.
*
* p   ...  point to set
* rp  ... reference point
* d   ... distance on projection vector
* pv  ... projection vector (undefined = this)
* org ... if true, uses the original position of rp as reference.
*/
UnitVector.prototype.setRelative = function(p, rp, d, pv, org) {
    pv = pv || this;

    var rpx = org ? rp.xo : rp.x;
    var rpy = org ? rp.yo : rp.y;
    var rpdx = rpx + d * pv.x;
    var rpdy = rpy + d * pv.y;

    var pvns = pv.normalSlope;
    var fvs = this.slope;

    var px = p.x;
    var py = p.y;

    p.x = (fvs * px - pvns * rpdx + rpdy - py) / (fvs - pvns);
    p.y = fvs * (p.x - px) + py;
};

/*
* Touches the point p.
*/
UnitVector.prototype.touch = function(p) {
    p.xTouched = true;
    p.yTouched = true;
};

/*
* Returns a unit vector with x/y coordinates.
*/
function getUnitVector(x, y) {
    var d = Math.sqrt(x * x + y * y);

    x /= d;
    y /= d;

    if (x === 1 && y === 0) { return xUnitVector; }
    else if (x === 0 && y === 1) { return yUnitVector; }
    else { return new UnitVector(x, y); }
}

/*
* Creates a point in the hinting engine.
*/
function HPoint(
    x,
    y,
    lastPointOfContour,
    onCurve
) {
    this.x = this.xo = Math.round(x * 64) / 64; // hinted x value and original x-value
    this.y = this.yo = Math.round(y * 64) / 64; // hinted y value and original y-value

    this.lastPointOfContour = lastPointOfContour;
    this.onCurve = onCurve;
    this.prevPointOnContour = undefined;
    this.nextPointOnContour = undefined;
    this.xTouched = false;
    this.yTouched = false;

    Object.preventExtensions(this);
}

/*
* Returns the next touched point on the contour.
*
* v  ... unit vector to test touch axis.
*/
HPoint.prototype.nextTouched = function(v) {
    var p = this.nextPointOnContour;

    while (!v.touched(p) && p !== this) { p = p.nextPointOnContour; }

    return p;
};

/*
* Returns the previous touched point on the contour
*
* v  ... unit vector to test touch axis.
*/
HPoint.prototype.prevTouched = function(v) {
    var p = this.prevPointOnContour;

    while (!v.touched(p) && p !== this) { p = p.prevPointOnContour; }

    return p;
};

/*
* The zero point.
*/
var HPZero = Object.freeze(new HPoint(0, 0));

/*
* The default state of the interpreter.
*
* Note: Freezing the defaultState and then deriving from it
* makes the V8 Javascript engine going awkward,
* so this is avoided, albeit the defaultState shouldn't
* ever change.
*/
var defaultState = {
    cvCutIn: 17 / 16,    // control value cut in
    deltaBase: 9,
    deltaShift: 0.125,
    loop: 1,             // loops some instructions
    minDis: 1,           // minimum distance
    autoFlip: true
};

/*
* The current state of the interpreter.
*
* env  ... 'fpgm' or 'prep' or 'glyf'
* prog ... the program
*/
function State(env, prog) {
    this.env = env;
    this.stack = [];
    this.prog = prog;

    switch (env) {
        case 'glyf' :
            this.zp0 = this.zp1 = this.zp2 = 1;
            this.rp0 = this.rp1 = this.rp2 = 0;
            /* fall through */
        case 'prep' :
            this.fv = this.pv = this.dpv = xUnitVector;
            this.round = roundToGrid;
    }
}

/*
* Executes a glyph program.
*
* This does the hinting for each glyph.
*
* Returns an array of moved points.
*
* glyph: the glyph to hint
* ppem: the size the glyph is rendered for
*/
Hinting.prototype.exec = function(glyph, ppem) {
    if (typeof ppem !== 'number') {
        throw new Error('Point size is not a number!');
    }

    // Received a fatal error, don't do any hinting anymore.
    if (this._errorState > 2) { return; }

    var font = this.font;
    var prepState = this._prepState;

    if (!prepState || prepState.ppem !== ppem) {
        var fpgmState = this._fpgmState;

        if (!fpgmState) {
            // Executes the fpgm state.
            // This is used by fonts to define functions.
            State.prototype = defaultState;

            fpgmState =
            this._fpgmState =
                new State('fpgm', font.tables.fpgm);

            fpgmState.funcs = [ ];
            fpgmState.font = font;

            if (exports.DEBUG) {
                console.log('---EXEC FPGM---');
                fpgmState.step = -1;
            }

            try {
                exec(fpgmState);
            } catch (e) {
                console.log('Hinting error in FPGM:' + e);
                this._errorState = 3;
                return;
            }
        }

        // Executes the prep program for this ppem setting.
        // This is used by fonts to set cvt values
        // depending on to be rendered font size.

        State.prototype = fpgmState;
        prepState =
        this._prepState =
            new State('prep', font.tables.prep);

        prepState.ppem = ppem;

        // Creates a copy of the cvt table
        // and scales it to the current ppem setting.
        var oCvt = font.tables.cvt;
        if (oCvt) {
            var cvt = prepState.cvt = new Array(oCvt.length);
            var scale = ppem / font.unitsPerEm;
            for (var c = 0; c < oCvt.length; c++) {
                cvt[c] = oCvt[c] * scale;
            }
        } else {
            prepState.cvt = [];
        }

        if (exports.DEBUG) {
            console.log('---EXEC PREP---');
            prepState.step = -1;
        }

        try {
            exec(prepState);
        } catch (e) {
            if (this._errorState < 2) {
                console.log('Hinting error in PREP:' + e);
            }
            this._errorState = 2;
        }
    }

    if (this._errorState > 1) { return; }

    try {
        return execGlyph(glyph, prepState);
    } catch (e) {
        if (this._errorState < 1) {
            console.log('Hinting error:' + e);
            console.log('Note: further hinting errors are silenced');
        }
        this._errorState = 1;
        return undefined;
    }
};

/*
* Executes the hinting program for a glyph.
*/
execGlyph = function(glyph, prepState) {
    // original point positions
    var xScale = prepState.ppem / prepState.font.unitsPerEm;
    var yScale = xScale;
    var components = glyph.components;
    var contours;
    var gZone;
    var state;

    State.prototype = prepState;
    if (!components) {
        state = new State('glyf', glyph.instructions);
        if (exports.DEBUG) {
            console.log('---EXEC GLYPH---');
            state.step = -1;
        }
        execComponent(glyph, state, xScale, yScale);
        gZone = state.gZone;
    } else {
        var font = prepState.font;
        gZone = [];
        contours = [];
        for (var i = 0; i < components.length; i++) {
            var c = components[i];
            var cg = font.glyphs.get(c.glyphIndex);

            state = new State('glyf', cg.instructions);

            if (exports.DEBUG) {
                console.log('---EXEC COMP ' + i + '---');
                state.step = -1;
            }

            execComponent(cg, state, xScale, yScale);
            // appends the computed points to the result array
            // post processes the component points
            var dx = Math.round(c.dx * xScale);
            var dy = Math.round(c.dy * yScale);
            var gz = state.gZone;
            var cc = state.contours;
            for (var pi = 0; pi < gz.length; pi++) {
                var p = gz[pi];
                p.xTouched = p.yTouched = false;
                p.xo = p.x = p.x + dx;
                p.yo = p.y = p.y + dy;
            }

            var gLen = gZone.length;
            gZone.push.apply(gZone, gz);
            for (var j = 0; j < cc.length; j++) {
                contours.push(cc[j] + gLen);
            }
        }

        if (glyph.instructions && !state.inhibitGridFit) {
            // the composite has instructions on its own
            state = new State('glyf', glyph.instructions);

            state.gZone = state.z0 = state.z1 = state.z2 = gZone;

            state.contours = contours;

            // note: HPZero cannot be used here, since
            //       the point might be modified
            gZone.push(
                new HPoint(0, 0),
                new HPoint(Math.round(glyph.advanceWidth * xScale), 0)
            );

            if (exports.DEBUG) {
                console.log('---EXEC COMPOSITE---');
                state.step = -1;
            }

            exec(state);

            gZone.length -= 2;
        }
    }

    return gZone;
};

/*
* Executes the hinting program for a component of a multi-component glyph
* or of the glyph itself by a non-component glyph.
*/
execComponent = function(glyph, state, xScale, yScale)
{
    var points = glyph.points || [];
    var pLen = points.length;
    var gZone = state.gZone = state.z0 = state.z1 = state.z2 = [];
    var contours = state.contours = [];

    // Scales the original points and
    // makes copies for the hinted points.
    var cp; // current point
    for (var i = 0; i < pLen; i++) {
        cp = points[i];

        gZone[i] = new HPoint(
            cp.x * xScale,
            cp.y * yScale,
            cp.lastPointOfContour,
            cp.onCurve
        );
    }

    // Chain links the contours.
    var sp; // start point
    var np; // next point

    for (var i$1 = 0; i$1 < pLen; i$1++) {
        cp = gZone[i$1];

        if (!sp) {
            sp = cp;
            contours.push(i$1);
        }

        if (cp.lastPointOfContour) {
            cp.nextPointOnContour = sp;
            sp.prevPointOnContour = cp;
            sp = undefined;
        } else {
            np = gZone[i$1 + 1];
            cp.nextPointOnContour = np;
            np.prevPointOnContour = cp;
        }
    }

    if (state.inhibitGridFit) { return; }

    gZone.push(
        new HPoint(0, 0),
        new HPoint(Math.round(glyph.advanceWidth * xScale), 0)
    );

    exec(state);

    // Removes the extra points.
    gZone.length -= 2;

    if (exports.DEBUG) {
        console.log('FINISHED GLYPH', state.stack);
        for (var i$2 = 0; i$2 < pLen; i$2++) {
            console.log(i$2, gZone[i$2].x, gZone[i$2].y);
        }
    }
};

/*
* Executes the program loaded in state.
*/
exec = function(state) {
    var prog = state.prog;

    if (!prog) { return; }

    var pLen = prog.length;
    var ins;

    for (state.ip = 0; state.ip < pLen; state.ip++) {
        if (exports.DEBUG) { state.step++; }
        ins = instructionTable[prog[state.ip]];

        if (!ins) {
            throw new Error(
                'unknown instruction: 0x' +
                Number(prog[state.ip]).toString(16)
            );
        }

        ins(state);

        // very extensive debugging for each step
        /*
        if (exports.DEBUG) {
            var da;
            if (state.gZone) {
                da = [];
                for (let i = 0; i < state.gZone.length; i++)
                {
                    da.push(i + ' ' +
                        state.gZone[i].x * 64 + ' ' +
                        state.gZone[i].y * 64 + ' ' +
                        (state.gZone[i].xTouched ? 'x' : '') +
                        (state.gZone[i].yTouched ? 'y' : '')
                    );
                }
                console.log('GZ', da);
            }

            if (state.tZone) {
                da = [];
                for (let i = 0; i < state.tZone.length; i++) {
                    da.push(i + ' ' +
                        state.tZone[i].x * 64 + ' ' +
                        state.tZone[i].y * 64 + ' ' +
                        (state.tZone[i].xTouched ? 'x' : '') +
                        (state.tZone[i].yTouched ? 'y' : '')
                    );
                }
                console.log('TZ', da);
            }

            if (state.stack.length > 10) {
                console.log(
                    state.stack.length,
                    '...', state.stack.slice(state.stack.length - 10)
                );
            } else {
                console.log(state.stack.length, state.stack);
            }
        }
        */
    }
};

/*
* Initializes the twilight zone.
*
* This is only done if a SZPx instruction
* refers to the twilight zone.
*/
function initTZone(state)
{
    var tZone = state.tZone = new Array(state.gZone.length);

    // no idea if this is actually correct...
    for (var i = 0; i < tZone.length; i++)
    {
        tZone[i] = new HPoint(0, 0);
    }
}

/*
* Skips the instruction pointer ahead over an IF/ELSE block.
* handleElse .. if true breaks on matching ELSE
*/
function skip(state, handleElse)
{
    var prog = state.prog;
    var ip = state.ip;
    var nesting = 1;
    var ins;

    do {
        ins = prog[++ip];
        if (ins === 0x58) // IF
            { nesting++; }
        else if (ins === 0x59) // EIF
            { nesting--; }
        else if (ins === 0x40) // NPUSHB
            { ip += prog[ip + 1] + 1; }
        else if (ins === 0x41) // NPUSHW
            { ip += 2 * prog[ip + 1] + 1; }
        else if (ins >= 0xB0 && ins <= 0xB7) // PUSHB
            { ip += ins - 0xB0 + 1; }
        else if (ins >= 0xB8 && ins <= 0xBF) // PUSHW
            { ip += (ins - 0xB8 + 1) * 2; }
        else if (handleElse && nesting === 1 && ins === 0x1B) // ELSE
            { break; }
    } while (nesting > 0);

    state.ip = ip;
}

/*----------------------------------------------------------*
*          And then a lot of instructions...                *
*----------------------------------------------------------*/

// SVTCA[a] Set freedom and projection Vectors To Coordinate Axis
// 0x00-0x01
function SVTCA(v, state) {
    if (exports.DEBUG) { console.log(state.step, 'SVTCA[' + v.axis + ']'); }

    state.fv = state.pv = state.dpv = v;
}

// SPVTCA[a] Set Projection Vector to Coordinate Axis
// 0x02-0x03
function SPVTCA(v, state) {
    if (exports.DEBUG) { console.log(state.step, 'SPVTCA[' + v.axis + ']'); }

    state.pv = state.dpv = v;
}

// SFVTCA[a] Set Freedom Vector to Coordinate Axis
// 0x04-0x05
function SFVTCA(v, state) {
    if (exports.DEBUG) { console.log(state.step, 'SFVTCA[' + v.axis + ']'); }

    state.fv = v;
}

// SPVTL[a] Set Projection Vector To Line
// 0x06-0x07
function SPVTL(a, state) {
    var stack = state.stack;
    var p2i = stack.pop();
    var p1i = stack.pop();
    var p2 = state.z2[p2i];
    var p1 = state.z1[p1i];

    if (exports.DEBUG) { console.log('SPVTL[' + a + ']', p2i, p1i); }

    var dx;
    var dy;

    if (!a) {
        dx = p1.x - p2.x;
        dy = p1.y - p2.y;
    } else {
        dx = p2.y - p1.y;
        dy = p1.x - p2.x;
    }

    state.pv = state.dpv = getUnitVector(dx, dy);
}

// SFVTL[a] Set Freedom Vector To Line
// 0x08-0x09
function SFVTL(a, state) {
    var stack = state.stack;
    var p2i = stack.pop();
    var p1i = stack.pop();
    var p2 = state.z2[p2i];
    var p1 = state.z1[p1i];

    if (exports.DEBUG) { console.log('SFVTL[' + a + ']', p2i, p1i); }

    var dx;
    var dy;

    if (!a) {
        dx = p1.x - p2.x;
        dy = p1.y - p2.y;
    } else {
        dx = p2.y - p1.y;
        dy = p1.x - p2.x;
    }

    state.fv = getUnitVector(dx, dy);
}

// SPVFS[] Set Projection Vector From Stack
// 0x0A
function SPVFS(state) {
    var stack = state.stack;
    var y = stack.pop();
    var x = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SPVFS[]', y, x); }

    state.pv = state.dpv = getUnitVector(x, y);
}

// SFVFS[] Set Freedom Vector From Stack
// 0x0B
function SFVFS(state) {
    var stack = state.stack;
    var y = stack.pop();
    var x = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SPVFS[]', y, x); }

    state.fv = getUnitVector(x, y);
}

// GPV[] Get Projection Vector
// 0x0C
function GPV(state) {
    var stack = state.stack;
    var pv = state.pv;

    if (exports.DEBUG) { console.log(state.step, 'GPV[]'); }

    stack.push(pv.x * 0x4000);
    stack.push(pv.y * 0x4000);
}

// GFV[] Get Freedom Vector
// 0x0C
function GFV(state) {
    var stack = state.stack;
    var fv = state.fv;

    if (exports.DEBUG) { console.log(state.step, 'GFV[]'); }

    stack.push(fv.x * 0x4000);
    stack.push(fv.y * 0x4000);
}

// SFVTPV[] Set Freedom Vector To Projection Vector
// 0x0E
function SFVTPV(state) {
    state.fv = state.pv;

    if (exports.DEBUG) { console.log(state.step, 'SFVTPV[]'); }
}

// ISECT[] moves point p to the InterSECTion of two lines
// 0x0F
function ISECT(state)
{
    var stack = state.stack;
    var pa0i = stack.pop();
    var pa1i = stack.pop();
    var pb0i = stack.pop();
    var pb1i = stack.pop();
    var pi = stack.pop();
    var z0 = state.z0;
    var z1 = state.z1;
    var pa0 = z0[pa0i];
    var pa1 = z0[pa1i];
    var pb0 = z1[pb0i];
    var pb1 = z1[pb1i];
    var p = state.z2[pi];

    if (exports.DEBUG) { console.log('ISECT[], ', pa0i, pa1i, pb0i, pb1i, pi); }

    // math from
    // en.wikipedia.org/wiki/Line%E2%80%93line_intersection#Given_two_points_on_each_line

    var x1 = pa0.x;
    var y1 = pa0.y;
    var x2 = pa1.x;
    var y2 = pa1.y;
    var x3 = pb0.x;
    var y3 = pb0.y;
    var x4 = pb1.x;
    var y4 = pb1.y;

    var div = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    var f1 = x1 * y2 - y1 * x2;
    var f2 = x3 * y4 - y3 * x4;

    p.x = (f1 * (x3 - x4) - f2 * (x1 - x2)) / div;
    p.y = (f1 * (y3 - y4) - f2 * (y1 - y2)) / div;
}

// SRP0[] Set Reference Point 0
// 0x10
function SRP0(state) {
    state.rp0 = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SRP0[]', state.rp0); }
}

// SRP1[] Set Reference Point 1
// 0x11
function SRP1(state) {
    state.rp1 = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SRP1[]', state.rp1); }
}

// SRP1[] Set Reference Point 2
// 0x12
function SRP2(state) {
    state.rp2 = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SRP2[]', state.rp2); }
}

// SZP0[] Set Zone Pointer 0
// 0x13
function SZP0(state) {
    var n = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SZP0[]', n); }

    state.zp0 = n;

    switch (n) {
        case 0:
            if (!state.tZone) { initTZone(state); }
            state.z0 = state.tZone;
            break;
        case 1 :
            state.z0 = state.gZone;
            break;
        default :
            throw new Error('Invalid zone pointer');
    }
}

// SZP1[] Set Zone Pointer 1
// 0x14
function SZP1(state) {
    var n = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SZP1[]', n); }

    state.zp1 = n;

    switch (n) {
        case 0:
            if (!state.tZone) { initTZone(state); }
            state.z1 = state.tZone;
            break;
        case 1 :
            state.z1 = state.gZone;
            break;
        default :
            throw new Error('Invalid zone pointer');
    }
}

// SZP2[] Set Zone Pointer 2
// 0x15
function SZP2(state) {
    var n = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SZP2[]', n); }

    state.zp2 = n;

    switch (n) {
        case 0:
            if (!state.tZone) { initTZone(state); }
            state.z2 = state.tZone;
            break;
        case 1 :
            state.z2 = state.gZone;
            break;
        default :
            throw new Error('Invalid zone pointer');
    }
}

// SZPS[] Set Zone PointerS
// 0x16
function SZPS(state) {
    var n = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SZPS[]', n); }

    state.zp0 = state.zp1 = state.zp2 = n;

    switch (n) {
        case 0:
            if (!state.tZone) { initTZone(state); }
            state.z0 = state.z1 = state.z2 = state.tZone;
            break;
        case 1 :
            state.z0 = state.z1 = state.z2 = state.gZone;
            break;
        default :
            throw new Error('Invalid zone pointer');
    }
}

// SLOOP[] Set LOOP variable
// 0x17
function SLOOP(state) {
    state.loop = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SLOOP[]', state.loop); }
}

// RTG[] Round To Grid
// 0x18
function RTG(state) {
    if (exports.DEBUG) { console.log(state.step, 'RTG[]'); }

    state.round = roundToGrid;
}

// RTHG[] Round To Half Grid
// 0x19
function RTHG(state) {
    if (exports.DEBUG) { console.log(state.step, 'RTHG[]'); }

    state.round = roundToHalfGrid;
}

// SMD[] Set Minimum Distance
// 0x1A
function SMD(state) {
    var d = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SMD[]', d); }

    state.minDis = d / 0x40;
}

// ELSE[] ELSE clause
// 0x1B
function ELSE(state) {
    // This instruction has been reached by executing a then branch
    // so it just skips ahead until matching EIF.
    //
    // In case the IF was negative the IF[] instruction already
    // skipped forward over the ELSE[]

    if (exports.DEBUG) { console.log(state.step, 'ELSE[]'); }

    skip(state, false);
}

// JMPR[] JuMP Relative
// 0x1C
function JMPR(state) {
    var o = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'JMPR[]', o); }

    // A jump by 1 would do nothing.
    state.ip += o - 1;
}

// SCVTCI[] Set Control Value Table Cut-In
// 0x1D
function SCVTCI(state) {
    var n = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SCVTCI[]', n); }

    state.cvCutIn = n / 0x40;
}

// DUP[] DUPlicate top stack element
// 0x20
function DUP(state) {
    var stack = state.stack;

    if (exports.DEBUG) { console.log(state.step, 'DUP[]'); }

    stack.push(stack[stack.length - 1]);
}

// POP[] POP top stack element
// 0x21
function POP(state) {
    if (exports.DEBUG) { console.log(state.step, 'POP[]'); }

    state.stack.pop();
}

// CLEAR[] CLEAR the stack
// 0x22
function CLEAR(state) {
    if (exports.DEBUG) { console.log(state.step, 'CLEAR[]'); }

    state.stack.length = 0;
}

// SWAP[] SWAP the top two elements on the stack
// 0x23
function SWAP(state) {
    var stack = state.stack;

    var a = stack.pop();
    var b = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SWAP[]'); }

    stack.push(a);
    stack.push(b);
}

// DEPTH[] DEPTH of the stack
// 0x24
function DEPTH(state) {
    var stack = state.stack;

    if (exports.DEBUG) { console.log(state.step, 'DEPTH[]'); }

    stack.push(stack.length);
}

// LOOPCALL[] LOOPCALL function
// 0x2A
function LOOPCALL(state) {
    var stack = state.stack;
    var fn = stack.pop();
    var c = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'LOOPCALL[]', fn, c); }

    // saves callers program
    var cip = state.ip;
    var cprog = state.prog;

    state.prog = state.funcs[fn];

    // executes the function
    for (var i = 0; i < c; i++) {
        exec(state);

        if (exports.DEBUG) { console.log(
            ++state.step,
            i + 1 < c ? 'next loopcall' : 'done loopcall',
            i
        ); }
    }

    // restores the callers program
    state.ip = cip;
    state.prog = cprog;
}

// CALL[] CALL function
// 0x2B
function CALL(state) {
    var fn = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'CALL[]', fn); }

    // saves callers program
    var cip = state.ip;
    var cprog = state.prog;

    state.prog = state.funcs[fn];

    // executes the function
    exec(state);

    // restores the callers program
    state.ip = cip;
    state.prog = cprog;

    if (exports.DEBUG) { console.log(++state.step, 'returning from', fn); }
}

// CINDEX[] Copy the INDEXed element to the top of the stack
// 0x25
function CINDEX(state) {
    var stack = state.stack;
    var k = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'CINDEX[]', k); }

    // In case of k == 1, it copies the last element after popping
    // thus stack.length - k.
    stack.push(stack[stack.length - k]);
}

// MINDEX[] Move the INDEXed element to the top of the stack
// 0x26
function MINDEX(state) {
    var stack = state.stack;
    var k = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'MINDEX[]', k); }

    stack.push(stack.splice(stack.length - k, 1)[0]);
}

// FDEF[] Function DEFinition
// 0x2C
function FDEF(state) {
    if (state.env !== 'fpgm') { throw new Error('FDEF not allowed here'); }
    var stack = state.stack;
    var prog = state.prog;
    var ip = state.ip;

    var fn = stack.pop();
    var ipBegin = ip;

    if (exports.DEBUG) { console.log(state.step, 'FDEF[]', fn); }

    while (prog[++ip] !== 0x2D){  }

    state.ip = ip;
    state.funcs[fn] = prog.slice(ipBegin + 1, ip);
}

// MDAP[a] Move Direct Absolute Point
// 0x2E-0x2F
function MDAP(round, state) {
    var pi = state.stack.pop();
    var p = state.z0[pi];
    var fv = state.fv;
    var pv = state.pv;

    if (exports.DEBUG) { console.log(state.step, 'MDAP[' + round + ']', pi); }

    var d = pv.distance(p, HPZero);

    if (round) { d = state.round(d); }

    fv.setRelative(p, HPZero, d, pv);
    fv.touch(p);

    state.rp0 = state.rp1 = pi;
}

// IUP[a] Interpolate Untouched Points through the outline
// 0x30
function IUP(v, state) {
    var z2 = state.z2;
    var pLen = z2.length - 2;
    var cp;
    var pp;
    var np;

    if (exports.DEBUG) { console.log(state.step, 'IUP[' + v.axis + ']'); }

    for (var i = 0; i < pLen; i++) {
        cp = z2[i]; // current point

        // if this point has been touched go on
        if (v.touched(cp)) { continue; }

        pp = cp.prevTouched(v);

        // no point on the contour has been touched?
        if (pp === cp) { continue; }

        np = cp.nextTouched(v);

        if (pp === np) {
            // only one point on the contour has been touched
            // so simply moves the point like that

            v.setRelative(cp, cp, v.distance(pp, pp, false, true), v, true);
        }

        v.interpolate(cp, pp, np, v);
    }
}

// SHP[] SHift Point using reference point
// 0x32-0x33
function SHP(a, state) {
    var stack = state.stack;
    var rpi = a ? state.rp1 : state.rp2;
    var rp = (a ? state.z0 : state.z1)[rpi];
    var fv = state.fv;
    var pv = state.pv;
    var loop = state.loop;
    var z2 = state.z2;

    while (loop--)
    {
        var pi = stack.pop();
        var p = z2[pi];

        var d = pv.distance(rp, rp, false, true);
        fv.setRelative(p, p, d, pv);
        fv.touch(p);

        if (exports.DEBUG) {
            console.log(
                state.step,
                (state.loop > 1 ?
                   'loop ' + (state.loop - loop) + ': ' :
                   ''
                ) +
                'SHP[' + (a ? 'rp1' : 'rp2') + ']', pi
            );
        }
    }

    state.loop = 1;
}

// SHC[] SHift Contour using reference point
// 0x36-0x37
function SHC(a, state) {
    var stack = state.stack;
    var rpi = a ? state.rp1 : state.rp2;
    var rp = (a ? state.z0 : state.z1)[rpi];
    var fv = state.fv;
    var pv = state.pv;
    var ci = stack.pop();
    var sp = state.z2[state.contours[ci]];
    var p = sp;

    if (exports.DEBUG) { console.log(state.step, 'SHC[' + a + ']', ci); }

    var d = pv.distance(rp, rp, false, true);

    do {
        if (p !== rp) { fv.setRelative(p, p, d, pv); }
        p = p.nextPointOnContour;
    } while (p !== sp);
}

// SHZ[] SHift Zone using reference point
// 0x36-0x37
function SHZ(a, state) {
    var stack = state.stack;
    var rpi = a ? state.rp1 : state.rp2;
    var rp = (a ? state.z0 : state.z1)[rpi];
    var fv = state.fv;
    var pv = state.pv;

    var e = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SHZ[' + a + ']', e); }

    var z;
    switch (e) {
        case 0 : z = state.tZone; break;
        case 1 : z = state.gZone; break;
        default : throw new Error('Invalid zone');
    }

    var p;
    var d = pv.distance(rp, rp, false, true);
    var pLen = z.length - 2;
    for (var i = 0; i < pLen; i++)
    {
        p = z[i];
        if (p !== rp) { fv.setRelative(p, p, d, pv); }
    }
}

// SHPIX[] SHift point by a PIXel amount
// 0x38
function SHPIX(state) {
    var stack = state.stack;
    var loop = state.loop;
    var fv = state.fv;
    var d = stack.pop() / 0x40;
    var z2 = state.z2;

    while (loop--) {
        var pi = stack.pop();
        var p = z2[pi];

        if (exports.DEBUG) {
            console.log(
                state.step,
                (state.loop > 1 ? 'loop ' + (state.loop - loop) + ': ' : '') +
                'SHPIX[]', pi, d
            );
        }

        fv.setRelative(p, p, d);
        fv.touch(p);
    }

    state.loop = 1;
}

// IP[] Interpolate Point
// 0x39
function IP(state) {
    var stack = state.stack;
    var rp1i = state.rp1;
    var rp2i = state.rp2;
    var loop = state.loop;
    var rp1 = state.z0[rp1i];
    var rp2 = state.z1[rp2i];
    var fv = state.fv;
    var pv = state.dpv;
    var z2 = state.z2;

    while (loop--) {
        var pi = stack.pop();
        var p = z2[pi];

        if (exports.DEBUG) {
            console.log(
                state.step,
                (state.loop > 1 ? 'loop ' + (state.loop - loop) + ': ' : '') +
                'IP[]', pi, rp1i, '<->', rp2i
            );
        }

        fv.interpolate(p, rp1, rp2, pv);

        fv.touch(p);
    }

    state.loop = 1;
}

// MSIRP[a] Move Stack Indirect Relative Point
// 0x3A-0x3B
function MSIRP(a, state) {
    var stack = state.stack;
    var d = stack.pop() / 64;
    var pi = stack.pop();
    var p = state.z1[pi];
    var rp0 = state.z0[state.rp0];
    var fv = state.fv;
    var pv = state.pv;

    fv.setRelative(p, rp0, d, pv);
    fv.touch(p);

    if (exports.DEBUG) { console.log(state.step, 'MSIRP[' + a + ']', d, pi); }

    state.rp1 = state.rp0;
    state.rp2 = pi;
    if (a) { state.rp0 = pi; }
}

// ALIGNRP[] Align to reference point.
// 0x3C
function ALIGNRP(state) {
    var stack = state.stack;
    var rp0i = state.rp0;
    var rp0 = state.z0[rp0i];
    var loop = state.loop;
    var fv = state.fv;
    var pv = state.pv;
    var z1 = state.z1;

    while (loop--) {
        var pi = stack.pop();
        var p = z1[pi];

        if (exports.DEBUG) {
            console.log(
                state.step,
                (state.loop > 1 ? 'loop ' + (state.loop - loop) + ': ' : '') +
                'ALIGNRP[]', pi
            );
        }

        fv.setRelative(p, rp0, 0, pv);
        fv.touch(p);
    }

    state.loop = 1;
}

// RTG[] Round To Double Grid
// 0x3D
function RTDG(state) {
    if (exports.DEBUG) { console.log(state.step, 'RTDG[]'); }

    state.round = roundToDoubleGrid;
}

// MIAP[a] Move Indirect Absolute Point
// 0x3E-0x3F
function MIAP(round, state) {
    var stack = state.stack;
    var n = stack.pop();
    var pi = stack.pop();
    var p = state.z0[pi];
    var fv = state.fv;
    var pv = state.pv;
    var cv = state.cvt[n];

    // TODO cvtcutin should be considered here
    if (round) { cv = state.round(cv); }

    if (exports.DEBUG) {
        console.log(
            state.step,
            'MIAP[' + round + ']',
            n, '(', cv, ')', pi
        );
    }

    fv.setRelative(p, HPZero, cv, pv);

    if (state.zp0 === 0) {
        p.xo = p.x;
        p.yo = p.y;
    }

    fv.touch(p);

    state.rp0 = state.rp1 = pi;
}

// NPUSB[] PUSH N Bytes
// 0x40
function NPUSHB(state) {
    var prog = state.prog;
    var ip = state.ip;
    var stack = state.stack;

    var n = prog[++ip];

    if (exports.DEBUG) { console.log(state.step, 'NPUSHB[]', n); }

    for (var i = 0; i < n; i++) { stack.push(prog[++ip]); }

    state.ip = ip;
}

// NPUSHW[] PUSH N Words
// 0x41
function NPUSHW(state) {
    var ip = state.ip;
    var prog = state.prog;
    var stack = state.stack;
    var n = prog[++ip];

    if (exports.DEBUG) { console.log(state.step, 'NPUSHW[]', n); }

    for (var i = 0; i < n; i++) {
        var w = (prog[++ip] << 8) | prog[++ip];
        if (w & 0x8000) { w = -((w ^ 0xffff) + 1); }
        stack.push(w);
    }

    state.ip = ip;
}

// WS[] Write Store
// 0x42
function WS(state) {
    var stack = state.stack;
    var store = state.store;

    if (!store) { store = state.store = []; }

    var v = stack.pop();
    var l = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'WS', v, l); }

    store[l] = v;
}

// RS[] Read Store
// 0x43
function RS(state) {
    var stack = state.stack;
    var store = state.store;

    var l = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'RS', l); }

    var v = (store && store[l]) || 0;

    stack.push(v);
}

// WCVTP[] Write Control Value Table in Pixel units
// 0x44
function WCVTP(state) {
    var stack = state.stack;

    var v = stack.pop();
    var l = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'WCVTP', v, l); }

    state.cvt[l] = v / 0x40;
}

// RCVT[] Read Control Value Table entry
// 0x45
function RCVT(state) {
    var stack = state.stack;
    var cvte = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'RCVT', cvte); }

    stack.push(state.cvt[cvte] * 0x40);
}

// GC[] Get Coordinate projected onto the projection vector
// 0x46-0x47
function GC(a, state) {
    var stack = state.stack;
    var pi = stack.pop();
    var p = state.z2[pi];

    if (exports.DEBUG) { console.log(state.step, 'GC[' + a + ']', pi); }

    stack.push(state.dpv.distance(p, HPZero, a, false) * 0x40);
}

// MD[a] Measure Distance
// 0x49-0x4A
function MD(a, state) {
    var stack = state.stack;
    var pi2 = stack.pop();
    var pi1 = stack.pop();
    var p2 = state.z1[pi2];
    var p1 = state.z0[pi1];
    var d = state.dpv.distance(p1, p2, a, a);

    if (exports.DEBUG) { console.log(state.step, 'MD[' + a + ']', pi2, pi1, '->', d); }

    state.stack.push(Math.round(d * 64));
}

// MPPEM[] Measure Pixels Per EM
// 0x4B
function MPPEM(state) {
    if (exports.DEBUG) { console.log(state.step, 'MPPEM[]'); }
    state.stack.push(state.ppem);
}

// FLIPON[] set the auto FLIP Boolean to ON
// 0x4D
function FLIPON(state) {
    if (exports.DEBUG) { console.log(state.step, 'FLIPON[]'); }
    state.autoFlip = true;
}

// LT[] Less Than
// 0x50
function LT(state) {
    var stack = state.stack;
    var e2 = stack.pop();
    var e1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'LT[]', e2, e1); }

    stack.push(e1 < e2 ? 1 : 0);
}

// LTEQ[] Less Than or EQual
// 0x53
function LTEQ(state) {
    var stack = state.stack;
    var e2 = stack.pop();
    var e1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'LTEQ[]', e2, e1); }

    stack.push(e1 <= e2 ? 1 : 0);
}

// GTEQ[] Greater Than
// 0x52
function GT(state) {
    var stack = state.stack;
    var e2 = stack.pop();
    var e1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'GT[]', e2, e1); }

    stack.push(e1 > e2 ? 1 : 0);
}

// GTEQ[] Greater Than or EQual
// 0x53
function GTEQ(state) {
    var stack = state.stack;
    var e2 = stack.pop();
    var e1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'GTEQ[]', e2, e1); }

    stack.push(e1 >= e2 ? 1 : 0);
}

// EQ[] EQual
// 0x54
function EQ(state) {
    var stack = state.stack;
    var e2 = stack.pop();
    var e1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'EQ[]', e2, e1); }

    stack.push(e2 === e1 ? 1 : 0);
}

// NEQ[] Not EQual
// 0x55
function NEQ(state) {
    var stack = state.stack;
    var e2 = stack.pop();
    var e1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'NEQ[]', e2, e1); }

    stack.push(e2 !== e1 ? 1 : 0);
}

// ODD[] ODD
// 0x56
function ODD(state) {
    var stack = state.stack;
    var n = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'ODD[]', n); }

    stack.push(Math.trunc(n) % 2 ? 1 : 0);
}

// EVEN[] EVEN
// 0x57
function EVEN(state) {
    var stack = state.stack;
    var n = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'EVEN[]', n); }

    stack.push(Math.trunc(n) % 2 ? 0 : 1);
}

// IF[] IF test
// 0x58
function IF(state) {
    var test = state.stack.pop();
    var ins;

    if (exports.DEBUG) { console.log(state.step, 'IF[]', test); }

    // if test is true it just continues
    // if not the ip is skipped until matching ELSE or EIF
    if (!test) {
        skip(state, true);

        if (exports.DEBUG) { console.log(state.step, ins === 0x1B ? 'ELSE[]' : 'EIF[]'); }
    }
}

// EIF[] End IF
// 0x59
function EIF(state) {
    // this can be reached normally when
    // executing an else branch.
    // -> just ignore it

    if (exports.DEBUG) { console.log(state.step, 'EIF[]'); }
}

// AND[] logical AND
// 0x5A
function AND(state) {
    var stack = state.stack;
    var e2 = stack.pop();
    var e1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'AND[]', e2, e1); }

    stack.push(e2 && e1 ? 1 : 0);
}

// OR[] logical OR
// 0x5B
function OR(state) {
    var stack = state.stack;
    var e2 = stack.pop();
    var e1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'OR[]', e2, e1); }

    stack.push(e2 || e1 ? 1 : 0);
}

// NOT[] logical NOT
// 0x5C
function NOT(state) {
    var stack = state.stack;
    var e = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'NOT[]', e); }

    stack.push(e ? 0 : 1);
}

// DELTAP1[] DELTA exception P1
// DELTAP2[] DELTA exception P2
// DELTAP3[] DELTA exception P3
// 0x5D, 0x71, 0x72
function DELTAP123(b, state) {
    var stack = state.stack;
    var n = stack.pop();
    var fv = state.fv;
    var pv = state.pv;
    var ppem = state.ppem;
    var base = state.deltaBase + (b - 1) * 16;
    var ds = state.deltaShift;
    var z0 = state.z0;

    if (exports.DEBUG) { console.log(state.step, 'DELTAP[' + b + ']', n, stack); }

    for (var i = 0; i < n; i++)
    {
        var pi = stack.pop();
        var arg = stack.pop();
        var appem = base + ((arg & 0xF0) >> 4);
        if (appem !== ppem) { continue; }

        var mag = (arg & 0x0F) - 8;
        if (mag >= 0) { mag++; }
        if (exports.DEBUG) { console.log(state.step, 'DELTAPFIX', pi, 'by', mag * ds); }

        var p = z0[pi];
        fv.setRelative(p, p, mag * ds, pv);
    }
}

// SDB[] Set Delta Base in the graphics state
// 0x5E
function SDB(state) {
    var stack = state.stack;
    var n = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SDB[]', n); }

    state.deltaBase = n;
}

// SDS[] Set Delta Shift in the graphics state
// 0x5F
function SDS(state) {
    var stack = state.stack;
    var n = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SDS[]', n); }

    state.deltaShift = Math.pow(0.5, n);
}

// ADD[] ADD
// 0x60
function ADD(state) {
    var stack = state.stack;
    var n2 = stack.pop();
    var n1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'ADD[]', n2, n1); }

    stack.push(n1 + n2);
}

// SUB[] SUB
// 0x61
function SUB(state) {
    var stack = state.stack;
    var n2 = stack.pop();
    var n1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SUB[]', n2, n1); }

    stack.push(n1 - n2);
}

// DIV[] DIV
// 0x62
function DIV(state) {
    var stack = state.stack;
    var n2 = stack.pop();
    var n1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'DIV[]', n2, n1); }

    stack.push(n1 * 64 / n2);
}

// MUL[] MUL
// 0x63
function MUL(state) {
    var stack = state.stack;
    var n2 = stack.pop();
    var n1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'MUL[]', n2, n1); }

    stack.push(n1 * n2 / 64);
}

// ABS[] ABSolute value
// 0x64
function ABS(state) {
    var stack = state.stack;
    var n = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'ABS[]', n); }

    stack.push(Math.abs(n));
}

// NEG[] NEGate
// 0x65
function NEG(state) {
    var stack = state.stack;
    var n = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'NEG[]', n); }

    stack.push(-n);
}

// FLOOR[] FLOOR
// 0x66
function FLOOR(state) {
    var stack = state.stack;
    var n = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'FLOOR[]', n); }

    stack.push(Math.floor(n / 0x40) * 0x40);
}

// CEILING[] CEILING
// 0x67
function CEILING(state) {
    var stack = state.stack;
    var n = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'CEILING[]', n); }

    stack.push(Math.ceil(n / 0x40) * 0x40);
}

// ROUND[ab] ROUND value
// 0x68-0x6B
function ROUND(dt, state) {
    var stack = state.stack;
    var n = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'ROUND[]'); }

    stack.push(state.round(n / 0x40) * 0x40);
}

// WCVTF[] Write Control Value Table in Funits
// 0x70
function WCVTF(state) {
    var stack = state.stack;
    var v = stack.pop();
    var l = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'WCVTF[]', v, l); }

    state.cvt[l] = v * state.ppem / state.font.unitsPerEm;
}

// DELTAC1[] DELTA exception C1
// DELTAC2[] DELTA exception C2
// DELTAC3[] DELTA exception C3
// 0x73, 0x74, 0x75
function DELTAC123(b, state) {
    var stack = state.stack;
    var n = stack.pop();
    var ppem = state.ppem;
    var base = state.deltaBase + (b - 1) * 16;
    var ds = state.deltaShift;

    if (exports.DEBUG) { console.log(state.step, 'DELTAC[' + b + ']', n, stack); }

    for (var i = 0; i < n; i++) {
        var c = stack.pop();
        var arg = stack.pop();
        var appem = base + ((arg & 0xF0) >> 4);
        if (appem !== ppem) { continue; }

        var mag = (arg & 0x0F) - 8;
        if (mag >= 0) { mag++; }

        var delta = mag * ds;

        if (exports.DEBUG) { console.log(state.step, 'DELTACFIX', c, 'by', delta); }

        state.cvt[c] += delta;
    }
}

// SROUND[] Super ROUND
// 0x76
function SROUND(state) {
    var n = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'SROUND[]', n); }

    state.round = roundSuper;

    var period;

    switch (n & 0xC0) {
        case 0x00:
            period = 0.5;
            break;
        case 0x40:
            period = 1;
            break;
        case 0x80:
            period = 2;
            break;
        default:
            throw new Error('invalid SROUND value');
    }

    state.srPeriod = period;

    switch (n & 0x30) {
        case 0x00:
            state.srPhase = 0;
            break;
        case 0x10:
            state.srPhase = 0.25 * period;
            break;
        case 0x20:
            state.srPhase = 0.5  * period;
            break;
        case 0x30:
            state.srPhase = 0.75 * period;
            break;
        default: throw new Error('invalid SROUND value');
    }

    n &= 0x0F;

    if (n === 0) { state.srThreshold = 0; }
    else { state.srThreshold = (n / 8 - 0.5) * period; }
}

// S45ROUND[] Super ROUND 45 degrees
// 0x77
function S45ROUND(state) {
    var n = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'S45ROUND[]', n); }

    state.round = roundSuper;

    var period;

    switch (n & 0xC0) {
        case 0x00:
            period = Math.sqrt(2) / 2;
            break;
        case 0x40:
            period = Math.sqrt(2);
            break;
        case 0x80:
            period = 2 * Math.sqrt(2);
            break;
        default:
            throw new Error('invalid S45ROUND value');
    }

    state.srPeriod = period;

    switch (n & 0x30) {
        case 0x00:
            state.srPhase = 0;
            break;
        case 0x10:
            state.srPhase = 0.25 * period;
            break;
        case 0x20:
            state.srPhase = 0.5  * period;
            break;
        case 0x30:
            state.srPhase = 0.75 * period;
            break;
        default:
            throw new Error('invalid S45ROUND value');
    }

    n &= 0x0F;

    if (n === 0) { state.srThreshold = 0; }
    else { state.srThreshold = (n / 8 - 0.5) * period; }
}

// ROFF[] Round Off
// 0x7A
function ROFF(state) {
    if (exports.DEBUG) { console.log(state.step, 'ROFF[]'); }

    state.round = roundOff;
}

// RUTG[] Round Up To Grid
// 0x7C
function RUTG(state) {
    if (exports.DEBUG) { console.log(state.step, 'RUTG[]'); }

    state.round = roundUpToGrid;
}

// RDTG[] Round Down To Grid
// 0x7D
function RDTG(state) {
    if (exports.DEBUG) { console.log(state.step, 'RDTG[]'); }

    state.round = roundDownToGrid;
}

// SCANCTRL[] SCAN conversion ConTRoL
// 0x85
function SCANCTRL(state) {
    var n = state.stack.pop();

    // ignored by opentype.js

    if (exports.DEBUG) { console.log(state.step, 'SCANCTRL[]', n); }
}

// SDPVTL[a] Set Dual Projection Vector To Line
// 0x86-0x87
function SDPVTL(a, state) {
    var stack = state.stack;
    var p2i = stack.pop();
    var p1i = stack.pop();
    var p2 = state.z2[p2i];
    var p1 = state.z1[p1i];

    if (exports.DEBUG) { console.log('SDPVTL[' + a + ']', p2i, p1i); }

    var dx;
    var dy;

    if (!a) {
        dx = p1.x - p2.x;
        dy = p1.y - p2.y;
    } else {
        dx = p2.y - p1.y;
        dy = p1.x - p2.x;
    }

    state.dpv = getUnitVector(dx, dy);
}

// GETINFO[] GET INFOrmation
// 0x88
function GETINFO(state) {
    var stack = state.stack;
    var sel = stack.pop();
    var r = 0;

    if (exports.DEBUG) { console.log(state.step, 'GETINFO[]', sel); }

    // v35 as in no subpixel hinting
    if (sel & 0x01) { r = 35; }

    // TODO rotation and stretch currently not supported
    // and thus those GETINFO are always 0.

    // opentype.js is always gray scaling
    if (sel & 0x20) { r |= 0x1000; }

    stack.push(r);
}

// ROLL[] ROLL the top three stack elements
// 0x8A
function ROLL(state) {
    var stack = state.stack;
    var a = stack.pop();
    var b = stack.pop();
    var c = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'ROLL[]'); }

    stack.push(b);
    stack.push(a);
    stack.push(c);
}

// MAX[] MAXimum of top two stack elements
// 0x8B
function MAX(state) {
    var stack = state.stack;
    var e2 = stack.pop();
    var e1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'MAX[]', e2, e1); }

    stack.push(Math.max(e1, e2));
}

// MIN[] MINimum of top two stack elements
// 0x8C
function MIN(state) {
    var stack = state.stack;
    var e2 = stack.pop();
    var e1 = stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'MIN[]', e2, e1); }

    stack.push(Math.min(e1, e2));
}

// SCANTYPE[] SCANTYPE
// 0x8D
function SCANTYPE(state) {
    var n = state.stack.pop();
    // ignored by opentype.js
    if (exports.DEBUG) { console.log(state.step, 'SCANTYPE[]', n); }
}

// INSTCTRL[] INSTCTRL
// 0x8D
function INSTCTRL(state) {
    var s = state.stack.pop();
    var v = state.stack.pop();

    if (exports.DEBUG) { console.log(state.step, 'INSTCTRL[]', s, v); }

    switch (s) {
        case 1 : state.inhibitGridFit = !!v; return;
        case 2 : state.ignoreCvt = !!v; return;
        default: throw new Error('invalid INSTCTRL[] selector');
    }
}

// PUSHB[abc] PUSH Bytes
// 0xB0-0xB7
function PUSHB(n, state) {
    var stack = state.stack;
    var prog = state.prog;
    var ip = state.ip;

    if (exports.DEBUG) { console.log(state.step, 'PUSHB[' + n + ']'); }

    for (var i = 0; i < n; i++) { stack.push(prog[++ip]); }

    state.ip = ip;
}

// PUSHW[abc] PUSH Words
// 0xB8-0xBF
function PUSHW(n, state) {
    var ip = state.ip;
    var prog = state.prog;
    var stack = state.stack;

    if (exports.DEBUG) { console.log(state.ip, 'PUSHW[' + n + ']'); }

    for (var i = 0; i < n; i++) {
        var w = (prog[++ip] << 8) | prog[++ip];
        if (w & 0x8000) { w = -((w ^ 0xffff) + 1); }
        stack.push(w);
    }

    state.ip = ip;
}

// MDRP[abcde] Move Direct Relative Point
// 0xD0-0xEF
// (if indirect is 0)
//
// and
//
// MIRP[abcde] Move Indirect Relative Point
// 0xE0-0xFF
// (if indirect is 1)

function MDRP_MIRP(indirect, setRp0, keepD, ro, dt, state) {
    var stack = state.stack;
    var cvte = indirect && stack.pop();
    var pi = stack.pop();
    var rp0i = state.rp0;
    var rp = state.z0[rp0i];
    var p = state.z1[pi];

    var md = state.minDis;
    var fv = state.fv;
    var pv = state.dpv;
    var od; // original distance
    var d; // moving distance
    var sign; // sign of distance
    var cv;

    d = od = pv.distance(p, rp, true, true);
    sign = d >= 0 ? 1 : -1; // Math.sign would be 0 in case of 0

    // TODO consider autoFlip
    d = Math.abs(d);

    if (indirect) {
        cv = state.cvt[cvte];

        if (ro && Math.abs(d - cv) < state.cvCutIn) { d = cv; }
    }

    if (keepD && d < md) { d = md; }

    if (ro) { d = state.round(d); }

    fv.setRelative(p, rp, sign * d, pv);
    fv.touch(p);

    if (exports.DEBUG) {
        console.log(
            state.step,
            (indirect ? 'MIRP[' : 'MDRP[') +
            (setRp0 ? 'M' : 'm') +
            (keepD ? '>' : '_') +
            (ro ? 'R' : '_') +
            (dt === 0 ? 'Gr' : (dt === 1 ? 'Bl' : (dt === 2 ? 'Wh' : ''))) +
            ']',
            indirect ?
                cvte + '(' + state.cvt[cvte] + ',' +  cv + ')' :
                '',
            pi,
            '(d =', od, '->', sign * d, ')'
        );
    }

    state.rp1 = state.rp0;
    state.rp2 = pi;
    if (setRp0) { state.rp0 = pi; }
}

/*
* The instruction table.
*/
instructionTable = [
    /* 0x00 */ SVTCA.bind(undefined, yUnitVector),
    /* 0x01 */ SVTCA.bind(undefined, xUnitVector),
    /* 0x02 */ SPVTCA.bind(undefined, yUnitVector),
    /* 0x03 */ SPVTCA.bind(undefined, xUnitVector),
    /* 0x04 */ SFVTCA.bind(undefined, yUnitVector),
    /* 0x05 */ SFVTCA.bind(undefined, xUnitVector),
    /* 0x06 */ SPVTL.bind(undefined, 0),
    /* 0x07 */ SPVTL.bind(undefined, 1),
    /* 0x08 */ SFVTL.bind(undefined, 0),
    /* 0x09 */ SFVTL.bind(undefined, 1),
    /* 0x0A */ SPVFS,
    /* 0x0B */ SFVFS,
    /* 0x0C */ GPV,
    /* 0x0D */ GFV,
    /* 0x0E */ SFVTPV,
    /* 0x0F */ ISECT,
    /* 0x10 */ SRP0,
    /* 0x11 */ SRP1,
    /* 0x12 */ SRP2,
    /* 0x13 */ SZP0,
    /* 0x14 */ SZP1,
    /* 0x15 */ SZP2,
    /* 0x16 */ SZPS,
    /* 0x17 */ SLOOP,
    /* 0x18 */ RTG,
    /* 0x19 */ RTHG,
    /* 0x1A */ SMD,
    /* 0x1B */ ELSE,
    /* 0x1C */ JMPR,
    /* 0x1D */ SCVTCI,
    /* 0x1E */ undefined,   // TODO SSWCI
    /* 0x1F */ undefined,   // TODO SSW
    /* 0x20 */ DUP,
    /* 0x21 */ POP,
    /* 0x22 */ CLEAR,
    /* 0x23 */ SWAP,
    /* 0x24 */ DEPTH,
    /* 0x25 */ CINDEX,
    /* 0x26 */ MINDEX,
    /* 0x27 */ undefined,   // TODO ALIGNPTS
    /* 0x28 */ undefined,
    /* 0x29 */ undefined,   // TODO UTP
    /* 0x2A */ LOOPCALL,
    /* 0x2B */ CALL,
    /* 0x2C */ FDEF,
    /* 0x2D */ undefined,   // ENDF (eaten by FDEF)
    /* 0x2E */ MDAP.bind(undefined, 0),
    /* 0x2F */ MDAP.bind(undefined, 1),
    /* 0x30 */ IUP.bind(undefined, yUnitVector),
    /* 0x31 */ IUP.bind(undefined, xUnitVector),
    /* 0x32 */ SHP.bind(undefined, 0),
    /* 0x33 */ SHP.bind(undefined, 1),
    /* 0x34 */ SHC.bind(undefined, 0),
    /* 0x35 */ SHC.bind(undefined, 1),
    /* 0x36 */ SHZ.bind(undefined, 0),
    /* 0x37 */ SHZ.bind(undefined, 1),
    /* 0x38 */ SHPIX,
    /* 0x39 */ IP,
    /* 0x3A */ MSIRP.bind(undefined, 0),
    /* 0x3B */ MSIRP.bind(undefined, 1),
    /* 0x3C */ ALIGNRP,
    /* 0x3D */ RTDG,
    /* 0x3E */ MIAP.bind(undefined, 0),
    /* 0x3F */ MIAP.bind(undefined, 1),
    /* 0x40 */ NPUSHB,
    /* 0x41 */ NPUSHW,
    /* 0x42 */ WS,
    /* 0x43 */ RS,
    /* 0x44 */ WCVTP,
    /* 0x45 */ RCVT,
    /* 0x46 */ GC.bind(undefined, 0),
    /* 0x47 */ GC.bind(undefined, 1),
    /* 0x48 */ undefined,   // TODO SCFS
    /* 0x49 */ MD.bind(undefined, 0),
    /* 0x4A */ MD.bind(undefined, 1),
    /* 0x4B */ MPPEM,
    /* 0x4C */ undefined,   // TODO MPS
    /* 0x4D */ FLIPON,
    /* 0x4E */ undefined,   // TODO FLIPOFF
    /* 0x4F */ undefined,   // TODO DEBUG
    /* 0x50 */ LT,
    /* 0x51 */ LTEQ,
    /* 0x52 */ GT,
    /* 0x53 */ GTEQ,
    /* 0x54 */ EQ,
    /* 0x55 */ NEQ,
    /* 0x56 */ ODD,
    /* 0x57 */ EVEN,
    /* 0x58 */ IF,
    /* 0x59 */ EIF,
    /* 0x5A */ AND,
    /* 0x5B */ OR,
    /* 0x5C */ NOT,
    /* 0x5D */ DELTAP123.bind(undefined, 1),
    /* 0x5E */ SDB,
    /* 0x5F */ SDS,
    /* 0x60 */ ADD,
    /* 0x61 */ SUB,
    /* 0x62 */ DIV,
    /* 0x63 */ MUL,
    /* 0x64 */ ABS,
    /* 0x65 */ NEG,
    /* 0x66 */ FLOOR,
    /* 0x67 */ CEILING,
    /* 0x68 */ ROUND.bind(undefined, 0),
    /* 0x69 */ ROUND.bind(undefined, 1),
    /* 0x6A */ ROUND.bind(undefined, 2),
    /* 0x6B */ ROUND.bind(undefined, 3),
    /* 0x6C */ undefined,   // TODO NROUND[ab]
    /* 0x6D */ undefined,   // TODO NROUND[ab]
    /* 0x6E */ undefined,   // TODO NROUND[ab]
    /* 0x6F */ undefined,   // TODO NROUND[ab]
    /* 0x70 */ WCVTF,
    /* 0x71 */ DELTAP123.bind(undefined, 2),
    /* 0x72 */ DELTAP123.bind(undefined, 3),
    /* 0x73 */ DELTAC123.bind(undefined, 1),
    /* 0x74 */ DELTAC123.bind(undefined, 2),
    /* 0x75 */ DELTAC123.bind(undefined, 3),
    /* 0x76 */ SROUND,
    /* 0x77 */ S45ROUND,
    /* 0x78 */ undefined,   // TODO JROT[]
    /* 0x79 */ undefined,   // TODO JROF[]
    /* 0x7A */ ROFF,
    /* 0x7B */ undefined,
    /* 0x7C */ RUTG,
    /* 0x7D */ RDTG,
    /* 0x7E */ POP, // actually SANGW, supposed to do only a pop though
    /* 0x7F */ POP, // actually AA, supposed to do only a pop though
    /* 0x80 */ undefined,   // TODO FLIPPT
    /* 0x81 */ undefined,   // TODO FLIPRGON
    /* 0x82 */ undefined,   // TODO FLIPRGOFF
    /* 0x83 */ undefined,
    /* 0x84 */ undefined,
    /* 0x85 */ SCANCTRL,
    /* 0x86 */ SDPVTL.bind(undefined, 0),
    /* 0x87 */ SDPVTL.bind(undefined, 1),
    /* 0x88 */ GETINFO,
    /* 0x89 */ undefined,   // TODO IDEF
    /* 0x8A */ ROLL,
    /* 0x8B */ MAX,
    /* 0x8C */ MIN,
    /* 0x8D */ SCANTYPE,
    /* 0x8E */ INSTCTRL,
    /* 0x8F */ undefined,
    /* 0x90 */ undefined,
    /* 0x91 */ undefined,
    /* 0x92 */ undefined,
    /* 0x93 */ undefined,
    /* 0x94 */ undefined,
    /* 0x95 */ undefined,
    /* 0x96 */ undefined,
    /* 0x97 */ undefined,
    /* 0x98 */ undefined,
    /* 0x99 */ undefined,
    /* 0x9A */ undefined,
    /* 0x9B */ undefined,
    /* 0x9C */ undefined,
    /* 0x9D */ undefined,
    /* 0x9E */ undefined,
    /* 0x9F */ undefined,
    /* 0xA0 */ undefined,
    /* 0xA1 */ undefined,
    /* 0xA2 */ undefined,
    /* 0xA3 */ undefined,
    /* 0xA4 */ undefined,
    /* 0xA5 */ undefined,
    /* 0xA6 */ undefined,
    /* 0xA7 */ undefined,
    /* 0xA8 */ undefined,
    /* 0xA9 */ undefined,
    /* 0xAA */ undefined,
    /* 0xAB */ undefined,
    /* 0xAC */ undefined,
    /* 0xAD */ undefined,
    /* 0xAE */ undefined,
    /* 0xAF */ undefined,
    /* 0xB0 */ PUSHB.bind(undefined, 1),
    /* 0xB1 */ PUSHB.bind(undefined, 2),
    /* 0xB2 */ PUSHB.bind(undefined, 3),
    /* 0xB3 */ PUSHB.bind(undefined, 4),
    /* 0xB4 */ PUSHB.bind(undefined, 5),
    /* 0xB5 */ PUSHB.bind(undefined, 6),
    /* 0xB6 */ PUSHB.bind(undefined, 7),
    /* 0xB7 */ PUSHB.bind(undefined, 8),
    /* 0xB8 */ PUSHW.bind(undefined, 1),
    /* 0xB9 */ PUSHW.bind(undefined, 2),
    /* 0xBA */ PUSHW.bind(undefined, 3),
    /* 0xBB */ PUSHW.bind(undefined, 4),
    /* 0xBC */ PUSHW.bind(undefined, 5),
    /* 0xBD */ PUSHW.bind(undefined, 6),
    /* 0xBE */ PUSHW.bind(undefined, 7),
    /* 0xBF */ PUSHW.bind(undefined, 8),
    /* 0xC0 */ MDRP_MIRP.bind(undefined, 0, 0, 0, 0, 0),
    /* 0xC1 */ MDRP_MIRP.bind(undefined, 0, 0, 0, 0, 1),
    /* 0xC2 */ MDRP_MIRP.bind(undefined, 0, 0, 0, 0, 2),
    /* 0xC3 */ MDRP_MIRP.bind(undefined, 0, 0, 0, 0, 3),
    /* 0xC4 */ MDRP_MIRP.bind(undefined, 0, 0, 0, 1, 0),
    /* 0xC5 */ MDRP_MIRP.bind(undefined, 0, 0, 0, 1, 1),
    /* 0xC6 */ MDRP_MIRP.bind(undefined, 0, 0, 0, 1, 2),
    /* 0xC7 */ MDRP_MIRP.bind(undefined, 0, 0, 0, 1, 3),
    /* 0xC8 */ MDRP_MIRP.bind(undefined, 0, 0, 1, 0, 0),
    /* 0xC9 */ MDRP_MIRP.bind(undefined, 0, 0, 1, 0, 1),
    /* 0xCA */ MDRP_MIRP.bind(undefined, 0, 0, 1, 0, 2),
    /* 0xCB */ MDRP_MIRP.bind(undefined, 0, 0, 1, 0, 3),
    /* 0xCC */ MDRP_MIRP.bind(undefined, 0, 0, 1, 1, 0),
    /* 0xCD */ MDRP_MIRP.bind(undefined, 0, 0, 1, 1, 1),
    /* 0xCE */ MDRP_MIRP.bind(undefined, 0, 0, 1, 1, 2),
    /* 0xCF */ MDRP_MIRP.bind(undefined, 0, 0, 1, 1, 3),
    /* 0xD0 */ MDRP_MIRP.bind(undefined, 0, 1, 0, 0, 0),
    /* 0xD1 */ MDRP_MIRP.bind(undefined, 0, 1, 0, 0, 1),
    /* 0xD2 */ MDRP_MIRP.bind(undefined, 0, 1, 0, 0, 2),
    /* 0xD3 */ MDRP_MIRP.bind(undefined, 0, 1, 0, 0, 3),
    /* 0xD4 */ MDRP_MIRP.bind(undefined, 0, 1, 0, 1, 0),
    /* 0xD5 */ MDRP_MIRP.bind(undefined, 0, 1, 0, 1, 1),
    /* 0xD6 */ MDRP_MIRP.bind(undefined, 0, 1, 0, 1, 2),
    /* 0xD7 */ MDRP_MIRP.bind(undefined, 0, 1, 0, 1, 3),
    /* 0xD8 */ MDRP_MIRP.bind(undefined, 0, 1, 1, 0, 0),
    /* 0xD9 */ MDRP_MIRP.bind(undefined, 0, 1, 1, 0, 1),
    /* 0xDA */ MDRP_MIRP.bind(undefined, 0, 1, 1, 0, 2),
    /* 0xDB */ MDRP_MIRP.bind(undefined, 0, 1, 1, 0, 3),
    /* 0xDC */ MDRP_MIRP.bind(undefined, 0, 1, 1, 1, 0),
    /* 0xDD */ MDRP_MIRP.bind(undefined, 0, 1, 1, 1, 1),
    /* 0xDE */ MDRP_MIRP.bind(undefined, 0, 1, 1, 1, 2),
    /* 0xDF */ MDRP_MIRP.bind(undefined, 0, 1, 1, 1, 3),
    /* 0xE0 */ MDRP_MIRP.bind(undefined, 1, 0, 0, 0, 0),
    /* 0xE1 */ MDRP_MIRP.bind(undefined, 1, 0, 0, 0, 1),
    /* 0xE2 */ MDRP_MIRP.bind(undefined, 1, 0, 0, 0, 2),
    /* 0xE3 */ MDRP_MIRP.bind(undefined, 1, 0, 0, 0, 3),
    /* 0xE4 */ MDRP_MIRP.bind(undefined, 1, 0, 0, 1, 0),
    /* 0xE5 */ MDRP_MIRP.bind(undefined, 1, 0, 0, 1, 1),
    /* 0xE6 */ MDRP_MIRP.bind(undefined, 1, 0, 0, 1, 2),
    /* 0xE7 */ MDRP_MIRP.bind(undefined, 1, 0, 0, 1, 3),
    /* 0xE8 */ MDRP_MIRP.bind(undefined, 1, 0, 1, 0, 0),
    /* 0xE9 */ MDRP_MIRP.bind(undefined, 1, 0, 1, 0, 1),
    /* 0xEA */ MDRP_MIRP.bind(undefined, 1, 0, 1, 0, 2),
    /* 0xEB */ MDRP_MIRP.bind(undefined, 1, 0, 1, 0, 3),
    /* 0xEC */ MDRP_MIRP.bind(undefined, 1, 0, 1, 1, 0),
    /* 0xED */ MDRP_MIRP.bind(undefined, 1, 0, 1, 1, 1),
    /* 0xEE */ MDRP_MIRP.bind(undefined, 1, 0, 1, 1, 2),
    /* 0xEF */ MDRP_MIRP.bind(undefined, 1, 0, 1, 1, 3),
    /* 0xF0 */ MDRP_MIRP.bind(undefined, 1, 1, 0, 0, 0),
    /* 0xF1 */ MDRP_MIRP.bind(undefined, 1, 1, 0, 0, 1),
    /* 0xF2 */ MDRP_MIRP.bind(undefined, 1, 1, 0, 0, 2),
    /* 0xF3 */ MDRP_MIRP.bind(undefined, 1, 1, 0, 0, 3),
    /* 0xF4 */ MDRP_MIRP.bind(undefined, 1, 1, 0, 1, 0),
    /* 0xF5 */ MDRP_MIRP.bind(undefined, 1, 1, 0, 1, 1),
    /* 0xF6 */ MDRP_MIRP.bind(undefined, 1, 1, 0, 1, 2),
    /* 0xF7 */ MDRP_MIRP.bind(undefined, 1, 1, 0, 1, 3),
    /* 0xF8 */ MDRP_MIRP.bind(undefined, 1, 1, 1, 0, 0),
    /* 0xF9 */ MDRP_MIRP.bind(undefined, 1, 1, 1, 0, 1),
    /* 0xFA */ MDRP_MIRP.bind(undefined, 1, 1, 1, 0, 2),
    /* 0xFB */ MDRP_MIRP.bind(undefined, 1, 1, 1, 0, 3),
    /* 0xFC */ MDRP_MIRP.bind(undefined, 1, 1, 1, 1, 0),
    /* 0xFD */ MDRP_MIRP.bind(undefined, 1, 1, 1, 1, 1),
    /* 0xFE */ MDRP_MIRP.bind(undefined, 1, 1, 1, 1, 2),
    /* 0xFF */ MDRP_MIRP.bind(undefined, 1, 1, 1, 1, 3)
];



/*****************************
  Mathematical Considerations
******************************

fv ... refers to freedom vector
pv ... refers to projection vector
rp ... refers to reference point
p  ... refers to to point being operated on
d  ... refers to distance

SETRELATIVE:
============

case freedom vector == x-axis:
------------------------------

                        (pv)
                     .-'
              rpd .-'
               .-*
          d .-'90°'
         .-'       '
      .-'           '
   *-'               ' b
  rp                  '
                       '
                        '
            p *----------*-------------- (fv)
                          pm

  rpdx = rpx + d * pv.x
  rpdy = rpy + d * pv.y

  equation of line b

   y - rpdy = pvns * (x- rpdx)

   y = p.y

   x = rpdx + ( p.y - rpdy ) / pvns


case freedom vector == y-axis:
------------------------------

    * pm
    |\
    | \
    |  \
    |   \
    |    \
    |     \
    |      \
    |       \
    |        \
    |         \ b
    |          \
    |           \
    |            \    .-' (pv)
    |         90° \.-'
    |           .-'* rpd
    |        .-'
    *     *-'  d
    p     rp

  rpdx = rpx + d * pv.x
  rpdy = rpy + d * pv.y

  equation of line b:
           pvns ... normal slope to pv

   y - rpdy = pvns * (x - rpdx)

   x = p.x

   y = rpdy +  pvns * (p.x - rpdx)



generic case:
-------------


                              .'(fv)
                            .'
                          .* pm
                        .' !
                      .'    .
                    .'      !
                  .'         . b
                .'           !
               *              .
              p               !
                         90°   .    ... (pv)
                           ...-*-'''
                  ...---'''    rpd
         ...---'''   d
   *--'''
  rp

    rpdx = rpx + d * pv.x
    rpdy = rpy + d * pv.y

 equation of line b:
    pvns... normal slope to pv

    y - rpdy = pvns * (x - rpdx)

 equation of freedom vector line:
    fvs ... slope of freedom vector (=fy/fx)

    y - py = fvs * (x - px)


  on pm both equations are true for same x/y

    y - rpdy = pvns * (x - rpdx)

    y - py = fvs * (x - px)

  form to y and set equal:

    pvns * (x - rpdx) + rpdy = fvs * (x - px) + py

  expand:

    pvns * x - pvns * rpdx + rpdy = fvs * x - fvs * px + py

  switch:

    fvs * x - fvs * px + py = pvns * x - pvns * rpdx + rpdy

  solve for x:

    fvs * x - pvns * x = fvs * px - pvns * rpdx - py + rpdy



          fvs * px - pvns * rpdx + rpdy - py
    x =  -----------------------------------
                 fvs - pvns

  and:

    y = fvs * (x - px) + py



INTERPOLATE:
============

Examples of point interpolation.

The weight of the movement of the reference point gets bigger
the further the other reference point is away, thus the safest
option (that is avoiding 0/0 divisions) is to weight the
original distance of the other point by the sum of both distances.

If the sum of both distances is 0, then move the point by the
arithmetic average of the movement of both reference points.




           (+6)
    rp1o *---->*rp1
         .     .                          (+12)
         .     .                  rp2o *---------->* rp2
         .     .                       .           .
         .     .                       .           .
         .    10          20           .           .
         |.........|...................|           .
               .   .                               .
               .   . (+8)                          .
                po *------>*p                      .
               .           .                       .
               .    12     .          24           .
               |...........|.......................|
                                  36


-------



           (+10)
    rp1o *-------->*rp1
         .         .                      (-10)
         .         .              rp2 *<---------* rpo2
         .         .                   .         .
         .         .                   .         .
         .    10   .          30       .         .
         |.........|.............................|
                   .                   .
                   . (+5)              .
                po *--->* p            .
                   .    .              .
                   .    .   20         .
                   |....|..............|
                     5        15


-------


           (+10)
    rp1o *-------->*rp1
         .         .
         .         .
    rp2o *-------->*rp2


                               (+10)
                          po *-------->* p

-------


           (+10)
    rp1o *-------->*rp1
         .         .
         .         .(+30)
    rp2o *---------------------------->*rp2


                                        (+25)
                          po *----------------------->* p



vim: set ts=4 sw=4 expandtab:
*****/

// The Font object

/**
 * @typedef FontOptions
 * @type Object
 * @property {Boolean} empty - whether to create a new empty font
 * @property {string} familyName
 * @property {string} styleName
 * @property {string=} fullName
 * @property {string=} postScriptName
 * @property {string=} designer
 * @property {string=} designerURL
 * @property {string=} manufacturer
 * @property {string=} manufacturerURL
 * @property {string=} license
 * @property {string=} licenseURL
 * @property {string=} version
 * @property {string=} description
 * @property {string=} copyright
 * @property {string=} trademark
 * @property {Number} unitsPerEm
 * @property {Number} ascender
 * @property {Number} descender
 * @property {Number} createdTimestamp
 * @property {string=} weightClass
 * @property {string=} widthClass
 * @property {string=} fsSelection
 */

/**
 * A Font represents a loaded OpenType font file.
 * It contains a set of glyphs and methods to draw text on a drawing context,
 * or to get a path representing the text.
 * @exports opentype.Font
 * @class
 * @param {FontOptions}
 * @constructor
 */
function Font(options) {
    options = options || {};

    if (!options.empty) {
        // Check that we've provided the minimum set of names.
        checkArgument(options.familyName, 'When creating a new Font object, familyName is required.');
        checkArgument(options.styleName, 'When creating a new Font object, styleName is required.');
        checkArgument(options.unitsPerEm, 'When creating a new Font object, unitsPerEm is required.');
        checkArgument(options.ascender, 'When creating a new Font object, ascender is required.');
        checkArgument(options.descender, 'When creating a new Font object, descender is required.');
        checkArgument(options.descender < 0, 'Descender should be negative (e.g. -512).');

        // OS X will complain if the names are empty, so we put a single space everywhere by default.
        this.names = {
            fontFamily: {en: options.familyName || ' '},
            fontSubfamily: {en: options.styleName || ' '},
            fullName: {en: options.fullName || options.familyName + ' ' + options.styleName},
            postScriptName: {en: options.postScriptName || options.familyName + options.styleName},
            designer: {en: options.designer || ' '},
            designerURL: {en: options.designerURL || ' '},
            manufacturer: {en: options.manufacturer || ' '},
            manufacturerURL: {en: options.manufacturerURL || ' '},
            license: {en: options.license || ' '},
            licenseURL: {en: options.licenseURL || ' '},
            version: {en: options.version || 'Version 0.1'},
            description: {en: options.description || ' '},
            copyright: {en: options.copyright || ' '},
            trademark: {en: options.trademark || ' '}
        };
        this.unitsPerEm = options.unitsPerEm || 1000;
        this.ascender = options.ascender;
        this.descender = options.descender;
        this.createdTimestamp = options.createdTimestamp;
        this.tables = { os2: {
            usWeightClass: options.weightClass || this.usWeightClasses.MEDIUM,
            usWidthClass: options.widthClass || this.usWidthClasses.MEDIUM,
            fsSelection: options.fsSelection || this.fsSelectionValues.REGULAR
        } };
    }

    this.supported = true; // Deprecated: parseBuffer will throw an error if font is not supported.
    this.glyphs = new glyphset.GlyphSet(this, options.glyphs || []);
    this.encoding = new DefaultEncoding(this);
    this.substitution = new Substitution(this);
    this.tables = this.tables || {};

    Object.defineProperty(this, 'hinting', {
        get: function() {
            if (this._hinting) { return this._hinting; }
            if (this.outlinesFormat === 'truetype') {
                return (this._hinting = new Hinting(this));
            }
        }
    });
}

/**
 * Check if the font has a glyph for the given character.
 * @param  {string}
 * @return {Boolean}
 */
Font.prototype.hasChar = function(c) {
    return this.encoding.charToGlyphIndex(c) !== null;
};

/**
 * Convert the given character to a single glyph index.
 * Note that this function assumes that there is a one-to-one mapping between
 * the given character and a glyph; for complex scripts this might not be the case.
 * @param  {string}
 * @return {Number}
 */
Font.prototype.charToGlyphIndex = function(s) {
    return this.encoding.charToGlyphIndex(s);
};

/**
 * Convert the given character to a single Glyph object.
 * Note that this function assumes that there is a one-to-one mapping between
 * the given character and a glyph; for complex scripts this might not be the case.
 * @param  {string}
 * @return {opentype.Glyph}
 */
Font.prototype.charToGlyph = function(c) {
    var glyphIndex = this.charToGlyphIndex(c);
    var glyph = this.glyphs.get(glyphIndex);
    if (!glyph) {
        // .notdef
        glyph = this.glyphs.get(0);
    }

    return glyph;
};

/**
 * Convert the given text to a list of Glyph objects.
 * Note that there is no strict one-to-one mapping between characters and
 * glyphs, so the list of returned glyphs can be larger or smaller than the
 * length of the given string.
 * @param  {string}
 * @param  {GlyphRenderOptions} [options]
 * @return {opentype.Glyph[]}
 */
Font.prototype.stringToGlyphs = function(s, options) {
    var this$1 = this;

    options = options || this.defaultRenderOptions;
    // Get glyph indexes
    var indexes = [];
    for (var i = 0; i < s.length; i += 1) {
        var c = s[i];
        indexes.push(this$1.charToGlyphIndex(c));
    }
    var length = indexes.length;

    // Apply substitutions on glyph indexes
    if (options.features) {
        var script = options.script || this.substitution.getDefaultScriptName();
        var manyToOne = [];
        if (options.features.liga) { manyToOne = manyToOne.concat(this.substitution.getFeature('liga', script, options.language)); }
        if (options.features.rlig) { manyToOne = manyToOne.concat(this.substitution.getFeature('rlig', script, options.language)); }
        for (var i$1 = 0; i$1 < length; i$1 += 1) {
            for (var j = 0; j < manyToOne.length; j++) {
                var ligature = manyToOne[j];
                var components = ligature.sub;
                var compCount = components.length;
                var k = 0;
                while (k < compCount && components[k] === indexes[i$1 + k]) { k++; }
                if (k === compCount) {
                    indexes.splice(i$1, compCount, ligature.by);
                    length = length - compCount + 1;
                }
            }
        }
    }

    // convert glyph indexes to glyph objects
    var glyphs = new Array(length);
    var notdef = this.glyphs.get(0);
    for (var i$2 = 0; i$2 < length; i$2 += 1) {
        glyphs[i$2] = this$1.glyphs.get(indexes[i$2]) || notdef;
    }
    return glyphs;
};

/**
 * @param  {string}
 * @return {Number}
 */
Font.prototype.nameToGlyphIndex = function(name) {
    return this.glyphNames.nameToGlyphIndex(name);
};

/**
 * @param  {string}
 * @return {opentype.Glyph}
 */
Font.prototype.nameToGlyph = function(name) {
    var glyphIndex = this.nameToGlyphIndex(name);
    var glyph = this.glyphs.get(glyphIndex);
    if (!glyph) {
        // .notdef
        glyph = this.glyphs.get(0);
    }

    return glyph;
};

/**
 * @param  {Number}
 * @return {String}
 */
Font.prototype.glyphIndexToName = function(gid) {
    if (!this.glyphNames.glyphIndexToName) {
        return '';
    }

    return this.glyphNames.glyphIndexToName(gid);
};

/**
 * Retrieve the value of the kerning pair between the left glyph (or its index)
 * and the right glyph (or its index). If no kerning pair is found, return 0.
 * The kerning value gets added to the advance width when calculating the spacing
 * between glyphs.
 * @param  {opentype.Glyph} leftGlyph
 * @param  {opentype.Glyph} rightGlyph
 * @return {Number}
 */
Font.prototype.getKerningValue = function(leftGlyph, rightGlyph) {
    leftGlyph = leftGlyph.index || leftGlyph;
    rightGlyph = rightGlyph.index || rightGlyph;
    var gposKerning = this.getGposKerningValue;
    return gposKerning ? gposKerning(leftGlyph, rightGlyph) :
        (this.kerningPairs[leftGlyph + ',' + rightGlyph] || 0);
};

/**
 * @typedef GlyphRenderOptions
 * @type Object
 * @property {string} [script] - script used to determine which features to apply. By default, 'DFLT' or 'latn' is used.
 *                               See https://www.microsoft.com/typography/otspec/scripttags.htm
 * @property {string} [language='dflt'] - language system used to determine which features to apply.
 *                                        See https://www.microsoft.com/typography/developers/opentype/languagetags.aspx
 * @property {boolean} [kerning=true] - whether to include kerning values
 * @property {object} [features] - OpenType Layout feature tags. Used to enable or disable the features of the given script/language system.
 *                                 See https://www.microsoft.com/typography/otspec/featuretags.htm
 */
Font.prototype.defaultRenderOptions = {
    kerning: true,
    features: {
        liga: true,
        rlig: true
    }
};

/**
 * Helper function that invokes the given callback for each glyph in the given text.
 * The callback gets `(glyph, x, y, fontSize, options)`.* @param  {string} text
 * @param {string} text - The text to apply.
 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
 * @param  {GlyphRenderOptions=} options
 * @param  {Function} callback
 */
Font.prototype.forEachGlyph = function(text, x, y, fontSize, options, callback) {
    var this$1 = this;

    x = x !== undefined ? x : 0;
    y = y !== undefined ? y : 0;
    fontSize = fontSize !== undefined ? fontSize : 72;
    options = options || this.defaultRenderOptions;
    var fontScale = 1 / this.unitsPerEm * fontSize;
    var glyphs = this.stringToGlyphs(text, options);
    for (var i = 0; i < glyphs.length; i += 1) {
        var glyph = glyphs[i];
        callback.call(this$1, glyph, x, y, fontSize, options);
        if (glyph.advanceWidth) {
            x += glyph.advanceWidth * fontScale;
        }

        if (options.kerning && i < glyphs.length - 1) {
            var kerningValue = this$1.getKerningValue(glyph, glyphs[i + 1]);
            x += kerningValue * fontScale;
        }

        if (options.letterSpacing) {
            x += options.letterSpacing * fontSize;
        } else if (options.tracking) {
            x += (options.tracking / 1000) * fontSize;
        }
    }
    return x;
};

/**
 * Create a Path object that represents the given text.
 * @param  {string} text - The text to create.
 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
 * @param  {GlyphRenderOptions=} options
 * @return {opentype.Path}
 */
Font.prototype.getPath = function(text, x, y, fontSize, options) {
    var fullPath = new Path();
    this.forEachGlyph(text, x, y, fontSize, options, function(glyph, gX, gY, gFontSize) {
        var glyphPath = glyph.getPath(gX, gY, gFontSize, options, this);
        fullPath.extend(glyphPath);
    });
    return fullPath;
};

/**
 * Create an array of Path objects that represent the glyphs of a given text.
 * @param  {string} text - The text to create.
 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
 * @param  {GlyphRenderOptions=} options
 * @return {opentype.Path[]}
 */
Font.prototype.getPaths = function(text, x, y, fontSize, options) {
    var glyphPaths = [];
    this.forEachGlyph(text, x, y, fontSize, options, function(glyph, gX, gY, gFontSize) {
        var glyphPath = glyph.getPath(gX, gY, gFontSize, options, this);
        glyphPaths.push(glyphPath);
    });

    return glyphPaths;
};

/**
 * Returns the advance width of a text.
 *
 * This is something different than Path.getBoundingBox() as for example a
 * suffixed whitespace increases the advanceWidth but not the bounding box
 * or an overhanging letter like a calligraphic 'f' might have a quite larger
 * bounding box than its advance width.
 *
 * This corresponds to canvas2dContext.measureText(text).width
 *
 * @param  {string} text - The text to create.
 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
 * @param  {GlyphRenderOptions=} options
 * @return advance width
 */
Font.prototype.getAdvanceWidth = function(text, fontSize, options) {
    return this.forEachGlyph(text, 0, 0, fontSize, options, function() {});
};

/**
 * Draw the text on the given drawing context.
 * @param  {CanvasRenderingContext2D} ctx - A 2D drawing context, like Canvas.
 * @param  {string} text - The text to create.
 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
 * @param  {GlyphRenderOptions=} options
 */
Font.prototype.draw = function(ctx, text, x, y, fontSize, options) {
    this.getPath(text, x, y, fontSize, options).draw(ctx);
};

/**
 * Draw the points of all glyphs in the text.
 * On-curve points will be drawn in blue, off-curve points will be drawn in red.
 * @param {CanvasRenderingContext2D} ctx - A 2D drawing context, like Canvas.
 * @param {string} text - The text to create.
 * @param {number} [x=0] - Horizontal position of the beginning of the text.
 * @param {number} [y=0] - Vertical position of the *baseline* of the text.
 * @param {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
 * @param {GlyphRenderOptions=} options
 */
Font.prototype.drawPoints = function(ctx, text, x, y, fontSize, options) {
    this.forEachGlyph(text, x, y, fontSize, options, function(glyph, gX, gY, gFontSize) {
        glyph.drawPoints(ctx, gX, gY, gFontSize);
    });
};

/**
 * Draw lines indicating important font measurements for all glyphs in the text.
 * Black lines indicate the origin of the coordinate system (point 0,0).
 * Blue lines indicate the glyph bounding box.
 * Green line indicates the advance width of the glyph.
 * @param {CanvasRenderingContext2D} ctx - A 2D drawing context, like Canvas.
 * @param {string} text - The text to create.
 * @param {number} [x=0] - Horizontal position of the beginning of the text.
 * @param {number} [y=0] - Vertical position of the *baseline* of the text.
 * @param {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
 * @param {GlyphRenderOptions=} options
 */
Font.prototype.drawMetrics = function(ctx, text, x, y, fontSize, options) {
    this.forEachGlyph(text, x, y, fontSize, options, function(glyph, gX, gY, gFontSize) {
        glyph.drawMetrics(ctx, gX, gY, gFontSize);
    });
};

/**
 * @param  {string}
 * @return {string}
 */
Font.prototype.getEnglishName = function(name) {
    var translations = this.names[name];
    if (translations) {
        return translations.en;
    }
};

/**
 * Validate
 */
Font.prototype.validate = function() {
    var warnings = [];
    var _this = this;

    function assert(predicate, message) {
        if (!predicate) {
            warnings.push(message);
        }
    }

    function assertNamePresent(name) {
        var englishName = _this.getEnglishName(name);
        assert(englishName && englishName.trim().length > 0,
               'No English ' + name + ' specified.');
    }

    // Identification information
    assertNamePresent('fontFamily');
    assertNamePresent('weightName');
    assertNamePresent('manufacturer');
    assertNamePresent('copyright');
    assertNamePresent('version');

    // Dimension information
    assert(this.unitsPerEm > 0, 'No unitsPerEm specified.');
};

/**
 * Convert the font object to a SFNT data structure.
 * This structure contains all the necessary tables and metadata to create a binary OTF file.
 * @return {opentype.Table}
 */
Font.prototype.toTables = function() {
    return sfnt.fontToTable(this);
};
/**
 * @deprecated Font.toBuffer is deprecated. Use Font.toArrayBuffer instead.
 */
Font.prototype.toBuffer = function() {
    console.warn('Font.toBuffer is deprecated. Use Font.toArrayBuffer instead.');
    return this.toArrayBuffer();
};
/**
 * Converts a `opentype.Font` into an `ArrayBuffer`
 * @return {ArrayBuffer}
 */
Font.prototype.toArrayBuffer = function() {
    var sfntTable = this.toTables();
    var bytes = sfntTable.encode();
    var buffer = new ArrayBuffer(bytes.length);
    var intArray = new Uint8Array(buffer);
    for (var i = 0; i < bytes.length; i++) {
        intArray[i] = bytes[i];
    }

    return buffer;
};

/**
 * Initiate a download of the OpenType font.
 */
Font.prototype.download = function(fileName) {
    var familyName = this.getEnglishName('fontFamily');
    var styleName = this.getEnglishName('fontSubfamily');
    fileName = fileName || familyName.replace(/\s/g, '') + '-' + styleName + '.otf';
    var arrayBuffer = this.toArrayBuffer();

    if (isBrowser()) {
        window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
        window.requestFileSystem(window.TEMPORARY, arrayBuffer.byteLength, function(fs) {
            fs.root.getFile(fileName, {create: true}, function(fileEntry) {
                fileEntry.createWriter(function(writer) {
                    var dataView = new DataView(arrayBuffer);
                    var blob = new Blob([dataView], {type: 'font/opentype'});
                    writer.write(blob);

                    writer.addEventListener('writeend', function() {
                        // Navigating to the file will download it.
                        location.href = fileEntry.toURL();
                    }, false);
                });
            });
        },
        function(err) {
            throw new Error(err.name + ': ' + err.message);
        });
    } else {
        var fs = require('fs');
        var buffer = arrayBufferToNodeBuffer(arrayBuffer);
        fs.writeFileSync(fileName, buffer);
    }
};
/**
 * @private
 */
Font.prototype.fsSelectionValues = {
    ITALIC:              0x001, //1
    UNDERSCORE:          0x002, //2
    NEGATIVE:            0x004, //4
    OUTLINED:            0x008, //8
    STRIKEOUT:           0x010, //16
    BOLD:                0x020, //32
    REGULAR:             0x040, //64
    USER_TYPO_METRICS:   0x080, //128
    WWS:                 0x100, //256
    OBLIQUE:             0x200  //512
};

/**
 * @private
 */
Font.prototype.usWidthClasses = {
    ULTRA_CONDENSED: 1,
    EXTRA_CONDENSED: 2,
    CONDENSED: 3,
    SEMI_CONDENSED: 4,
    MEDIUM: 5,
    SEMI_EXPANDED: 6,
    EXPANDED: 7,
    EXTRA_EXPANDED: 8,
    ULTRA_EXPANDED: 9
};

/**
 * @private
 */
Font.prototype.usWeightClasses = {
    THIN: 100,
    EXTRA_LIGHT: 200,
    LIGHT: 300,
    NORMAL: 400,
    MEDIUM: 500,
    SEMI_BOLD: 600,
    BOLD: 700,
    EXTRA_BOLD: 800,
    BLACK:    900
};

// The `fvar` table stores font variation axes and instances.
// https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6fvar.html

function addName(name, names) {
    var nameString = JSON.stringify(name);
    var nameID = 256;
    for (var nameKey in names) {
        var n = parseInt(nameKey);
        if (!n || n < 256) {
            continue;
        }

        if (JSON.stringify(names[nameKey]) === nameString) {
            return n;
        }

        if (nameID <= n) {
            nameID = n + 1;
        }
    }

    names[nameID] = name;
    return nameID;
}

function makeFvarAxis(n, axis, names) {
    var nameID = addName(axis.name, names);
    return [
        {name: 'tag_' + n, type: 'TAG', value: axis.tag},
        {name: 'minValue_' + n, type: 'FIXED', value: axis.minValue << 16},
        {name: 'defaultValue_' + n, type: 'FIXED', value: axis.defaultValue << 16},
        {name: 'maxValue_' + n, type: 'FIXED', value: axis.maxValue << 16},
        {name: 'flags_' + n, type: 'USHORT', value: 0},
        {name: 'nameID_' + n, type: 'USHORT', value: nameID}
    ];
}

function parseFvarAxis(data, start, names) {
    var axis = {};
    var p = new parse.Parser(data, start);
    axis.tag = p.parseTag();
    axis.minValue = p.parseFixed();
    axis.defaultValue = p.parseFixed();
    axis.maxValue = p.parseFixed();
    p.skip('uShort', 1);  // reserved for flags; no values defined
    axis.name = names[p.parseUShort()] || {};
    return axis;
}

function makeFvarInstance(n, inst, axes, names) {
    var nameID = addName(inst.name, names);
    var fields = [
        {name: 'nameID_' + n, type: 'USHORT', value: nameID},
        {name: 'flags_' + n, type: 'USHORT', value: 0}
    ];

    for (var i = 0; i < axes.length; ++i) {
        var axisTag = axes[i].tag;
        fields.push({
            name: 'axis_' + n + ' ' + axisTag,
            type: 'FIXED',
            value: inst.coordinates[axisTag] << 16
        });
    }

    return fields;
}

function parseFvarInstance(data, start, axes, names) {
    var inst = {};
    var p = new parse.Parser(data, start);
    inst.name = names[p.parseUShort()] || {};
    p.skip('uShort', 1);  // reserved for flags; no values defined

    inst.coordinates = {};
    for (var i = 0; i < axes.length; ++i) {
        inst.coordinates[axes[i].tag] = p.parseFixed();
    }

    return inst;
}

function makeFvarTable(fvar, names) {
    var result = new table.Table('fvar', [
        {name: 'version', type: 'ULONG', value: 0x10000},
        {name: 'offsetToData', type: 'USHORT', value: 0},
        {name: 'countSizePairs', type: 'USHORT', value: 2},
        {name: 'axisCount', type: 'USHORT', value: fvar.axes.length},
        {name: 'axisSize', type: 'USHORT', value: 20},
        {name: 'instanceCount', type: 'USHORT', value: fvar.instances.length},
        {name: 'instanceSize', type: 'USHORT', value: 4 + fvar.axes.length * 4}
    ]);
    result.offsetToData = result.sizeOf();

    for (var i = 0; i < fvar.axes.length; i++) {
        result.fields = result.fields.concat(makeFvarAxis(i, fvar.axes[i], names));
    }

    for (var j = 0; j < fvar.instances.length; j++) {
        result.fields = result.fields.concat(makeFvarInstance(j, fvar.instances[j], fvar.axes, names));
    }

    return result;
}

function parseFvarTable(data, start, names) {
    var p = new parse.Parser(data, start);
    var tableVersion = p.parseULong();
    check.argument(tableVersion === 0x00010000, 'Unsupported fvar table version.');
    var offsetToData = p.parseOffset16();
    // Skip countSizePairs.
    p.skip('uShort', 1);
    var axisCount = p.parseUShort();
    var axisSize = p.parseUShort();
    var instanceCount = p.parseUShort();
    var instanceSize = p.parseUShort();

    var axes = [];
    for (var i = 0; i < axisCount; i++) {
        axes.push(parseFvarAxis(data, start + offsetToData + i * axisSize, names));
    }

    var instances = [];
    var instanceStart = start + offsetToData + axisCount * axisSize;
    for (var j = 0; j < instanceCount; j++) {
        instances.push(parseFvarInstance(data, instanceStart + j * instanceSize, axes, names));
    }

    return {axes: axes, instances: instances};
}

var fvar = { make: makeFvarTable, parse: parseFvarTable };

// The `GPOS` table contains kerning pairs, among other things.
// https://www.microsoft.com/typography/OTSPEC/gpos.htm

// Parse ScriptList and FeatureList tables of GPOS, GSUB, GDEF, BASE, JSTF tables.
// These lists are unused by now, this function is just the basis for a real parsing.
function parseTaggedListTable(data, start) {
    var p = new parse.Parser(data, start);
    var n = p.parseUShort();
    var list = [];
    for (var i = 0; i < n; i++) {
        list[p.parseTag()] = { offset: p.parseUShort() };
    }

    return list;
}

// Parse a coverage table in a GSUB, GPOS or GDEF table.
// Format 1 is a simple list of glyph ids,
// Format 2 is a list of ranges. It is expanded in a list of glyphs, maybe not the best idea.
function parseCoverageTable(data, start) {
    var p = new parse.Parser(data, start);
    var format = p.parseUShort();
    var count = p.parseUShort();
    if (format === 1) {
        return p.parseUShortList(count);
    } else if (format === 2) {
        var coverage = [];
        for (; count--;) {
            var begin = p.parseUShort();
            var end = p.parseUShort();
            var index = p.parseUShort();
            for (var i = begin; i <= end; i++) {
                coverage[index++] = i;
            }
        }

        return coverage;
    }
}

// Parse a Class Definition Table in a GSUB, GPOS or GDEF table.
// Returns a function that gets a class value from a glyph ID.
function parseClassDefTable(data, start) {
    var p = new parse.Parser(data, start);
    var format = p.parseUShort();
    if (format === 1) {
        // Format 1 specifies a range of consecutive glyph indices, one class per glyph ID.
        var startGlyph = p.parseUShort();
        var glyphCount = p.parseUShort();
        var classes = p.parseUShortList(glyphCount);
        return function(glyphID) {
            return classes[glyphID - startGlyph] || 0;
        };
    } else if (format === 2) {
        // Format 2 defines multiple groups of glyph indices that belong to the same class.
        var rangeCount = p.parseUShort();
        var startGlyphs = [];
        var endGlyphs = [];
        var classValues = [];
        for (var i = 0; i < rangeCount; i++) {
            startGlyphs[i] = p.parseUShort();
            endGlyphs[i] = p.parseUShort();
            classValues[i] = p.parseUShort();
        }

        return function(glyphID) {
            var l = 0;
            var r = startGlyphs.length - 1;
            while (l < r) {
                var c = (l + r + 1) >> 1;
                if (glyphID < startGlyphs[c]) {
                    r = c - 1;
                } else {
                    l = c;
                }
            }

            if (startGlyphs[l] <= glyphID && glyphID <= endGlyphs[l]) {
                return classValues[l] || 0;
            }

            return 0;
        };
    }
}

// Parse a pair adjustment positioning subtable, format 1 or format 2
// The subtable is returned in the form of a lookup function.
function parsePairPosSubTable(data, start) {
    var p = new parse.Parser(data, start);
    // This part is common to format 1 and format 2 subtables
    var format = p.parseUShort();
    var coverageOffset = p.parseUShort();
    var coverage = parseCoverageTable(data, start + coverageOffset);
    // valueFormat 4: XAdvance only, 1: XPlacement only, 0: no ValueRecord for second glyph
    // Only valueFormat1=4 and valueFormat2=0 is supported.
    var valueFormat1 = p.parseUShort();
    var valueFormat2 = p.parseUShort();
    var value1;
    var value2;
    if (valueFormat1 !== 4 || valueFormat2 !== 0) { return; }
    var sharedPairSets = {};
    if (format === 1) {
        // Pair Positioning Adjustment: Format 1
        var pairSetCount = p.parseUShort();
        var pairSet = [];
        // Array of offsets to PairSet tables-from beginning of PairPos subtable-ordered by Coverage Index
        var pairSetOffsets = p.parseOffset16List(pairSetCount);
        for (var firstGlyph = 0; firstGlyph < pairSetCount; firstGlyph++) {
            var pairSetOffset = pairSetOffsets[firstGlyph];
            var sharedPairSet = sharedPairSets[pairSetOffset];
            if (!sharedPairSet) {
                // Parse a pairset table in a pair adjustment subtable format 1
                sharedPairSet = {};
                p.relativeOffset = pairSetOffset;
                var pairValueCount = p.parseUShort();
                for (; pairValueCount--;) {
                    var secondGlyph = p.parseUShort();
                    if (valueFormat1) { value1 = p.parseShort(); }
                    if (valueFormat2) { value2 = p.parseShort(); }
                    // We only support valueFormat1 = 4 and valueFormat2 = 0,
                    // so value1 is the XAdvance and value2 is empty.
                    sharedPairSet[secondGlyph] = value1;
                }
            }

            pairSet[coverage[firstGlyph]] = sharedPairSet;
        }

        return function(leftGlyph, rightGlyph) {
            var pairs = pairSet[leftGlyph];
            if (pairs) { return pairs[rightGlyph]; }
        };
    } else if (format === 2) {
        // Pair Positioning Adjustment: Format 2
        var classDef1Offset = p.parseUShort();
        var classDef2Offset = p.parseUShort();
        var class1Count = p.parseUShort();
        var class2Count = p.parseUShort();
        var getClass1 = parseClassDefTable(data, start + classDef1Offset);
        var getClass2 = parseClassDefTable(data, start + classDef2Offset);

        // Parse kerning values by class pair.
        var kerningMatrix = [];
        for (var i = 0; i < class1Count; i++) {
            var kerningRow = kerningMatrix[i] = [];
            for (var j = 0; j < class2Count; j++) {
                if (valueFormat1) { value1 = p.parseShort(); }
                if (valueFormat2) { value2 = p.parseShort(); }
                // We only support valueFormat1 = 4 and valueFormat2 = 0,
                // so value1 is the XAdvance and value2 is empty.
                kerningRow[j] = value1;
            }
        }

        // Convert coverage list to a hash
        var covered = {};
        for (var i$1 = 0; i$1 < coverage.length; i$1++) {
            covered[coverage[i$1]] = 1;
        }

        // Get the kerning value for a specific glyph pair.
        return function(leftGlyph, rightGlyph) {
            if (!covered[leftGlyph]) { return; }
            var class1 = getClass1(leftGlyph);
            var class2 = getClass2(rightGlyph);
            var kerningRow = kerningMatrix[class1];

            if (kerningRow) {
                return kerningRow[class2];
            }
        };
    }
}

// Parse a LookupTable (present in of GPOS, GSUB, GDEF, BASE, JSTF tables).
function parseLookupTable(data, start) {
    var p = new parse.Parser(data, start);
    var lookupType = p.parseUShort();
    var lookupFlag = p.parseUShort();
    var useMarkFilteringSet = lookupFlag & 0x10;
    var subTableCount = p.parseUShort();
    var subTableOffsets = p.parseOffset16List(subTableCount);
    var table = {
        lookupType: lookupType,
        lookupFlag: lookupFlag,
        markFilteringSet: useMarkFilteringSet ? p.parseUShort() : -1
    };
    // LookupType 2, Pair adjustment
    if (lookupType === 2) {
        var subtables = [];
        for (var i = 0; i < subTableCount; i++) {
            var pairPosSubTable = parsePairPosSubTable(data, start + subTableOffsets[i]);
            if (pairPosSubTable) { subtables.push(pairPosSubTable); }
        }
        // Return a function which finds the kerning values in the subtables.
        table.getKerningValue = function(leftGlyph, rightGlyph) {
            for (var i = subtables.length; i--;) {
                var value = subtables[i](leftGlyph, rightGlyph);
                if (value !== undefined) { return value; }
            }

            return 0;
        };
    }

    return table;
}

// Parse the `GPOS` table which contains, among other things, kerning pairs.
// https://www.microsoft.com/typography/OTSPEC/gpos.htm
function parseGposTable(data, start, font) {
    var p = new parse.Parser(data, start);
    var tableVersion = p.parseFixed();
    check.argument(tableVersion === 1, 'Unsupported GPOS table version.');

    // ScriptList and FeatureList - ignored for now
    parseTaggedListTable(data, start + p.parseUShort());
    // 'kern' is the feature we are looking for.
    parseTaggedListTable(data, start + p.parseUShort());

    // LookupList
    var lookupListOffset = p.parseUShort();
    p.relativeOffset = lookupListOffset;
    var lookupCount = p.parseUShort();
    var lookupTableOffsets = p.parseOffset16List(lookupCount);
    var lookupListAbsoluteOffset = start + lookupListOffset;
    for (var i = 0; i < lookupCount; i++) {
        var table = parseLookupTable(data, lookupListAbsoluteOffset + lookupTableOffsets[i]);
        if (table.lookupType === 2 && !font.getGposKerningValue) { font.getGposKerningValue = table.getKerningValue; }
    }
}

var gpos = { parse: parseGposTable };

// The `kern` table contains kerning pairs.
// Note that some fonts use the GPOS OpenType layout table to specify kerning.
// https://www.microsoft.com/typography/OTSPEC/kern.htm

function parseWindowsKernTable(p) {
    var pairs = {};
    // Skip nTables.
    p.skip('uShort');
    var subtableVersion = p.parseUShort();
    check.argument(subtableVersion === 0, 'Unsupported kern sub-table version.');
    // Skip subtableLength, subtableCoverage
    p.skip('uShort', 2);
    var nPairs = p.parseUShort();
    // Skip searchRange, entrySelector, rangeShift.
    p.skip('uShort', 3);
    for (var i = 0; i < nPairs; i += 1) {
        var leftIndex = p.parseUShort();
        var rightIndex = p.parseUShort();
        var value = p.parseShort();
        pairs[leftIndex + ',' + rightIndex] = value;
    }
    return pairs;
}

function parseMacKernTable(p) {
    var pairs = {};
    // The Mac kern table stores the version as a fixed (32 bits) but we only loaded the first 16 bits.
    // Skip the rest.
    p.skip('uShort');
    var nTables = p.parseULong();
    //check.argument(nTables === 1, 'Only 1 subtable is supported (got ' + nTables + ').');
    if (nTables > 1) {
        console.warn('Only the first kern subtable is supported.');
    }
    p.skip('uLong');
    var coverage = p.parseUShort();
    var subtableVersion = coverage & 0xFF;
    p.skip('uShort');
    if (subtableVersion === 0) {
        var nPairs = p.parseUShort();
        // Skip searchRange, entrySelector, rangeShift.
        p.skip('uShort', 3);
        for (var i = 0; i < nPairs; i += 1) {
            var leftIndex = p.parseUShort();
            var rightIndex = p.parseUShort();
            var value = p.parseShort();
            pairs[leftIndex + ',' + rightIndex] = value;
        }
    }
    return pairs;
}

// Parse the `kern` table which contains kerning pairs.
function parseKernTable(data, start) {
    var p = new parse.Parser(data, start);
    var tableVersion = p.parseUShort();
    if (tableVersion === 0) {
        return parseWindowsKernTable(p);
    } else if (tableVersion === 1) {
        return parseMacKernTable(p);
    } else {
        throw new Error('Unsupported kern table version (' + tableVersion + ').');
    }
}

var kern = { parse: parseKernTable };

// The `loca` table stores the offsets to the locations of the glyphs in the font.
// https://www.microsoft.com/typography/OTSPEC/loca.htm

// Parse the `loca` table. This table stores the offsets to the locations of the glyphs in the font,
// relative to the beginning of the glyphData table.
// The number of glyphs stored in the `loca` table is specified in the `maxp` table (under numGlyphs)
// The loca table has two versions: a short version where offsets are stored as uShorts, and a long
// version where offsets are stored as uLongs. The `head` table specifies which version to use
// (under indexToLocFormat).
function parseLocaTable(data, start, numGlyphs, shortVersion) {
    var p = new parse.Parser(data, start);
    var parseFn = shortVersion ? p.parseUShort : p.parseULong;
    // There is an extra entry after the last index element to compute the length of the last glyph.
    // That's why we use numGlyphs + 1.
    var glyphOffsets = [];
    for (var i = 0; i < numGlyphs + 1; i += 1) {
        var glyphOffset = parseFn.call(p);
        if (shortVersion) {
            // The short table version stores the actual offset divided by 2.
            glyphOffset *= 2;
        }

        glyphOffsets.push(glyphOffset);
    }

    return glyphOffsets;
}

var loca = { parse: parseLocaTable };

// opentype.js
// https://github.com/nodebox/opentype.js
// (c) 2015 Frederik De Bleser
// opentype.js may be freely distributed under the MIT license.

/* global DataView, Uint8Array, XMLHttpRequest  */

/**
 * The opentype library.
 * @namespace opentype
 */

// File loaders /////////////////////////////////////////////////////////
/**
 * Loads a font from a file. The callback throws an error message as the first parameter if it fails
 * and the font as an ArrayBuffer in the second parameter if it succeeds.
 * @param  {string} path - The path of the file
 * @param  {Function} callback - The function to call when the font load completes
 */
function loadFromFile(path, callback) {
    var fs = require('fs');
    fs.readFile(path, function(err, buffer) {
        if (err) {
            return callback(err.message);
        }

        callback(null, nodeBufferToArrayBuffer(buffer));
    });
}
/**
 * Loads a font from a URL. The callback throws an error message as the first parameter if it fails
 * and the font as an ArrayBuffer in the second parameter if it succeeds.
 * @param  {string} url - The URL of the font file.
 * @param  {Function} callback - The function to call when the font load completes
 */
function loadFromUrl(url, callback) {
    var request = new XMLHttpRequest();
    request.open('get', url, true);
    request.responseType = 'arraybuffer';
    request.onload = function() {
        if (request.status !== 200) {
            return callback('Font could not be loaded: ' + request.statusText);
        }

        return callback(null, request.response);
    };

    request.onerror = function () {
        callback('Font could not be loaded');
    };

    request.send();
}

// Table Directory Entries //////////////////////////////////////////////
/**
 * Parses OpenType table entries.
 * @param  {DataView}
 * @param  {Number}
 * @return {Object[]}
 */
function parseOpenTypeTableEntries(data, numTables) {
    var tableEntries = [];
    var p = 12;
    for (var i = 0; i < numTables; i += 1) {
        var tag = parse.getTag(data, p);
        var checksum = parse.getULong(data, p + 4);
        var offset = parse.getULong(data, p + 8);
        var length = parse.getULong(data, p + 12);
        tableEntries.push({tag: tag, checksum: checksum, offset: offset, length: length, compression: false});
        p += 16;
    }

    return tableEntries;
}

/**
 * Parses WOFF table entries.
 * @param  {DataView}
 * @param  {Number}
 * @return {Object[]}
 */
function parseWOFFTableEntries(data, numTables) {
    var tableEntries = [];
    var p = 44; // offset to the first table directory entry.
    for (var i = 0; i < numTables; i += 1) {
        var tag = parse.getTag(data, p);
        var offset = parse.getULong(data, p + 4);
        var compLength = parse.getULong(data, p + 8);
        var origLength = parse.getULong(data, p + 12);
        var compression = (void 0);
        if (compLength < origLength) {
            compression = 'WOFF';
        } else {
            compression = false;
        }

        tableEntries.push({tag: tag, offset: offset, compression: compression,
            compressedLength: compLength, length: origLength});
        p += 20;
    }

    return tableEntries;
}

/**
 * @typedef TableData
 * @type Object
 * @property {DataView} data - The DataView
 * @property {number} offset - The data offset.
 */

/**
 * @param  {DataView}
 * @param  {Object}
 * @return {TableData}
 */
function uncompressTable(data, tableEntry) {
    if (tableEntry.compression === 'WOFF') {
        var inBuffer = new Uint8Array(data.buffer, tableEntry.offset + 2, tableEntry.compressedLength - 2);
        var outBuffer = new Uint8Array(tableEntry.length);
        index(inBuffer, outBuffer);
        if (outBuffer.byteLength !== tableEntry.length) {
            throw new Error('Decompression error: ' + tableEntry.tag + ' decompressed length doesn\'t match recorded length');
        }

        var view = new DataView(outBuffer.buffer, 0);
        return {data: view, offset: 0};
    } else {
        return {data: data, offset: tableEntry.offset};
    }
}

// Public API ///////////////////////////////////////////////////////////

/**
 * Parse the OpenType file data (as an ArrayBuffer) and return a Font object.
 * Throws an error if the font could not be parsed.
 * @param  {ArrayBuffer}
 * @return {opentype.Font}
 */
function parseBuffer(buffer) {
    var indexToLocFormat;
    var ltagTable;

    // Since the constructor can also be called to create new fonts from scratch, we indicate this
    // should be an empty font that we'll fill with our own data.
    var font = new Font({empty: true});

    // OpenType fonts use big endian byte ordering.
    // We can't rely on typed array view types, because they operate with the endianness of the host computer.
    // Instead we use DataViews where we can specify endianness.
    var data = new DataView(buffer, 0);
    var numTables;
    var tableEntries = [];
    var signature = parse.getTag(data, 0);
    if (signature === String.fromCharCode(0, 1, 0, 0) || signature === 'true' || signature === 'typ1') {
        font.outlinesFormat = 'truetype';
        numTables = parse.getUShort(data, 4);
        tableEntries = parseOpenTypeTableEntries(data, numTables);
    } else if (signature === 'OTTO') {
        font.outlinesFormat = 'cff';
        numTables = parse.getUShort(data, 4);
        tableEntries = parseOpenTypeTableEntries(data, numTables);
    } else if (signature === 'wOFF') {
        var flavor = parse.getTag(data, 4);
        if (flavor === String.fromCharCode(0, 1, 0, 0)) {
            font.outlinesFormat = 'truetype';
        } else if (flavor === 'OTTO') {
            font.outlinesFormat = 'cff';
        } else {
            throw new Error('Unsupported OpenType flavor ' + signature);
        }

        numTables = parse.getUShort(data, 12);
        tableEntries = parseWOFFTableEntries(data, numTables);
    } else {
        throw new Error('Unsupported OpenType signature ' + signature);
    }

    var cffTableEntry;
    var fvarTableEntry;
    var glyfTableEntry;
    var gposTableEntry;
    var gsubTableEntry;
    var hmtxTableEntry;
    var kernTableEntry;
    var locaTableEntry;
    var nameTableEntry;
    var metaTableEntry;
    var p;

    for (var i = 0; i < numTables; i += 1) {
        var tableEntry = tableEntries[i];
        var table = (void 0);
        switch (tableEntry.tag) {
            case 'cmap':
                table = uncompressTable(data, tableEntry);
                font.tables.cmap = cmap.parse(table.data, table.offset);
                font.encoding = new CmapEncoding(font.tables.cmap);
                break;
            case 'cvt ' :
                table = uncompressTable(data, tableEntry);
                p = new parse.Parser(table.data, table.offset);
                font.tables.cvt = p.parseShortList(tableEntry.length / 2);
                break;
            case 'fvar':
                fvarTableEntry = tableEntry;
                break;
            case 'fpgm' :
                table = uncompressTable(data, tableEntry);
                p = new parse.Parser(table.data, table.offset);
                font.tables.fpgm = p.parseByteList(tableEntry.length);
                break;
            case 'head':
                table = uncompressTable(data, tableEntry);
                font.tables.head = head.parse(table.data, table.offset);
                font.unitsPerEm = font.tables.head.unitsPerEm;
                indexToLocFormat = font.tables.head.indexToLocFormat;
                break;
            case 'hhea':
                table = uncompressTable(data, tableEntry);
                font.tables.hhea = hhea.parse(table.data, table.offset);
                font.ascender = font.tables.hhea.ascender;
                font.descender = font.tables.hhea.descender;
                font.numberOfHMetrics = font.tables.hhea.numberOfHMetrics;
                break;
            case 'hmtx':
                hmtxTableEntry = tableEntry;
                break;
            case 'ltag':
                table = uncompressTable(data, tableEntry);
                ltagTable = ltag.parse(table.data, table.offset);
                break;
            case 'maxp':
                table = uncompressTable(data, tableEntry);
                font.tables.maxp = maxp.parse(table.data, table.offset);
                font.numGlyphs = font.tables.maxp.numGlyphs;
                break;
            case 'name':
                nameTableEntry = tableEntry;
                break;
            case 'OS/2':
                table = uncompressTable(data, tableEntry);
                font.tables.os2 = os2.parse(table.data, table.offset);
                break;
            case 'post':
                table = uncompressTable(data, tableEntry);
                font.tables.post = post.parse(table.data, table.offset);
                font.glyphNames = new GlyphNames(font.tables.post);
                break;
            case 'prep' :
                table = uncompressTable(data, tableEntry);
                p = new parse.Parser(table.data, table.offset);
                font.tables.prep = p.parseByteList(tableEntry.length);
                break;
            case 'glyf':
                glyfTableEntry = tableEntry;
                break;
            case 'loca':
                locaTableEntry = tableEntry;
                break;
            case 'CFF ':
                cffTableEntry = tableEntry;
                break;
            case 'kern':
                kernTableEntry = tableEntry;
                break;
            case 'GPOS':
                gposTableEntry = tableEntry;
                break;
            case 'GSUB':
                gsubTableEntry = tableEntry;
                break;
            case 'meta':
                metaTableEntry = tableEntry;
                break;
        }
    }

    var nameTable = uncompressTable(data, nameTableEntry);
    font.tables.name = _name.parse(nameTable.data, nameTable.offset, ltagTable);
    font.names = font.tables.name;

    if (glyfTableEntry && locaTableEntry) {
        var shortVersion = indexToLocFormat === 0;
        var locaTable = uncompressTable(data, locaTableEntry);
        var locaOffsets = loca.parse(locaTable.data, locaTable.offset, font.numGlyphs, shortVersion);
        var glyfTable = uncompressTable(data, glyfTableEntry);
        font.glyphs = glyf.parse(glyfTable.data, glyfTable.offset, locaOffsets, font);
    } else if (cffTableEntry) {
        var cffTable = uncompressTable(data, cffTableEntry);
        cff.parse(cffTable.data, cffTable.offset, font);
    } else {
        throw new Error('Font doesn\'t contain TrueType or CFF outlines.');
    }

    var hmtxTable = uncompressTable(data, hmtxTableEntry);
    hmtx.parse(hmtxTable.data, hmtxTable.offset, font.numberOfHMetrics, font.numGlyphs, font.glyphs);
    addGlyphNames(font);

    if (kernTableEntry) {
        var kernTable = uncompressTable(data, kernTableEntry);
        font.kerningPairs = kern.parse(kernTable.data, kernTable.offset);
    } else {
        font.kerningPairs = {};
    }

    if (gposTableEntry) {
        var gposTable = uncompressTable(data, gposTableEntry);
        gpos.parse(gposTable.data, gposTable.offset, font);
    }

    if (gsubTableEntry) {
        var gsubTable = uncompressTable(data, gsubTableEntry);
        font.tables.gsub = gsub.parse(gsubTable.data, gsubTable.offset);
    }

    if (fvarTableEntry) {
        var fvarTable = uncompressTable(data, fvarTableEntry);
        font.tables.fvar = fvar.parse(fvarTable.data, fvarTable.offset, font.names);
    }

    if (metaTableEntry) {
        var metaTable = uncompressTable(data, metaTableEntry);
        font.tables.meta = meta.parse(metaTable.data, metaTable.offset);
        font.metas = font.tables.meta;
    }

    return font;
}

/**
 * Asynchronously load the font from a URL or a filesystem. When done, call the callback
 * with two arguments `(err, font)`. The `err` will be null on success,
 * the `font` is a Font object.
 * We use the node.js callback convention so that
 * opentype.js can integrate with frameworks like async.js.
 * @alias opentype.load
 * @param  {string} url - The URL of the font to load.
 * @param  {Function} callback - The callback.
 */
function load(url, callback) {
    var isNode$$1 = typeof window === 'undefined';
    var loadFn = isNode$$1 ? loadFromFile : loadFromUrl;
    loadFn(url, function(err, arrayBuffer) {
        if (err) {
            return callback(err);
        }
        var font;
        try {
            font = parseBuffer(arrayBuffer);
        } catch (e) {
            return callback(e, null);
        }
        return callback(null, font);
    });
}

/**
 * Synchronously load the font from a URL or file.
 * When done, returns the font object or throws an error.
 * @alias opentype.loadSync
 * @param  {string} url - The URL of the font to load.
 * @return {opentype.Font}
 */
function loadSync(url) {
    var fs = require('fs');
    var buffer = fs.readFileSync(url);
    return parseBuffer(nodeBufferToArrayBuffer(buffer));
}

exports.Font = Font;
exports.Glyph = Glyph;
exports.Path = Path;
exports.BoundingBox = BoundingBox;
exports._parse = parse;
exports.parse = parseBuffer;
exports.load = load;
exports.loadSync = loadSync;

Object.defineProperty(exports, '__esModule', { value: true });

})));


}).call(this,require("buffer").Buffer)
},{"buffer":3,"fs":2}],"badgeit":[function(require,module,exports){
(function (Buffer){

const opentype = require('opentype.js');
const defaults = require('lodash.defaultsdeep');
const defaultFont = Buffer("AAEAAAATAQAABAAwRFNJR5IYdDoAA1fcAAAVdEdERUYAJgOvAANTvAAAAB5HUE9TCzcPNwADU9wAAAA4R1NVQg4rPbcAA1QUAAADxk9TLzKidaEYAAABuAAAAGBjbWFwKasvaAAAELQAAAQaY3Z0IBMtGpQAAB2oAAAAqmZwZ227c6R1AAAU0AAAB+BnYXNwAAgAGwADU7AAAAAMZ2x5Zh1/yvQAACWsAAFLxGhlYWT34ccOAAABPAAAADZoaGVhDikKUgAAAXQAAAAkaG10eCTSBgAAAAIYAAAOmmtlcm5UKwl+AAFxcAABtjZsb2NhsttgKwAAHlQAAAdWbWF4cAU1Ah8AAAGYAAAAIG5hbWW8ZnsiAAMnqAAABdxwb3N0AkPvbAADLYQAACYrcHJlcMgJ/GsAABywAAAA+AABAAAAARmaOqk5s18PPPUACQgAAAAAAMlCF6AAAAAAyehKofsM/agKjQiNAAEACQACAAAAAAAAAAEAAAiN/agAAAqN+wz+eQqNAAEAAAAAAAAAAAAAAAAAAAOjAAEAAAOqAIoAFgBYAAUAAgAQAC8AXAAAAQABCwADAAEAAwUPArwABQAIBZoFMwAAAR8FmgUzAAAD0QBmAfwIAgILCAYDBQQCAgTgAALvQAAgWwAAACgAAAAAMUFTQwAgACD//QYf/hQAhAiNAlggAAGfAAAAAAReBbYAAAAgAAMEzQDBAAAAAAQUAAACFAAAAkoAdQPHAIUFKwAtBJEAWAc1AD8GAABSAiEAhQK2AFICtgA9BFwAPwSRAFgCUgA/ApMAPQJIAHUDTgAOBJEASgSRAHkEkQBOBJEATgSRACMEkQBkBJEASASRADcEkQBIBJEAQgJIAHUCUgA/BJEAWASRAFgEkQBYA9EABgctAGYFhQAABWAAuAUZAHcF7AC4BHsAuARkALgFywB3Bh8AuAMdAEICpv9oBVAAuASFALgHiwC4BoEAuAZeAHcFBgC4Bl4AdwVIALgEaABeBKIAKQYMAK4FMwAAB7wAAAVWAAAE/gAABKIAMQKmAI8DTgAMAqYAMwRCAAgDSv/8BNsBTATVAFYFEACgBB0AXAUQAFwEugBcAxkAKQSFAAYFQgCgAnEAkwJx/30E9gCgAnEAoAfbAKAFQgCgBPQAXAUQAKAFEABcA6IAoAP6AFwDeQAvBUIAmgSNAAAG2QAUBKAACgSNAAAD5wA3AycAHwRoAccDJwBSBJEAWAIUAAACSgB1BJEAjwSRAFIEkQBxBJEABgRoAccD4wBqBNsBFwaoAGQDEAAvBOwAUgSRAFgCkwA9BqgAZAQA//oDbQBcBJEAWAMIAC8DCAA7BNsBTAVIAKAFPQBxAkgAdQGk/9sDCABcAxsAOQTsAFIHDAAuBwwALgcMAFoD0QA9BYUAAAWFAAAFhQAABYUAAAWFAAAFhQAAB54AAAUZAHcEewC4BHsAuAR7AK8EewC4Ax0AKgMdAEIDHf/cAx0AOQXsAC8GgQC4Bl4AdwZeAHcGXgB3Bl4AdwZeAHcEkQCBBl4AdwYMAK4GDACuBgwArgYMAK4E/gAABQYAuAWwAKAE1QBWBNUAVgTVAFYE1QBWBNUAVgTVAFYHVgBWBB0AXAS6AFwEugBcBLoAXAS6AFwCcf+bAnEAkQJx/4YCcf/jBPQAXAVCAKAE9ABcBPQAXAT0AFwE9ABcBPQAXASRAFgE9ABcBUIAmgVCAJoFQgCaBUIAmgSNAAAFEACgBI0AAAWFAAAE1QBWBYUAAATVAFYFhQAABNUAVgUZAHcEHQBcBRkAdwQdAFwFGQB3BB0AXAUZAHcEHQBcBewAuAUQAFwF7AAvBTEAXAR7ALgEugBcBHsAuAS6AFwEewC4BLoAXAR7ALgEugBcBHsArwS6AFwFywB3BIUABgXLAHcEhQAGBcsAdwSFAAYFywB3BIUABgYfALgFQgCgBh8AAAVCAAQDHf/xAnH/mwMdAD8Ccf/pAx0ABwJx/68DHQBCAnEAKwMdAEICcQCgBcMAQgS6AJMCpv9oAnH/fQVQALgE9gCgBPYAoASFALgCcQCgBIUAuAJxAGMEhQC4AnEAoASFALgDbQCgBIUAAgKkAAAGgQC4BUIAoAaBALgFQgCgBoEAuAVCAKAGOwAGBoEAuAVCAKAGXgB3BPQAXAZeAHcE9ABcBl4AdwT0AFwHyQB3B9MAXAVIALgDogCgBUgAuAOiAGMFSAC4A6IAUwRoAF4D+gBcBGgAXgP6AFwEaABeA/oAXARoAF4D+gBcBKIAKQN5AC8EogApA3kALwSiACkDeQAvBgwArgVCAJoGDACuBUIAmgYMAK4FQgCaBgwArgVCAJoGDACuBUIAmgYMAK4FQgCaB7wAAAbZABQE/gAABI0AAAT+AAAEogAxA+cANwSiADED5wA3BKIAMQPnADcDEACgBJEAxQWFAAAE1QBWB54AAAdWAFYGXgB3BPQAXARoAF4D+gBcBNsAugTbALoE2wEbBNsA4wJxAJMEngFUAaYACgTbAM8EtACcBJ4B1wSeALoFhf/IAkgAdQUK/50Grv+dBBn/nQaw/8YGHf+IBkr/xgNC/8kFhQAABWAAuAR9ALgFRAA5BHsAuASiADEGHwC4Bl4AdwMdAEIFUAC4BTMAAAeLALgGgQC4BJEAUgZeAHcF9gC4BQYAuAS+AE4EogApBP4AAAbhAFwFVgAABwIAbQZKADcDHQA5BP4AAAUtAFwEcQBOBUIAoANCAKAFKQCPBS0AXAVIAKAEiwACBPQAXARxAE4D/ABcBUIAoATyAFwDQgCgBPYAoATsAAgFSACgBMMABgP8AFwE9ABcBekAGQTyAHkD/ABcBTkAXAROACkFKQCPBlYAXAS8/88GsgCPBucAbQNCAAwFKQCPBPQAXAUpAI8G5wBtBHsAuAZxACkEfQC4BWoAdwRoAF4DHQBCAx0AOQKm/2gH/gAQCAQAuAZxACkFYAC4BTkAAAX2ALgFhQAABRsAuAVgALgEfQC4Bh0ACgR7ALgHiwAABS8AXgaWALgGlgC4BWAAuAX2ABAHiwC4Bh8AuAZeAHcF9gC4BQYAuAUZAHcEogApBTkAAAbhAFwFVgAABj8AuAXTAG0IoAC4COkAuAXRAAAHPwC4BRsAuAVOAEgIjwC4BVL/9gTVAFYE+gBcBR0AoAPTAKAFUAAdBLoAXAb8AAAEcQBOBcMAoAXDAKAE9ACgBSkAAAbBAKAFTACgBPQAXAU3AKAFEACgBB0AXARtAC8EjQAABoMAXASgAAoFgQCgBT8AewfBAKAH4QCgBa4AAAbNAKAE6QCgBBkASgcEAKAEvgAABLoAXAVCAAQD0wCgBDEAXAP6AFwCcQCTAnH/5QJx/30HGwAABxsAoAVCAAQE9ACgBI0AAAVgAKAEpgC4BBkAoAe8AAAG2QAUB7wAAAbZABQHvAAABtkAFAT+AAAEjQAABAAAUggAAFIIAABSA0r//AG8ABkBvAAZAlQAPwG6ABkDjwAZA48AGQQlAD8EIQB7BDUAewMCAGIG1wB1Cj8APwIhAIUDxwCFAvIAUgLyAFIEjwB1AQr+dwNiAGYEkQAjBJEAUgcjALgEkQBCBlwAPwQpACkIOQCHBf4AEAZKADcE9ABmBwwAOgcMADsHDABaBwwAQwSmADsFRAA5Be4ApgUMACkEkQBYBGQAJQWoAHEDTAAABJEAWASRAFgEkQBWBJEAWASqAFgFiQApBYkAKQSeAGgCcf99BAABXgQAAV4EAAFOAwgAKQMIAAwDCABUAwgALQMIADsDCAAtAwgAKwQAAAAIAAAABAAAAAgAAAACqgAAAgAAAAFWAAAEeQAAAkgAAAGaAAAAzQAAAAAAAAAAAAAIAABUCAAAVAJx/30BvAAZBdsAKQUMAAAH/gAzB4sAuAfbAKAFhQAABNUAVgaw/nICqgBYAgAAeQigACkIoAApBpoAdwVvAFwHFACuBhQAmgAA/BYAAPzQAAD74AAA/NkAAPzZBHsAuAaWALgEugBcBcMAoAi0AHcHFAAGBWIAAAVMAAAHmgC4BmYAoAXXAAAFHwAACAoAuAc3AKAGbwApBPwAFAiWALgHCgCgBQ4AKQRxAB8HAgBtBrIAjwZeAHcE9ABcBbwAAATXAAAFvAAABNcAAAqNAHcJKQBcBrAAdwVvAFwItAB3Bx8AXAi0AHcHFAAGBWoAdwQxAFwE3wBoBHUAtASeAPQEngHNBJ4BywfpACkHpgApB1QAuAZqAKAE7gAvBOkABAUGALgFEACgBHkALwPuAAQF3wC4BNEAoAg7AAAHiQAABS8AXgRxAE4GDAC4BVIAoAVQALgEywCgBSUABAT2AAQF3QAABY8AAAa6ALgF8gCgBqwAuAYQAKAJAAC4Bx0AoAY3AHcFPwBcBRkAdwQdAFwEogApBGYALwT+AAAEmAAABP4AAASYAAAF8gAABR8ACgdxACkGVAAvBm8AbQXPAHsF0wBtBT8AewXTALgFVACgB5YAAAW4AAAHlgAABbgAAAMdAEIHiwAABvwAAAYUALgFSgCgBrQAEAXRAAAGHwC4BUwAoAbdALgF9ACgBdMAbQU/AHsISgC4B2gAoAMdAEIFhQAABNUAVgWFAAAE1QBWB54AAAdWAFYEewB2BLoAXAaJAKQEzwBcBokApATPAFwHiwAABvwAAAUvAF4EcQBOBLoAOQSmADkGlgC4BcMAoAaWALgFwwCgBl4AdwT0AFwGXgB3BPQAXAZeAHcE9ABcBU4ASAQZAEoFOQAABI0AAAU5AAAEjQAABTkAAASNAAAF0wBtBT8AewR9ALgD0wCgBz8AuAbNAKAEeQAvA+4ABAXbAAAFKQAKBVYAAASgAAoFGwBcBRAAXAdoAFwHYgBcB04AGQb2ADkFnAAZBUoATghEABAHewAACFgAuAeeAKAGZgB3BU4AXAYQACkF3wAvBS8AWARzAE4GiwAQBcsAAAWFAAAE1QBWBYUAAATVAFYFhQAABNUAVgWFAAAE1f/TBYUAAATVAFYFhQAABNUAVgWFAAAE1QBWBYUAAATVAFYFhQAABNUAVgWFAAAE1QBWBYUAAATVAFYFhQAABNUAVgR7ALgEugBcBHsAuAS6AFwEewC4BLoAXAR7ALgEugBcBHv/zQS6/98EewC4BLoAXAR7ALgEugBcBHsAqwS6AFwDHQBCAnEAdQMdAEICcQCRBl4AdwT0AFwGXgB3BPQAXAZeAHcE9ABcBl4AdwT0/98GXgB3BPQAXAZeAHcE9ABcBl4AdwT0AFwGmgB3BW8AXAaaAHcFbwBcBpoAdwVvAFwGmgB3BW8AXAaaAHcFbwBcBgwArgVCAJoGDACuBUIAmgcUAK4GFACaBxQArgYUAJoHFACuBhQAmgcUAK4GFACaBxQArgYUAJoE/gAABI0AAAT+AAAEjQAABP4AAASNAAAFMQBcAAD7fwAA/C0AAPsMAAD8LQAA/DEAAPwxAAD8MQAA/DEAAPwxAaYACgJWABACVgAQA9kALQTfAGYD8AA9BJEAQgSRAE4EkQAXBJEAZASRAEgEkQA3BJEASASRAEIGMQApBeEAUgSiACkDeQAvBRAAXAUQAFwFEABcBRAAXAUQAFwCpgC4Aqb/xgKmAKcCpv+gAqb//QKm/7UCpgADAqb/ywKmAG4CpgCsBcMAuAQZ/50CpgC4//0AuP/9ALgAuACLAKwAAAAAAAEAAwABAAAADAAEBA4AAACwAIAABgAwAEgASQB+AMsAzwEnATIBYQF/AZIBoQGwAfAB/wIbAjcCvALHAskC3QLzAwEDAwMJAw8DIwOKA4wDoQOqA84D0gPWBA0ETwRfBIYEkQS/BM8FEx4BHj8ehR7HHsoe8R75H00gCyAVIB4gIiAmIDAgMyA6IDwgRCBwIHkgfyCkIKcgrCEFIRMhFiEgISIhJiEuIV4iAiIGIg8iEiIaIh4iKyJIImAiZSXK+wT+///9//8AAAAgAEkASgCgAMwA0AEoATMBYgGSAaABrwHwAfoCGAI3ArwCxgLJAtgC8wMAAwMDCQMPAyMDhAOMA44DowOrA9ED1gQABA4EUARgBIgEkgTABNAeAB4+HoAeoB7IHsse8h9NIAAgEyAXICAgJiAwIDIgOSA8IEQgcCB0IH8goyCnIKshBSETIRYhICEiISYhLiFbIgIiBiIPIhEiGiIeIisiSCJgImQlyvsA/v///P///+MAAP/j/8IAAP/CAAD/wgAA/7AAvwCyAGH/SQAAAAD/lv6F/oT+dv9o/2P/Yv9dAGf/RAAA/c8AAAAA/c3+gv5/AAD9mgAA/gwAAP4JAAD+CeRY5BjjeuR9AADkfQAA4w3iQuHv4e7h7eHq4eHh4OHb4drh0+HL4cjhmeF24XQAAOEY4QvhCeJu4P7g++D04MjgJeAi4BrgGeAS4A/gA9/n39DfzdxpAAADTwJTAAEAAACuAAAAAACqAAAArgAAAMAAAAAAAAAAAAAAAPAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAADqARAAAAAAAAABGAAAATAAAAFMAAABXAAAAAAAAAAAAAABcAAAAXIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABPAAAAAAAAAOWA5cDmAOZA5oDmwDrA5wA7QOdAO8DngDxA58A8wOgA48DkAEmAScBKAEpASoBKwEsAS0BLgEvATABMQEyATMBNAE1ATYBNwE4ATkBOgE7ATwBPQE+AT8BQAFBAUkBSgEkASUBVAFVAVYBVwFYAVkDoQFcAV0BXgFfAWABYQFiAWMBZAFlAWYDogFoAWkBagFrAWwBbQFuAW8BcAFxAXIBcwF0AXUBdgOjAmgBnAGdAZ4BnwGgA6QDpQGjAaQBpQGmAacCaQJqAeoB6wHsAe0B7gHvAfAB8QHyAfMB9AH1AmsB9gH3ApMClAKVApYClwKYApkCmgH4AfkDpgLKAssCzALNAs4CzwLQAtEC0gLTAtQC1QLWAtcDpwOoA0YDqQIAAgEDbwNwA3EDcgNzA3QDdQIcA40CNAI1Al0CXgAAQEdbWllYVVRTUlFQT05NTEtKSUhHRkVEQ0JBQD8+PTw7Ojk4NzY1MTAvLi0sKCcmJSQjIiEfGBQREA8ODQsKCQgHBgUEAwIBACwgsAFgRbADJSARRmEjRSNhSC0sIEUYaEQtLEUjRmCwIGEgsEZgsAQmI0hILSxFI0YjYbAgYCCwJmGwIGGwBCYjSEgtLEUjRmCwQGEgsGZgsAQmI0hILSxFI0YjYbBAYCCwJmGwQGGwBCYjSEgtLAEQIDwAPC0sIEUjILDNRCMguAFaUVgjILCNRCNZILDtUVgjILBNRCNZILAEJlFYIyCwDUQjWSEhLSwgIEUYaEQgsAFgIEWwRnZoikVgRC0sAbELCkMjQ2UKLSwAsQoLQyNDCy0sALAoI3CxASg+AbAoI3CxAihFOrECAAgNLSwgRbADJUVhZLBQUVhFRBshIVktLEmwDiNELSwgRbAAQ2BELSwBsAZDsAdDZQotLCBpsEBhsACLILEswIqMuBAAYmArDGQjZGFcWLADYVktLIoDRYqKh7ARK7ApI0SwKXrkGC0sRWWwLCNERbArI0QtLEtSWEVEGyEhWS0sS1FYRUQbISFZLSwBsAUlECMgivUAsAFgI+3sLSwBsAUlECMgivUAsAFhI+3sLSwBsAYlEPUA7ewtLLACQ7ABUlghISEhIRtGI0ZgiopGIyBGimCKYbj/gGIjIBAjirEMDIpwRWAgsABQWLABYbj/uosbsEaMWbAQYGgBOlktLCBFsAMlRlJLsBNRW1iwAiVGIGhhsAMlsAMlPyMhOBshEVktLCBFsAMlRlBYsAIlRiBoYbADJbADJT8jITgbIRFZLSwAsAdDsAZDCy0sISEMZCNki7hAAGItLCGwgFFYDGQjZIu4IABiG7IAQC8rWbACYC0sIbDAUVgMZCNki7gVVWIbsgCALytZsAJgLSwMZCNki7hAAGJgIyEtLEtTWIqwBCVJZCNFabBAi2GwgGKwIGFqsA4jRCMQsA72GyEjihIRIDkvWS0sS1NYILADJUlkaSCwBSawBiVJZCNhsIBisCBharAOI0SwBCYQsA72ihCwDiNEsA72sA4jRLAO7RuKsAQmERIgOSMgOS8vWS0sRSNFYCNFYCNFYCN2aBiwgGIgLSywSCstLCBFsABUWLBARCBFsEBhRBshIVktLEWxMC9FI0VhYLABYGlELSxLUViwLyNwsBQjQhshIVktLEtRWCCwAyVFaVNYRBshIVkbISFZLSxFsBRDsABgY7ABYGlELSywL0VELSxFIyBFimBELSxGI0ZgiopGIyBGimCKYbj/gGIjIBAjirEMDIpwRWAgsABQWLABYbj/gIsbsIGMWWg6LSxLI1FYuQAz/+CxNCAbszMANABZREQtLLAWQ1iwAyZFilhkZrAfYBtksCBgZiBYGyGwQFmwAWFZI1hlWbApI0QjELAp4BshISEhIVktLLACQ1RYS1MjS1FaWDgbISFZGyEhISFZLSywFkNYsAQlRWSwIGBmIFgbIbBAWbABYSNYG2VZsCkjRLAFJbAIJQggWAIbA1mwBCUQsAUlIEawBCUjQjywBCWwByUIsAclELAGJSBGsAQlsAFgI0I8IFgBGwBZsAQlELAFJbAp4LApIEVlRLAHJRCwBiWwKeCwBSWwCCUIIFgCGwNZsAUlsAMlQ0iwBCWwByUIsAYlsAMlsAFgQ0gbIVkhISEhISEhLSwCsAQlICBGsAQlI0KwBSUIsAMlRUghISEhLSwCsAMlILAEJQiwAiVDSCEhIS0sRSMgRRggsABQIFgjZSNZI2ggsEBQWCGwQFkjWGVZimBELSxLUyNLUVpYIEWKYEQbISFZLSxLVFggRYpgRBshIVktLEtTI0tRWlg4GyEhWS0ssAAhS1RYOBshIVktLLACQ1RYsEYrGyEhISFZLSywAkNUWLBHKxshISFZLSywAkNUWLBIKxshISEhWS0ssAJDVFiwSSsbISEhWS0sIIoII0tTiktRWlgjOBshIVktLACwAiVJsABTWCCwQDgRGyFZLSwBRiNGYCNGYSMgECBGimG4/4BiirFAQIpwRWBoOi0sIIojSWSKI1NYPBshWS0sS1JYfRt6WS0ssBIASwFLVEItLLECAEKxIwGIUbFAAYhTWli5EAAAIIhUWLICAQJDYEJZsSQBiFFYuSAAAECIVFiyAgICQ2BCsSQBiFRYsgIgAkNgQgBLAUtSWLICCAJDYEJZG7lAAACAiFRYsgIEAkNgQlm5QAAAgGO4AQCIVFiyAggCQ2BCWblAAAEAY7gCAIhUWLICEAJDYEJZsSYBiFFYuUAAAgBjuAQAiFRYsgJAAkNgQlm5QAAEAGO4CACIVFiyAoACQ2BCWVlZWVlZsQACQ1RYQAoFQAhACUAMAg0CG7EBAkNUWLIFQAi6AQAACQEAswwBDQEbsYACQ1JYsgVACLgBgLEJQBuyBUAIugGAAAkBQFm5QAAAgIhVuUAAAgBjuAQAiFVaWLMMAA0BG7MMAA0BWVlZQkJCQkItLEUYaCNLUVgjIEUgZLBAUFh8WWiKYFlELSywABawAiWwAiUBsAEjPgCwAiM+sQECBgywCiNlQrALI0IBsAEjPwCwAiM/sQECBgywBiNlQrAHI0KwARYBLSywgLACQ1CwAbACQ1RbWCEjELAgGskbihDtWS0ssFkrLSyKEOUtQIsJIUggVSABA1UfSANVHgP/H1BMFh9PTWQfTkxkHyY0EFUlMyRVGRP/HwcE/x8GA/8fTUweH2RMAUxGDR8TMxJVBQEDVQQzA1UfAwEPAz8DrwMDBktGy0bbRgMjMyJVHDMbVRYzFVURAQ9VEDMPVa8Pzw8CMA8BATMAVW8AfwCvAO8ABBAAAYAWAQUBuAGQsVRTKytLuAf/UkuwCVBbsAGIsCVTsAGIsEBRWrAGiLAAVVpbWLEBAY5ZhY2NAEIdS7AyU1iwIB1ZS7BkU1iwEB2xFgBCWXNzK3NzKysrKytzXnN0KysrK3QrKysrKysrKysrKysrGF4GFAAXAAAFtgAXAHUFtgXNAAAAAAAAAAAAAAAAAAAEXgAXAHsAAP/sAAAAAP/sAAAAAP/sAAD+FP/sAAAFtgAV/JT/6/6P/+D+vP/sABL+VgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAADlAPYBAAErANMAsgECAPYBAgD2AO0A3wCyAAABVAAAAAAAJAAkACQAJABWAHoA7wF6AegCcAKIArUC4gMgA0sDaAN9A54DvAP+BCsEeQThBSoFhQXgBgoGfQbZBxEHSAdxB5cHwggeCK4I8glSCZQJywoGCjUKigq/CvALGwtaC3kLvwv6DDwMewzRDSQNhA2qDd8OEQ5tDq8O4w8YDzoPWA96D6YPvQ/gEDoQjhDKER0RcxG1ElESjxK7EvgTPxNWE7IT7RQwFIUU2xUNFWUVpxXjFhUWcRa2FwUXOheFF5wX6xgrGCsYXBirGQQZYBm+GeMaYBqXGxAbZhu6G9cb3xxtHIQcuhz0HS4dgx2mHe8eIx5EHn4eqx7hHzUfSx9gH3Yf1h/nH/ggCSAaICwgPSCcIKgguSDKINsg7SD+IQ8hICEyIYIhkyGkIbUhxiHXIekiGSJ2IocimCKpIrsizCMOI4YjliOmI7YjxiPXI+gkgSSNJJ0krSS9JM4k3yTwJQElEyWRJaElsSXCJdIl4iXzJjQmkiaiJrMmwybUJuQnPidPJ2AncCeBJ5EnnSepJ7onyifbJ+sn/CgNKB4oLig/KEsoUyjAKNEo4SjyKQIpEykkKTApPClNKV0pbil+KY8pnymwKcEpzSndKe4qASpSKqcquCrJKtoq6yr8Kw0rGCsjKzQrSytXK2MrdCuFK5ErnCvhK/IsBSwQLBwsLSw5LEUsUSyQLNAs4SzyLP4tCS0aLSotNi2JLdYt5y33LgguGC4qLjsuqi8yL0MvUy9fL2svfC+ML50vrS++L84v2i/mL/cwBzASMB0wLjA/MH4w2TDqMPoxCzEbMSwxPDFOMV8xcTGDMY8xmzGsMb0xzjHeMfAyATIRMiIyMzJEMlQyfjLNM1gz/DQNNB40LzQ/NEo0VTSGNLg0zzT8NRc1TTV1NbY17TYPNlo2bjZ3Now2oTa2Nso23zbzNwY3DjcWNzY3PjdGN043VjevN7c3vzf2N/44BjhEOEw4cTh5OMM4yzjTOUE5STmZOf06DzohOjE6QTpROmI6dDraO0U7jDwEPG88zz0LPWA9ij2SPfw+BD43Pqw+tD78P0g/kj/eQBlAV0C+QSRBdkHVQedB+EIIQhhCKUI7QpVCpkL3Qv9DB0MZQyFDhkPgRCZEN0RIRHpEgkTHRM9E10UoRTBFhEXkRhtGLEZhRp9Gp0avRrdGv0bHRs9G10chRylHMUdkR51H0kgUSF1Iq0joSTtJnUnwSfhKWkq3StZLIksqS31L3kwTTCRMW0yXTOJNFk0eTURNTE1UTXtNg03qTfJOJU5dTpFO0k8XT2JPnU/pUENQkVCiUQ9RH1FtUXVRfVGPUZdR81JJUp9SsFLAUvRTGVM+U09TYFNxU4JTlFOmU7dTyFPdU/JUB1QrVExUa1SKVKtU4FURVUFVhlXyVhJWXlb5VwFXCVc3V2ZXclePV8RYD1iEWP9Zg1n8WldazFsoWzBbhludW7Rby1viXD5cd1ycXN5c810kXYxdwV3XXiheYF6WXtNe317rXxVfP19hX4Nfpl/cYB9gcGC9YORhTGGZYZlhmWGZYZlhmWGZYZlhmWGZYZlhmWGZYZli7GNcY21jdWQBZEtkvmTPZOBk7GT4ZQRlOmV/ZY9ln2X+ZmBmsGcHZxBnGWciZ05nZGd1Z4ZnlmemaClohGjYaShpjmnuajZqg2rva1xr1mxPbOhtgG4wbu5u9m7+b1NvqW/0cDxwTnBgcOlxcXHkclVzK3P2dKN1MHV0dbV163YYdkp2e3asd514PXireRp5bHm/eip6q3rmeyF7fnvbfER8rHy4fMR9Dn1ZfbJ+AX5Zfrh/BX9Kf5B/14AYgFmAvYEegayCQIJMgliCjYLDgsuDB4Nag6iEAYRdhKKE44UvhXqFy4YahlKGiIb+h2+H9oh2iH6Ij4igiQKJYYm1igiKU4qfiumLNIt6i7+MHIx/jIeMmIyojLqMy4zTjNuM7Iz8jVCNoY2zjcSN1o3ojfqOC45hjreOyI7YjuqO+48Njx6Pc4/Jj9uP7I/+kA+QIJAwkEKQU5BlkHaQiJCZkMiQ9pEIkRqRLZFAkVWRapHFkiCSXZJlksuTO5OglAWUZJTHlSGVdpXPlieWepbIlw2XUZe3mBWYKJg7mEeYU5hkmHWYh5iZmKuYvZjPmOGY85kFmRuZMJlCmVSZZpl4mYqZnJmumcCaApoWmiKaLpo/mlCaYZpxmoOalZqnmrmay5rdmu+bAZsWmyqbO5tMm1ibZJtwm3ybjZuem7CbwpvUm+ab+JwKnBycLpxDnFecaJx4nImcmZyqnLuczJzcnOic9J0AnQydHZ0unT+dUJ1hnXGdgp2TnaSdtJ3Ancyd2J3knfWeBp4XnieeM55gnpKexp8Nn12fkJ/CoA2gXKCQoLWg2qEIoUihd6HDoiiicqLKotKi/KMEo2Ojb6QApAykGKR4pIikmKSppLqkz6TgpPGlAqUUpSWlNqVHpVKlY6VvpYGliaWbpaOltaW9pcWl1qXiAAAAAgDBAAAECgW2AAMABwAeQAwEAwUCAwIICQQDBwAALzIvMxESATk5ETMRMzEwEyERITchESHBA0n8t2gCef2HBbb6SmgE5gAAAgB1/+UB0wW2AAMADwAmQBIDCgoCBAQQEQEHDQdUWQ0TAgMAPz8rEQAzERIBOREzMxEzMTABIwMhATQ2MzIWFRQGIyImAaD0MwFa/qJaVlNbXFJUXAHlA9H62VRWWFJPW1kAAAIAhQOmA0IFtgADAAcAG0ALBAcAAwMIBgIHAwMAPzPNMhEBMxEzzDIxMAEDIwMhAyMDAZwpxSkCvSnFKQW2/fACEP3wAhAAAAIALQAABP4FtAAbAB8AfUBECBwfFQQUCQkKBAEAGQQYBQUGEg8OCwQKExMUFh4dBwQGFxcYGBQGCgQgIQgECwscAQ4fAA8PGRUSDhIOEgoXEwMGChIAPzM/MxI5OS8vETMzMxEzMxEzMzMRMzMREgEXOREzERIXOREzERIXOREzERIXOREzERIXOTEwAQchFSEDIxMjAyMTIzUhNyM1IRMzAzMTMwMzFQUzNyMD5y8BAv7XTdxOwkzXSu4BFS/8ASFN203GTtdO8P0dxC/EA0zozv5qAZb+agGWzujRAZf+aQGX/mnR6OgAAAMAWP+JBEQGEgAgACYALACGQEUkFwMdHRQNBioqISkeJwAnCA8jESEhGQARAC0uKh0nAAANJBEhEScrGichCSUGDBwXHE9ZFBcGDFBZBQYDBhcGFwYtFQAAPxI5OS8vETMQzSsRADMrERIAFzkRMxESOTkzERI5ORESATk5ETMzERI5OTIyERI5ORE5ETMzMzMRMzMzMTABFAYHFSM1JicRFhYXEScmJjU0Njc1MxUWFwcmJxEeAgU0JicVNgEUFhc1BgRE5s+J9LhX9WBDxqXjy4nluV6cpMOlTf7TRESI/m49RIEByZ/BE83JBVEBCCtCBgE2Gk63h5G7FJmVClLqQA7+2UtuhGcqOh/5FwK+LDke6xMABQA//+4G9gXLAAkAFAAYACIALQBKQCQWFxcFBQoQABAYFRUZGSkjHiMQIy4vICscJhkYBhcYAw0HEgcAPzPEMj8/PzPEMhESATk5ETMQwDISOREzETMQwDISOREzMTABFBYzMjU0IyIGBRQGIyImNRAhMhYlASMBExQWMzI1NCMiBgUUBiMiJjUQITIWATstMmBgMi0Bu7KspbQBWam1ArD81fADK4UtMmBgMi0Bu7KspbQBWam1BAB/ffz6e33m5+3gAcnt2PpKBbb8An99/Pp7feXn7d8Bye0AAAMAUv/sBgAFywAdACYAMQBxQDktDSMKAR0WAAoWDRMTJxkaGicNAwcBAAAzHgcHMhchGhYKJCQvLxAaGgQQECpNWRAEBCFMWQQTARIAPz8rABg/KxESADkYLxI5ETMSOTkREjkRATMRMxEzETMSFzkRMxEzERI5ORESORESOREzMTAhIScGIyIkNTQ2NyYmNTQ2MzIWFRQGBwE2NyEGAgclFBYzMjcBBgYBNCYjIgYVFBc2NgYA/odzv/H0/uJ5k0tE6cO634qaARxHNAE+JH5Q/MCBZX5l/rQ6QwFnSDlDTV9WXHGF4L+JwVRWnV2Yuq2Rd8VZ/ut1uIf+/2ODVmY9AUosYAKGNT1AO1hqMF0AAQCFA6YBnAW2AAMAErYAAwMEAgMDAD/NEQEzETMxMAEDIwMBnCnFKQW2/fACEAAAAQBS/rwCeQW2AA0AIEAOCwoKAwQEAAcHDwskAwMAPz8RATMRMzMRMzMRMzEwExASNzMGAhUUEhcjJgJSm5L6jZCTiPiTmgIxAQkBzq7B/jL09f43uaoBxgAAAQA9/rwCZAW2AA0AIEAOAwQECwoKAAcHDgoDBCQAPz8RATMRMzMRMzMRMzEwARACByM2EjU0AiczFhICZJuS+IeUkI36k5oCMf75/jqouAHJ9vQBzsGv/jEAAQA/AlYEHQYUAA4ANUAYCQsLBQMDDQEHBxAPBAoKBwcBDQ0GCA4AAD/EMjkRMzMSOREzERIBOREzMzMSOTMSOTEwAQMlFwUTBwMDJxMlNwUDArApAXUh/qzf45yJ7N3+ricBbSkGFP6QaPwY/td5ATn+yXcBKRr6aAFwAAEAWADjBDkExQALACZAEAgGCQkDAQAADA0LCQAGBAMALzMzMzIyERIBOREzMzMRMzMxMAEhNSERMxEhFSERIwHb/n0Bg9sBg/592wJk2wGG/nrb/n8AAQA//vgBywDuAAYAFbcCAwAFBQcDBQAvxhEBMxEzwjIxMCUGAyMSNyEByzR83EEkARjXyv7rAQrsAAEAPQGoAlYCogADABG1AwUABAABAC8zEQEzETMxMBM1IRU9AhkBqPr6AAEAdf/lAdMBOQALABZACgYAAAwJA1RZCRMAPysRATMRMzEwNzQ2MzIWFRQGIyImdVpWU1tcUlRcj1RWWFJPW1kAAAEADgAAA0QFtgADABxADAECAwACAAQFAwMCEgA/PxESATk5ETMRMzEwAQEhAQNE/d/+6wIhBbb6SgW2AAIASv/sBEgFzQALABcAKEAUDAYSAAYAGBkJFU9ZCQcDD09ZAxkAPysAGD8rERIBOTkRMxEzMTABEAIhIgAREBIhMgABEBYzMjYRECYjIgYESPv++/3+//oBBP0BA/01XW5sYGFrbV4C2/6B/pABfAFzAYMBb/6A/o7+8+nsAQoBDevrAAEAeQAAA04FtgAKACpAEwkEAAAIAQELDAgHBwEEBAkGARgAPz8zERI5ETMREgE5ETMzEjk5MTAhIRE3NwYHBycBMwNO/ssDBU0eqJUB1/4DTouYTRiHugF3AAEATgAABFAFywAdAD1AHhwOAQcAFgEWHh8WBwcCChIKTlkSBwIBHAEcTlkBGAA/KxESADkYPysREgA5ETMREgE5OREzMxEzMzEwISE1AT4CNTQmIyIGByc+AjMyFhYVFAYGBwcVIQRQ/AIBb6NkLGFRVaBXqGyOqGiJ0nRHlby8An3XAXOngW47WFZOSMdcTClktHRlsbqssQ4AAAEATv/sBEIFywAmAFtALyIXDRMTBwMcHAAABw0HJyghHiQeT1kDGBcYF1BZDBgBDQMYGAokBw0QChBPWQoZAD8rEQAzGD8SOS9fXl0rERIAOSsRADMREgE5OREzETMRMxEzERI5OTEwARQGBxUWFhUUBCEiJxEWFjMyNjU0JiMjNTMyNjU0IyIGByc2ITIEBBemlrG2/s7+5O64VcxkmZKouG9xqp3QSJVbj8gBFeMBBwRvicAkBharkdPrTwEHKzZoc2dW7VlspjA71ZC4AAACACMAAARxBbYACgATAEZAIg8HAwkCAgsDAwUAABUTBQUUBhMBBRMFUFkJExMDDwcGAxgAPz8zEjkvMysRADMSOREBMxEzETMREjkRMzMRMxI5OTEwASMRIREhNQEhETMhNTQ2NyMGBwEEcbD+0v2QAoEBHbD+IgoDCCU0/vQBL/7RAS/XA7D8afg+7BNSTv5rAAEAZP/sBDUFtgAbAFZAKxgVFRcDGRQUDggOAwgDHB0UEwkTDBAAEE9ZGQAABhUVGE5ZFQYGDE9ZBhkAPysAGD8rERIAORgvMysREgA5OREzERIBOTkRMxESOREzEjk5ETMxMAEyFhUUACEiJxEWFjMgNTQhIgYHJxMhESEDNzYCZtT7/tL+5/SWT9JeARv+2zWAKHs3Axn99hsjPQOm7s/1/vhPAQsqNejdFQxCAun++v7hBw4AAgBI/+wEUAXHABgAJABBQCEGEgwMIiIAHBIAEiUmDx9QWQ8PFQMVGU9ZFRkDCE9ZAwcAPysAGD8rERIAORgvKxESATk5ETMRMxI5ERI5MTATEAAhMhcVJiMiBgYHMzYzMhYVFAAjIiYCBTI2NTQmIyIGFRQWSAFvAW59R1lXn8lkCQ1j2sTe/vjqovGDAhBjamNkXoV9Am0BsgGoD/cUYLytqvbZ6v7vlgEgv4V7a3t6UXekAAABADcAAARQBbQABgAuQBYGAAACAQEFAgUHCAUDAgMCTlkDBgAYAD8/KxESADkREgE5OREzERI5ETMxMDMBIREhFQHjAiX9LwQZ/dcEsAEEwvsOAAADAEj/7ARKBckAFwAiAC4AU0ApEgYVLAMDGAkYJhUVDx4eCQ8JLzAGEhIhISkpDAAMG1FZDBkAI1FZAAcAPysAGD8rERIAOREzEjkRMxESATk5ETMREjkRMzIREjkRMxI5OTEwATIEFRQGBxYWFRQEIyIkNTQ2NyYmNTQkAxQWMzI2NTQmJwYTIgYVFBYXNjY1NCYCStIBAXyKpI/+5ubw/u6Fk31uAQQTeGhzcnF/1eJPYU1lYk5kBcm/onCvRVi/crTbzLt9wkpPtGudwvu8VmBjUUN1QmICzFFEPF8yLmA/RVAAAAIAQv/sBEoFxwAZACUAP0AgHQUTDAwjIwATACYnECBQWRAQAxYWGk9ZFgcDCFBZAxkAPysAGD8rERIAORgvKxESATk5ETMSORESOTIxMAEQACEiJzUWMzI2NjcjBgYjIiY1NAAzMhYSJSIGFRQWMzI2NTQmBEr+lP6PgkNUXJvIaggMOphyv9wBC+ai84L972BsYmRehn0DRv5Q/lYO+BVbw6teTPXa6wERmP7fwYR8anx7UHekAAACAHX/5QHTBHMACwAXACZAExIGBgwAABgPFVRZDxAJA1RZCRMAPysAGD8rEQEzETMzETMxMDc0NjMyFhUUBiMiJhE0NjMyFhUUBiMiJnVaVlNbXFJUXFpWU1tdUVRcj1RWWFJPW1kDi1RWWFJRWVgAAgA//vgB0wRzAAYAEgAoQBMNBwcTAwQGAQYGEwoQVFkKEAQGAC/GPysRATMRMxDCMhEzETMxMCUXBgMjEjcDNDYzMhYVFAYjIiYBvA80fNxBJC9aVlNbXVFUXO4Xyv7rAQrsAttUVlhSUVlYAAABAFgAywQ5BQAABgAnQBAFAQQAAQAHCAQDAwYAAgEFAD0vMzMzMjMRMxESATk5ETMRMzEwJQE1ARUBAQQ5/B8D4f1UAqzLAbaPAfDw/sP+5wAAAgBYAaIEOQQAAAMABwAkQBEHAwMJBAAIBVAEYAQCBAQAAQAvMzMvXTMRATMyETMRMzEwEzUhFQE1IRVYA+H8HwPhAyXb2/5929sAAAEAWADLBDkFAAAGACtAEgIAAQUABQcIAAYGAQIDAwUEAQA9LzMzMxEzETMRMxESATk5ETMRMzEwEwEBNQEVAVgCrP1UA+H8HwG6ARkBPfD+EI/+SgAAAgAG/+UDoAXLABkAJQBEQCIgGhoZAAANBwcSDRImJw8AAQkDAAAjIx1UWSMTDwpPWQ8EAD8rABg/KxEAMxgvX15dERIBOTkRMxESOREzMxEzMTABNTQ2NzY2NTQmIyIHJzYzMhYVFAYHBgYVFQE0NjMyFhUUBiMiJgEUUm1pQ2BWlsBt3/rO82SMYDP+11pWU1tcUlRcAeVKYI5QS146QURi233GpW6gZEdKPDz+qlRWWFJPW1kAAAIAZv9mBscFyQA0AD8AWUArBzk5FBQTNTUNOxMoEw0DIRkhLRkALQBAQRYINzcECj0QChAKECodMQQkKgAvMz8zEjk5Ly8RMxEzMxEzMxESATk5ETMRMxESFzkRMxEzERI5ETMSOTEwARQGBiMiJicjBiMiJjU0ADMyFhcDFDMyNjU0JiYjIgQCFRAAITI2NxUGISAAETQSJCEyBBIBFDMyNjc3JiMiBgbHXKhvSnIZEGynscwBDNhWz0MXTEBMhvOcyv7WnwEnARhq/nvW/vv+hP5X2QGRAQXcAVq8/ACsWl4KDTNAfYsC8JDviEc6gdW50wECIRf+F4u7l6H3gqb+x83+7P7ZLy3AWwGQAWT3AZPltP60/qrTf4/dC5wAAAIAAAAABYUFvAAHAA0AQ0AhAg0DCAEABgULCwMAAAcHDwMEBA4NAkxZDQ0DCwUDAAMSAD8zPzMSOS8rEQEzETMRMxEzERI5ETMzEjk5Ejk5MTAhAyEDIQEhAQECJicGAwQ3av3rav6yAgQBewIG/f6TJQghnAFc/qQFvPpEAmAB2XwkgP4HAAADALgAAAT0BbYADwAYACAAVkAsBxQUBAQaHgsLIhAaGg8PIQgQGRAZTVkMEAENAxAQDwAPGkxZDxIAGExZAAMAPysAGD8rERIAORgvX15dKxESADkRATMRMxEzETMRMxI5ETMSOTEwEyEgBBUUBgcVFhYVFAQjIQEzMjY1NCYjIxERMzI2NTQhuAHHATcBGXtmi3v+3/j93QE2tH5xe4WjyoB6/vwFtrHBg6gRCh+qjcjgA3NOWlRJ/cX+g2JltgABAHf/7ATRBcsAFgAxQBgHExMYAw0NFxQAEQBMWREEBwUKBUxZChMAPysRADMYPysRADMRATMRMxEzETMxMAEiAhUQITI3EQYjIAARNBIkMzIXByYmAyWvwAFvmtu03v7B/q6mATfR1ddkUqYEyf756/4XTf78SwGDAWrkAVe3Z/wnOgACALgAAAV1BbYACAAPAChAFAkAABENBAQQBQxMWQUDBA1MWQQSAD8rABg/KxEBMxEzETMRMzEwARAAISERISAAARAhIxEzIAV1/mX+fP5iAcsBZgGM/r7+YKWFAcAC6f6X/oAFtv6G/qUB1/xIAAEAuAAABAIFtgALAEVAJAgEAAANBgoKAQEMBglMWQwGAQ0DBgYBAgIFTFkCAwEKTFkBEgA/KwAYPysREgA5GC9fXl0rEQEzETMRMxEzETMzMTAhIREhFSERIRUhESEEAvy2A0r97AHv/hECFAW2/v6//v6HAAABALgAAAP+BbYACQA0QBoIAwMLBgAAAQEKBglMWQYGAQICBUxZAgMBEgA/PysREgA5GC8rEQEzETMRMxEzETMxMCEhESEVIREhFSEB6f7PA0b96wHw/hAFtv7+h/0AAQB3/+wFJwXLABoATEAnGhgYAg4NDQICExwTCAgbDhALEExZABpMWQAABQsEGBYFFkxZAgUTAD8zKxEAMxg/EjkvKysRADMRATMRMxESOREzETMRMxE5MTABIREGBiMgABEQACEyFwcmIyICFRQWMzI3ESEC4wJEjfmC/rX+owGVAWfh0Wegrcnyw7phZP7rAzX9Ci4lAYUBbAFiAYxa+FD+8uTu+xQBMQABALgAAAVmBbYACwA3QBwJAQEAAA0IBAQFBQwIA0xZTAgBCAgFCgYDAQUSAD8zPzMSOS9dKxEBMxEzETMRMxEzETMxMCEhESERIREhESERIQVm/sv9vf7KATYCQwE1Anf9iQW2/cMCPQAAAQBCAAAC2wW2AAsAMkAXCAAACgoDBQEBAwMMDQkEBAYDCgMDARIAPzMRMz8zETMREgE5ETMRMxEzETMRMzEwISE1NxEnNSEVBxEXAtv9Z7KyApmysrBSA7JSsLBS/E5SAAAB/2j+UgHuBbYADQAfQA4LAggIDgMFAAVMWQAJAwA/xCsRADMRATMRMzMxMBMiJxEWMzI2NREhERACH2lOUEJmWAE26v5SFgECFH+HBVr6qP8A/vQAAAEAuAAABVAFtgAMAEJAHwwCAgoLCwEAAA4IAwUFDQwCAgMLCwYDCAgFBgMBBRIAPzM/EjkRMxEzERI5ETMRATMRMzIRMxEzMxEzOREzMTAhIQEHESERIRE3ASEBBVD+oP6Bg/7KATZ6AYwBWP4CAmhe/fYFtv1jrAHx/XkAAAEAuAAABD8FtgAFAB9ADgQHAwAABgEDAANMWQASAD8rABg/EQEzETMRMzEwMxEhESERuAE2AlEFtvtK/wAAAQC4AAAG0wW2ABQAOkAcFAAJCwkIAwUODg0NFgUGFRICCQIGCwcDDgAGEgA/MzM/MxI5OREzEQEzMhEzETMREhc5ETMzMTAhASMSFREhESEBMwEhESERNDYTIwEDI/6gCRP+6wGmAVoGAW8Bpv7fAwwJ/ocEe/6idf1YBbb7ogRe+koCtDGAART7hwABALgAAAXJBbYADwA2QBkKAAkBBg0NAAARAwUGBgcQCwMHDggDAQcSAD8zPzMSOTkRATMyETM5ETMRMxESOTkSOTEwISEBIxIVESERIQEzAjURIQXJ/nb9hAkT/usBhwJ7Bw8BFwRS/tt9/VAFtvu5AR12ArQAAgB3/+wF5wXNAAsAFQAoQBQRAAAXDAYGFgkTTFkJBAMPTFkDEwA/KwAYPysRATMRMxEzETMxMAEQACEgABEQACEgAAEUFjMgERAhIgYF5/6Y/rD+sP6YAWkBUQFRAWX71bq5AXP+j7m8At3+lf56AYYBbQFtAYH+fP6U9fgB7QHu+QAAAgC4AAAEqgW2AAgAEwA0QBoECQkVAA4ODw8UDQBMWQ0NDxAQCExZEAMPEgA/PysREgA5GC8rEQEzETMRMxEzETMxMAEzMjY1NCYjIwUUBCEjESERISAEAe5mj453f40CvP7Z/vCF/soB0wEKARUDBnFsbWjK7Pr9+AW25QAAAgB3/qQF5wXNAA8AGQBCQCIGAwUEBAIDCAQKFQAAGxAKChoDBw0NF0xZDQQHE0xZBQcTAD/GKwAYPysREgA5EQEzETMRMxEzEhc5ETMRMzEwARACBwEhASMgABEQACEgAAEUFjMgERAhIgYF57exAWD+c/70F/6w/pgBaQFRAVEBZfvVurkBc/6PubwC3f7+/qNR/ncBSAGGAW0BbQGB/nz+lPX4Ae0B7vkAAAIAuAAABUgFtgAIABcATkAmExcXBAoEEBAKFhUZAAoKCwsYEwkMAAlNWQAACwwMCExZDAMWCxIAPzM/KxESADkYLysREgA5EQEzETMRMxAYxDIROREzERI5ETMxMAEzMjY1NCYjIxERIREhIAQVFAYHABchAQHuZJOMj5Ze/soBqgEqAR6OggFKZP6o/qMDLWJpaFj9ef3PBbbZ3YHJOf4TkAIxAAABAF7/7AQXBcsAJwBFQCIbGhohACEFFAwAFAAoKRQhAAwhDB4JFx5MWRcEAwlMWQMTAD8rABg/KxESADk5ETMRMxESATk5ETMRMzMREjkRMzEwARQEIyInERYWMzI2NTQmJicuAjU0JDMyFhcHJiYjIgYVFBYWFxYWBBf+4/7qtJTNVWZtMF2PhoZQAQfocs9xZHWZSlheJlObzZgBlsbkWAEgQjZOTStDPkQ/dJpnwt42MfEwJlJCKT05SmLFAAABACkAAAR5BbYABwAmQBIGAAADAQEICQcDBANMWQQDARIAPz8rEQAzERIBOREzMxEzMTAhIREhESERIQLs/sr+cwRQ/nMEtAEC/v4AAQCu/+wFXgW2ABIAJUAREQEBFAsICBMSCQMFDkxZBRMAPysAGD8zEQEzETMRMxEzMTABERQGBCMgADURIREUFjMyNjURBV6R/u67/ub+yAE1iJ2YiQW2/E6i9IIBIfsDrvyBqZ6fqgN9AAEAAAAABTMFtgALACpAEwMCCQkFAAEBDQUEBAwABAMJAxIAPzM/MxEBMxEzETMRMxE5ETMzMTABIQEhASEBFhYXNjcD+gE5/g/+rv4QATkBExcxBgtABbb6SgW2/JpNzShc5gABAAAAAAe8BbYAHQBGQCIKCQ8UEwUBABgYBQ8DDBwcHR0fDAsLHhwTBQsDGA8PAQoSAD8zMxEzPzMzMxEBMxEzETMRMxESFzkRMzMRMzMRMzMxMCEhAyYCJwYGBwMhASETFhc2NjcTIRMWFhc2NjcTIQZI/p/GCzUEBjANxf6g/osBMbsxFgYrE9UBJdUOKgsKLBK6ATEDACkBASw27zP9AgW2/OLdojnvQgMz/M034lFO6UgDHgAAAQAAAAAFVgW2AAsAREAgCwUCCAgHCQcGCQoGCgEAAA0DBAwLCAIFBQQJBgMBBBIAPzM/MxI5ETMzMxEBMzIRMxEzOTkRMxEzERI5ETMzMzEwISEBASEBASEBASEBBVb+nv6s/qz+tAHl/joBVgE7ATUBTv41Ain91wLyAsT98gIO/SsAAQAAAAAE/gW2AAgANkAZCAcHBQECAgAEBAUFCQoDBgYAAAUBBwMFEgA/PzMSOREzETMREgE5ETMSOTIRMxEzETMxMAEBIQERIREBIQJ/ATEBTv4b/sz+GwFQA1wCWvyD/ccCLwOHAAABADEAAARxBbYACQA7QB0IBAEDBwcAAQAKCwcEBQUETFkFAwIBCAEITFkBEgA/KxESADkYPysREgA5ERIBOTkRMxEzETMzMTAhITUBIREhFQEhBHH7wAK9/VYEGv1EAs/JA+0BAMj8EgAAAQCP/rwCcwW2AAcAHkANBgEBCAQACQUCAwYBJAA/Mz8zEQEzMhE5ETMxMAEhESEVIxEzAnP+HAHk4OD+vAb60/qsAAABAAwAAANCBbYAAwAcQAwAAwMEAgEBBQMDAhIAPz8RATMRMxEzETMxMAEBIQEBIQIh/uv93wW2+koFtgABADP+vAIXBbYABwAgQA4BBgYJAwcHCAAHJAMEAwA/Mz8zEQEzETMSOREzMTAXMxEjNSERITPf3wHk/hxxBVTT+QYAAAEACAIIBD0FvgAGAC1AFAIBBQUGBAQDAwgGAAAABAQHBQIGAD8zEjkvMwEyETMRMxEzERI5ETMzMTATATMBIwEBCAG2kAHv7/6+/ugCCAO2/EoCg/19AAAB//z+vANO/0gAAwAStgAFAQQCASQAPzMRATMRMzEwASE1IQNO/K4DUv68jAAAAQFMBNkDjQYhAAgAHEALAAdAAwUFCQoFgAAALxrdERIBOREzGsoyMTABJiYnNSEWFxUCwz/0RAFWP6wE2SzFQhVlyBsAAAIAVv/sBDsEdQAYACIASkAmEgwIDAIiIhgYJB0ICCMMGUtZDAwFFBQPRlkUEAIfBR9GWQUWABUAPz8rEQAzGD8rERIAORgvKxEBMxEzETMRMxI5MhESOTEwIScjBgYjIiY1NDY3NzU0IyIHJzYzMhYVEQEHBgYVFDMyNjUDZjsITaODobn5+8KuhrVlwevh8P7RdoWClGp/mGFLuKqyqQkGMapRzmXEyP0XAgYEBFhagXplAAIAoP/sBLQGFAASAB8AQkAhHQMDIQkQCw4XFwsLIAwACxUJEAYABhpHWQYWABNHWQAQAD8rABg/KxESADk5GD8/EQEzETMRMxI5OREzETMxMAEyEhEQAiMiJyMHIxEhERQHMzYXIgYHFRQWMzI2NTQmAw7G4OfHxXAVM+kBMQwMa3BxaAJrdF5vcARz/sv+8/7r/tCPewYU/pZFmKb0i6AhtJytpaWlAAEAXP/sA90EcwAVACpAFRMNBwcXDQICFgULR1kFEAAPR1kAFgA/KwAYPysRATMRMxEzERI5MTAFIBEQACEyFwcmJiMiERAzMjY3EQYGAmb99gEcAQnCmlpIfD7u7liWS0qXFAI9AR0BLUzsHSX+rv64LzL++y8kAAIAXP/sBHEGFAASAB8AQEAhCRYQAwsLDg4hHQMDIA8VDAARCQAGBhpHWQYQABNHWQAWAD8rABg/KxESADk5GD8/EQEzETMRMxEzEhc5MTAFIgIREBIzMhczJjURIREjJyMGJzI2NzU0JiMiBhUUFgICxeHlydNvChcBMuo7DWhqdW0Fb31mcXIUATIBDwETATOkfWIBZvnskaXziKMhtJytpaWlAAACAFz/7ARiBHMABgAbAEZAIwMSBAQZEREdEgoKHBgVEgMSSlkDAwcNDQBKWQ0QBxVGWQcWAD8rABg/KxESADkYLysREgA5EQEzETMRMxEzMxESOTEwASIGByEmJgMgABEQADMyABUVIRYWMzI2NxUGBgJvYW4IAawCcjb+8v7QARn47QEI/S8FkIJltGJQtgOae3Fxe/xSASoBEQEZATP+8u6UgpIqLuwoJwAAAQApAAADdQYfABUAPEAeFAICBwUDAxYXDQAAFwUBFAFGWQcUDwsQR1kLAAMVAD8/KwAYPzMrEQAzEQEzETMREjkRMzMzETMxMAEhESERIzU3NTQ2MzIXByYjIgYVFSEDCv74/s+oqLzPnntOXE5BOgEIA3n8hwN5k1JSv7Av4B1NPEYAAwAG/hQEbQRzACkANgBAAIBARAsdHT09BDAREQIpByAEIwEEBEIaKioXFzcjI0EaDQANAQ0GDTQHOktZCSAEAwcHJjQpAkpZKSkmJj9LWSYQFC1KWRQbAD8rABg/KxEAMxgvKwAYLxI5Lxc5KxEAM19eXRI5EQEzETMzETMRMxEzETMSFzkzETMRMxE5ETMxMAEVBxYVFAYjJycGFRQzMzIWFRQEISImNTQ2NyYmNTQ2NyYmNTQ2MzIWFwEUFjMyNjU0JiMjIgYTFBYzMjY1NCMiBG2vMPvfNy0vqL64wf65/s7q9356L0ZKRlhn7t0vgRL+J3ltpLpuc55UcW9TVVZQpqgEXpstS120yQMFJCxCnpnE2KOTZYgdFFszQFUpJqhyt8gRBPsEP0haTj8wTwNNW2pqW8oAAQCgAAAEqAYUABUANUAaAQAAFw8JDAgICQkWDwQSEgRHWRIQCgABCRUAPzM/PysREgA5EQEzETMRMxI5ETMRMzEwISERNCMiBhURIREhERQHBzM2MzIWFQSo/s+0gHL+zwExBwcQZt7FzAKN8q7D/fIGFP7DJYlapNTGAAIAkwAAAd8GFAAIAAwAJEARBAkJAAoKDQsPChUCB0lZAgAAPysAGD8/EQEzETMzETMxMBM0MzIVFAYjIgEhESGTpqZTU6YBPv7PATEFf5WVR0/7FwReAAAC/33+FAHfBhQADQAWAC9AGBILCw4CCAgXEBVJWRAACQ8DBQAFR1kAGwA/KxEAMxg/PysRATMRMzMzETMxMBMiJzUWMzI2NREhERQGAzQzMhUUBiMiRnVURklNRwExznCmplNTpv4UGfATVlQEqvspssEHa5WVR08AAAEAoAAABPYGFAAOAElAIwQHBwgCAwMGBQUQDgoNDQgICgoPCwAEBwcICA4OAwYKFQMPAD8/MxI5ETMROREzPxEBMxEzETMREjkRMxEzMxEzEjkRMzEwATcBIQEBIQEHESERIREHAcWFATkBWP5EAdf+oP6+g/7PATEQAmCqAVT+G/2HAcVp/qQGFP1K/gABAKAAAAHRBhQAAwATtwABAQQCAAEVAD8/EQEzETMxMCEhESEB0f7PATEGFAAAAQCgAAAHQgRzACMATUAmFBMTAAABAQocHBsbJQ0JCQoKJBMNDREgBREFR1kXERALDxwBChUAPzMzPz8zKxEAMxI5ETMRATMRMxI5ETMRMxESOREzEjkRMzEwISERNCYjIgYVESERMxczNjYzMhczNjYzMhYVESERNCYjIgYVBIn+z1FXdWr+z+kpES2qbvtZGy2vbr7D/s5RV3BvAo15eazF/fIEXo9NV6ROVsPX/ScCjXl5oK4AAAEAoAAABKgEcwAUADFAGAEAABYNCQkKChUNBRERBUdZERALDwEKFQA/Mz8/KxESADkRATMRMxI5ETMRMzEwISERNCYjIgYVESERMxczNjYzMhYVBKj+z1ZegHL+z+kpETOzcsPKAo15eavG/fIEXo9RU9PHAAACAFz/7ASYBHMACwAZAChAFAYMDBsAExMaFglHWRYQDwNHWQ8WAD8rABg/KxEBMxEzETMRMzEwARQWMzI2NTQmIyIGBRAAISImAjUQACEyFhIBk217emtse3psAwX+4P7/ofaEAR4BA6H2hAIxpqqpp6ampaf+7/7MjQEIsAESATCM/voAAAIAoP4UBLQEcwATAB8AQ0AiGAYGBwoDAwcdEAcQICEDCgANDRRHWQ0QCA8HGwAbR1kAFgA/KwAYPz8/KxESADk5ERIBOTkRMxEzETMRMxEzMTAFIicjFhURIREzFzM2MzISERQCBgMiBgcVFBYzMhE0JgMGxXAQEP7P+CsOa9LG4GnC3XFoAmt0zWUUj4wW/jsGSpGm/s7+8LP++IoDk4ugIbScAVKlpQAAAgBc/hQEcQRzAAsAIABCQCEWAx0DGhoZGSIJDw8hGhsXDx4WDBISB0dZEhAMAEdZDBYAPysAGD8rERIAOTkYPz8RATMRMxEzETMSOTkRMzEwJTI2NzU0JiMiERQWFyICERASMzIWFzM3IREhETQ3IwYGAm90bAVve9drBMbg5cdqnjwIGwEC/s4NDTGi24WmJbSc/q6opu8BMQEQARIBNFBUj/m2AdU9a1FUAAEAoAAAA3cEcwAQACVAEQISDQkJCgoRCw8KFQ0FBQAQAD8yETk/PxEBMxEzEjkRMzEwATIXAyYjIgYVESERMxczNjYDED4pFyU1kqP+z+ctDzSxBHMJ/uIKlof9xwRevF5zAAABAFz/7AOsBHMAJQA/QB8GGRQMAAAnHxQUJgAMFB8MHwodFx1GWRcQAwpGWQMWAD8rABg/KxESADk5ETMRMxEBMxEzETMRMxI5OTEwARQGIyImJzUWFjMyNTQmJicuAjU0NjMyFwcmJiMiFRQWFx4CA6zv7nqsS1XVUaYsbFqBeTfn1Mq/XFSSTIdXk4N6OgFMrLQhIPwoNmAkLTkmNlx3V5WjWNwkLkkpPDs1XHgAAAEAL//sAzcFTAAVAD1AHgwIDw8TEwoIAhEIERYXChIPEkZZDQwPDwUAR1kFFgA/KwAYPzPBKxEAMxESATk5ETMRMzMRMxESOTEwJTI3FQYjIiY1ESM1NzczFSEVIREUFgJ3UHByprenkqhYwwE5/sdJ3yPjM7m5AhuBZuzu5f3lQT4AAAEAmv/sBKIEXgAUADJAGAIRERQUFgsICBUSCQ8CBQ4FDkdZBRYAFQA/PysREgA5GD8zEQEzETMRMxEzEjkxMCEnIwYGIyImNREhERQWMzI2NREhEQO4KRAxtHPFyAExVl6AcgExj05V08YC2f1zeXmrxgIO+6IAAAEAAAAABI0EXgALACxAFAsABQUCCQkKCg0CAQEMCQEPBQAVAD8yPzMRATMRMxEzETMREjkRMzMxMCEBIRMWFzM2NxMhAQGq/lYBP9gkCQYFKNcBP/5WBF79g3lsYIUCffuiAAABABQAAAbFBF4AHQBKQCQFBAoQDwMdABcXAwoDBxsbHBwfBwYGHhcKCgMFDw8bBg8ABRUAPzM/MzMREjk5ETMRATMRMxEzETMREhc5ETMzETMzETMzMTAhAwMjAyEBIRMWFzM2NzcTIRMeAxczNjY3EyEBBDdWdAfM/rj+wgEwgR8gBgQfEIoBUIMEERANAQYJLgqGASv+vgGHAe78iwRe/hGF6kylVQIY/egWVmFdHEj7LAHv+6IAAQAKAAAElgReAAsATEAkBgUAAQkDAwIEAgEEBQEFCwgHBw0KCwsMCQYDAAABCAsVBAEPAD8zPzMSOREzMzMRATMRMxEzETMSOTkRMxEzERI5ETMSORI5MTABASETEyEBASEDAyEBhf6YAVrZ2wFa/pQBff6l6+z+pgI7AiP+nAFk/d39xQF//oEAAQAA/hQEjQReABYATEAlCxQUEBYWBAQBCAgJCRgQAQAAFwsUFBIEFhUQEg0SR1kNGwgADwA/Mj8rEQAzGD8zEjkRMxEBMxEzMxEzETMREjkRMxESOREzMTARIRMWFzM2NxMhAQYGIyInNRYzMjY3NwFO0xsKBgsgzwFH/idB8aFPTDdBUXkiEgRe/YtScGdbAnX7E6+uEfINY2Q3AAABADcAAAOqBF4ACQA9QB4DBwQHAQAACwgBAQoHBAUFBEZZBQ8CCAEBCEZZARUAPysREgA5GD8rERIAOREBMxEzETMREjk5ETMxMCEhNQEhNSEVASEDqvyNAgb+GQNC/ggCCrQCwenG/VEAAQAf/rwC1QW2AB8ANkAZAxQIHx8RGBggDRwcIQQDExMNGxscJA0MAwA/Mz8zERI5ETMzEQEzETMSOREzMxEzMzkxMAE0JiM1MjY1NRE0NjMVBgYVEQYHFRYVFREUFhcVIiY1AR+DfX6CwvRjSwbk6kpk9MIBDldc71hSCAE+mX3hA0ZE/tW8IgwjsQn+1URGA+J9mgAAAQHH/i8CogYOAAMAFLcCAwMEBQMAAAA/LxESATkRMzEwATMRIwHH29sGDvghAAEAUv68AwgFtgAiADZAGR8aDQAAEAgIJBQEBCMfHg4OFAUUFQMFBCQAPzM/MxESOREzMxEBMxEzEjkRMzMRMzM5MTAFFAYGIzU2NjURNTQ2NzUmJxE0Jic1MhYWFREVFBYzFSIGFQIIUr2nY0t2c+MGSmSnvlF7hX2DLXByNeICREcBKwtWaxEMIrwBK0ZEA+E1c27+wgpUVO9SYQAAAQBYAicEOQN9ABUAN0AYBgARCwALAw8PFwMWDw4OBgQDAwsREQAGAC8zMn0vMzMRMxEzETMRATMRMxESOTkRMxEzMTABIgYHNTYzMhYXFjMyNjcVBiMiJicmAUI3fTZnmUmBS4FiNX42ZZtCeFqDAqBDNudtICA3QDnnbRolOAACAHX+jwHTBF4AAwAPACZAEgMKCgIEBBEQAAcNB1RZDQ8DIgA/PysRADMREgE5ETMzETMxMBMzEyEBFAYjIiY1NDYzMhao9DP+pgFeWlZTW11RVFwCXvwxBSVUVlhSUVlYAAEAj//sBBAFywAbAERAIxEIGhoFGxsCFxcKAgocHRkTT1kIDk9ZAAUIGQgZCAYbGQYHAD8/Ejk5Ly8SOTkrKxESATk5ETMREjkRMzMRMzIxMCUkERASNzUzFRYXByYmIyIGFRAzMjY3FQYHFSMCM/5c0dOypoVaSHw+eXTtUoRkf4qysDsB+gEFARwfpp4JQesdJKer/rkfLf49CbwAAQBSAAAEagXLAB0AWEAsDxILAgkNDRoWFgIYEBgSEhAeHwwYGRhRWQkZGQATEg8SD05ZEhgABU9ZAAcAPysAGD8rERIAORE5GC8zKxEAMxESATk5ETMREjk5ETMzETMSORI5MTABMhcHJiMiBhUVIRUhFRQHIREhNTY2NTUjNTM1NDYCvMPDXZ1zTlQBd/6JlwLO++hnTbKy5QXLUuZAWVPB24+qTv78+CxyZJHbw8nZAAIAcQD+BCEEqgAbACcAPEAiEAwTCQUXGgIIAA4OIhwAHBwoKRcTEBoCDAkFCAcVFR8HJQAvM8YyERIXORESATkRMxDCMhESFzkxMBM0Nyc3FzYzMhc3FwcWFRQHFwcnBiMiJwcnNyY3FBYzMjY1NCYjIga8NoGTf1tqaVt/loE1NX2Sf19lc1R9kX82z21QUW9xT05vAtNmX3+TfzU3gY+BWW5rXH2RfTMze5F9XWhNb25OUG5wAAABAAYAAASJBbYAFgBxQDgOEhQSFQ0REQAJBQMFAgoGBgAAFgEBAgIYFhUVFwYSExJSWQADAQMTDwoODw5SWQcPDwwBFQYMGAA/PzMSOS8zKxEAMxgQxjIREjkrEQAzEQEzETMRMxEzERI5ETMRMxI5OREzETMRMxI5OREzMTABASEBMxUjFTMVIxUhNSM1MzUjNTMBIQJIAQgBOf6Bw/b29v7h9/f3vv6HATwDXAJa/RWyirLd3bKKsgLrAAIBx/4vAqIGDgADAAcAI0APAgYGAwcHCAkEAwQDBwAAAD8vOTkvLxESATkRMzMRMzEwATMRIxEzESMBx9vb29sGDvzR/n/80QAAAgBq/+wDfwYpAC0AOABVQCoKERcRBQUuIgAnHBwzFwAXOToDNjYTGTExKhMqDiUfJUtZHxYIDktZCAEAPysAGD8rERIAOTkRMxEzETMRMxESATk5ETMzETMRMzMzETMREjkxMBM0NjcmNTQ2MzIXByYmIyIGFRQWFxYWFRQHFhYVFAYjIic1FhYzMjU0JiYnJiY3FBYXNjU0JicGBnlIPYXftqrBUkSNTlFKY3Kjmn0+P+/Jy5JRxkbCJVpQt4rfgnROZYUlNQMlT4MoVJWDnlS+IDMuMDFKLUCpbbFTKGlKlK9Pzyk5dScwMyJKnYtDaC45WUReMQ5PAAIBFwT4A8UGBAALABcAIEANEgwABgAAGBkPAwMVCQAvMzMRMxESATkRMxDMMjEwATQ2MzIWFRQGIyImJTQ2MzIWFRQGIyImARdLQEJLTEFASwGTUTxBTU5APFEFfUFGSj08SUY/RkFIPz1IQQAAAwBk/+wGRAXLABUAJQA1AEJAHwMOCRMOEyYuJhYuHhYeNjcFCwARCxELERoqIhMyGgQAPzM/MxI5OS8vETMRMxESATk5ETMRMxESOTkRMxEzMTABIgYVEDMyNjcVBiMiJjU0NjMyFwcmATQSJDMyBBIVFAIEIyIkAjcUEgQzMiQSNTQCJCMiBAIDf2FqyzmEOXiEzODdx5WcSnH8fcgBXsrIAV7Kwv6i0M/+osOOpAEcoqQBG6Ok/uSipP7lowPylIP+6B4dvzn63dz1Tqg6/unIAV7KyP6iysX+ptDPAVrGpP7lo6QBHKKkARujpP7kAAACAC8C8AK4BccAFwAhAEFAHhgHARcXHhAHCwseBx4iIw8NDR8LCxMBGxsAAAQTHwA/xDkvMhEzEjkRMzISORESATk5ETMREjkRMxI5ETMxMAEnBgYjIiY1NDY3NzQjIgcnNjYzMhYVESUUFjMyNjU1BwYCMR8rfEp1faW5Y39RiEJCn2OJlf5ELiBNWWORAvxuOkB1am1tCQR1PYcgMo6D/kbVJiRTQSQGCgAAAgBSAF4EmgQEAAYADQBcQCsKDQwJCwsMAwYCBAQBBQwIDAwPDQYGAwcAAAoDAwILBAQMBQUBDgkCAggBAC8zMxEzERI5LzMzETMSOREzMxEzETMRMxEBMxEzENYyMhEzwTIRMxEzEMEyMTATARcBAQcBJQEXAQEHAVIBc9v+6QEX2/6NAfoBctz+6QEX3P6OAj0Bx3f+pP6kdwHFGgHHd/6k/qR3AcUAAQBYAPgEOQM/AAUAGkAKAQAABwMBAQYDBAAvMxI5LwEyETMRMzEwJSMRITUhBDnb/PoD4fgBbNsA//8APQGoAlYCogIGABAAAAAEAGT/7AZEBcsADAAVACUANQBmQDEEAwIFBQcAERENAw0HBwgDCC4mJhYuHhYeNjcCBgYNDQQVBAgVCQgJCAkaKiITMhoEAD8zPzMSOTkvLxEzETMREjkRMxI5ERIBOTkRMxEzERI5OREzETMREjkRMxI5ETMRMzEwARQHEyMDIxEjESEyFgEzMjY1NCYjIwE0EiQzMgQSFRQCBCMiJAI3FBIEMzIkEjU0AiQjIgQCBIWP7f6yL+UBCLWp/n8fQjk4RR39YMgBXsrIAV7Kwv6i0M/+osOOpAEcoqQBG6Ok/uSipP7lowOJqj/+cAFS/q4DlIz+8jlCQTb+38gBXsrI/qLKxf6m0M8BWsak/uWjpAEcoqQBG6Ok/uQAAAH/+gYUBAYG3QADABK2AAUBBAIBAAA/MxEBMxEzMTABITUhBAb79AQMBhTJAAACAFwDGQMQBcsADgAaABhACQAPDxwbEgwYBAAvM8QyERIBOREzMTATNDY2MzIWFhUUBgYjIiY3FBYzMjY1NCYjIgZcXKBeXKFdXaBdkcm/WUJCWltBQFsEcVygXlyiXF2hWseRQFpcPj9eXAACAFgAAAQ5BQIACwAPADZAGA8HBwYKCgsMAQEDCwsQEQ0MCwkBAQYEAgAvMzMzETMzLzMREgE5ETMzETMRMxEzMxEzMTABITUhETMRIRUhESMBNSEVAdv+fQGD2wGD/n3b/n0D4QKi2wGF/nvb/n/+39vbAAEALwJKAr4FywAWAChAEhUMAQYAEQERFxgJDh8CFRUBIAA/MxI5PzMREgE5OREzMxEzMzEwASE1NzY2NTQmIyIHJzYzMhYVFAYHByECvv154GY5MChRY3uTvYmeXoFpAWACSqjbZFkyJihYmIGFdVWWdV8AAQA7AjkCtgXJACUAPkAdFAsCGRkAACAGIAsQBgsGJicDFBQVFQkcIx8OCSEAPzM/MxI5LzMSORESATk5ETMRMxESOREzETMSOTEwARQHFRYWFRQGIyInNRYzMjU0JiMjNTMyNjU0JiMiBgcnNjYzMhYCmqpeaLC6j4KUe49YTnBcU1EyMy9UOWU+l2d/ogThjzcNFG5PeYtGvlprNTWgNDkmMiYojS8+gAABAUwE2QONBiEACAAcQAsDBEAIAAAJCgSAAAAvGs0REgE5ETMayTIxMAE1NjchFQYGBwFMrD8BVjT7RwTZG8hlFTTNMgAAAQCg/hQEqAReABgAP0AfCwYGCQkaEhYAFRUWFhkHFw8WGxIMDwMPA0dZDxYKFQA/PysREgA5ORg/PzMRATMRMxEzEjkRMxEzEjkxMAEUFjMyNjURIREjJyMGBiMiJicXFxEhESEB0VhefnIBMecrDyp4WD5oIAUF/s8BMQHReXmtxAIO+6KWVVUuLFWd/sAGSgABAHH+/ASPBhQADwAvQBULEAQFAQABARARCAgBDg4DTVkOBQEALzMvKxESADkYLxESATkRMxDEMhE5MTABIxEjESMRBiMiJjUQNjMhBI+hpqI+VNjL2ugCXP78BlD5sAMzEvr7AQT+AAEAdQIpAdMDfQALABVACQYAAAwDCVRZAwAvKxEBMxEzMTATNDYzMhYVFAYjIiZ1WlZTW11RVFwC01RWWFJRWVgAAAH/2/4UAaIAAAASADRAFxANDQUFAAsLExQQEA0UDRMJDgYJCQMbAD8zETMvERI5ERI5fC8REgE5ETMzEjkRMzEwBRQGIyInNRYWMzI1NCc3MwcWFgGil55ORBtbGUimTsEbSlj6gHIVqAcOPlMZmj0YZQAAAQBcAkoCSAW2AAoAKkATBAkAAAgBAQsMCAcHAQQECR4BIAA/PzMREjkRMxESATkRMzMSOTkxMAEjETc3BgcHJyUzAkjuAwUbME5tAS2/AkoBvnBfJCo9f+sAAgA5AvAC4QXHAAsAFwAfQA0MBhIABgAYGQ8DFQkfAD8zxDIREgE5OREzETMxMAEUBiMiJjU0NjMyFgUUFjMyNjU0JiMiBgLht5+ZubOjmLr+I0FISD8/SEhBBFyrwcWnqcLFpmRlZWRkY2MAAgBSAF4EmgQEAAYADQBaQCoLCQkKBwgEAgIDAAUBCAwICA4NBgYDBwAACgMDBAkCAggBAQUOCwQEDAUALzMzETMREjkvMzMRMxI5ETMzETMRMxEzEQEzETMQ1jLBMjMRMxDBMjMRMzEwAQEnAQE3AQUBJwEBNwEEmv6N2wEW/urbAXP+Bv6N2wEW/urbAXMCI/47dwFcAVx3/jka/jt3AVwBXHf+OQD//wAuAAAGkgW2ACYAe9IAACcCFwLJAAABBwI8A5z9twAJswMCEhgAPzU1AP//AC4AAAa0BbYAJgB70gAAJwIXAskAAAEHAHQD9v23AAeyAhAYAD81AP//AFoAAAawBckAJgB1HwAAJwIXAxAAAAEHAjwDuv23AAmzAwItGAA/NTUAAAIAPf55A9cEXgAbACcARkAkIhwcGwAABwcUFA4oDikAGxAbAgkDGxslJR9UWSUPEQpPWREjAD8rABg/KxEAMxgvX15dEQEzERI5ETMROREzMxEzMTABFRQGBwYGFRQWMzI2NxcGBiMiJjU0Njc2NjU1ARQGIyImNTQ2MzIWAslZbG05V1lPtGBmYvdq3Pthj181AShaVlNbXVFUXAJeSmKOTU5YPzlKOirdOEXBqWyeaUZKPTsBVlRWWFJRWVgA//8AAAAABYUHcwImACQAAAEHAEMABgFSAAizAhYFJgArNf//AAAAAAWFB3MCJgAkAAABBwB2ANEBUgAIswIWBSYAKzX//wAAAAAFhQdzAiYAJAAAAQcBSwBWAVIACLMCGwUmACs1//8AAAAABYUHYAImACQAAAEHAVIAVgFSAAizAhIFJgArNf//AAAAAAWFB1YCJgAkAAABBwBqAFYBUgAKtAMCIwUmACs1Nf//AAAAAAWFBwoCJgAkAAABBgFQdVgACbMDAiMDAD81NQAAAgAAAAAHJQW2AA8AEwBvQDwGEwMQEwMRBBEBCg4OAQEFDAgAABUEBQUUEANMWQoNTFkMCgENAxAKEAoBBhMJBglMWQYDBBIBDkxZARIAPysAGD8/KxEAMxESOTkYLy9fXl0rKxEBMxEzETMRMzMSOREzETMRMxESFzkRMzEwISERIQMhASEVIREhFSERIQEhESMHJfyX/hWW/sUCjwSW/c0CDv3yAjP7HQF6fwFc/qQFtv7+v/7+hwFgAk4A//8Ad/4UBNEFywImACYAAAAHAHoCHQAA//8AuAAABAIHcwImACgAAAEHAEP/twFSAAizARQFJgArNf//ALgAAAQCB3MCJgAoAAABBwB2AFwBUgAIswEUBSYAKzX//wCvAAAEFAdzAiYAKAAAAQcBS//1AVIACLMBGQUmACs1//8AuAAABAIHVgImACgAAAEHAGr/+QFSAAq0AgEhBSYAKzU1//8AKgAAAtsHcwImACwAAAEHAEP+3gFSAAizARQFJgArNf//AEIAAAMuB3MCJgAsAAABBwB2/6EBUgAIswEUBSYAKzX////cAAADQQdzAiYALAAAAQcBS/8iAVIACLMBGQUmACs1//8AOQAAAucHVgImACwAAAEHAGr/IgFSAAq0AgEhBSYAKzU1AAIALwAABXUFtgAMABgASEAkDQYGGhQSFhYMAQoKGRUMAAxMWRIAAAoCChZMWQoSAhFMWQIDAD8rABg/KxESADkYLzMrEQAzEQEzETMzMxEzMxEzETMxMBMzESEgABEQACEhESMlNCYjIxEzFSMRMyAviQHLAWYBjP5l/nz+YokEBNDSo+3tgwHCA1ICZP6G/q3+l/6AAlSN6O/+mv7+rP//ALgAAAXJB2ACJgAxAAABBwFSANMBUgAIswEUBSYAKzX//wB3/+wF5wdzAiYAMgAAAQcAQwB1AVIACLMCHgUmACs1//8Ad//sBecHcwImADIAAAEHAHYBRgFSAAizAh4FJgArNf//AHf/7AXnB3MCJgAyAAABBwFLAMMBUgAIswIjBSYAKzX//wB3/+wF5wdgAiYAMgAAAQcBUgDDAVIACLMCGgUmACs1//8Ad//sBecHVgImADIAAAEHAGoAwwFSAAq0AwIrBSYAKzU1AAEAgQEMBBAEmgALAB1ACwYDAAkJDA0JBgMAABkvMjIyERIBOREzMzMxMAEBNwEBFwEBBwEBJwGs/tWYAS0BMZn+zwEtlf7P/tOWAtMBLZr+1QErlv7P/tGYAS3+1ZgAAAMAd/+mBecGBAATABsAIgA5QBwXHxwUFAocAAoAIyQWHiEZDRlMWQ0EAyFMWQMTAD8rABg/KxESADk5ERIBOTkRMxEzERI5OTEwARAAISInByc3JhEQACEyFzcXBxYBFBcBJiMiBgU0JwEWMyAF5/6Y/rDFi1qiWsYBaQFRxpJUoFjC+9U4AfpUabm8AuYz/gxMaAFzAt3+lf56QYdsiMIBgwFtAYFGfWiDwv6Gv3QC9C359bR1/REn//8Arv/sBV4HcwImADgAAAEHAEMAKwFSAAizARsFJgArNf//AK7/7AVeB3MCJgA4AAABBwB2AQ4BUgAIswEbBSYAKzX//wCu/+wFXgdzAiYAOAAAAQcBSwCaAVIACLMBIAUmACs1//8Arv/sBV4HVgImADgAAAEHAGoAmgFSAAq0AgEoBSYAKzU1//8AAAAABP4HcwImADwAAAEHAHYAgQFSAAizAREFJgArNQACALgAAASqBbYADAAVADZAHBEAABcNCQUFBgYWBA1NWQkVTVkECQQJBgcDBhIAPz8SOTkvLysrEQEzETMRMzMRMxEzMTABFAQhIxEhESEVMzIEATMyNjU0JiMjBKr+4/76mf7KATay/gEM/URkkY5/iHwDAuX4/tsFtuXu/jxpemtoAAABAKD/7AVoBh8ANQBUQCsUByEhJycAAC4aDg43Li8vNg4aIQcAJycHGgMYKjMqR1kzAC8VERhKWREWAD8rABg/PysREgAXOREzETMRMxEBMxEzETMRMxI5ETMROREzMzEwARQOBBUUFhceAhUUBiMiJic1FhYzMjU0JiYnJiY1NDY3NjY1NCYjIgYVESERNCQhMgQE4SpASkAqNUKSaTPp42OQPDWlQKggUkp+YkZGTT5/ZHSC/s8BJQEC9AEmBNlAYUw6MCoWGzQoW2J6TqyuHSLyJDJ7KTM8Kkh3UUBqMTdQLjxRaWD7mARzyeOxAP//AFb/7AQ7BiECJgBEAAABBgBDowAACLMCKxEmACs1//8AVv/sBDsGIQImAEQAAAEGAHZtAAAIswIrESYAKzX//wBW/+wEOwYgAiYARAAAAQYBS/f/AAizAjARJgArNf//AFb/7AQ7Bg4CJgBEAAABBgFSCgAACLMCJxEmACs1//8AVv/sBDsGBAImAEQAAAEGAGoGAAAKtAMCOBEmACs1Nf//AFb/7AQ7BrICJgBEAAABBgFQKQAACrQDAiYRJgArNTUAAwBW/+wG/gR1ACgAMgA4AIVARTU2AxggIDIUDQ0yMgk2NiYfHzotCQk5JSAjNSBKWTU1BgMYABsbM0pZGxANKUtZDQ0WBhYRRlkWEAAjRlkABgYvRlkGFgA/KxEAMysAGD8rERIAORgvKwAYPysREgA5ORI5GC8rERIAOREBMxEzETMRMzMREjkRMxE5ETMSOTkROTEwBSImJwYGIyImNTQ2Nzc1NCYjIgcnNjMyFzY2MzIAFRUhFhYzMjcVBgYBBwYGFRQzMjY1ASIHISYmBTGJ4UhixZ6hw/Lxv1lNjKVjvenjc0KteN0BAP0tBZCCxLhPuP1BcXx8jGV4AiPZEQGuAmoUZWl1Wb2lsqkJBlRFQk3KZYNAQf7t6ZSCkljsJygCGgQEV1uBemUB8OxwfAD//wBc/hQD3QRzAiYARgAAAAcAegGDAAD//wBc/+wEYgYhAiYASAAAAQYAQ6kAAAizAiQRJgArNf//AFz/7ARiBiECJgBIAAABBgB2cwAACLMCJBEmACs1//8AXP/sBGIGIQImAEgAAAEGAUsIAAAIswIpESYAKzX//wBc/+wEYgYEAiYASAAAAQYAahIAAAq0AwIxESYAKzU1////mwAAAdwGIQImAPMAAAEHAEP+TwAAAAizAQwRJgArNf//AJEAAALSBiECJgDzAAABBwB2/0UAAAAIswEMESYAKzX///+GAAAC6wYhAiYA8wAAAQcBS/7MAAAACLMBEREmACs1////4wAAApEGBAImAPMAAAEHAGr+zAAAAAq0AgEZESYAKzU1AAIAXP/sBJgGIwAbACcAdkA7ABkCFxccBQgDCwMCAhEcHAsLKSIRESgZABgCBQgDCQkYGAIWFh8UFB9GWRQUDgIOJUZZDhYDAktZAwEAPysAGD8rERIAORgvKxESADkREjkRMxESOTkREjk5EQEzETMRMxEzERI5ETMREjk5ETMREjk5MTABJic3Fhc3FwcWEhUQACMiADU0ADMyFzcmJwcnATQmIyIGFRQWMzI2Af5QSGWQcuFkqpyU/t7/9f7aAQTdzUYIQ33mZAISemt5b3hwe2oFFzUnsEFMi5poj/6V6P7o/scBEuvpARFiBKJ3jpz9aGyCiZKMjqQA//8AoAAABKgGDgImAFEAAAEGAVIzAAAIswEZESYAKzX//wBc/+wEmAYhAiYAUgAAAQYAQ6EAAAizAiIRJgArNf//AFz/7ASYBiECJgBSAAABBwB2AIcAAAAIswIiESYAKzX//wBc/+wEmAYhAiYAUgAAAQYBSwwAAAizAicRJgArNf//AFz/7ASYBg4CJgBSAAABBgFSDAAACLMCHhEmACs1//8AXP/sBJgGBAImAFIAAAEGAGoMAAAKtAMCLxEmACs1NQADAFgA3QQ5BMcAAwAPABsAKkASFgoKEAQEAAMDHQAcGRMNBwABAC8zxDLEMhEBMxEzERI5ETMzETMxMBM1IRUFNDYzMhYVFAYjIiYRNDYzMhYVFAYjIiZYA+H9g0pCQklKQUFLSkJDSEpBQUsCZNvb70xLTklGUk4DBEtNUUdGUU4AAwBc/7QEmASRABMAGwAjADlAHBcfHBQUChwACgAlJBYeIRkNGUdZDRADIUdZAxYAPysAGD8rERIAOTkREgE5OREzETMREjk5MTABEAAhIicHJzcmERAAITIXNxcHFgEUFwEmIyIGBTQnARYzMjYEmP7g/v9+bEOaRJgBHgEDhHQ3mDqO/PsTAT0rP3psAc0M/ssmNnprAjH+7/7MLWVpZJwBFAESATA0UmxUm/77XkgB2xelp1E8/jIPqf//AJr/7ASiBiECJgBYAAABBgBDqQAACLMBHREmACs1//8Amv/sBKIGIQImAFgAAAEHAHYApgAAAAizAR0RJgArNf//AJr/7ASiBiECJgBYAAABBgFLMQAACLMBIhEmACs1//8Amv/sBKIGBAImAFgAAAEGAGovAAAKtAIBKhEmACs1Nf//AAD+FASNBiECJgBcAAABBgB2PQAACLMBHxEmACs1AAIAoP4UBLQGFAAVACEAREAiHwYGIxUMEBoTDw8QECIRABAbDBUJAwkdR1kJFgMWR1kDEAA/KwAYPysREgA5ORg/PxEBMxEzETMzEjk5ETMRMzEwATY2MzISERACIyInIxcXESERIREHBxciBgcVFBYzMhE0JgHRMqJpxuDfx9VoDgcH/s8BMQcH6XFoAmt0zWUDzVFV/sv+8/7v/syJPl7+OwgA/nl4SE6LoCG0nAFSpaUA//8AAP4UBI0GBAImAFwAAAEGAGrcAAAKtAIBLBEmACs1Nf//AAAAAAWFBv4CJgAkAAABBwFNAFgBUgAIswIRBSYAKzX//wBW/+wEOwWsAiYARAAAAQYBTQoAAAizAiYRJgArNf//AAAAAAWFB30CJgAkAAABBwFOAFYBUgAIswIRBSYAKzX//wBW/+wEOwYrAiYARAAAAQYBTgwAAAizAiYRJgArNf//AAD+FAWFBbwCJgAkAAAABwFRA3sAAP//AFb+FARMBHUCJgBEAAAABwFRAqwAAP//AHf/7ATRB3MCJgAmAAABBwB2AQoBUgAIswEfBSYAKzX//wBc/+wD/AYhAiYARgAAAQYAdm8AAAizAR4RJgArNf//AHf/7ATRB3MCJgAmAAABBwFLAKoBUgAIswEkBSYAKzX//wBc/+wEDgYhAiYARgAAAQYBS+8AAAizASMRJgArNf//AHf/7ATRB2YCJgAmAAABBwFPAdkBUgAIswEeBSYAKzX//wBc/+wD3QYUAiYARgAAAQcBTwE7AAAACLMBHREmACs1//8Ad//sBNEHcwImACYAAAEHAUwArAFSAAizARwFJgArNf//AFz/7AQfBiECJgBGAAABBgFMAAAACLMBGxEmACs1//8AuAAABXUHcwImACcAAAEHAUwAaAFSAAizAhUFJgArNf//AFz/7AYlBhQCJgBHAAAABwI4A28AAP//AC8AAAV1BbYCBgCSAAAAAgBc/+wFDAYUABsAKABgQDEOAx8KFxkQDAwVExcXKiYDAykJGgYABiNHWRYODw5KWRMPBg8GDxEYFREAABxHWQAWAD8rABg/PxI5OS8vETMrEQAzKxESADk5EQEzETMRMxEzMzMRMzMSOTkSOTEwBSICERASMzIWFzMmNTUhNSE1IRUzFSMRIycjBicyNjc1NCYjIgYVFBYB+MDcxuBsqTUKF/7FATsBMpub+EAMaExuaQRlhW9TZBQBIAECARoBDVRQg2Uzx6Ghx/tUkaXze5YcsIGKqZWWAP//ALgAAAQCBv4CJgAoAAABBwFN//cBUgAIswEPBSYAKzX//wBc/+wEYgWsAiYASAAAAQYBTfsAAAizAh8RJgArNf//ALgAAAQCB30CJgAoAAABBwFO/+oBUgAIswEPBSYAKzX//wBc/+wEYgYrAiYASAAAAQYBTgAAAAizAh8RJgArNf//ALgAAAQCB0kCJgAoAAABBwFPAS8BNQAIswETBSYAKzX//wBc/+wEYgYUAiYASAAAAQcBTwE/AAAACLMCIxEmACs1//8AuP4UBAIFtgImACgAAAAHAVECNQAA//8AXP4oBGIEcwImAEgAAAAHAVECPwAU//8ArwAABBQHcwImACgAAAEHAUz/9QFSAAizAREFJgArNf//AFz/7ARiBiECJgBIAAABBgFMAgAACLMCIREmACs1//8Ad//sBScHcwImACoAAAEHAUsAuAFSAAizASgFJgArNf//AAb+FARtBiECJgBKAAABBgFL3AAACLMDThEmACs1//8Ad//sBScHfQImACoAAAEHAU4AvgFSAAizAR4FJgArNf//AAb+FARtBisCJgBKAAABBgFO4gAACLMDRBEmACs1//8Ad//sBScHZgImACoAAAEHAU8B/AFSAAizASIFJgArNf//AAb+FARtBhQCJgBKAAABBwFPAQgAAAAIswNIESYAKzX//wB3/jsFJwXLAiYAKgAAAAcCOQEXAAD//wAG/hQEbQYhAiYASgAAAQYCOloAAAizA0URJgArNf//ALgAAAVmB3MCJgArAAABBwFLAKABUgAIswEZBSYAKzX//wCgAAAEqAeqAiYASwAAAQcBSwA1AYkAC7QBIyMKAAA/3hE1AAACAAAAAAYfBbYAEwAXAFFAKBQRBQUCAAQEGRcQCAgNCwkJGBcHTFkWAwsLEAAMFwwXDAkSDgMFCRIAPzM/MxI5OS8vETMzMxEzMysRATMRMzMzETMzETMRMzMzETMzMTABMxUjESERIREhESM1MzUhFSE1IQE1IRUFZrm5/sv9vf7KuLgBNgJDATX+y/29BPTH+9MCd/2JBC3HwsLC/cO0tAABAAQAAASoBhQAHABUQCoSCAEAAB4WCRMQCAgNCwkJHRYZBBkER1kTCwwLSlkQDBkMGQwJDgABCRUAPzM/Ejk5Ly8RMysRADMrERIAOREBMxEzMzMRMzMSOREzETMSOTEwISERNCMiBhURIREjNTM1IRUhFSEVFAczNjMyFhUEqP7PtH9z/s+cnAExATv+xQ4SZt7FygJQ8q/C/i8ErMehoccSU7ak0scA////8QAAAy4HYAImACwAAAEH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AQcDfATLAAAACrQDAjURJgArNTX//wAAAAAFhQhYAiYAJAAAAQcDfQUnAVIACrQDAisFJgArNTX//wBW/+wEOwcGAiYARAAAAQcDfQTNAAAACrQDAkARJgArNTX//wAAAAAFhQhiAiYAJAAAAQcDfgUnAVIACrQDAhcFJgArNTX//wBW/+wEOwcQAiYARAAAAQcDfgTNAAAACrQDAiwRJgArNTUABAAA/lIFhQd9AAcADQAbACQAACEDIQMhASEBAQImJwYDAQYGIyImJzMeAjMyNwE0MzIVFAYjIgQ3av3rav6yAgQBewIG/f6TJQghnAJGDNymrs8IqgQvVVXOEP5/pqZUUqYBXP6kBbz6RAJgAdl8JID+BwUdmri2nC82GH33apaWR07//wBW/lIEOwYrAiYARAAAACcCZwTJAAABBgFO+wAACLMDLxEmACs1//8AuP5SBAIFtgImACgAAAAHAmcE2wAA//8AXP5SBGIEcwImAEgAAAAHAmcE3QAA//8AuAAABAIH9gImACgAAAEHAmYExQFSAAizARAFJgArNf//AFz/7ARiBqQCJgBIAAABBwJmBNsAAAAIswIgESYAKzX//wC4AAAEAgdgAiYAKAAAAQcBUv/vAVIACLMBEAUmACs1//8AXP/sBGIGDgImAEgAAAEGAVL7AAAIswIgESYAKzX//wC4AAAE9QfRAiYAKAAAAQcDdwS8AVIACrQCARIFJgArNTX//wBc/+wFBAZ/AiYASAAAAQcDdwTLAAAACrQDAiIRJgArNTX////NAAAEAgfRAiYAKAAAAQcDeATBAVIACrQCARkFJgArNTX////f/+wEYgZ/AiYASAAAAQcDeATTAAAACrQDAikRJgArNTX//wC4AAAEmwhKAiYAKAAAAQcDeQS8AVIACrQCASUFJgArNTX//wBc/+wEqgb4AiYASAAAAQcDeQTLAAAACrQDAjURJgArNTX//wC4AAAEAghiAiYAKAAAAQcDegS8AVIACrQCASoFJgArNTX//wBc/+wEYgcQAiYASAAAAQcDegTLAAAACrQDAjoRJgArNTX//wCr/lIEEAdzAiYAKAAAACcBS//xAVIBBwJnBNsAAAAIswEZBSYAKzX//wBc/lQEYgYhAiYASAAAACYBS/MAAQcCZwTdAAIACLMCKREmACs1//8AQgAAAtsH9gIm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ANH/hQAKANP/hQAKANX/hQAKANf/hQAKANn/hQAKANv/hQAKAN3/hQAKAN//wwAKAOH/wwAKAOP/wwAKAOX/wwAKAPr/wwAKAQb/wwAKAQj/wwAKAQ3/wwAKAQ//hQAKARH/hQAKARP/hQAKARX/hQAKARf/wwAKARn/wwAKAR3/wwAKASH/wwAKASQAKQAKASYAKQAKASv/wwAKAS3/wwAKAS//wwAKATH/wwAKATP/wwAKATX/wwAKATYAKQAKATgAFAAKAToAFAAKAUP/cQAKAUT/rgAKAUb/rgAKAUj/hQAKAUr/wwAKAVb/cQAKAV//cQAKAWL/cQAKAWn/cQAKAXn/rgAKAXr/1wAKAXv/1wAKAX7/rgAKAYH/wwAKAYL/1wAKAYP/1wAKAYT/1wAKAYf/1wAKAYn/1wAKAYz/rgAKAY7/wwAKAY//rgAKAZD/rgAKAZP/rgAKAZn/rgAKAaT/hQAKAar/cQAKAa7/hQAKAbX/hQAKAcr/1wAKAc7/cQAKAc//hQAKAdX/cQAKAdj/hQAKAdv/hQAKAd7/hQAKAer/hQAKAe3/hQAKAe7/wwAKAfL/cQAKAfoAKQAKAfwAKQAKAf4AKQAKAgAAFAAKAlf/wwAKAlj/cQAKAln/rgAKAmD/hQAKAmL/wwAKAmr/hQAKAnL/cQAKAnP/cQAKAn3/7AAKAn//hQAKAoX/hQAKAof/hQAKAon/hQAKAo3/hQAKArL/hQAKArT/hQAKAs7/hQAKAs//cQAKAtn/cQAKAtr/1wAKAtv/cQAKAtz/1wAKAt3/cQAKAt7/1wAKAuD/hQAKAuL/1wAKAuT/1wAKAvD/hQAKAvL/hQAKAvT/hQAKAwn/cQAKAwr/hQAKAwv/cQAKAwz/hQAKAxH/hQAKAxL/cQAKAxb/hQAKAxr/hQAKAxv/hQAKAxz/cQAKAx3/cQAKAx7/rgAKAx//cQAKAyD/rgAKAyH/cQAKAyL/rgAKAyP/cQAKAyX/cQAKAyb/rgAKAyf/cQAKAyj/rgAKAyn/cQAKAyr/rgAKAyv/cQAKAyz/rgAKAy3/cQAKAy7/rgAKAy//cQAKAzD/rgAKAzH/cQAKAzL/rgAKAzP/cQAKAzT/rgAKAzb/hQAKAzj/hQAKAzr/hQAKAzz/hQAKA0D/hQAKA0L/hQAKA0T/hQAKA0r/hQAKA0z/hQAKA07/hQAKA1L/hQAKA1T/hQAKA1b/hQAKA1j/hQAKA1r/hQAKA1z/hQAKA17/hQAKA2D/hQAKA2L/wwAKA2T/wwAKA2b/wwAKA2j/wwAKA2r/wwAKA2z/wwAKA27/wwAKA28AFAAKA3EAFAAKA3MAFAAKA48AKQALAC0AuAAPACb/mgAPACr/mgAPADL/mgAPADT/mgAPADf/cQAPADj/1wAPADn/hQAPADr/hQAPADz/hQAPAIn/mgAPAJT/mgAPAJX/mgAPAJb/mgAPAJf/mgAPAJj/mgAPAJr/mgAPAJv/1wAPAJz/1wAPAJ3/1wAPAJ7/1wAPAJ//hQAPAMj/mgAPAMr/mgAPAMz/mgAPAM7/mgAPAN7/mgAPAOD/mgAPAOL/mgAPAOT/mgAPAQ7/mgAPARD/mgAPARL/mgAPART/mgAPAST/cQAPASb/cQAPASr/1wAPASz/1wAPAS7/1wAPATD/1wAPATL/1wAPATT/1wAPATb/hQAPATj/hQAPATr/hQAPAUf/mgAPAWb/rgAPAW3/rgAPAXH/cQAPAXL/hQAPAXP/mgAPAXX/hQAPAXj/hQAPAYX/1wAPAZ3/cQAPAZ//mgAPAab/cQAPAbj/mgAPAbv/mgAPAbz/cQAPAb7/rgAPAcH/XAAPAcT/cQAPAdz/mgAPAeH/hQAPAeT/mgAPAfr/hQAPAfz/hQAPAf7/hQAPAgD/hQAPAlT/hQAPAl//mgAPAmH/1wAPAmz/mgAPAnz/XAAPAn7/mgAPAoD/hQAPAoL/hQAPAoT/mgAPAob/mgAPAoj/mgAPAor/mgAPAoz/mgAPAqn/cQAPAqr/mgAPArH/mgAPArP/mgAPArX/cQAPArb/mgAPArf/hQAPArn/hQAPAr3/cQAPAr7/mgAPAr//XAAPAsD/hQAPAsH/XAAPAsL/hQAPAsX/hQAPAsf/hQAPAtT/XAAPAtX/hQAPAu//mgAPAvH/mgAPAvP/mgAPAv3/XAAPAv7/hQAPAw3/hQAPAw7/mgAPAw//hQAPAxD/mgAPAxX/mgAPAxf/cQAPAxj/mgAPA0n/mgAPA0v/mgAPA03/mgAPA0//mgAPA1H/mgAPA1P/mgAPA1X/mgAPA1f/mgAPA1n/mgAPA1v/mgAPA13/mgAPA1//mgAPA2H/1wAPA2P/1wAPA2X/1wAPA2f/1wAPA2n/1wAPA2v/1wAPA23/1wAPA2//hQAPA3H/hQAPA3P/hQAPA4//cQAQADf/rgAQAST/rgAQASb/rgAQAXH/rgAQAZ3/rgAQAab/rgAQAbz/rgAQAcT/rgAQAdz/1wAQAeT/1wAQAqn/rgAQAqr/1wAQArX/rgAQArb/1wAQAr3/rgAQAr7/1wAQAxf/rgAQAxj/1wAQA4//rgARACb/mgARACr/mgARADL/mgARADT/mgARADf/cQARADj/1wARADn/hQARADr/hQARADz/hQARAIn/mgARAJT/mgARAJX/mgARAJb/mgARAJf/mgARAJj/mgARAJr/mgARAJv/1wARAJz/1wARAJ3/1wARAJ7/1wARAJ//hQARAMj/mgARAMr/mgARAMz/mgARAM7/mgARAN7/mgARAOD/mgARAOL/mgARAOT/mgARAQ7/mgARARD/mgARARL/mgARART/mgARAST/cQARASb/cQARASr/1wARASz/1wARAS7/1wARATD/1wARATL/1wARATT/1wARATb/hQARATj/hQARATr/hQARAUf/mgARAWb/rgARAW3/rgARAXH/cQARAXL/hQARAXP/mgARAXX/hQARAXj/hQARAYX/1wARAZ3/cQARAZ//mgARAab/cQARAbj/mgARAbv/mgARAbz/cQARAb7/rgARAcH/XAARAcT/cQARAdz/mgARAeH/hQARAeT/mgARAfr/hQARAfz/hQARAf7/hQARAgD/hQARAlT/hQARAl//mgARAmH/1wARAmz/mgARAnz/XAARAn7/mgARAoD/hQARAoL/hQARAoT/mgARAob/mgARAoj/mgARAor/mgARAoz/mgARAqn/cQARAqr/mgARArH/mgARArP/mgARArX/cQARArb/mgARArf/hQARArn/hQARAr3/cQARAr7/mgARAr//XAARAsD/hQARAsH/XAARAsL/hQARAsX/hQARAsf/hQARAtT/XAARAtX/hQARAu//mgARAvH/mgARAvP/mgARAv3/XAARAv7/hQARAw3/hQARAw7/mgARAw//hQARAxD/mgARAxX/mgARAxf/cQARAxj/mgARA0n/mgARA0v/mgARA03/mgARA0//mgARA1H/mgARA1P/mgARA1X/mgARA1f/mgARA1n/mgARA1v/mgARA13/mgARA1//mgARA2H/1wARA2P/1wARA2X/1wARA2f/1wARA2n/1wARA2v/1wARA23/1wARA2//hQARA3H/hQARA3P/hQARA4//cQAkAAX/cQAkAAr/cQAkACb/1wAkACr/1wAkAC0BCgAkADL/1wAkADT/1wAkADf/cQAkADn/rgAkADr/rgAkADz/hQAkAIn/1wAkAJT/1wAkAJX/1wAkAJb/1wAkAJf/1wAkAJj/1wAkAJr/1wAkAJ//hQAkAMj/1wAkAMr/1wAkAMz/1wAkAM7/1wAkAN7/1wAkAOD/1wAkAOL/1wAkAOT/1wAkAQ7/1wAkARD/1wAkARL/1wAkART/1wAkAST/cQAkASb/cQAkATb/rgAkATj/hQAkATr/hQAkAUf/1wAkAfr/rgAkAfz/rgAkAf7/rgAkAgD/hQAkAgf/cQAkAgv/cQAkAl//1wAkA0n/1wAkA0v/1wAkA03/1wAkA0//1wAkA1H/1wAkA1P/1wAkA1X/1wAkA1f/1wAkA1n/1wAkA1v/1wAkA13/1wAkA1//1wAkA2//hQAkA3H/hQAkA3P/hQAkA4//cQAlAA//rgAlABH/rgAlACT/1wAlADf/wwAlADn/7AAlADr/7AAlADv/1wAlADz/7AAlAD3/7AAlAIL/1wAlAIP/1wAlAIT/1wAlAIX/1wAlAIb/1wAlAIf/1wAlAJ//7AAlAML/1wAlAMT/1wAlAMb/1wAlAST/wwAlASb/wwAlATb/7AAlATj/7AAlATr/7AAlATv/7AAlAT3/7AAlAT//7AAlAUP/1wAlAaD/7AAlAfr/7AAlAfz/7AAlAf7/7AAlAgD/7AAlAgj/rgAlAgz/rgAlAlj/1wAlAx3/1wAlAx//1wAlAyH/1wAlAyP/1wAlAyX/1wAlAyf/1wAlAyn/1wAlAyv/1wAlAy3/1wAlAy//1wAlAzH/1wAlAzP/1wAlA2//7AAlA3H/7AAlA3P/7AAlA4//wwAmACb/1wAmACr/1wAmADL/1wAmADT/1wAmAIn/1wAmAJT/1wAmAJX/1wAmAJb/1wAmAJf/1wAmAJj/1wAmAJr/1wAmAMj/1wAmAMr/1wAmAMz/1wAmAM7/1wAmAN7/1wAmAOD/1wAmAOL/1wAmAOT/1wAmAQ7/1wAmARD/1wAmARL/1wAmART/1wAmAUf/1wAmAl//1wAmA0n/1wAmA0v/1wAmA03/1wAmA0//1wAmA1H/1wAmA1P/1wAmA1X/1wAmA1f/1wAmA1n/1wAmA1v/1wAmA13/1wAmA1//1wAnAA//rgAnABH/rgAnACT/1wAnADf/wwAnADn/7AAnADr/7AAnADv/1wAnADz/7AAnAD3/7AAnAIL/1wAnAIP/1wAnAIT/1wAnAIX/1wAnAIb/1wAnAIf/1wAnAJ//7AAnAML/1wAnAMT/1wAnAMb/1wAnAST/wwAnASb/wwAnATb/7AAnATj/7AAnATr/7AAnATv/7AAnAT3/7AAnAT//7AAnAUP/1wAnAaD/7AAnAfr/7AAnAfz/7AAnAf7/7AAnAgD/7AAnAgj/rgAnAgz/rgAnAlj/1wAnAx3/1wAnAx//1wAnAyH/1wAnAyP/1wAnAyX/1wAnAyf/1wAnAyn/1wAnAyv/1wAnAy3/1wAnAy//1wAnAzH/1wAnAzP/1wAnA2//7AAnA3H/7AAnA3P/7AAnA4//wwAoAC0AewApAA//hQApABH/hQApACIAKQApACT/1wApAIL/1wApAIP/1wApAIT/1wApAIX/1wApAIb/1wApAIf/1wApAML/1wApAMT/1wApAMb/1wApAUP/1wApAgj/hQApAgz/hQApAlj/1wApAx3/1wApAx//1wApAyH/1wApAyP/1wApAyX/1wApAyf/1wApAyn/1wApAyv/1wApAy3/1wApAy//1wApAzH/1wApAzP/1wAuACb/1wAuACr/1wAuADL/1wAuADT/1wAuAIn/1wAuAJT/1wAuAJX/1wAuAJb/1wAuAJf/1wAuAJj/1wAuAJr/1wAuAMj/1wAuAMr/1wAuAMz/1wAuAM7/1wAuAN7/1wAuAOD/1wAuAOL/1wAuAOT/1wAuAQ7/1wAuARD/1wAuARL/1wAuART/1wAuAUf/1wAuAl//1wAuA0n/1wAuA0v/1wAuA03/1wAuA0//1wAuA1H/1wAuA1P/1wAuA1X/1wAuA1f/1wAuA1n/1wAuA1v/1wAuA13/1wAuA1//1wAvAAX/XAAvAAr/XAAvACb/1wAvACr/1wAvADL/1wAvADT/1wAvADf/1wAvADj/7AAvADn/1wAvADr/1wAvADz/wwAvAIn/1wAvAJT/1wAvAJX/1wAvAJb/1wAvAJf/1wAvAJj/1wAvAJr/1wAvAJv/7AAvAJz/7AAvAJ3/7AAvAJ7/7AAvAJ//wwAvAMj/1wAvAMr/1wAvAMz/1wAvAM7/1wAvAN7/1wAvAOD/1wAvAOL/1wAvAOT/1wAvAQ7/1wAvARD/1wAvARL/1wAvART/1wAvAST/1wAvASb/1wAvASr/7AAvASz/7AAvAS7/7AAvATD/7AAvATL/7AAvATT/7AAvATb/1wAvATj/wwAvATr/wwAvAUf/1wAvAfr/1wAvAfz/1wAvAf7/1wAvAgD/wwAvAgf/XAAvAgv/XAAvAl//1wAvAmH/7AAvA0n/1wAvA0v/1wAvA03/1wAvA0//1wAvA1H/1wAvA1P/1wAvA1X/1wAvA1f/1wAvA1n/1wAvA1v/1wAvA13/1wAvA1//1wAvA2H/7AAvA2P/7AAvA2X/7AAvA2f/7AAvA2n/7AAvA2v/7AAvA23/7AAvA2//wwAvA3H/wwAvA3P/wwAvA4//1wAyAA//rgAyABH/rgAyACT/1wAyADf/wwAyADn/7AAyADr/7AAyADv/1wAyADz/7AAyAD3/7AAyAIL/1wAyAIP/1wAyAIT/1wAyAIX/1wAyAIb/1wAyAIf/1wAyAJ//7AAyAML/1wAyAMT/1wAyAMb/1wAyAST/wwAyASb/wwAyATb/7AAyATj/7AAyATr/7AAyATv/7AAyAT3/7AAyAT//7AAyAUP/1wAyAaD/7AAyAfr/7AAyAfz/7AAyAf7/7AAyAgD/7AAyAgj/rgAyAgz/rgAyAlj/1wAyAx3/1wAyAx//1wAyAyH/1wAyAyP/1wAyAyX/1wAyAyf/1wAyAyn/1wAyAyv/1wAyAy3/1wAyAy//1wAyAzH/1wAyAzP/1wAyA2//7AAyA3H/7AAyA3P/7AAyA4//wwAzAA/+9gAzABH+9gAzACT/mgAzADv/1wAzAD3/7AAzAIL/mgAzAIP/mgAzAIT/mgAzAIX/mgAzAIb/mgAzAIf/mgAzAML/mgAzAMT/mgAzAMb/mgAzATv/7AAzAT3/7AAzAT//7AAzAUP/mgAzAgj+9gAzAgz+9gAzAlj/mgAzAx3/mgAzAx//mgAzAyH/mgAzAyP/mgAzAyX/mgAzAyf/mgAzAyn/mgAzAyv/mgAzAy3/mgAzAy//mgAzAzH/mgAzAzP/mgA0AA//rgA0ABH/rgA0ACT/1wA0ADf/wwA0ADn/7AA0ADr/7AA0ADv/1wA0ADz/7AA0AD3/7AA0AIL/1wA0AIP/1wA0AIT/1wA0AIX/1wA0AIb/1wA0AIf/1wA0AJ//7AA0AML/1wA0AMT/1wA0AMb/1wA0AST/wwA0ASb/wwA0ATb/7AA0ATj/7AA0ATr/7AA0ATv/7AA0AT3/7AA0AT//7AA0AUP/1wA0AaD/7AA0Afr/7AA0Afz/7AA0Af7/7AA0AgD/7AA0Agj/rgA0Agz/rgA0Alj/1wA0Ax3/1wA0Ax//1wA0AyH/1wA0AyP/1wA0AyX/1wA0Ayf/1wA0Ayn/1wA0Ayv/1wA0Ay3/1wA0Ay//1wA0AzH/1wA0AzP/1wA0A2//7AA0A3H/7AA0A3P/7AA0A4//wwA3AA//hQA3ABD/rgA3ABH/hQA3ACIAKQA3ACT/cQA3ACb/1wA3ACr/1wA3ADL/1wA3ADT/1wA3ADcAKQA3AET/XAA3AEb/cQA3AEf/cQA3AEj/cQA3AEr/cQA3AFD/mgA3AFH/mgA3AFL/cQA3AFP/mgA3AFT/cQA3AFX/mgA3AFb/hQA3AFj/mgA3AFn/1wA3AFr/1wA3AFv/1wA3AFz/1wA3AF3/rgA3AIL/cQA3AIP/cQA3AIT/cQA3AIX/cQA3AIb/cQA3AIf/cQA3AIn/1wA3AJT/1wA3AJX/1wA3AJb/1wA3AJf/1wA3AJj/1wA3AJr/1wA3AKL/cQA3AKP/XAA3AKT/XAA3AKX/XAA3AKb/XAA3AKf/XAA3AKj/XAA3AKn/cQA3AKr/cQA3AKv/cQA3AKz/cQA3AK3/cQA3ALT/cQA3ALX/cQA3ALb/cQA3ALf/cQA3ALj/cQA3ALr/cQA3ALv/mgA3ALz/mgA3AL3/mgA3AL7/mgA3AL//1wA3AML/cQA3AMP/XAA3AMT/cQA3AMX/XAA3AMb/cQA3AMf/XAA3AMj/1wA3AMn/cQA3AMr/1wA3AMv/cQA3AMz/1wA3AM3/cQA3AM7/1wA3AM//cQA3ANH/cQA3ANP/cQA3ANX/cQA3ANf/cQA3ANn/cQA3ANv/cQA3AN3/cQA3AN7/1wA3AN//cQA3AOD/1wA3AOH/cQA3AOL/1wA3AOP/cQA3AOT/1wA3AOX/cQA3APr/mgA3AQb/mgA3AQj/mgA3AQ3/mgA3AQ7/1wA3AQ//cQA3ARD/1wA3ARH/cQA3ARL/1wA3ARP/cQA3ART/1wA3ARX/cQA3ARf/mgA3ARn/mgA3AR3/hQA3ASH/hQA3ASQAKQA3ASYAKQA3ASv/mgA3AS3/mgA3AS//mgA3ATH/mgA3ATP/mgA3ATX/mgA3ATf/1wA3ATz/rgA3AT7/rgA3AUD/rgA3AUP/cQA3AUT/XAA3AUb/XAA3AUf/1wA3AUj/cQA3AUr/hQA3Afv/1wA3Af3/1wA3AgL/rgA3AgP/rgA3AgT/rgA3Agj/hQA3Agz/hQA3Alf/mgA3Alj/cQA3Aln/XAA3Al//1wA3AmD/cQA3AmL/mgA3Ax3/cQA3Ax7/XAA3Ax//cQA3AyD/XAA3AyH/cQA3AyL/XAA3AyP/cQA3AyX/cQA3Ayb/XAA3Ayf/cQA3Ayj/XAA3Ayn/cQA3Ayr/XAA3Ayv/cQA3Ayz/XAA3Ay3/cQA3Ay7/XAA3Ay//cQA3AzD/XAA3AzH/cQA3AzL/XAA3AzP/cQA3AzT/XAA3Azb/cQA3Azj/cQA3Azr/cQA3Azz/cQA3A0D/cQA3A0L/cQA3A0T/cQA3A0n/1wA3A0r/cQA3A0v/1wA3A0z/cQA3A03/1wA3A07/cQA3A0//1wA3A1H/1wA3A1L/cQA3A1P/1wA3A1T/cQA3A1X/1wA3A1b/cQA3A1f/1wA3A1j/cQA3A1n/1wA3A1r/cQA3A1v/1wA3A1z/cQA3A13/1wA3A17/cQA3A1//1wA3A2D/cQA3A2L/mgA3A2T/mgA3A2b/mgA3A2j/mgA3A2r/mgA3A2z/mgA3A27/mgA3A3D/1wA3A48AKQA4AA//1wA4ABH/1wA4ACT/7AA4AIL/7AA4AIP/7AA4AIT/7AA4AIX/7AA4AIb/7AA4AIf/7AA4AML/7AA4AMT/7AA4AMb/7AA4AUP/7AA4Agj/1wA4Agz/1wA4Alj/7AA4Ax3/7AA4Ax//7AA4AyH/7AA4AyP/7AA4AyX/7AA4Ayf/7AA4Ayn/7AA4Ayv/7AA4Ay3/7AA4Ay//7AA4AzH/7AA4AzP/7AA5AA//mgA5ABH/mgA5ACIAKQA5ACT/rgA5ACb/7AA5ACr/7AA5ADL/7AA5ADT/7AA5AET/1wA5AEb/1wA5AEf/1wA5AEj/1wA5AEr/7AA5AFD/7AA5AFH/7AA5AFL/1wA5AFP/7AA5AFT/1wA5AFX/7AA5AFb/7AA5AFj/7AA5AIL/rgA5AIP/rgA5AIT/rgA5AIX/rgA5AIb/rgA5AIf/rgA5AIn/7AA5AJT/7AA5AJX/7AA5AJb/7AA5AJf/7AA5AJj/7AA5AJr/7AA5AKL/1wA5AKP/1wA5AKT/1wA5AKX/1wA5AKb/1wA5AKf/1wA5AKj/1wA5AKn/1wA5AKr/1wA5AKv/1wA5AKz/1wA5AK3/1wA5ALT/1wA5ALX/1wA5ALb/1wA5ALf/1wA5ALj/1wA5ALr/1wA5ALv/7AA5ALz/7AA5AL3/7AA5AL7/7AA5AML/rgA5AMP/1wA5AMT/rgA5AMX/1wA5AMb/rgA5AMf/1wA5AMj/7AA5AMn/1wA5AMr/7AA5AMv/1wA5AMz/7AA5AM3/1wA5AM7/7AA5AM//1wA5ANH/1wA5ANP/1wA5ANX/1wA5ANf/1wA5ANn/1wA5ANv/1wA5AN3/1wA5AN7/7AA5AN//7AA5AOD/7AA5AOH/7AA5AOL/7AA5AOP/7AA5AOT/7AA5AOX/7AA5APr/7AA5AQb/7AA5AQj/7AA5AQ3/7AA5AQ7/7AA5AQ//1wA5ARD/7AA5ARH/1wA5ARL/7AA5ARP/1wA5ART/7AA5ARX/1wA5ARf/7AA5ARn/7AA5AR3/7AA5ASH/7AA5ASv/7AA5AS3/7AA5AS//7AA5ATH/7AA5ATP/7AA5ATX/7AA5AUP/rgA5AUT/1wA5AUb/1wA5AUf/7AA5AUj/1wA5AUr/7AA5Agj/mgA5Agz/mgA5Alf/7AA5Alj/rgA5Aln/1wA5Al//7AA5AmD/1wA5AmL/7AA5Ax3/rgA5Ax7/1wA5Ax//rgA5AyD/1wA5AyH/rgA5AyL/1wA5AyP/rgA5AyX/rgA5Ayb/1wA5Ayf/rgA5Ayj/1wA5Ayn/rgA5Ayr/1wA5Ayv/rgA5Ayz/1wA5Ay3/rgA5Ay7/1wA5Ay//rgA5AzD/1wA5AzH/rgA5AzL/1wA5AzP/rgA5AzT/1wA5Azb/1wA5Azj/1wA5Azr/1wA5Azz/1wA5A0D/1wA5A0L/1wA5A0T/1wA5A0n/7AA5A0r/1wA5A0v/7AA5A0z/1wA5A03/7AA5A07/1wA5A0//7AA5A1H/7AA5A1L/1wA5A1P/7AA5A1T/1wA5A1X/7AA5A1b/1wA5A1f/7AA5A1j/1wA5A1n/7AA5A1r/1wA5A1v/7AA5A1z/1wA5A13/7AA5A17/1wA5A1//7AA5A2D/1wA5A2L/7AA5A2T/7AA5A2b/7AA5A2j/7AA5A2r/7AA5A2z/7AA5A27/7AA6AA//mgA6ABH/mgA6ACIAKQA6ACT/rgA6ACb/7AA6ACr/7AA6ADL/7AA6ADT/7AA6AET/1wA6AEb/1wA6AEf/1wA6AEj/1wA6AEr/7AA6AFD/7AA6AFH/7AA6AFL/1wA6AFP/7AA6AFT/1wA6AFX/7AA6AFb/7AA6AFj/7AA6AIL/rgA6AIP/rgA6AIT/rgA6AIX/rgA6AIb/rgA6AIf/rgA6AIn/7AA6AJT/7AA6AJX/7AA6AJb/7AA6AJf/7AA6AJj/7AA6AJr/7AA6AKL/1wA6AKP/1wA6AKT/1wA6AKX/1wA6AKb/1wA6AKf/1wA6AKj/1wA6AKn/1wA6AKr/1wA6AKv/1wA6AKz/1wA6AK3/1wA6ALT/1wA6ALX/1wA6ALb/1wA6ALf/1wA6ALj/1wA6ALr/1wA6ALv/7AA6ALz/7AA6AL3/7AA6AL7/7AA6AML/rgA6AMP/1wA6AMT/rgA6AMX/1wA6AMb/rgA6AMf/1wA6AMj/7AA6AMn/1wA6AMr/7AA6AMv/1wA6AMz/7AA6AM3/1wA6AM7/7AA6AM//1wA6ANH/1wA6ANP/1wA6ANX/1wA6ANf/1wA6ANn/1wA6ANv/1wA6AN3/1wA6AN7/7AA6AN//7AA6AOD/7AA6AOH/7AA6AOL/7AA6AOP/7AA6AOT/7AA6AOX/7AA6APr/7AA6AQb/7AA6AQj/7AA6AQ3/7AA6AQ7/7AA6AQ//1wA6ARD/7AA6ARH/1wA6ARL/7AA6ARP/1wA6ART/7AA6ARX/1wA6ARf/7AA6ARn/7AA6AR3/7AA6ASH/7AA6ASv/7AA6AS3/7AA6AS//7AA6ATH/7AA6ATP/7AA6ATX/7AA6AUP/rgA6AUT/1wA6AUb/1wA6AUf/7AA6AUj/1wA6AUr/7AA6Agj/mgA6Agz/mgA6Alf/7AA6Alj/rgA6Aln/1wA6Al//7AA6AmD/1wA6AmL/7AA6Ax3/rgA6Ax7/1wA6Ax//rgA6AyD/1wA6AyH/rgA6AyL/1wA6AyP/rgA6AyX/rgA6Ayb/1wA6Ayf/rgA6Ayj/1wA6Ayn/rgA6Ayr/1wA6Ayv/rgA6Ayz/1wA6Ay3/rgA6Ay7/1wA6Ay//rgA6AzD/1wA6AzH/rgA6AzL/1wA6AzP/rgA6AzT/1wA6Azb/1wA6Azj/1wA6Azr/1wA6Azz/1wA6A0D/1wA6A0L/1wA6A0T/1wA6A0n/7AA6A0r/1wA6A0v/7AA6A0z/1wA6A03/7AA6A07/1wA6A0//7AA6A1H/7AA6A1L/1wA6A1P/7AA6A1T/1wA6A1X/7AA6A1b/1wA6A1f/7AA6A1j/1wA6A1n/7AA6A1r/1wA6A1v/7AA6A1z/1wA6A13/7AA6A17/1wA6A1//7AA6A2D/1wA6A2L/7AA6A2T/7AA6A2b/7AA6A2j/7AA6A2r/7AA6A2z/7AA6A27/7AA7ACb/1wA7ACr/1wA7ADL/1wA7ADT/1wA7AIn/1wA7AJT/1wA7AJX/1wA7AJb/1wA7AJf/1wA7AJj/1wA7AJr/1wA7AMj/1wA7AMr/1wA7AMz/1wA7AM7/1wA7AN7/1wA7AOD/1wA7AOL/1wA7AOT/1wA7AQ7/1wA7ARD/1wA7ARL/1wA7ART/1wA7AUf/1wA7Al//1wA7A0n/1wA7A0v/1wA7A03/1wA7A0//1wA7A1H/1wA7A1P/1wA7A1X/1wA7A1f/1wA7A1n/1wA7A1v/1wA7A13/1wA7A1//1wA8AA//hQA8ABH/hQA8ACIAKQA8ACT/hQA8ACb/1wA8ACr/1wA8ADL/1wA8ADT/1wA8AET/mgA8AEb/mgA8AEf/mgA8AEj/mgA8AEr/1wA8AFD/wwA8AFH/wwA8AFL/mgA8AFP/wwA8AFT/mgA8AFX/wwA8AFb/rgA8AFj/wwA8AF3/1wA8AIL/hQA8AIP/hQA8AIT/hQA8AIX/hQA8AIb/hQA8AIf/hQA8AIn/1wA8AJT/1wA8AJX/1wA8AJb/1wA8AJf/1wA8AJj/1wA8AJr/1wA8AKL/mgA8AKP/mgA8AKT/mgA8AKX/mgA8AKb/mgA8AKf/mgA8AKj/mgA8AKn/mgA8AKr/mgA8AKv/mgA8AKz/mgA8AK3/mgA8ALT/mgA8ALX/mgA8ALb/mgA8ALf/mgA8ALj/mgA8ALr/mgA8ALv/wwA8ALz/wwA8AL3/wwA8AL7/wwA8AML/hQA8AMP/mgA8AMT/hQA8AMX/mgA8AMb/hQA8AMf/mgA8AMj/1wA8AMn/mgA8AMr/1wA8AMv/mgA8AMz/1wA8AM3/mgA8AM7/1wA8AM//mgA8ANH/mgA8ANP/mgA8ANX/mgA8ANf/mgA8ANn/mgA8ANv/mgA8AN3/mgA8AN7/1wA8AN//1wA8AOD/1wA8AOH/1wA8AOL/1wA8AOP/1wA8AOT/1wA8AOX/1wA8APr/wwA8AQb/wwA8AQj/wwA8AQ3/wwA8AQ7/1wA8AQ//mgA8ARD/1wA8ARH/mgA8ARL/1wA8ARP/mgA8ART/1wA8ARX/mgA8ARf/wwA8ARn/wwA8AR3/rgA8ASH/rgA8ASv/wwA8AS3/wwA8AS//wwA8ATH/wwA8ATP/wwA8ATX/wwA8ATz/1wA8AT7/1wA8AUD/1wA8AUP/hQA8AUT/mgA8AUb/mgA8AUf/1wA8AUj/mgA8AUr/rgA8Agj/hQA8Agz/hQA8Alf/wwA8Alj/hQA8Aln/mgA8Al//1wA8AmD/mgA8AmL/wwA8Ax3/hQA8Ax7/mgA8Ax//hQA8AyD/mgA8AyH/hQA8AyL/mgA8AyP/hQA8AyX/hQA8Ayb/mgA8Ayf/hQA8Ayj/mgA8Ayn/hQA8Ayr/mgA8Ayv/hQA8Ayz/mgA8Ay3/hQA8Ay7/mgA8Ay//hQA8AzD/mgA8AzH/hQA8AzL/mgA8AzP/hQA8AzT/mgA8Azb/mgA8Azj/mgA8Azr/mgA8Azz/mgA8A0D/mgA8A0L/mgA8A0T/mgA8A0n/1wA8A0r/mgA8A0v/1wA8A0z/mgA8A03/1wA8A07/mgA8A0//1wA8A1H/1wA8A1L/mgA8A1P/1wA8A1T/mgA8A1X/1wA8A1b/mgA8A1f/1wA8A1j/mgA8A1n/1wA8A1r/mgA8A1v/1wA8A1z/mgA8A13/1wA8A17/mgA8A1//1wA8A2D/mgA8A2L/wwA8A2T/wwA8A2b/wwA8A2j/wwA8A2r/wwA8A2z/wwA8A27/wwA9ACb/7AA9ACr/7AA9ADL/7AA9ADT/7AA9AIn/7AA9AJT/7AA9AJX/7AA9AJb/7AA9AJf/7AA9AJj/7AA9AJr/7AA9AMj/7AA9AMr/7AA9AMz/7AA9AM7/7AA9AN7/7AA9AOD/7AA9AOL/7AA9AOT/7AA9AQ7/7AA9ARD/7AA9ARL/7AA9ART/7AA9AUf/7AA9Al//7AA9A0n/7AA9A0v/7AA9A03/7AA9A0//7AA9A1H/7AA9A1P/7AA9A1X/7AA9A1f/7AA9A1n/7AA9A1v/7AA9A13/7AA9A1//7AA+AC0AuABEAAX/7ABEAAr/7ABEAgf/7ABEAgv/7ABFAAX/7ABFAAr/7ABFAFn/1wBFAFr/1wBFAFv/1wBFAFz/1wBFAF3/7ABFAL//1wBFATf/1wBFATz/7ABFAT7/7ABFAUD/7ABFAfv/1wBFAf3/1wBFAgf/7ABFAgv/7ABFA3D/1wBGAAUAKQBGAAoAKQBGAgcAKQBGAgsAKQBIAAX/7ABIAAr/7ABIAFn/1wBIAFr/1wBIAFv/1wBIAFz/1wBIAF3/7ABIAL//1wBIATf/1wBIATz/7ABIAT7/7ABIAUD/7ABIAfv/1wBIAf3/1wBIAgf/7ABIAgv/7ABIA3D/1wBJAAUAewBJAAoAewBJAgcAewBJAgsAewBLAAX/7ABLAAr/7ABLAgf/7ABLAgv/7ABOAEb/1wBOAEf/1wBOAEj/1wBOAFL/1wBOAFT/1wBOAKL/1wBOAKn/1wBOAKr/1wBOAKv/1wBOAKz/1wBOAK3/1wBOALT/1wBOALX/1wBOALb/1wBOALf/1wBOALj/1wBOALr/1wBOAMn/1wBOAMv/1wBOAM3/1wBOAM//1wBOANH/1wBOANP/1wBOANX/1wBOANf/1wBOANn/1wBOANv/1wBOAN3/1wBOAQ//1wBOARH/1wBOARP/1wBOARX/1wBOAUj/1wBOAmD/1wBOAzb/1wBOAzj/1wBOAzr/1wBOAzz/1wBOA0D/1wBOA0L/1wBOA0T/1wBOA0r/1wBOA0z/1wBOA07/1wBOA1L/1wBOA1T/1wBOA1b/1wBOA1j/1wBOA1r/1wBOA1z/1wBOA17/1wBOA2D/1wBQAAX/7ABQAAr/7ABQAgf/7ABQAgv/7ABRAAX/7ABRAAr/7ABRAgf/7ABRAgv/7ABSAAX/7ABSAAr/7ABSAFn/1wBSAFr/1wBSAFv/1wBSAFz/1wBSAF3/7ABSAL//1wBSATf/1wBSATz/7ABSAT7/7ABSAUD/7ABSAfv/1wBSAf3/1wBSAgf/7ABSAgv/7ABSA3D/1wBTAAX/7ABTAAr/7ABTAFn/1wBTAFr/1wBTAFv/1wBTAFz/1wBTAF3/7ABTAL//1wBTATf/1wBTATz/7ABTAT7/7ABTAUD/7ABTAfv/1wBTAf3/1wBTAgf/7ABTAgv/7ABTA3D/1wBVAAUAUgBVAAoAUgBVAET/1wBVAEb/1wBVAEf/1wBVAEj/1wBVAEr/7ABVAFL/1wBVAFT/1wBVAKL/1wBVAKP/1wBVAKT/1wBVAKX/1wBVAKb/1wBVAKf/1wBVAKj/1wBVAKn/1wBVAKr/1wBVAKv/1wBVAKz/1wBVAK3/1wBVALT/1wBVALX/1wBVALb/1wBVALf/1wBVALj/1wBVALr/1wBVAMP/1wBVAMX/1wBVAMf/1wBVAMn/1wBVAMv/1wBVAM3/1wBVAM//1wBVANH/1wBVANP/1wBVANX/1wBVANf/1wBVANn/1wBVANv/1wBVAN3/1wBVAN//7ABVAOH/7ABVAOP/7ABVAOX/7ABVAQ//1wBVARH/1wBVARP/1wBVARX/1wBVAUT/1wBVAUb/1wBVAUj/1wBVAgcAUgBVAgsAUgBVAln/1wBVAmD/1wBVAx7/1wBVAyD/1wBVAyL/1wBVAyb/1wBVAyj/1wBVAyr/1wBVAyz/1wBVAy7/1wBVAzD/1wBVAzL/1wBVAzT/1wBVAzb/1wBVAzj/1wBVAzr/1wBVAzz/1wBVA0D/1wBVA0L/1wBVA0T/1wBVA0r/1wBVA0z/1wBVA07/1wBVA1L/1wBVA1T/1wBVA1b/1wBVA1j/1wBVA1r/1wBVA1z/1wBVA17/1wBVA2D/1wBXAAUAKQBXAAoAKQBXAgcAKQBXAgsAKQBZAAUAUgBZAAoAUgBZAA//rgBZABH/rgBZACIAKQBZAgcAUgBZAgj/rgBZAgsAUgBZAgz/rgBaAAUAUgBaAAoAUgBaAA//rgBaABH/rgBaACIAKQBaAgcAUgBaAgj/rgBaAgsAUgBaAgz/rgBbAEb/1wBbAEf/1wBbAEj/1wBbAFL/1wBbAFT/1wBbAKL/1wBbAKn/1wBbAKr/1wBbAKv/1wBbAKz/1wBbAK3/1wBbALT/1wBbALX/1wBbALb/1wBbALf/1wBbALj/1wBbALr/1wBbAMn/1wBbAMv/1wBbAM3/1wBbAM//1wBbANH/1wBbANP/1wBbANX/1wBbANf/1wBbANn/1wBbANv/1wBbAN3/1wBbAQ//1wBbARH/1wBbARP/1wBbARX/1wBbAUj/1wBbAmD/1wBbAzb/1wBbAzj/1wBbAzr/1wBbAzz/1wBbA0D/1wBbA0L/1wBbA0T/1wBbA0r/1wBbA0z/1wBbA07/1wBbA1L/1wBbA1T/1wBbA1b/1wBbA1j/1wBbA1r/1wBbA1z/1wBbA17/1wBbA2D/1wBcAAUAUgBcAAoAUgBcAA//rgBcABH/rgBcACIAKQBcAgcAUgBcAgj/rgBcAgsAUgBcAgz/rgBeAC0AuACCAAX/cQCCAAr/cQCCACb/1wCCACr/1wCCAC0BCgCCADL/1wCCADT/1wCCADf/cQCCADn/rgCCADr/rgCCADz/hQCCAIn/1wCCAJT/1wCCAJX/1wCCAJb/1wCCAJf/1wCCAJj/1wCCAJr/1wCCAJ//hQCCAMj/1wCCAMr/1wCCAMz/1wCCAM7/1wCCAN7/1wCCAOD/1wCCAOL/1wCCAOT/1wCCAQ7/1wCCARD/1wCCARL/1wCCART/1wCCAST/cQCCASb/cQCCATb/rgCCATj/hQCCATr/hQCCAUf/1wCCAfr/rgCCAfz/rgCCAf7/rgCCAgD/hQCCAgf/cQCCAgv/cQCCAl//1wCCA0n/1wCCA0v/1wCCA03/1wCCA0//1wCCA1H/1wCCA1P/1wCCA1X/1wCCA1f/1wCCA1n/1wCCA1v/1wCCA13/1wCCA1//1wCCA2//hQCCA3H/hQCCA3P/hQCCA4//cQCDAAX/cQCDAAr/cQCDACb/1wCDACr/1wCDAC0BCgCDADL/1wCDADT/1wCDADf/cQCDADn/rgCDADr/rgCDADz/hQCDAIn/1wCDAJT/1wCDAJX/1wCDAJb/1wCDAJf/1wCDAJj/1wCDAJr/1wCDAJ//hQCDAMj/1wCDAMr/1wCDAMz/1wCDAM7/1wCDAN7/1wCDAOD/1wCDAOL/1wCDAOT/1wCDAQ7/1wCDARD/1wCDARL/1wCDART/1wCDAST/cQCDASb/cQCDATb/rgCDATj/hQCDATr/hQCDAUf/1wCDAfr/rgCDAfz/rgCDAf7/rgCDAgD/hQCDAgf/cQCDAgv/cQCDAl//1wCDA0n/1wCDA0v/1wCDA03/1wCDA0//1wCDA1H/1wCDA1P/1wCDA1X/1wCDA1f/1wCDA1n/1wCDA1v/1wCDA13/1wCDA1//1wCDA2//hQCDA3H/hQCDA3P/hQCDA4//cQCEAAX/cQCEAAr/cQCEACb/1wCEACr/1wCEAC0BCgCEADL/1wCEADT/1wCEADf/cQCEADn/rgCEADr/rgCEADz/hQCEAIn/1wCEAJT/1wCEAJX/1wCEAJb/1wCEAJf/1wCEAJj/1wCEAJr/1wCEAJ//hQCEAMj/1wCEAMr/1wCEAMz/1wCEAM7/1wCEAN7/1wCEAOD/1wCEAOL/1wCEAOT/1wCEAQ7/1wCEARD/1wCEARL/1wCEART/1wCEAST/cQCEASb/cQCEATb/rgCEATj/hQCEATr/hQCEAUf/1wCEAfr/rgCEAfz/rgCEAf7/rgCEAgD/hQCEAgf/cQCEAgv/cQCEAl//1wCEA0n/1wCEA0v/1wCEA03/1wCEA0//1wCEA1H/1wCEA1P/1wCEA1X/1wCEA1f/1wCEA1n/1wCEA1v/1wCEA13/1wCEA1//1wCEA2//hQCEA3H/hQCEA3P/hQCEA4//cQCFAAX/cQCFAAr/cQCFACb/1wCFACr/1wCFAC0BCgCFADL/1wCFADT/1wCFADf/cQCFADn/rgCFADr/rgCFADz/hQCFAIn/1wCFAJT/1wCFAJX/1wCFAJb/1wCFAJf/1wCFAJj/1wCFAJr/1wCFAJ//hQCFAMj/1wCFAMr/1wCFAMz/1wCFAM7/1wCFAN7/1wCFAOD/1wCFAOL/1wCFAOT/1wCFAQ7/1wCFARD/1wCFARL/1wCFART/1wCFAST/cQCFASb/cQCFATb/rgCFATj/hQCFATr/hQCFAUf/1wCFAfr/rgCFAfz/rgCFAf7/rgCFAgD/hQCFAgf/cQCFAgv/cQCFAl//1wCFA0n/1wCFA0v/1wCFA03/1wCFA0//1wCFA1H/1wCFA1P/1wCFA1X/1wCFA1f/1wCFA1n/1wCFA1v/1wCFA13/1wCFA1//1wCFA2//hQCFA3H/hQCFA3P/hQCFA4//cQCGAAX/cQCGAAr/cQCGACb/1wCGACr/1wCGAC0BCgCGADL/1wCGADT/1wCGADf/cQCGADn/rgCGADr/rgCGADz/hQCGAIn/1wCGAJT/1wCGAJX/1wCGAJb/1wCGAJf/1wCGAJj/1wCGAJr/1wCGAJ//hQCGAMj/1wCGAMr/1wCGAMz/1wCGAM7/1wCGAN7/1wCGAOD/1wCGAOL/1wCGAOT/1wCGAQ7/1wCGARD/1wCGARL/1wCGART/1wCGAST/cQCGASb/cQCGATb/rgCGATj/hQCGATr/hQCGAUf/1wCGAfr/rgCGAfz/rgCGAf7/rgCGAgD/hQCGAgf/cQCGAgv/cQCGAl//1wCGA0n/1wCGA0v/1wCGA03/1wCGA0//1wCGA1H/1wCGA1P/1wCGA1X/1wCGA1f/1wCGA1n/1wCGA1v/1wCGA13/1wCGA1//1wCGA2//hQCGA3H/hQCGA3P/hQCGA4//cQCHAAX/cQCHAAr/cQCHACb/1wCHACr/1wCHAC0BCgCHADL/1wCHADT/1wCHADf/cQCHADn/rgCHADr/rgCHADz/hQCHAIn/1wCHAJT/1wCHAJX/1wCHAJb/1wCHAJf/1wCHAJj/1wCHAJr/1wCHAJ//hQCHAMj/1wCHAMr/1wCHAMz/1wCHAM7/1wCHAN7/1wCHAOD/1wCHAOL/1wCHAOT/1wCHAQ7/1wCHARD/1wCHARL/1wCHART/1wCHAST/cQCHASb/cQCHATb/rgCHATj/hQCHATr/hQCHAUf/1wCHAfr/rgCHAfz/rgCHAf7/rgCHAgD/hQCHAgf/cQCHAgv/cQCHAl//1wCHA0n/1wCHA0v/1wCHA03/1wCHA0//1wCHA1H/1wCHA1P/1wCHA1X/1wCHA1f/1wCHA1n/1wCHA1v/1wCHA13/1wCHA1//1wCHA2//hQCHA3H/hQCHA3P/hQCHA4//cQCIAC0AewCJACb/1wCJACr/1wCJADL/1wCJADT/1wCJAIn/1wCJAJT/1wCJAJX/1wCJAJb/1wCJAJf/1wCJAJj/1wCJAJr/1wCJAMj/1wCJAMr/1wCJAMz/1wCJAM7/1wCJAN7/1wCJAOD/1wCJAOL/1wCJAOT/1wCJAQ7/1wCJARD/1wCJARL/1wCJART/1wCJAUf/1wCJAl//1wCJA0n/1wCJA0v/1wCJA03/1wCJA0//1wCJA1H/1wCJA1P/1wCJA1X/1wCJA1f/1wCJA1n/1wCJA1v/1wCJA13/1wCJA1//1wCKAC0AewCLAC0AewCMAC0AewCNAC0AewCSAA//rgCSABH/rgCSACT/1wCSADf/wwCSADn/7ACSADr/7ACSADv/1wCSADz/7ACSAD3/7ACSAIL/1wCSAIP/1wCSAIT/1wCSAIX/1wCSAIb/1wCSAIf/1wCSAJ//7ACSAML/1wCSAMT/1wCSAMb/1wCSAST/wwCSASb/wwCSATb/7ACSATj/7ACSATr/7ACSATv/7ACSAT3/7ACSAT//7ACSAUP/1wCSAaD/7ACSAfr/7ACSAfz/7ACSAf7/7ACSAgD/7ACSAgj/rgCSAgz/rgCSAlj/1wCSAx3/1wCSAx//1wCSAyH/1wCSAyP/1wCSAyX/1wCSAyf/1wCSAyn/1wCSAyv/1wCSAy3/1wCSAy//1wCSAzH/1wCSAzP/1wCSA2//7ACSA3H/7ACSA3P/7ACSA4//wwCUAA//rgCUABH/rgCUACT/1wCUADf/wwCUADn/7ACUADr/7ACUADv/1wCUADz/7ACUAD3/7ACUAIL/1wCUAIP/1wCUAIT/1wCUAIX/1wCUAIb/1wCUAIf/1wCUAJ//7ACUAML/1wCUAMT/1wCUAMb/1wCUAST/wwCUASb/wwCUATb/7ACUATj/7ACUATr/7ACUATv/7ACUAT3/7ACUAT//7ACUAUP/1wCUAaD/7ACUAfr/7ACUAfz/7ACUAf7/7ACUAgD/7ACUAgj/rgCUAgz/rgCUAlj/1wCUAx3/1wCUAx//1wCUAyH/1wCUAyP/1wCUAyX/1wCUAyf/1wCUAyn/1wCUAyv/1wCUAy3/1wCUAy//1wCUAzH/1wCUAzP/1wCUA2//7ACUA3H/7ACUA3P/7ACUA4//wwCVAA//rgCVABH/rgCVACT/1wCVADf/wwCVADn/7ACVADr/7ACVADv/1wCVADz/7ACVAD3/7ACVAIL/1wCVAIP/1wCVAIT/1wCVAIX/1wCVAIb/1wCVAIf/1wCVAJ//7ACVAML/1wCVAMT/1wCVAMb/1wCVAST/wwCVASb/wwCVATb/7ACVATj/7ACVATr/7ACVATv/7ACVAT3/7ACVAT//7ACVAUP/1wCVAaD/7ACVAfr/7ACVAfz/7ACVAf7/7ACVAgD/7ACVAgj/rgCVAgz/rgCVAlj/1wCVAx3/1wCVAx//1wCVAyH/1wCVAyP/1wCVAyX/1wCVAyf/1wCVAyn/1wCVAyv/1wCVAy3/1wCVAy//1wCVAzH/1wCVAzP/1wCVA2//7ACVA3H/7ACVA3P/7ACVA4//wwCWAA//rgCWABH/rgCWACT/1wCWADf/wwCWADn/7ACWADr/7ACWADv/1wCWADz/7ACWAD3/7ACWAIL/1wCWAIP/1wCWAIT/1wCWAIX/1wCWAIb/1wCWAIf/1wCWAJ//7ACWAML/1wCWAMT/1wCWAMb/1wCWAST/wwCWASb/wwCWATb/7ACWATj/7ACWATr/7ACWATv/7ACWAT3/7ACWAT//7ACWAUP/1wCWAaD/7ACWAfr/7ACWAfz/7ACWAf7/7ACWAgD/7ACWAgj/rgCWAgz/rgCWAlj/1wCWAx3/1wCWAx//1wCWAyH/1wCWAyP/1wCWAyX/1wCWAyf/1wCWAyn/1wCWAyv/1wCWAy3/1wCWAy//1wCWAzH/1wCWAzP/1wCWA2//7ACWA3H/7ACWA3P/7ACWA4//wwCXAA//rgCXABH/rgCXACT/1wCXADf/wwCXADn/7ACXADr/7ACXADv/1wCXADz/7ACXAD3/7ACXAIL/1wCXAIP/1wCXAIT/1wCXAIX/1wCXAIb/1wCXAIf/1wCXAJ//7ACXAML/1wCXAMT/1wCXAMb/1wCXAST/wwCXASb/wwCXATb/7ACXATj/7ACXATr/7ACXATv/7ACXAT3/7ACXAT//7ACXAUP/1wCXAaD/7ACXAfr/7ACXAfz/7ACXAf7/7ACXAgD/7ACXAgj/rgCXAgz/rgCXAlj/1wCXAx3/1wCXAx//1wCXAyH/1wCXAyP/1wCXAyX/1wCXAyf/1wCXAyn/1wCXAyv/1wCXAy3/1wCXAy//1wCXAzH/1wCXAzP/1wCXA2//7ACXA3H/7ACXA3P/7ACXA4//wwCYAA//rgCYABH/rgCYACT/1wCYADf/wwCYADn/7ACYADr/7ACYADv/1wCYADz/7ACYAD3/7ACYAIL/1wCYAIP/1wCYAIT/1wCYAIX/1wCYAIb/1wCYAIf/1wCYAJ//7ACYAML/1wCYAMT/1wCYAMb/1wCYAST/wwCYASb/wwCYATb/7ACYATj/7ACYATr/7ACYATv/7ACYAT3/7ACYAT//7ACYAUP/1wCYAaD/7ACYAfr/7ACYAfz/7ACYAf7/7ACYAgD/7ACYAgj/rgCYAgz/rgCYAlj/1wCYAx3/1wCYAx//1wCYAyH/1wCYAyP/1wCYAyX/1wCYAyf/1wCYAyn/1wCYAyv/1wCYAy3/1wCYAy//1wCYAzH/1wCYAzP/1wCYA2//7ACYA3H/7ACYA3P/7ACYA4//wwCaAA//rgCaABH/rgCaACT/1wCaADf/wwCaADn/7ACaADr/7ACaADv/1wCaADz/7ACaAD3/7ACaAIL/1wCaAIP/1wCaAIT/1wCaAIX/1wCaAIb/1wCaAIf/1wCaAJ//7ACaAML/1wCaAMT/1wCaAMb/1wCaAST/wwCaASb/wwCaATb/7ACaATj/7ACaATr/7ACaATv/7ACaAT3/7ACaAT//7ACaAUP/1wCaAaD/7ACaAfr/7ACaAfz/7ACaAf7/7ACaAgD/7ACaAgj/rgCaAgz/rgCaAlj/1wCaAx3/1wCaAx//1wCaAyH/1wCaAyP/1wCaAyX/1wCaAyf/1wCaAyn/1wCaAyv/1wCaAy3/1wCaAy//1wCaAzH/1wCaAzP/1wCaA2//7ACaA3H/7ACaA3P/7ACaA4//wwCbAA//1wCbABH/1wCbACT/7ACbAIL/7ACbAIP/7ACbAIT/7ACbAIX/7ACbAIb/7ACbAIf/7ACbAML/7ACbAMT/7ACbAMb/7ACbAUP/7ACbAgj/1wCbAgz/1wCbAlj/7ACbAx3/7ACbAx//7ACbAyH/7ACbAyP/7ACbAyX/7ACbAyf/7ACbAyn/7ACbAyv/7ACbAy3/7ACbAy//7ACbAzH/7ACbAzP/7ACcAA//1wCcABH/1wCcACT/7ACcAIL/7ACcAIP/7ACcAIT/7ACcAIX/7ACcAIb/7ACcAIf/7ACcAML/7ACcAMT/7ACcAMb/7ACcAUP/7ACcAgj/1wCcAgz/1wCcAlj/7ACcAx3/7ACcAx//7ACcAyH/7ACcAyP/7ACcAyX/7ACcAyf/7ACcAyn/7ACcAyv/7ACcAy3/7ACcAy//7ACcAzH/7ACcAzP/7ACdAA//1wCdABH/1wCdACT/7ACdAIL/7ACdAIP/7ACdAIT/7ACdAIX/7ACdAIb/7ACdAIf/7ACdAML/7ACdAMT/7ACdAMb/7ACdAUP/7ACdAgj/1wCdAgz/1wCdAlj/7ACdAx3/7ACdAx//7ACdAyH/7ACdAyP/7ACdAyX/7ACdAyf/7ACdAyn/7ACdAyv/7ACdAy3/7ACdAy//7ACdAzH/7ACdAzP/7ACeAA//1wCeABH/1wCeACT/7ACeAIL/7ACeAIP/7ACeAIT/7ACeAIX/7ACeAIb/7ACeAIf/7ACeAML/7ACeAMT/7ACeAMb/7ACeAUP/7ACeAgj/1wCeAgz/1wCeAlj/7ACeAx3/7ACeAx//7ACeAyH/7ACeAyP/7ACeAyX/7ACeAyf/7ACeAyn/7ACeAyv/7ACeAy3/7ACeAy//7ACeAzH/7ACeAzP/7ACfAA//hQCfABH/hQCfACIAKQCfACT/hQCfACb/1wCfACr/1wCfADL/1wCfADT/1wCfAET/mgCfAEb/mgCfAEf/mgCfAEj/mgCfAEr/1wCfAFD/wwCfAFH/wwCfAFL/mgCfAFP/wwCfAFT/mgCfAFX/wwCfAFb/rgCfAFj/wwCfAF3/1wCfAIL/hQCfAIP/hQCfAIT/hQCfAIX/hQCfAIb/hQCfAIf/hQCfAIn/1wCfAJT/1wCfAJX/1wCfAJb/1wCfAJf/1wCfAJj/1wCfAJr/1wCfAKL/mgCfAKP/mgCfAKT/mgCfAKX/mgCfAKb/mgCfAKf/mgCfAKj/mgCfAKn/mgCfAKr/mgCfAKv/mgCfAKz/mgCfAK3/mgCfALT/mgCfALX/mgCfALb/mgCfALf/mgCfALj/mgCfALr/mgCfALv/wwCfALz/wwCfAL3/wwCfAL7/wwCfAML/hQCfAMP/mgCfAMT/hQCfAMX/mgCfAMb/hQCfAMf/mgCfAMj/1wCfAMn/mgCfAMr/1wCfAMv/mgCfAMz/1wCfAM3/mgCfAM7/1wCfAM//mgCfANH/mgCfANP/mgCfANX/mgCfANf/mgCfANn/mgCfANv/mgCfAN3/mgCfAN7/1wCfAN//1wCfAOD/1wCfAOH/1wCfAOL/1wCfAOP/1wCfAOT/1wCfAOX/1wCfAPr/wwCfAQb/wwCfAQj/wwCfAQ3/wwCfAQ7/1wCfAQ//mgCfARD/1wCfARH/mgCfARL/1wCfARP/mgCfART/1wCfARX/mgCfARf/wwCfARn/wwCfAR3/rgCfASH/rgCfASv/wwCfAS3/wwCfAS//wwCfATH/wwCfATP/wwCfATX/wwCfATz/1wCfAT7/1wCfAUD/1wCfAUP/hQCfAUT/mgCfAUb/mgCfAUf/1wCfAUj/mgCfAUr/rgCfAgj/hQCfAgz/hQCfAlf/wwCfAlj/hQCfAln/mgCfAl//1wCfAmD/mgCfAmL/wwCfAx3/hQCfAx7/mgCfAx//hQCfAyD/mgCfAyH/hQCfAyL/mgCfAyP/hQCfAyX/hQCfAyb/mgCfAyf/hQCfAyj/mgCfAyn/hQCfAyr/mgCfAyv/hQCfAyz/mgCfAy3/hQCfAy7/mgCfAy//hQCfAzD/mgCfAzH/hQCfAzL/mgCfAzP/hQCfAzT/mgCfAzb/mgCfAzj/mgCfAzr/mgCfAzz/mgCfA0D/mgCfA0L/mgCfA0T/mgCfA0n/1wCfA0r/mgCfA0v/1wCfA0z/mgCfA03/1wCfA07/mgCfA0//1wCfA1H/1wCfA1L/mgCfA1P/1wCfA1T/mgCfA1X/1wCfA1b/mgCfA1f/1wCfA1j/mgCfA1n/1wCfA1r/mgCfA1v/1wCfA1z/mgCfA13/1wCfA17/mgCfA1//1wCfA2D/mgCfA2L/wwCfA2T/wwCfA2b/wwCfA2j/wwCfA2r/wwCfA2z/wwCfA27/wwCgAA/+9gCgABH+9gCgACT/mgCgADv/1wCgAD3/7ACgAIL/mgCgAIP/mgCgAIT/mgCgAIX/mgCgAIb/mgCgAIf/mgCgAML/mgCgAMT/mgCgAMb/mgCgATv/7ACgAT3/7ACgAT//7ACgAUP/mgCgAgj+9gCgAgz+9gCgAlj/mgCgAx3/mgCgAx//mgCgAyH/mgCgAyP/mgCgAyX/mgCgAyf/mgCgAyn/mgCgAyv/mgCgAy3/mgCgAy//mgCgAzH/mgCgAzP/mgCiAAX/7ACiAAr/7ACiAgf/7ACiAgv/7ACjAAX/7ACjAAr/7ACjAgf/7ACjAgv/7ACkAAX/7ACkAAr/7ACkAgf/7ACkAgv/7AClAAX/7AClAAr/7AClAgf/7AClAgv/7ACmAAX/7ACmAAr/7ACmAgf/7ACmAgv/7ACnAAX/7ACnAAr/7ACnAgf/7ACnAgv/7ACqAAX/7ACqAAr/7ACqAFn/1wCqAFr/1wCqAFv/1wCqAFz/1wCqAF3/7ACqAL//1wCqATf/1wCqATz/7ACqAT7/7ACqAUD/7ACqAfv/1wCqAf3/1wCqAgf/7ACqAgv/7ACqA3D/1wCrAAX/7ACrAAr/7ACrAFn/1wCrAFr/1wCrAFv/1wCrAFz/1wCrAF3/7ACrAL//1wCrATf/1wCrATz/7ACrAT7/7ACrAUD/7ACrAfv/1wCrAf3/1wCrAgf/7ACrAgv/7ACrA3D/1wCsAAX/7ACsAAr/7ACsAFn/1wCsAFr/1wCsAFv/1wCsAFz/1wCsAF3/7ACsAL//1wCsATf/1wCsATz/7ACsAT7/7ACsAUD/7ACsAfv/1wCsAf3/1wCsAgf/7ACsAgv/7ACsA3D/1wCtAAX/7ACtAAr/7ACtAFn/1wCtAFr/1wCtAFv/1wCtAFz/1wCtAF3/7ACtAL//1wCtATf/1wCtATz/7ACtAT7/7ACtAUD/7ACtAfv/1wCtAf3/1wCtAgf/7ACtAgv/7ACtA3D/1wCyAAX/7ACyAAr/7ACyAFn/1wCyAFr/1wCyAFv/1wCyAFz/1wCyAF3/7ACyAL//1wCyATf/1wCyATz/7ACyAT7/7ACyAUD/7ACyAfv/1wCyAf3/1wCyAgf/7ACyAgv/7ACyA3D/1wC0AAX/7AC0AAr/7AC0AFn/1wC0AFr/1wC0AFv/1wC0AFz/1wC0AF3/7AC0AL//1wC0ATf/1wC0ATz/7AC0AT7/7AC0AUD/7AC0Afv/1wC0Af3/1wC0Agf/7AC0Agv/7AC0A3D/1wC1AAX/7AC1AAr/7AC1AFn/1wC1AFr/1wC1AFv/1wC1AFz/1wC1AF3/7AC1AL//1wC1ATf/1wC1ATz/7AC1AT7/7AC1AUD/7AC1Afv/1wC1Af3/1wC1Agf/7AC1Agv/7AC1A3D/1wC2AAX/7AC2AAr/7AC2AFn/1wC2AFr/1wC2AFv/1wC2AFz/1wC2AF3/7AC2AL//1wC2ATf/1wC2ATz/7AC2AT7/7AC2AUD/7AC2Afv/1wC2Af3/1wC2Agf/7AC2Agv/7AC2A3D/1wC4AAX/1wC4AAr/1wC4Agf/1wC4Agv/1wC6AAX/7AC6AAr/7AC6AFn/1wC6AFr/1wC6AFv/1wC6AFz/1wC6AF3/7AC6AL//1wC6ATf/1wC6ATz/7AC6AT7/7AC6AUD/7AC6Afv/1wC6Af3/1wC6Agf/7AC6Agv/7AC6A3D/1wC/AAUAUgC/AAoAUgC/AA//rgC/ABH/rgC/ACIAKQC/AgcAUgC/Agj/rgC/AgsAUgC/Agz/rgDAAAX/7ADAAAr/7ADAAFn/1wDAAFr/1wDAAFv/1wDAAFz/1wDAAF3/7ADAAL//1wDAATf/1wDAATz/7ADAAT7/7ADAAUD/7ADAAfv/1wDAAf3/1wDAAgf/7ADAAgv/7ADAA3D/1wDBAAUAUgDBAAoAUgDBAA//rgDBABH/rgDBACIAKQDBAgcAUgDBAgj/rgDBAgsAUgDBAgz/rgDCAAX/cQDCAAr/cQDCACb/1wDCACr/1wDCAC0BCgDCADL/1wDCADT/1wDCADf/cQDCADn/rgDCADr/rgDCADz/hQDCAIn/1wDCAJT/1wDCAJX/1wDCAJb/1wDCAJf/1wDCAJj/1wDCAJr/1wDCAJ//hQDCAMj/1wDCAMr/1wDCAMz/1wDCAM7/1wDCAN7/1wDCAOD/1wDCAOL/1wDCAOT/1wDCAQ7/1wDCARD/1wDCARL/1wDCART/1wDCAST/cQDCASb/cQDCATb/rgDCATj/hQDCATr/hQDCAUf/1wDCAfr/rgDCAfz/rgDCAf7/rgDCAgD/hQDCAgf/cQDCAgv/cQDCAl//1wDCA0n/1wDCA0v/1wDCA03/1wDCA0//1wDCA1H/1wDCA1P/1wDCA1X/1wDCA1f/1wDCA1n/1wDCA1v/1wDCA13/1wDCA1//1wDCA2//hQDCA3H/hQDCA3P/hQDCA4//cQDDAAX/7ADDAAr/7ADDAgf/7ADDAgv/7ADEAAX/cQDEAAr/cQDEACb/1wDEACr/1wDEAC0BCgDEADL/1wDEADT/1wDEADf/cQDEADn/rgDEADr/rgDEADz/hQDEAIn/1wDEAJT/1wDEAJX/1wDEAJb/1wDEAJf/1wDEAJj/1wDEAJr/1wDEAJ//hQDEAMj/1wDEAMr/1wDEAMz/1wDEAM7/1wDEAN7/1wDEAOD/1wDEAOL/1wDEAOT/1wDEAQ7/1wDEARD/1wDEARL/1wDEART/1wDEAST/cQDEASb/cQDEATb/rgDEATj/hQDEATr/hQDEAUf/1wDEAfr/rgDEAfz/rgDEAf7/rgDEAgD/hQDEAgf/cQDEAgv/cQDEAl//1wDEA0n/1wDEA0v/1wDEA03/1wDEA0//1wDEA1H/1wDEA1P/1wDEA1X/1wDEA1f/1wDEA1n/1wDEA1v/1wDEA13/1wDEA1//1wDEA2//hQDEA3H/hQDEA3P/hQDEA4//cQDFAAX/7ADFAAr/7ADFAgf/7ADFAgv/7ADGAAX/cQDGAAr/cQDGACb/1wDGACr/1wDGAC0BCgDGADL/1wDGADT/1wDGADf/cQDGADn/rgDGADr/rgDGADz/hQDGAIn/1wDGAJT/1wDGAJX/1wDGAJb/1wDGAJf/1wDGAJj/1wDGAJr/1wDGAJ//hQDGAMj/1wDGAMr/1wDGAMz/1wDGAM7/1wDGAN7/1wDGAOD/1wDGAOL/1wDGAOT/1wDGAQ7/1wDGARD/1wDGARL/1wDGART/1wDGAST/cQDGASb/cQDGATb/rgDGATj/hQDGATr/hQDGAUf/1wDGAfr/rgDGAfz/rgDGAf7/rgDGAgD/hQDGAgf/cQDGAgv/cQDGAl//1wDGA0n/1wDGA0v/1wDGA03/1wDGA0//1wDGA1H/1wDGA1P/1wDGA1X/1wDGA1f/1wDGA1n/1wDGA1v/1wDGA13/1wDGA1//1wDGA2//hQDGA3H/hQDGA3P/hQDGA4//cQDHAAX/7ADHAAr/7ADHAgf/7ADHAgv/7ADIACb/1wDIACr/1wDIADL/1wDIADT/1wDIAIn/1wDIAJT/1wDIAJX/1wDIAJb/1wDIAJf/1wDIAJj/1wDIAJr/1wDIAMj/1wDIAMr/1wDIAMz/1wDIAM7/1wDIAN7/1wDIAOD/1wDIAOL/1wDIAOT/1wDIAQ7/1wDIARD/1wDIARL/1wDIART/1wDIAUf/1wDIAl//1wDIA0n/1wDIA0v/1wDIA03/1wDIA0//1wDIA1H/1wDIA1P/1wDIA1X/1wDIA1f/1wDIA1n/1wDIA1v/1wDIA13/1wDIA1//1wDKACb/1wDKACr/1wDKADL/1wDKADT/1wDKAIn/1wDKAJT/1wDKAJX/1wDKAJb/1wDKAJf/1wDKAJj/1wDKAJr/1wDKAMj/1wDKAMr/1wDKAMz/1wDKAM7/1wDKAN7/1wDKAOD/1wDKAOL/1wDKAOT/1wDKAQ7/1wDKARD/1wDKARL/1wDKART/1wDKAUf/1wDKAl//1wDKA0n/1wDKA0v/1wDKA03/1wDKA0//1wDKA1H/1wDKA1P/1wDKA1X/1wDKA1f/1wDKA1n/1wDKA1v/1wDKA13/1wDKA1//1wDMACb/1wDMACr/1wDMADL/1wDMADT/1wDMAIn/1wDMAJT/1wDMAJX/1wDMAJb/1wDMAJf/1wDMAJj/1wDMAJr/1wDMAMj/1wDMAMr/1wDMAMz/1wDMAM7/1wDMAN7/1wDMAOD/1wDMAOL/1wDMAOT/1wDMAQ7/1wDMARD/1wDMARL/1wDMART/1wDMAUf/1wDMAl//1wDMA0n/1wDMA0v/1wDMA03/1wDMA0//1wDMA1H/1wDMA1P/1wDMA1X/1wDMA1f/1wDMA1n/1wDMA1v/1wDMA13/1wDMA1//1wDOACb/1wDOACr/1wDOADL/1wDOADT/1wDOAIn/1wDOAJT/1wDOAJX/1wDOAJb/1wDOAJf/1wDOAJj/1wDOAJr/1wDOAMj/1wDOAMr/1wDOAMz/1wDOAM7/1wDOAN7/1wDOAOD/1wDOAOL/1wDOAOT/1wDOAQ7/1wDOARD/1wDOARL/1wDOART/1wDOAUf/1wDOAl//1wDOA0n/1wDOA0v/1wDOA03/1wDOA0//1wDOA1H/1wDOA1P/1wDOA1X/1wDOA1f/1wDOA1n/1wDOA1v/1wDOA13/1wDOA1//1wDQAA//rgDQABH/rgDQACT/1wDQADf/wwDQADn/7ADQADr/7ADQADv/1wDQADz/7ADQAD3/7ADQAIL/1wDQAIP/1wDQAIT/1wDQAIX/1wDQAIb/1wDQAIf/1wDQAJ//7ADQAML/1wDQAMT/1wDQAMb/1wDQAST/wwDQASb/wwDQATb/7ADQATj/7ADQATr/7ADQATv/7ADQAT3/7ADQAT//7ADQAUP/1wDQAaD/7ADQAfr/7ADQAfz/7ADQAf7/7ADQAgD/7ADQAgj/rgDQAgz/rgDQAlj/1wDQAx3/1wDQAx//1wDQAyH/1wDQAyP/1wDQAyX/1wDQAyf/1wDQAyn/1wDQAyv/1wDQAy3/1wDQAy//1wDQAzH/1wDQAzP/1wDQA2//7ADQA3H/7ADQA3P/7ADQA4//wwDRAAUAUgDRAAoAUgDRAAwAjwDRACIApADRAEAAjwDRAEUAPQDRAEsAPQDRAE4APQDRAE8APQDRAGAAjwDRAOcAPQDRAOkAewDRAgcAUgDRAgsAUgDSAA//rgDSABH/rgDSACT/1wDSADf/wwDSADn/7ADSADr/7ADSADv/1wDSADz/7ADSAD3/7ADSAIL/1wDSAIP/1wDSAIT/1wDSAIX/1wDSAIb/1wDSAIf/1wDSAJ//7ADSAML/1wDSAMT/1wDSAMb/1wDSAST/wwDSASb/wwDSATb/7ADSATj/7ADSATr/7ADSATv/7ADSAT3/7ADSAT//7ADSAUP/1wDSAaD/7ADSAfr/7ADSAfz/7ADSAf7/7ADSAgD/7ADSAgj/rgDSAgz/rgDSAlj/1wDSAx3/1wDSAx//1wDSAyH/1wDSAyP/1wDSAyX/1wDSAyf/1wDSAyn/1wDSAyv/1wDSAy3/1wDSAy//1wDSAzH/1wDSAzP/1wDSA2//7ADSA3H/7ADSA3P/7ADSA4//wwDUAC0AewDVAAX/7ADVAAr/7ADVAFn/1wDVAFr/1wDVAFv/1wDVAFz/1wDVAF3/7ADVAL//1wDVATf/1wDVATz/7ADVAT7/7ADVAUD/7ADVAfv/1wDVAf3/1wDVAgf/7ADVAgv/7ADVA3D/1wDWAC0AewDXAAX/7ADXAAr/7ADXAFn/1wDXAFr/1wDXAFv/1wDXAFz/1wDXAF3/7ADXAL//1wDXATf/1wDXATz/7ADXAT7/7ADXAUD/7ADXAfv/1wDXAf3/1wDXAgf/7ADXAgv/7ADXA3D/1wDYAC0AewDZAAX/7ADZAAr/7ADZAFn/1wDZAFr/1wDZAFv/1wDZAFz/1wDZAF3/7ADZAL//1wDZATf/1wDZATz/7ADZAT7/7ADZAUD/7ADZAfv/1wDZAf3/1wDZAgf/7ADZAgv/7ADZA3D/1wDaAC0AewDbAAX/7ADbAAr/7ADbAFn/1wDbAFr/1wDbAFv/1wDbAFz/1wDbAF3/7ADbAL//1wDbATf/1wDbATz/7ADbAT7/7ADbAUD/7ADbAfv/1wDbAf3/1wDbAgf/7ADbAgv/7ADbA3D/1wDcAC0AewDdAAX/7ADdAAr/7ADdAFn/1wDdAFr/1wDdAFv/1wDdAFz/1wDdAF3/7ADdAL//1wDdATf/1wDdATz/7ADdAT7/7ADdAUD/7ADdAfv/1wDdAf3/1wDdAgf/7ADdAgv/7ADdA3D/1wDnAAX/7ADnAAr/7ADnAgf/7ADnAgv/7AD4ACb/1wD4ACr/1wD4ADL/1wD4ADT/1wD4AIn/1wD4AJT/1wD4AJX/1wD4AJb/1wD4AJf/1wD4AJj/1wD4AJr/1wD4AMj/1wD4AMr/1wD4AMz/1wD4AM7/1wD4AN7/1wD4AOD/1wD4AOL/1wD4AOT/1wD4AQ7/1wD4ARD/1wD4ARL/1wD4ART/1wD4AUf/1wD4Al//1wD4A0n/1wD4A0v/1wD4A03/1wD4A0//1wD4A1H/1wD4A1P/1wD4A1X/1wD4A1f/1wD4A1n/1wD4A1v/1wD4A13/1wD4A1//1wD5AEb/1wD5AEf/1wD5AEj/1wD5AFL/1wD5AFT/1wD5AKL/1wD5AKn/1wD5AKr/1wD5AKv/1wD5AKz/1wD5AK3/1wD5ALT/1wD5ALX/1wD5ALb/1wD5ALf/1wD5ALj/1wD5ALr/1wD5AMn/1wD5AMv/1wD5AM3/1wD5AM//1wD5ANH/1wD5ANP/1wD5ANX/1wD5ANf/1wD5ANn/1wD5ANv/1wD5AN3/1wD5AQ//1wD5ARH/1wD5ARP/1wD5ARX/1wD5AUj/1wD5AmD/1wD5Azb/1wD5Azj/1wD5Azr/1wD5Azz/1wD5A0D/1wD5A0L/1wD5A0T/1wD5A0r/1wD5A0z/1wD5A07/1wD5A1L/1wD5A1T/1wD5A1b/1wD5A1j/1wD5A1r/1wD5A1z/1wD5A17/1wD5A2D/1wD6AEb/1wD6AEf/1wD6AEj/1wD6AFL/1wD6AFT/1wD6AKL/1wD6AKn/1wD6AKr/1wD6AKv/1wD6AKz/1wD6AK3/1wD6ALT/1wD6ALX/1wD6ALb/1wD6ALf/1wD6ALj/1wD6ALr/1wD6AMn/1wD6AMv/1wD6AM3/1wD6AM//1wD6ANH/1wD6ANP/1wD6ANX/1wD6ANf/1wD6ANn/1wD6ANv/1wD6AN3/1wD6AQ//1wD6ARH/1wD6ARP/1wD6ARX/1wD6AUj/1wD6AmD/1wD6Azb/1wD6Azj/1wD6Azr/1wD6Azz/1wD6A0D/1wD6A0L/1wD6A0T/1wD6A0r/1wD6A0z/1wD6A07/1wD6A1L/1wD6A1T/1wD6A1b/1wD6A1j/1wD6A1r/1wD6A1z/1wD6A17/1wD6A2D/1wD7AAX/XAD7AAr/XAD7ACb/1wD7ACr/1wD7ADL/1wD7ADT/1wD7ADf/1wD7ADj/7AD7ADn/1wD7ADr/1wD7ADz/wwD7AIn/1wD7AJT/1wD7AJX/1wD7AJb/1wD7AJf/1wD7AJj/1wD7AJr/1wD7AJv/7AD7AJz/7AD7AJ3/7AD7AJ7/7AD7AJ//wwD7AMj/1wD7AMr/1wD7AMz/1wD7AM7/1wD7AN7/1wD7AOD/1wD7AOL/1wD7AOT/1wD7AQ7/1wD7ARD/1wD7ARL/1wD7ART/1wD7AST/1wD7ASb/1wD7ASr/7AD7ASz/7AD7AS7/7AD7ATD/7AD7ATL/7AD7ATT/7AD7ATb/1wD7ATj/wwD7ATr/wwD7AUf/1wD7Afr/1wD7Afz/1wD7Af7/1wD7AgD/wwD7Agf/XAD7Agv/XAD7Al//1wD7AmH/7AD7A0n/1wD7A0v/1wD7A03/1wD7A0//1wD7A1H/1wD7A1P/1wD7A1X/1wD7A1f/1wD7A1n/1wD7A1v/1wD7A13/1wD7A1//1wD7A2H/7AD7A2P/7AD7A2X/7AD7A2f/7AD7A2n/7AD7A2v/7AD7A23/7AD7A2//wwD7A3H/wwD7A3P/wwD7A4//1wD9AAX/XAD9AAr/XAD9ACb/1wD9ACr/1wD9ADL/1wD9ADT/1wD9ADf/1wD9ADj/7AD9ADn/1wD9ADr/1wD9ADz/wwD9AIn/1wD9AJT/1wD9AJX/1wD9AJb/1wD9AJf/1wD9AJj/1wD9AJr/1wD9AJv/7AD9AJz/7AD9AJ3/7AD9AJ7/7AD9AJ//wwD9AMj/1wD9AMr/1wD9AMz/1wD9AM7/1wD9AN7/1wD9AOD/1wD9AOL/1wD9AOT/1wD9AQ7/1wD9ARD/1wD9ARL/1wD9ART/1wD9AST/1wD9ASb/1wD9ASr/7AD9ASz/7AD9AS7/7AD9ATD/7AD9ATL/7AD9ATT/7AD9ATb/1wD9ATj/wwD9ATr/wwD9AUf/1wD9Afr/1wD9Afz/1wD9Af7/1wD9AgD/wwD9Agf/XAD9Agv/XAD9Al//1wD9AmH/7AD9A0n/1wD9A0v/1wD9A03/1wD9A0//1wD9A1H/1wD9A1P/1wD9A1X/1wD9A1f/1wD9A1n/1wD9A1v/1wD9A13/1wD9A1//1wD9A2H/7AD9A2P/7AD9A2X/7AD9A2f/7AD9A2n/7AD9A2v/7AD9A23/7AD9A2//wwD9A3H/wwD9A3P/wwD9A4//1wD/AAX/XAD/AAr/XAD/ACb/1wD/ACr/1wD/ADL/1wD/ADT/1wD/ADf/1wD/ADj/7AD/ADn/1wD/ADr/1wD/ADz/wwD/AIn/1wD/AJT/1wD/AJX/1wD/AJb/1wD/AJf/1wD/AJj/1wD/AJr/1wD/AJv/7AD/AJz/7AD/AJ3/7AD/AJ7/7AD/AJ//wwD/AMj/1wD/AMr/1wD/AMz/1wD/AM7/1wD/AN7/1wD/AOD/1wD/AOL/1wD/AOT/1wD/AQ7/1wD/ARD/1wD/ARL/1wD/ART/1wD/AST/1wD/ASb/1wD/ASr/7AD/ASz/7AD/AS7/7AD/ATD/7AD/ATL/7AD/ATT/7AD/ATb/1wD/ATj/wwD/ATr/wwD/AUf/1wD/Afr/1wD/Afz/1wD/Af7/1wD/AgD/wwD/Agf/XAD/Agv/XAD/Al//1wD/AmH/7AD/A0n/1wD/A0v/1wD/A03/1wD/A0//1wD/A1H/1wD/A1P/1wD/A1X/1wD/A1f/1wD/A1n/1wD/A1v/1wD/A13/1wD/A1//1wD/A2H/7AD/A2P/7AD/A2X/7AD/A2f/7AD/A2n/7AD/A2v/7AD/A23/7AD/A2//wwD/A3H/wwD/A3P/wwD/A4//1wEAAAUAUgEAAAoAUgEAAAwAjwEAACIAjwEAAEAAjwEAAEUAPQEAAEsAPQEAAE4APQEAAE8APQEAAGAAjwEAAOcAPQEAAOkAjwEAAgcAUgEAAgsAUgEBAAX/XAEBAAr/XAEBACb/1wEBACr/1wEBADL/1wEBADT/1wEBADf/1wEBADj/7AEBADn/1wEBADr/1wEBADz/wwEBAIn/1wEBAJT/1wEBAJX/1wEBAJb/1wEBAJf/1wEBAJj/1wEBAJr/1wEBAJv/7AEBAJz/7AEBAJ3/7AEBAJ7/7AEBAJ//wwEBAMj/1wEBAMr/1wEBAMz/1wEBAM7/1wEBAN7/1wEBAOD/1wEBAOL/1wEBAOT/1wEBAQ7/1wEBARD/1wEBARL/1wEBART/1wEBAST/1wEBASb/1wEBASr/7AEBASz/7AEBAS7/7AEBATD/7AEBATL/7AEBATT/7AEBATb/1wEBATj/wwEBATr/wwEBAUf/1wEBAfr/1wEBAfz/1wEBAf7/1wEBAgD/wwEBAgf/XAEBAgv/XAEBAl//1wEBAmH/7AEBA0n/1wEBA0v/1wEBA03/1wEBA0//1wEBA1H/1wEBA1P/1wEBA1X/1wEBA1f/1wEBA1n/1wEBA1v/1wEBA13/1wEBA1//1wEBA2H/7AEBA2P/7AEBA2X/7AEBA2f/7AEBA2n/7AEBA2v/7AEBA23/7AEBA2//wwEBA3H/wwEBA3P/wwEBA4//1wEDAAX/XAEDAAr/XAEDACb/1wEDACr/1wEDADL/1wEDADT/1wEDADf/1wEDADj/7AEDADn/1wEDADr/1wEDADz/wwEDAIn/1wEDAJT/1wEDAJX/1wEDAJb/1wEDAJf/1wEDAJj/1wEDAJr/1wEDAJv/7AEDAJz/7AEDAJ3/7AEDAJ7/7AEDAJ//wwEDAMj/1wEDAMr/1wEDAMz/1wEDAM7/1wEDAN7/1wEDAOD/1wEDAOL/1wEDAOT/1wEDAQ7/1wEDARD/1wEDARL/1wEDART/1wEDAST/1wEDASb/1wEDASr/7AEDASz/7AEDAS7/7AEDATD/7AEDATL/7AEDATT/7AEDATb/1wEDATj/wwEDATr/wwEDAUf/1wEDAfr/1wEDAfz/1wEDAf7/1wEDAgD/wwEDAgf/XAEDAgv/XAEDAl//1wEDAmH/7AEDA0n/1wEDA0v/1wEDA03/1wEDA0//1wEDA1H/1wEDA1P/1wEDA1X/1wEDA1f/1wEDA1n/1wEDA1v/1wEDA13/1wEDA1//1wEDA2H/7AEDA2P/7AEDA2X/7AEDA2f/7AEDA2n/7AEDA2v/7AEDA23/7AEDA2//wwEDA3H/wwEDA3P/wwEDA4//1wEIAAX/7AEIAAr/7AEIAgf/7AEIAgv/7AEOAA//rgEOABH/rgEOACT/1wEOADf/wwEOADn/7AEOADr/7AEOADv/1wEOADz/7AEOAD3/7AEOAIL/1wEOAIP/1wEOAIT/1wEOAIX/1wEOAIb/1wEOAIf/1wEOAJ//7AEOAML/1wEOAMT/1wEOAMb/1wEOAST/wwEOASb/wwEOATb/7AEOATj/7AEOATr/7AEOATv/7AEOAT3/7AEOAT//7AEOAUP/1wEOAaD/7AEOAfr/7AEOAfz/7AEOAf7/7AEOAgD/7AEOAgj/rgEOAgz/rgEOAlj/1wEOAx3/1wEOAx//1wEOAyH/1wEOAyP/1wEOAyX/1wEOAyf/1wEOAyn/1wEOAyv/1wEOAy3/1wEOAy//1wEOAzH/1wEOAzP/1wEOA2//7AEOA3H/7AEOA3P/7AEOA4//wwEQAA//rgEQABH/rgEQACT/1wEQADf/wwEQADn/7AEQADr/7AEQADv/1wEQADz/7AEQAD3/7AEQAIL/1wEQAIP/1wEQAIT/1wEQAIX/1wEQAIb/1wEQAIf/1wEQAJ//7AEQAML/1wEQAMT/1wEQAMb/1wEQAST/wwEQASb/wwEQATb/7AEQATj/7AEQATr/7AEQATv/7AEQAT3/7AEQAT//7AEQAUP/1wEQAaD/7AEQAfr/7AEQAfz/7AEQAf7/7AEQAgD/7AEQAgj/rgEQAgz/rgEQAlj/1wEQAx3/1wEQAx//1wEQAyH/1wEQAyP/1wEQAyX/1wEQAyf/1wEQAyn/1wEQAyv/1wEQAy3/1wEQAy//1wEQAzH/1wEQAzP/1wEQA2//7AEQA3H/7AEQA3P/7AEQA4//wwESAA//rgESABH/rgESACT/1wESADf/wwESADn/7AESADr/7AESADv/1wESADz/7AESAD3/7AESAIL/1wESAIP/1wESAIT/1wESAIX/1wESAIb/1wESAIf/1wESAJ//7AESAML/1wESAMT/1wESAMb/1wESAST/wwESASb/wwESATb/7AESATj/7AESATr/7AESATv/7AESAT3/7AESAT//7AESAUP/1wESAaD/7AESAfr/7AESAfz/7AESAf7/7AESAgD/7AESAgj/rgESAgz/rgESAlj/1wESAx3/1wESAx//1wESAyH/1wESAyP/1wESAyX/1wESAyf/1wESAyn/1wESAyv/1wESAy3/1wESAy//1wESAzH/1wESAzP/1wESA2//7AESA3H/7AESA3P/7AESA4//wwEUAC0AewEXAAUAUgEXAAoAUgEXAET/1wEXAEb/1wEXAEf/1wEXAEj/1wEXAEr/7AEXAFL/1wEXAFT/1wEXAKL/1wEXAKP/1wEXAKT/1wEXAKX/1wEXAKb/1wEXAKf/1wEXAKj/1wEXAKn/1wEXAKr/1wEXAKv/1wEXAKz/1wEXAK3/1wEXALT/1wEXALX/1wEXALb/1wEXALf/1wEXALj/1wEXALr/1wEXAMP/1wEXAMX/1wEXAMf/1wEXAMn/1wEXAMv/1wEXAM3/1wEXAM//1wEXANH/1wEXANP/1wEXANX/1wEXANf/1wEXANn/1wEXANv/1wEXAN3/1wEXAN//7AEXAOH/7AEXAOP/7AEXAOX/7AEXAQ//1wEXARH/1wEXARP/1wEXARX/1wEXAUT/1wEXAUb/1wEXAUj/1wEXAgcAUgEXAgsAUgEXAln/1wEXAmD/1wEXAx7/1wEXAyD/1wEXAyL/1wEXAyb/1wEXAyj/1wEXAyr/1wEXAyz/1wEXAy7/1wEXAzD/1wEXAzL/1wEXAzT/1wEXAzb/1wEXAzj/1wEXAzr/1wEXAzz/1wEXA0D/1wEXA0L/1wEXA0T/1wEXA0r/1wEXA0z/1wEXA07/1wEXA1L/1wEXA1T/1wEXA1b/1wEXA1j/1wEXA1r/1wEXA1z/1wEXA17/1wEXA2D/1wEZAAUAUgEZAAoAUgEZAET/1wEZAEb/1wEZAEf/1wEZAEj/1wEZAEr/7AEZAFL/1wEZAFT/1wEZAKL/1wEZAKP/1wEZAKT/1wEZAKX/1wEZAKb/1wEZAKf/1wEZAKj/1wEZAKn/1wEZAKr/1wEZAKv/1wEZAKz/1wEZAK3/1wEZALT/1wEZALX/1wEZALb/1wEZALf/1wEZALj/1wEZALr/1wEZAMP/1wEZAMX/1wEZAMf/1wEZAMn/1wEZAMv/1wEZAM3/1wEZAM//1wEZANH/1wEZANP/1wEZANX/1wEZANf/1wEZANn/1wEZANv/1wEZAN3/1wEZAN//7AEZAOH/7AEZAOP/7AEZAOX/7AEZAQ//1wEZARH/1wEZARP/1wEZARX/1wEZAUT/1wEZAUb/1wEZAUj/1wEZAgcAUgEZAgsAUgEZAln/1wEZAmD/1wEZAx7/1wEZAyD/1wEZAyL/1wEZAyb/1wEZAyj/1wEZAyr/1wEZAyz/1wEZAy7/1wEZAzD/1wEZAzL/1wEZAzT/1wEZAzb/1wEZAzj/1wEZAzr/1wEZAzz/1wEZA0D/1wEZA0L/1wEZA0T/1wEZA0r/1wEZA0z/1wEZA07/1wEZA1L/1wEZA1T/1wEZA1b/1wEZA1j/1wEZA1r/1wEZA1z/1wEZA17/1wEZA2D/1wEbAAUAUgEbAAoAUgEbAET/1wEbAEb/1wEbAEf/1wEbAEj/1wEbAEr/7AEbAFL/1wEbAFT/1wEbAKL/1wEbAKP/1wEbAKT/1wEbAKX/1wEbAKb/1wEbAKf/1wEbAKj/1wEbAKn/1wEbAKr/1wEbAKv/1wEbAKz/1wEbAK3/1wEbALT/1wEbALX/1wEbALb/1wEbALf/1wEbALj/1wEbALr/1wEbAMP/1wEbAMX/1wEbAMf/1wEbAMn/1wEbAMv/1wEbAM3/1wEbAM//1wEbANH/1wEbANP/1wEbANX/1wEbANf/1wEbANn/1wEbANv/1wEbAN3/1wEbAN//7AEbAOH/7AEbAOP/7AEbAOX/7AEbAQ//1wEbARH/1wEbARP/1wEbARX/1wEbAUT/1wEbAUb/1wEbAUj/1wEbAgcAUgEbAgsAUgEbAln/1wEbAmD/1wEbAx7/1wEbAyD/1wEbAyL/1wEbAyb/1wEbAyj/1wEbAyr/1wEbAyz/1wEbAy7/1wEbAzD/1wEbAzL/1wEbAzT/1wEbAzb/1wEbAzj/1wEbAzr/1wEbAzz/1wEbA0D/1wEbA0L/1wEbA0T/1wEbA0r/1wEbA0z/1wEbA07/1wEbA1L/1wEbA1T/1wEbA1b/1wEbA1j/1wEbA1r/1wEbA1z/1wEbA17/1wEbA2D/1wEkAA//hQEkABD/rgEkABH/hQEkACIAKQEkACT/cQEkACb/1wEkACr/1wEkADL/1wEkADT/1wEkADcAKQEkAET/XAEkAEb/cQEkAEf/cQEkAEj/cQEkAEr/cQEkAFD/mgEkAFH/mgEkAFL/cQEkAFP/mgEkAFT/cQEkAFX/mgEkAFb/hQEkAFj/mgEkAFn/1wEkAFr/1wEkAFv/1wEkAFz/1wEkAF3/rgEkAIL/cQEkAIP/cQEkAIT/cQEkAIX/cQEkAIb/cQEkAIf/cQEkAIn/1wEkAJT/1wEkAJX/1wEkAJb/1wEkAJf/1wEkAJj/1wEkAJr/1wEkAKL/cQEkAKP/XAEkAKT/XAEkAKX/XAEkAKb/XAEkAKf/XAEkAKj/XAEkAKn/cQEkAKr/cQEkAKv/cQEkAKz/cQEkAK3/cQEkALT/cQEkALX/cQEkALb/cQEkALf/cQEkALj/cQEkALr/cQEkALv/mgEkALz/mgEkAL3/mgEkAL7/mgEkAL//1wEkAML/cQEkAMP/XAEkAMT/cQEkAMX/XAEkAMb/cQEkAMf/XAEkAMj/1wEkAMn/cQEkAMr/1wEkAMv/cQEkAMz/1wEkAM3/cQEkAM7/1wEkAM//cQEkANH/cQEkANP/cQEkANX/cQEkANf/cQEkANn/cQEkANv/cQEkAN3/cQEkAN7/1wEkAN//cQEkAOD/1wEkAOH/cQEkAOL/1wEkAOP/cQEkAOT/1wEkAOX/cQEkAPr/mgEkAQb/mgEkAQj/mgEkAQ3/mgEkAQ7/1wEkAQ//cQEkARD/1wEkARH/cQEkARL/1wEkARP/cQEkART/1wEkARX/cQEkARf/mgEkARn/mgEkAR3/hQEkASH/hQEkASQAKQEkASYAKQEkASv/mgEkAS3/mgEkAS//mgEkATH/mgEkATP/mgEkATX/mgEkATf/1wEkATz/rgEkAT7/rgEkAUD/rgEkAUP/cQEkAUT/XAEkAUb/XAEkAUf/1wEkAUj/cQEkAUr/hQEkAfv/1wEkAf3/1wEkAgL/rgEkAgP/rgEkAgT/rgEkAgj/hQEkAgz/hQEkAlf/mgEkAlj/cQEkAln/XAEkAl//1wEkAmD/cQEkAmL/mgEkAx3/cQEkAx7/XAEkAx//cQEkAyD/XAEkAyH/cQEkAyL/XAEkAyP/cQEkAyX/cQEkAyb/XAEkAyf/cQEkAyj/XAEkAyn/cQEkAyr/XAEkAyv/cQEkAyz/XAEkAy3/cQEkAy7/XAEkAy//cQEkAzD/XAEkAzH/cQEkAzL/XAEkAzP/cQEkAzT/XAEkAzb/cQEkAzj/cQEkAzr/cQEkAzz/cQEkA0D/cQEkA0L/cQEkA0T/cQEkA0n/1wEkA0r/cQEkA0v/1wEkA0z/cQEkA03/1wEkA07/cQEkA0//1wEkA1H/1wEkA1L/cQEkA1P/1wEkA1T/cQEkA1X/1wEkA1b/cQEkA1f/1wEkA1j/cQEkA1n/1wEkA1r/cQEkA1v/1wEkA1z/cQEkA13/1wEkA17/cQEkA1//1wEkA2D/cQEkA2L/mgEkA2T/mgEkA2b/mgEkA2j/mgEkA2r/mgEkA2z/mgEkA27/mgEkA3D/1wEkA48AKQElAAUAKQElAAoAKQElAgcAKQElAgsAKQEmAA//hQEmABD/rgEmABH/hQEmACIAKQEmACT/cQEmACb/1wEmACr/1wEmADL/1wEmADT/1wEmADcAKQEmAET/XAEmAEb/cQEmAEf/cQEmAEj/cQEmAEr/cQEmAFD/mgEmAFH/mgEmAFL/cQEmAFP/mgEmAFT/cQEmAFX/mgEmAFb/hQEmAFj/mgEmAFn/1wEmAFr/1wEmAFv/1wEmAFz/1wEmAF3/rgEmAIL/cQEmAIP/cQEmAIT/cQEmAIX/cQEmAIb/cQEmAIf/cQEmAIn/1wEmAJT/1wEmAJX/1wEmAJb/1wEmAJf/1wEmAJj/1wEmAJr/1wEmAKL/cQEmAKP/XAEmAKT/XAEmAKX/XAEmAKb/XAEmAKf/XAEmAKj/XAEmAKn/cQEmAKr/cQEmAKv/cQEmAKz/cQEmAK3/cQEmALT/cQEmALX/cQEmALb/cQEmALf/cQEmALj/cQEmALr/cQEmALv/mgEmALz/mgEmAL3/mgEmAL7/mgEmAL//1wEmAML/cQEmAMP/XAEmAMT/cQEmAMX/XAEmAMb/cQEmAMf/XAEmAMj/1wEmAMn/cQEmAMr/1wEmAMv/cQEmAMz/1wEmAM3/cQEmAM7/1wEmAM//cQEmANH/cQEmANP/cQEmANX/cQEmANf/cQEmANn/cQEmANv/cQEmAN3/cQEmAN7/1wEmAN//cQEmAOD/1wEmAOH/cQEmAOL/1wEmAOP/cQEmAOT/1wEmAOX/cQEmAPr/mgEmAQb/mgEmAQj/mgEmAQ3/mgEmAQ7/1wEmAQ//cQEmARD/1wEmARH/cQEmARL/1wEmARP/cQEmART/1wEmARX/cQEmARf/mgEmARn/mgEmAR3/hQEmASH/hQEmASQAKQEmASYAKQEmASv/mgEmAS3/mgEmAS//mgEmATH/mgEmATP/mgEmATX/mgEmATf/1wEmATz/rgEmAT7/rgEmAUD/rgEmAUP/cQEmAUT/XAEmAUb/XAEmAUf/1wEmAUj/cQEmAUr/hQEmAfv/1wEmAf3/1wEmAgL/rgEmAgP/rgEmAgT/rgEmAgj/hQEmAgz/hQEmAlf/mgEmAlj/cQEmAln/XAEmAl//1wEmAmD/cQEmAmL/mgEmAx3/cQEmAx7/XAEmAx//cQEmAyD/XAEmAyH/cQEmAyL/XAEmAyP/cQEmAyX/cQEmAyb/XAEmAyf/cQEmAyj/XAEmAyn/cQEmAyr/XAEmAyv/cQEmAyz/XAEmAy3/cQEmAy7/XAEmAy//cQEmAzD/XAEmAzH/cQEmAzL/XAEmAzP/cQEmAzT/XAEmAzb/cQEmAzj/cQEmAzr/cQEmAzz/cQEmA0D/cQEmA0L/cQEmA0T/cQEmA0n/1wEmA0r/cQEmA0v/1wEmA0z/cQEmA03/1wEmA07/cQEmA0//1wEmA1H/1wEmA1L/cQEmA1P/1wEmA1T/cQEmA1X/1wEmA1b/cQEmA1f/1wEmA1j/cQEmA1n/1wEmA1r/cQEmA1v/1wEmA1z/cQEmA13/1wEmA17/cQEmA1//1wEmA2D/cQEmA2L/mgEmA2T/mgEmA2b/mgEmA2j/mgEmA2r/mgEmA2z/mgEmA27/mgEmA3D/1wEmA48AKQEnAAUAKQEnAAoAKQEnAgcAKQEnAgsAKQEoAA//hQEoABD/rgEoABH/hQEoACIAKQEoACT/cQEoACb/1wEoACr/1wEoADL/1wEoADT/1wEoADcAKQEoAET/XAEoAEb/cQEoAEf/cQEoAEj/cQEoAEr/cQEoAFD/mgEoAFH/mgEoAFL/cQEoAFP/mgEoAFT/cQEoAFX/mgEoAFb/hQEoAFj/mgEoAFn/1wEoAFr/1wEoAFv/1wEoAFz/1wEoAF3/rgEoAIL/cQEoAIP/cQEoAIT/cQEoAIX/cQEoAIb/cQEoAIf/cQEoAIn/1wEoAJT/1wEoAJX/1wEoAJb/1wEoAJf/1wEoAJj/1wEoAJr/1wEoAKL/cQEoAKP/XAEoAKT/XAEoAKX/XAEoAKb/XAEoAKf/XAEoAKj/XAEoAKn/cQEoAKr/cQEoAKv/cQEoAKz/cQEoAK3/cQEoALT/cQEoALX/cQEoALb/cQEoALf/cQEoALj/cQEoALr/cQEoALv/mgEoALz/mgEoAL3/mgEoAL7/mgEoAL//1wEoAML/cQEoAMP/XAEoAMT/cQEoAMX/XAEoAMb/cQEoAMf/XAEoAMj/1wEoAMn/cQEoAMr/1wEoAMv/cQEoAMz/1wEoAM3/cQEoAM7/1wEoAM//cQEoANH/cQEoANP/cQEoANX/cQEoANf/cQEoANn/cQEoANv/cQEoAN3/cQEoAN7/1wEoAN//cQEoAOD/1wEoAOH/cQEoAOL/1wEoAOP/cQEoAOT/1wEoAOX/cQEoAPr/mgEoAQb/mgEoAQj/mgEoAQ3/mgEoAQ7/1wEoAQ//cQEoARD/1wEoARH/cQEoARL/1wEoARP/cQEoART/1wEoARX/cQEoARf/mgEoARn/mgEoAR3/hQEoASH/hQEoASQAKQEoASYAKQEoASv/mgEoAS3/mgEoAS//mgEoATH/mgEoATP/mgEoATX/mgEoATf/1wEoATz/rgEoAT7/rgEoAUD/rgEoAUP/cQEoAUT/XAEoAUb/XAEoAUf/1wEoAUj/cQEoAUr/hQEoAfv/1wEoAf3/1wEoAgL/rgEoAgP/rgEoAgT/rgEoAgj/hQEoAgz/hQEoAlf/mgEoAlj/cQEoAln/XAEoAl//1wEoAmD/cQEoAmL/mgEoAx3/cQEoAx7/XAEoAx//cQEoAyD/XAEoAyH/cQEoAyL/XAEoAyP/cQEoAyX/cQEoAyb/XAEoAyf/cQEoAyj/XAEoAyn/cQEoAyr/XAEoAyv/cQEoAyz/XAEoAy3/cQEoAy7/XAEoAy//cQEoAzD/XAEoAzH/cQEoAzL/XAEoAzP/cQEoAzT/XAEoAzb/cQEoAzj/cQEoAzr/cQEoAzz/cQEoA0D/cQEoA0L/cQEoA0T/cQEoA0n/1wEoA0r/cQEoA0v/1wEoA0z/cQEoA03/1wEoA07/cQEoA0//1wEoA1H/1wEoA1L/cQEoA1P/1wEoA1T/cQEoA1X/1wEoA1b/cQEoA1f/1wEoA1j/cQEoA1n/1wEoA1r/cQEoA1v/1wEoA1z/cQEoA13/1wEoA17/cQEoA1//1wEoA2D/cQEoA2L/mgEoA2T/mgEoA2b/mgEoA2j/mgEoA2r/mgEoA2z/mgEoA27/mgEoA3D/1wEoA48AKQEqAA//1wEqABH/1wEqACT/7AEqAIL/7AEqAIP/7AEqAIT/7AEqAIX/7AEqAIb/7AEqAIf/7AEqAML/7AEqAMT/7AEqAMb/7AEqAUP/7AEqAgj/1wEqAgz/1wEqAlj/7AEqAx3/7AEqAx//7AEqAyH/7AEqAyP/7AEqAyX/7AEqAyf/7AEqAyn/7AEqAyv/7AEqAy3/7AEqAy//7AEqAzH/7AEqAzP/7AEsAA//1wEsABH/1wEsACT/7AEsAIL/7AEsAIP/7AEsAIT/7AEsAIX/7AEsAIb/7AEsAIf/7AEsAML/7AEsAMT/7AEsAMb/7AEsAUP/7AEsAgj/1wEsAgz/1wEsAlj/7AEsAx3/7AEsAx//7AEsAyH/7AEsAyP/7AEsAyX/7AEsAyf/7AEsAyn/7AEsAyv/7AEsAy3/7AEsAy//7AEsAzH/7AEsAzP/7AEuAA//1wEuABH/1wEuACT/7AEuAIL/7AEuAIP/7AEuAIT/7AEuAIX/7AEuAIb/7AEuAIf/7AEuAML/7AEuAMT/7AEuAMb/7AEuAUP/7AEuAgj/1wEuAgz/1wEuAlj/7AEuAx3/7AEuAx//7AEuAyH/7AEuAyP/7AEuAyX/7AEuAyf/7AEuAyn/7AEuAyv/7AEuAy3/7AEuAy//7AEuAzH/7AEuAzP/7AEwAA//1wEwABH/1wEwACT/7AEwAIL/7AEwAIP/7AEwAIT/7AEwAIX/7AEwAIb/7AEwAIf/7AEwAML/7AEwAMT/7AEwAMb/7AEwAUP/7AEwAgj/1wEwAgz/1wEwAlj/7AEwAx3/7AEwAx//7AEwAyH/7AEwAyP/7AEwAyX/7AEwAyf/7AEwAyn/7AEwAyv/7AEwAy3/7AEwAy//7AEwAzH/7AEwAzP/7AEyAA//1wEyABH/1wEyACT/7AEyAIL/7AEyAIP/7AEyAIT/7AEyAIX/7AEyAIb/7AEyAIf/7AEyAML/7AEyAMT/7AEyAMb/7AEyAUP/7AEyAgj/1wEyAgz/1wEyAlj/7AEyAx3/7AEyAx//7AEyAyH/7AEyAyP/7AEyAyX/7AEyAyf/7AEyAyn/7AEyAyv/7AEyAy3/7AEyAy//7AEyAzH/7AEyAzP/7AE0AA//1wE0ABH/1wE0ACT/7AE0AIL/7AE0AIP/7AE0AIT/7AE0AIX/7AE0AIb/7AE0AIf/7AE0AML/7AE0AMT/7AE0AMb/7AE0AUP/7AE0Agj/1wE0Agz/1wE0Alj/7AE0Ax3/7AE0Ax//7AE0AyH/7AE0AyP/7AE0AyX/7AE0Ayf/7AE0Ayn/7AE0Ayv/7AE0Ay3/7AE0Ay//7AE0AzH/7AE0AzP/7AE2AA//mgE2ABH/mgE2ACIAKQE2ACT/rgE2ACb/7AE2ACr/7AE2ADL/7AE2ADT/7AE2AET/1wE2AEb/1wE2AEf/1wE2AEj/1wE2AEr/7AE2AFD/7AE2AFH/7AE2AFL/1wE2AFP/7AE2AFT/1wE2AFX/7AE2AFb/7AE2AFj/7AE2AIL/rgE2AIP/rgE2AIT/rgE2AIX/rgE2AIb/rgE2AIf/rgE2AIn/7AE2AJT/7AE2AJX/7AE2AJb/7AE2AJf/7AE2AJj/7AE2AJr/7AE2AKL/1wE2AKP/1wE2AKT/1wE2AKX/1wE2AKb/1wE2AKf/1wE2AKj/1wE2AKn/1wE2AKr/1wE2AKv/1wE2AKz/1wE2AK3/1wE2ALT/1wE2ALX/1wE2ALb/1wE2ALf/1wE2ALj/1wE2ALr/1wE2ALv/7AE2ALz/7AE2AL3/7AE2AL7/7AE2AML/rgE2AMP/1wE2AMT/rgE2AMX/1wE2AMb/rgE2AMf/1wE2AMj/7AE2AMn/1wE2AMr/7AE2AMv/1wE2AMz/7AE2AM3/1wE2AM7/7AE2AM//1wE2ANH/1wE2ANP/1wE2ANX/1wE2ANf/1wE2ANn/1wE2ANv/1wE2AN3/1wE2AN7/7AE2AN//7AE2AOD/7AE2AOH/7AE2AOL/7AE2AOP/7AE2AOT/7AE2AOX/7AE2APr/7AE2AQb/7AE2AQj/7AE2AQ3/7AE2AQ7/7AE2AQ//1wE2ARD/7AE2ARH/1wE2ARL/7AE2ARP/1wE2ART/7AE2ARX/1wE2ARf/7AE2ARn/7AE2AR3/7AE2ASH/7AE2ASv/7AE2AS3/7AE2AS//7AE2ATH/7AE2ATP/7AE2ATX/7AE2AUP/rgE2AUT/1wE2AUb/1wE2AUf/7AE2AUj/1wE2AUr/7AE2Agj/mgE2Agz/mgE2Alf/7AE2Alj/rgE2Aln/1wE2Al//7AE2AmD/1wE2AmL/7AE2Ax3/rgE2Ax7/1wE2Ax//rgE2AyD/1wE2AyH/rgE2AyL/1wE2AyP/rgE2AyX/rgE2Ayb/1wE2Ayf/rgE2Ayj/1wE2Ayn/rgE2Ayr/1wE2Ayv/rgE2Ayz/1wE2Ay3/rgE2Ay7/1wE2Ay//rgE2AzD/1wE2AzH/rgE2AzL/1wE2AzP/rgE2AzT/1wE2Azb/1wE2Azj/1wE2Azr/1wE2Azz/1wE2A0D/1wE2A0L/1wE2A0T/1wE2A0n/7AE2A0r/1wE2A0v/7AE2A0z/1wE2A03/7AE2A07/1wE2A0//7AE2A1H/7AE2A1L/1wE2A1P/7AE2A1T/1wE2A1X/7AE2A1b/1wE2A1f/7AE2A1j/1wE2A1n/7AE2A1r/1wE2A1v/7AE2A1z/1wE2A13/7AE2A17/1wE2A1//7AE2A2D/1wE2A2L/7AE2A2T/7AE2A2b/7AE2A2j/7AE2A2r/7AE2A2z/7AE2A27/7AE3AAUAUgE3AAoAUgE3AA//rgE3ABH/rgE3ACIAKQE3AgcAUgE3Agj/rgE3AgsAUgE3Agz/rgE4AA//hQE4ABH/hQE4ACIAKQE4ACT/hQE4ACb/1wE4ACr/1wE4ADL/1wE4ADT/1wE4AET/mgE4AEb/mgE4AEf/mgE4AEj/mgE4AEr/1wE4AFD/wwE4AFH/wwE4AFL/mgE4AFP/wwE4AFT/mgE4AFX/wwE4AFb/rgE4AFj/wwE4AF3/1wE4AIL/hQE4AIP/hQE4AIT/hQE4AIX/hQE4AIb/hQE4AIf/hQE4AIn/1wE4AJT/1wE4AJX/1wE4AJb/1wE4AJf/1wE4AJj/1wE4AJr/1wE4AKL/mgE4AKP/mgE4AKT/mgE4AKX/mgE4AKb/mgE4AKf/mgE4AKj/mgE4AKn/mgE4AKr/mgE4AKv/mgE4AKz/mgE4AK3/mgE4ALT/mgE4ALX/mgE4ALb/mgE4ALf/mgE4ALj/mgE4ALr/mgE4ALv/wwE4ALz/wwE4AL3/wwE4AL7/wwE4AML/hQE4AMP/mgE4AMT/hQE4AMX/mgE4AMb/hQE4AMf/mgE4AMj/1wE4AMn/mgE4AMr/1wE4AMv/mgE4AMz/1wE4AM3/mgE4AM7/1wE4AM//mgE4ANH/mgE4ANP/mgE4ANX/mgE4ANf/mgE4ANn/mgE4ANv/mgE4AN3/mgE4AN7/1wE4AN//1wE4AOD/1wE4AOH/1wE4AOL/1wE4AOP/1wE4AOT/1wE4AOX/1wE4APr/wwE4AQb/wwE4AQj/wwE4AQ3/wwE4AQ7/1wE4AQ//mgE4ARD/1wE4ARH/mgE4ARL/1wE4ARP/mgE4ART/1wE4ARX/mgE4ARf/wwE4ARn/wwE4AR3/rgE4ASH/rgE4ASv/wwE4AS3/wwE4AS//wwE4ATH/wwE4ATP/wwE4ATX/wwE4ATz/1wE4AT7/1wE4AUD/1wE4AUP/hQE4AUT/mgE4AUb/mgE4AUf/1wE4AUj/mgE4AUr/rgE4Agj/hQE4Agz/hQE4Alf/wwE4Alj/hQE4Aln/mgE4Al//1wE4AmD/mgE4AmL/wwE4Ax3/hQE4Ax7/mgE4Ax//hQE4AyD/mgE4AyH/hQE4AyL/mgE4AyP/hQE4AyX/hQE4Ayb/mgE4Ayf/hQE4Ayj/mgE4Ayn/hQE4Ayr/mgE4Ayv/hQE4Ayz/mgE4Ay3/hQE4Ay7/mgE4Ay//hQE4AzD/mgE4AzH/hQE4AzL/mgE4AzP/hQE4AzT/mgE4Azb/mgE4Azj/mgE4Azr/mgE4Azz/mgE4A0D/mgE4A0L/mgE4A0T/mgE4A0n/1wE4A0r/mgE4A0v/1wE4A0z/mgE4A03/1wE4A07/mgE4A0//1wE4A1H/1wE4A1L/mgE4A1P/1wE4A1T/mgE4A1X/1wE4A1b/mgE4A1f/1wE4A1j/mgE4A1n/1wE4A1r/mgE4A1v/1wE4A1z/mgE4A13/1wE4A17/mgE4A1//1wE4A2D/mgE4A2L/wwE4A2T/wwE4A2b/wwE4A2j/wwE4A2r/wwE4A2z/wwE4A27/wwE5AAUAUgE5AAoAUgE5AA//rgE5ABH/rgE5ACIAKQE5AgcAUgE5Agj/rgE5AgsAUgE5Agz/rgE6AA//hQE6ABH/hQE6ACIAKQE6ACT/hQE6ACb/1wE6ACr/1wE6ADL/1wE6ADT/1wE6AET/mgE6AEb/mgE6AEf/mgE6AEj/mgE6AEr/1wE6AFD/wwE6AFH/wwE6AFL/mgE6AFP/wwE6AFT/mgE6AFX/wwE6AFb/rgE6AFj/wwE6AF3/1wE6AIL/hQE6AIP/hQE6AIT/hQE6AIX/hQE6AIb/hQE6AIf/hQE6AIn/1wE6AJT/1wE6AJX/1wE6AJb/1wE6AJf/1wE6AJj/1wE6AJr/1wE6AKL/mgE6AKP/mgE6AKT/mgE6AKX/mgE6AKb/mgE6AKf/mgE6AKj/mgE6AKn/mgE6AKr/mgE6AKv/mgE6AKz/mgE6AK3/mgE6ALT/mgE6ALX/mgE6ALb/mgE6ALf/mgE6ALj/mgE6ALr/mgE6ALv/wwE6ALz/wwE6AL3/wwE6AL7/wwE6AML/hQE6AMP/mgE6AMT/hQE6AMX/mgE6AMb/hQE6AMf/mgE6AMj/1wE6AMn/mgE6AMr/1wE6AMv/mgE6AMz/1wE6AM3/mgE6AM7/1wE6AM//mgE6ANH/mgE6ANP/mgE6ANX/mgE6ANf/mgE6ANn/mgE6ANv/mgE6AN3/mgE6AN7/1wE6AN//1wE6AOD/1wE6AOH/1wE6AOL/1wE6AOP/1wE6AOT/1wE6AOX/1wE6APr/wwE6AQb/wwE6AQj/wwE6AQ3/wwE6AQ7/1wE6AQ//mgE6ARD/1wE6ARH/mgE6ARL/1wE6ARP/mgE6ART/1wE6ARX/mgE6ARf/wwE6ARn/wwE6AR3/rgE6ASH/rgE6ASv/wwE6AS3/wwE6AS//wwE6ATH/wwE6ATP/wwE6ATX/wwE6ATz/1wE6AT7/1wE6AUD/1wE6AUP/hQE6AUT/mgE6AUb/mgE6AUf/1wE6AUj/mgE6AUr/rgE6Agj/hQE6Agz/hQE6Alf/wwE6Alj/hQE6Aln/mgE6Al//1wE6AmD/mgE6AmL/wwE6Ax3/hQE6Ax7/mgE6Ax//hQE6AyD/mgE6AyH/hQE6AyL/mgE6AyP/hQE6AyX/hQE6Ayb/mgE6Ayf/hQE6Ayj/mgE6Ayn/hQE6Ayr/mgE6Ayv/hQE6Ayz/mgE6Ay3/hQE6Ay7/mgE6Ay//hQE6AzD/mgE6AzH/hQE6AzL/mgE6AzP/hQE6AzT/mgE6Azb/mgE6Azj/mgE6Azr/mgE6Azz/mgE6A0D/mgE6A0L/mgE6A0T/mgE6A0n/1wE6A0r/mgE6A0v/1wE6A0z/mgE6A03/1wE6A07/mgE6A0//1wE6A1H/1wE6A1L/mgE6A1P/1wE6A1T/mgE6A1X/1wE6A1b/mgE6A1f/1wE6A1j/mgE6A1n/1wE6A1r/mgE6A1v/1wE6A1z/mgE6A13/1wE6A17/mgE6A1//1wE6A2D/mgE6A2L/wwE6A2T/wwE6A2b/wwE6A2j/wwE6A2r/wwE6A2z/wwE6A27/wwE7ACb/7AE7ACr/7AE7ADL/7AE7ADT/7AE7AIn/7AE7AJT/7AE7AJX/7AE7AJb/7AE7AJf/7AE7AJj/7AE7AJr/7AE7AMj/7AE7AMr/7AE7AMz/7AE7AM7/7AE7AN7/7AE7AOD/7AE7AOL/7AE7AOT/7AE7AQ7/7AE7ARD/7AE7ARL/7AE7ART/7AE7AUf/7AE7Al//7AE7A0n/7AE7A0v/7AE7A03/7AE7A0//7AE7A1H/7AE7A1P/7AE7A1X/7AE7A1f/7AE7A1n/7AE7A1v/7AE7A13/7AE7A1//7AE9ACb/7AE9ACr/7AE9ADL/7AE9ADT/7AE9AIn/7AE9AJT/7AE9AJX/7AE9AJb/7AE9AJf/7AE9AJj/7AE9AJr/7AE9AMj/7AE9AMr/7AE9AMz/7AE9AM7/7AE9AN7/7AE9AOD/7AE9AOL/7AE9AOT/7AE9AQ7/7AE9ARD/7AE9ARL/7AE9ART/7AE9AUf/7AE9Al//7AE9A0n/7AE9A0v/7AE9A03/7AE9A0//7AE9A1H/7AE9A1P/7AE9A1X/7AE9A1f/7AE9A1n/7AE9A1v/7AE9A13/7AE9A1//7AE/ACb/7AE/ACr/7AE/ADL/7AE/ADT/7AE/AIn/7AE/AJT/7AE/AJX/7AE/AJb/7AE/AJf/7AE/AJj/7AE/AJr/7AE/AMj/7AE/AMr/7AE/AMz/7AE/AM7/7AE/AN7/7AE/AOD/7AE/AOL/7AE/AOT/7AE/AQ7/7AE/ARD/7AE/ARL/7AE/ART/7AE/AUf/7AE/Al//7AE/A0n/7AE/A0v/7AE/A03/7AE/A0//7AE/A1H/7AE/A1P/7AE/A1X/7AE/A1f/7AE/A1n/7AE/A1v/7AE/A13/7AE/A1//7AFDAAX/cQFDAAr/cQFDACb/1wFDACr/1wFDAC0BCgFDADL/1wFDADT/1wFDADf/cQFDADn/rgFDADr/rgFDADz/hQFDAIn/1wFDAJT/1wFDAJX/1wFDAJb/1wFDAJf/1wFDAJj/1wFDAJr/1wFDAJ//hQFDAMj/1wFDAMr/1wFDAMz/1wFDAM7/1wFDAN7/1wFDAOD/1wFDAOL/1wFDAOT/1wFDAQ7/1wFDARD/1wFDARL/1wFDART/1wFDAST/cQFDASb/cQFDATb/rgFDATj/hQFDATr/hQFDAUf/1wFDAfr/rgFDAfz/rgFDAf7/rgFDAgD/hQFDAgf/cQFDAgv/cQFDAl//1wFDA0n/1wFDA0v/1wFDA03/1wFDA0//1wFDA1H/1wFDA1P/1wFDA1X/1wFDA1f/1wFDA1n/1wFDA1v/1wFDA13/1wFDA1//1wFDA2//hQFDA3H/hQFDA3P/hQFDA4//cQFEAAX/7AFEAAr/7AFEAgf/7AFEAgv/7AFFAC0AewFHAA//rgFHABH/rgFHACT/1wFHADf/wwFHADn/7AFHADr/7AFHADv/1wFHADz/7AFHAD3/7AFHAIL/1wFHAIP/1wFHAIT/1wFHAIX/1wFHAIb/1wFHAIf/1wFHAJ//7AFHAML/1wFHAMT/1wFHAMb/1wFHAST/wwFHASb/wwFHATb/7AFHATj/7AFHATr/7AFHATv/7AFHAT3/7AFHAT//7AFHAUP/1wFHAaD/7AFHAfr/7AFHAfz/7AFHAf7/7AFHAgD/7AFHAgj/rgFHAgz/rgFHAlj/1wFHAx3/1wFHAx//1wFHAyH/1wFHAyP/1wFHAyX/1wFHAyf/1wFHAyn/1wFHAyv/1wFHAy3/1wFHAy//1wFHAzH/1wFHAzP/1wFHA2//7AFHA3H/7AFHA3P/7AFHA4//wwFWAAX/cQFWAAr/cQFWAWb/1wFWAW3/1wFWAXH/cQFWAXL/hQFWAXP/1wFWAXX/rgFWAXj/hQFWAgf/cQFWAgv/cQFWAlT/hQFbAA//rgFbABH/rgFbAVb/1wFbAV//1wFbAWL/1wFbAWT/7AFbAWn/1wFbAXD/7AFbAXH/wwFbAXL/7AFbAXT/1wFbAXX/7AFbAXj/7AFbAYj/7AFbAgj/rgFbAgz/rgFbAlT/7AFcAA//hQFcABH/hQFcAVb/hQFcAV//hQFcAWL/hQFcAWb/1wFcAWn/hQFcAW3/1wFcAXP/wwFcAXb/7AFcAXn/mgFcAXr/rgFcAXv/wwFcAXz/wwFcAX3/wwFcAX7/mgFcAYH/wwFcAYL/rgFcAYT/wwFcAYb/wwFcAYf/wwFcAYn/wwFcAYz/mgFcAY7/mgFcAY//mgFcAZD/mgFcAZL/wwFcAZP/mgFcAZX/wwFcAZb/wwFcAZj/wwFcAZn/mgFcAZr/wwFcAZv/wwFcAgj/hQFcAgz/hQFcAiH/7AFdAXH/1wFdAXL/7AFdAXj/7AFdAlT/7AFeAAX/1wFeAAr/1wFeAgf/1wFeAgv/1wFfAAX/cQFfAAr/cQFfAWb/1wFfAW3/1wFfAXH/cQFfAXL/hQFfAXP/1wFfAXX/rgFfAXj/hQFfAgf/cQFfAgv/cQFfAlT/hQFgAA//rgFgABH/rgFgAVb/1wFgAV//1wFgAWL/1wFgAWn/1wFgAXT/1wFgAgj/rgFgAgz/rgFhAA//hQFhABD/rgFhABH/hQFhAVb/XAFhAV//XAFhAWL/XAFhAWb/wwFhAWn/XAFhAW3/wwFhAXP/mgFhAXb/wwFhAXn/cQFhAXr/mgFhAXv/mgFhAXz/rgFhAX3/mgFhAX7/cQFhAYD/1wFhAYH/wwFhAYL/mgFhAYT/mgFhAYb/rgFhAYf/mgFhAYn/mgFhAYr/1wFhAYz/cQFhAY7/mgFhAY//cQFhAZD/cQFhAZL/mgFhAZP/cQFhAZT/1wFhAZX/mgFhAZb/mgFhAZj/mgFhAZn/cQFhAZr/mgFhAZv/mgFhAgL/rgFhAgP/rgFhAgT/rgFhAgj/hQFhAgz/hQFhAiH/wwFhAlP/1wFiAAX/cQFiAAr/cQFiAWb/1wFiAW3/1wFiAXH/cQFiAXL/hQFiAXP/1wFiAXX/rgFiAXj/hQFiAgf/cQFiAgv/cQFiAlT/hQFkAWb/7AFkAW3/7AFkAXP/wwFmAA//rgFmABH/rgFmAVb/1wFmAV//1wFmAWL/1wFmAWT/7AFmAWn/1wFmAXD/7AFmAXH/wwFmAXL/7AFmAXT/1wFmAXX/7AFmAXj/7AFmAYj/7AFmAgj/rgFmAgz/rgFmAlT/7AFoAWb/1wFoAW3/1wFoAXP/wwFoAY3/7AFoAZH/7AFpAAX/cQFpAAr/cQFpAWb/1wFpAW3/1wFpAXH/cQFpAXL/hQFpAXP/1wFpAXX/rgFpAXj/hQFpAgf/cQFpAgv/cQFpAlT/hQFtAA//rgFtABH/rgFtAVb/1wFtAV//1wFtAWL/1wFtAWT/7AFtAWn/1wFtAXD/7AFtAXH/wwFtAXL/7AFtAXT/1wFtAXX/7AFtAXj/7AFtAYj/7AFtAgj/rgFtAgz/rgFtAlT/7AFvAA/+9gFvABH+9gFvAVb/mgFvAV//mgFvAWL/mgFvAWT/7AFvAWn/mgFvAXT/1wFvAYj/1wFvAgj+9gFvAgz+9gFxAA//hQFxABD/rgFxABH/hQFxAVb/XAFxAV//XAFxAWL/XAFxAWb/wwFxAWn/XAFxAW3/wwFxAXP/mgFxAXb/wwFxAXn/cQFxAXr/mgFxAXv/mgFxAXz/rgFxAX3/mgFxAX7/cQFxAYD/1wFxAYH/wwFxAYL/mgFxAYT/mgFxAYb/rgFxAYf/mgFxAYn/mgFxAYr/1wFxAYz/cQFxAY7/mgFxAY//cQFxAZD/cQFxAZL/mgFxAZP/cQFxAZT/1wFxAZX/mgFxAZb/mgFxAZj/mgFxAZn/cQFxAZr/mgFxAZv/mgFxAgL/rgFxAgP/rgFxAgT/rgFxAgj/hQFxAgz/hQFxAiH/wwFxAlP/1wFyAA//hQFyABH/hQFyAVb/hQFyAV//hQFyAWL/hQFyAWb/1wFyAWn/hQFyAW3/1wFyAXP/wwFyAXb/7AFyAXn/mgFyAXr/rgFyAXv/wwFyAXz/wwFyAX3/wwFyAX7/mgFyAYH/wwFyAYL/rgFyAYT/wwFyAYb/wwFyAYf/wwFyAYn/wwFyAYz/mgFyAY7/mgFyAY//mgFyAZD/mgFyAZL/wwFyAZP/mgFyAZX/wwFyAZb/wwFyAZj/wwFyAZn/mgFyAZr/wwFyAZv/wwFyAgj/hQFyAgz/hQFyAiH/7AFzAA//mgFzABH/mgFzAVb/1wFzAV//1wFzAWL/1wFzAWT/wwFzAWn/1wFzAXD/7AFzAXH/rgFzAXL/wwFzAXT/7AFzAXj/wwFzAYj/7AFzAgj/mgFzAgz/mgFzAlT/wwF0AWb/1wF0AW3/1wF0AXP/wwF0AY3/7AF0AZH/7AF1AA//hQF1ABH/hQF1AVb/rgF1AV//rgF1AWL/rgF1AWb/7AF1AWn/rgF1AW3/7AF1Agj/hQF1Agz/hQF2AXH/1wF2AXL/7AF2AXj/7AF2AlT/7AF4AA//hQF4ABH/hQF4AVb/hQF4AV//hQF4AWL/hQF4AWb/1wF4AWn/hQF4AW3/1wF4AXP/wwF4AXb/7AF4AXn/mgF4AXr/rgF4AXv/wwF4AXz/wwF4AX3/wwF4AX7/mgF4AYH/wwF4AYL/rgF4AYT/wwF4AYb/wwF4AYf/wwF4AYn/wwF4AYz/mgF4AY7/mgF4AY//mgF4AZD/mgF4AZL/wwF4AZP/mgF4AZX/wwF4AZb/wwF4AZj/wwF4AZn/mgF4AZr/wwF4AZv/wwF4Agj/hQF4Agz/hQF4AiH/7AF5AYgAKQF7AAX/7AF7AAr/7AF7Agf/7AF7Agv/7AF8AAX/rgF8AAr/rgF8AY3/7AF8AZH/7AF8Agf/rgF8Agv/rgF+AYgAKQGAAA//rgGAABH/rgGAAYj/7AGAAgj/rgGAAgz/rgGDABD/mgGDAXn/1wGDAX7/1wGDAYH/1wGDAYz/1wGDAY3/1wGDAY//1wGDAZD/1wGDAZH/1wGDAZP/1wGDAZn/1wGDAgL/mgGDAgP/mgGDAgT/mgGEAAX/7AGEAAr/7AGEAgf/7AGEAgv/7AGFAA//1wGFABH/1wGFAgj/1wGFAgz/1wGGAAX/rgGGAAr/rgGGAY3/7AGGAZH/7AGGAgf/rgGGAgv/rgGHAXn/1wGHAX7/1wGHAYz/1wGHAY//1wGHAZD/1wGHAZP/1wGHAZn/1wGIAAX/hQGIAAr/hQGIAXn/7AGIAX7/7AGIAYD/1wGIAYr/1wGIAYz/7AGIAY3/1wGIAY//7AGIAZD/7AGIAZH/1wGIAZP/7AGIAZn/7AGIAgf/hQGIAgv/hQGKAA//rgGKABH/rgGKAYj/7AGKAgj/rgGKAgz/rgGMAAX/7AGMAAr/7AGMAYD/1wGMAYr/1wGMAgf/7AGMAgv/7AGOAAX/7AGOAAr/7AGOAYD/1wGOAYr/1wGOAgf/7AGOAgv/7AGQAA//7AGQABH/7AGQAgj/7AGQAgz/7AGTAAX/7AGTAAr/7AGTAYD/1wGTAYr/1wGTAgf/7AGTAgv/7AGUAA//wwGUABD/1wGUABH/wwGUAXn/1wGUAX7/1wGUAYH/1wGUAYz/1wGUAY//1wGUAZD/1wGUAZP/1wGUAZn/1wGUAgL/1wGUAgP/1wGUAgT/1wGUAgj/wwGUAgz/wwGXAAX/1wGXAAr/1wGXAgf/1wGXAgv/1wGZAAX/7AGZAAr/7AGZAYD/1wGZAYr/1wGZAgf/7AGZAgv/7AGdAAX/rgGdAAr/rgGdAZ3/hQGdAab/hQGdAaj/1wGdAbz/mgGdAb3/1wGdAcH/mgGdAcT/hQGdAdz/1wGdAd3/1wGdAeH/1wGdAeT/1wGdAfb/1wGdAgf/rgGdAgv/rgGdAm7/rgGdAnz/mgGdAoD/rgGdAoL/rgGdApf/rgGdApv/rgGdAqf/rgGdAqn/hQGdAqr/1wGdArX/mgGdArb/1wGdArf/mgGdArj/1wGdArn/mgGdArr/1wGdAr3/hQGdAr7/1wGdAr//mgGdAsD/1wGdAsH/mgGdAsL/1wGdAtT/mgGdAtX/1wGdAvf/1wGdAvj/1wGdAvn/1wGdAvr/1wGdAvv/1wGdAvz/1wGdAv3/mgGdAv7/1wGdAwP/rgGdAw3/mgGdAw7/wwGdAw//mgGdAxD/wwGdAxf/hQGdAxj/1wGeAA//hQGeABD/rgGeABH/hQGeAZ//1wGeAaT/mgGeAar/cQGeAa7/mgGeAbX/mgGeAbj/1wGeAbv/1wGeAbwAKQGeAb7/rgGeAcz/mgGeAc3/mgGeAc7/hQGeAc//cQGeAdD/1wGeAdH/1wGeAdL/mgGeAdP/mgGeAdT/mgGeAdX/hQGeAdb/mgGeAdf/mgGeAdj/cQGeAdn/mgGeAdr/mgGeAdv/cQGeAdz/rgGeAd3/rgGeAd7/cQGeAd//1wGeAeD/mgGeAeH/mgGeAeL/mgGeAeP/mgGeAeT/rgGeAeX/mgGeAeb/mgGeAef/1wGeAej/mgGeAen/wwGeAer/cQGeAez/mgGeAe3/cQGeAe7/hQGeAfL/hQGeAfP/mgGeAfX/mgGeAfb/rgGeAff/mgGeAfn/mgGeAgL/rgGeAgP/rgGeAgT/rgGeAgj/hQGeAgz/hQGeAmr/cQGeAmv/mgGeAmz/1wGeAm3/1wGeAnH/mgGeAnL/cQGeAnP/hQGeAnX/mgGeAnf/mgGeAnn/mgGeAn3/mgGeAn7/1wGeAn//cQGeAoH/1wGeAoP/1wGeAoT/1wGeAoX/cQGeAob/1wGeAof/cQGeAoj/1wGeAon/cQGeAor/1wGeAov/1wGeAoz/1wGeAo3/cQGeApb/mgGeApr/mgGeAp7/mgGeAqD/1wGeAqL/1wGeAqT/mgGeAqb/mgGeAqr/rgGeAqz/mgGeAq7/mgGeArD/mgGeArH/1wGeArL/cQGeArP/1wGeArT/cQGeArUAKQGeArb/rgGeArj/rgGeArr/rgGeArz/1wGeAr7/rgGeAsD/mgGeAsL/mgGeAsT/mgGeAsX/mgGeAsb/cQGeAsf/mgGeAsj/cQGeAsv/1wGeAs3/mgGeAs7/mgGeAs//hQGeAtH/mgGeAtP/mgGeAtX/mgGeAtf/mgGeAtn/cQGeAtv/cQGeAt3/cQGeAuD/cQGeAub/1wGeAuj/1wGeAur/wwGeAuz/mgGeAu7/mgGeAu//1wGeAvD/cQGeAvH/1wGeAvL/cQGeAvP/1wGeAvT/cQGeAvb/1wGeAvj/rgGeAvr/rgGeAvz/rgGeAv7/mgGeAwD/mgGeAwL/mgGeAwb/1wGeAwj/1wGeAwn/cQGeAwr/cQGeAwv/cQGeAwz/cQGeAw7/mgGeAxD/mgGeAxH/mgGeAxL/hQGeAxT/mgGeAxX/1wGeAxb/cQGeAxj/rgGeAxr/cQGeAxv/mgGeAxz/hQGfAZ//1wGfAbj/1wGfAbv/1wGfAb7/1wGfAeH/1wGfAmz/1wGfAn7/1wGfAoT/1wGfAob/1wGfAoj/1wGfAor/1wGfAoz/1wGfArH/1wGfArP/1wGfAsD/1wGfAsL/1wGfAsX/1wGfAsf/1wGfAtX/1wGfAu//1wGfAvH/1wGfAvP/1wGfAv7/1wGfAwn/1wGfAwv/1wGfAw7/1wGfAxD/1wGfAxX/1wGgAw7/1wGgAxD/1wGkAAX/rgGkAAr/rgGkAZ3/hQGkAab/hQGkAaj/1wGkAbz/mgGkAb3/1wGkAcH/mgGkAcT/hQGkAdz/1wGkAd3/1wGkAeH/1wGkAeT/1wGkAfb/1wGkAgf/rgGkAgv/rgGkAm7/rgGkAnz/mgGkAoD/rgGkAoL/rgGkApf/rgGkApv/rgGkAqf/rgGkAqn/hQGkAqr/1wGkArX/mgGkArb/1wGkArf/mgGkArj/1wGkArn/mgGkArr/1wGkAr3/hQGkAr7/1wGkAr//mgGkAsD/1wGkAsH/mgGkAsL/1wGkAtT/mgGkAtX/1wGkAvf/1wGkAvj/1wGkAvn/1wGkAvr/1wGkAvv/1wGkAvz/1wGkAv3/mgGkAv7/1wGkAwP/rgGkAw3/mgGkAw7/wwGkAw//mgGkAxD/wwGkAxf/hQGkAxj/1wGlAAX/rgGlAAr/rgGlAZ3/hQGlAab/hQGlAaj/1wGlAbz/mgGlAb3/1wGlAcH/mgGlAcT/hQGlAdz/1wGlAd3/1wGlAeH/1wGlAeT/1wGlAfb/1wGlAgf/rgGlAgv/rgGlAm7/rgGlAnz/mgGlAoD/rgGlAoL/rgGlApf/rgGlApv/rgGlAqf/rgGlAqn/hQGlAqr/1wGlArX/mgGlArb/1wGlArf/mgGlArj/1wGlArn/mgGlArr/1wGlAr3/hQGlAr7/1wGlAr//mgGlAsD/1wGlAsH/mgGlAsL/1wGlAtT/mgGlAtX/1wGlAvf/1wGlAvj/1wGlAvn/1wGlAvr/1wGlAvv/1wGlAvz/1wGlAv3/mgGlAv7/1wGlAwP/rgGlAw3/mgGlAw7/wwGlAw//mgGlAxD/wwGlAxf/hQGlAxj/1wGmAAX/rgGmAAr/rgGmAZ3/hQGmAab/hQGmAaj/1wGmAbz/mgGmAb3/1wGmAcH/mgGmAcT/hQGmAdz/1wGmAd3/1wGmAeH/1wGmAeT/1wGmAfb/1wGmAgf/rgGmAgv/rgGmAm7/rgGmAnz/mgGmAoD/rgGmAoL/rgGmApf/rgGmApv/rgGmAqf/rgGmAqn/hQGmAqr/1wGmArX/mgGmArb/1wGmArf/mgGmArj/1wGmArn/mgGmArr/1wGmAr3/hQGmAr7/1wGmAr//mgGmAsD/1wGmAsH/mgGmAsL/1wGmAtT/mgGmAtX/1wGmAvf/1wGmAvj/1wGmAvn/1wGmAvr/1wGmAvv/1wGmAvz/1wGmAv3/mgGmAv7/1wGmAwP/rgGmAw3/mgGmAw7/wwGmAw//mgGmAxD/wwGmAxf/hQGmAxj/1wGnAZ//1wGnAbj/1wGnAbv/1wGnAb7/1wGnAcH/1wGnAeH/1wGnAmz/1wGnAnz/1wGnAn7/1wGnAoT/1wGnAob/1wGnAoj/1wGnAor/1wGnAoz/1wGnArH/1wGnArP/1wGnAr//1wGnAsD/1wGnAsH/1wGnAsL/1wGnAsX/mgGnAsf/mgGnAtT/1wGnAtX/1wGnAu//1wGnAvH/1wGnAvP/1wGnAv3/1wGnAv7/1wGnAwn/1wGnAwv/1wGnAw7/1wGnAxD/1wGnAxX/1wGnAxn/7AGoAA//hQGoABH/hQGoAZ//7AGoAaT/mgGoAar/cQGoAa7/mgGoAbX/mgGoAbj/7AGoAbv/7AGoAb7/wwGoAcn/7AGoAc7/rgGoAc//1wGoAdX/rgGoAdj/1wGoAdv/1wGoAd7/1wGoAeH/1wGoAer/1wGoAesAZgGoAe3/1wGoAe7/7AGoAfL/rgGoAfQAZgGoAgj/hQGoAgz/hQGoAmr/1wGoAmz/7AGoAnL/cQGoAnP/rgGoAn7/7AGoAn//1wGoAoT/7AGoAoX/1wGoAob/7AGoAof/1wGoAoj/7AGoAon/1wGoAor/7AGoAoz/7AGoAo3/1wGoApgAZgGoAqgAZgGoArH/7AGoArL/1wGoArP/7AGoArT/1wGoAsD/1wGoAsL/1wGoAsX/1wGoAsb/wwGoAsf/1wGoAsj/wwGoAs7/mgGoAs//rgGoAtX/1wGoAtn/cQGoAtv/cQGoAt3/cQGoAuD/1wGoAu//7AGoAvD/1wGoAvH/7AGoAvL/1wGoAvP/7AGoAvT/1wGoAv7/1wGoAwn/cQGoAwr/1wGoAwv/cQGoAwz/1wGoAxH/mgGoAxL/rgGoAxX/7AGoAxb/1wGoAxr/1wGoAxv/mgGoAxz/rgGqAAX/cQGqAAr/cQGqAZ3/mgGqAab/mgGqAbz/cQGqAb7/1wGqAcH/mgGqAcT/mgGqAdz/1wGqAeH/1wGqAeT/1wGqAgf/cQGqAgv/cQGqAm7/1wGqAnz/mgGqAoD/rgGqAoL/rgGqApf/1wGqApv/1wGqAqf/1wGqAqn/mgGqAqr/1wGqArX/cQGqArb/1wGqArf/hQGqArn/hQGqAr3/mgGqAr7/1wGqAr//mgGqAsD/1wGqAsH/mgGqAsL/1wGqAsX/mgGqAsf/mgGqAtT/mgGqAtX/1wGqAuH/1wGqAuP/1wGqAv3/mgGqAv7/1wGqAwP/1wGqAw3/cQGqAw7/1wGqAw//cQGqAxD/1wGqAxf/mgGqAxj/1wGrAAX/1wGrAAr/1wGrAar/7AGrAcH/1wGrAgf/1wGrAgv/1wGrAnL/7AGrAnz/1wGrAr//1wGrAsH/1wGrAsX/1wGrAsf/1wGrAtT/1wGrAtn/7AGrAtv/7AGrAt3/7AGrAv3/1wGsAA//rgGsABH/rgGsAgj/rgGsAgz/rgGsAoD/7AGsAoL/7AGsArf/7AGsArn/7AGsAw3/1wGsAw//1wGtAA//hQGtABD/rgGtABH/hQGtAZ//1wGtAaT/mgGtAar/cQGtAa7/mgGtAbX/mgGtAbj/1wGtAbv/1wGtAbwAKQGtAb7/rgGtAcz/mgGtAc3/mgGtAc7/hQGtAc//cQGtAdD/1wGtAdH/1wGtAdL/mgGtAdP/mgGtAdT/mgGtAdX/hQGtAdb/mgGtAdf/mgGtAdj/cQGtAdn/mgGtAdr/mgGtAdv/cQGtAdz/rgGtAd3/rgGtAd7/cQGtAd//1wGtAeD/mgGtAeH/mgGtAeL/mgGtAeP/mgGtAeT/rgGtAeX/mgGtAeb/mgGtAef/1wGtAej/mgGtAen/wwGtAer/cQGtAez/mgGtAe3/cQGtAe7/hQGtAfL/hQGtAfP/mgGtAfX/mgGtAfb/rgGtAff/mgGtAfn/mgGtAgL/rgGtAgP/rgGtAgT/rgGtAgj/hQGtAgz/hQGtAmr/cQGtAmv/mgGtAmz/1wGtAm3/1wGtAnH/mgGtAnL/cQGtAnP/hQGtAnX/mgGtAnf/mgGtAnn/mgGtAn3/mgGtAn7/1wGtAn//cQGtAoH/1wGtAoP/1wGtAoT/1wGtAoX/cQGtAob/1wGtAof/cQGtAoj/1wGtAon/cQGtAor/1wGtAov/1wGtAoz/1wGtAo3/cQGtApb/mgGtApr/mgGtAp7/mgGtAqD/1wGtAqL/1wGtAqT/mgGtAqb/mgGtAqr/rgGtAqz/mgGtAq7/mgGtArD/mgGtArH/1wGtArL/cQGtArP/1wGtArT/cQGtArUAKQGtArb/rgGtArj/rgGtArr/rgGtArz/1wGtAr7/rgGtAsD/mgGtAsL/mgGtAsT/mgGtAsX/mgGtAsb/cQGtAsf/mgGtAsj/cQGtAsv/1wGtAs3/mgGtAs7/mgGtAs//hQGtAtH/mgGtAtP/mgGtAtX/mgGtAtf/mgGtAtn/cQGtAtv/cQGtAt3/cQGtAuD/cQGtAub/1wGtAuj/1wGtAur/wwGtAuz/mgGtAu7/mgGtAu//1wGtAvD/cQGtAvH/1wGtAvL/cQGtAvP/1wGtAvT/cQGtAvb/1wGtAvj/rgGtAvr/rgGtAvz/rgGtAv7/mgGtAwD/mgGtAwL/mgGtAwb/1wGtAwj/1wGtAwn/cQGtAwr/cQGtAwv/cQGtAwz/cQGtAw7/mgGtAxD/mgGtAxH/mgGtAxL/hQGtAxT/mgGtAxX/1wGtAxb/cQGtAxj/rgGtAxr/cQGtAxv/mgGtAxz/hQGuAaMA4QGuAuoAKQGuAw7/1wGuAxD/1wGwAZ//1wGwAbj/1wGwAbv/1wGwAb7/1wGwAcH/1wGwAeH/1wGwAmz/1wGwAnz/1wGwAn7/1wGwAoT/1wGwAob/1wGwAoj/1wGwAor/1wGwAoz/1wGwArH/1wGwArP/1wGwAr//1wGwAsD/1wGwAsH/1wGwAsL/1wGwAsX/mgGwAsf/mgGwAtT/1wGwAtX/1wGwAu//1wGwAvH/1wGwAvP/1wGwAv3/1wGwAv7/1wGwAwn/1wGwAwv/1wGwAw7/1wGwAxD/1wGwAxX/1wGwAxn/7AGxAA//rgGxABH/rgGxAgj/rgGxAgz/rgGxAoD/7AGxAoL/7AGxArf/7AGxArn/7AGxAw3/1wGxAw//1wG0AZ//1wG0Abj/1wG0Abv/1wG0Ab7/1wG0AcH/1wG0AeH/1wG0Amz/1wG0Anz/1wG0An7/1wG0AoT/1wG0Aob/1wG0Aoj/1wG0Aor/1wG0Aoz/1wG0ArH/1wG0ArP/1wG0Ar//1wG0AsD/1wG0AsH/1wG0AsL/1wG0AsX/mgG0Asf/mgG0AtT/1wG0AtX/1wG0Au//1wG0AvH/1wG0AvP/1wG0Av3/1wG0Av7/1wG0Awn/1wG0Awv/1wG0Aw7/1wG0AxD/1wG0AxX/1wG0Axn/7AG4AA//rgG4ABH/rgG4AZ3/7AG4AaT/1wG4Aab/7AG4Aaj/1wG4Aar/1wG4Aa7/1wG4AbD/1wG4AbH/7AG4AbX/1wG4Abz/wwG4Ab3/1wG4Ab//1wG4AcH/1wG4AcT/7AG4Acf/7AG4Ac7/7AG4AdX/7AG4AfL/7AG4Agj/rgG4Agz/rgG4AnL/1wG4AnP/7AG4Anr/7AG4Anz/1wG4AoD/7AG4AoL/7AG4Ap//1wG4AqH/7AG4Aqn/7AG4ArX/wwG4Arf/7AG4Arn/7AG4Arv/1wG4Ar3/7AG4Ar//1wG4AsH/1wG4Asr/1wG4As7/1wG4As//7AG4AtT/1wG4Atn/1wG4Atv/1wG4At3/1wG4AuX/1wG4Auf/7AG4AvX/7AG4Avf/1wG4Avn/1wG4Avv/1wG4Av3/1wG4AwX/1wG4Awf/1wG4Aw3/1wG4Aw//1wG4AxH/1wG4AxL/7AG4Axf/7AG4Axv/1wG4Axz/7AG6AA/+9gG6ABH+9gG6AaT/hQG6Aar/mgG6Aa7/hQG6AbD/1wG6AbX/hQG6Ab//1wG6Ac7/mgG6AdX/mgG6AfL/mgG6Agj+9gG6Agz+9gG6AnL/mgG6AnP/mgG6Anb/7AG6Ap//1wG6Arv/1wG6Asr/1wG6As7/hQG6As//mgG6Atn/mgG6Atv/mgG6At3/mgG6AuX/1wG6AwX/1wG6Awf/1wG6Awn/rgG6Awv/rgG6AxH/hQG6AxL/mgG6Axv/hQG6Axz/mgG7AZ//1wG7Abj/1wG7Abv/1wG7Ab7/1wG7AeH/1wG7Amz/1wG7An7/1wG7AoT/1wG7Aob/1wG7Aoj/1wG7Aor/1wG7Aoz/1wG7ArH/1wG7ArP/1wG7AsD/1wG7AsL/1wG7AsX/1wG7Asf/1wG7AtX/1wG7Au//1wG7AvH/1wG7AvP/1wG7Av7/1wG7Awn/1wG7Awv/1wG7Aw7/1wG7AxD/1wG7AxX/1wG8AA//hQG8ABD/rgG8ABH/hQG8AZ//1wG8AaT/mgG8Aar/cQG8Aa7/mgG8AbX/mgG8Abj/1wG8Abv/1wG8AbwAKQG8Ab7/rgG8Acz/mgG8Ac3/mgG8Ac7/hQG8Ac//cQG8AdD/1wG8AdH/1wG8AdL/mgG8AdP/mgG8AdT/mgG8AdX/hQG8Adb/mgG8Adf/mgG8Adj/cQG8Adn/mgG8Adr/mgG8Adv/cQG8Adz/rgG8Ad3/rgG8Ad7/cQG8Ad//1wG8AeD/mgG8AeH/mgG8AeL/mgG8AeP/mgG8AeT/rgG8AeX/mgG8Aeb/mgG8Aef/1wG8Aej/mgG8Aen/wwG8Aer/cQG8Aez/mgG8Ae3/cQG8Ae7/hQG8AfL/hQG8AfP/mgG8AfX/mgG8Afb/rgG8Aff/mgG8Afn/mgG8AgL/rgG8AgP/rgG8AgT/rgG8Agj/hQG8Agz/hQG8Amr/cQG8Amv/mgG8Amz/1wG8Am3/1wG8AnH/mgG8AnL/cQG8AnP/hQG8AnX/mgG8Anf/mgG8Ann/mgG8An3/mgG8An7/1wG8An//cQG8AoH/1wG8AoP/1wG8AoT/1wG8AoX/cQG8Aob/1wG8Aof/cQG8Aoj/1wG8Aon/cQG8Aor/1wG8Aov/1wG8Aoz/1wG8Ao3/cQG8Apb/mgG8Apr/mgG8Ap7/mgG8AqD/1wG8AqL/1wG8AqT/mgG8Aqb/mgG8Aqr/rgG8Aqz/mgG8Aq7/mgG8ArD/mgG8ArH/1wG8ArL/cQG8ArP/1wG8ArT/cQG8ArUAKQG8Arb/rgG8Arj/rgG8Arr/rgG8Arz/1wG8Ar7/rgG8AsD/mgG8AsL/mgG8AsT/mgG8AsX/mgG8Asb/cQG8Asf/mgG8Asj/cQG8Asv/1wG8As3/mgG8As7/mgG8As//hQG8AtH/mgG8AtP/mgG8AtX/mgG8Atf/mgG8Atn/cQG8Atv/cQG8At3/cQG8AuD/cQG8Aub/1wG8Auj/1wG8Aur/wwG8Auz/mgG8Au7/mgG8Au//1wG8AvD/cQG8AvH/1wG8AvL/cQG8AvP/1wG8AvT/cQG8Avb/1wG8Avj/rgG8Avr/rgG8Avz/rgG8Av7/mgG8AwD/mgG8AwL/mgG8Awb/1wG8Awj/1wG8Awn/cQG8Awr/cQG8Awv/cQG8Awz/cQG8Aw7/mgG8AxD/mgG8AxH/mgG8AxL/hQG8AxT/mgG8AxX/1wG8Axb/cQG8Axj/rgG8Axr/cQG8Axv/mgG8Axz/hQG9AA//hQG9ABH/hQG9AZ//7AG9AaT/mgG9Aar/cQG9Aa7/mgG9AbX/mgG9Abj/7AG9Abv/7AG9Ab7/wwG9Acn/7AG9Ac7/rgG9Ac//1wG9AdX/rgG9Adj/1wG9Adv/1wG9Ad7/1wG9AeH/1wG9Aer/1wG9AesAZgG9Ae3/1wG9Ae7/7AG9AfL/rgG9AfQAZgG9Agj/hQG9Agz/hQG9Amr/1wG9Amz/7AG9AnL/cQG9AnP/rgG9An7/7AG9An//1wG9AoT/7AG9AoX/1wG9Aob/7AG9Aof/1wG9Aoj/7AG9Aon/1wG9Aor/7AG9Aoz/7AG9Ao3/1wG9ApgAZgG9AqgAZgG9ArH/7AG9ArL/1wG9ArP/7AG9ArT/1wG9AsD/1wG9AsL/1wG9AsX/1wG9Asb/wwG9Asf/1wG9Asj/wwG9As7/mgG9As//rgG9AtX/1wG9Atn/cQG9Atv/cQG9At3/cQG9AuD/1wG9Au//7AG9AvD/1wG9AvH/7AG9AvL/1wG9AvP/7AG9AvT/1wG9Av7/1wG9Awn/cQG9Awr/1wG9Awv/cQG9Awz/1wG9AxH/mgG9AxL/rgG9AxX/7AG9Axb/1wG9Axr/1wG9Axv/mgG9Axz/rgG+AA//rgG+ABH/rgG+AZ3/1wG+AaT/1wG+Aab/1wG+Aaj/wwG+Aar/1wG+Aa7/1wG+AbD/1wG+AbH/1wG+AbX/1wG+Abz/wwG+Ab3/wwG+Ab//1wG+AcT/1wG+Acf/1wG+Ac7/7AG+AdX/7AG+AfL/7AG+Agj/rgG+Agz/rgG+AnL/1wG+AnP/7AG+Anr/1wG+AoD/7AG+AoL/7AG+Ap//1wG+AqH/1wG+Aqn/1wG+ArX/wwG+Arf/wwG+Arn/wwG+Arv/1wG+Ar3/1wG+Asr/1wG+As7/1wG+As//7AG+Atn/1wG+Atv/1wG+At3/1wG+AuX/1wG+Auf/1wG+AvX/1wG+Avf/wwG+Avn/wwG+Avv/wwG+AwX/1wG+Awf/1wG+Aw3/1wG+Aw//1wG+AxH/1wG+AxL/7AG+Axf/1wG+Axv/1wG+Axz/7AG/AZ//1wG/Abj/1wG/Abv/1wG/Ab7/1wG/AcH/1wG/AeH/1wG/Amz/1wG/Anz/1wG/An7/1wG/AoT/1wG/Aob/1wG/Aoj/1wG/Aor/1wG/Aoz/1wG/ArH/1wG/ArP/1wG/Ar//1wG/AsD/1wG/AsH/1wG/AsL/1wG/AsX/mgG/Asf/mgG/AtT/1wG/AtX/1wG/Au//1wG/AvH/1wG/AvP/1wG/Av3/1wG/Av7/1wG/Awn/1wG/Awv/1wG/Aw7/1wG/AxD/1wG/AxX/1wG/Axn/7AHAAaMA4QHAAuoAKQHAAw7/1wHAAxD/1wHDAaMA4QHDAuoAKQHDAw7/1wHDAxD/1wHEAAX/rgHEAAr/rgHEAZ3/hQHEAab/hQHEAaj/1wHEAbz/mgHEAb3/1wHEAcH/mgHEAcT/hQHEAdz/1wHEAd3/1wHEAeH/1wHEAeT/1wHEAfb/1wHEAgf/rgHEAgv/rgHEAm7/rgHEAnz/mgHEAoD/rgHEAoL/rgHEApf/rgHEApv/rgHEAqf/rgHEAqn/hQHEAqr/1wHEArX/mgHEArb/1wHEArf/mgHEArj/1wHEArn/mgHEArr/1wHEAr3/hQHEAr7/1wHEAr//mgHEAsD/1wHEAsH/mgHEAsL/1wHEAtT/mgHEAtX/1wHEAvf/1wHEAvj/1wHEAvn/1wHEAvr/1wHEAvv/1wHEAvz/1wHEAv3/mgHEAv7/1wHEAwP/rgHEAw3/mgHEAw7/wwHEAw//mgHEAxD/wwHEAxf/hQHEAxj/1wHGAAX/rgHGAAr/rgHGAZ3/hQHGAab/hQHGAaj/1wHGAbz/mgHGAb3/1wHGAcH/mgHGAcT/hQHGAdz/1wHGAd3/1wHGAeH/1wHGAeT/1wHGAfb/1wHGAgf/rgHGAgv/rgHGAm7/rgHGAnz/mgHGAoD/rgHGAoL/rgHGApf/rgHGApv/rgHGAqf/rgHGAqn/hQHGAqr/1wHGArX/mgHGArb/1wHGArf/mgHGArj/1wHGArn/mgHGArr/1wHGAr3/hQHGAr7/1wHGAr//mgHGAsD/1wHGAsH/mgHGAsL/1wHGAtT/mgHGAtX/1wHGAvf/1wHGAvj/1wHGAvn/1wHGAvr/1wHGAvv/1wHGAvz/1wHGAv3/mgHGAv7/1wHGAwP/rgHGAw3/mgHGAw7/wwHGAw//mgHGAxD/wwHGAxf/hQHGAxj/1wHHAA//rgHHABH/rgHHAZ3/7AHHAaT/1wHHAab/7AHHAaj/1wHHAar/1wHHAa7/1wHHAbD/1wHHAbH/7AHHAbX/1wHHAbz/wwHHAb3/1wHHAb//1wHHAcH/1wHHAcT/7AHHAcf/7AHHAc7/7AHHAdX/7AHHAfL/7AHHAgj/rgHHAgz/rgHHAnL/1wHHAnP/7AHHAnr/7AHHAnz/1wHHAoD/7AHHAoL/7AHHAp//1wHHAqH/7AHHAqn/7AHHArX/wwHHArf/7AHHArn/7AHHArv/1wHHAr3/7AHHAr//1wHHAsH/1wHHAsr/1wHHAs7/1wHHAs//7AHHAtT/1wHHAtn/1wHHAtv/1wHHAt3/1wHHAuX/1wHHAuf/7AHHAvX/7AHHAvf/1wHHAvn/1wHHAvv/1wHHAv3/1wHHAwX/1wHHAwf/1wHHAw3/1wHHAw//1wHHAxH/1wHHAxL/7AHHAxf/7AHHAxv/1wHHAxz/7AHIAA//rgHIABH/rgHIAZ3/7AHIAaT/1wHIAab/7AHIAaj/1wHIAar/1wHIAa7/1wHIAbD/1wHIAbH/7AHIAbX/1wHIAbz/wwHIAb3/1wHIAb//1wHIAcH/1wHIAcT/7AHIAcf/7AHIAc7/7AHIAdX/7AHIAfL/7AHIAgj/rgHIAgz/rgHIAnL/1wHIAnP/7AHIAnr/7AHIAnz/1wHIAoD/7AHIAoL/7AHIAp//1wHIAqH/7AHIAqn/7AHIArX/wwHIArf/7AHIArn/7AHIArv/1wHIAr3/7AHIAr//1wHIAsH/1wHIAsr/1wHIAs7/1wHIAs//7AHIAtT/1wHIAtn/1wHIAtv/1wHIAt3/1wHIAuX/1wHIAuf/7AHIAvX/7AHIAvf/1wHIAvn/1wHIAvv/1wHIAv3/1wHIAwX/1wHIAwf/1wHIAw3/1wHIAw//1wHIAxH/1wHIAxL/7AHIAxf/7AHIAxv/1wHIAxz/7AHKAAX/7AHKAAr/7AHKAgf/7AHKAgv/7AHMAekAKQHNAA//mgHNABD/1wHNABH/mgHNAc7/wwHNAc//7AHNAdX/wwHNAdj/7AHNAdv/7AHNAd7/7AHNAer/7AHNAe3/7AHNAfL/wwHNAgL/1wHNAgP/1wHNAgT/1wHNAgj/mgHNAgz/mgHNAmr/7AHNAnP/wwHNAn//7AHNAoX/7AHNAof/7AHNAon/7AHNAo3/7AHNArL/7AHNArT/7AHNAs//wwHNAuD/7AHNAvD/7AHNAvL/7AHNAvT/7AHNAwr/7AHNAwz/7AHNAxL/wwHNAxb/7AHNAxr/7AHNAxz/wwHOAAX/7AHOAAr/7AHOAgf/7AHOAgv/7AHPAAX/7AHPAAr/7AHPAgf/7AHPAgv/7AHQAc//1wHQAdj/1wHQAdv/1wHQAd7/1wHQAeH/1wHQAer/1wHQAe3/1wHQAmr/1wHQAn//1wHQAoX/1wHQAof/1wHQAon/1wHQAo3/1wHQArL/1wHQArT/1wHQAsD/1wHQAsL/1wHQAsb/1wHQAsj/1wHQAtX/1wHQAuD/1wHQAvD/1wHQAvL/1wHQAvT/1wHQAv7/1wHQAwr/1wHQAwz/1wHQAxb/1wHQAxr/1wHRAekAKQHUAc//1wHUAdj/1wHUAdv/1wHUAd7/1wHUAeH/1wHUAer/1wHUAe3/1wHUAmr/1wHUAn//1wHUAoX/1wHUAof/1wHUAon/1wHUAo3/1wHUArL/1wHUArT/1wHUAsD/1wHUAsL/1wHUAsb/1wHUAsj/1wHUAtX/1wHUAuD/1wHUAvD/1wHUAvL/1wHUAvT/1wHUAv7/1wHUAwr/1wHUAwz/1wHUAxb/1wHUAxr/1wHYAAX/7AHYAAr/7AHYAdD/1wHYAdz/7AHYAd3/7AHYAd//1wHYAeH/7AHYAeT/7AHYAfb/7AHYAgf/7AHYAgv/7AHYAqD/1wHYAqr/7AHYArb/7AHYArz/1wHYAr7/7AHYAsD/7AHYAsL/7AHYAsv/1wHYAtX/7AHYAub/1wHYAvj/7AHYAvr/7AHYAvz/7AHYAv7/7AHYAwb/1wHYAwj/1wHYAw7/7AHYAxD/7AHYAxj/7AHaAAX/7AHaAAr/7AHaAdD/1wHaAdz/7AHaAd3/7AHaAd//1wHaAeH/7AHaAeT/7AHaAfb/7AHaAgf/7AHaAgv/7AHaAqD/1wHaAqr/7AHaArb/7AHaArz/1wHaAr7/7AHaAsD/7AHaAsL/7AHaAsv/1wHaAtX/7AHaAub/1wHaAvj/7AHaAvr/7AHaAvz/7AHaAv7/7AHaAwb/1wHaAwj/1wHaAw7/7AHaAxD/7AHaAxj/7AHcAA//mgHcABD/1wHcABH/mgHcAc7/wwHcAc//7AHcAdX/wwHcAdj/7AHcAdv/7AHcAd7/7AHcAer/7AHcAe3/7AHcAfL/wwHcAgL/1wHcAgP/1wHcAgT/1wHcAgj/mgHcAgz/mgHcAmr/7AHcAnP/wwHcAn//7AHcAoX/7AHcAof/7AHcAon/7AHcAo3/7AHcArL/7AHcArT/7AHcAs//wwHcAuD/7AHcAvD/7AHcAvL/7AHcAvT/7AHcAwr/7AHcAwz/7AHcAxL/wwHcAxb/7AHcAxr/7AHcAxz/wwHdAA//rgHdABH/rgHdAc7/1wHdAdX/1wHdAfL/1wHdAgj/rgHdAgz/rgHdAnP/1wHdAs//1wHdAxL/1wHdAxz/1wHeAAX/7AHeAAr/7AHeAdD/1wHeAdz/7AHeAd3/7AHeAd//1wHeAeH/7AHeAeT/7AHeAfb/7AHeAgf/7AHeAgv/7AHeAqD/1wHeAqr/7AHeArb/7AHeArz/1wHeAr7/7AHeAsD/7AHeAsL/7AHeAsv/1wHeAtX/7AHeAub/1wHeAvj/7AHeAvr/7AHeAvz/7AHeAv7/7AHeAwb/1wHeAwj/1wHeAw7/7AHeAxD/7AHeAxj/7AHfAc//1wHfAdj/1wHfAdv/1wHfAd7/1wHfAeH/1wHfAer/1wHfAe3/1wHfAmr/1wHfAn//1wHfAoX/1wHfAof/1wHfAon/1wHfAo3/1wHfArL/1wHfArT/1wHfAsD/1wHfAsL/1wHfAsb/1wHfAsj/1wHfAtX/1wHfAuD/1wHfAvD/1wHfAvL/1wHfAvT/1wHfAv7/1wHfAwr/1wHfAwz/1wHfAxb/1wHfAxr/1wHgAAX/7AHgAAr/7AHgAgf/7AHgAgv/7AHjAAX/7AHjAAr/7AHjAgf/7AHjAgv/7AHkAAX/hQHkAAr/hQHkAdD/1wHkAdz/mgHkAd3/wwHkAd//1wHkAeH/rgHkAeT/mgHkAfb/wwHkAgf/hQHkAgv/hQHkAm3/1wHkAoH/1wHkAoP/1wHkAov/1wHkAqD/1wHkAqr/mgHkArb/mgHkArj/wwHkArr/wwHkArz/1wHkAr7/mgHkAsD/rgHkAsL/rgHkAsb/1wHkAsj/1wHkAsv/1wHkAtX/rgHkAub/1wHkAur/1wHkAvj/wwHkAvr/wwHkAvz/wwHkAv7/rgHkAwb/1wHkAwj/1wHkAw7/mgHkAxD/mgHkAxj/mgHmAAX/hQHmAAr/hQHmAdD/1wHmAdz/mgHmAd3/wwHmAd//1wHmAeH/rgHmAeT/mgHmAfb/wwHmAgf/hQHmAgv/hQHmAm3/1wHmAoH/1wHmAoP/1wHmAov/1wHmAqD/1wHmAqr/mgHmArb/mgHmArj/wwHmArr/wwHmArz/1wHmAr7/mgHmAsD/rgHmAsL/rgHmAsb/1wHmAsj/1wHmAsv/1wHmAtX/rgHmAub/1wHmAur/1wHmAvj/wwHmAvr/wwHmAvz/wwHmAv7/rgHmAwb/1wHmAwj/1wHmAw7/mgHmAxD/mgHmAxj/mgHnAAX/7AHnAAr/7AHnAdD/1wHnAdz/7AHnAd3/7AHnAd//1wHnAeH/7AHnAeT/7AHnAfb/7AHnAgf/7AHnAgv/7AHnAqD/1wHnAqr/7AHnArb/7AHnArz/1wHnAr7/7AHnAsD/7AHnAsL/7AHnAsv/1wHnAtX/7AHnAub/1wHnAvj/7AHnAvr/7AHnAvz/7AHnAv7/7AHnAwb/1wHnAwj/1wHnAw7/7AHnAxD/7AHnAxj/7AHoAAX/7AHoAAr/7AHoAdD/1wHoAdz/7AHoAd3/7AHoAd//1wHoAeH/7AHoAeT/7AHoAfb/7AHoAgf/7AHoAgv/7AHoAqD/1wHoAqr/7AHoArb/7AHoArz/1wHoAr7/7AHoAsD/7AHoAsL/7AHoAsv/1wHoAtX/7AHoAub/1wHoAvj/7AHoAvr/7AHoAvz/7AHoAv7/7AHoAwb/1wHoAwj/1wHoAw7/7AHoAxD/7AHoAxj/7AHqAAX/7AHqAAr/7AHqAgf/7AHqAgv/7AHrAAX/7AHrAAr/7AHrAgf/7AHrAgv/7AHrAw7/1wHrAxD/1wHsAA//mgHsABD/1wHsABH/mgHsAc7/wwHsAc//7AHsAdX/wwHsAdj/7AHsAdv/7AHsAd7/7AHsAer/7AHsAe3/7AHsAfL/wwHsAgL/1wHsAgP/1wHsAgT/1wHsAgj/mgHsAgz/mgHsAmr/7AHsAnP/wwHsAn//7AHsAoX/7AHsAof/7AHsAon/7AHsAo3/7AHsArL/7AHsArT/7AHsAs//wwHsAuD/7AHsAvD/7AHsAvL/7AHsAvT/7AHsAwr/7AHsAwz/7AHsAxL/wwHsAxb/7AHsAxr/7AHsAxz/wwHyAAX/hQHyAAr/hQHyAdD/1wHyAdz/mgHyAd3/wwHyAd//1wHyAeH/rgHyAeT/mgHyAfb/wwHyAgf/hQHyAgv/hQHyAm3/1wHyAoH/1wHyAoP/1wHyAov/1wHyAqD/1wHyAqr/mgHyArb/mgHyArj/wwHyArr/wwHyArz/1wHyAr7/mgHyAsD/rgHyAsL/rgHyAsb/1wHyAsj/1wHyAsv/1wHyAtX/rgHyAub/1wHyAur/1wHyAvj/wwHyAvr/wwHyAvz/wwHyAv7/rgHyAwb/1wHyAwj/1wHyAw7/mgHyAxD/mgHyAxj/mgHzAAX/hQHzAAr/hQHzAdD/1wHzAdz/mgHzAd3/wwHzAd//1wHzAeH/rgHzAeT/mgHzAfb/wwHzAgf/hQHzAgv/hQHzAm3/1wHzAoH/1wHzAoP/1wHzAov/1wHzAqD/1wHzAqr/mgHzArb/mgHzArj/wwHzArr/wwHzArz/1wHzAr7/mgHzAsD/rgHzAsL/rgHzAsb/1wHzAsj/1wHzAsv/1wHzAtX/rgHzAub/1wHzAur/1wHzAvj/wwHzAvr/wwHzAvz/wwHzAv7/rgHzAwb/1wHzAwj/1wHzAw7/mgHzAxD/mgHzAxj/mgH0AAX/7AH0AAr/7AH0Agf/7AH0Agv/7AH0Aw7/1wH0AxD/1wH1Ac//1wH1Adj/1wH1Adv/1wH1Ad7/1wH1AeH/1wH1Aer/1wH1Ae3/1wH1Amr/1wH1An//1wH1AoX/1wH1Aof/1wH1Aon/1wH1Ao3/1wH1ArL/1wH1ArT/1wH1AsD/1wH1AsL/1wH1Asb/1wH1Asj/1wH1AtX/1wH1AuD/1wH1AvD/1wH1AvL/1wH1AvT/1wH1Av7/1wH1Awr/1wH1Awz/1wH1Axb/1wH1Axr/1wH2AA//rgH2ABH/rgH2Ac7/1wH2AdX/1wH2AfL/1wH2Agj/rgH2Agz/rgH2AnP/1wH2As//1wH2AxL/1wH2Axz/1wH4AA//hQH4ABD/rgH4ABH/hQH4AZ//1wH4AaT/mgH4Aar/cQH4Aa7/mgH4AbX/mgH4Abj/1wH4Abv/1wH4AbwAKQH4Ab7/rgH4Acz/mgH4Ac3/mgH4Ac7/hQH4Ac//cQH4AdD/1wH4AdH/1wH4AdL/mgH4AdP/mgH4AdT/mgH4AdX/hQH4Adb/mgH4Adf/mgH4Adj/cQH4Adn/mgH4Adr/mgH4Adv/cQH4Adz/rgH4Ad3/rgH4Ad7/cQH4Ad//1wH4AeD/mgH4AeH/mgH4AeL/mgH4AeP/mgH4AeT/rgH4AeX/mgH4Aeb/mgH4Aef/1wH4Aej/mgH4Aen/wwH4Aer/cQH4Aez/mgH4Ae3/cQH4Ae7/hQH4AfL/hQH4AfP/mgH4AfX/mgH4Afb/rgH4Aff/mgH4Afn/mgH4AgL/rgH4AgP/rgH4AgT/rgH4Agj/hQH4Agz/hQH4Amr/cQH4Amv/mgH4Amz/1wH4Am3/1wH4AnH/mgH4AnL/cQH4AnP/hQH4AnX/mgH4Anf/mgH4Ann/mgH4An3/mgH4An7/1wH4An//cQH4AoH/1wH4AoP/1wH4AoT/1wH4AoX/cQH4Aob/1wH4Aof/cQH4Aoj/1wH4Aon/cQH4Aor/1wH4Aov/1wH4Aoz/1wH4Ao3/cQH4Apb/mgH4Apr/mgH4Ap7/mgH4AqD/1wH4AqL/1wH4AqT/mgH4Aqb/mgH4Aqr/rgH4Aqz/mgH4Aq7/mgH4ArD/mgH4ArH/1wH4ArL/cQH4ArP/1wH4ArT/cQH4ArUAKQH4Arb/rgH4Arj/rgH4Arr/rgH4Arz/1wH4Ar7/rgH4AsD/mgH4AsL/mgH4AsT/mgH4AsX/mgH4Asb/cQH4Asf/mgH4Asj/cQH4Asv/1wH4As3/mgH4As7/mgH4As//hQH4AtH/mgH4AtP/mgH4AtX/mgH4Atf/mgH4Atn/cQH4Atv/cQH4At3/cQH4AuD/cQH4Aub/1wH4Auj/1wH4Aur/wwH4Auz/mgH4Au7/mgH4Au//1wH4AvD/cQH4AvH/1wH4AvL/cQH4AvP/1wH4AvT/cQH4Avb/1wH4Avj/rgH4Avr/rgH4Avz/rgH4Av7/mgH4AwD/mgH4AwL/mgH4Awb/1wH4Awj/1wH4Awn/cQH4Awr/cQH4Awv/cQH4Awz/cQH4Aw7/mgH4AxD/mgH4AxH/mgH4AxL/hQH4AxT/mgH4AxX/1wH4Axb/cQH4Axj/rgH4Axr/cQH4Axv/mgH4Axz/hQH5AA//mgH5ABD/1wH5ABH/mgH5Ac7/wwH5Ac//7AH5AdX/wwH5Adj/7AH5Adv/7AH5Ad7/7AH5Aer/7AH5Ae3/7AH5AfL/wwH5AgL/1wH5AgP/1wH5AgT/1wH5Agj/mgH5Agz/mgH5Amr/7AH5AnP/wwH5An//7AH5AoX/7AH5Aof/7AH5Aon/7AH5Ao3/7AH5ArL/7AH5ArT/7AH5As//wwH5AuD/7AH5AvD/7AH5AvL/7AH5AvT/7AH5Awr/7AH5Awz/7AH5AxL/wwH5Axb/7AH5Axr/7AH5Axz/wwH6AA//mgH6ABH/mgH6ACIAKQH6ACT/rgH6ACb/7AH6ACr/7AH6ADL/7AH6ADT/7AH6AET/1wH6AEb/1wH6AEf/1wH6AEj/1wH6AEr/7AH6AFD/7AH6AFH/7AH6AFL/1wH6AFP/7AH6AFT/1wH6AFX/7AH6AFb/7AH6AFj/7AH6AIL/rgH6AIP/rgH6AIT/rgH6AIX/rgH6AIb/rgH6AIf/rgH6AIn/7AH6AJT/7AH6AJX/7AH6AJb/7AH6AJf/7AH6AJj/7AH6AJr/7AH6AKL/1wH6AKP/1wH6AKT/1wH6AKX/1wH6AKb/1wH6AKf/1wH6AKj/1wH6AKn/1wH6AKr/1wH6AKv/1wH6AKz/1wH6AK3/1wH6ALT/1wH6ALX/1wH6ALb/1wH6ALf/1wH6ALj/1wH6ALr/1wH6ALv/7AH6ALz/7AH6AL3/7AH6AL7/7AH6AML/rgH6AMP/1wH6AMT/rgH6AMX/1wH6AMb/rgH6AMf/1wH6AMj/7AH6AMn/1wH6AMr/7AH6AMv/1wH6AMz/7AH6AM3/1wH6AM7/7AH6AM//1wH6ANH/1wH6ANP/1wH6ANX/1wH6ANf/1wH6ANn/1wH6ANv/1wH6AN3/1wH6AN7/7AH6AN//7AH6AOD/7AH6AOH/7AH6AOL/7AH6AOP/7AH6AOT/7AH6AOX/7AH6APr/7AH6AQb/7AH6AQj/7AH6AQ3/7AH6AQ7/7AH6AQ//1wH6ARD/7AH6ARH/1wH6ARL/7AH6ARP/1wH6ART/7AH6ARX/1wH6ARf/7AH6ARn/7AH6AR3/7AH6ASH/7AH6ASv/7AH6AS3/7AH6AS//7AH6ATH/7AH6ATP/7AH6ATX/7AH6AUP/rgH6AUT/1wH6AUb/1wH6AUf/7AH6AUj/1wH6AUr/7AH6Agj/mgH6Agz/mgH6Alf/7AH6Alj/rgH6Aln/1wH6Al//7AH6AmD/1wH6AmL/7AH6Ax3/rgH6Ax7/1wH6Ax//rgH6AyD/1wH6AyH/rgH6AyL/1wH6AyP/rgH6AyX/rgH6Ayb/1wH6Ayf/rgH6Ayj/1wH6Ayn/rgH6Ayr/1wH6Ayv/rgH6Ayz/1wH6Ay3/rgH6Ay7/1wH6Ay//rgH6AzD/1wH6AzH/rgH6AzL/1wH6AzP/rgH6AzT/1wH6Azb/1wH6Azj/1wH6Azr/1wH6Azz/1wH6A0D/1wH6A0L/1wH6A0T/1wH6A0n/7AH6A0r/1wH6A0v/7AH6A0z/1wH6A03/7AH6A07/1wH6A0//7AH6A1H/7AH6A1L/1wH6A1P/7AH6A1T/1wH6A1X/7AH6A1b/1wH6A1f/7AH6A1j/1wH6A1n/7AH6A1r/1wH6A1v/7AH6A1z/1wH6A13/7AH6A17/1wH6A1//7AH6A2D/1wH6A2L/7AH6A2T/7AH6A2b/7AH6A2j/7AH6A2r/7AH6A2z/7AH6A27/7AH7AAUAUgH7AAoAUgH7AA//rgH7ABH/rgH7ACIAKQH7AgcAUgH7Agj/rgH7AgsAUgH7Agz/rgH8AA//mgH8ABH/mgH8ACIAKQH8ACT/rgH8ACb/7AH8ACr/7AH8ADL/7AH8ADT/7AH8AET/1wH8AEb/1wH8AEf/1wH8AEj/1wH8AEr/7AH8AFD/7AH8AFH/7AH8AFL/1wH8AFP/7AH8AFT/1wH8AFX/7AH8AFb/7AH8AFj/7AH8AIL/rgH8AIP/rgH8AIT/rgH8AIX/rgH8AIb/rgH8AIf/rgH8AIn/7AH8AJT/7AH8AJX/7AH8AJb/7AH8AJf/7AH8AJj/7AH8AJr/7AH8AKL/1wH8AKP/1wH8AKT/1wH8AKX/1wH8AKb/1wH8AKf/1wH8AKj/1wH8AKn/1wH8AKr/1wH8AKv/1wH8AKz/1wH8AK3/1wH8ALT/1wH8ALX/1wH8ALb/1wH8ALf/1wH8ALj/1wH8ALr/1wH8ALv/7AH8ALz/7AH8AL3/7AH8AL7/7AH8AML/rgH8AMP/1wH8AMT/rgH8AMX/1wH8AMb/rgH8AMf/1wH8AMj/7AH8AMn/1wH8AMr/7AH8AMv/1wH8AMz/7AH8AM3/1wH8AM7/7AH8AM//1wH8ANH/1wH8ANP/1wH8ANX/1wH8ANf/1wH8ANn/1wH8ANv/1wH8AN3/1wH8AN7/7AH8AN//7AH8AOD/7AH8AOH/7AH8AOL/7AH8AOP/7AH8AOT/7AH8AOX/7AH8APr/7AH8AQb/7AH8AQj/7AH8AQ3/7AH8AQ7/7AH8AQ//1wH8ARD/7AH8ARH/1wH8ARL/7AH8ARP/1wH8ART/7AH8ARX/1wH8ARf/7AH8ARn/7AH8AR3/7AH8ASH/7AH8ASv/7AH8AS3/7AH8AS//7AH8ATH/7AH8ATP/7AH8ATX/7AH8AUP/rgH8AUT/1wH8AUb/1wH8AUf/7AH8AUj/1wH8AUr/7AH8Agj/mgH8Agz/mgH8Alf/7AH8Alj/rgH8Aln/1wH8Al//7AH8AmD/1wH8AmL/7AH8Ax3/rgH8Ax7/1wH8Ax//rgH8AyD/1wH8AyH/rgH8AyL/1wH8AyP/rgH8AyX/rgH8Ayb/1wH8Ayf/rgH8Ayj/1wH8Ayn/rgH8Ayr/1wH8Ayv/rgH8Ayz/1wH8Ay3/rgH8Ay7/1wH8Ay//rgH8AzD/1wH8AzH/rgH8AzL/1wH8AzP/rgH8AzT/1wH8Azb/1wH8Azj/1wH8Azr/1wH8Azz/1wH8A0D/1wH8A0L/1wH8A0T/1wH8A0n/7AH8A0r/1wH8A0v/7AH8A0z/1wH8A03/7AH8A07/1wH8A0//7AH8A1H/7AH8A1L/1wH8A1P/7AH8A1T/1wH8A1X/7AH8A1b/1wH8A1f/7AH8A1j/1wH8A1n/7AH8A1r/1wH8A1v/7AH8A1z/1wH8A13/7AH8A17/1wH8A1//7AH8A2D/1wH8A2L/7AH8A2T/7AH8A2b/7AH8A2j/7AH8A2r/7AH8A2z/7AH8A27/7AH9AAUAUgH9AAoAUgH9AA//rgH9ABH/rgH9ACIAKQH9AgcAUgH9Agj/rgH9AgsAUgH9Agz/rgH+AA//mgH+ABH/mgH+ACIAKQH+ACT/rgH+ACb/7AH+ACr/7AH+ADL/7AH+ADT/7AH+AET/1wH+AEb/1wH+AEf/1wH+AEj/1wH+AEr/7AH+AFD/7AH+AFH/7AH+AFL/1wH+AFP/7AH+AFT/1wH+AFX/7AH+AFb/7AH+AFj/7AH+AIL/rgH+AIP/rgH+AIT/rgH+AIX/rgH+AIb/rgH+AIf/rgH+AIn/7AH+AJT/7AH+AJX/7AH+AJb/7AH+AJf/7AH+AJj/7AH+AJr/7AH+AKL/1wH+AKP/1wH+AKT/1wH+AKX/1wH+AKb/1wH+AKf/1wH+AKj/1wH+AKn/1wH+AKr/1wH+AKv/1wH+AKz/1wH+AK3/1wH+ALT/1wH+ALX/1wH+ALb/1wH+ALf/1wH+ALj/1wH+ALr/1wH+ALv/7AH+ALz/7AH+AL3/7AH+AL7/7AH+AML/rgH+AMP/1wH+AMT/rgH+AMX/1wH+AMb/rgH+AMf/1wH+AMj/7AH+AMn/1wH+AMr/7AH+AMv/1wH+AMz/7AH+AM3/1wH+AM7/7AH+AM//1wH+ANH/1wH+ANP/1wH+ANX/1wH+ANf/1wH+ANn/1wH+ANv/1wH+AN3/1wH+AN7/7AH+AN//7AH+AOD/7AH+AOH/7AH+AOL/7AH+AOP/7AH+AOT/7AH+AOX/7AH+APr/7AH+AQb/7AH+AQj/7AH+AQ3/7AH+AQ7/7AH+AQ//1wH+ARD/7AH+ARH/1wH+ARL/7AH+ARP/1wH+ART/7AH+ARX/1wH+ARf/7AH+ARn/7AH+AR3/7AH+ASH/7AH+ASv/7AH+AS3/7AH+AS//7AH+ATH/7AH+ATP/7AH+ATX/7AH+AUP/rgH+AUT/1wH+AUb/1wH+AUf/7AH+AUj/1wH+AUr/7AH+Agj/mgH+Agz/mgH+Alf/7AH+Alj/rgH+Aln/1wH+Al//7AH+AmD/1wH+AmL/7AH+Ax3/rgH+Ax7/1wH+Ax//rgH+AyD/1wH+AyH/rgH+AyL/1wH+AyP/rgH+AyX/rgH+Ayb/1wH+Ayf/rgH+Ayj/1wH+Ayn/rgH+Ayr/1wH+Ayv/rgH+Ayz/1wH+Ay3/rgH+Ay7/1wH+Ay//rgH+AzD/1wH+AzH/rgH+AzL/1wH+AzP/rgH+AzT/1wH+Azb/1wH+Azj/1wH+Azr/1wH+Azz/1wH+A0D/1wH+A0L/1wH+A0T/1wH+A0n/7AH+A0r/1wH+A0v/7AH+A0z/1wH+A03/7AH+A07/1wH+A0//7AH+A1H/7AH+A1L/1wH+A1P/7AH+A1T/1wH+A1X/7AH+A1b/1wH+A1f/7AH+A1j/1wH+A1n/7AH+A1r/1wH+A1v/7AH+A1z/1wH+A13/7AH+A17/1wH+A1//7AH+A2D/1wH+A2L/7AH+A2T/7AH+A2b/7AH+A2j/7AH+A2r/7AH+A2z/7AH+A27/7AH/AAUAUgH/AAoAUgH/AA//rgH/ABH/rgH/ACIAKQH/AgcAUgH/Agj/rgH/AgsAUgH/Agz/rgIAAA//hQIAABH/hQIAACIAKQIAACT/hQIAACb/1wIAACr/1wIAADL/1wIAADT/1wIAAET/mgIAAEb/mgIAAEf/mgIAAEj/mgIAAEr/1wIAAFD/wwIAAFH/wwIAAFL/mgIAAFP/wwIAAFT/mgIAAFX/wwIAAFb/rgIAAFj/wwIAAF3/1wIAAIL/hQIAAIP/hQIAAIT/hQIAAIX/hQIAAIb/hQIAAIf/hQIAAIn/1wIAAJT/1wIAAJX/1wIAAJb/1wIAAJf/1wIAAJj/1wIAAJr/1wIAAKL/mgIAAKP/mgIAAKT/mgIAAKX/mgIAAKb/mgIAAKf/mgIAAKj/mgIAAKn/mgIAAKr/mgIAAKv/mgIAAKz/mgIAAK3/mgIAALT/mgIAALX/mgIAALb/mgIAALf/mgIAALj/mgIAALr/mgIAALv/wwIAALz/wwIAAL3/wwIAAL7/wwIAAML/hQIAAMP/mgIAAMT/hQIAAMX/mgIAAMb/hQIAAMf/mgIAAMj/1wIAAMn/mgIAAMr/1wIAAMv/mgIAAMz/1wIAAM3/mgIAAM7/1wIAAM//mgIAANH/mgIAANP/mgIAANX/mgIAANf/mgIAANn/mgIAANv/mgIAAN3/mgIAAN7/1wIAAN//1wIAAOD/1wIAAOH/1wIAAOL/1wIAAOP/1wIAAOT/1wIAAOX/1wIAAPr/wwIAAQb/wwIAAQj/wwIAAQ3/wwIAAQ7/1wIAAQ//mgIAARD/1wIAARH/mgIAARL/1wIAARP/mgIAART/1wIAARX/mgIAARf/wwIAARn/wwIAAR3/rgIAASH/rgIAASv/wwIAAS3/wwIAAS//wwIAATH/wwIAATP/wwIAATX/wwIAATz/1wIAAT7/1wIAAUD/1wIAAUP/hQIAAUT/mgIAAUb/mgIAAUf/1wIAAUj/mgIAAUr/rgIAAgj/hQIAAgz/hQIAAlf/wwIAAlj/hQIAAln/mgIAAl//1wIAAmD/mgIAAmL/wwIAAx3/hQIAAx7/mgIAAx//hQIAAyD/mgIAAyH/hQIAAyL/mgIAAyP/hQIAAyX/hQIAAyb/mgIAAyf/hQIAAyj/mgIAAyn/hQIAAyr/mgIAAyv/hQIAAyz/mgIAAy3/hQIAAy7/mgIAAy//hQIAAzD/mgIAAzH/hQIAAzL/mgIAAzP/hQIAAzT/mgIAAzb/mgIAAzj/mgIAAzr/mgIAAzz/mgIAA0D/mgIAA0L/mgIAA0T/mgIAA0n/1wIAA0r/mgIAA0v/1wIAA0z/mgIAA03/1wIAA07/mgIAA0//1wIAA1H/1wIAA1L/mgIAA1P/1wIAA1T/mgIAA1X/1wIAA1b/mgIAA1f/1wIAA1j/mgIAA1n/1wIAA1r/mgIAA1v/1wIAA1z/mgIAA13/1wIAA17/mgIAA1//1wIAA2D/mgIAA2L/wwIAA2T/wwIAA2b/wwIAA2j/wwIAA2r/wwIAA2z/wwIAA27/wwIBAAUAUgIBAAoAUgIBAA//rgIBABH/rgIBACIAKQIBAgcAUgIBAgj/rgIBAgsAUgIBAgz/rgICADf/rgICAST/rgICASb/rgICAXH/rgICAZ3/rgICAab/rgICAbz/rgICAcT/rgICAdz/1wICAeT/1wICAqn/rgICAqr/1wICArX/rgICArb/1wICAr3/rgICAr7/1wICAxf/rgICAxj/1wICA4//rgIDADf/rgIDAST/rgIDASb/rgIDAXH/rgIDAZ3/rgIDAab/rgIDAbz/rgIDAcT/rgIDAdz/1wIDAeT/1wIDAqn/rgIDAqr/1wIDArX/rgIDArb/1wIDAr3/rgIDAr7/1wIDAxf/rgIDAxj/1wIDA4//rgIEADf/rgIEAST/rgIEASb/rgIEAXH/rgIEAZ3/rgIEAab/rgIEAbz/rgIEAcT/rgIEAdz/1wIEAeT/1wIEAqn/rgIEAqr/1wIEArX/rgIEArb/1wIEAr3/rgIEAr7/1wIEAxf/rgIEAxj/1wIEA4//rgIGACT/cQIGADcAKQIGADkAKQIGADoAKQIGADwAFAIGAET/rgIGAEb/hQIGAEf/hQIGAEj/hQIGAEr/wwIGAFD/wwIGAFH/wwIGAFL/hQIGAFP/wwIGAFT/hQIGAFX/wwIGAFb/wwIGAFj/wwIGAIL/cQIGAIP/cQIGAIT/cQIGAIX/cQIGAIb/cQIGAIf/cQIGAJ8AFAIGAKL/hQIGAKP/rgIGAKT/rgIGAKX/rgIGAKb/rgIGAKf/rgIGAKj/rgIGAKn/hQIGAKr/hQIGAKv/hQIGAKz/hQIGAK3/hQIGALT/hQIGALX/hQIGALb/hQIGALf/hQIGALj/hQIGALr/hQIGALv/wwIGALz/wwIGAL3/wwIGAL7/wwIGAML/cQIGAMP/rgIGAMT/cQIGAMX/rgIGAMb/cQIGAMf/rgIGAMn/hQIGAMv/hQIGAM3/hQIGAM//hQIGANH/hQIGANP/hQIGANX/hQIGANf/hQIGANn/hQIGANv/hQIGAN3/hQIGAN//wwIGAOH/wwIGAOP/wwIGAOX/wwIGAPr/wwIGAQb/wwIGAQj/wwIGAQ3/wwIGAQ//hQIGARH/hQIGARP/hQIGARX/hQIGARf/wwIGARn/wwIGAR3/wwIGASH/wwIGASQAKQIGASYAKQIGASv/wwIGAS3/wwIGAS//wwIGATH/wwIGATP/wwIGATX/wwIGATYAKQIGATgAFAIGAToAFAIGAUP/cQIGAUT/rgIGAUb/rgIGAUj/hQIGAUr/wwIGAVb/cQIGAV//cQIGAWL/cQIGAWn/cQIGAXn/rgIGAXr/1wIGAXv/1wIGAX7/rgIGAYH/wwIGAYL/1wIGAYP/1wIGAYT/1wIGAYf/1wIGAYn/1wIGAYz/rgIGAY7/wwIGAY//rgIGAZD/rgIGAZP/rgIGAZn/rgIGAaT/hQIGAar/cQIGAa7/hQIGAbX/hQIGAcr/1wIGAc7/cQIGAc//hQIGAdX/cQIGAdj/hQIGAdv/hQIGAd7/hQIGAer/hQIGAe3/hQIGAe7/wwIGAfL/cQIGAfoAKQIGAfwAKQIGAf4AKQIGAgAAFAIGAlf/wwIGAlj/cQIGAln/rgIGAmD/hQIGAmL/wwIGAmr/hQIGAnL/cQIGAnP/cQIGAn3/7AIGAn//hQIGAoX/hQIGAof/hQIGAon/hQIGAo3/hQIGArL/hQIGArT/hQIGAs7/hQIGAs//cQIGAtn/cQIGAtr/1wIGAtv/cQIGAtz/1wIGAt3/cQIGAt7/1wIGAuD/hQIGAuL/1wIGAuT/1wIGAvD/hQIGAvL/hQIGAvT/hQIGAwn/cQIGAwr/hQIGAwv/cQIGAwz/hQIGAxH/hQIGAxL/cQIGAxb/hQIGAxr/hQIGAxv/hQIGAxz/cQIGAx3/cQIGAx7/rgIGAx//cQIGAyD/rgIGAyH/cQIGAyL/rgIGAyP/cQIGAyX/cQIGAyb/rgIGAyf/cQIGAyj/rgIGAyn/cQIGAyr/rgIGAyv/cQIGAyz/rgIGAy3/cQIGAy7/rgIGAy//cQIGAzD/rgIGAzH/cQIGAzL/rgIGAzP/cQIGAzT/rgIGAzb/hQIGAzj/hQIGAzr/hQIGAzz/hQIGA0D/hQIGA0L/hQIGA0T/hQIGA0r/hQIGA0z/hQIGA07/hQIGA1L/hQIGA1T/hQIGA1b/hQIGA1j/hQIGA1r/hQIGA1z/hQIGA17/hQIGA2D/hQIGA2L/wwIGA2T/wwIGA2b/wwIGA2j/wwIGA2r/wwIGA2z/wwIGA27/wwIGA28AFAIGA3EAFAIGA3MAFAIGA48AKQIHACT/cQIHADcAKQIHADkAKQIHADoAKQIHADwAFAIHAET/rgIHAEb/hQIHAEf/hQIHAEj/hQIHAEr/wwIHAFD/wwIHAFH/wwIHAFL/hQIHAFP/wwIHAFT/hQIHAFX/wwIHAFb/wwIHAFj/wwIHAIL/cQIHAIP/cQIHAIT/cQIHAIX/cQIHAIb/cQIHAIf/cQIHAJ8AFAIHAKL/hQIHAKP/rgIHAKT/rgIHAKX/rgIHAKb/rgIHAKf/rgIHAKj/rgIHAKn/hQIHAKr/hQIHAKv/hQIHAKz/hQIHAK3/hQIHALT/hQIHALX/hQIHALb/hQIHALf/hQIHALj/hQIHALr/hQIHALv/wwIHALz/wwIHAL3/wwIHAL7/wwIHAML/cQIHAMP/rgIHAMT/cQIHAMX/rgIHAMb/cQIHAMf/rgIHAMn/hQIHAMv/hQIHAM3/hQIHAM//hQIHANH/hQIHANP/hQIHANX/hQIHANf/hQIHANn/hQIHANv/hQIHAN3/hQIHAN//wwIHAOH/wwIHAOP/wwIHAOX/wwIHAPr/wwIHAQb/wwIHAQj/wwIHAQ3/wwIHAQ//hQIHARH/hQIHARP/hQIHARX/hQIHARf/wwIHARn/wwIHAR3/wwIHASH/wwIHASQAKQIHASYAKQIHASv/wwIHAS3/wwIHAS//wwIHATH/wwIHATP/wwIHATX/wwIHATYAKQIHATgAFAIHAToAFAIHAUP/cQIHAUT/rgIHAUb/rgIHAUj/hQIHAUr/wwIHAVb/cQIHAV//cQIHAWL/cQIHAWn/cQIHAXn/rgIHAXr/1wIHAXv/1wIHAX7/rgIHAYH/wwIHAYL/1wIHAYP/1wIHAYT/1wIHAYf/1wIHAYn/1wIHAYz/rgIHAY7/wwIHAY//rgIHAZD/rgIHAZP/rgIHAZn/rgIHAaT/hQIHAar/cQIHAa7/hQIHAbX/hQIHAcr/1wIHAc7/cQIHAc//hQIHAdX/cQIHAdj/hQIHAdv/hQIHAd7/hQIHAer/hQIHAe3/hQIHAe7/wwIHAfL/cQIHAfoAKQIHAfwAKQIHAf4AKQIHAgAAFAIHAlf/wwIHAlj/cQIHAln/rgIHAmD/hQIHAmL/wwIHAmr/hQIHAnL/cQIHAnP/cQIHAn3/7AIHAn//hQIHAoX/hQIHAof/hQIHAon/hQIHAo3/hQIHArL/hQIHArT/hQIHAs7/hQIHAs//cQIHAtn/cQIHAtr/1wIHAtv/cQIHAtz/1wIHAt3/cQIHAt7/1wIHAuD/hQIHAuL/1wIHAuT/1wIHAvD/hQIHAvL/hQIHAvT/hQIHAwn/cQIHAwr/hQIHAwv/cQIHAwz/hQIHAxH/hQIHAxL/cQIHAxb/hQIHAxr/hQIHAxv/hQIHAxz/cQIHAx3/cQIHAx7/rgIHAx//cQIHAyD/rgIHAyH/cQIHAyL/rgIHAyP/cQIHAyX/cQIHAyb/rgIHAyf/cQIHAyj/rgIHAyn/cQIHAyr/rgIHAyv/cQIHAyz/rgIHAy3/cQIHAy7/rgIHAy//cQIHAzD/rgIHAzH/cQIHAzL/rgIHAzP/cQIHAzT/rgIHAzb/hQIHAzj/hQIHAzr/hQIHAzz/hQIHA0D/hQIHA0L/hQIHA0T/hQIHA0r/hQIHA0z/hQIHA07/hQIHA1L/hQIHA1T/hQIHA1b/hQIHA1j/hQIHA1r/hQIHA1z/hQIHA17/hQIHA2D/hQIHA2L/wwIHA2T/wwIHA2b/wwIHA2j/wwIHA2r/wwIHA2z/wwIHA27/wwIHA28AFAIHA3EAFAIHA3MAFAIHA48AKQIIACb/mgIIACr/mgIIADL/mgIIADT/mgIIADf/cQIIADj/1wIIADn/hQIIADr/hQIIADz/hQIIAIn/mgIIAJT/mgIIAJX/mgIIAJb/mgIIAJf/mgIIAJj/mgIIAJr/mgIIAJv/1wIIAJz/1wIIAJ3/1wIIAJ7/1wIIAJ//hQIIAMj/mgIIAMr/mgIIAMz/mgIIAM7/mgIIAN7/mgIIAOD/mgIIAOL/mgIIAOT/mgIIAQ7/mgIIARD/mgIIARL/mgIIART/mgIIAST/cQIIASb/cQIIASr/1wIIASz/1wIIAS7/1wIIATD/1wIIATL/1wIIATT/1wIIATb/hQIIATj/hQIIATr/hQIIAUf/mgIIAWb/rgIIAW3/rgIIAXH/cQIIAXL/hQIIAXP/mgIIAXX/hQIIAXj/hQIIAYX/1wIIAZ3/cQIIAZ//mgIIAab/cQIIAbj/mgIIAbv/mgIIAbz/cQIIAb7/rgIIAcH/XAIIAcT/cQIIAdz/mgIIAeH/hQIIAeT/mgIIAfr/hQIIAfz/hQIIAf7/hQIIAgD/hQIIAlT/hQIIAl//mgIIAmH/1wIIAmz/mgIIAnz/XAIIAn7/mgIIAoD/hQIIAoL/hQIIAoT/mgIIAob/mgIIAoj/mgIIAor/mgIIAoz/mgIIAqn/cQIIAqr/mgIIArH/mgIIArP/mgIIArX/cQIIArb/mgIIArf/hQIIArn/hQIIAr3/cQIIAr7/mgIIAr//XAIIAsD/hQIIAsH/XAIIAsL/hQIIAsX/hQIIAsf/hQIIAtT/XAIIAtX/hQIIAu//mgIIAvH/mgIIAvP/mgIIAv3/XAIIAv7/hQIIAw3/hQIIAw7/mgIIAw//hQIIAxD/mgIIAxX/mgIIAxf/cQIIAxj/mgIIA0n/mgIIA0v/mgIIA03/mgIIA0//mgIIA1H/mgIIA1P/mgIIA1X/mgIIA1f/mgIIA1n/mgIIA1v/mgIIA13/mgIIA1//mgIIA2H/1wIIA2P/1wIIA2X/1wIIA2f/1wIIA2n/1wIIA2v/1wIIA23/1wIIA2//hQIIA3H/hQIIA3P/hQIIA4//cQIKACT/cQIKADcAKQIKADkAKQIKADoAKQIKADwAFAIKAET/rgIKAEb/hQIKAEf/hQIKAEj/hQIKAEr/wwIKAFD/wwIKAFH/wwIKAFL/hQIKAFP/wwIKAFT/hQIKAFX/wwIKAFb/wwIKAFj/wwIKAIL/cQIKAIP/cQIKAIT/cQIKAIX/cQIKAIb/cQIKAIf/cQIKAJ8AFAIKAKL/hQIKAKP/rgIKAKT/rgIKAKX/rgIKAKb/rgIKAKf/rgIKAKj/rgIKAKn/hQIKAKr/hQIKAKv/hQIKAKz/hQIKAK3/hQIKALT/hQIKALX/hQIKALb/hQIKALf/hQIKALj/hQIKALr/hQIKALv/wwIKALz/wwIKAL3/wwIKAL7/wwIKAML/cQIKAMP/rgIKAMT/cQIKAMX/rgIKAMb/cQIKAMf/rgIKAMn/hQIKAMv/hQIKAM3/hQIKAM//hQIKANH/hQIKANP/hQIKANX/hQIKANf/hQIKANn/hQIKANv/hQIKAN3/hQIKAN//wwIKAOH/wwIKAOP/wwIKAOX/wwIKAPr/wwIKAQb/wwIKAQj/wwIKAQ3/wwIKAQ//hQIKARH/hQIKARP/hQIKARX/hQIKARf/wwIKARn/wwIKAR3/wwIKASH/wwIKASQAKQIKASYAKQIKASv/wwIKAS3/wwIKAS//wwIKATH/wwIKATP/wwIKATX/wwIKATYAKQIKATgAFAIKAToAFAIKAUP/cQIKAUT/rgIKAUb/rgIKAUj/hQIKAUr/wwIKAVb/cQIKAV//cQIKAWL/cQIKAWn/cQIKAXn/rgIKAXr/1wIKAXv/1wIKAX7/rgIKAYH/wwIKAYL/1wIKAYP/1wIKAYT/1wIKAYf/1wIKAYn/1wIKAYz/rgIKAY7/wwIKAY//rgIKAZD/rgIKAZP/rgIKAZn/rgIKAaT/hQIKAar/cQIKAa7/hQIKAbX/hQIKAcr/1wIKAc7/cQIKAc//hQIKAdX/cQIKAdj/hQIKAdv/hQIKAd7/hQIKAer/hQIKAe3/hQIKAe7/wwIKAfL/cQIKAfoAKQIKAfwAKQIKAf4AKQIKAgAAFAIKAlf/wwIKAlj/cQIKAln/rgIKAmD/hQIKAmL/wwIKAmr/hQIKAnL/cQIKAnP/cQIKAn3/7AIKAn//hQIKAoX/hQIKAof/hQIKAon/hQIKAo3/hQIKArL/hQIKArT/hQIKAs7/hQIKAs//cQIKAtn/cQIKAtr/1wIKAtv/cQIKAtz/1wIKAt3/cQIKAt7/1wIKAuD/hQIKAuL/1wIKAuT/1wIKAvD/hQIKAvL/hQIKAvT/hQIKAwn/cQIKAwr/hQIKAwv/cQIKAwz/hQIKAxH/hQIKAxL/cQIKAxb/hQIKAxr/hQIKAxv/hQIKAxz/cQIKAx3/cQIKAx7/rgIKAx//cQIKAyD/rgIKAyH/cQIKAyL/rgIKAyP/cQIKAyX/cQIKAyb/rgIKAyf/cQIKAyj/rgIKAyn/cQIKAyr/rgIKAyv/cQIKAyz/rgIKAy3/cQIKAy7/rgIKAy//cQIKAzD/rgIKAzH/cQIKAzL/rgIKAzP/cQIKAzT/rgIKAzb/hQIKAzj/hQIKAzr/hQIKAzz/hQIKA0D/hQIKA0L/hQIKA0T/hQIKA0r/hQIKA0z/hQIKA07/hQIKA1L/hQIKA1T/hQIKA1b/hQIKA1j/hQIKA1r/hQIKA1z/hQIKA17/hQIKA2D/hQIKA2L/wwIKA2T/wwIKA2b/wwIKA2j/wwIKA2r/wwIKA2z/wwIKA27/wwIKA28AFAIKA3EAFAIKA3MAFAIKA48AKQIMACb/mgIMACr/mgIMADL/mgIMADT/mgIMADf/cQIMADj/1wIMADn/hQIMADr/hQIMADz/hQIMAIn/mgIMAJT/mgIMAJX/mgIMAJb/mgIMAJf/mgIMAJj/mgIMAJr/mgIMAJv/1wIMAJz/1wIMAJ3/1wIMAJ7/1wIMAJ//hQIMAMj/mgIMAMr/mgIMAMz/mgIMAM7/mgIMAN7/mgIMAOD/mgIMAOL/mgIMAOT/mgIMAQ7/mgIMARD/mgIMARL/mgIMART/mgIMAST/cQIMASb/cQIMASr/1wIMASz/1wIMAS7/1wIMATD/1wIMATL/1wIMATT/1wIMATb/hQIMATj/hQIMATr/hQIMAUf/mgIMAWb/rgIMAW3/rgIMAXH/cQIMAXL/hQIMAXP/mgIMAXX/hQIMAXj/hQIMAYX/1wIMAZ3/cQIMAZ//mgIMAab/cQIMAbj/mgIMAbv/mgIMAbz/cQIMAb7/rgIMAcH/XAIMAcT/cQIMAdz/mgIMAeH/hQIMAeT/mgIMAfr/hQIMAfz/hQIMAf7/hQIMAgD/hQIMAlT/hQIMAl//mgIMAmH/1wIMAmz/mgIMAnz/XAIMAn7/mgIMAoD/hQIMAoL/hQIMAoT/mgIMAob/mgIMAoj/mgIMAor/mgIMAoz/mgIMAqn/cQIMAqr/mgIMArH/mgIMArP/mgIMArX/cQIMArb/mgIMArf/hQIMArn/hQIMAr3/cQIMAr7/mgIMAr//XAIMAsD/hQIMAsH/XAIMAsL/hQIMAsX/hQIMAsf/hQIMAtT/XAIMAtX/hQIMAu//mgIMAvH/mgIMAvP/mgIMAv3/XAIMAv7/hQIMAw3/hQIMAw7/mgIMAw//hQIMAxD/mgIMAxX/mgIMAxf/cQIMAxj/mgIMA0n/mgIMA0v/mgIMA03/mgIMA0//mgIMA1H/mgIMA1P/mgIMA1X/mgIMA1f/mgIMA1n/mgIMA1v/mgIMA13/mgIMA1//mgIMA2H/1wIMA2P/1wIMA2X/1wIMA2f/1wIMA2n/1wIMA2v/1wIMA23/1wIMA2//hQIMA3H/hQIMA3P/hQIMA4//cQIhAXH/1wIhAXL/7AIhAXj/7AIhAlT/7AJTAA//wwJTABH/wwJTAgj/wwJTAgz/wwJUAA//hQJUABH/hQJUAVb/hQJUAV//hQJUAWL/hQJUAWb/1wJUAWn/hQJUAW3/1wJUAXP/wwJUAXb/7AJUAXn/mgJUAXr/rgJUAXv/wwJUAXz/wwJUAX3/wwJUAX7/mgJUAYH/wwJUAYL/rgJUAYT/wwJUAYb/wwJUAYf/wwJUAYn/wwJUAYz/mgJUAY7/mgJUAY//mgJUAZD/mgJUAZL/wwJUAZP/mgJUAZX/wwJUAZb/wwJUAZj/wwJUAZn/mgJUAZr/wwJUAZv/wwJUAgj/hQJUAgz/hQJUAiH/7AJYAAX/cQJYAAr/cQJYACb/1wJYACr/1wJYAC0BCgJYADL/1wJYADT/1wJYADf/cQJYADn/rgJYADr/rgJYADz/hQJYAIn/1wJYAJT/1wJYAJX/1wJYAJb/1wJYAJf/1wJYAJj/1wJYAJr/1wJYAJ//hQJYAMj/1wJYAMr/1wJYAMz/1wJYAM7/1wJYAN7/1wJYAOD/1wJYAOL/1wJYAOT/1wJYAQ7/1wJYARD/1wJYARL/1wJYART/1wJYAST/cQJYASb/cQJYATb/rgJYATj/hQJYATr/hQJYAUf/1wJYAfr/rgJYAfz/rgJYAf7/rgJYAgD/hQJYAgf/cQJYAgv/cQJYAl//1wJYA0n/1wJYA0v/1wJYA03/1wJYA0//1wJYA1H/1wJYA1P/1wJYA1X/1wJYA1f/1wJYA1n/1wJYA1v/1wJYA13/1wJYA1//1wJYA2//hQJYA3H/hQJYA3P/hQJYA4//cQJZAAX/7AJZAAr/7AJZAgf/7AJZAgv/7AJaAA//rgJaABH/rgJaAVb/1wJaAV//1wJaAWL/1wJaAWT/7AJaAWn/1wJaAXD/7AJaAXH/wwJaAXL/7AJaAXT/1wJaAXX/7AJaAXj/7AJaAYj/7AJaAgj/rgJaAgz/rgJaAlT/7AJgAEkAUgJgAFcAUgJgAFkAZgJgAFoAZgJgAFsAZgJgAFwAZgJgAL8AZgJgASUAUgJgAScAUgJgATcAZgJgAfsAZgJgAf0AZgJgAjQAUgJgAjUAUgJgAl0AUgJgAl4AUgJgA3AAZgJgA40AUgJgA5AAUgJiAEkAZgJiAFcAZgJiAFkAZgJiAFoAZgJiAFsAZgJiAFwAZgJiAL8AZgJiASUAZgJiAScAZgJiATcAZgJiAfsAZgJiAf0AZgJiAjQAZgJiAjUAZgJiAl0AZgJiAl4AZgJiA3AAZgJiA40AZgJiA5AAZgJqAAX/7AJqAAr/7AJqAgf/7AJqAgv/7AJsAA//rgJsABH/rgJsAZ3/7AJsAaT/1wJsAab/7AJsAaj/1wJsAar/1wJsAa7/1wJsAbD/1wJsAbH/7AJsAbX/1wJsAbz/wwJsAb3/1wJsAb//1wJsAcH/1wJsAcT/7AJsAcf/7AJsAc7/7AJsAdX/7AJsAfL/7AJsAgj/rgJsAgz/rgJsAnL/1wJsAnP/7AJsAnr/7AJsAnz/1wJsAoD/7AJsAoL/7AJsAp//1wJsAqH/7AJsAqn/7AJsArX/wwJsArf/7AJsArn/7AJsArv/1wJsAr3/7AJsAr//1wJsAsH/1wJsAsr/1wJsAs7/1wJsAs//7AJsAtT/1wJsAtn/1wJsAtv/1wJsAt3/1wJsAuX/1wJsAuf/7AJsAvX/7AJsAvf/1wJsAvn/1wJsAvv/1wJsAv3/1wJsAwX/1wJsAwf/1wJsAw3/1wJsAw//1wJsAxH/1wJsAxL/7AJsAxf/7AJsAxv/1wJsAxz/7AJtAA//rgJtABH/rgJtAc7/1wJtAdX/1wJtAfL/1wJtAgj/rgJtAgz/rgJtAnP/1wJtAs//1wJtAxL/1wJtAxz/1wJuAAX/rgJuAAr/rgJuAZ3/1wJuAab/1wJuAbz/rgJuAcH/rgJuAcT/1wJuAdz/1wJuAeT/1wJuAgf/rgJuAgv/rgJuAnz/rgJuAoD/wwJuAoL/wwJuAqn/1wJuAqr/1wJuArX/rgJuArb/1wJuArf/wwJuArn/wwJuAr3/1wJuAr7/1wJuAr//rgJuAsH/rgJuAtT/rgJuAv3/rgJuAw3/mgJuAw//mgJuAxf/1wJuAxj/1wJvAAX/hQJvAAr/hQJvAdD/1wJvAdz/mgJvAd3/wwJvAd//1wJvAeH/rgJvAeT/mgJvAfb/wwJvAgf/hQJvAgv/hQJvAm3/1wJvAoH/1wJvAoP/1wJvAov/1wJvAqD/1wJvAqr/mgJvArb/mgJvArj/wwJvArr/wwJvArz/1wJvAr7/mgJvAsD/rgJvAsL/rgJvAsb/1wJvAsj/1wJvAsv/1wJvAtX/rgJvAub/1wJvAur/1wJvAvj/wwJvAvr/wwJvAvz/wwJvAv7/rgJvAwb/1wJvAwj/1wJvAw7/mgJvAxD/mgJvAxj/mgJwAZ//1wJwAbj/1wJwAbv/1wJwAb7/1wJwAeH/1wJwAmz/1wJwAn7/1wJwAoT/1wJwAob/1wJwAoj/1wJwAor/1wJwAoz/1wJwArH/1wJwArP/1wJwAsD/1wJwAsL/1wJwAsX/1wJwAsf/1wJwAtX/1wJwAu//1wJwAvH/1wJwAvP/1wJwAv7/1wJwAwn/1wJwAwv/1wJwAw7/1wJwAxD/1wJwAxX/1wJyAAX/cQJyAAr/cQJyAZ3/mgJyAab/mgJyAbz/cQJyAb7/1wJyAcH/mgJyAcT/mgJyAdz/1wJyAeH/1wJyAeT/1wJyAgf/cQJyAgv/cQJyAm7/1wJyAnz/mgJyAoD/rgJyAoL/rgJyApf/1wJyApv/1wJyAqf/1wJyAqn/mgJyAqr/1wJyArX/cQJyArb/1wJyArf/hQJyArn/hQJyAr3/mgJyAr7/1wJyAr//mgJyAsD/1wJyAsH/mgJyAsL/1wJyAsX/mgJyAsf/mgJyAtT/mgJyAtX/1wJyAuH/1wJyAuP/1wJyAv3/mgJyAv7/1wJyAwP/1wJyAw3/cQJyAw7/1wJyAw//cQJyAxD/1wJyAxf/mgJyAxj/1wJzAAX/cQJzAAr/cQJzAc//1wJzAdj/1wJzAdv/1wJzAdz/mgJzAd3/wwJzAd7/1wJzAeH/wwJzAeT/mgJzAer/1wJzAe3/1wJzAfb/wwJzAgf/cQJzAgv/cQJzAmr/1wJzAm3/1wJzAn3/7AJzAn//1wJzAoH/1wJzAoP/1wJzAoX/1wJzAof/1wJzAon/1wJzAov/1wJzAo3/1wJzAqr/mgJzArL/1wJzArT/1wJzArb/mgJzArj/1wJzArr/1wJzAr7/mgJzAsD/wwJzAsL/wwJzAsb/1wJzAsj/1wJzAtX/wwJzAuD/1wJzAvD/1wJzAvL/1wJzAvT/1wJzAvj/wwJzAvr/wwJzAvz/wwJzAv7/wwJzAwr/1wJzAwz/1wJzAw7/hQJzAxD/hQJzAxb/1wJzAxj/mgJzAxr/1wJ0AAX/cQJ0AAr/cQJ0AZ3/mgJ0Aab/mgJ0Abz/cQJ0Ab7/1wJ0AcH/mgJ0AcT/mgJ0Adz/1wJ0AeH/1wJ0AeT/1wJ0Agf/cQJ0Agv/cQJ0Am7/1wJ0Anz/mgJ0AoD/rgJ0AoL/rgJ0Apf/1wJ0Apv/1wJ0Aqf/1wJ0Aqn/mgJ0Aqr/1wJ0ArX/cQJ0Arb/1wJ0Arf/hQJ0Arn/hQJ0Ar3/mgJ0Ar7/1wJ0Ar//mgJ0AsD/1wJ0AsH/mgJ0AsL/1wJ0AsX/mgJ0Asf/mgJ0AtT/mgJ0AtX/1wJ0AuH/1wJ0AuP/1wJ0Av3/mgJ0Av7/1wJ0AwP/1wJ0Aw3/cQJ0Aw7/1wJ0Aw//cQJ0AxD/1wJ0Axf/mgJ0Axj/1wJ1AAX/cQJ1AAr/cQJ1Ac//1wJ1Adj/1wJ1Adv/1wJ1Adz/mgJ1Ad3/wwJ1Ad7/1wJ1AeH/wwJ1AeT/mgJ1Aer/1wJ1Ae3/1wJ1Afb/wwJ1Agf/cQJ1Agv/cQJ1Amr/1wJ1Am3/1wJ1An3/7AJ1An//1wJ1AoH/1wJ1AoP/1wJ1AoX/1wJ1Aof/1wJ1Aon/1wJ1Aov/1wJ1Ao3/1wJ1Aqr/mgJ1ArL/1wJ1ArT/1wJ1Arb/mgJ1Arj/1wJ1Arr/1wJ1Ar7/mgJ1AsD/wwJ1AsL/wwJ1Asb/1wJ1Asj/1wJ1AtX/wwJ1AuD/1wJ1AvD/1wJ1AvL/1wJ1AvT/1wJ1Avj/wwJ1Avr/wwJ1Avz/wwJ1Av7/wwJ1Awr/1wJ1Awz/1wJ1Aw7/hQJ1AxD/hQJ1Axb/1wJ1Axj/mgJ1Axr/1wJ2Aw3/7AJ2Aw//7AJ4Aw3/7AJ4Aw//7AJ6AA//rgJ6ABH/rgJ6Agj/rgJ6Agz/rgJ6AoD/7AJ6AoL/7AJ6Arf/7AJ6Arn/7AJ6Aw3/1wJ6Aw//1wJ8AA//cQJ8ABH/cQJ8AaT/wwJ8Aar/rgJ8Aa7/wwJ8AbX/wwJ8Ac7/1wJ8AdX/1wJ8AfL/1wJ8Agj/cQJ8Agz/cQJ8AnL/rgJ8AnP/1wJ8As7/wwJ8As//1wJ8Atn/rgJ8Atv/rgJ8At3/rgJ8Awn/rgJ8Awv/rgJ8AxH/wwJ8AxL/1wJ8Axv/wwJ8Axz/1wJ9AAX/7AJ9AAr/7AJ9AdD/1wJ9Adz/7AJ9Ad3/7AJ9Ad//1wJ9AeH/7AJ9AeT/7AJ9Afb/7AJ9Agf/7AJ9Agv/7AJ9AqD/1wJ9Aqr/7AJ9Arb/7AJ9Arz/1wJ9Ar7/7AJ9AsD/7AJ9AsL/7AJ9Asv/1wJ9AtX/7AJ9Aub/1wJ9Avj/7AJ9Avr/7AJ9Avz/7AJ9Av7/7AJ9Awb/1wJ9Awj/1wJ9Aw7/7AJ9AxD/7AJ9Axj/7AJ+AA//rgJ+ABH/rgJ+AZ3/7AJ+AaT/1wJ+Aab/7AJ+Aaj/1wJ+Aar/1wJ+Aa7/1wJ+AbD/1wJ+AbH/7AJ+AbX/1wJ+Abz/wwJ+Ab3/1wJ+Ab//1wJ+AcH/1wJ+AcT/7AJ+Acf/7AJ+Ac7/7AJ+AdX/7AJ+AfL/7AJ+Agj/rgJ+Agz/rgJ+AnL/1wJ+AnP/7AJ+Anr/7AJ+Anz/1wJ+AoD/7AJ+AoL/7AJ+Ap//1wJ+AqH/7AJ+Aqn/7AJ+ArX/wwJ+Arf/7AJ+Arn/7AJ+Arv/1wJ+Ar3/7AJ+Ar//1wJ+AsH/1wJ+Asr/1wJ+As7/1wJ+As//7AJ+AtT/1wJ+Atn/1wJ+Atv/1wJ+At3/1wJ+AuX/1wJ+Auf/7AJ+AvX/7AJ+Avf/1wJ+Avn/1wJ+Avv/1wJ+Av3/1wJ+AwX/1wJ+Awf/1wJ+Aw3/1wJ+Aw//1wJ+AxH/1wJ+AxL/7AJ+Axf/7AJ+Axv/1wJ+Axz/7AJ/AAX/7AJ/AAr/7AJ/AdD/1wJ/Adz/7AJ/Ad3/7AJ/Ad//1wJ/AeH/7AJ/AeT/7AJ/Afb/7AJ/Agf/7AJ/Agv/7AJ/AqD/1wJ/Aqr/7AJ/Arb/7AJ/Arz/1wJ/Ar7/7AJ/AsD/7AJ/AsL/7AJ/Asv/1wJ/AtX/7AJ/Aub/1wJ/Avj/7AJ/Avr/7AJ/Avz/7AJ/Av7/7AJ/Awb/1wJ/Awj/1wJ/Aw7/7AJ/AxD/7AJ/Axj/7AKAAA//hQKAABH/hQKAAZ//7AKAAaT/mgKAAar/cQKAAa7/mgKAAbX/mgKAAbj/7AKAAbv/7AKAAb7/wwKAAcn/7AKAAc7/rgKAAc//1wKAAdX/rgKAAdj/1wKAAdv/1wKAAd7/1wKAAeH/1wKAAer/1wKAAesAZgKAAe3/1wKAAe7/7AKAAfL/rgKAAfQAZgKAAgj/hQKAAgz/hQKAAmr/1wKAAmz/7AKAAnL/cQKAAnP/rgKAAn7/7AKAAn//1wKAAoT/7AKAAoX/1wKAAob/7AKAAof/1wKAAoj/7AKAAon/1wKAAor/7AKAAoz/7AKAAo3/1wKAApgAZgKAAqgAZgKAArH/7AKAArL/1wKAArP/7AKAArT/1wKAAsD/1wKAAsL/1wKAAsX/1wKAAsb/wwKAAsf/1wKAAsj/wwKAAs7/mgKAAs//rgKAAtX/1wKAAtn/cQKAAtv/cQKAAt3/cQKAAuD/1wKAAu//7AKAAvD/1wKAAvH/7AKAAvL/1wKAAvP/7AKAAvT/1wKAAv7/1wKAAwn/cQKAAwr/1wKAAwv/cQKAAwz/1wKAAxH/mgKAAxL/rgKAAxX/7AKAAxb/1wKAAxr/1wKAAxv/mgKAAxz/rgKBAA//rgKBABH/rgKBAc7/1wKBAdX/1wKBAfL/1wKBAgj/rgKBAgz/rgKBAnP/1wKBAs//1wKBAxL/1wKBAxz/1wKCAA//hQKCABH/hQKCAZ//7AKCAaT/mgKCAar/cQKCAa7/mgKCAbX/mgKCAbj/7AKCAbv/7AKCAb7/wwKCAcn/7AKCAc7/rgKCAc//1wKCAdX/rgKCAdj/1wKCAdv/1wKCAd7/1wKCAeH/1wKCAer/1wKCAesAZgKCAe3/1wKCAe7/7AKCAfL/rgKCAfQAZgKCAgj/hQKCAgz/hQKCAmr/1wKCAmz/7AKCAnL/cQKCAnP/rgKCAn7/7AKCAn//1wKCAoT/7AKCAoX/1wKCAob/7AKCAof/1wKCAoj/7AKCAon/1wKCAor/7AKCAoz/7AKCAo3/1wKCApgAZgKCAqgAZgKCArH/7AKCArL/1wKCArP/7AKCArT/1wKCAsD/1wKCAsL/1wKCAsX/1wKCAsb/wwKCAsf/1wKCAsj/wwKCAs7/mgKCAs//rgKCAtX/1wKCAtn/cQKCAtv/cQKCAt3/cQKCAuD/1wKCAu//7AKCAvD/1wKCAvH/7AKCAvL/1wKCAvP/7AKCAvT/1wKCAv7/1wKCAwn/cQKCAwr/1wKCAwv/cQKCAwz/1wKCAxH/mgKCAxL/rgKCAxX/7AKCAxb/1wKCAxr/1wKCAxv/mgKCAxz/rgKDAA//rgKDABH/rgKDAc7/1wKDAdX/1wKDAfL/1wKDAgj/rgKDAgz/rgKDAnP/1wKDAs//1wKDAxL/1wKDAxz/1wKEAA//rgKEABH/rgKEAc7/1wKEAdX/1wKEAfL/1wKEAgj/rgKEAgz/rgKEAnP/1wKEAs//1wKEAxL/1wKEAxz/1wKFAA//rgKFABH/rgKFAc7/1wKFAdX/1wKFAfL/1wKFAgj/rgKFAgz/rgKFAnP/1wKFAs//1wKFAxL/1wKFAxz/1wKGAA//rgKGABH/rgKGAZ3/7AKGAaT/1wKGAab/7AKGAaj/1wKGAar/1wKGAa7/1wKGAbD/1wKGAbH/7AKGAbX/1wKGAbz/wwKGAb3/1wKGAb//1wKGAcH/1wKGAcT/7AKGAcf/7AKGAc7/7AKGAdX/7AKGAfL/7AKGAgj/rgKGAgz/rgKGAnL/1wKGAnP/7AKGAnr/7AKGAnz/1wKGAoD/7AKGAoL/7AKGAp//1wKGAqH/7AKGAqn/7AKGArX/wwKGArf/7AKGArn/7AKGArv/1wKGAr3/7AKGAr//1wKGAsH/1wKGAsr/1wKGAs7/1wKGAs//7AKGAtT/1wKGAtn/1wKGAtv/1wKGAt3/1wKGAuX/1wKGAuf/7AKGAvX/7AKGAvf/1wKGAvn/1wKGAvv/1wKGAv3/1wKGAwX/1wKGAwf/1wKGAw3/1wKGAw//1wKGAxH/1wKGAxL/7AKGAxf/7AKGAxv/1wKGAxz/7AKHAAX/7AKHAAr/7AKHAdD/1wKHAdz/7AKHAd3/7AKHAd//1wKHAeH/7AKHAeT/7AKHAfb/7AKHAgf/7AKHAgv/7AKHAqD/1wKHAqr/7AKHArb/7AKHArz/1wKHAr7/7AKHAsD/7AKHAsL/7AKHAsv/1wKHAtX/7AKHAub/1wKHAvj/7AKHAvr/7AKHAvz/7AKHAv7/7AKHAwb/1wKHAwj/1wKHAw7/7AKHAxD/7AKHAxj/7AKIAA//rgKIABH/rgKIAZ3/7AKIAaT/1wKIAab/7AKIAaj/1wKIAar/1wKIAa7/1wKIAbD/1wKIAbH/7AKIAbX/1wKIAbz/wwKIAb3/1wKIAb//1wKIAcH/1wKIAcT/7AKIAcf/7AKIAc7/7AKIAdX/7AKIAfL/7AKIAgj/rgKIAgz/rgKIAnL/1wKIAnP/7AKIAnr/7AKIAnz/1wKIAoD/7AKIAoL/7AKIAp//1wKIAqH/7AKIAqn/7AKIArX/wwKIArf/7AKIArn/7AKIArv/1wKIAr3/7AKIAr//1wKIAsH/1wKIAsr/1wKIAs7/1wKIAs//7AKIAtT/1wKIAtn/1wKIAtv/1wKIAt3/1wKIAuX/1wKIAuf/7AKIAvX/7AKIAvf/1wKIAvn/1wKIAvv/1wKIAv3/1wKIAwX/1wKIAwf/1wKIAw3/1wKIAw//1wKIAxH/1wKIAxL/7AKIAxf/7AKIAxv/1wKIAxz/7AKJAAX/7AKJAAr/7AKJAdD/1wKJAdz/7AKJAd3/7AKJAd//1wKJAeH/7AKJAeT/7AKJAfb/7AKJAgf/7AKJAgv/7AKJAqD/1wKJAqr/7AKJArb/7AKJArz/1wKJAr7/7AKJAsD/7AKJAsL/7AKJAsv/1wKJAtX/7AKJAub/1wKJAvj/7AKJAvr/7AKJAvz/7AKJAv7/7AKJAwb/1wKJAwj/1wKJAw7/7AKJAxD/7AKJAxj/7AKKAA//rgKKABH/rgKKAZ3/7AKKAaT/1wKKAab/7AKKAaj/1wKKAar/1wKKAa7/1wKKAbD/1wKKAbH/7AKKAbX/1wKKAbz/wwKKAb3/1wKKAb//1wKKAcH/1wKKAcT/7AKKAcf/7AKKAc7/7AKKAdX/7AKKAfL/7AKKAgj/rgKKAgz/rgKKAnL/1wKKAnP/7AKKAnr/7AKKAnz/1wKKAoD/7AKKAoL/7AKKAp//1wKKAqH/7AKKAqn/7AKKArX/wwKKArf/7AKKArn/7AKKArv/1wKKAr3/7AKKAr//1wKKAsH/1wKKAsr/1wKKAs7/1wKKAs//7AKKAtT/1wKKAtn/1wKKAtv/1wKKAt3/1wKKAuX/1wKKAuf/7AKKAvX/7AKKAvf/1wKKAvn/1wKKAvv/1wKKAv3/1wKKAwX/1wKKAwf/1wKKAw3/1wKKAw//1wKKAxH/1wKKAxL/7AKKAxf/7AKKAxv/1wKKAxz/7AKLAA//rgKLABH/rgKLAc7/1wKLAdX/1wKLAfL/1wKLAgj/rgKLAgz/rgKLAnP/1wKLAs//1wKLAxL/1wKLAxz/1wKMAZ//1wKMAbj/1wKMAbv/1wKMAb7/1wKMAeH/1wKMAmz/1wKMAn7/1wKMAoT/1wKMAob/1wKMAoj/1wKMAor/1wKMAoz/1wKMArH/1wKMArP/1wKMAsD/1wKMAsL/1wKMAsX/1wKMAsf/1wKMAtX/1wKMAu//1wKMAvH/1wKMAvP/1wKMAv7/1wKMAwn/1wKMAwv/1wKMAw7/1wKMAxD/1wKMAxX/1wKVAaMA4QKVAuoAKQKVAw7/1wKVAxD/1wKWAAX/7AKWAAr/7AKWAgf/7AKWAgv/7AKXAAX/rgKXAAr/rgKXAZ3/1wKXAab/1wKXAbz/rgKXAcH/rgKXAcT/1wKXAdz/1wKXAeT/1wKXAgf/rgKXAgv/rgKXAnz/rgKXAoD/wwKXAoL/wwKXAqn/1wKXAqr/1wKXArX/rgKXArb/1wKXArf/wwKXArn/wwKXAr3/1wKXAr7/1wKXAr//rgKXAsH/rgKXAtT/rgKXAv3/rgKXAw3/mgKXAw//mgKXAxf/1wKXAxj/1wKYAAX/hQKYAAr/hQKYAdD/1wKYAdz/mgKYAd3/wwKYAd//1wKYAeH/rgKYAeT/mgKYAfb/wwKYAgf/hQKYAgv/hQKYAm3/1wKYAoH/1wKYAoP/1wKYAov/1wKYAqD/1wKYAqr/mgKYArb/mgKYArj/wwKYArr/wwKYArz/1wKYAr7/mgKYAsD/rgKYAsL/rgKYAsb/1wKYAsj/1wKYAsv/1wKYAtX/rgKYAub/1wKYAur/1wKYAvj/wwKYAvr/wwKYAvz/wwKYAv7/rgKYAwb/1wKYAwj/1wKYAw7/mgKYAxD/mgKYAxj/mgKZAA/+9gKZABH+9gKZAaT/hQKZAar/mgKZAa7/hQKZAbD/1wKZAbX/hQKZAb//1wKZAc7/mgKZAdX/mgKZAfL/mgKZAgj+9gKZAgz+9gKZAnL/mgKZAnP/mgKZAnb/7AKZAp//1wKZArv/1wKZAsr/1wKZAs7/hQKZAs//mgKZAtn/mgKZAtv/mgKZAt3/mgKZAuX/1wKZAwX/1wKZAwf/1wKZAwn/rgKZAwv/rgKZAxH/hQKZAxL/mgKZAxv/hQKZAxz/mgKaAAX/7AKaAAr/7AKaAdD/1wKaAdz/7AKaAd3/7AKaAd//1wKaAeH/7AKaAeT/7AKaAfb/7AKaAgf/7AKaAgv/7AKaAqD/1wKaAqr/7AKaArb/7AKaArz/1wKaAr7/7AKaAsD/7AKaAsL/7AKaAsv/1wKaAtX/7AKaAub/1wKaAvj/7AKaAvr/7AKaAvz/7AKaAv7/7AKaAwb/1wKaAwj/1wKaAw7/7AKaAxD/7AKaAxj/7AKbAA//mgKbABD/1wKbABH/mgKbAZ0AKQKbAZ//1wKbAaT/rgKbAaYAKQKbAar/hQKbAa7/rgKbAbX/rgKbAbj/1wKbAbv/1wKbAbwAKQKbAb7/wwKbAcQAKQKbAcz/wwKbAc3/wwKbAc7/mgKbAc//rgKbAdD/1wKbAdH/1wKbAdL/wwKbAdP/wwKbAdT/wwKbAdX/mgKbAdb/wwKbAdf/wwKbAdj/rgKbAdn/wwKbAdr/wwKbAdv/rgKbAd7/rgKbAd//1wKbAeD/wwKbAeH/mgKbAeL/wwKbAeP/wwKbAeX/wwKbAeb/wwKbAef/1wKbAej/wwKbAer/rgKbAesAKQKbAez/wwKbAe3/rgKbAe7/wwKbAfL/mgKbAfP/wwKbAfQAKQKbAfX/wwKbAff/wwKbAfn/wwKbAgL/1wKbAgP/1wKbAgT/1wKbAgj/mgKbAgz/mgKbAmr/rgKbAmv/wwKbAmz/1wKbAnH/wwKbAnL/hQKbAnP/mgKbAnX/wwKbAnf/1wKbAnn/wwKbAn3/wwKbAn7/1wKbAn//rgKbAoT/1wKbAoX/rgKbAob/1wKbAof/rgKbAoj/1wKbAon/rgKbAor/1wKbAoz/1wKbAo3/rgKbApb/wwKbApgAKQKbApr/wwKbAp7/wwKbAqD/1wKbAqL/1wKbAqT/wwKbAqb/wwKbAqgAKQKbAqkAKQKbAqz/wwKbAq7/wwKbArD/wwKbArH/1wKbArL/rgKbArP/1wKbArT/rgKbArUAKQKbArz/1wKbAr0AKQKbAsD/mgKbAsL/mgKbAsT/wwKbAsX/1wKbAsb/wwKbAsf/1wKbAsj/wwKbAsv/1wKbAs3/wwKbAs7/rgKbAs//mgKbAtH/wwKbAtP/wwKbAtX/mgKbAtf/wwKbAtn/hQKbAtv/hQKbAt3/hQKbAuD/rgKbAub/1wKbAuj/1wKbAuz/wwKbAu7/wwKbAu//1wKbAvD/rgKbAvH/1wKbAvL/rgKbAvP/1wKbAvT/rgKbAvb/1wKbAv7/mgKbAwD/wwKbAwL/wwKbAwb/1wKbAwj/1wKbAwn/mgKbAwr/rgKbAwv/mgKbAwz/rgKbAw7/1wKbAxD/1wKbAxH/rgKbAxL/mgKbAxT/wwKbAxX/1wKbAxb/rgKbAxcAKQKbAxr/rgKbAxv/rgKbAxz/mgKcAA//wwKcABH/wwKcAc7/wwKcAc//1wKcAdX/wwKcAdj/1wKcAdv/1wKcAd7/1wKcAer/1wKcAe3/1wKcAfL/wwKcAgj/wwKcAgz/wwKcAmr/1wKcAnP/wwKcAn//1wKcAoX/1wKcAof/1wKcAon/1wKcAo3/1wKcArL/1wKcArT/1wKcAs//wwKcAuD/1wKcAvD/1wKcAvL/1wKcAvT/1wKcAwr/1wKcAwz/1wKcAxL/wwKcAxb/1wKcAxr/1wKcAxz/wwKdAAX/wwKdAAr/wwKdAZ3/wwKdAaMAZgKdAab/wwKdAbz/wwKdAcH/rgKdAcT/wwKdAdz/1wKdAeH/1wKdAeT/1wKdAgf/wwKdAgv/wwKdAnz/rgKdAoD/wwKdAoL/wwKdAqn/wwKdAqr/1wKdArX/wwKdArb/1wKdArf/1wKdArn/1wKdAr3/wwKdAr7/1wKdAr//rgKdAsD/1wKdAsH/rgKdAsL/1wKdAtT/rgKdAtX/1wKdAv3/rgKdAv7/1wKdAw3/1wKdAw7/wwKdAw//1wKdAxD/wwKdAxf/wwKdAxj/1wKeAAX/wwKeAAr/wwKeAgf/wwKeAgv/wwKeAw7/1wKeAxD/1wKfAZ//1wKfAaMA4QKfAbj/1wKfAbv/1wKfAb7/wwKfAdz/1wKfAeH/rgKfAeT/1wKfAmz/1wKfAnsAPQKfAn3/7AKfAn7/1wKfAoT/1wKfAob/1wKfAoj/1wKfAor/1wKfAoz/1wKfAqr/1wKfArH/1wKfArP/1wKfArb/1wKfAr7/1wKfAsD/rgKfAsL/rgKfAsX/wwKfAsb/1wKfAsf/wwKfAsj/1wKfAtX/rgKfAu//1wKfAvH/1wKfAvP/1wKfAv7/rgKfAw7/1wKfAxD/1wKfAxX/1wKfAxj/1wKgAc//7AKgAdj/7AKgAdv/7AKgAd7/7AKgAeH/7AKgAer/7AKgAe3/7AKgAmr/7AKgAn//7AKgAoX/7AKgAof/7AKgAon/7AKgAo3/7AKgArL/7AKgArT/7AKgAsD/7AKgAsL/7AKgAtX/7AKgAuD/7AKgAvD/7AKgAvL/7AKgAvT/7AKgAv7/7AKgAwr/7AKgAwz/7AKgAw7/1wKgAxD/1wKgAxb/7AKgAxr/7AKhAA//rgKhABH/rgKhAgj/rgKhAgz/rgKhAoD/7AKhAoL/7AKhArf/7AKhArn/7AKhAw3/1wKhAw//1wKiAekAKQKjAZ//1wKjAaMA4QKjAbj/1wKjAbv/1wKjAb7/wwKjAdz/1wKjAeH/rgKjAeT/1wKjAmz/1wKjAnsAPQKjAn3/7AKjAn7/1wKjAoT/1wKjAob/1wKjAoj/1wKjAor/1wKjAoz/1wKjAqr/1wKjArH/1wKjArP/1wKjArb/1wKjAr7/1wKjAsD/rgKjAsL/rgKjAsX/wwKjAsb/1wKjAsf/wwKjAsj/1wKjAtX/rgKjAu//1wKjAvH/1wKjAvP/1wKjAv7/rgKjAw7/1wKjAxD/1wKjAxX/1wKjAxj/1wKkAc//7AKkAdj/7AKkAdv/7AKkAd7/7AKkAeH/7AKkAer/7AKkAe3/7AKkAmr/7AKkAn//7AKkAoX/7AKkAof/7AKkAon/7AKkAo3/7AKkArL/7AKkArT/7AKkAsD/7AKkAsL/7AKkAtX/7AKkAuD/7AKkAvD/7AKkAvL/7AKkAvT/7AKkAv7/7AKkAwr/7AKkAwz/7AKkAw7/1wKkAxD/1wKkAxb/7AKkAxr/7AKlAZ//1wKlAbj/1wKlAbv/1wKlAb7/1wKlAcH/1wKlAeH/1wKlAmz/1wKlAnz/1wKlAn7/1wKlAoT/1wKlAob/1wKlAoj/1wKlAor/1wKlAoz/1wKlArH/1wKlArP/1wKlAr//1wKlAsD/1wKlAsH/1wKlAsL/1wKlAsX/mgKlAsf/mgKlAtT/1wKlAtX/1wKlAu//1wKlAvH/1wKlAvP/1wKlAv3/1wKlAv7/1wKlAwn/1wKlAwv/1wKlAw7/1wKlAxD/1wKlAxX/1wKlAxn/7AKmAc//1wKmAdj/1wKmAdv/1wKmAd7/1wKmAeH/1wKmAer/1wKmAe3/1wKmAmr/1wKmAn//1wKmAoX/1wKmAof/1wKmAon/1wKmAo3/1wKmArL/1wKmArT/1wKmAsD/1wKmAsL/1wKmAsb/1wKmAsj/1wKmAtX/1wKmAuD/1wKmAvD/1wKmAvL/1wKmAvT/1wKmAv7/1wKmAwr/1wKmAwz/1wKmAxb/1wKmAxr/1wKnAZ//1wKnAbj/1wKnAbv/1wKnAb7/1wKnAcH/1wKnAeH/1wKnAmz/1wKnAnz/1wKnAn7/1wKnAoT/1wKnAob/1wKnAoj/1wKnAor/1wKnAoz/1wKnArH/1wKnArP/1wKnAr//1wKnAsD/1wKnAsH/1wKnAsL/1wKnAsX/mgKnAsf/mgKnAtT/1wKnAtX/1wKnAu//1wKnAvH/1wKnAvP/1wKnAv3/1wKnAv7/1wKnAwn/1wKnAwv/1wKnAw7/1wKnAxD/1wKnAxX/1wKnAxn/7AKoAc//1wKoAdj/1wKoAdv/1wKoAd7/1wKoAeH/1wKoAer/1wKoAe3/1wKoAmr/1wKoAn//1wKoAoX/1wKoAof/1wKoAon/1wKoAo3/1wKoArL/1wKoArT/1wKoAsD/1wKoAsL/1wKoAsb/1wKoAsj/1wKoAtX/1wKoAuD/1wKoAvD/1wKoAvL/1wKoAvT/1wKoAv7/1wKoAwr/1wKoAwz/1wKoAxb/1wKoAxr/1wKpAZ//1wKpAbj/1wKpAbv/1wKpAb7/1wKpAcH/1wKpAeH/1wKpAmz/1wKpAnz/1wKpAn7/1wKpAoT/1wKpAob/1wKpAoj/1wKpAor/1wKpAoz/1wKpArH/1wKpArP/1wKpAr//1wKpAsD/1wKpAsH/1wKpAsL/1wKpAsX/mgKpAsf/mgKpAtT/1wKpAtX/1wKpAu//1wKpAvH/1wKpAvP/1wKpAv3/1wKpAv7/1wKpAwn/1wKpAwv/1wKpAw7/1wKpAxD/1wKpAxX/1wKpAxn/7AKqAc//1wKqAdj/1wKqAdv/1wKqAd7/1wKqAeH/1wKqAer/1wKqAe3/1wKqAmr/1wKqAn//1wKqAoX/1wKqAof/1wKqAon/1wKqAo3/1wKqArL/1wKqArT/1wKqAsD/1wKqAsL/1wKqAsb/1wKqAsj/1wKqAtX/1wKqAuD/1wKqAvD/1wKqAvL/1wKqAvT/1wKqAv7/1wKqAwr/1wKqAwz/1wKqAxb/1wKqAxr/1wKrAaMA4QKrAuoAKQKrAw7/1wKrAxD/1wKsAAX/7AKsAAr/7AKsAgf/7AKsAgv/7AKtAA//mgKtABD/1wKtABH/mgKtAZ0AKQKtAZ//1wKtAaT/rgKtAaYAKQKtAar/hQKtAa7/rgKtAbX/rgKtAbj/1wKtAbv/1wKtAbwAKQKtAb7/wwKtAcQAKQKtAcz/wwKtAc3/wwKtAc7/mgKtAc//rgKtAdD/1wKtAdH/1wKtAdL/wwKtAdP/wwKtAdT/wwKtAdX/mgKtAdb/wwKtAdf/wwKtAdj/rgKtAdn/wwKtAdr/wwKtAdv/rgKtAd7/rgKtAd//1wKtAeD/wwKtAeH/mgKtAeL/wwKtAeP/wwKtAeX/wwKtAeb/wwKtAef/1wKtAej/wwKtAer/rgKtAesAKQKtAez/wwKtAe3/rgKtAe7/wwKtAfL/mgKtAfP/wwKtAfQAKQKtAfX/wwKtAff/wwKtAfn/wwKtAgL/1wKtAgP/1wKtAgT/1wKtAgj/mgKtAgz/mgKtAmr/rgKtAmv/wwKtAmz/1wKtAnH/wwKtAnL/hQKtAnP/mgKtAnX/wwKtAnf/1wKtAnn/wwKtAn3/wwKtAn7/1wKtAn//rgKtAoT/1wKtAoX/rgKtAob/1wKtAof/rgKtAoj/1wKtAon/rgKtAor/1wKtAoz/1wKtAo3/rgKtApb/wwKtApgAKQKtApr/wwKtAp7/wwKtAqD/1wKtAqL/1wKtAqT/wwKtAqb/wwKtAqgAKQKtAqkAKQKtAqz/wwKtAq7/wwKtArD/wwKtArH/1wKtArL/rgKtArP/1wKtArT/rgKtArUAKQKtArz/1wKtAr0AKQKtAsD/mgKtAsL/mgKtAsT/wwKtAsX/1wKtAsb/wwKtAsf/1wKtAsj/wwKtAsv/1wKtAs3/wwKtAs7/rgKtAs//mgKtAtH/wwKtAtP/wwKtAtX/mgKtAtf/wwKtAtn/hQKtAtv/hQKtAt3/hQKtAuD/rgKtAub/1wKtAuj/1wKtAuz/wwKtAu7/wwKtAu//1wKtAvD/rgKtAvH/1wKtAvL/rgKtAvP/1wKtAvT/rgKtAvb/1wKtAv7/mgKtAwD/wwKtAwL/wwKtAwb/1wKtAwj/1wKtAwn/mgKtAwr/rgKtAwv/mgKtAwz/rgKtAw7/1wKtAxD/1wKtAxH/rgKtAxL/mgKtAxT/wwKtAxX/1wKtAxb/rgKtAxcAKQKtAxr/rgKtAxv/rgKtAxz/mgKuAA//mgKuABD/1wKuABH/mgKuAc7/wwKuAc//7AKuAdX/wwKuAdj/7AKuAdv/7AKuAd7/7AKuAer/7AKuAe3/7AKuAfL/wwKuAgL/1wKuAgP/1wKuAgT/1wKuAgj/mgKuAgz/mgKuAmr/7AKuAnP/wwKuAn//7AKuAoX/7AKuAof/7AKuAon/7AKuAo3/7AKuArL/7AKuArT/7AKuAs//wwKuAuD/7AKuAvD/7AKuAvL/7AKuAvT/7AKuAwr/7AKuAwz/7AKuAxL/wwKuAxb/7AKuAxr/7AKuAxz/wwKvAAX/XAKvAAr/XAKvAZ3/mgKvAaMAZgKvAab/mgKvAbz/SAKvAcH/hQKvAcT/mgKvAdz/rgKvAeH/1wKvAeT/rgKvAgf/XAKvAgv/XAKvAnz/hQKvAoD/cQKvAoL/cQKvAqn/mgKvAqr/rgKvArX/SAKvArb/rgKvArf/mgKvArn/mgKvAr3/mgKvAr7/rgKvAr//hQKvAsD/1wKvAsH/hQKvAsL/1wKvAsX/wwKvAsb/1wKvAsf/wwKvAsj/1wKvAtT/hQKvAtX/1wKvAv3/hQKvAv7/1wKvAw3/SAKvAw7/rgKvAw//SAKvAxD/rgKvAxf/mgKvAxj/rgKwAAX/cQKwAAr/cQKwAdz/mgKwAeH/1wKwAeT/mgKwAgf/cQKwAgv/cQKwAm3/1wKwAoH/1wKwAoP/1wKwAov/1wKwAqr/mgKwArb/mgKwArj/1wKwArr/1wKwAr7/mgKwAsD/1wKwAsL/1wKwAsb/1wKwAsj/1wKwAtX/1wKwAv7/1wKwAw7/cQKwAxD/cQKwAxj/mgKxAZ3/1wKxAab/1wKxAbz/wwKxAcT/1wKxAoD/7AKxAoL/7AKxAqn/1wKxArX/wwKxArf/7AKxArn/7AKxAr3/1wKxAw3/1wKxAw//1wKxAxf/1wKyAAX/7AKyAAr/7AKyAdD/1wKyAdz/7AKyAd3/7AKyAd//1wKyAeH/7AKyAeT/7AKyAfb/7AKyAgf/7AKyAgv/7AKyAqD/1wKyAqr/7AKyArb/7AKyArz/1wKyAr7/7AKyAsD/7AKyAsL/7AKyAsv/1wKyAtX/7AKyAub/1wKyAvj/7AKyAvr/7AKyAvz/7AKyAv7/7AKyAwb/1wKyAwj/1wKyAw7/7AKyAxD/7AKyAxj/7AKzAZ//1wKzAbj/1wKzAbv/1wKzAb7/1wKzAeH/1wKzAmz/1wKzAn7/1wKzAoT/1wKzAob/1wKzAoj/1wKzAor/1wKzAoz/1wKzArH/1wKzArP/1wKzAsD/1wKzAsL/1wKzAsX/1wKzAsf/1wKzAtX/1wKzAu//1wKzAvH/1wKzAvP/1wKzAv7/1wKzAwn/1wKzAwv/1wKzAw7/1wKzAxD/1wKzAxX/1wK1AA//hQK1ABD/rgK1ABH/hQK1AZ//1wK1AaT/mgK1Aar/cQK1Aa7/mgK1AbX/mgK1Abj/1wK1Abv/1wK1AbwAKQK1Ab7/rgK1Acz/mgK1Ac3/mgK1Ac7/hQK1Ac//cQK1AdD/1wK1AdH/1wK1AdL/mgK1AdP/mgK1AdT/mgK1AdX/hQK1Adb/mgK1Adf/mgK1Adj/cQK1Adn/mgK1Adr/mgK1Adv/cQK1Adz/rgK1Ad3/rgK1Ad7/cQK1Ad//1wK1AeD/mgK1AeH/mgK1AeL/mgK1AeP/mgK1AeT/rgK1AeX/mgK1Aeb/mgK1Aef/1wK1Aej/mgK1Aen/wwK1Aer/cQK1Aez/mgK1Ae3/cQK1Ae7/hQK1AfL/hQK1AfP/mgK1AfX/mgK1Afb/rgK1Aff/mgK1Afn/mgK1AgL/rgK1AgP/rgK1AgT/rgK1Agj/hQK1Agz/hQK1Amr/cQK1Amv/mgK1Amz/1wK1Am3/1wK1AnH/mgK1AnL/cQK1AnP/hQK1AnX/mgK1Anf/mgK1Ann/mgK1An3/mgK1An7/1wK1An//cQK1AoH/1wK1AoP/1wK1AoT/1wK1AoX/cQK1Aob/1wK1Aof/cQK1Aoj/1wK1Aon/cQK1Aor/1wK1Aov/1wK1Aoz/1wK1Ao3/cQK1Apb/mgK1Apr/mgK1Ap7/mgK1AqD/1wK1AqL/1wK1AqT/mgK1Aqb/mgK1Aqr/rgK1Aqz/mgK1Aq7/mgK1ArD/mgK1ArH/1wK1ArL/cQK1ArP/1wK1ArT/cQK1ArUAKQK1Arb/rgK1Arj/rgK1Arr/rgK1Arz/1wK1Ar7/rgK1AsD/mgK1AsL/mgK1AsT/mgK1AsX/mgK1Asb/cQK1Asf/mgK1Asj/cQK1Asv/1wK1As3/mgK1As7/mgK1As//hQK1AtH/mgK1AtP/mgK1AtX/mgK1Atf/mgK1Atn/cQK1Atv/cQK1At3/cQK1AuD/cQK1Aub/1wK1Auj/1wK1Aur/wwK1Auz/mgK1Au7/mgK1Au//1wK1AvD/cQK1AvH/1wK1AvL/cQK1AvP/1wK1AvT/cQK1Avb/1wK1Avj/rgK1Avr/rgK1Avz/rgK1Av7/mgK1AwD/mgK1AwL/mgK1Awb/1wK1Awj/1wK1Awn/cQK1Awr/cQK1Awv/cQK1Awz/cQK1Aw7/mgK1AxD/mgK1AxH/mgK1AxL/hQK1AxT/mgK1AxX/1wK1Axb/cQK1Axj/rgK1Axr/cQK1Axv/mgK1Axz/hQK2AA//mgK2ABD/1wK2ABH/mgK2Ac7/wwK2Ac//7AK2AdX/wwK2Adj/7AK2Adv/7AK2Ad7/7AK2Aer/7AK2Ae3/7AK2AfL/wwK2AgL/1wK2AgP/1wK2AgT/1wK2Agj/mgK2Agz/mgK2Amr/7AK2AnP/wwK2An//7AK2AoX/7AK2Aof/7AK2Aon/7AK2Ao3/7AK2ArL/7AK2ArT/7AK2As//wwK2AuD/7AK2AvD/7AK2AvL/7AK2AvT/7AK2Awr/7AK2Awz/7AK2AxL/wwK2Axb/7AK2Axr/7AK2Axz/wwK3AA//hQK3ABH/hQK3AZ//1wK3AaT/rgK3Aar/hQK3Aa7/rgK3AbX/rgK3Abj/1wK3Abv/1wK3Ab7/wwK3Acr/rgK3Acz/wwK3Ac3/wwK3Ac7/mgK3Ac//mgK3AdL/wwK3AdP/wwK3AdT/wwK3AdX/mgK3Adb/wwK3Adf/wwK3Adj/mgK3Adn/wwK3Adr/wwK3Adv/mgK3Ad7/mgK3AeD/wwK3AeH/rgK3AeL/wwK3AeP/wwK3AeX/wwK3Aeb/wwK3Aej/wwK3Aen/1wK3Aer/mgK3AesAKQK3Aez/wwK3Ae3/mgK3Ae7/rgK3AfL/mgK3AfP/wwK3AfQAKQK3AfX/wwK3Aff/wwK3Afn/wwK3Agj/hQK3Agz/hQK3Amr/mgK3Amv/wwK3Amz/1wK3AnH/wwK3AnL/hQK3AnP/mgK3AnX/wwK3Anf/1wK3Ann/wwK3An3/1wK3An7/1wK3An//mgK3AoT/1wK3AoX/mgK3Aob/1wK3Aof/mgK3Aoj/1wK3Aon/mgK3Aor/1wK3Aoz/1wK3Ao3/mgK3Apb/wwK3ApgAKQK3Apr/wwK3Ap7/wwK3AqT/wwK3Aqb/wwK3AqgAKQK3Aqz/wwK3Aq7/wwK3ArD/wwK3ArH/1wK3ArL/mgK3ArP/1wK3ArT/mgK3AsD/rgK3AsL/rgK3AsT/wwK3Asb/rgK3Asj/rgK3As3/wwK3As7/rgK3As//mgK3AtH/wwK3AtP/wwK3AtX/rgK3Atf/wwK3Atn/hQK3Atr/rgK3Atv/hQK3Atz/rgK3At3/hQK3At7/rgK3AuD/mgK3AuH/7AK3AuL/rgK3AuP/7AK3AuT/rgK3Auz/wwK3Au7/wwK3Au//1wK3AvD/mgK3AvH/1wK3AvL/mgK3AvP/1wK3AvT/mgK3Av7/rgK3AwD/wwK3AwL/wwK3Awn/rgK3Awr/mgK3Awv/rgK3Awz/mgK3Aw7/1wK3AxD/1wK3AxH/rgK3AxL/mgK3AxT/wwK3AxX/1wK3Axb/mgK3Axn/7AK3Axr/mgK3Axv/rgK3Axz/mgK4AA//rgK4ABH/rgK4Ac7/7AK4AdX/7AK4AfL/7AK4Agj/rgK4Agz/rgK4AnP/7AK4As//7AK4AxL/7AK4Axz/7AK5AA//hQK5ABH/hQK5AZ//1wK5AaT/rgK5Aar/hQK5Aa7/rgK5AbX/rgK5Abj/1wK5Abv/1wK5Ab7/wwK5Acr/rgK5Acz/wwK5Ac3/wwK5Ac7/mgK5Ac//mgK5AdL/wwK5AdP/wwK5AdT/wwK5AdX/mgK5Adb/wwK5Adf/wwK5Adj/mgK5Adn/wwK5Adr/wwK5Adv/mgK5Ad7/mgK5AeD/wwK5AeH/rgK5AeL/wwK5AeP/wwK5AeX/wwK5Aeb/wwK5Aej/wwK5Aen/1wK5Aer/mgK5AesAKQK5Aez/wwK5Ae3/mgK5Ae7/rgK5AfL/mgK5AfP/wwK5AfQAKQK5AfX/wwK5Aff/wwK5Afn/wwK5Agj/hQK5Agz/hQK5Amr/mgK5Amv/wwK5Amz/1wK5AnH/wwK5AnL/hQK5AnP/mgK5AnX/wwK5Anf/1wK5Ann/wwK5An3/1wK5An7/1wK5An//mgK5AoT/1wK5AoX/mgK5Aob/1wK5Aof/mgK5Aoj/1wK5Aon/mgK5Aor/1wK5Aoz/1wK5Ao3/mgK5Apb/wwK5ApgAKQK5Apr/wwK5Ap7/wwK5AqT/wwK5Aqb/wwK5AqgAKQK5Aqz/wwK5Aq7/wwK5ArD/wwK5ArH/1wK5ArL/mgK5ArP/1wK5ArT/mgK5AsD/rgK5AsL/rgK5AsT/wwK5Asb/rgK5Asj/rgK5As3/wwK5As7/rgK5As//mgK5AtH/wwK5AtP/wwK5AtX/rgK5Atf/wwK5Atn/hQK5Atr/rgK5Atv/hQK5Atz/rgK5At3/hQK5At7/rgK5AuD/mgK5AuH/7AK5AuL/rgK5AuP/7AK5AuT/rgK5Auz/wwK5Au7/wwK5Au//1wK5AvD/mgK5AvH/1wK5AvL/mgK5AvP/1wK5AvT/mgK5Av7/rgK5AwD/wwK5AwL/wwK5Awn/rgK5Awr/mgK5Awv/rgK5Awz/mgK5Aw7/1wK5AxD/1wK5AxH/rgK5AxL/mgK5AxT/wwK5AxX/1wK5Axb/mgK5Axn/7AK5Axr/mgK5Axv/rgK5Axz/mgK6AA//rgK6ABH/rgK6Ac7/7AK6AdX/7AK6AfL/7AK6Agj/rgK6Agz/rgK6AnP/7AK6As//7AK6AxL/7AK6Axz/7AK7AZ//1wK7AaMA4QK7Abj/1wK7Abv/1wK7Ab7/wwK7Adz/1wK7AeH/rgK7AeT/1wK7Amz/1wK7AnsAPQK7An3/7AK7An7/1wK7AoT/1wK7Aob/1wK7Aoj/1wK7Aor/1wK7Aoz/1wK7Aqr/1wK7ArH/1wK7ArP/1wK7Arb/1wK7Ar7/1wK7AsD/rgK7AsL/rgK7AsX/wwK7Asb/1wK7Asf/wwK7Asj/1wK7AtX/rgK7Au//1wK7AvH/1wK7AvP/1wK7Av7/rgK7Aw7/1wK7AxD/1wK7AxX/1wK7Axj/1wK8Ac//7AK8Adj/7AK8Adv/7AK8Ad7/7AK8AeH/7AK8Aer/7AK8Ae3/7AK8Amr/7AK8An//7AK8AoX/7AK8Aof/7AK8Aon/7AK8Ao3/7AK8ArL/7AK8ArT/7AK8AsD/7AK8AsL/7AK8AtX/7AK8AuD/7AK8AvD/7AK8AvL/7AK8AvT/7AK8Av7/7AK8Awr/7AK8Awz/7AK8Aw7/1wK8AxD/1wK8Axb/7AK8Axr/7AK9AaMA4QK9AuoAKQK9Aw7/1wK9AxD/1wK+AAX/7AK+AAr/7AK+Agf/7AK+Agv/7AK/AaMA4QK/AuoAKQK/Aw7/1wK/AxD/1wLAAAX/7ALAAAr/7ALAAgf/7ALAAgv/7ALDAAX/wwLDAAr/wwLDAZ3/1wLDAab/1wLDAbz/hQLDAcH/rgLDAcT/1wLDAdz/1wLDAd3/7ALDAeH/7ALDAeT/1wLDAfb/7ALDAgf/wwLDAgv/wwLDAnz/rgLDAoD/wwLDAoL/wwLDAqn/1wLDAqr/1wLDArX/hQLDArb/1wLDArf/mgLDArn/mgLDAr3/1wLDAr7/1wLDAr//rgLDAsD/7ALDAsH/rgLDAsL/7ALDAtT/rgLDAtX/7ALDAvj/7ALDAvr/7ALDAvz/7ALDAv3/rgLDAv7/7ALDAw3/rgLDAw7/1wLDAw//rgLDAxD/1wLDAxf/1wLDAxj/1wLEAAX/mgLEAAr/mgLEAdz/1wLEAd3/1wLEAeT/1wLEAfb/1wLEAgf/mgLEAgv/mgLEAqr/1wLEArb/1wLEArj/1wLEArr/1wLEAr7/1wLEAvj/1wLEAvr/1wLEAvz/1wLEAw7/rgLEAxD/rgLEAxj/1wLFAbz/1wLFAoD/7ALFAoL/7ALFArX/1wLFArf/7ALFArn/7ALFAw3/7ALFAw//7ALGAAX/7ALGAAr/7ALGAgf/7ALGAgv/7ALHAbz/1wLHAoD/7ALHAoL/7ALHArX/1wLHArf/7ALHArn/7ALHAw3/7ALHAw//7ALIAAX/7ALIAAr/7ALIAgf/7ALIAgv/7ALKAZ//1wLKAbj/1wLKAbv/1wLKAb7/1wLKAcH/1wLKAeH/1wLKAmz/1wLKAnz/1wLKAn7/1wLKAoT/1wLKAob/1wLKAoj/1wLKAor/1wLKAoz/1wLKArH/1wLKArP/1wLKAr//1wLKAsD/1wLKAsH/1wLKAsL/1wLKAsX/mgLKAsf/mgLKAtT/1wLKAtX/1wLKAu//1wLKAvH/1wLKAvP/1wLKAv3/1wLKAv7/1wLKAwn/1wLKAwv/1wLKAw7/1wLKAxD/1wLKAxX/1wLKAxn/7ALLAc//1wLLAdj/1wLLAdv/1wLLAd7/1wLLAeH/1wLLAer/1wLLAe3/1wLLAmr/1wLLAn//1wLLAoX/1wLLAof/1wLLAon/1wLLAo3/1wLLArL/1wLLArT/1wLLAsD/1wLLAsL/1wLLAsb/1wLLAsj/1wLLAtX/1wLLAuD/1wLLAvD/1wLLAvL/1wLLAvT/1wLLAv7/1wLLAwr/1wLLAwz/1wLLAxb/1wLLAxr/1wLMAAX/wwLMAAr/wwLMAaMAZgLMAbz/1wLMAb7/1wLMAcH/rgLMAdz/wwLMAeH/1wLMAeT/wwLMAgf/wwLMAgv/wwLMAm3/7ALMAnz/rgLMAoD/1wLMAoH/7ALMAoL/1wLMAoP/7ALMAov/7ALMAqr/wwLMArX/1wLMArb/wwLMArf/1wLMArj/7ALMArn/1wLMArr/7ALMAr7/wwLMAr//rgLMAsD/1wLMAsH/rgLMAsL/1wLMAsX/wwLMAsb/1wLMAsf/wwLMAsj/1wLMAtT/rgLMAtX/1wLMAv3/rgLMAv7/1wLMAw3/1wLMAw7/wwLMAw//1wLMAxD/wwLMAxj/wwLNAeH/1wLNAsD/1wLNAsL/1wLNAtX/1wLNAv7/1wLOAaMA4QLOAuoAKQLOAw7/1wLOAxD/1wLPAAX/7ALPAAr/7ALPAgf/7ALPAgv/7ALSAaMA4QLSAuoAKQLSAw7/1wLSAxD/1wLTAAX/7ALTAAr/7ALTAgf/7ALTAgv/7ALWAaMA4QLWAuoAKQLWAw7/1wLWAxD/1wLXAAX/7ALXAAr/7ALXAgf/7ALXAgv/7ALZAAX/cQLZAAr/cQLZAZ3/mgLZAab/mgLZAbz/cQLZAb7/1wLZAcH/mgLZAcT/mgLZAdz/1wLZAeH/1wLZAeT/1wLZAgf/cQLZAgv/cQLZAm7/1wLZAnz/mgLZAoD/rgLZAoL/rgLZApf/1wLZApv/1wLZAqf/1wLZAqn/mgLZAqr/1wLZArX/cQLZArb/1wLZArf/hQLZArn/hQLZAr3/mgLZAr7/1wLZAr//mgLZAsD/1wLZAsH/mgLZAsL/1wLZAsX/mgLZAsf/mgLZAtT/mgLZAtX/1wLZAuH/1wLZAuP/1wLZAv3/mgLZAv7/1wLZAwP/1wLZAw3/cQLZAw7/1wLZAw//cQLZAxD/1wLZAxf/mgLZAxj/1wLaAAX/7ALaAAr/7ALaAgf/7ALaAgv/7ALbAAX/cQLbAAr/cQLbAZ3/mgLbAab/mgLbAbz/cQLbAb7/1wLbAcH/mgLbAcT/mgLbAdz/1wLbAeH/1wLbAeT/1wLbAgf/cQLbAgv/cQLbAm7/1wLbAnz/mgLbAoD/rgLbAoL/rgLbApf/1wLbApv/1wLbAqf/1wLbAqn/mgLbAqr/1wLbArX/cQLbArb/1wLbArf/hQLbArn/hQLbAr3/mgLbAr7/1wLbAr//mgLbAsD/1wLbAsH/mgLbAsL/1wLbAsX/mgLbAsf/mgLbAtT/mgLbAtX/1wLbAuH/1wLbAuP/1wLbAv3/mgLbAv7/1wLbAwP/1wLbAw3/cQLbAw7/1wLbAw//cQLbAxD/1wLbAxf/mgLbAxj/1wLcAAX/7ALcAAr/7ALcAgf/7ALcAgv/7ALeAAX/7ALeAAr/7ALeAgf/7ALeAgv/7ALgAAX/7ALgAAr/7ALgAgf/7ALgAgv/7ALhAA//rgLhABH/rgLhAZ3/7ALhAaT/1wLhAab/7ALhAaj/1wLhAar/1wLhAa7/1wLhAbD/1wLhAbH/7ALhAbX/1wLhAbz/wwLhAb3/1wLhAb//1wLhAcH/1wLhAcT/7ALhAcf/7ALhAc7/7ALhAdX/7ALhAfL/7ALhAgj/rgLhAgz/rgLhAnL/1wLhAnP/7ALhAnr/7ALhAnz/1wLhAoD/7ALhAoL/7ALhAp//1wLhAqH/7ALhAqn/7ALhArX/wwLhArf/7ALhArn/7ALhArv/1wLhAr3/7ALhAr//1wLhAsH/1wLhAsr/1wLhAs7/1wLhAs//7ALhAtT/1wLhAtn/1wLhAtv/1wLhAt3/1wLhAuX/1wLhAuf/7ALhAvX/7ALhAvf/1wLhAvn/1wLhAvv/1wLhAv3/1wLhAwX/1wLhAwf/1wLhAw3/1wLhAw//1wLhAxH/1wLhAxL/7ALhAxf/7ALhAxv/1wLhAxz/7ALiAAX/7ALiAAr/7ALiAdD/1wLiAdz/7ALiAd3/7ALiAd//1wLiAeH/7ALiAeT/7ALiAfb/7ALiAgf/7ALiAgv/7ALiAqD/1wLiAqr/7ALiArb/7ALiArz/1wLiAr7/7ALiAsD/7ALiAsL/7ALiAsv/1wLiAtX/7ALiAub/1wLiAvj/7ALiAvr/7ALiAvz/7ALiAv7/7ALiAwb/1wLiAwj/1wLiAw7/7ALiAxD/7ALiAxj/7ALjAA//rgLjABH/rgLjAZ3/7ALjAaT/1wLjAab/7ALjAaj/1wLjAar/1wLjAa7/1wLjAbD/1wLjAbH/7ALjAbX/1wLjAbz/wwLjAb3/1wLjAb//1wLjAcH/1wLjAcT/7ALjAcf/7ALjAc7/7ALjAdX/7ALjAfL/7ALjAgj/rgLjAgz/rgLjAnL/1wLjAnP/7ALjAnr/7ALjAnz/1wLjAoD/7ALjAoL/7ALjAp//1wLjAqH/7ALjAqn/7ALjArX/wwLjArf/7ALjArn/7ALjArv/1wLjAr3/7ALjAr//1wLjAsH/1wLjAsr/1wLjAs7/1wLjAs//7ALjAtT/1wLjAtn/1wLjAtv/1wLjAt3/1wLjAuX/1wLjAuf/7ALjAvX/7ALjAvf/1wLjAvn/1wLjAvv/1wLjAv3/1wLjAwX/1wLjAwf/1wLjAw3/1wLjAw//1wLjAxH/1wLjAxL/7ALjAxf/7ALjAxv/1wLjAxz/7ALkAAX/7ALkAAr/7ALkAdD/1wLkAdz/7ALkAd3/7ALkAd//1wLkAeH/7ALkAeT/7ALkAfb/7ALkAgf/7ALkAgv/7ALkAqD/1wLkAqr/7ALkArb/7ALkArz/1wLkAr7/7ALkAsD/7ALkAsL/7ALkAsv/1wLkAtX/7ALkAub/1wLkAvj/7ALkAvr/7ALkAvz/7ALkAv7/7ALkAwb/1wLkAwj/1wLkAw7/7ALkAxD/7ALkAxj/7ALlAZ//1wLlAbj/1wLlAbv/1wLlAb7/1wLlAcH/1wLlAeH/1wLlAmz/1wLlAnz/1wLlAn7/1wLlAoT/1wLlAob/1wLlAoj/1wLlAor/1wLlAoz/1wLlArH/1wLlArP/1wLlAr//1wLlAsD/1wLlAsH/1wLlAsL/1wLlAsX/mgLlAsf/mgLlAtT/1wLlAtX/1wLlAu//1wLlAvH/1wLlAvP/1wLlAv3/1wLlAv7/1wLlAwn/1wLlAwv/1wLlAw7/1wLlAxD/1wLlAxX/1wLlAxn/7ALmAc//1wLmAdj/1wLmAdv/1wLmAd7/1wLmAeH/1wLmAer/1wLmAe3/1wLmAmr/1wLmAn//1wLmAoX/1wLmAof/1wLmAon/1wLmAo3/1wLmArL/1wLmArT/1wLmAsD/1wLmAsL/1wLmAsb/1wLmAsj/1wLmAtX/1wLmAuD/1wLmAvD/1wLmAvL/1wLmAvT/1wLmAv7/1wLmAwr/1wLmAwz/1wLmAxb/1wLmAxr/1wLnAA//rgLnABH/rgLnAgj/rgLnAgz/rgLnAoD/7ALnAoL/7ALnArf/7ALnArn/7ALnAw3/1wLnAw//1wLoAekAKQLpAAX/7ALpAAr/7ALpAgf/7ALpAgv/7ALpAw7/1wLpAxD/1wLvAA//rgLvABH/rgLvAZ3/7ALvAaT/1wLvAab/7ALvAaj/1wLvAar/1wLvAa7/1wLvAbD/1wLvAbH/7ALvAbX/1wLvAbz/wwLvAb3/1wLvAb//1wLvAcH/1wLvAcT/7ALvAcf/7ALvAc7/7ALvAdX/7ALvAfL/7ALvAgj/rgLvAgz/rgLvAnL/1wLvAnP/7ALvAnr/7ALvAnz/1wLvAoD/7ALvAoL/7ALvAp//1wLvAqH/7ALvAqn/7ALvArX/wwLvArf/7ALvArn/7ALvArv/1wLvAr3/7ALvAr//1wLvAsH/1wLvAsr/1wLvAs7/1wLvAs//7ALvAtT/1wLvAtn/1wLvAtv/1wLvAt3/1wLvAuX/1wLvAuf/7ALvAvX/7ALvAvf/1wLvAvn/1wLvAvv/1wLvAv3/1wLvAwX/1wLvAwf/1wLvAw3/1wLvAw//1wLvAxH/1wLvAxL/7ALvAxf/7ALvAxv/1wLvAxz/7ALwAAX/7ALwAAr/7ALwAdD/1wLwAdz/7ALwAd3/7ALwAd//1wLwAeH/7ALwAeT/7ALwAfb/7ALwAgf/7ALwAgv/7ALwAqD/1wLwAqr/7ALwArb/7ALwArz/1wLwAr7/7ALwAsD/7ALwAsL/7ALwAsv/1wLwAtX/7ALwAub/1wLwAvj/7ALwAvr/7ALwAvz/7ALwAv7/7ALwAwb/1wLwAwj/1wLwAw7/7ALwAxD/7ALwAxj/7ALxAA//rgLxABH/rgLxAZ3/7ALxAaT/1wLxAab/7ALxAaj/1wLxAar/1wLxAa7/1wLxAbD/1wLxAbH/7ALxAbX/1wLxAbz/wwLxAb3/1wLxAb//1wLxAcH/1wLxAcT/7ALxAcf/7ALxAc7/7ALxAdX/7ALxAfL/7ALxAgj/rgLxAgz/rgLxAnL/1wLxAnP/7ALxAnr/7ALxAnz/1wLxAoD/7ALxAoL/7ALxAp//1wLxAqH/7ALxAqn/7ALxArX/wwLxArf/7ALxArn/7ALxArv/1wLxAr3/7ALxAr//1wLxAsH/1wLxAsr/1wLxAs7/1wLxAs//7ALxAtT/1wLxAtn/1wLxAtv/1wLxAt3/1wLxAuX/1wLxAuf/7ALxAvX/7ALxAvf/1wLxAvn/1wLxAvv/1wLxAv3/1wLxAwX/1wLxAwf/1wLxAw3/1wLxAw//1wLxAxH/1wLxAxL/7ALxAxf/7ALxAxv/1wLxAxz/7ALyAAX/7ALyAAr/7ALyAdD/1wLyAdz/7ALyAd3/7ALyAd//1wLyAeH/7ALyAeT/7ALyAfb/7ALyAgf/7ALyAgv/7ALyAqD/1wLyAqr/7ALyArb/7ALyArz/1wLyAr7/7ALyAsD/7ALyAsL/7ALyAsv/1wLyAtX/7ALyAub/1wLyAvj/7ALyAvr/7ALyAvz/7ALyAv7/7ALyAwb/1wLyAwj/1wLyAw7/7ALyAxD/7ALyAxj/7ALzAA//rgLzABH/rgLzAZ3/7ALzAaT/1wLzAab/7ALzAaj/1wLzAar/1wLzAa7/1wLzAbD/1wLzAbH/7ALzAbX/1wLzAbz/wwLzAb3/1wLzAb//1wLzAcH/1wLzAcT/7ALzAcf/7ALzAc7/7ALzAdX/7ALzAfL/7ALzAgj/rgLzAgz/rgLzAnL/1wLzAnP/7ALzAnr/7ALzAnz/1wLzAoD/7ALzAoL/7ALzAp//1wLzAqH/7ALzAqn/7ALzArX/wwLzArf/7ALzArn/7ALzArv/1wLzAr3/7ALzAr//1wLzAsH/1wLzAsr/1wLzAs7/1wLzAs//7ALzAtT/1wLzAtn/1wLzAtv/1wLzAt3/1wLzAuX/1wLzAuf/7ALzAvX/7ALzAvf/1wLzAvn/1wLzAvv/1wLzAv3/1wLzAwX/1wLzAwf/1wLzAw3/1wLzAw//1wLzAxH/1wLzAxL/7ALzAxf/7ALzAxv/1wLzAxz/7AL0AAX/7AL0AAr/7AL0AdD/1wL0Adz/7AL0Ad3/7AL0Ad//1wL0AeH/7AL0AeT/7AL0Afb/7AL0Agf/7AL0Agv/7AL0AqD/1wL0Aqr/7AL0Arb/7AL0Arz/1wL0Ar7/7AL0AsD/7AL0AsL/7AL0Asv/1wL0AtX/7AL0Aub/1wL0Avj/7AL0Avr/7AL0Avz/7AL0Av7/7AL0Awb/1wL0Awj/1wL0Aw7/7AL0AxD/7AL0Axj/7AL1AA//rgL1ABH/rgL1AZ3/7AL1AaT/1wL1Aab/7AL1Aaj/1wL1Aar/1wL1Aa7/1wL1AbD/1wL1AbH/7AL1AbX/1wL1Abz/wwL1Ab3/1wL1Ab//1wL1AcH/1wL1AcT/7AL1Acf/7AL1Ac7/7AL1AdX/7AL1AfL/7AL1Agj/rgL1Agz/rgL1AnL/1wL1AnP/7AL1Anr/7AL1Anz/1wL1AoD/7AL1AoL/7AL1Ap//1wL1AqH/7AL1Aqn/7AL1ArX/wwL1Arf/7AL1Arn/7AL1Arv/1wL1Ar3/7AL1Ar//1wL1AsH/1wL1Asr/1wL1As7/1wL1As//7AL1AtT/1wL1Atn/1wL1Atv/1wL1At3/1wL1AuX/1wL1Auf/7AL1AvX/7AL1Avf/1wL1Avn/1wL1Avv/1wL1Av3/1wL1AwX/1wL1Awf/1wL1Aw3/1wL1Aw//1wL1AxH/1wL1AxL/7AL1Axf/7AL1Axv/1wL1Axz/7AL2AAX/7AL2AAr/7AL2AdD/1wL2Adz/7AL2Ad3/7AL2Ad//1wL2AeH/7AL2AeT/7AL2Afb/7AL2Agf/7AL2Agv/7AL2AqD/1wL2Aqr/7AL2Arb/7AL2Arz/1wL2Ar7/7AL2AsD/7AL2AsL/7AL2Asv/1wL2AtX/7AL2Aub/1wL2Avj/7AL2Avr/7AL2Avz/7AL2Av7/7AL2Awb/1wL2Awj/1wL2Aw7/7AL2AxD/7AL2Axj/7AL3AA//hQL3ABH/hQL3AZ//7AL3AaT/mgL3Aar/cQL3Aa7/mgL3AbX/mgL3Abj/7AL3Abv/7AL3Ab7/wwL3Acn/7AL3Ac7/rgL3Ac//1wL3AdX/rgL3Adj/1wL3Adv/1wL3Ad7/1wL3AeH/1wL3Aer/1wL3AesAZgL3Ae3/1wL3Ae7/7AL3AfL/rgL3AfQAZgL3Agj/hQL3Agz/hQL3Amr/1wL3Amz/7AL3AnL/cQL3AnP/rgL3An7/7AL3An//1wL3AoT/7AL3AoX/1wL3Aob/7AL3Aof/1wL3Aoj/7AL3Aon/1wL3Aor/7AL3Aoz/7AL3Ao3/1wL3ApgAZgL3AqgAZgL3ArH/7AL3ArL/1wL3ArP/7AL3ArT/1wL3AsD/1wL3AsL/1wL3AsX/1wL3Asb/wwL3Asf/1wL3Asj/wwL3As7/mgL3As//rgL3AtX/1wL3Atn/cQL3Atv/cQL3At3/cQL3AuD/1wL3Au//7AL3AvD/1wL3AvH/7AL3AvL/1wL3AvP/7AL3AvT/1wL3Av7/1wL3Awn/cQL3Awr/1wL3Awv/cQL3Awz/1wL3AxH/mgL3AxL/rgL3AxX/7AL3Axb/1wL3Axr/1wL3Axv/mgL3Axz/rgL4AA//rgL4ABH/rgL4Ac7/1wL4AdX/1wL4AfL/1wL4Agj/rgL4Agz/rgL4AnP/1wL4As//1wL4AxL/1wL4Axz/1wL5AA//hQL5ABH/hQL5AZ//7AL5AaT/mgL5Aar/cQL5Aa7/mgL5AbX/mgL5Abj/7AL5Abv/7AL5Ab7/wwL5Acn/7AL5Ac7/rgL5Ac//1wL5AdX/rgL5Adj/1wL5Adv/1wL5Ad7/1wL5AeH/1wL5Aer/1wL5AesAZgL5Ae3/1wL5Ae7/7AL5AfL/rgL5AfQAZgL5Agj/hQL5Agz/hQL5Amr/1wL5Amz/7AL5AnL/cQL5AnP/rgL5An7/7AL5An//1wL5AoT/7AL5AoX/1wL5Aob/7AL5Aof/1wL5Aoj/7AL5Aon/1wL5Aor/7AL5Aoz/7AL5Ao3/1wL5ApgAZgL5AqgAZgL5ArH/7AL5ArL/1wL5ArP/7AL5ArT/1wL5AsD/1wL5AsL/1wL5AsX/1wL5Asb/wwL5Asf/1wL5Asj/wwL5As7/mgL5As//rgL5AtX/1wL5Atn/cQL5Atv/cQL5At3/cQL5AuD/1wL5Au//7AL5AvD/1wL5AvH/7AL5AvL/1wL5AvP/7AL5AvT/1wL5Av7/1wL5Awn/cQL5Awr/1wL5Awv/cQL5Awz/1wL5AxH/mgL5AxL/rgL5AxX/7AL5Axb/1wL5Axr/1wL5Axv/mgL5Axz/rgL6AA//rgL6ABH/rgL6Ac7/1wL6AdX/1wL6AfL/1wL6Agj/rgL6Agz/rgL6AnP/1wL6As//1wL6AxL/1wL6Axz/1wL7AA//hQL7ABH/hQL7AZ//7AL7AaT/mgL7Aar/cQL7Aa7/mgL7AbX/mgL7Abj/7AL7Abv/7AL7Ab7/wwL7Acn/7AL7Ac7/rgL7Ac//1wL7AdX/rgL7Adj/1wL7Adv/1wL7Ad7/1wL7AeH/1wL7Aer/1wL7AesAZgL7Ae3/1wL7Ae7/7AL7AfL/rgL7AfQAZgL7Agj/hQL7Agz/hQL7Amr/1wL7Amz/7AL7AnL/cQL7AnP/rgL7An7/7AL7An//1wL7AoT/7AL7AoX/1wL7Aob/7AL7Aof/1wL7Aoj/7AL7Aon/1wL7Aor/7AL7Aoz/7AL7Ao3/1wL7ApgAZgL7AqgAZgL7ArH/7AL7ArL/1wL7ArP/7AL7ArT/1wL7AsD/1wL7AsL/1wL7AsX/1wL7Asb/wwL7Asf/1wL7Asj/wwL7As7/mgL7As//rgL7AtX/1wL7Atn/cQL7Atv/cQL7At3/cQL7AuD/1wL7Au//7AL7AvD/1wL7AvH/7AL7AvL/1wL7AvP/7AL7AvT/1wL7Av7/1wL7Awn/cQL7Awr/1wL7Awv/cQL7Awz/1wL7AxH/mgL7AxL/rgL7AxX/7AL7Axb/1wL7Axr/1wL7Axv/mgL7Axz/rgL8AA//rgL8ABH/rgL8Ac7/1wL8AdX/1wL8AfL/1wL8Agj/rgL8Agz/rgL8AnP/1wL8As//1wL8AxL/1wL8Axz/1wL/AA//hQL/ABD/rgL/ABH/hQL/AZ//1wL/AaT/mgL/Aar/cQL/Aa7/mgL/AbX/mgL/Abj/1wL/Abv/1wL/AbwAKQL/Ab7/rgL/Acz/mgL/Ac3/mgL/Ac7/hQL/Ac//cQL/AdD/1wL/AdH/1wL/AdL/mgL/AdP/mgL/AdT/mgL/AdX/hQL/Adb/mgL/Adf/mgL/Adj/cQL/Adn/mgL/Adr/mgL/Adv/cQL/Adz/rgL/Ad3/rgL/Ad7/cQL/Ad//1wL/AeD/mgL/AeH/mgL/AeL/mgL/AeP/mgL/AeT/rgL/AeX/mgL/Aeb/mgL/Aef/1wL/Aej/mgL/Aen/wwL/Aer/cQL/Aez/mgL/Ae3/cQL/Ae7/hQL/AfL/hQL/AfP/mgL/AfX/mgL/Afb/rgL/Aff/mgL/Afn/mgL/AgL/rgL/AgP/rgL/AgT/rgL/Agj/hQL/Agz/hQL/Amr/cQL/Amv/mgL/Amz/1wL/Am3/1wL/AnH/mgL/AnL/cQL/AnP/hQL/AnX/mgL/Anf/mgL/Ann/mgL/An3/mgL/An7/1wL/An//cQL/AoH/1wL/AoP/1wL/AoT/1wL/AoX/cQL/Aob/1wL/Aof/cQL/Aoj/1wL/Aon/cQL/Aor/1wL/Aov/1wL/Aoz/1wL/Ao3/cQL/Apb/mgL/Apr/mgL/Ap7/mgL/AqD/1wL/AqL/1wL/AqT/mgL/Aqb/mgL/Aqr/rgL/Aqz/mgL/Aq7/mgL/ArD/mgL/ArH/1wL/ArL/cQL/ArP/1wL/ArT/cQL/ArUAKQL/Arb/rgL/Arj/rgL/Arr/rgL/Arz/1wL/Ar7/rgL/AsD/mgL/AsL/mgL/AsT/mgL/AsX/mgL/Asb/cQL/Asf/mgL/Asj/cQL/Asv/1wL/As3/mgL/As7/mgL/As//hQL/AtH/mgL/AtP/mgL/AtX/mgL/Atf/mgL/Atn/cQL/Atv/cQL/At3/cQL/AuD/cQL/Aub/1wL/Auj/1wL/Aur/wwL/Auz/mgL/Au7/mgL/Au//1wL/AvD/cQL/AvH/1wL/AvL/cQL/AvP/1wL/AvT/cQL/Avb/1wL/Avj/rgL/Avr/rgL/Avz/rgL/Av7/mgL/AwD/mgL/AwL/mgL/Awb/1wL/Awj/1wL/Awn/cQL/Awr/cQL/Awv/cQL/Awz/cQL/Aw7/mgL/AxD/mgL/AxH/mgL/AxL/hQL/AxT/mgL/AxX/1wL/Axb/cQL/Axj/rgL/Axr/cQL/Axv/mgL/Axz/hQMAAA//mgMAABD/1wMAABH/mgMAAc7/wwMAAc//7AMAAdX/wwMAAdj/7AMAAdv/7AMAAd7/7AMAAer/7AMAAe3/7AMAAfL/wwMAAgL/1wMAAgP/1wMAAgT/1wMAAgj/mgMAAgz/mgMAAmr/7AMAAnP/wwMAAn//7AMAAoX/7AMAAof/7AMAAon/7AMAAo3/7AMAArL/7AMAArT/7AMAAs//wwMAAuD/7AMAAvD/7AMAAvL/7AMAAvT/7AMAAwr/7AMAAwz/7AMAAxL/wwMAAxb/7AMAAxr/7AMAAxz/wwMDAA//mgMDABD/1wMDABH/mgMDAZ0AKQMDAZ//1wMDAaT/rgMDAaYAKQMDAar/hQMDAa7/rgMDAbX/rgMDAbj/1wMDAbv/1wMDAbwAKQMDAb7/wwMDAcQAKQMDAcz/wwMDAc3/wwMDAc7/mgMDAc//rgMDAdD/1wMDAdH/1wMDAdL/wwMDAdP/wwMDAdT/wwMDAdX/mgMDAdb/wwMDAdf/wwMDAdj/rgMDAdn/wwMDAdr/wwMDAdv/rgMDAd7/rgMDAd//1wMDAeD/wwMDAeH/mgMDAeL/wwMDAeP/wwMDAeX/wwMDAeb/wwMDAef/1wMDAej/wwMDAer/rgMDAesAKQMDAez/wwMDAe3/rgMDAe7/wwMDAfL/mgMDAfP/wwMDAfQAKQMDAfX/wwMDAff/wwMDAfn/wwMDAgL/1wMDAgP/1wMDAgT/1wMDAgj/mgMDAgz/mgMDAmr/rgMDAmv/wwMDAmz/1wMDAnH/wwMDAnL/hQMDAnP/mgMDAnX/wwMDAnf/1wMDAnn/wwMDAn3/wwMDAn7/1wMDAn//rgMDAoT/1wMDAoX/rgMDAob/1wMDAof/rgMDAoj/1wMDAon/rgMDAor/1wMDAoz/1wMDAo3/rgMDApb/wwMDApgAKQMDApr/wwMDAp7/wwMDAqD/1wMDAqL/1wMDAqT/wwMDAqb/wwMDAqgAKQMDAqkAKQMDAqz/wwMDAq7/wwMDArD/wwMDArH/1wMDArL/rgMDArP/1wMDArT/rgMDArUAKQMDArz/1wMDAr0AKQMDAsD/mgMDAsL/mgMDAsT/wwMDAsX/1wMDAsb/wwMDAsf/1wMDAsj/wwMDAsv/1wMDAs3/wwMDAs7/rgMDAs//mgMDAtH/wwMDAtP/wwMDAtX/mgMDAtf/wwMDAtn/hQMDAtv/hQMDAt3/hQMDAuD/rgMDAub/1wMDAuj/1wMDAuz/wwMDAu7/wwMDAu//1wMDAvD/rgMDAvH/1wMDAvL/rgMDAvP/1wMDAvT/rgMDAvb/1wMDAv7/mgMDAwD/wwMDAwL/wwMDAwb/1wMDAwj/1wMDAwn/mgMDAwr/rgMDAwv/mgMDAwz/rgMDAw7/1wMDAxD/1wMDAxH/rgMDAxL/mgMDAxT/wwMDAxX/1wMDAxb/rgMDAxcAKQMDAxr/rgMDAxv/rgMDAxz/mgMEAA//wwMEABH/wwMEAc7/wwMEAc//1wMEAdX/wwMEAdj/1wMEAdv/1wMEAd7/1wMEAer/1wMEAe3/1wMEAfL/wwMEAgj/wwMEAgz/wwMEAmr/1wMEAnP/wwMEAn//1wMEAoX/1wMEAof/1wMEAon/1wMEAo3/1wMEArL/1wMEArT/1wMEAs//wwMEAuD/1wMEAvD/1wMEAvL/1wMEAvT/1wMEAwr/1wMEAwz/1wMEAxL/wwMEAxb/1wMEAxr/1wMEAxz/wwMFAZ//1wMFAaMA4QMFAbj/1wMFAbv/1wMFAb7/wwMFAdz/1wMFAeH/rgMFAeT/1wMFAmz/1wMFAnsAPQMFAn3/7AMFAn7/1wMFAoT/1wMFAob/1wMFAoj/1wMFAor/1wMFAoz/1wMFAqr/1wMFArH/1wMFArP/1wMFArb/1wMFAr7/1wMFAsD/rgMFAsL/rgMFAsX/wwMFAsb/1wMFAsf/wwMFAsj/1wMFAtX/rgMFAu//1wMFAvH/1wMFAvP/1wMFAv7/rgMFAw7/1wMFAxD/1wMFAxX/1wMFAxj/1wMGAc//7AMGAdj/7AMGAdv/7AMGAd7/7AMGAeH/7AMGAer/7AMGAe3/7AMGAmr/7AMGAn//7AMGAoX/7AMGAof/7AMGAon/7AMGAo3/7AMGArL/7AMGArT/7AMGAsD/7AMGAsL/7AMGAtX/7AMGAuD/7AMGAvD/7AMGAvL/7AMGAvT/7AMGAv7/7AMGAwr/7AMGAwz/7AMGAw7/1wMGAxD/1wMGAxb/7AMGAxr/7AMHAZ//1wMHAbj/1wMHAbv/1wMHAb7/1wMHAcH/1wMHAeH/1wMHAmz/1wMHAnz/1wMHAn7/1wMHAoT/1wMHAob/1wMHAoj/1wMHAor/1wMHAoz/1wMHArH/1wMHArP/1wMHAr//1wMHAsD/1wMHAsH/1wMHAsL/1wMHAsX/mgMHAsf/mgMHAtT/1wMHAtX/1wMHAu//1wMHAvH/1wMHAvP/1wMHAv3/1wMHAv7/1wMHAwn/1wMHAwv/1wMHAw7/1wMHAxD/1wMHAxX/1wMHAxn/7AMIAc//7AMIAdj/7AMIAdv/7AMIAd7/7AMIAeH/7AMIAer/7AMIAe3/7AMIAmr/7AMIAn//7AMIAoX/7AMIAof/7AMIAon/7AMIAo3/7AMIArL/7AMIArT/7AMIAsD/7AMIAsL/7AMIAtX/7AMIAuD/7AMIAvD/7AMIAvL/7AMIAvT/7AMIAv7/7AMIAwr/7AMIAwz/7AMIAw7/1wMIAxD/1wMIAxb/7AMIAxr/7AMLAAX/mgMLAAr/mgMLAZ3/rgMLAab/rgMLAaj/wwMLAar/wwMLAbD/wwMLAbz/cQMLAb3/wwMLAb//wwMLAcH/wwMLAcT/rgMLAdD/1wMLAdz/wwMLAd//1wMLAeH/1wMLAeT/wwMLAgf/mgMLAgv/mgMLAnL/wwMLAnb/1wMLAnz/wwMLAoD/wwMLAoL/wwMLAp//wwMLAqD/1wMLAqn/rgMLAqr/wwMLArX/cQMLArb/wwMLArf/wwMLArn/wwMLArv/wwMLArz/1wMLAr3/rgMLAr7/wwMLAr//wwMLAsD/1wMLAsH/wwMLAsL/1wMLAsr/wwMLAsv/1wMLAtT/wwMLAtX/1wMLAtn/wwMLAtv/wwMLAt3/wwMLAuX/wwMLAub/1wMLAvf/wwMLAvn/wwMLAvv/wwMLAv3/wwMLAv7/1wMLAwX/wwMLAwb/1wMLAwf/wwMLAwj/1wMLAw3/1wMLAw7/1wMLAw//1wMLAxD/1wMLAxf/rgMLAxj/wwMMAAX/mgMMAAr/mgMMAdD/1wMMAdz/wwMMAd3/1wMMAd//1wMMAeH/1wMMAeT/wwMMAfb/1wMMAgf/mgMMAgv/mgMMAqD/1wMMAqr/wwMMArb/wwMMArz/1wMMAr7/wwMMAsD/1wMMAsL/1wMMAsv/1wMMAtX/1wMMAub/1wMMAvj/1wMMAvr/1wMMAvz/1wMMAv7/1wMMAwb/1wMMAwj/1wMMAw7/mgMMAxD/mgMMAxj/wwMNAAX/mgMNAAr/mgMNAZ3/rgMNAab/rgMNAaj/wwMNAar/wwMNAbD/wwMNAbz/cQMNAb3/wwMNAb//wwMNAcH/wwMNAcT/rgMNAdD/1wMNAdz/wwMNAd//1wMNAeH/1wMNAeT/wwMNAgf/mgMNAgv/mgMNAnL/wwMNAnb/1wMNAnz/wwMNAoD/wwMNAoL/wwMNAp//wwMNAqD/1wMNAqn/rgMNAqr/wwMNArX/cQMNArb/wwMNArf/wwMNArn/wwMNArv/wwMNArz/1wMNAr3/rgMNAr7/wwMNAr//wwMNAsD/1wMNAsH/wwMNAsL/1wMNAsr/wwMNAsv/1wMNAtT/wwMNAtX/1wMNAtn/wwMNAtv/wwMNAt3/wwMNAuX/wwMNAub/1wMNAvf/wwMNAvn/wwMNAvv/wwMNAv3/wwMNAv7/1wMNAwX/wwMNAwb/1wMNAwf/wwMNAwj/1wMNAw3/1wMNAw7/1wMNAw//1wMNAxD/1wMNAxf/rgMNAxj/wwMOAAX/mgMOAAr/mgMOAdD/1wMOAdz/wwMOAd3/1wMOAd//1wMOAeH/1wMOAeT/wwMOAfb/1wMOAgf/mgMOAgv/mgMOAqD/1wMOAqr/wwMOArb/wwMOArz/1wMOAr7/wwMOAsD/1wMOAsL/1wMOAsv/1wMOAtX/1wMOAub/1wMOAvj/1wMOAvr/1wMOAvz/1wMOAv7/1wMOAwb/1wMOAwj/1wMOAw7/mgMOAxD/mgMOAxj/wwMPAaMA4QMPAuoAKQMPAw7/1wMPAxD/1wMQAAX/7AMQAAr/7AMQAgf/7AMQAgv/7AMRAAX/mgMRAAr/mgMRAZ3/rgMRAab/rgMRAaj/wwMRAar/wwMRAbD/wwMRAbz/cQMRAb3/wwMRAb//wwMRAcH/wwMRAcT/rgMRAdD/1wMRAdz/wwMRAd//1wMRAeH/1wMRAeT/wwMRAgf/mgMRAgv/mgMRAnL/wwMRAnb/1wMRAnz/wwMRAoD/wwMRAoL/wwMRAp//wwMRAqD/1wMRAqn/rgMRAqr/wwMRArX/cQMRArb/wwMRArf/wwMRArn/wwMRArv/wwMRArz/1wMRAr3/rgMRAr7/wwMRAr//wwMRAsD/1wMRAsH/wwMRAsL/1wMRAsr/wwMRAsv/1wMRAtT/wwMRAtX/1wMRAtn/wwMRAtv/wwMRAt3/wwMRAuX/wwMRAub/1wMRAvf/wwMRAvn/wwMRAvv/wwMRAv3/wwMRAv7/1wMRAwX/wwMRAwb/1wMRAwf/wwMRAwj/1wMRAw3/1wMRAw7/1wMRAw//1wMRAxD/1wMRAxf/rgMRAxj/wwMSAAX/mgMSAAr/mgMSAdD/1wMSAdz/wwMSAd3/1wMSAd//1wMSAeH/1wMSAeT/wwMSAfb/1wMSAgf/mgMSAgv/mgMSAqD/1wMSAqr/wwMSArb/wwMSArz/1wMSAr7/wwMSAsD/1wMSAsL/1wMSAsv/1wMSAtX/1wMSAub/1wMSAvj/1wMSAvr/1wMSAvz/1wMSAv7/1wMSAwb/1wMSAwj/1wMSAw7/mgMSAxD/mgMSAxj/wwMTAAX/mgMTAAr/mgMTAZ3/rgMTAab/rgMTAaj/wwMTAar/wwMTAbD/wwMTAbz/cQMTAb3/wwMTAb//wwMTAcH/wwMTAcT/rgMTAdD/1wMTAdz/wwMTAd//1wMTAeH/1wMTAeT/wwMTAgf/mgMTAgv/mgMTAnL/wwMTAnb/1wMTAnz/wwMTAoD/wwMTAoL/wwMTAp//wwMTAqD/1wMTAqn/rgMTAqr/wwMTArX/cQMTArb/wwMTArf/wwMTArn/wwMTArv/wwMTArz/1wMTAr3/rgMTAr7/wwMTAr//wwMTAsD/1wMTAsH/wwMTAsL/1wMTAsr/wwMTAsv/1wMTAtT/wwMTAtX/1wMTAtn/wwMTAtv/wwMTAt3/wwMTAuX/wwMTAub/1wMTAvf/wwMTAvn/wwMTAvv/wwMTAv3/wwMTAv7/1wMTAwX/wwMTAwb/1wMTAwf/wwMTAwj/1wMTAw3/1wMTAw7/1wMTAw//1wMTAxD/1wMTAxf/rgMTAxj/wwMUAAX/mgMUAAr/mgMUAdD/1wMUAdz/wwMUAd3/1wMUAd//1wMUAeH/1wMUAeT/wwMUAfb/1wMUAgf/mgMUAgv/mgMUAqD/1wMUAqr/wwMUArb/wwMUArz/1wMUAr7/wwMUAsD/1wMUAsL/1wMUAsv/1wMUAtX/1wMUAub/1wMUAvj/1wMUAvr/1wMUAvz/1wMUAv7/1wMUAwb/1wMUAwj/1wMUAw7/mgMUAxD/mgMUAxj/wwMVAA//rgMVABH/rgMVAar/7AMVAbD/1wMVAbz/1wMVAb//1wMVAgj/rgMVAgz/rgMVAnL/7AMVAoD/7AMVAoL/7AMVAp//1wMVArX/1wMVArf/7AMVArn/7AMVArv/1wMVAsr/1wMVAtn/7AMVAtv/7AMVAt3/7AMVAuX/1wMVAwX/1wMVAwf/1wMWAAX/1wMWAAr/1wMWAdD/7AMWAd3/7AMWAd//7AMWAfb/7AMWAgf/1wMWAgv/1wMWAqD/7AMWArz/7AMWAsv/7AMWAub/7AMWAvj/7AMWAvr/7AMWAvz/7AMWAwb/7AMWAwj/7AMWAw7/1wMWAxD/1wMXAAX/rgMXAAr/rgMXAZ3/wwMXAab/wwMXAar/1wMXAbD/1wMXAbz/wwMXAb//1wMXAcH/1wMXAcT/wwMXAdz/1wMXAeT/1wMXAgf/rgMXAgv/rgMXAnL/1wMXAnz/1wMXAoD/1wMXAoL/1wMXAp//1wMXAqn/wwMXAqr/1wMXArX/wwMXArb/1wMXArf/1wMXArn/1wMXArv/1wMXAr3/wwMXAr7/1wMXAr//1wMXAsH/1wMXAsr/1wMXAtT/1wMXAtn/1wMXAtv/1wMXAt3/1wMXAuX/1wMXAv3/1wMXAwX/1wMXAwf/1wMXAw3/1wMXAw//1wMXAxf/wwMXAxj/1wMYAAX/mgMYAAr/mgMYAdD/1wMYAdz/wwMYAd3/1wMYAd//1wMYAeH/1wMYAeT/wwMYAfb/1wMYAgf/mgMYAgv/mgMYAqD/1wMYAqr/wwMYArb/wwMYArz/1wMYAr7/wwMYAsD/1wMYAsL/1wMYAsv/1wMYAtX/1wMYAub/1wMYAvj/1wMYAvr/1wMYAvz/1wMYAv7/1wMYAwb/1wMYAwj/1wMYAw7/mgMYAxD/mgMYAxj/wwMZAeH/1wMZAsD/1wMZAsL/1wMZAtX/1wMZAv7/1wMbAaMA4QMbAuoAKQMbAw7/1wMbAxD/1wMcAAX/7AMcAAr/7AMcAgf/7AMcAgv/7AMdAAX/cQMdAAr/cQMdACb/1wMdACr/1wMdAC0BCgMdADL/1wMdADT/1wMdADf/cQMdADn/rgMdADr/rgMdADz/hQMdAIn/1wMdAJT/1wMdAJX/1wMdAJb/1wMdAJf/1wMdAJj/1wMdAJr/1wMdAJ//hQMdAMj/1wMdAMr/1wMdAMz/1wMdAM7/1wMdAN7/1wMdAOD/1wMdAOL/1wMdAOT/1wMdAQ7/1wMdARD/1wMdARL/1wMdART/1wMdAST/cQMdASb/cQMdATb/rgMdATj/hQMdATr/hQMdAUf/1wMdAfr/rgMdAfz/rgMdAf7/rgMdAgD/hQMdAgf/cQMdAgv/cQMdAl//1wMdA0n/1wMdA0v/1wMdA03/1wMdA0//1wMdA1H/1wMdA1P/1wMdA1X/1wMdA1f/1wMdA1n/1wMdA1v/1wMdA13/1wMdA1//1wMdA2//hQMdA3H/hQMdA3P/hQMdA4//cQMeAAX/7AMeAAr/7AMeAgf/7AMeAgv/7AMfAAX/cQMfAAr/cQMfACb/1wMfACr/1wMfAC0BCgMfADL/1wMfADT/1wMfADf/cQMfADn/rgMfADr/rgMfADz/hQMfAIn/1wMfAJT/1wMfAJX/1wMfAJb/1wMfAJf/1wMfAJj/1wMfAJr/1wMfAJ//hQMfAMj/1wMfAMr/1wMfAMz/1wMfAM7/1wMfAN7/1wMfAOD/1wMfAOL/1wMfAOT/1wMfAQ7/1wMfARD/1wMfARL/1wMfART/1wMfAST/cQMfASb/cQMfATb/rgMfATj/hQMfATr/hQMfAUf/1wMfAfr/rgMfAfz/rgMfAf7/rgMfAgD/hQMfAgf/cQMfAgv/cQMfAl//1wMfA0n/1wMfA0v/1wMfA03/1wMfA0//1wMfA1H/1wMfA1P/1wMfA1X/1wMfA1f/1wMfA1n/1wMfA1v/1wMfA13/1wMfA1//1wMfA2//hQMfA3H/hQMfA3P/hQMfA4//cQMgAAX/7AMgAAr/7AMgAgf/7AMgAgv/7AMhAAX/cQMhAAr/cQMhACb/1wMhACr/1wMhAC0BCgMhADL/1wMhADT/1wMhADf/cQMhADn/rgMhADr/rgMhADz/hQMhAIn/1wMhAJT/1wMhAJX/1wMhAJb/1wMhAJf/1wMhAJj/1wMhAJr/1wMhAJ//hQMhAMj/1wMhAMr/1wMhAMz/1wMhAM7/1wMhAN7/1wMhAOD/1wMhAOL/1wMhAOT/1wMhAQ7/1wMhARD/1wMhARL/1wMhART/1wMhAST/cQMhASb/cQMhATb/rgMhATj/hQMhATr/hQMhAUf/1wMhAfr/rgMhAfz/rgMhAf7/rgMhAgD/hQMhAgf/cQMhAgv/cQMhAl//1wMhA0n/1wMhA0v/1wMhA03/1wMhA0//1wMhA1H/1wMhA1P/1wMhA1X/1wMhA1f/1wMhA1n/1wMhA1v/1wMhA13/1wMhA1//1wMhA2//hQMhA3H/hQMhA3P/hQMhA4//cQMiAAX/7AMiAAr/7AMiAgf/7AMiAgv/7AMjAAX/cQMjAAr/cQMjACb/1wMjACr/1wMjAC0BCgMjADL/1wMjADT/1wMjADf/cQMjADn/rgMjADr/rgMjADz/hQMjAIn/1wMjAJT/1wMjAJX/1wMjAJb/1wMjAJf/1wMjAJj/1wMjAJr/1wMjAJ//hQMjAMj/1wMjAMr/1wMjAMz/1wMjAM7/1wMjAN7/1wMjAOD/1wMjAOL/1wMjAOT/1wMjAQ7/1wMjARD/1wMjARL/1wMjART/1wMjAST/cQMjASb/cQMjATb/rgMjATj/hQMjATr/hQMjAUf/1wMjAfr/rgMjAfz/rgMjAf7/rgMjAgD/hQMjAgf/cQMjAgv/cQMjAl//1wMjA0n/1wMjA0v/1wMjA03/1wMjA0//1wMjA1H/1wMjA1P/1wMjA1X/1wMjA1f/1wMjA1n/1wMjA1v/1wMjA13/1wMjA1//1wMjA2//hQMjA3H/hQMjA3P/hQMjA4//cQMkAAX/7AMkAAr/7AMkAgf/7AMkAgv/7AMlAAX/cQMlAAr/cQMlACb/1wMlACr/1wMlAC0BCgMlADL/1wMlADT/1wMlADf/cQMlADn/rgMlADr/rgMlADz/hQMlAIn/1wMlAJT/1wMlAJX/1wMlAJb/1wMlAJf/1wMlAJj/1wMlAJr/1wMlAJ//hQMlAMj/1wMlAMr/1wMlAMz/1wMlAM7/1wMlAN7/1wMlAOD/1wMlAOL/1wMlAOT/1wMlAQ7/1wMlARD/1wMlARL/1wMlART/1wMlAST/cQMlASb/cQMlATb/rgMlATj/hQMlATr/hQMlAUf/1wMlAfr/rgMlAfz/rgMlAf7/rgMlAgD/hQMlAgf/cQMlAgv/cQMlAl//1wMlA0n/1wMlA0v/1wMlA03/1wMlA0//1wMlA1H/1wMlA1P/1wMlA1X/1wMlA1f/1wMlA1n/1wMlA1v/1wMlA13/1wMlA1//1wMlA2//hQMlA3H/hQMlA3P/hQMlA4//cQMmAAX/7AMmAAr/7AMmAgf/7AMmAgv/7AMnAAX/cQMnAAr/cQMnACb/1wMnACr/1wMnAC0BCgMnADL/1wMnADT/1wMnADf/cQMnADn/rgMnADr/rgMnADz/hQMnAIn/1wMnAJT/1wMnAJX/1wMnAJb/1wMnAJf/1wMnAJj/1wMnAJr/1wMnAJ//hQMnAMj/1wMnAMr/1wMnAMz/1wMnAM7/1wMnAN7/1wMnAOD/1wMnAOL/1wMnAOT/1wMnAQ7/1wMnARD/1wMnARL/1wMnART/1wMnAST/cQMnASb/cQMnATb/rgMnATj/hQMnATr/hQMnAUf/1wMnAfr/rgMnAfz/rgMnAf7/rgMnAgD/hQMnAgf/cQMnAgv/cQMnAl//1wMnA0n/1wMnA0v/1wMnA03/1wMnA0//1wMnA1H/1wMnA1P/1wMnA1X/1wMnA1f/1wMnA1n/1wMnA1v/1wMnA13/1wMnA1//1wMnA2//hQMnA3H/hQMnA3P/hQMnA4//cQMoAAX/7AMoAAr/7AMoAgf/7AMoAgv/7AMpAAX/cQMpAAr/cQMpACb/1wMpACr/1wMpAC0BCgMpADL/1wMpADT/1wMpADf/cQMpADn/rgMpADr/rgMpADz/hQMpAIn/1wMpAJT/1wMpAJX/1wMpAJb/1wMpAJf/1wMpAJj/1wMpAJr/1wMpAJ//hQMpAMj/1wMpAMr/1wMpAMz/1wMpAM7/1wMpAN7/1wMpAOD/1wMpAOL/1wMpAOT/1wMpAQ7/1wMpARD/1wMpARL/1wMpART/1wMpAST/cQMpASb/cQMpATb/rgMpATj/hQMpATr/hQMpAUf/1wMpAfr/rgMpAfz/rgMpAf7/rgMpAgD/hQMpAgf/cQMpAgv/cQMpAl//1wMpA0n/1wMpA0v/1wMpA03/1wMpA0//1wMpA1H/1wMpA1P/1wMpA1X/1wMpA1f/1wMpA1n/1wMpA1v/1wMpA13/1wMpA1//1wMpA2//hQMpA3H/hQMpA3P/hQMpA4//cQMqAAX/7AMqAAr/7AMqAgf/7AMqAgv/7AMrAAX/cQMrAAr/cQMrACb/1wMrACr/1wMrAC0BCgMrADL/1wMrADT/1wMrADf/cQMrADn/rgMrADr/rgMrADz/hQMrAIn/1wMrAJT/1wMrAJX/1wMrAJb/1wMrAJf/1wMrAJj/1wMrAJr/1wMrAJ//hQMrAMj/1wMrAMr/1wMrAMz/1wMrAM7/1wMrAN7/1wMrAOD/1wMrAOL/1wMrAOT/1wMrAQ7/1wMrARD/1wMrARL/1wMrART/1wMrAST/cQMrASb/cQMrATb/rgMrATj/hQMrATr/hQMrAUf/1wMrAfr/rgMrAfz/rgMrAf7/rgMrAgD/hQMrAgf/cQMrAgv/cQMrAl//1wMrA0n/1wMrA0v/1wMrA03/1wMrA0//1wMrA1H/1wMrA1P/1wMrA1X/1wMrA1f/1wMrA1n/1wMrA1v/1wMrA13/1wMrA1//1wMrA2//hQMrA3H/hQMrA3P/hQMrA4//cQMsAAX/7AMsAAr/7AMsAgf/7AMsAgv/7AMtAAX/cQMtAAr/cQMtACb/1wMtACr/1wMtAC0BCgMtADL/1wMtADT/1wMtADf/cQMtADn/rgMtADr/rgMtADz/hQMtAIn/1wMtAJT/1wMtAJX/1wMtAJb/1wMtAJf/1wMtAJj/1wMtAJr/1wMtAJ//hQMtAMj/1wMtAMr/1wMtAMz/1wMtAM7/1wMtAN7/1wMtAOD/1wMtAOL/1wMtAOT/1wMtAQ7/1wMtARD/1wMtARL/1wMtART/1wMtAST/cQMtASb/cQMtATb/rgMtATj/hQMtATr/hQMtAUf/1wMtAfr/rgMtAfz/rgMtAf7/rgMtAgD/hQMtAgf/cQMtAgv/cQMtAl//1wMtA0n/1wMtA0v/1wMtA03/1wMtA0//1wMtA1H/1wMtA1P/1wMtA1X/1wMtA1f/1wMtA1n/1wMtA1v/1wMtA13/1wMtA1//1wMtA2//hQMtA3H/hQMtA3P/hQMtA4//cQMuAAX/7AMuAAr/7AMuAgf/7AMuAgv/7AMvAAX/cQMvAAr/cQMvACb/1wMvACr/1wMvAC0BCgMvADL/1wMvADT/1wMvADf/cQMvADn/rgMvADr/rgMvADz/hQMvAIn/1wMvAJT/1wMvAJX/1wMvAJb/1wMvAJf/1wMvAJj/1wMvAJr/1wMvAJ//hQMvAMj/1wMvAMr/1wMvAMz/1wMvAM7/1wMvAN7/1wMvAOD/1wMvAOL/1wMvAOT/1wMvAQ7/1wMvARD/1wMvARL/1wMvART/1wMvAST/cQMvASb/cQMvATb/rgMvATj/hQMvATr/hQMvAUf/1wMvAfr/rgMvAfz/rgMvAf7/rgMvAgD/hQMvAgf/cQMvAgv/cQMvAl//1wMvA0n/1wMvA0v/1wMvA03/1wMvA0//1wMvA1H/1wMvA1P/1wMvA1X/1wMvA1f/1wMvA1n/1wMvA1v/1wMvA13/1wMvA1//1wMvA2//hQMvA3H/hQMvA3P/hQMvA4//cQMwAAX/7AMwAAr/7AMwAgf/7AMwAgv/7AMxAAX/cQMxAAr/cQMxACb/1wMxACr/1wMxAC0BCgMxADL/1wMxADT/1wMxADf/cQMxADn/rgMxADr/rgMxADz/hQMxAIn/1wMxAJT/1wMxAJX/1wMxAJb/1wMxAJf/1wMxAJj/1wMxAJr/1wMxAJ//hQMxAMj/1wMxAMr/1wMxAMz/1wMxAM7/1wMxAN7/1wMxAOD/1wMxAOL/1wMxAOT/1wMxAQ7/1wMxARD/1wMxARL/1wMxART/1wMxAST/cQMxASb/cQMxATb/rgMxATj/hQMxATr/hQMxAUf/1wMxAfr/rgMxAfz/rgMxAf7/rgMxAgD/hQMxAgf/cQMxAgv/cQMxAl//1wMxA0n/1wMxA0v/1wMxA03/1wMxA0//1wMxA1H/1wMxA1P/1wMxA1X/1wMxA1f/1wMxA1n/1wMxA1v/1wMxA13/1wMxA1//1wMxA2//hQMxA3H/hQMxA3P/hQMxA4//cQMyAAX/7AMyAAr/7AMyAgf/7AMyAgv/7AMzAAX/cQMzAAr/cQMzACb/1wMzACr/1wMzAC0BCgMzADL/1wMzADT/1wMzADf/cQMzADn/rgMzADr/rgMzADz/hQMzAIn/1wMzAJT/1wMzAJX/1wMzAJb/1wMzAJf/1wMzAJj/1wMzAJr/1wMzAJ//hQMzAMj/1wMzAMr/1wMzAMz/1wMzAM7/1wMzAN7/1wMzAOD/1wMzAOL/1wMzAOT/1wMzAQ7/1wMzARD/1wMzARL/1wMzART/1wMzAST/cQMzASb/cQMzATb/rgMzATj/hQMzATr/hQMzAUf/1wMzAfr/rgMzAfz/rgMzAf7/rgMzAgD/hQMzAgf/cQMzAgv/cQMzAl//1wMzA0n/1wMzA0v/1wMzA03/1wMzA0//1wMzA1H/1wMzA1P/1wMzA1X/1wMzA1f/1wMzA1n/1wMzA1v/1wMzA13/1wMzA1//1wMzA2//hQMzA3H/hQMzA3P/hQMzA4//cQM0AAX/7AM0AAr/7AM0Agf/7AM0Agv/7AM1AC0AewM2AAX/7AM2AAr/7AM2AFn/1wM2AFr/1wM2AFv/1wM2AFz/1wM2AF3/7AM2AL//1wM2ATf/1wM2ATz/7AM2AT7/7AM2AUD/7AM2Afv/1wM2Af3/1wM2Agf/7AM2Agv/7AM2A3D/1wM3AC0AewM4AAX/7AM4AAr/7AM4AFn/1wM4AFr/1wM4AFv/1wM4AFz/1wM4AF3/7AM4AL//1wM4ATf/1wM4ATz/7AM4AT7/7AM4AUD/7AM4Afv/1wM4Af3/1wM4Agf/7AM4Agv/7AM4A3D/1wM5AC0AewM6AAX/7AM6AAr/7AM6AFn/1wM6AFr/1wM6AFv/1wM6AFz/1wM6AF3/7AM6AL//1wM6ATf/1wM6ATz/7AM6AT7/7AM6AUD/7AM6Afv/1wM6Af3/1wM6Agf/7AM6Agv/7AM6A3D/1wM7AC0AewM8AAX/7AM8AAr/7AM8AFn/1wM8AFr/1wM8AFv/1wM8AFz/1wM8AF3/7AM8AL//1wM8ATf/1wM8ATz/7AM8AT7/7AM8AUD/7AM8Afv/1wM8Af3/1wM8Agf/7AM8Agv/7AM8A3D/1wM9AC0AewM+AAX/7AM+AAr/7AM+AFn/1wM+AFr/1wM+AFv/1wM+AFz/1wM+AF3/7AM+AL//1wM+ATf/1wM+ATz/7AM+AT7/7AM+AUD/7AM+Afv/1wM+Af3/1wM+Agf/7AM+Agv/7AM+A3D/1wM/AC0AewNAAAX/7ANAAAr/7ANAAFn/1wNAAFr/1wNAAFv/1wNAAFz/1wNAAF3/7ANAAL//1wNAATf/1wNAATz/7ANAAT7/7ANAAUD/7ANAAfv/1wNAAf3/1wNAAgf/7ANAAgv/7ANAA3D/1wNBAC0AewNCAAX/7ANCAAr/7ANCAFn/1wNCAFr/1wNCAFv/1wNCAFz/1wNCAF3/7ANCAL//1wNCATf/1wNCATz/7ANCAT7/7ANCAUD/7ANCAfv/1wNCAf3/1wNCAgf/7ANCAgv/7ANCA3D/1wNDAC0AewNEAAX/7ANEAAr/7ANEAFn/1wNEAFr/1wNEAFv/1wNEAFz/1wNEAF3/7ANEAL//1wNEATf/1wNEATz/7ANEAT7/7ANEAUD/7ANEAfv/1wNEAf3/1wNEAgf/7ANEAgv/7ANEA3D/1wNJAA//rgNJABH/rgNJACT/1wNJADf/wwNJADn/7ANJADr/7ANJADv/1wNJADz/7ANJAD3/7ANJAIL/1wNJAIP/1wNJAIT/1wNJAIX/1wNJAIb/1wNJAIf/1wNJAJ//7ANJAML/1wNJAMT/1wNJAMb/1wNJAST/wwNJASb/wwNJATb/7ANJATj/7ANJATr/7ANJATv/7ANJAT3/7ANJAT//7ANJAUP/1wNJAaD/7ANJAfr/7ANJAfz/7ANJAf7/7ANJAgD/7ANJAgj/rgNJAgz/rgNJAlj/1wNJAx3/1wNJAx//1wNJAyH/1wNJAyP/1wNJAyX/1wNJAyf/1wNJAyn/1wNJAyv/1wNJAy3/1wNJAy//1wNJAzH/1wNJAzP/1wNJA2//7ANJA3H/7ANJA3P/7ANJA4//wwNKAAX/7ANKAAr/7ANKAFn/1wNKAFr/1wNKAFv/1wNKAFz/1wNKAF3/7ANKAL//1wNKATf/1wNKATz/7ANKAT7/7ANKAUD/7ANKAfv/1wNKAf3/1wNKAgf/7ANKAgv/7ANKA3D/1wNLAA//rgNLABH/rgNLACT/1wNLADf/wwNLADn/7ANLADr/7ANLADv/1wNLADz/7ANLAD3/7ANLAIL/1wNLAIP/1wNLAIT/1wNLAIX/1wNLAIb/1wNLAIf/1wNLAJ//7ANLAML/1wNLAMT/1wNLAMb/1wNLAST/wwNLASb/wwNLATb/7ANLATj/7ANLATr/7ANLATv/7ANLAT3/7ANLAT//7ANLAUP/1wNLAaD/7ANLAfr/7ANLAfz/7ANLAf7/7ANLAgD/7ANLAgj/rgNLAgz/rgNLAlj/1wNLAx3/1wNLAx//1wNLAyH/1wNLAyP/1wNLAyX/1wNLAyf/1wNLAyn/1wNLAyv/1wNLAy3/1wNLAy//1wNLAzH/1wNLAzP/1wNLA2//7ANLA3H/7ANLA3P/7ANLA4//wwNMAAX/7ANMAAr/7ANMAFn/1wNMAFr/1wNMAFv/1wNMAFz/1wNMAF3/7ANMAL//1wNMATf/1wNMATz/7ANMAT7/7ANMAUD/7ANMAfv/1wNMAf3/1wNMAgf/7ANMAgv/7ANMA3D/1wNNAA//rgNNABH/rgNNACT/1wNNADf/wwNNADn/7ANNADr/7ANNADv/1wNNADz/7ANNAD3/7ANNAIL/1wNNAIP/1wNNAIT/1wNNAIX/1wNNAIb/1wNNAIf/1wNNAJ//7ANNAML/1wNNAMT/1wNNAMb/1wNNAST/wwNNASb/wwNNATb/7ANNATj/7ANNATr/7ANNATv/7ANNAT3/7ANNAT//7ANNAUP/1wNNAaD/7ANNAfr/7ANNAfz/7ANNAf7/7ANNAgD/7ANNAgj/rgNNAgz/rgNNAlj/1wNNAx3/1wNNAx//1wNNAyH/1wNNAyP/1wNNAyX/1wNNAyf/1wNNAyn/1wNNAyv/1wNNAy3/1wNNAy//1wNNAzH/1wNNAzP/1wNNA2//7ANNA3H/7ANNA3P/7ANNA4//wwNPAA//rgNPABH/rgNPACT/1wNPADf/wwNPADn/7ANPADr/7ANPADv/1wNPADz/7ANPAD3/7ANPAIL/1wNPAIP/1wNPAIT/1wNPAIX/1wNPAIb/1wNPAIf/1wNPAJ//7ANPAML/1wNPAMT/1wNPAMb/1wNPAST/wwNPASb/wwNPATb/7ANPATj/7ANPATr/7ANPATv/7ANPAT3/7ANPAT//7ANPAUP/1wNPAaD/7ANPAfr/7ANPAfz/7ANPAf7/7ANPAgD/7ANPAgj/rgNPAgz/rgNPAlj/1wNPAx3/1wNPAx//1wNPAyH/1wNPAyP/1wNPAyX/1wNPAyf/1wNPAyn/1wNPAyv/1wNPAy3/1wNPAy//1wNPAzH/1wNPAzP/1wNPA2//7ANPA3H/7ANPA3P/7ANPA4//wwNRAA//rgNRABH/rgNRACT/1wNRADf/wwNRADn/7ANRADr/7ANRADv/1wNRADz/7ANRAD3/7ANRAIL/1wNRAIP/1wNRAIT/1wNRAIX/1wNRAIb/1wNRAIf/1wNRAJ//7ANRAML/1wNRAMT/1wNRAMb/1wNRAST/wwNRASb/wwNRATb/7ANRATj/7ANRATr/7ANRATv/7ANRAT3/7ANRAT//7ANRAUP/1wNRAaD/7ANRAfr/7ANRAfz/7ANRAf7/7ANRAgD/7ANRAgj/rgNRAgz/rgNRAlj/1wNRAx3/1wNRAx//1wNRAyH/1wNRAyP/1wNRAyX/1wNRAyf/1wNRAyn/1wNRAyv/1wNRAy3/1wNRAy//1wNRAzH/1wNRAzP/1wNRA2//7ANRA3H/7ANRA3P/7ANRA4//wwNTAA//rgNTABH/rgNTACT/1wNTADf/wwNTADn/7ANTADr/7ANTADv/1wNTADz/7ANTAD3/7ANTAIL/1wNTAIP/1wNTAIT/1wNTAIX/1wNTAIb/1wNTAIf/1wNTAJ//7ANTAML/1wNTAMT/1wNTAMb/1wNTAST/wwNTASb/wwNTATb/7ANTATj/7ANTATr/7ANTATv/7ANTAT3/7ANTAT//7ANTAUP/1wNTAaD/7ANTAfr/7ANTAfz/7ANTAf7/7ANTAgD/7ANTAgj/rgNTAgz/rgNTAlj/1wNTAx3/1wNTAx//1wNTAyH/1wNTAyP/1wNTAyX/1wNTAyf/1wNTAyn/1wNTAyv/1wNTAy3/1wNTAy//1wNTAzH/1wNTAzP/1wNTA2//7ANTA3H/7ANTA3P/7ANTA4//wwNVAA//rgNVABH/rgNVACT/1wNVADf/wwNVADn/7ANVADr/7ANVADv/1wNVADz/7ANVAD3/7ANVAIL/1wNVAIP/1wNVAIT/1wNVAIX/1wNVAIb/1wNVAIf/1wNVAJ//7ANVAML/1wNVAMT/1wNVAMb/1wNVAST/wwNVASb/wwNVATb/7ANVATj/7ANVATr/7ANVATv/7ANVAT3/7ANVAT//7ANVAUP/1wNVAaD/7ANVAfr/7ANVAfz/7ANVAf7/7ANVAgD/7ANVAgj/rgNVAgz/rgNVAlj/1wNVAx3/1wNVAx//1wNVAyH/1wNVAyP/1wNVAyX/1wNVAyf/1wNVAyn/1wNVAyv/1wNVAy3/1wNVAy//1wNVAzH/1wNVAzP/1wNVA2//7ANVA3H/7ANVA3P/7ANVA4//wwNYAEkAUgNYAFcAUgNYAFkAZgNYAFoAZgNYAFsAZgNYAFwAZgNYAL8AZgNYASUAUgNYAScAUgNYATcAZgNYAfsAZgNYAf0AZgNYAjQAUgNYAjUAUgNYAl0AUgNYAl4AUgNYA3AAZgNYA40AUgNYA5AAUgNaAEkAUgNaAFcAUgNaAFkAZgNaAFoAZgNaAFsAZgNaAFwAZgNaAL8AZgNaASUAUgNaAScAUgNaATcAZgNaAfsAZgNaAf0AZgNaAjQAUgNaAjUAUgNaAl0AUgNaAl4AUgNaA3AAZgNaA40AUgNaA5AAUgNcAEkAUgNcAFcAUgNcAFkAZgNcAFoAZgNcAFsAZgNcAFwAZgNcAL8AZgNcASUAUgNcAScAUgNcATcAZgNcAfsAZgNcAf0AZgNcAjQAUgNcAjUAUgNcAl0AUgNcAl4AUgNcA3AAZgNcA40AUgNcA5AAUgNeAEkAUgNeAFcAUgNeAFkAZgNeAFoAZgNeAFsAZgNeAFwAZgNeAL8AZgNeASUAUgNeAScAUgNeATcAZgNeAfsAZgNeAf0AZgNeAjQAUgNeAjUAUgNeAl0AUgNeAl4AUgNeA3AAZgNeA40AUgNeA5AAUgNgAEkAUgNgAFcAUgNgAFkAZgNgAFoAZgNgAFsAZgNgAFwAZgNgAL8AZgNgASUAUgNgAScAUgNgATcAZgNgAfsAZgNgAf0AZgNgAjQAUgNgAjUAUgNgAl0AUgNgAl4AUgNgA3AAZgNgA40AUgNgA5AAUgNhAA//1wNhABH/1wNhACT/7ANhAIL/7ANhAIP/7ANhAIT/7ANhAIX/7ANhAIb/7ANhAIf/7ANhAML/7ANhAMT/7ANhAMb/7ANhAUP/7ANhAgj/1wNhAgz/1wNhAlj/7ANhAx3/7ANhAx//7ANhAyH/7ANhAyP/7ANhAyX/7ANhAyf/7ANhAyn/7ANhAyv/7ANhAy3/7ANhAy//7ANhAzH/7ANhAzP/7ANmAEkAZgNmAFcAZgNmAFkAZgNmAFoAZgNmAFsAZgNmAFwAZgNmAL8AZgNmASUAZgNmAScAZgNmATcAZgNmAfsAZgNmAf0AZgNmAjQAZgNmAjUAZgNmAl0AZgNmAl4AZgNmA3AAZgNmA40AZgNmA5AAZgNoAEkAZgNoAFcAZgNoAFkAZgNoAFoAZgNoAFsAZgNoAFwAZgNoAL8AZgNoASUAZgNoAScAZgNoATcAZgNoAfsAZgNoAf0AZgNoAjQAZgNoAjUAZgNoAl0AZgNoAl4AZgNoA3AAZgNoA40AZgNoA5AAZgNqAEkAZgNqAFcAZgNqAFkAZgNqAFoAZgNqAFsAZgNqAFwAZgNqAL8AZgNqASUAZgNqAScAZgNqATcAZgNqAfsAZgNqAf0AZgNqAjQAZgNqAjUAZgNqAl0AZgNqAl4AZgNqA3AAZgNqA40AZgNqA5AAZgNsAEkAZgNsAFcAZgNsAFkAZgNsAFoAZgNsAFsAZgNsAFwAZgNsAL8AZgNsASUAZgNsAScAZgNsATcAZgNsAfsAZgNsAf0AZgNsAjQAZgNsAjUAZgNsAl0AZgNsAl4AZgNsA3AAZgNsA40AZgNsA5AAZgNuAEkAZgNuAFcAZgNuAFkAZgNuAFoAZgNuAFsAZgNuAFwAZgNuAL8AZgNuASUAZgNuAScAZgNuATcAZgNuAfsAZgNuAf0AZgNuAjQAZgNuAjUAZgNuAl0AZgNuAl4AZgNuA3AAZgNuA40AZgNuA5AAZgNvAA//hQNvABH/hQNvACIAKQNvACT/hQNvACb/1wNvACr/1wNvADL/1wNvADT/1wNvAET/mgNvAEb/mgNvAEf/mgNvAEj/mgNvAEr/1wNvAFD/wwNvAFH/wwNvAFL/mgNvAFP/wwNvAFT/mgNvAFX/wwNvAFb/rgNvAFj/wwNvAF3/1wNvAIL/hQNvAIP/hQNvAIT/hQNvAIX/hQNvAIb/hQNvAIf/hQNvAIn/1wNvAJT/1wNvAJX/1wNvAJb/1wNvAJf/1wNvAJj/1wNvAJr/1wNvAKL/mgNvAKP/mgNvAKT/mgNvAKX/mgNvAKb/mgNvAKf/mgNvAKj/mgNvAKn/mgNvAKr/mgNvAKv/mgNvAKz/mgNvAK3/mgNvALT/mgNvALX/mgNvALb/mgNvALf/mgNvALj/mgNvALr/mgNvALv/wwNvALz/wwNvAL3/wwNvAL7/wwNvAML/hQNvAMP/mgNvAMT/hQNvAMX/mgNvAMb/hQNvAMf/mgNvAMj/1wNvAMn/mgNvAMr/1wNvAMv/mgNvAMz/1wNvAM3/mgNvAM7/1wNvAM//mgNvANH/mgNvANP/mgNvANX/mgNvANf/mgNvANn/mgNvANv/mgNvAN3/mgNvAN7/1wNvAN//1wNvAOD/1wNvAOH/1wNvAOL/1wNvAOP/1wNvAOT/1wNvAOX/1wNvAPr/wwNvAQb/wwNvAQj/wwNvAQ3/wwNvAQ7/1wNvAQ//mgNvARD/1wNvARH/mgNvARL/1wNvARP/mgNvART/1wNvARX/mgNvARf/wwNvARn/wwNvAR3/rgNvASH/rgNvASv/wwNvAS3/wwNvAS//wwNvATH/wwNvATP/wwNvATX/wwNvATz/1wNvAT7/1wNvAUD/1wNvAUP/hQNvAUT/mgNvAUb/mgNvAUf/1wNvAUj/mgNvAUr/rgNvAgj/hQNvAgz/hQNvAlf/wwNvAlj/hQNvAln/mgNvAl//1wNvAmD/mgNvAmL/wwNvAx3/hQNvAx7/mgNvAx//hQNvAyD/mgNvAyH/hQNvAyL/mgNvAyP/hQNvAyX/hQNvAyb/mgNvAyf/hQNvAyj/mgNvAyn/hQNvAyr/mgNvAyv/hQNvAyz/mgNvAy3/hQNvAy7/mgNvAy//hQNvAzD/mgNvAzH/hQNvAzL/mgNvAzP/hQNvAzT/mgNvAzb/mgNvAzj/mgNvAzr/mgNvAzz/mgNvA0D/mgNvA0L/mgNvA0T/mgNvA0n/1wNvA0r/mgNvA0v/1wNvA0z/mgNvA03/1wNvA07/mgNvA0//1wNvA1H/1wNvA1L/mgNvA1P/1wNvA1T/mgNvA1X/1wNvA1b/mgNvA1f/1wNvA1j/mgNvA1n/1wNvA1r/mgNvA1v/1wNvA1z/mgNvA13/1wNvA17/mgNvA1//1wNvA2D/mgNvA2L/wwNvA2T/wwNvA2b/wwNvA2j/wwNvA2r/wwNvA2z/wwNvA27/wwNwAAUAUgNwAAoAUgNwAA//rgNwABH/rgNwACIAKQNwAgcAUgNwAgj/rgNwAgsAUgNwAgz/rgNxAA//hQNxABH/hQNxACIAKQNxACT/hQNxACb/1wNxACr/1wNxADL/1wNxADT/1wNxAET/mgNxAEb/mgNxAEf/mgNxAEj/mgNxAEr/1wNxAFD/wwNxAFH/wwNxAFL/mgNxAFP/wwNxAFT/mgNxAFX/wwNxAFb/rgNxAFj/wwNxAF3/1wNxAIL/hQNxAIP/hQNxAIT/hQNxAIX/hQNxAIb/hQNxAIf/hQNxAIn/1wNxAJT/1wNxAJX/1wNxAJb/1wNxAJf/1wNxAJj/1wNxAJr/1wNxAKL/mgNxAKP/mgNxAKT/mgNxAKX/mgNxAKb/mgNxAKf/mgNxAKj/mgNxAKn/mgNxAKr/mgNxAKv/mgNxAKz/mgNxAK3/mgNxALT/mgNxALX/mgNxALb/mgNxALf/mgNxALj/mgNxALr/mgNxALv/wwNxALz/wwNxAL3/wwNxAL7/wwNxAML/hQNxAMP/mgNxAMT/hQNxAMX/mgNxAMb/hQNxAMf/mgNxAMj/1wNxAMn/mgNxAMr/1wNxAMv/mgNxAMz/1wNxAM3/mgNxAM7/1wNxAM//mgNxANH/mgNxANP/mgNxANX/mgNxANf/mgNxANn/mgNxANv/mgNxAN3/mgNxAN7/1wNxAN//1wNxAOD/1wNxAOH/1wNxAOL/1wNxAOP/1wNxAOT/1wNxAOX/1wNxAPr/wwNxAQb/wwNxAQj/wwNxAQ3/wwNxAQ7/1wNxAQ//mgNxARD/1wNxARH/mgNxARL/1wNxARP/mgNxART/1wNxARX/mgNxARf/wwNxARn/wwNxAR3/rgNxASH/rgNxASv/wwNxAS3/wwNxAS//wwNxATH/wwNxATP/wwNxATX/wwNxATz/1wNxAT7/1wNxAUD/1wNxAUP/hQNxAUT/mgNxAUb/mgNxAUf/1wNxAUj/mgNxAUr/rgNxAgj/hQNxAgz/hQNxAlf/wwNxAlj/hQNxAln/mgNxAl//1wNxAmD/mgNxAmL/wwNxAx3/hQNxAx7/mgNxAx//hQNxAyD/mgNxAyH/hQNxAyL/mgNxAyP/hQNxAyX/hQNxAyb/mgNxAyf/hQNxAyj/mgNxAyn/hQNxAyr/mgNxAyv/hQNxAyz/mgNxAy3/hQNxAy7/mgNxAy//hQNxAzD/mgNxAzH/hQNxAzL/mgNxAzP/hQNxAzT/mgNxAzb/mgNxAzj/mgNxAzr/mgNxAzz/mgNxA0D/mgNxA0L/mgNxA0T/mgNxA0n/1wNxA0r/mgNxA0v/1wNxA0z/mgNxA03/1wNxA07/mgNxA0//1wNxA1H/1wNxA1L/mgNxA1P/1wNxA1T/mgNxA1X/1wNxA1b/mgNxA1f/1wNxA1j/mgNxA1n/1wNxA1r/mgNxA1v/1wNxA1z/mgNxA13/1wNxA17/mgNxA1//1wNxA2D/mgNxA2L/wwNxA2T/wwNxA2b/wwNxA2j/wwNxA2r/wwNxA2z/wwNxA27/wwNyAAUAUgNyAAoAUgNyAA//rgNyABH/rgNyACIAKQNyAgcAUgNyAgj/rgNyAgsAUgNyAgz/rgNzAA//hQNzABH/hQNzACIAKQNzACT/hQNzACb/1wNzACr/1wNzADL/1wNzADT/1wNzAET/mgNzAEb/mgNzAEf/mgNzAEj/mgNzAEr/1wNzAFD/wwNzAFH/wwNzAFL/mgNzAFP/wwNzAFT/mgNzAFX/wwNzAFb/rgNzAFj/wwNzAF3/1wNzAIL/hQNzAIP/hQNzAIT/hQNzAIX/hQNzAIb/hQNzAIf/hQNzAIn/1wNzAJT/1wNzAJX/1wNzAJb/1wNzAJf/1wNzAJj/1wNzAJr/1wNzAKL/mgNzAKP/mgNzAKT/mgNzAKX/mgNzAKb/mgNzAKf/mgNzAKj/mgNzAKn/mgNzAKr/mgNzAKv/mgNzAKz/mgNzAK3/mgNzALT/mgNzALX/mgNzALb/mgNzALf/mgNzALj/mgNzALr/mgNzALv/wwNzALz/wwNzAL3/wwNzAL7/wwNzAML/hQNzAMP/mgNzAMT/hQNzAMX/mgNzAMb/hQNzAMf/mgNzAMj/1wNzAMn/mgNzAMr/1wNzAMv/mgNzAMz/1wNzAM3/mgNzAM7/1wNzAM//mgNzANH/mgNzANP/mgNzANX/mgNzANf/mgNzANn/mgNzANv/mgNzAN3/mgNzAN7/1wNzAN//1wNzAOD/1wNzAOH/1wNzAOL/1wNzAOP/1wNzAOT/1wNzAOX/1wNzAPr/wwNzAQb/wwNzAQj/wwNzAQ3/wwNzAQ7/1wNzAQ//mgNzARD/1wNzARH/mgNzARL/1wNzARP/mgNzART/1wNzARX/mgNzARf/wwNzARn/wwNzAR3/rgNzASH/rgNzASv/wwNzAS3/wwNzAS//wwNzATH/wwNzATP/wwNzATX/wwNzATz/1wNzAT7/1wNzAUD/1wNzAUP/hQNzAUT/mgNzAUb/mgNzAUf/1wNzAUj/mgNzAUr/rgNzAgj/hQNzAgz/hQNzAlf/wwNzAlj/hQNzAln/mgNzAl//1wNzAmD/mgNzAmL/wwNzAx3/hQNzAx7/mgNzAx//hQNzAyD/mgNzAyH/hQNzAyL/mgNzAyP/hQNzAyX/hQNzAyb/mgNzAyf/hQNzAyj/mgNzAyn/hQNzAyr/mgNzAyv/hQNzAyz/mgNzAy3/hQNzAy7/mgNzAy//hQNzAzD/mgNzAzH/hQNzAzL/mgNzAzP/hQNzAzT/mgNzAzb/mgNzAzj/mgNzAzr/mgNzAzz/mgNzA0D/mgNzA0L/mgNzA0T/mgNzA0n/1wNzA0r/mgNzA0v/1wNzA0z/mgNzA03/1wNzA07/mgNzA0//1wNzA1H/1wNzA1L/mgNzA1P/1wNzA1T/mgNzA1X/1wNzA1b/mgNzA1f/1wNzA1j/mgNzA1n/1wNzA1r/mgNzA1v/1wNzA1z/mgNzA13/1wNzA17/mgNzA1//1wNzA2D/mgNzA2L/wwNzA2T/wwNzA2b/wwNzA2j/wwNzA2r/wwNzA2z/wwNzA27/wwN0AAUAUgN0AAoAUgN0AA//rgN0ABH/rgN0ACIAKQN0AgcAUgN0Agj/rgN0AgsAUgN0Agz/rgONAAUAewONAAoAewONAgcAewONAgsAewOPAA//hQOPABD/rgOPABH/hQOPACIAKQOPACT/cQOPACb/1wOPACr/1wOPADL/1wOPADT/1wOPADcAKQOPAET/XAOPAEb/cQOPAEf/cQOPAEj/cQOPAEr/cQOPAFD/mgOPAFH/mgOPAFL/cQOPAFP/mgOPAFT/cQOPAFX/mgOPAFb/hQOPAFj/mgOPAFn/1wOPAFr/1wOPAFv/1wOPAFz/1wOPAF3/rgOPAIL/cQOPAIP/cQOPAIT/cQOPAIX/cQOPAIb/cQOPAIf/cQOPAIn/1wOPAJT/1wOPAJX/1wOPAJb/1wOPAJf/1wOPAJj/1wOPAJr/1wOPAKL/cQOPAKP/XAOPAKT/XAOPAKX/XAOPAKb/XAOPAKf/XAOPAKj/XAOPAKn/cQOPAKr/cQOPAKv/cQOPAKz/cQOPAK3/cQOPALT/cQOPALX/cQOPALb/cQOPALf/cQOPALj/cQOPALr/cQOPALv/mgOPALz/mgOPAL3/mgOPAL7/mgOPAL//1wOPAML/cQOPAMP/XAOPAMT/cQOPAMX/XAOPAMb/cQOPAMf/XAOPAMj/1wOPAMn/cQOPAMr/1wOPAMv/cQOPAMz/1wOPAM3/cQOPAM7/1wOPAM//cQOPANH/cQOPANP/cQOPANX/cQOPANf/cQOPANn/cQOPANv/cQOPAN3/cQOPAN7/1wOPAN//cQOPAOD/1wOPAOH/cQOPAOL/1wOPAOP/cQOPAOT/1wOPAOX/cQOPAPr/mgOPAQb/mgOPAQj/mgOPAQ3/mgOPAQ7/1wOPAQ//cQOPARD/1wOPARH/cQOPARL/1wOPARP/cQOPART/1wOPARX/cQOPARf/mgOPARn/mgOPAR3/hQOPASH/hQOPASQAKQOPASYAKQOPASv/mgOPAS3/mgOPAS//mgOPATH/mgOPATP/mgOPATX/mgOPATf/1wOPATz/rgOPAT7/rgOPAUD/rgOPAUP/cQOPAUT/XAOPAUb/XAOPAUf/1wOPAUj/cQOPAUr/hQOPAfv/1wOPAf3/1wOPAgL/rgOPAgP/rgOPAgT/rgOPAgj/hQOPAgz/hQOPAlf/mgOPAlj/cQOPAln/XAOPAl//1wOPAmD/cQOPAmL/mgOPAx3/cQOPAx7/XAOPAx//cQOPAyD/XAOPAyH/cQOPAyL/XAOPAyP/cQOPAyX/cQOPAyb/XAOPAyf/cQOPAyj/XAOPAyn/cQOPAyr/XAOPAyv/cQOPAyz/XAOPAy3/cQOPAy7/XAOPAy//cQOPAzD/XAOPAzH/cQOPAzL/XAOPAzP/cQOPAzT/XAOPAzb/cQOPAzj/cQOPAzr/cQOPAzz/cQOPA0D/cQOPA0L/cQOPA0T/cQOPA0n/1wOPA0r/cQOPA0v/1wOPA0z/cQOPA03/1wOPA07/cQOPA0//1wOPA1H/1wOPA1L/cQOPA1P/1wOPA1T/cQOPA1X/1wOPA1b/cQOPA1f/1wOPA1j/cQOPA1n/1wOPA1r/cQOPA1v/1wOPA1z/cQOPA13/1wOPA17/cQOPA1//1wOPA2D/cQOPA2L/mgOPA2T/mgOPA2b/mgOPA2j/mgOPA2r/mgOPA2z/mgOPA27/mgOPA3D/1wOPA48AKQOQAAUAKQOQAAoAKQOQAgcAKQOQAgsAKQAAAAAAGgE+AAEAAAAAAAAAOQAAAAEAAAAAAAEACQA5AAEAAAAAAAIABABCAAEAAAAAAAMAIwBGAAEAAAAAAAQADgBRAAEAAAAAAAUADABpAAEAAAAAAAYADQB1AAEAAAAAAAcAUgCCAAEAAAAAAAgAFADUAAEAAAAAAAsAHADoAAEAAAAAAAwALgEEAAEAAAAAAA0ALgEyAAEAAAAAAA4AKgFgAAMAAQQJAAAAcgGKAAMAAQQJAAEAEgH8AAMAAQQJAAIACAIOAAMAAQQJAAMARgIWAAMAAQQJAAQAHAIsAAMAAQQJAAUAGAJcAAMAAQQJAAYAGgJ0AAMAAQQJAAcApAKOAAMAAQQJAAgAKAMyAAMAAQQJAAsAOANaAAMAAQQJAAwAXAOSAAMAAQQJAA0AXAPuAAMAAQQJAA4AVARKRGlnaXRpemVkIGRhdGEgY29weXJpZ2h0IKkgMjAxMC0yMDExLCBHb29nbGUgQ29ycG9yYXRpb24uT3BlbiBTYW5zQm9sZEFzY2VuZGVyIC0gT3BlbiBTYW5zIEJvbGQgQnVpbGQgMTAwVmVyc2lvbiAxLjEwT3BlblNhbnMtQm9sZE9wZW4gU2FucyBpcyBhIHRyYWRlbWFyayBvZiBHb29nbGUgYW5kIG1heSBiZSByZWdpc3RlcmVkIGluIGNlcnRhaW4ganVyaXNkaWN0aW9ucy5Bc2NlbmRlciBDb3Jwb3JhdGlvbmh0dHA6Ly93d3cuYXNjZW5kZXJjb3JwLmNvbS9odHRwOi8vd3d3LmFzY2VuZGVyY29ycC5jb20vdHlwZWRlc2lnbmVycy5odG1sTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMABEAGkAZwBpAHQAaQB6AGUAZAAgAGQAYQB0AGEAIABjAG8AcAB5AHIAaQBnAGgAdAAgAKkAIAAyADAAMQAwAC0AMgAwADEAMQAsACAARwBvAG8AZwBsAGUAIABDAG8AcgBwAG8AcgBhAHQAaQBvAG4ALgBPAHAAZQBuACAAUwBhAG4AcwBCAG8AbABkAEEAcwBjAGUAbgBkAGUAcgAgAC0AIABPAHAAZQBuACAAUwBhAG4AcwAgAEIAbwBsAGQAIABCAHUAaQBsAGQAIAAxADAAMABWAGUAcgBzAGkAbwBuACAAMQAuADEAMABPAHAAZQBuAFMAYQBuAHMALQBCAG8AbABkAE8AcABlAG4AIABTAGEAbgBzACAAaQBzACAAYQAgAHQAcgBhAGQAZQBtAGEAcgBrACAAbwBmACAARwBvAG8AZwBsAGUAIABhAG4AZAAgAG0AYQB5ACAAYgBlACAAcgBlAGcAaQBzAHQAZQByAGUAZAAgAGkAbgAgAGMAZQByAHQAYQBpAG4AIABqAHUAcgBpAHMAZABpAGMAdABpAG8AbgBzAC4AQQBzAGMAZQBuAGQAZQByACAAQwBvAHIAcABvAHIAYQB0AGkAbwBuAGgAdAB0AHAAOgAvAC8AdwB3AHcALgBhAHMAYwBlAG4AZABlAHIAYwBvAHIAcAAuAGMAbwBtAC8AaAB0AHQAcAA6AC8ALwB3AHcAdwAuAGEAcwBjAGUAbgBkAGUAcgBjAG8AcgBwAC4AYwBvAG0ALwB0AHkAcABlAGQAZQBzAGkAZwBuAGUAcgBzAC4AaAB0AG0AbABMAGkAYwBlAG4AcwBlAGQAIAB1AG4AZABlAHIAIAB0AGgAZQAgAEEAcABhAGMAaABlACAATABpAGMAZQBuAHMAZQAsACAAVgBlAHIAcwBpAG8AbgAgADIALgAwAGgAdAB0AHAAOgAvAC8AdwB3AHcALgBhAHAAYQBjAGgAZQAuAG8AcgBnAC8AbABpAGMAZQBuAHMAZQBzAC8ATABJAEMARQBOAFMARQAtADIALgAwAAIAAAAAAAD/ZgBmAAAAAAAAAAAAAAAAAAAAAAAAAAADqgECAQMBBAEFAQYBBwEIAQkBCgELAQwBDQEOAQ8BEAERARIBEwEUARUBFgEXARgBGQEaARsBHAEdAR4BHwEgASEBIgEjASQBJQEmAScBKAEpASoBKwEsAS0BLgEvATABMQEyATMBNAE1ATYBNwE4ATkBOgE7ATwBPQE+AT8BQAFBAUIBQwFEAUUBRgFHAUgBSQFKAUsBTAFNAU4BTwFQAVEBUgFTAVQBVQFWAVcBWAFZAVoBWwFcAV0BXgFfAWABYQFiAWMBZAFlAWYBZwFoAWkBagFrAWwBbQFuAW8BcAFxAXIBcwF0AXUBdgF3AXgBeQF6AXsBfAF9AX4BfwGAAYEBggGDAYQBhQGGAYcBiAGJAYoBiwGMAY0BjgGPAZABkQGSAZMBlAGVAZYBlwGYAZkBmgGbAZwBnQGeAZ8BoAGhAaIBowGkAaUBpgGnAagBqQGqAasBrAGtAa4BrwGwAbEBsgGzAbQBtQG2AbcBuAG5AboBuwG8Ab0BvgG/AcABwQHCAcMBxAHFAcYBxwHIAckBygHLAcwBzQHOAc8B0AHRAdIB0wHUAdUB1gHXAdgB2QHaAdsB3AHdAd4B3wHgAeEB4gHjAeQB5QHmAecB6AHpAeoB6wHsAe0B7gHvAfAB8QHyAfMB9AH1AfYB9wH4AfkB+gH7AfwB/QH+Af8CAAIBAgICAwIEAgUCBgIHAggCCQIKAgsCDAINAg4CDwIQAhECEgITAhQCFQIWAhcCGAIZAhoCGwIcAh0CHgIfAiACIQIiAiMCJAIlAiYCJwIoAikCKgIrAiwCLQIuAi8CMAIxAjICMwI0AjUCNgI3AjgCOQI6AjsCPAI9Aj4CPwJAAkECQgJDAkQCRQJGAkcCSAJJAkoCSwJMAk0CTgJPAlACUQJSAlMCVAJVAlYCVwJYAlkCWgJbAlwCXQJeAl8CYAJhAmICYwJkAmUCZgJnAmgCaQJqAmsCbAJtAm4CbwJwAnECcgJzAnQCdQJ2AncCeAJ5AnoCewJ8An0CfgJ/AoACgQKCAoMChAKFAoYChwKIAokCigKLAowCjQKOAo8CkAKRApICkwKUApUClgKXApgCmQKaApsCnAKdAp4CnwKgAqECogKjAqQCpQKmAqcCqAKpAqoCqwKsAq0CrgKvArACsQKyArMCtAK1ArYCtwK4ArkCugK7ArwCvQK+Ar8CwALBAsICwwLEAsUCxgLHAsgCyQLKAssCzALNAs4CzwLQAtEC0gLTAtQC1QLWAtcC2ALZAtoC2wLcAt0C3gLfAuAC4QLiAuMC5ALlAuYC5wLoAukC6gLrAuwC7QLuAu8C8ALxAvIC8wL0AvUC9gL3AvgC+QL6AvsC/AL9Av4C/wMAAwEDAgMDAwQDBQMGAwcDCAMJAwoDCwMMAw0DDgMPAxADEQMSAxMDFAMVAxYDFwMYAxkDGgMbAxwDHQMeAx8DIAMhAyIDIwMkAyUDJgMnAygDKQMqAysDLAMtAy4DLwMwAzEDMgMzAzQDNQM2AzcDOAM5AzoDOwM8Az0DPgM/A0ADQQNCA0MDRANFA0YDRwNIA0kDSgNLA0wDTQNOA08DUANRA1IDUwNUA1UDVgNXA1gDWQNaA1sDXANdA14DXwNgA2EDYgNjA2QDZQNmA2cDaANpA2oDawNsA20DbgNvA3ADcQNyA3MDdAN1A3YDdwN4A3kDegN7A3wDfQN+A38DgAOBA4IDgwOEA4UDhgOHA4gDiQOKA4sDjAONA44DjwOQA5EDkgOTA5QDlQOWA5cDmAOZA5oDmwOcA50DngOfA6ADoQOiA6MDpAOlA6YDpwOoA6kDqgOrA6wDrQOuA68DsAOxA7IDswO0A7UDtgO3A7gDuQO6A7sDvAO9A74DvwPAA8EDwgPDA8QDxQPGA8cDyAPJA8oDywPMA80DzgPPA9AD0QPSA9MD1APVA9YD1wPYA9kD2gPbA9wD3QPeA98D4APhA+ID4wPkA+UD5gPnA+gD6QPqA+sD7APtA+4D7wPwA/ED8gPzA/QD9QP2A/cD+AP5A/oD+wP8A/0D/gP/BAAEAQQCBAMEBAQFBAYEBwQIBAkECgQLBAwEDQQOBA8EEAQRBBIEEwQUBBUEFgQXBBgEGQQaBBsEHAQdBB4EHwQgBCEEIgQjBCQEJQQmBCcEKAQpBCoEKwQsBC0ELgQvBDAEMQQyBDMENAQ1BDYENwQ4BDkEOgQ7BDwEPQQ+BD8EQARBBEIEQwREBEUERgRHBEgESQRKBEsETARNBE4ETwRQBFEEUgRTBFQEVQRWBFcEWARZBFoEWwRcBF0EXgRfBGAEYQRiBGMEZARlBGYEZwRoBGkEagRrBGwEbQRuBG8EcARxBHIEcwR0BHUEdgR3BHgEeQR6BHsEfAR9BH4EfwSABIEEggSDBIQEhQSGBIcEiASJBIoEiwSMBI0EjgSPBJAEkQSSBJMElASVBJYElwSYBJkEmgSbBJwEnQSeBJ8EoAShBKIEowSkBKUEpgSnBKgEqQSqBKsHLm5vdGRlZgRudWxsEG5vbm1hcmtpbmdyZXR1cm4Fc3BhY2UGZXhjbGFtCHF1b3RlZGJsCm51bWJlcnNpZ24GZG9sbGFyB3BlcmNlbnQJYW1wZXJzYW5kC3F1b3Rlc2luZ2xlCXBhcmVubGVmdApwYXJlbnJpZ2h0CGFzdGVyaXNrBHBsdXMFY29tbWEGaHlwaGVuBnBlcmlvZAVzbGFzaAR6ZXJvA29uZQN0d28FdGhyZWUEZm91cgRmaXZlA3NpeAVzZXZlbgVlaWdodARuaW5lBWNvbG9uCXNlbWljb2xvbgRsZXNzBWVxdWFsB2dyZWF0ZXIIcXVlc3Rpb24CYXQBQQFCAUMBRAFFAUYBRwFIBUkuYWx0AUoBSwFMAU0BTgFPAVABUQFSAVMBVAFVAVYBVwFYAVkBWgticmFja2V0bGVmdAliYWNrc2xhc2gMYnJhY2tldHJpZ2h0C2FzY2lpY2lyY3VtCnVuZGVyc2NvcmUFZ3JhdmUBYQFiAWMBZAFlAWYBZwFoAWkBagFrAWwBbQFuAW8BcAFxAXIBcwF0AXUBdgF3AXgBeQF6CWJyYWNlbGVmdANiYXIKYnJhY2VyaWdodAphc2NpaXRpbGRlEG5vbmJyZWFraW5nc3BhY2UKZXhjbGFtZG93bgRjZW50CHN0ZXJsaW5nCGN1cnJlbmN5A3llbglicm9rZW5iYXIHc2VjdGlvbghkaWVyZXNpcwljb3B5cmlnaHQLb3JkZmVtaW5pbmUNZ3VpbGxlbW90bGVmdApsb2dpY2Fsbm90B3VuaTAwQUQKcmVnaXN0ZXJlZAlvdmVyc2NvcmUGZGVncmVlCXBsdXNtaW51cwt0d29zdXBlcmlvcg10aHJlZXN1cGVyaW9yBWFjdXRlAm11CXBhcmFncmFwaA5wZXJpb2RjZW50ZXJlZAdjZWRpbGxhC29uZXN1cGVyaW9yDG9yZG1hc2N1bGluZQ5ndWlsbGVtb3RyaWdodApvbmVxdWFydGVyB29uZWhhbGYNdGhyZWVxdWFydGVycwxxdWVzdGlvbmRvd24GQWdyYXZlBkFhY3V0ZQtBY2lyY3VtZmxleAZBdGlsZGUJQWRpZXJlc2lzBUFyaW5nAkFFCENjZWRpbGxhBkVncmF2ZQZFYWN1dGULRWNpcmN1bWZsZXgJRWRpZXJlc2lzCklncmF2ZS5hbHQKSWFjdXRlLmFsdA9JY2lyY3VtZmxleC5hbHQNSWRpZXJlc2lzLmFsdANFdGgGTnRpbGRlBk9ncmF2ZQZPYWN1dGULT2NpcmN1bWZsZXgGT3RpbGRlCU9kaWVyZXNpcwhtdWx0aXBseQZPc2xhc2gGVWdyYXZlBlVhY3V0ZQtVY2lyY3VtZmxleAlVZGllcmVzaXMGWWFjdXRlBVRob3JuCmdlcm1hbmRibHMGYWdyYXZlBmFhY3V0ZQthY2lyY3VtZmxleAZhdGlsZGUJYWRpZXJlc2lzBWFyaW5nAmFlCGNjZWRpbGxhBmVncmF2ZQZlYWN1dGULZWNpcmN1bWZsZXgJZWRpZXJlc2lzBmlncmF2ZQZpYWN1dGULaWNpcmN1bWZsZXgJaWRpZXJlc2lzA2V0aAZudGlsZGUGb2dyYXZlBm9hY3V0ZQtvY2lyY3VtZmxleAZvdGlsZGUJb2RpZXJlc2lzBmRpdmlkZQZvc2xhc2gGdWdyYXZlBnVhY3V0ZQt1Y2lyY3VtZmxleAl1ZGllcmVzaXMGeWFjdXRlBXRob3JuCXlkaWVyZXNpcwdBbWFjcm9uB2FtYWNyb24GQWJyZXZlBmFicmV2ZQdBb2dvbmVrB2FvZ29uZWsGQ2FjdXRlBmNhY3V0ZQtDY2lyY3VtZmxleAtjY2lyY3VtZmxleARDZG90BGNkb3QGQ2Nhcm9uBmNjYXJvbgZEY2Fyb24GZGNhcm9uBkRjcm9hdAZkY3JvYXQHRW1hY3JvbgdlbWFjcm9uBkVicmV2ZQZlYnJldmUKRWRvdGFjY2VudAplZG90YWNjZW50B0VvZ29uZWsHZW9nb25lawZFY2Fyb24GZWNhcm9uC0djaXJjdW1mbGV4C2djaXJjdW1mbGV4BkdicmV2ZQZnYnJldmUER2RvdARnZG90DEdjb21tYWFjY2VudAxnY29tbWFhY2NlbnQLSGNpcmN1bWZsZXgLaGNpcmN1bWZsZXgESGJhcgRoYmFyCkl0aWxkZS5hbHQGaXRpbGRlC0ltYWNyb24uYWx0B2ltYWNyb24KSWJyZXZlLmFsdAZpYnJldmULSW9nb25lay5hbHQHaW9nb25law5JZG90YWNjZW50LmFsdAhkb3RsZXNzaQZJSi5hbHQCaWoLSmNpcmN1bWZsZXgLamNpcmN1bWZsZXgMS2NvbW1hYWNjZW50DGtjb21tYWFjY2VudAxrZ3JlZW5sYW5kaWMGTGFjdXRlBmxhY3V0ZQxMY29tbWFhY2NlbnQMbGNvbW1hYWNjZW50BkxjYXJvbgZsY2Fyb24ETGRvdARsZG90BkxzbGFzaAZsc2xhc2gGTmFjdXRlBm5hY3V0ZQxOY29tbWFhY2NlbnQMbmNvbW1hYWNjZW50Bk5jYXJvbgZuY2Fyb24LbmFwb3N0cm9waGUDRW5nA2VuZwdPbWFjcm9uB29tYWNyb24GT2JyZXZlBm9icmV2ZQ1PaHVuZ2FydW1sYXV0DW9odW5nYXJ1bWxhdXQCT0UCb2UGUmFjdXRlBnJhY3V0ZQxSY29tbWFhY2NlbnQMcmNvbW1hYWNjZW50BlJjYXJvbgZyY2Fyb24GU2FjdXRlBnNhY3V0ZQtTY2lyY3VtZmxleAtzY2lyY3VtZmxleAhTY2VkaWxsYQhzY2VkaWxsYQZTY2Fyb24Gc2Nhcm9uDFRjb21tYWFjY2VudAx0Y29tbWFhY2NlbnQGVGNhcm9uBnRjYXJvbgRUYmFyBHRiYXIGVXRpbGRlBnV0aWxkZQdVbWFjcm9uB3VtYWNyb24GVWJyZXZlBnVicmV2ZQVVcmluZwV1cmluZw1VaHVuZ2FydW1sYXV0DXVodW5nYXJ1bWxhdXQHVW9nb25lawd1b2dvbmVrC1djaXJjdW1mbGV4C3djaXJjdW1mbGV4C1ljaXJjdW1mbGV4C3ljaXJjdW1mbGV4CVlkaWVyZXNpcwZaYWN1dGUGemFjdXRlClpkb3RhY2NlbnQKemRvdGFjY2VudAZaY2Fyb24GemNhcm9uBWxvbmdzBmZsb3JpbgpBcmluZ2FjdXRlCmFyaW5nYWN1dGUHQUVhY3V0ZQdhZWFjdXRlC09zbGFzaGFjdXRlC29zbGFzaGFjdXRlDFNjb21tYWFjY2VudAxzY29tbWFhY2NlbnQKY2lyY3VtZmxleAVjYXJvbgZtYWNyb24FYnJldmUJZG90YWNjZW50BHJpbmcGb2dvbmVrBXRpbGRlDGh1bmdhcnVtbGF1dAV0b25vcw1kaWVyZXNpc3Rvbm9zCkFscGhhdG9ub3MJYW5vdGVsZWlhDEVwc2lsb250b25vcwhFdGF0b25vcw1Jb3RhdG9ub3MuYWx0DE9taWNyb250b25vcwxVcHNpbG9udG9ub3MKT21lZ2F0b25vcxFpb3RhZGllcmVzaXN0b25vcwVBbHBoYQRCZXRhBUdhbW1hB3VuaTAzOTQHRXBzaWxvbgRaZXRhA0V0YQVUaGV0YQhJb3RhLmFsdAVLYXBwYQZMYW1iZGECTXUCTnUCWGkHT21pY3JvbgJQaQNSaG8FU2lnbWEDVGF1B1Vwc2lsb24DUGhpA0NoaQNQc2kHdW5pMDNBORBJb3RhZGllcmVzaXMuYWx0D1Vwc2lsb25kaWVyZXNpcwphbHBoYXRvbm9zDGVwc2lsb250b25vcwhldGF0b25vcwlpb3RhdG9ub3MUdXBzaWxvbmRpZXJlc2lzdG9ub3MFYWxwaGEEYmV0YQVnYW1tYQVkZWx0YQdlcHNpbG9uBHpldGEDZXRhBXRoZXRhBGlvdGEFa2FwcGEGbGFtYmRhB3VuaTAzQkMCbnUCeGkHb21pY3JvbgJwaQNyaG8Gc2lnbWExBXNpZ21hA3RhdQd1cHNpbG9uA3BoaQNjaGkDcHNpBW9tZWdhDGlvdGFkaWVyZXNpcw91cHNpbG9uZGllcmVzaXMMb21pY3JvbnRvbm9zDHVwc2lsb250b25vcwpvbWVnYXRvbm9zCWFmaWkxMDAyMwlhZmlpMTAwNTEJYWZpaTEwMDUyCWFmaWkxMDA1MwlhZmlpMTAwNTQNYWZpaTEwMDU1LmFsdA1hZmlpMTAwNTYuYWx0CWFmaWkxMDA1NwlhZmlpMTAwNTgJYWZpaTEwMDU5CWFmaWkxMDA2MAlhZmlpMTAwNjEJYWZpaTEwMDYyCWFmaWkxMDE0NQlhZmlpMTAwMTcJYWZpaTEwMDE4CWFmaWkxMDAxOQlhZmlpMTAwMjAJYWZpaTEwMDIxCWFmaWkxMDAyMglhZmlpMTAwMjQJYWZpaTEwMDI1CWFmaWkxMDAyNglhZmlpMTAwMjcJYWZpaTEwMDI4CWFmaWkxMDAyOQlhZmlpMTAwMzAJYWZpaTEwMDMxCWFmaWkxMDAzMglhZmlpMTAwMzMJYWZpaTEwMDM0CWFmaWkxMDAzNQlhZmlpMTAwMzYJYWZpaTEwMDM3CWFmaWkxMDAzOAlhZmlpMTAwMzkJYWZpaTEwMDQwCWFmaWkxMDA0MQlhZmlpMTAwNDIJYWZpaTEwMDQzCWFmaWkxMDA0NAlhZmlpMTAwNDUJYWZpaTEwMDQ2CWFmaWkxMDA0NwlhZmlpMTAwNDgJYWZpaTEwMDQ5CWFmaWkxMDA2NQlhZmlpMTAwNjYJYWZpaTEwMDY3CWFmaWkxMDA2OAlhZmlpMTAwNjkJYWZpaTEwMDcwCWFmaWkxMDA3MglhZmlpMTAwNzMJYWZpaTEwMDc0CWFmaWkxMDA3NQlhZmlpMTAwNzYJYWZpaTEwMDc3CWFmaWkxMDA3OAlhZmlpMTAwNzkJYWZpaTEwMDgwCWFmaWkxMDA4MQlhZmlpMTAwODIJYWZpaTEwMDgzCWFmaWkxMDA4NAlhZmlpMTAwODUJYWZpaTEwMDg2CWFmaWkxMDA4NwlhZmlpMTAwODgJYWZpaTEwMDg5CWFmaWkxMDA5MAlhZmlpMTAwOTEJYWZpaTEwMDkyCWFmaWkxMDA5MwlhZmlpMTAwOTQJYWZpaTEwMDk1CWFmaWkxMDA5NglhZmlpMTAwOTcJYWZpaTEwMDcxCWFmaWkxMDA5OQlhZmlpMTAxMDAJYWZpaTEwMTAxCWFmaWkxMDEwMglhZmlpMTAxMDMJYWZpaTEwMTA0CWFmaWkxMDEwNQlhZmlpMTAxMDYJYWZpaTEwMTA3CWFmaWkxMDEwOAlhZmlpMTAxMDkJYWZpaTEwMTEwCWFmaWkxMDE5MwlhZmlpMTAwNTAJYWZpaTEwMDk4BldncmF2ZQZ3Z3JhdmUGV2FjdXRlBndhY3V0ZQlXZGllcmVzaXMJd2RpZXJlc2lzBllncmF2ZQZ5Z3JhdmUGZW5kYXNoBmVtZGFzaAlhZmlpMDAyMDgNdW5kZXJzY29yZWRibAlxdW90ZWxlZnQKcXVvdGVyaWdodA5xdW90ZXNpbmdsYmFzZQ1xdW90ZXJldmVyc2VkDHF1b3RlZGJsbGVmdA1xdW90ZWRibHJpZ2h0DHF1b3RlZGJsYmFzZQZkYWdnZXIJZGFnZ2VyZGJsBmJ1bGxldAhlbGxpcHNpcwtwZXJ0aG91c2FuZAZtaW51dGUGc2Vjb25kDWd1aWxzaW5nbGxlZnQOZ3VpbHNpbmdscmlnaHQJZXhjbGFtZGJsCGZyYWN0aW9uCW5zdXBlcmlvcgVmcmFuYwlhZmlpMDg5NDEGcGVzZXRhBEV1cm8JYWZpaTYxMjQ4CWFmaWk2MTI4OQlhZmlpNjEzNTIJdHJhZGVtYXJrBU9tZWdhCWVzdGltYXRlZAlvbmVlaWdodGgMdGhyZWVlaWdodGhzC2ZpdmVlaWdodGhzDHNldmVuZWlnaHRocwtwYXJ0aWFsZGlmZgVEZWx0YQdwcm9kdWN0CXN1bW1hdGlvbgVtaW51cwdyYWRpY2FsCGluZmluaXR5CGludGVncmFsC2FwcHJveGVxdWFsCG5vdGVxdWFsCWxlc3NlcXVhbAxncmVhdGVyZXF1YWwHbG96ZW5nZQd1bmlGQjAxB3VuaUZCMDINY3lyaWxsaWNicmV2ZQhkb3RsZXNzahBjYXJvbmNvbW1hYWNjZW50C2NvbW1hYWNjZW50EWNvbW1hYWNjZW50cm90YXRlDHplcm9zdXBlcmlvcgxmb3Vyc3VwZXJpb3IMZml2ZXN1cGVyaW9yC3NpeHN1cGVyaW9yDXNldmVuc3VwZXJpb3INZWlnaHRzdXBlcmlvcgxuaW5lc3VwZXJpb3IHdW5pMjAwMAd1bmkyMDAxB3VuaTIwMDIHdW5pMjAwMwd1bmkyMDA0B3VuaTIwMDUHdW5pMjAwNgd1bmkyMDA3B3VuaTIwMDgHdW5pMjAwOQd1bmkyMDBBB3VuaTIwMEIHdW5pRkVGRgd1bmlGRkZDB3VuaUZGRkQHdW5pMDFGMAd1bmkwMkJDB3VuaTAzRDEHdW5pMDNEMgd1bmkwM0Q2B3VuaTFFM0UHdW5pMUUzRgd1bmkxRTAwB3VuaTFFMDEHdW5pMUY0RAd1bmkwMkYzCWRhc2lhb3hpYQd1bmlGQjAzB3VuaUZCMDQFT2hvcm4Fb2hvcm4FVWhvcm4FdWhvcm4HdW5pMDMwMAd1bmkwMzAxB3VuaTAzMDMEaG9vawhkb3RiZWxvdwd1bmkwNDAwB3VuaTA0MEQHdW5pMDQ1MAd1bmkwNDVEB3VuaTA0NjAHdW5pMDQ2MQd1bmkwNDYyB3VuaTA0NjMHdW5pMDQ2NAd1bmkwNDY1B3VuaTA0NjYHdW5pMDQ2Nwd1bmkwNDY4B3VuaTA0NjkHdW5pMDQ2QQd1bmkwNDZCB3VuaTA0NkMHdW5pMDQ2RAd1bmkwNDZFB3VuaTA0NkYHdW5pMDQ3MAd1bmkwNDcxB3VuaTA0NzIHdW5pMDQ3Mwd1bmkwNDc0B3VuaTA0NzUHdW5pMDQ3Ngd1bmkwNDc3B3VuaTA0NzgHdW5pMDQ3OQd1bmkwNDdBB3VuaTA0N0IHdW5pMDQ3Qwd1bmkwNDdEB3VuaTA0N0UHdW5pMDQ3Rgd1bmkwNDgwB3VuaTA0ODEHdW5pMDQ4Mgd1bmkwNDgzB3VuaTA0ODQHdW5pMDQ4NQd1bmkwNDg2B3VuaTA0ODgHdW5pMDQ4OQd1bmkwNDhBB3VuaTA0OEIHdW5pMDQ4Qwd1bmkwNDhEB3VuaTA0OEUHdW5pMDQ4Rgd1bmkwNDkyB3VuaTA0OTMHdW5pMDQ5NAd1bmkwNDk1B3VuaTA0OTYHdW5pMDQ5Nwd1bmkwNDk4B3VuaTA0OTkHdW5pMDQ5QQd1bmkwNDlCB3VuaTA0OUMHdW5pMDQ5RAd1bmkwNDlFB3VuaTA0OUYHdW5pMDRBMAd1bmkwNEExB3VuaTA0QTIHdW5pMDRBMwd1bmkwNEE0B3VuaTA0QTUHdW5pMDRBNgd1bmkwNEE3B3VuaTA0QTgHdW5pMDRBOQd1bmkwNEFBB3VuaTA0QUIHdW5pMDRBQwd1bmkwNEFEB3VuaTA0QUUHdW5pMDRBRgd1bmkwNEIwB3VuaTA0QjEHdW5pMDRCMgd1bmkwNEIzB3VuaTA0QjQHdW5pMDRCNQd1bmkwNEI2B3VuaTA0QjcHdW5pMDRCOAd1bmkwNEI5B3VuaTA0QkEHdW5pMDRCQgd1bmkwNEJDB3VuaTA0QkQHdW5pMDRCRQd1bmkwNEJGC3VuaTA0QzAuYWx0B3VuaTA0QzEHdW5pMDRDMgd1bmkwNEMzB3VuaTA0QzQHdW5pMDRDNQd1bmkwNEM2B3VuaTA0QzcHdW5pMDRDOAd1bmkwNEM5B3VuaTA0Q0EHdW5pMDRDQgd1bmkwNENDB3VuaTA0Q0QHdW5pMDRDRQt1bmkwNENGLmFsdAd1bmkwNEQwB3VuaTA0RDEHdW5pMDREMgd1bmkwNEQzB3VuaTA0RDQHdW5pMDRENQd1bmkwNEQ2B3VuaTA0RDcHdW5pMDREOAd1bmkwNEQ5B3VuaTA0REEHdW5pMDREQgd1bmkwNERDB3VuaTA0REQHdW5pMDRERQd1bmkwNERGB3VuaTA0RTAHdW5pMDRFMQd1bmkwNEUyB3VuaTA0RTMHdW5pMDRFNAd1bmkwNEU1B3VuaTA0RTYHdW5pMDRFNwd1bmkwNEU4B3VuaTA0RTkHdW5pMDRFQQd1bmkwNEVCB3VuaTA0RUMHdW5pMDRFRAd1bmkwNEVFB3VuaTA0RUYHdW5pMDRGMAd1bmkwNEYxB3VuaTA0RjIHdW5pMDRGMwd1bmkwNEY0B3VuaTA0RjUHdW5pMDRGNgd1bmkwNEY3B3VuaTA0RjgHdW5pMDRGOQd1bmkwNEZBB3VuaTA0RkIHdW5pMDRGQwd1bmkwNEZEB3VuaTA0RkUHdW5pMDRGRgd1bmkwNTAwB3VuaTA1MDEHdW5pMDUwMgd1bmkwNTAzB3VuaTA1MDQHdW5pMDUwNQd1bmkwNTA2B3VuaTA1MDcHdW5pMDUwOAd1bmkwNTA5B3VuaTA1MEEHdW5pMDUwQgd1bmkwNTBDB3VuaTA1MEQHdW5pMDUwRQd1bmkwNTBGB3VuaTA1MTAHdW5pMDUxMQd1bmkwNTEyB3VuaTA1MTMHdW5pMUVBMAd1bmkxRUExB3VuaTFFQTIHdW5pMUVBMwd1bmkxRUE0B3VuaTFFQTUHdW5pMUVBNgd1bmkxRUE3B3VuaTFFQTgHdW5pMUVBOQd1bmkxRUFBB3VuaTFFQUIHdW5pMUVBQwd1bmkxRUFEB3VuaTFFQUUHdW5pMUVBRgd1bmkxRUIwB3VuaTFFQjEHdW5pMUVCMgd1bmkxRUIzB3VuaTFFQjQHdW5pMUVCNQd1bmkxRUI2B3VuaTFFQjcHdW5pMUVCOAd1bmkxRUI5B3VuaTFFQkEHdW5pMUVCQgd1bmkxRUJDB3VuaTFFQkQHdW5pMUVCRQd1bmkxRUJGB3VuaTFFQzAHdW5pMUVDMQd1bmkxRUMyB3VuaTFFQzMHdW5pMUVDNAd1bmkxRUM1B3VuaTFFQzYHdW5pMUVDNwt1bmkxRUM4LmFsdAd1bmkxRUM5C3VuaTFFQ0EuYWx0B3VuaTFFQ0IHdW5pMUVDQwd1bmkxRUNEB3VuaTFFQ0UHdW5pMUVDRgd1bmkxRUQwB3VuaTFFRDEHdW5pMUVEMgd1bmkxRUQzB3VuaTFFRDQHdW5pMUVENQd1bmkxRUQ2B3VuaTFFRDcHdW5pMUVEOAd1bmkxRUQ5B3VuaTFFREEHdW5pMUVEQgd1bmkxRURDB3VuaTFFREQHdW5pMUVERQd1bmkxRURGB3VuaTFFRTAHdW5pMUVFMQd1bmkxRUUyB3VuaTFFRTMHdW5pMUVFNAd1bmkxRUU1B3VuaTFFRTYHdW5pMUVFNwd1bmkxRUU4B3VuaTFFRTkHdW5pMUVFQQd1bmkxRUVCB3VuaTFFRUMHdW5pMUVFRAd1bmkxRUVFB3VuaTFFRUYHdW5pMUVGMAd1bmkxRUYxB3VuaTFFRjQHdW5pMUVGNQd1bmkxRUY2B3VuaTFFRjcHdW5pMUVGOAd1bmkxRUY5B3VuaTIwQUIHdW5pMDMwRhNjaXJjdW1mbGV4YWN1dGVjb21iE2NpcmN1bWZsZXhncmF2ZWNvbWISY2lyY3VtZmxleGhvb2tjb21iE2NpcmN1bWZsZXh0aWxkZWNvbWIOYnJldmVhY3V0ZWNvbWIOYnJldmVncmF2ZWNvbWINYnJldmVob29rY29tYg5icmV2ZXRpbGRlY29tYhBjeXJpbGxpY2hvb2tsZWZ0EWN5cmlsbGljYmlnaG9va1VDEWN5cmlsbGljYmlnaG9va0xDCG9uZS5wbnVtB3plcm8ub3MGb25lLm9zBnR3by5vcwh0aHJlZS5vcwdmb3VyLm9zB2ZpdmUub3MGc2l4Lm9zCHNldmVuLm9zCGVpZ2h0Lm9zB25pbmUub3MCZmYHdW5pMjEyMAhUY2VkaWxs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","base64");

function text(message, options) {
	const { font, offsetX, paddingX, paddingY, fontSize } = options;

	var scaleFactor = fontSize / font.unitsPerEm;
	var heightInUnits = font.charToGlyph('E');
	heightInUnits.getPath();
	heightInUnits = heightInUnits.yMax;
	var heightInPixels = Math.round(heightInUnits * scaleFactor);

	var widthInUnits = font
		.stringToGlyphs(message)
		.reduce((w, glyph) => w + glyph.advanceWidth, 0);
	var widthInPixels = Math.round(widthInUnits * scaleFactor);
	var textPath = font
		.getPath(message, paddingX + offsetX, heightInPixels + paddingY, fontSize)
		.toSVG(1)
		.replace(/\.0 /g, ' '); //Pack it tighter by removing unused decimal places

	return {
		width: (paddingX * 2) + widthInPixels,
		height: (paddingY * 2) + heightInPixels,
		textPath: textPath
	};
}

module.exports = function badgeit(options = {}) {
	return new Promise(function(resolve, reject) {
		let font;

		if (options.text && options.text.length !== 2) {
			return reject(new Error('text should contain an array of two string elements'));
		}

		if (options.fontPath) {
			try {
				font = opentype.loadSync(options.fontPath);
			} catch(ex) {
				return reject(new Error('font could not be loaded'));
			}
		} else {
			const fontBuffer = defaultFont.buffer.slice(defaultFont.byteOffset, defaultFont.byteOffset + defaultFont.byteLength);
			font = opentype.parse(fontBuffer);
		}

		const values = defaults(options, {
			font,
			text: ['Hello', 'World'],
			fontSize: 11,
			colors: {
				left: '#555',
				right: '#4c1',
				font: '#fff',
				shadow: '#010101'
			},
			paddingX: 6,
			paddingY: 6,
			offsetX: 0
		});

		const rightText = text(values.text[0], values);
		const leftText = text(values.text[1], Object.assign(values, {
			offsetX: rightText.width,
		}));

		const width = rightText.width + leftText.width;
		const height = rightText.height;

		return resolve(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}">
          <defs>
              <linearGradient id="glow" x2="0" y2="100%">
                  <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
                  <stop offset="1" stop-opacity=".1"/>
              </linearGradient>
              <mask id="mask">
                  <rect width="${width}" height="${height}" rx="3" fill="#fff"/>
              </mask>
              <g id="text">
                  ${rightText.textPath}
                  ${leftText.textPath}
              </g>
          </defs>

          <g mask="url(#mask)">
              <rect fill="${values.colors.left}" x="0" y="0" width="${rightText.width}" height="${height}"/>
              <rect fill="${values.colors.right}" x="${rightText.width}" y="0" width="${width}" height="${height}"/>
              <rect fill="url(#glow)" x="0" y="0" width="${width}" height="${height}"/>
          </g>
          <g fill="${values.colors.font}">
              <use x="0" y="1" fill="${values.colors.shadow}" fill-opacity=".3" xlink:href="#text"/>
              <use x="0" y="0" xlink:href="#text"/>
          </g>
      </svg>`);
	});
};

}).call(this,require("buffer").Buffer)
},{"buffer":3,"lodash.defaultsdeep":5,"opentype.js":6}]},{},[]);
