'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var require$$1 = _interopDefault(require('os'));
var require$$2 = _interopDefault(require('child_process'));
var require$$3 = _interopDefault(require('util'));

var __commonjs_global = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this;
function __commonjs(fn, module) { return module = { exports: {} }, fn(module, module.exports, __commonjs_global), module.exports; }

var rx = __commonjs(function (module, exports, global) {
// Copyright (c) Microsoft, All rights reserved. See License.txt in the project root for license information.

;(function (undefined) {

  var objectTypes = {
    'function': true,
    'object': true
  };

  function checkGlobal(value) {
    return (value && value.Object === Object) ? value : null;
  }

  var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType) ? exports : null;
  var freeModule = (objectTypes[typeof module] && module && !module.nodeType) ? module : null;
  var freeGlobal = checkGlobal(freeExports && freeModule && typeof global === 'object' && global);
  var freeSelf = checkGlobal(objectTypes[typeof self] && self);
  var freeWindow = checkGlobal(objectTypes[typeof window] && window);
  var moduleExports = (freeModule && freeModule.exports === freeExports) ? freeExports : null;
  var thisGlobal = checkGlobal(objectTypes[typeof this] && this);
  var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) || freeSelf || thisGlobal || Function('return this')();

  var Rx = {
    internals: {},
    config: {
      Promise: root.Promise
    },
    helpers: { }
  };

  // Defaults
  var noop = Rx.helpers.noop = function () { },
    identity = Rx.helpers.identity = function (x) { return x; },
    defaultNow = Rx.helpers.defaultNow = Date.now,
    defaultComparer = Rx.helpers.defaultComparer = function (x, y) { return isEqual(x, y); },
    defaultSubComparer = Rx.helpers.defaultSubComparer = function (x, y) { return x > y ? 1 : (x < y ? -1 : 0); },
    defaultKeySerializer = Rx.helpers.defaultKeySerializer = function (x) { return x.toString(); },
    defaultError = Rx.helpers.defaultError = function (err) { throw err; },
    isPromise = Rx.helpers.isPromise = function (p) { return !!p && typeof p.subscribe !== 'function' && typeof p.then === 'function'; },
    isFunction = Rx.helpers.isFunction = (function () {

      var isFn = function (value) {
        return typeof value == 'function' || false;
      };

      // fallback for older versions of Chrome and Safari
      if (isFn(/x/)) {
        isFn = function(value) {
          return typeof value == 'function' && toString.call(value) == '[object Function]';
        };
      }

      return isFn;
    }());

  function cloneArray(arr) { for(var a = [], i = 0, len = arr.length; i < len; i++) { a.push(arr[i]); } return a;}

  var errorObj = {e: {}};
  
  function tryCatcherGen(tryCatchTarget) {
    return function tryCatcher() {
      try {
        return tryCatchTarget.apply(this, arguments);
      } catch (e) {
        errorObj.e = e;
        return errorObj;
      }
    };
  }

  var tryCatch = Rx.internals.tryCatch = function tryCatch(fn) {
    if (!isFunction(fn)) { throw new TypeError('fn must be a function'); }
    return tryCatcherGen(fn);
  };

  function thrower(e) {
    throw e;
  }

  Rx.config.longStackSupport = false;
  var hasStacks = false, stacks = tryCatch(function () { throw new Error(); })();
  hasStacks = !!stacks.e && !!stacks.e.stack;

  // All code after this point will be filtered from stack traces reported by RxJS
  var rStartingLine = captureLine(), rFileName;

  var STACK_JUMP_SEPARATOR = 'From previous event:';

  function makeStackTraceLong(error, observable) {
    // If possible, transform the error stack trace by removing Node and RxJS
    // cruft, then concatenating with the stack trace of `observable`.
    if (hasStacks &&
        observable.stack &&
        typeof error === 'object' &&
        error !== null &&
        error.stack &&
        error.stack.indexOf(STACK_JUMP_SEPARATOR) === -1
    ) {
      var stacks = [];
      for (var o = observable; !!o; o = o.source) {
        if (o.stack) {
          stacks.unshift(o.stack);
        }
      }
      stacks.unshift(error.stack);

      var concatedStacks = stacks.join('\n' + STACK_JUMP_SEPARATOR + '\n');
      error.stack = filterStackString(concatedStacks);
    }
  }

  function filterStackString(stackString) {
    var lines = stackString.split('\n'), desiredLines = [];
    for (var i = 0, len = lines.length; i < len; i++) {
      var line = lines[i];

      if (!isInternalFrame(line) && !isNodeFrame(line) && line) {
        desiredLines.push(line);
      }
    }
    return desiredLines.join('\n');
  }

  function isInternalFrame(stackLine) {
    var fileNameAndLineNumber = getFileNameAndLineNumber(stackLine);
    if (!fileNameAndLineNumber) {
      return false;
    }
    var fileName = fileNameAndLineNumber[0], lineNumber = fileNameAndLineNumber[1];

    return fileName === rFileName &&
      lineNumber >= rStartingLine &&
      lineNumber <= rEndingLine;
  }

  function isNodeFrame(stackLine) {
    return stackLine.indexOf('(module.js:') !== -1 ||
      stackLine.indexOf('(node.js:') !== -1;
  }

  function captureLine() {
    if (!hasStacks) { return; }

    try {
      throw new Error();
    } catch (e) {
      var lines = e.stack.split('\n');
      var firstLine = lines[0].indexOf('@') > 0 ? lines[1] : lines[2];
      var fileNameAndLineNumber = getFileNameAndLineNumber(firstLine);
      if (!fileNameAndLineNumber) { return; }

      rFileName = fileNameAndLineNumber[0];
      return fileNameAndLineNumber[1];
    }
  }

  function getFileNameAndLineNumber(stackLine) {
    // Named functions: 'at functionName (filename:lineNumber:columnNumber)'
    var attempt1 = /at .+ \((.+):(\d+):(?:\d+)\)$/.exec(stackLine);
    if (attempt1) { return [attempt1[1], Number(attempt1[2])]; }

    // Anonymous functions: 'at filename:lineNumber:columnNumber'
    var attempt2 = /at ([^ ]+):(\d+):(?:\d+)$/.exec(stackLine);
    if (attempt2) { return [attempt2[1], Number(attempt2[2])]; }

    // Firefox style: 'function@filename:lineNumber or @filename:lineNumber'
    var attempt3 = /.*@(.+):(\d+)$/.exec(stackLine);
    if (attempt3) { return [attempt3[1], Number(attempt3[2])]; }
  }

  var EmptyError = Rx.EmptyError = function() {
    this.message = 'Sequence contains no elements.';
    Error.call(this);
  };
  EmptyError.prototype = Object.create(Error.prototype);
  EmptyError.prototype.name = 'EmptyError';

  var ObjectDisposedError = Rx.ObjectDisposedError = function() {
    this.message = 'Object has been disposed';
    Error.call(this);
  };
  ObjectDisposedError.prototype = Object.create(Error.prototype);
  ObjectDisposedError.prototype.name = 'ObjectDisposedError';

  var ArgumentOutOfRangeError = Rx.ArgumentOutOfRangeError = function () {
    this.message = 'Argument out of range';
    Error.call(this);
  };
  ArgumentOutOfRangeError.prototype = Object.create(Error.prototype);
  ArgumentOutOfRangeError.prototype.name = 'ArgumentOutOfRangeError';

  var NotSupportedError = Rx.NotSupportedError = function (message) {
    this.message = message || 'This operation is not supported';
    Error.call(this);
  };
  NotSupportedError.prototype = Object.create(Error.prototype);
  NotSupportedError.prototype.name = 'NotSupportedError';

  var NotImplementedError = Rx.NotImplementedError = function (message) {
    this.message = message || 'This operation is not implemented';
    Error.call(this);
  };
  NotImplementedError.prototype = Object.create(Error.prototype);
  NotImplementedError.prototype.name = 'NotImplementedError';

  var notImplemented = Rx.helpers.notImplemented = function () {
    throw new NotImplementedError();
  };

  var notSupported = Rx.helpers.notSupported = function () {
    throw new NotSupportedError();
  };

  // Shim in iterator support
  var $iterator$ = (typeof Symbol === 'function' && Symbol.iterator) ||
    '_es6shim_iterator_';
  // Bug for mozilla version
  if (root.Set && typeof new root.Set()['@@iterator'] === 'function') {
    $iterator$ = '@@iterator';
  }

  var doneEnumerator = Rx.doneEnumerator = { done: true, value: undefined };

  var isIterable = Rx.helpers.isIterable = function (o) {
    return o && o[$iterator$] !== undefined;
  };

  var isArrayLike = Rx.helpers.isArrayLike = function (o) {
    return o && o.length !== undefined;
  };

  Rx.helpers.iterator = $iterator$;

  var bindCallback = Rx.internals.bindCallback = function (func, thisArg, argCount) {
    if (typeof thisArg === 'undefined') { return func; }
    switch(argCount) {
      case 0:
        return function() {
          return func.call(thisArg)
        };
      case 1:
        return function(arg) {
          return func.call(thisArg, arg);
        };
      case 2:
        return function(value, index) {
          return func.call(thisArg, value, index);
        };
      case 3:
        return function(value, index, collection) {
          return func.call(thisArg, value, index, collection);
        };
    }

    return function() {
      return func.apply(thisArg, arguments);
    };
  };

  /** Used to determine if values are of the language type Object */
  var dontEnums = ['toString',
    'toLocaleString',
    'valueOf',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'constructor'],
  dontEnumsLength = dontEnums.length;

var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dateTag] = typedArrayTags[errorTag] =
typedArrayTags[funcTag] = typedArrayTags[mapTag] =
typedArrayTags[numberTag] = typedArrayTags[objectTag] =
typedArrayTags[regexpTag] = typedArrayTags[setTag] =
typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;

var objectProto = Object.prototype,
    hasOwnProperty = objectProto.hasOwnProperty,
    objToString = objectProto.toString,
    MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;

var keys = Object.keys || (function() {
    var hasOwnProperty = Object.prototype.hasOwnProperty,
        hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString'),
        dontEnums = [
          'toString',
          'toLocaleString',
          'valueOf',
          'hasOwnProperty',
          'isPrototypeOf',
          'propertyIsEnumerable',
          'constructor'
        ],
        dontEnumsLength = dontEnums.length;

    return function(obj) {
      if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
        throw new TypeError('Object.keys called on non-object');
      }

      var result = [], prop, i;

      for (prop in obj) {
        if (hasOwnProperty.call(obj, prop)) {
          result.push(prop);
        }
      }

      if (hasDontEnumBug) {
        for (i = 0; i < dontEnumsLength; i++) {
          if (hasOwnProperty.call(obj, dontEnums[i])) {
            result.push(dontEnums[i]);
          }
        }
      }
      return result;
    };
  }());

function equalObjects(object, other, equalFunc, isLoose, stackA, stackB) {
  var objProps = keys(object),
      objLength = objProps.length,
      othProps = keys(other),
      othLength = othProps.length;

  if (objLength !== othLength && !isLoose) {
    return false;
  }
  var index = objLength, key;
  while (index--) {
    key = objProps[index];
    if (!(isLoose ? key in other : hasOwnProperty.call(other, key))) {
      return false;
    }
  }
  var skipCtor = isLoose;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key],
        result;

    if (!(result === undefined ? equalFunc(objValue, othValue, isLoose, stackA, stackB) : result)) {
      return false;
    }
    skipCtor || (skipCtor = key === 'constructor');
  }
  if (!skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    if (objCtor !== othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor === 'function' && objCtor instanceof objCtor &&
          typeof othCtor === 'function' && othCtor instanceof othCtor)) {
      return false;
    }
  }
  return true;
}

function equalByTag(object, other, tag) {
  switch (tag) {
    case boolTag:
    case dateTag:
      return +object === +other;

    case errorTag:
      return object.name === other.name && object.message === other.message;

    case numberTag:
      return (object !== +object) ?
        other !== +other :
        object === +other;

    case regexpTag:
    case stringTag:
      return object === (other + '');
  }
  return false;
}

var isObject = Rx.internals.isObject = function(value) {
  var type = typeof value;
  return !!value && (type === 'object' || type === 'function');
};

function isObjectLike(value) {
  return !!value && typeof value === 'object';
}

function isLength(value) {
  return typeof value === 'number' && value > -1 && value % 1 === 0 && value <= MAX_SAFE_INTEGER;
}

var isHostObject = (function() {
  try {
    Object({ 'toString': 0 } + '');
  } catch(e) {
    return function() { return false; };
  }
  return function(value) {
    return typeof value.toString !== 'function' && typeof (value + '') === 'string';
  };
}());

function isTypedArray(value) {
  return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[objToString.call(value)];
}

var isArray = Array.isArray || function(value) {
  return isObjectLike(value) && isLength(value.length) && objToString.call(value) === arrayTag;
};

function arraySome (array, predicate) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

function equalArrays(array, other, equalFunc, isLoose, stackA, stackB) {
  var index = -1,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength !== othLength && !(isLoose && othLength > arrLength)) {
    return false;
  }
  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index],
        result;

    if (result !== undefined) {
      if (result) {
        continue;
      }
      return false;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (isLoose) {
      if (!arraySome(other, function(othValue) {
            return arrValue === othValue || equalFunc(arrValue, othValue, isLoose, stackA, stackB);
          })) {
        return false;
      }
    } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, isLoose, stackA, stackB))) {
      return false;
    }
  }
  return true;
}

function baseIsEqualDeep(object, other, equalFunc, isLoose, stackA, stackB) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = arrayTag,
      othTag = arrayTag;

  if (!objIsArr) {
    objTag = objToString.call(object);
    if (objTag === argsTag) {
      objTag = objectTag;
    } else if (objTag !== objectTag) {
      objIsArr = isTypedArray(object);
    }
  }
  if (!othIsArr) {
    othTag = objToString.call(other);
    if (othTag === argsTag) {
      othTag = objectTag;
    }
  }
  var objIsObj = objTag === objectTag && !isHostObject(object),
      othIsObj = othTag === objectTag && !isHostObject(other),
      isSameTag = objTag === othTag;

  if (isSameTag && !(objIsArr || objIsObj)) {
    return equalByTag(object, other, objTag);
  }
  if (!isLoose) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      return equalFunc(objIsWrapped ? object.value() : object, othIsWrapped ? other.value() : other, isLoose, stackA, stackB);
    }
  }
  if (!isSameTag) {
    return false;
  }
  // Assume cyclic values are equal.
  // For more information on detecting circular references see https://es5.github.io/#JO.
  stackA || (stackA = []);
  stackB || (stackB = []);

  var length = stackA.length;
  while (length--) {
    if (stackA[length] === object) {
      return stackB[length] === other;
    }
  }
  // Add `object` and `other` to the stack of traversed objects.
  stackA.push(object);
  stackB.push(other);

  var result = (objIsArr ? equalArrays : equalObjects)(object, other, equalFunc, isLoose, stackA, stackB);

  stackA.pop();
  stackB.pop();

  return result;
}

function baseIsEqual(value, other, isLoose, stackA, stackB) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObject(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, baseIsEqual, isLoose, stackA, stackB);
}

var isEqual = Rx.internals.isEqual = function (value, other) {
  return baseIsEqual(value, other);
};

  var hasProp = {}.hasOwnProperty,
      slice = Array.prototype.slice;

  var inherits = Rx.internals.inherits = function (child, parent) {
    function __() { this.constructor = child; }
    __.prototype = parent.prototype;
    child.prototype = new __();
  };

  var addProperties = Rx.internals.addProperties = function (obj) {
    for(var sources = [], i = 1, len = arguments.length; i < len; i++) { sources.push(arguments[i]); }
    for (var idx = 0, ln = sources.length; idx < ln; idx++) {
      var source = sources[idx];
      for (var prop in source) {
        obj[prop] = source[prop];
      }
    }
  };

  // Rx Utils
  var addRef = Rx.internals.addRef = function (xs, r) {
    return new AnonymousObservable(function (observer) {
      return new BinaryDisposable(r.getDisposable(), xs.subscribe(observer));
    });
  };

  function arrayInitialize(count, factory) {
    var a = new Array(count);
    for (var i = 0; i < count; i++) {
      a[i] = factory();
    }
    return a;
  }

  /**
   * Represents a group of disposable resources that are disposed together.
   * @constructor
   */
  var CompositeDisposable = Rx.CompositeDisposable = function () {
    var args = [], i, len;
    if (Array.isArray(arguments[0])) {
      args = arguments[0];
    } else {
      len = arguments.length;
      args = new Array(len);
      for(i = 0; i < len; i++) { args[i] = arguments[i]; }
    }
    this.disposables = args;
    this.isDisposed = false;
    this.length = args.length;
  };

  var CompositeDisposablePrototype = CompositeDisposable.prototype;

  /**
   * Adds a disposable to the CompositeDisposable or disposes the disposable if the CompositeDisposable is disposed.
   * @param {Mixed} item Disposable to add.
   */
  CompositeDisposablePrototype.add = function (item) {
    if (this.isDisposed) {
      item.dispose();
    } else {
      this.disposables.push(item);
      this.length++;
    }
  };

  /**
   * Removes and disposes the first occurrence of a disposable from the CompositeDisposable.
   * @param {Mixed} item Disposable to remove.
   * @returns {Boolean} true if found; false otherwise.
   */
  CompositeDisposablePrototype.remove = function (item) {
    var shouldDispose = false;
    if (!this.isDisposed) {
      var idx = this.disposables.indexOf(item);
      if (idx !== -1) {
        shouldDispose = true;
        this.disposables.splice(idx, 1);
        this.length--;
        item.dispose();
      }
    }
    return shouldDispose;
  };

  /**
   *  Disposes all disposables in the group and removes them from the group.
   */
  CompositeDisposablePrototype.dispose = function () {
    if (!this.isDisposed) {
      this.isDisposed = true;
      var len = this.disposables.length, currentDisposables = new Array(len);
      for(var i = 0; i < len; i++) { currentDisposables[i] = this.disposables[i]; }
      this.disposables = [];
      this.length = 0;

      for (i = 0; i < len; i++) {
        currentDisposables[i].dispose();
      }
    }
  };

  /**
   * Provides a set of static methods for creating Disposables.
   * @param {Function} dispose Action to run during the first call to dispose. The action is guaranteed to be run at most once.
   */
  var Disposable = Rx.Disposable = function (action) {
    this.isDisposed = false;
    this.action = action || noop;
  };

  /** Performs the task of cleaning up resources. */
  Disposable.prototype.dispose = function () {
    if (!this.isDisposed) {
      this.action();
      this.isDisposed = true;
    }
  };

  /**
   * Creates a disposable object that invokes the specified action when disposed.
   * @param {Function} dispose Action to run during the first call to dispose. The action is guaranteed to be run at most once.
   * @return {Disposable} The disposable object that runs the given action upon disposal.
   */
  var disposableCreate = Disposable.create = function (action) { return new Disposable(action); };

  /**
   * Gets the disposable that does nothing when disposed.
   */
  var disposableEmpty = Disposable.empty = { dispose: noop };

  /**
   * Validates whether the given object is a disposable
   * @param {Object} Object to test whether it has a dispose method
   * @returns {Boolean} true if a disposable object, else false.
   */
  var isDisposable = Disposable.isDisposable = function (d) {
    return d && isFunction(d.dispose);
  };

  var checkDisposed = Disposable.checkDisposed = function (disposable) {
    if (disposable.isDisposed) { throw new ObjectDisposedError(); }
  };

  var disposableFixup = Disposable._fixup = function (result) {
    return isDisposable(result) ? result : disposableEmpty;
  };

  // Single assignment
  var SingleAssignmentDisposable = Rx.SingleAssignmentDisposable = function () {
    this.isDisposed = false;
    this.current = null;
  };
  SingleAssignmentDisposable.prototype.getDisposable = function () {
    return this.current;
  };
  SingleAssignmentDisposable.prototype.setDisposable = function (value) {
    if (this.current) { throw new Error('Disposable has already been assigned'); }
    var shouldDispose = this.isDisposed;
    !shouldDispose && (this.current = value);
    shouldDispose && value && value.dispose();
  };
  SingleAssignmentDisposable.prototype.dispose = function () {
    if (!this.isDisposed) {
      this.isDisposed = true;
      var old = this.current;
      this.current = null;
      old && old.dispose();
    }
  };

  // Multiple assignment disposable
  var SerialDisposable = Rx.SerialDisposable = function () {
    this.isDisposed = false;
    this.current = null;
  };
  SerialDisposable.prototype.getDisposable = function () {
    return this.current;
  };
  SerialDisposable.prototype.setDisposable = function (value) {
    var shouldDispose = this.isDisposed;
    if (!shouldDispose) {
      var old = this.current;
      this.current = value;
    }
    old && old.dispose();
    shouldDispose && value && value.dispose();
  };
  SerialDisposable.prototype.dispose = function () {
    if (!this.isDisposed) {
      this.isDisposed = true;
      var old = this.current;
      this.current = null;
    }
    old && old.dispose();
  };

  var BinaryDisposable = Rx.BinaryDisposable = function (first, second) {
    this._first = first;
    this._second = second;
    this.isDisposed = false;
  };

  BinaryDisposable.prototype.dispose = function () {
    if (!this.isDisposed) {
      this.isDisposed = true;
      var old1 = this._first;
      this._first = null;
      old1 && old1.dispose();
      var old2 = this._second;
      this._second = null;
      old2 && old2.dispose();
    }
  };

  var NAryDisposable = Rx.NAryDisposable = function (disposables) {
    this._disposables = disposables;
    this.isDisposed = false;
  };

  NAryDisposable.prototype.dispose = function () {
    if (!this.isDisposed) {
      this.isDisposed = true;
      for (var i = 0, len = this._disposables.length; i < len; i++) {
        this._disposables[i].dispose();
      }
      this._disposables.length = 0;
    }
  };

  /**
   * Represents a disposable resource that only disposes its underlying disposable resource when all dependent disposable objects have been disposed.
   */
  var RefCountDisposable = Rx.RefCountDisposable = (function () {

    function InnerDisposable(disposable) {
      this.disposable = disposable;
      this.disposable.count++;
      this.isInnerDisposed = false;
    }

    InnerDisposable.prototype.dispose = function () {
      if (!this.disposable.isDisposed && !this.isInnerDisposed) {
        this.isInnerDisposed = true;
        this.disposable.count--;
        if (this.disposable.count === 0 && this.disposable.isPrimaryDisposed) {
          this.disposable.isDisposed = true;
          this.disposable.underlyingDisposable.dispose();
        }
      }
    };

    /**
     * Initializes a new instance of the RefCountDisposable with the specified disposable.
     * @constructor
     * @param {Disposable} disposable Underlying disposable.
      */
    function RefCountDisposable(disposable) {
      this.underlyingDisposable = disposable;
      this.isDisposed = false;
      this.isPrimaryDisposed = false;
      this.count = 0;
    }

    /**
     * Disposes the underlying disposable only when all dependent disposables have been disposed
     */
    RefCountDisposable.prototype.dispose = function () {
      if (!this.isDisposed && !this.isPrimaryDisposed) {
        this.isPrimaryDisposed = true;
        if (this.count === 0) {
          this.isDisposed = true;
          this.underlyingDisposable.dispose();
        }
      }
    };

    /**
     * Returns a dependent disposable that when disposed decreases the refcount on the underlying disposable.
     * @returns {Disposable} A dependent disposable contributing to the reference count that manages the underlying disposable's lifetime.
     */
    RefCountDisposable.prototype.getDisposable = function () {
      return this.isDisposed ? disposableEmpty : new InnerDisposable(this);
    };

    return RefCountDisposable;
  })();

  function ScheduledDisposable(scheduler, disposable) {
    this.scheduler = scheduler;
    this.disposable = disposable;
    this.isDisposed = false;
  }

  function scheduleItem(s, self) {
    if (!self.isDisposed) {
      self.isDisposed = true;
      self.disposable.dispose();
    }
  }

  ScheduledDisposable.prototype.dispose = function () {
    this.scheduler.schedule(this, scheduleItem);
  };

  var ScheduledItem = Rx.internals.ScheduledItem = function (scheduler, state, action, dueTime, comparer) {
    this.scheduler = scheduler;
    this.state = state;
    this.action = action;
    this.dueTime = dueTime;
    this.comparer = comparer || defaultSubComparer;
    this.disposable = new SingleAssignmentDisposable();
  };

  ScheduledItem.prototype.invoke = function () {
    this.disposable.setDisposable(this.invokeCore());
  };

  ScheduledItem.prototype.compareTo = function (other) {
    return this.comparer(this.dueTime, other.dueTime);
  };

  ScheduledItem.prototype.isCancelled = function () {
    return this.disposable.isDisposed;
  };

  ScheduledItem.prototype.invokeCore = function () {
    return disposableFixup(this.action(this.scheduler, this.state));
  };

  /** Provides a set of static properties to access commonly used schedulers. */
  var Scheduler = Rx.Scheduler = (function () {

    function Scheduler() { }

    /** Determines whether the given object is a scheduler */
    Scheduler.isScheduler = function (s) {
      return s instanceof Scheduler;
    };

    var schedulerProto = Scheduler.prototype;

    /**
   * Schedules an action to be executed.
   * @param state State passed to the action to be executed.
   * @param {Function} action Action to be executed.
   * @returns {Disposable} The disposable object used to cancel the scheduled action (best effort).
   */
    schedulerProto.schedule = function (state, action) {
      throw new NotImplementedError();
    };

  /**
   * Schedules an action to be executed after dueTime.
   * @param state State passed to the action to be executed.
   * @param {Function} action Action to be executed.
   * @param {Number} dueTime Relative time after which to execute the action.
   * @returns {Disposable} The disposable object used to cancel the scheduled action (best effort).
   */
    schedulerProto.scheduleFuture = function (state, dueTime, action) {
      var dt = dueTime;
      dt instanceof Date && (dt = dt - this.now());
      dt = Scheduler.normalize(dt);

      if (dt === 0) { return this.schedule(state, action); }

      return this._scheduleFuture(state, dt, action);
    };

    schedulerProto._scheduleFuture = function (state, dueTime, action) {
      throw new NotImplementedError();
    };

    /** Gets the current time according to the local machine's system clock. */
    Scheduler.now = defaultNow;

    /** Gets the current time according to the local machine's system clock. */
    Scheduler.prototype.now = defaultNow;

    /**
     * Normalizes the specified TimeSpan value to a positive value.
     * @param {Number} timeSpan The time span value to normalize.
     * @returns {Number} The specified TimeSpan value if it is zero or positive; otherwise, 0
     */
    Scheduler.normalize = function (timeSpan) {
      timeSpan < 0 && (timeSpan = 0);
      return timeSpan;
    };

    return Scheduler;
  }());

  var normalizeTime = Scheduler.normalize, isScheduler = Scheduler.isScheduler;

  (function (schedulerProto) {

    function invokeRecImmediate(scheduler, pair) {
      var state = pair[0], action = pair[1], group = new CompositeDisposable();
      action(state, innerAction);
      return group;

      function innerAction(state2) {
        var isAdded = false, isDone = false;

        var d = scheduler.schedule(state2, scheduleWork);
        if (!isDone) {
          group.add(d);
          isAdded = true;
        }

        function scheduleWork(_, state3) {
          if (isAdded) {
            group.remove(d);
          } else {
            isDone = true;
          }
          action(state3, innerAction);
          return disposableEmpty;
        }
      }
    }

    function invokeRecDate(scheduler, pair) {
      var state = pair[0], action = pair[1], group = new CompositeDisposable();
      action(state, innerAction);
      return group;

      function innerAction(state2, dueTime1) {
        var isAdded = false, isDone = false;

        var d = scheduler.scheduleFuture(state2, dueTime1, scheduleWork);
        if (!isDone) {
          group.add(d);
          isAdded = true;
        }

        function scheduleWork(_, state3) {
          if (isAdded) {
            group.remove(d);
          } else {
            isDone = true;
          }
          action(state3, innerAction);
          return disposableEmpty;
        }
      }
    }

    /**
     * Schedules an action to be executed recursively.
     * @param {Mixed} state State passed to the action to be executed.
     * @param {Function} action Action to execute recursively. The last parameter passed to the action is used to trigger recursive scheduling of the action, passing in recursive invocation state.
     * @returns {Disposable} The disposable object used to cancel the scheduled action (best effort).
     */
    schedulerProto.scheduleRecursive = function (state, action) {
      return this.schedule([state, action], invokeRecImmediate);
    };

    /**
     * Schedules an action to be executed recursively after a specified relative or absolute due time.
     * @param {Mixed} state State passed to the action to be executed.
     * @param {Function} action Action to execute recursively. The last parameter passed to the action is used to trigger recursive scheduling of the action, passing in the recursive due time and invocation state.
     * @param {Number | Date} dueTime Relative or absolute time after which to execute the action for the first time.
     * @returns {Disposable} The disposable object used to cancel the scheduled action (best effort).
     */
    schedulerProto.scheduleRecursiveFuture = function (state, dueTime, action) {
      return this.scheduleFuture([state, action], dueTime, invokeRecDate);
    };

  }(Scheduler.prototype));

  (function (schedulerProto) {

    /**
     * Schedules a periodic piece of work by dynamically discovering the scheduler's capabilities. The periodic task will be scheduled using window.setInterval for the base implementation.
     * @param {Mixed} state Initial state passed to the action upon the first iteration.
     * @param {Number} period Period for running the work periodically.
     * @param {Function} action Action to be executed, potentially updating the state.
     * @returns {Disposable} The disposable object used to cancel the scheduled recurring action (best effort).
     */
    schedulerProto.schedulePeriodic = function(state, period, action) {
      if (typeof root.setInterval === 'undefined') { throw new NotSupportedError(); }
      period = normalizeTime(period);
      var s = state, id = root.setInterval(function () { s = action(s); }, period);
      return disposableCreate(function () { root.clearInterval(id); });
    };

  }(Scheduler.prototype));

  (function (schedulerProto) {
    /**
     * Returns a scheduler that wraps the original scheduler, adding exception handling for scheduled actions.
     * @param {Function} handler Handler that's run if an exception is caught. The exception will be rethrown if the handler returns false.
     * @returns {Scheduler} Wrapper around the original scheduler, enforcing exception handling.
     */
    schedulerProto.catchError = schedulerProto['catch'] = function (handler) {
      return new CatchScheduler(this, handler);
    };
  }(Scheduler.prototype));

  var SchedulePeriodicRecursive = Rx.internals.SchedulePeriodicRecursive = (function () {
    function createTick(self) {
      return function tick(command, recurse) {
        recurse(0, self._period);
        var state = tryCatch(self._action)(self._state);
        if (state === errorObj) {
          self._cancel.dispose();
          thrower(state.e);
        }
        self._state = state;
      };
    }

    function SchedulePeriodicRecursive(scheduler, state, period, action) {
      this._scheduler = scheduler;
      this._state = state;
      this._period = period;
      this._action = action;
    }

    SchedulePeriodicRecursive.prototype.start = function () {
      var d = new SingleAssignmentDisposable();
      this._cancel = d;
      d.setDisposable(this._scheduler.scheduleRecursiveFuture(0, this._period, createTick(this)));

      return d;
    };

    return SchedulePeriodicRecursive;
  }());

  /** Gets a scheduler that schedules work immediately on the current thread. */
   var ImmediateScheduler = (function (__super__) {
    inherits(ImmediateScheduler, __super__);
    function ImmediateScheduler() {
      __super__.call(this);
    }

    ImmediateScheduler.prototype.schedule = function (state, action) {
      return disposableFixup(action(this, state));
    };

    return ImmediateScheduler;
  }(Scheduler));

  var immediateScheduler = Scheduler.immediate = new ImmediateScheduler();

  /**
   * Gets a scheduler that schedules work as soon as possible on the current thread.
   */
  var CurrentThreadScheduler = (function (__super__) {
    var queue;

    function runTrampoline () {
      while (queue.length > 0) {
        var item = queue.dequeue();
        !item.isCancelled() && item.invoke();
      }
    }

    inherits(CurrentThreadScheduler, __super__);
    function CurrentThreadScheduler() {
      __super__.call(this);
    }

    CurrentThreadScheduler.prototype.schedule = function (state, action) {
      var si = new ScheduledItem(this, state, action, this.now());

      if (!queue) {
        queue = new PriorityQueue(4);
        queue.enqueue(si);

        var result = tryCatch(runTrampoline)();
        queue = null;
        if (result === errorObj) { thrower(result.e); }
      } else {
        queue.enqueue(si);
      }
      return si.disposable;
    };

    CurrentThreadScheduler.prototype.scheduleRequired = function () { return !queue; };

    return CurrentThreadScheduler;
  }(Scheduler));

  var currentThreadScheduler = Scheduler.currentThread = new CurrentThreadScheduler();

  var scheduleMethod, clearMethod;

  var localTimer = (function () {
    var localSetTimeout, localClearTimeout = noop;
    if (!!root.setTimeout) {
      localSetTimeout = root.setTimeout;
      localClearTimeout = root.clearTimeout;
    } else if (!!root.WScript) {
      localSetTimeout = function (fn, time) {
        root.WScript.Sleep(time);
        fn();
      };
    } else {
      throw new NotSupportedError();
    }

    return {
      setTimeout: localSetTimeout,
      clearTimeout: localClearTimeout
    };
  }());
  var localSetTimeout = localTimer.setTimeout,
    localClearTimeout = localTimer.clearTimeout;

  (function () {

    var nextHandle = 1, tasksByHandle = {}, currentlyRunning = false;

    clearMethod = function (handle) {
      delete tasksByHandle[handle];
    };

    function runTask(handle) {
      if (currentlyRunning) {
        localSetTimeout(function () { runTask(handle); }, 0);
      } else {
        var task = tasksByHandle[handle];
        if (task) {
          currentlyRunning = true;
          var result = tryCatch(task)();
          clearMethod(handle);
          currentlyRunning = false;
          if (result === errorObj) { thrower(result.e); }
        }
      }
    }

    var reNative = new RegExp('^' +
      String(toString)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/toString| for [^\]]+/g, '.*?') + '$'
    );

    var setImmediate = typeof (setImmediate = freeGlobal && moduleExports && freeGlobal.setImmediate) == 'function' &&
      !reNative.test(setImmediate) && setImmediate;

    function postMessageSupported () {
      // Ensure not in a worker
      if (!root.postMessage || root.importScripts) { return false; }
      var isAsync = false, oldHandler = root.onmessage;
      // Test for async
      root.onmessage = function () { isAsync = true; };
      root.postMessage('', '*');
      root.onmessage = oldHandler;

      return isAsync;
    }

    // Use in order, setImmediate, nextTick, postMessage, MessageChannel, script readystatechanged, setTimeout
    if (isFunction(setImmediate)) {
      scheduleMethod = function (action) {
        var id = nextHandle++;
        tasksByHandle[id] = action;
        setImmediate(function () { runTask(id); });

        return id;
      };
    } else if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
      scheduleMethod = function (action) {
        var id = nextHandle++;
        tasksByHandle[id] = action;
        process.nextTick(function () { runTask(id); });

        return id;
      };
    } else if (postMessageSupported()) {
      var MSG_PREFIX = 'ms.rx.schedule' + Math.random();

      var onGlobalPostMessage = function (event) {
        // Only if we're a match to avoid any other global events
        if (typeof event.data === 'string' && event.data.substring(0, MSG_PREFIX.length) === MSG_PREFIX) {
          runTask(event.data.substring(MSG_PREFIX.length));
        }
      };

      root.addEventListener('message', onGlobalPostMessage, false);

      scheduleMethod = function (action) {
        var id = nextHandle++;
        tasksByHandle[id] = action;
        root.postMessage(MSG_PREFIX + id, '*');
        return id;
      };
    } else if (!!root.MessageChannel) {
      var channel = new root.MessageChannel();

      channel.port1.onmessage = function (e) { runTask(e.data); };

      scheduleMethod = function (action) {
        var id = nextHandle++;
        tasksByHandle[id] = action;
        channel.port2.postMessage(id);
        return id;
      };
    } else if ('document' in root && 'onreadystatechange' in root.document.createElement('script')) {

      scheduleMethod = function (action) {
        var scriptElement = root.document.createElement('script');
        var id = nextHandle++;
        tasksByHandle[id] = action;

        scriptElement.onreadystatechange = function () {
          runTask(id);
          scriptElement.onreadystatechange = null;
          scriptElement.parentNode.removeChild(scriptElement);
          scriptElement = null;
        };
        root.document.documentElement.appendChild(scriptElement);
        return id;
      };

    } else {
      scheduleMethod = function (action) {
        var id = nextHandle++;
        tasksByHandle[id] = action;
        localSetTimeout(function () {
          runTask(id);
        }, 0);

        return id;
      };
    }
  }());

  /**
   * Gets a scheduler that schedules work via a timed callback based upon platform.
   */
   var DefaultScheduler = (function (__super__) {
     inherits(DefaultScheduler, __super__);
     function DefaultScheduler() {
       __super__.call(this);
     }

     function scheduleAction(disposable, action, scheduler, state) {
       return function schedule() {
         disposable.setDisposable(Disposable._fixup(action(scheduler, state)));
       };
     }

     function ClearDisposable(id) {
       this._id = id;
       this.isDisposed = false;
     }

     ClearDisposable.prototype.dispose = function () {
       if (!this.isDisposed) {
         this.isDisposed = true;
         clearMethod(this._id);
       }
     };

     function LocalClearDisposable(id) {
       this._id = id;
       this.isDisposed = false;
     }

     LocalClearDisposable.prototype.dispose = function () {
       if (!this.isDisposed) {
         this.isDisposed = true;
         localClearTimeout(this._id);
       }
     };

    DefaultScheduler.prototype.schedule = function (state, action) {
      var disposable = new SingleAssignmentDisposable(),
          id = scheduleMethod(scheduleAction(disposable, action, this, state));
      return new BinaryDisposable(disposable, new ClearDisposable(id));
    };

    DefaultScheduler.prototype._scheduleFuture = function (state, dueTime, action) {
      if (dueTime === 0) { return this.schedule(state, action); }
      var disposable = new SingleAssignmentDisposable(),
          id = localSetTimeout(scheduleAction(disposable, action, this, state), dueTime);
      return new BinaryDisposable(disposable, new LocalClearDisposable(id));
    };

    function scheduleLongRunning(state, action, disposable) {
      return function () { action(state, disposable); };
    }

    DefaultScheduler.prototype.scheduleLongRunning = function (state, action) {
      var disposable = disposableCreate(noop);
      scheduleMethod(scheduleLongRunning(state, action, disposable));
      return disposable;
    };

    return DefaultScheduler;
  }(Scheduler));

  var defaultScheduler = Scheduler['default'] = Scheduler.async = new DefaultScheduler();

  var CatchScheduler = (function (__super__) {
    inherits(CatchScheduler, __super__);

    function CatchScheduler(scheduler, handler) {
      this._scheduler = scheduler;
      this._handler = handler;
      this._recursiveOriginal = null;
      this._recursiveWrapper = null;
      __super__.call(this);
    }

    CatchScheduler.prototype.schedule = function (state, action) {
      return this._scheduler.schedule(state, this._wrap(action));
    };

    CatchScheduler.prototype._scheduleFuture = function (state, dueTime, action) {
      return this._scheduler.schedule(state, dueTime, this._wrap(action));
    };

    CatchScheduler.prototype.now = function () { return this._scheduler.now(); };

    CatchScheduler.prototype._clone = function (scheduler) {
        return new CatchScheduler(scheduler, this._handler);
    };

    CatchScheduler.prototype._wrap = function (action) {
      var parent = this;
      return function (self, state) {
        var res = tryCatch(action)(parent._getRecursiveWrapper(self), state);
        if (res === errorObj) {
          if (!parent._handler(res.e)) { thrower(res.e); }
          return disposableEmpty;
        }
        return disposableFixup(res);
      };
    };

    CatchScheduler.prototype._getRecursiveWrapper = function (scheduler) {
      if (this._recursiveOriginal !== scheduler) {
        this._recursiveOriginal = scheduler;
        var wrapper = this._clone(scheduler);
        wrapper._recursiveOriginal = scheduler;
        wrapper._recursiveWrapper = wrapper;
        this._recursiveWrapper = wrapper;
      }
      return this._recursiveWrapper;
    };

    CatchScheduler.prototype.schedulePeriodic = function (state, period, action) {
      var self = this, failed = false, d = new SingleAssignmentDisposable();

      d.setDisposable(this._scheduler.schedulePeriodic(state, period, function (state1) {
        if (failed) { return null; }
        var res = tryCatch(action)(state1);
        if (res === errorObj) {
          failed = true;
          if (!self._handler(res.e)) { thrower(res.e); }
          d.dispose();
          return null;
        }
        return res;
      }));

      return d;
    };

    return CatchScheduler;
  }(Scheduler));

  function IndexedItem(id, value) {
    this.id = id;
    this.value = value;
  }

  IndexedItem.prototype.compareTo = function (other) {
    var c = this.value.compareTo(other.value);
    c === 0 && (c = this.id - other.id);
    return c;
  };

  var PriorityQueue = Rx.internals.PriorityQueue = function (capacity) {
    this.items = new Array(capacity);
    this.length = 0;
  };

  var priorityProto = PriorityQueue.prototype;
  priorityProto.isHigherPriority = function (left, right) {
    return this.items[left].compareTo(this.items[right]) < 0;
  };

  priorityProto.percolate = function (index) {
    if (index >= this.length || index < 0) { return; }
    var parent = index - 1 >> 1;
    if (parent < 0 || parent === index) { return; }
    if (this.isHigherPriority(index, parent)) {
      var temp = this.items[index];
      this.items[index] = this.items[parent];
      this.items[parent] = temp;
      this.percolate(parent);
    }
  };

  priorityProto.heapify = function (index) {
    +index || (index = 0);
    if (index >= this.length || index < 0) { return; }
    var left = 2 * index + 1,
        right = 2 * index + 2,
        first = index;
    if (left < this.length && this.isHigherPriority(left, first)) {
      first = left;
    }
    if (right < this.length && this.isHigherPriority(right, first)) {
      first = right;
    }
    if (first !== index) {
      var temp = this.items[index];
      this.items[index] = this.items[first];
      this.items[first] = temp;
      this.heapify(first);
    }
  };

  priorityProto.peek = function () { return this.items[0].value; };

  priorityProto.removeAt = function (index) {
    this.items[index] = this.items[--this.length];
    this.items[this.length] = undefined;
    this.heapify();
  };

  priorityProto.dequeue = function () {
    var result = this.peek();
    this.removeAt(0);
    return result;
  };

  priorityProto.enqueue = function (item) {
    var index = this.length++;
    this.items[index] = new IndexedItem(PriorityQueue.count++, item);
    this.percolate(index);
  };

  priorityProto.remove = function (item) {
    for (var i = 0; i < this.length; i++) {
      if (this.items[i].value === item) {
        this.removeAt(i);
        return true;
      }
    }
    return false;
  };
  PriorityQueue.count = 0;

  /**
   *  Represents a notification to an observer.
   */
  var Notification = Rx.Notification = (function () {
    function Notification() {

    }

    Notification.prototype._accept = function (onNext, onError, onCompleted) {
      throw new NotImplementedError();
    };

    Notification.prototype._acceptObserver = function (onNext, onError, onCompleted) {
      throw new NotImplementedError();
    };

    /**
     * Invokes the delegate corresponding to the notification or the observer's method corresponding to the notification and returns the produced result.
     * @param {Function | Observer} observerOrOnNext Function to invoke for an OnNext notification or Observer to invoke the notification on..
     * @param {Function} onError Function to invoke for an OnError notification.
     * @param {Function} onCompleted Function to invoke for an OnCompleted notification.
     * @returns {Any} Result produced by the observation.
     */
    Notification.prototype.accept = function (observerOrOnNext, onError, onCompleted) {
      return observerOrOnNext && typeof observerOrOnNext === 'object' ?
        this._acceptObserver(observerOrOnNext) :
        this._accept(observerOrOnNext, onError, onCompleted);
    };

    /**
     * Returns an observable sequence with a single notification.
     *
     * @memberOf Notifications
     * @param {Scheduler} [scheduler] Scheduler to send out the notification calls on.
     * @returns {Observable} The observable sequence that surfaces the behavior of the notification upon subscription.
     */
    Notification.prototype.toObservable = function (scheduler) {
      var self = this;
      isScheduler(scheduler) || (scheduler = immediateScheduler);
      return new AnonymousObservable(function (o) {
        return scheduler.schedule(self, function (_, notification) {
          notification._acceptObserver(o);
          notification.kind === 'N' && o.onCompleted();
        });
      });
    };

    return Notification;
  })();

  var OnNextNotification = (function (__super__) {
    inherits(OnNextNotification, __super__);
    function OnNextNotification(value) {
      this.value = value;
      this.kind = 'N';
    }

    OnNextNotification.prototype._accept = function (onNext) {
      return onNext(this.value);
    };

    OnNextNotification.prototype._acceptObserver = function (o) {
      return o.onNext(this.value);
    };

    OnNextNotification.prototype.toString = function () {
      return 'OnNext(' + this.value + ')';
    };

    return OnNextNotification;
  }(Notification));

  var OnErrorNotification = (function (__super__) {
    inherits(OnErrorNotification, __super__);
    function OnErrorNotification(error) {
      this.error = error;
      this.kind = 'E';
    }

    OnErrorNotification.prototype._accept = function (onNext, onError) {
      return onError(this.error);
    };

    OnErrorNotification.prototype._acceptObserver = function (o) {
      return o.onError(this.error);
    };

    OnErrorNotification.prototype.toString = function () {
      return 'OnError(' + this.error + ')';
    };

    return OnErrorNotification;
  }(Notification));

  var OnCompletedNotification = (function (__super__) {
    inherits(OnCompletedNotification, __super__);
    function OnCompletedNotification() {
      this.kind = 'C';
    }

    OnCompletedNotification.prototype._accept = function (onNext, onError, onCompleted) {
      return onCompleted();
    };

    OnCompletedNotification.prototype._acceptObserver = function (o) {
      return o.onCompleted();
    };

    OnCompletedNotification.prototype.toString = function () {
      return 'OnCompleted()';
    };

    return OnCompletedNotification;
  }(Notification));

  /**
   * Creates an object that represents an OnNext notification to an observer.
   * @param {Any} value The value contained in the notification.
   * @returns {Notification} The OnNext notification containing the value.
   */
  var notificationCreateOnNext = Notification.createOnNext = function (value) {
    return new OnNextNotification(value);
  };

  /**
   * Creates an object that represents an OnError notification to an observer.
   * @param {Any} error The exception contained in the notification.
   * @returns {Notification} The OnError notification containing the exception.
   */
  var notificationCreateOnError = Notification.createOnError = function (error) {
    return new OnErrorNotification(error);
  };

  /**
   * Creates an object that represents an OnCompleted notification to an observer.
   * @returns {Notification} The OnCompleted notification.
   */
  var notificationCreateOnCompleted = Notification.createOnCompleted = function () {
    return new OnCompletedNotification();
  };

  /**
   * Supports push-style iteration over an observable sequence.
   */
  var Observer = Rx.Observer = function () { };

  /**
   *  Creates a notification callback from an observer.
   * @returns The action that forwards its input notification to the underlying observer.
   */
  Observer.prototype.toNotifier = function () {
    var observer = this;
    return function (n) { return n.accept(observer); };
  };

  /**
   *  Hides the identity of an observer.
   * @returns An observer that hides the identity of the specified observer.
   */
  Observer.prototype.asObserver = function () {
    var self = this;
    return new AnonymousObserver(
      function (x) { self.onNext(x); },
      function (err) { self.onError(err); },
      function () { self.onCompleted(); });
  };

  /**
   *  Checks access to the observer for grammar violations. This includes checking for multiple OnError or OnCompleted calls, as well as reentrancy in any of the observer methods.
   *  If a violation is detected, an Error is thrown from the offending observer method call.
   * @returns An observer that checks callbacks invocations against the observer grammar and, if the checks pass, forwards those to the specified observer.
   */
  Observer.prototype.checked = function () { return new CheckedObserver(this); };

  /**
   *  Creates an observer from the specified OnNext, along with optional OnError, and OnCompleted actions.
   * @param {Function} [onNext] Observer's OnNext action implementation.
   * @param {Function} [onError] Observer's OnError action implementation.
   * @param {Function} [onCompleted] Observer's OnCompleted action implementation.
   * @returns {Observer} The observer object implemented using the given actions.
   */
  var observerCreate = Observer.create = function (onNext, onError, onCompleted) {
    onNext || (onNext = noop);
    onError || (onError = defaultError);
    onCompleted || (onCompleted = noop);
    return new AnonymousObserver(onNext, onError, onCompleted);
  };

  /**
   *  Creates an observer from a notification callback.
   * @param {Function} handler Action that handles a notification.
   * @returns The observer object that invokes the specified handler using a notification corresponding to each message it receives.
   */
  Observer.fromNotifier = function (handler, thisArg) {
    var cb = bindCallback(handler, thisArg, 1);
    return new AnonymousObserver(function (x) {
      return cb(notificationCreateOnNext(x));
    }, function (e) {
      return cb(notificationCreateOnError(e));
    }, function () {
      return cb(notificationCreateOnCompleted());
    });
  };

  /**
   * Schedules the invocation of observer methods on the given scheduler.
   * @param {Scheduler} scheduler Scheduler to schedule observer messages on.
   * @returns {Observer} Observer whose messages are scheduled on the given scheduler.
   */
  Observer.prototype.notifyOn = function (scheduler) {
    return new ObserveOnObserver(scheduler, this);
  };

  Observer.prototype.makeSafe = function(disposable) {
    return new AnonymousSafeObserver(this._onNext, this._onError, this._onCompleted, disposable);
  };

  /**
   * Abstract base class for implementations of the Observer class.
   * This base class enforces the grammar of observers where OnError and OnCompleted are terminal messages.
   */
  var AbstractObserver = Rx.internals.AbstractObserver = (function (__super__) {
    inherits(AbstractObserver, __super__);

    /**
     * Creates a new observer in a non-stopped state.
     */
    function AbstractObserver() {
      this.isStopped = false;
    }

    // Must be implemented by other observers
    AbstractObserver.prototype.next = notImplemented;
    AbstractObserver.prototype.error = notImplemented;
    AbstractObserver.prototype.completed = notImplemented;

    /**
     * Notifies the observer of a new element in the sequence.
     * @param {Any} value Next element in the sequence.
     */
    AbstractObserver.prototype.onNext = function (value) {
      !this.isStopped && this.next(value);
    };

    /**
     * Notifies the observer that an exception has occurred.
     * @param {Any} error The error that has occurred.
     */
    AbstractObserver.prototype.onError = function (error) {
      if (!this.isStopped) {
        this.isStopped = true;
        this.error(error);
      }
    };

    /**
     * Notifies the observer of the end of the sequence.
     */
    AbstractObserver.prototype.onCompleted = function () {
      if (!this.isStopped) {
        this.isStopped = true;
        this.completed();
      }
    };

    /**
     * Disposes the observer, causing it to transition to the stopped state.
     */
    AbstractObserver.prototype.dispose = function () { this.isStopped = true; };

    AbstractObserver.prototype.fail = function (e) {
      if (!this.isStopped) {
        this.isStopped = true;
        this.error(e);
        return true;
      }

      return false;
    };

    return AbstractObserver;
  }(Observer));

  /**
   * Class to create an Observer instance from delegate-based implementations of the on* methods.
   */
  var AnonymousObserver = Rx.AnonymousObserver = (function (__super__) {
    inherits(AnonymousObserver, __super__);

    /**
     * Creates an observer from the specified OnNext, OnError, and OnCompleted actions.
     * @param {Any} onNext Observer's OnNext action implementation.
     * @param {Any} onError Observer's OnError action implementation.
     * @param {Any} onCompleted Observer's OnCompleted action implementation.
     */
    function AnonymousObserver(onNext, onError, onCompleted) {
      __super__.call(this);
      this._onNext = onNext;
      this._onError = onError;
      this._onCompleted = onCompleted;
    }

    /**
     * Calls the onNext action.
     * @param {Any} value Next element in the sequence.
     */
    AnonymousObserver.prototype.next = function (value) {
      this._onNext(value);
    };

    /**
     * Calls the onError action.
     * @param {Any} error The error that has occurred.
     */
    AnonymousObserver.prototype.error = function (error) {
      this._onError(error);
    };

    /**
     *  Calls the onCompleted action.
     */
    AnonymousObserver.prototype.completed = function () {
      this._onCompleted();
    };

    return AnonymousObserver;
  }(AbstractObserver));

  var CheckedObserver = (function (__super__) {
    inherits(CheckedObserver, __super__);

    function CheckedObserver(observer) {
      __super__.call(this);
      this._observer = observer;
      this._state = 0; // 0 - idle, 1 - busy, 2 - done
    }

    var CheckedObserverPrototype = CheckedObserver.prototype;

    CheckedObserverPrototype.onNext = function (value) {
      this.checkAccess();
      var res = tryCatch(this._observer.onNext).call(this._observer, value);
      this._state = 0;
      res === errorObj && thrower(res.e);
    };

    CheckedObserverPrototype.onError = function (err) {
      this.checkAccess();
      var res = tryCatch(this._observer.onError).call(this._observer, err);
      this._state = 2;
      res === errorObj && thrower(res.e);
    };

    CheckedObserverPrototype.onCompleted = function () {
      this.checkAccess();
      var res = tryCatch(this._observer.onCompleted).call(this._observer);
      this._state = 2;
      res === errorObj && thrower(res.e);
    };

    CheckedObserverPrototype.checkAccess = function () {
      if (this._state === 1) { throw new Error('Re-entrancy detected'); }
      if (this._state === 2) { throw new Error('Observer completed'); }
      if (this._state === 0) { this._state = 1; }
    };

    return CheckedObserver;
  }(Observer));

  var ScheduledObserver = Rx.internals.ScheduledObserver = (function (__super__) {
    inherits(ScheduledObserver, __super__);

    function ScheduledObserver(scheduler, observer) {
      __super__.call(this);
      this.scheduler = scheduler;
      this.observer = observer;
      this.isAcquired = false;
      this.hasFaulted = false;
      this.queue = [];
      this.disposable = new SerialDisposable();
    }

    function enqueueNext(observer, x) { return function () { observer.onNext(x); }; }
    function enqueueError(observer, e) { return function () { observer.onError(e); }; }
    function enqueueCompleted(observer) { return function () { observer.onCompleted(); }; }

    ScheduledObserver.prototype.next = function (x) {
      this.queue.push(enqueueNext(this.observer, x));
    };

    ScheduledObserver.prototype.error = function (e) {
      this.queue.push(enqueueError(this.observer, e));
    };

    ScheduledObserver.prototype.completed = function () {
      this.queue.push(enqueueCompleted(this.observer));
    };


    function scheduleMethod(state, recurse) {
      var work;
      if (state.queue.length > 0) {
        work = state.queue.shift();
      } else {
        state.isAcquired = false;
        return;
      }
      var res = tryCatch(work)();
      if (res === errorObj) {
        state.queue = [];
        state.hasFaulted = true;
        return thrower(res.e);
      }
      recurse(state);
    }

    ScheduledObserver.prototype.ensureActive = function () {
      var isOwner = false;
      if (!this.hasFaulted && this.queue.length > 0) {
        isOwner = !this.isAcquired;
        this.isAcquired = true;
      }
      isOwner &&
        this.disposable.setDisposable(this.scheduler.scheduleRecursive(this, scheduleMethod));
    };

    ScheduledObserver.prototype.dispose = function () {
      __super__.prototype.dispose.call(this);
      this.disposable.dispose();
    };

    return ScheduledObserver;
  }(AbstractObserver));

  var ObserveOnObserver = (function (__super__) {
    inherits(ObserveOnObserver, __super__);

    function ObserveOnObserver(scheduler, observer, cancel) {
      __super__.call(this, scheduler, observer);
      this._cancel = cancel;
    }

    ObserveOnObserver.prototype.next = function (value) {
      __super__.prototype.next.call(this, value);
      this.ensureActive();
    };

    ObserveOnObserver.prototype.error = function (e) {
      __super__.prototype.error.call(this, e);
      this.ensureActive();
    };

    ObserveOnObserver.prototype.completed = function () {
      __super__.prototype.completed.call(this);
      this.ensureActive();
    };

    ObserveOnObserver.prototype.dispose = function () {
      __super__.prototype.dispose.call(this);
      this._cancel && this._cancel.dispose();
      this._cancel = null;
    };

    return ObserveOnObserver;
  })(ScheduledObserver);

  var observableProto;

  /**
   * Represents a push-style collection.
   */
  var Observable = Rx.Observable = (function () {

    function makeSubscribe(self, subscribe) {
      return function (o) {
        var oldOnError = o.onError;
        o.onError = function (e) {
          makeStackTraceLong(e, self);
          oldOnError.call(o, e);
        };

        return subscribe.call(self, o);
      };
    }

    function Observable() {
      if (Rx.config.longStackSupport && hasStacks) {
        var oldSubscribe = this._subscribe;
        var e = tryCatch(thrower)(new Error()).e;
        this.stack = e.stack.substring(e.stack.indexOf('\n') + 1);
        this._subscribe = makeSubscribe(this, oldSubscribe);
      }
    }

    observableProto = Observable.prototype;

    /**
    * Determines whether the given object is an Observable
    * @param {Any} An object to determine whether it is an Observable
    * @returns {Boolean} true if an Observable, else false.
    */
    Observable.isObservable = function (o) {
      return o && isFunction(o.subscribe);
    };

    /**
     *  Subscribes an o to the observable sequence.
     *  @param {Mixed} [oOrOnNext] The object that is to receive notifications or an action to invoke for each element in the observable sequence.
     *  @param {Function} [onError] Action to invoke upon exceptional termination of the observable sequence.
     *  @param {Function} [onCompleted] Action to invoke upon graceful termination of the observable sequence.
     *  @returns {Diposable} A disposable handling the subscriptions and unsubscriptions.
     */
    observableProto.subscribe = observableProto.forEach = function (oOrOnNext, onError, onCompleted) {
      return this._subscribe(typeof oOrOnNext === 'object' ?
        oOrOnNext :
        observerCreate(oOrOnNext, onError, onCompleted));
    };

    /**
     * Subscribes to the next value in the sequence with an optional "this" argument.
     * @param {Function} onNext The function to invoke on each element in the observable sequence.
     * @param {Any} [thisArg] Object to use as this when executing callback.
     * @returns {Disposable} A disposable handling the subscriptions and unsubscriptions.
     */
    observableProto.subscribeOnNext = function (onNext, thisArg) {
      return this._subscribe(observerCreate(typeof thisArg !== 'undefined' ? function(x) { onNext.call(thisArg, x); } : onNext));
    };

    /**
     * Subscribes to an exceptional condition in the sequence with an optional "this" argument.
     * @param {Function} onError The function to invoke upon exceptional termination of the observable sequence.
     * @param {Any} [thisArg] Object to use as this when executing callback.
     * @returns {Disposable} A disposable handling the subscriptions and unsubscriptions.
     */
    observableProto.subscribeOnError = function (onError, thisArg) {
      return this._subscribe(observerCreate(null, typeof thisArg !== 'undefined' ? function(e) { onError.call(thisArg, e); } : onError));
    };

    /**
     * Subscribes to the next value in the sequence with an optional "this" argument.
     * @param {Function} onCompleted The function to invoke upon graceful termination of the observable sequence.
     * @param {Any} [thisArg] Object to use as this when executing callback.
     * @returns {Disposable} A disposable handling the subscriptions and unsubscriptions.
     */
    observableProto.subscribeOnCompleted = function (onCompleted, thisArg) {
      return this._subscribe(observerCreate(null, null, typeof thisArg !== 'undefined' ? function() { onCompleted.call(thisArg); } : onCompleted));
    };

    return Observable;
  })();

  var ObservableBase = Rx.ObservableBase = (function (__super__) {
    inherits(ObservableBase, __super__);

    function fixSubscriber(subscriber) {
      return subscriber && isFunction(subscriber.dispose) ? subscriber :
        isFunction(subscriber) ? disposableCreate(subscriber) : disposableEmpty;
    }

    function setDisposable(s, state) {
      var ado = state[0], self = state[1];
      var sub = tryCatch(self.subscribeCore).call(self, ado);
      if (sub === errorObj && !ado.fail(errorObj.e)) { thrower(errorObj.e); }
      ado.setDisposable(fixSubscriber(sub));
    }

    function ObservableBase() {
      __super__.call(this);
    }

    ObservableBase.prototype._subscribe = function (o) {
      var ado = new AutoDetachObserver(o), state = [ado, this];

      if (currentThreadScheduler.scheduleRequired()) {
        currentThreadScheduler.schedule(state, setDisposable);
      } else {
        setDisposable(null, state);
      }
      return ado;
    };

    ObservableBase.prototype.subscribeCore = notImplemented;

    return ObservableBase;
  }(Observable));

var FlatMapObservable = Rx.FlatMapObservable = (function(__super__) {

    inherits(FlatMapObservable, __super__);

    function FlatMapObservable(source, selector, resultSelector, thisArg) {
      this.resultSelector = isFunction(resultSelector) ? resultSelector : null;
      this.selector = bindCallback(isFunction(selector) ? selector : function() { return selector; }, thisArg, 3);
      this.source = source;
      __super__.call(this);
    }

    FlatMapObservable.prototype.subscribeCore = function(o) {
      return this.source.subscribe(new InnerObserver(o, this.selector, this.resultSelector, this));
    };

    inherits(InnerObserver, AbstractObserver);
    function InnerObserver(observer, selector, resultSelector, source) {
      this.i = 0;
      this.selector = selector;
      this.resultSelector = resultSelector;
      this.source = source;
      this.o = observer;
      AbstractObserver.call(this);
    }

    InnerObserver.prototype._wrapResult = function(result, x, i) {
      return this.resultSelector ?
        result.map(function(y, i2) { return this.resultSelector(x, y, i, i2); }, this) :
        result;
    };

    InnerObserver.prototype.next = function(x) {
      var i = this.i++;
      var result = tryCatch(this.selector)(x, i, this.source);
      if (result === errorObj) { return this.o.onError(result.e); }

      isPromise(result) && (result = observableFromPromise(result));
      (isArrayLike(result) || isIterable(result)) && (result = Observable.from(result));
      this.o.onNext(this._wrapResult(result, x, i));
    };

    InnerObserver.prototype.error = function(e) { this.o.onError(e); };

    InnerObserver.prototype.completed = function() { this.o.onCompleted(); };

    return FlatMapObservable;

}(ObservableBase));

  var Enumerable = Rx.internals.Enumerable = function () { };

  function IsDisposedDisposable(state) {
    this._s = state;
    this.isDisposed = false;
  }

  IsDisposedDisposable.prototype.dispose = function () {
    if (!this.isDisposed) {
      this.isDisposed = true;
      this._s.isDisposed = true;
    }
  };

  var ConcatEnumerableObservable = (function(__super__) {
    inherits(ConcatEnumerableObservable, __super__);
    function ConcatEnumerableObservable(sources) {
      this.sources = sources;
      __super__.call(this);
    }

    function scheduleMethod(state, recurse) {
      if (state.isDisposed) { return; }
      var currentItem = tryCatch(state.e.next).call(state.e);
      if (currentItem === errorObj) { return state.o.onError(currentItem.e); }
      if (currentItem.done) { return state.o.onCompleted(); }

      // Check if promise
      var currentValue = currentItem.value;
      isPromise(currentValue) && (currentValue = observableFromPromise(currentValue));

      var d = new SingleAssignmentDisposable();
      state.subscription.setDisposable(d);
      d.setDisposable(currentValue.subscribe(new InnerObserver(state, recurse)));
    }

    ConcatEnumerableObservable.prototype.subscribeCore = function (o) {
      var subscription = new SerialDisposable();
      var state = {
        isDisposed: false,
        o: o,
        subscription: subscription,
        e: this.sources[$iterator$]()
      };

      var cancelable = currentThreadScheduler.scheduleRecursive(state, scheduleMethod);
      return new NAryDisposable([subscription, cancelable, new IsDisposedDisposable(state)]);
    };

    function InnerObserver(state, recurse) {
      this._state = state;
      this._recurse = recurse;
      AbstractObserver.call(this);
    }

    inherits(InnerObserver, AbstractObserver);

    InnerObserver.prototype.next = function (x) { this._state.o.onNext(x); };
    InnerObserver.prototype.error = function (e) { this._state.o.onError(e); };
    InnerObserver.prototype.completed = function () { this._recurse(this._state); };

    return ConcatEnumerableObservable;
  }(ObservableBase));

  Enumerable.prototype.concat = function () {
    return new ConcatEnumerableObservable(this);
  };

  var CatchErrorObservable = (function(__super__) {
    function CatchErrorObservable(sources) {
      this.sources = sources;
      __super__.call(this);
    }

    inherits(CatchErrorObservable, __super__);

    function scheduleMethod(state, recurse) {
      if (state.isDisposed) { return; }
      var currentItem = tryCatch(state.e.next).call(state.e);
      if (currentItem === errorObj) { return state.o.onError(currentItem.e); }
      if (currentItem.done) { return state.lastError !== null ? state.o.onError(state.lastError) : state.o.onCompleted(); }

      var currentValue = currentItem.value;
      isPromise(currentValue) && (currentValue = observableFromPromise(currentValue));

      var d = new SingleAssignmentDisposable();
      state.subscription.setDisposable(d);
      d.setDisposable(currentValue.subscribe(new InnerObserver(state, recurse)));
    }

    CatchErrorObservable.prototype.subscribeCore = function (o) {
      var subscription = new SerialDisposable();
      var state = {
        isDisposed: false,
        e: this.sources[$iterator$](),
        subscription: subscription,
        lastError: null,
        o: o
      };

      var cancelable = currentThreadScheduler.scheduleRecursive(state, scheduleMethod);
      return new NAryDisposable([subscription, cancelable, new IsDisposedDisposable(state)]);
    };

    function InnerObserver(state, recurse) {
      this._state = state;
      this._recurse = recurse;
      AbstractObserver.call(this);
    }

    inherits(InnerObserver, AbstractObserver);

    InnerObserver.prototype.next = function (x) { this._state.o.onNext(x); };
    InnerObserver.prototype.error = function (e) { this._state.lastError = e; this._recurse(this._state); };
    InnerObserver.prototype.completed = function () { this._state.o.onCompleted(); };

    return CatchErrorObservable;
  }(ObservableBase));

  Enumerable.prototype.catchError = function () {
    return new CatchErrorObservable(this);
  };

  var RepeatEnumerable = (function (__super__) {
    inherits(RepeatEnumerable, __super__);
    function RepeatEnumerable(v, c) {
      this.v = v;
      this.c = c == null ? -1 : c;
    }

    RepeatEnumerable.prototype[$iterator$] = function () {
      return new RepeatEnumerator(this);
    };

    function RepeatEnumerator(p) {
      this.v = p.v;
      this.l = p.c;
    }

    RepeatEnumerator.prototype.next = function () {
      if (this.l === 0) { return doneEnumerator; }
      if (this.l > 0) { this.l--; }
      return { done: false, value: this.v };
    };

    return RepeatEnumerable;
  }(Enumerable));

  var enumerableRepeat = Enumerable.repeat = function (value, repeatCount) {
    return new RepeatEnumerable(value, repeatCount);
  };

  var OfEnumerable = (function(__super__) {
    inherits(OfEnumerable, __super__);
    function OfEnumerable(s, fn, thisArg) {
      this.s = s;
      this.fn = fn ? bindCallback(fn, thisArg, 3) : null;
    }
    OfEnumerable.prototype[$iterator$] = function () {
      return new OfEnumerator(this);
    };

    function OfEnumerator(p) {
      this.i = -1;
      this.s = p.s;
      this.l = this.s.length;
      this.fn = p.fn;
    }

    OfEnumerator.prototype.next = function () {
     return ++this.i < this.l ?
       { done: false, value: !this.fn ? this.s[this.i] : this.fn(this.s[this.i], this.i, this.s) } :
       doneEnumerator;
    };

    return OfEnumerable;
  }(Enumerable));

  var enumerableOf = Enumerable.of = function (source, selector, thisArg) {
    return new OfEnumerable(source, selector, thisArg);
  };

var ObserveOnObservable = (function (__super__) {
  inherits(ObserveOnObservable, __super__);
  function ObserveOnObservable(source, s) {
    this.source = source;
    this._s = s;
    __super__.call(this);
  }

  ObserveOnObservable.prototype.subscribeCore = function (o) {
    return this.source.subscribe(new ObserveOnObserver(this._s, o));
  };

  return ObserveOnObservable;
}(ObservableBase));

   /**
   *  Wraps the source sequence in order to run its observer callbacks on the specified scheduler.
   *
   *  This only invokes observer callbacks on a scheduler. In case the subscription and/or unsubscription actions have side-effects
   *  that require to be run on a scheduler, use subscribeOn.
   *
   *  @param {Scheduler} scheduler Scheduler to notify observers on.
   *  @returns {Observable} The source sequence whose observations happen on the specified scheduler.
   */
  observableProto.observeOn = function (scheduler) {
    return new ObserveOnObservable(this, scheduler);
  };

  var SubscribeOnObservable = (function (__super__) {
    inherits(SubscribeOnObservable, __super__);
    function SubscribeOnObservable(source, s) {
      this.source = source;
      this._s = s;
      __super__.call(this);
    }

    function scheduleMethod(scheduler, state) {
      var source = state[0], d = state[1], o = state[2];
      d.setDisposable(new ScheduledDisposable(scheduler, source.subscribe(o)));
    }

    SubscribeOnObservable.prototype.subscribeCore = function (o) {
      var m = new SingleAssignmentDisposable(), d = new SerialDisposable();
      d.setDisposable(m);
      m.setDisposable(this._s.schedule([this.source, d, o], scheduleMethod));
      return d;
    };

    return SubscribeOnObservable;
  }(ObservableBase));

   /**
   *  Wraps the source sequence in order to run its subscription and unsubscription logic on the specified scheduler. This operation is not commonly used;
   *  see the remarks section for more information on the distinction between subscribeOn and observeOn.

   *  This only performs the side-effects of subscription and unsubscription on the specified scheduler. In order to invoke observer
   *  callbacks on a scheduler, use observeOn.

   *  @param {Scheduler} scheduler Scheduler to perform subscription and unsubscription actions on.
   *  @returns {Observable} The source sequence whose subscriptions and unsubscriptions happen on the specified scheduler.
   */
  observableProto.subscribeOn = function (scheduler) {
    return new SubscribeOnObservable(this, scheduler);
  };

  var FromPromiseObservable = (function(__super__) {
    inherits(FromPromiseObservable, __super__);
    function FromPromiseObservable(p, s) {
      this._p = p;
      this._s = s;
      __super__.call(this);
    }

    function scheduleNext(s, state) {
      var o = state[0], data = state[1];
      o.onNext(data);
      o.onCompleted();
    }

    function scheduleError(s, state) {
      var o = state[0], err = state[1];
      o.onError(err);
    }

    FromPromiseObservable.prototype.subscribeCore = function(o) {
      var sad = new SingleAssignmentDisposable(), self = this, p = this._p;

      if (isFunction(p)) {
        p = tryCatch(p)();
        if (p === errorObj) {
          o.onError(p.e);
          return sad;
        }
      }

      p
        .then(function (data) {
          sad.setDisposable(self._s.schedule([o, data], scheduleNext));
        }, function (err) {
          sad.setDisposable(self._s.schedule([o, err], scheduleError));
        });

      return sad;
    };

    return FromPromiseObservable;
  }(ObservableBase));

  /**
  * Converts a Promise to an Observable sequence
  * @param {Promise} An ES6 Compliant promise.
  * @returns {Observable} An Observable sequence which wraps the existing promise success and failure.
  */
  var observableFromPromise = Observable.fromPromise = function (promise, scheduler) {
    scheduler || (scheduler = defaultScheduler);
    return new FromPromiseObservable(promise, scheduler);
  };

  /*
   * Converts an existing observable sequence to an ES6 Compatible Promise
   * @example
   * var promise = Rx.Observable.return(42).toPromise(RSVP.Promise);
   *
   * // With config
   * Rx.config.Promise = RSVP.Promise;
   * var promise = Rx.Observable.return(42).toPromise();
   * @param {Function} [promiseCtor] The constructor of the promise. If not provided, it looks for it in Rx.config.Promise.
   * @returns {Promise} An ES6 compatible promise with the last value from the observable sequence.
   */
  observableProto.toPromise = function (promiseCtor) {
    promiseCtor || (promiseCtor = Rx.config.Promise);
    if (!promiseCtor) { throw new NotSupportedError('Promise type not provided nor in Rx.config.Promise'); }
    var source = this;
    return new promiseCtor(function (resolve, reject) {
      // No cancellation can be done
      var value;
      source.subscribe(function (v) {
        value = v;
      }, reject, function () {
        resolve(value);
      });
    });
  };

  var ToArrayObservable = (function(__super__) {
    inherits(ToArrayObservable, __super__);
    function ToArrayObservable(source) {
      this.source = source;
      __super__.call(this);
    }

    ToArrayObservable.prototype.subscribeCore = function(o) {
      return this.source.subscribe(new InnerObserver(o));
    };

    inherits(InnerObserver, AbstractObserver);
    function InnerObserver(o) {
      this.o = o;
      this.a = [];
      AbstractObserver.call(this);
    }
    
    InnerObserver.prototype.next = function (x) { this.a.push(x); };
    InnerObserver.prototype.error = function (e) { this.o.onError(e);  };
    InnerObserver.prototype.completed = function () { this.o.onNext(this.a); this.o.onCompleted(); };

    return ToArrayObservable;
  }(ObservableBase));

  /**
  * Creates an array from an observable sequence.
  * @returns {Observable} An observable sequence containing a single element with a list containing all the elements of the source sequence.
  */
  observableProto.toArray = function () {
    return new ToArrayObservable(this);
  };

  /**
   *  Creates an observable sequence from a specified subscribe method implementation.
   * @example
   *  var res = Rx.Observable.create(function (observer) { return function () { } );
   *  var res = Rx.Observable.create(function (observer) { return Rx.Disposable.empty; } );
   *  var res = Rx.Observable.create(function (observer) { } );
   * @param {Function} subscribe Implementation of the resulting observable sequence's subscribe method, returning a function that will be wrapped in a Disposable.
   * @returns {Observable} The observable sequence with the specified implementation for the Subscribe method.
   */
  Observable.create = function (subscribe, parent) {
    return new AnonymousObservable(subscribe, parent);
  };

  var Defer = (function(__super__) {
    inherits(Defer, __super__);
    function Defer(factory) {
      this._f = factory;
      __super__.call(this);
    }

    Defer.prototype.subscribeCore = function (o) {
      var result = tryCatch(this._f)();
      if (result === errorObj) { return observableThrow(result.e).subscribe(o);}
      isPromise(result) && (result = observableFromPromise(result));
      return result.subscribe(o);
    };

    return Defer;
  }(ObservableBase));

  /**
   *  Returns an observable sequence that invokes the specified factory function whenever a new observer subscribes.
   *
   * @example
   *  var res = Rx.Observable.defer(function () { return Rx.Observable.fromArray([1,2,3]); });
   * @param {Function} observableFactory Observable factory function to invoke for each observer that subscribes to the resulting sequence or Promise.
   * @returns {Observable} An observable sequence whose observers trigger an invocation of the given observable factory function.
   */
  var observableDefer = Observable.defer = function (observableFactory) {
    return new Defer(observableFactory);
  };

  var EmptyObservable = (function(__super__) {
    inherits(EmptyObservable, __super__);
    function EmptyObservable(scheduler) {
      this.scheduler = scheduler;
      __super__.call(this);
    }

    EmptyObservable.prototype.subscribeCore = function (observer) {
      var sink = new EmptySink(observer, this.scheduler);
      return sink.run();
    };

    function EmptySink(observer, scheduler) {
      this.observer = observer;
      this.scheduler = scheduler;
    }

    function scheduleItem(s, state) {
      state.onCompleted();
      return disposableEmpty;
    }

    EmptySink.prototype.run = function () {
      var state = this.observer;
      return this.scheduler === immediateScheduler ?
        scheduleItem(null, state) :
        this.scheduler.schedule(state, scheduleItem);
    };

    return EmptyObservable;
  }(ObservableBase));

  var EMPTY_OBSERVABLE = new EmptyObservable(immediateScheduler);

  /**
   *  Returns an empty observable sequence, using the specified scheduler to send out the single OnCompleted message.
   *
   * @example
   *  var res = Rx.Observable.empty();
   *  var res = Rx.Observable.empty(Rx.Scheduler.timeout);
   * @param {Scheduler} [scheduler] Scheduler to send the termination call on.
   * @returns {Observable} An observable sequence with no elements.
   */
  var observableEmpty = Observable.empty = function (scheduler) {
    isScheduler(scheduler) || (scheduler = immediateScheduler);
    return scheduler === immediateScheduler ? EMPTY_OBSERVABLE : new EmptyObservable(scheduler);
  };

  var FromObservable = (function(__super__) {
    inherits(FromObservable, __super__);
    function FromObservable(iterable, fn, scheduler) {
      this._iterable = iterable;
      this._fn = fn;
      this._scheduler = scheduler;
      __super__.call(this);
    }

    function createScheduleMethod(o, it, fn) {
      return function loopRecursive(i, recurse) {
        var next = tryCatch(it.next).call(it);
        if (next === errorObj) { return o.onError(next.e); }
        if (next.done) { return o.onCompleted(); }

        var result = next.value;

        if (isFunction(fn)) {
          result = tryCatch(fn)(result, i);
          if (result === errorObj) { return o.onError(result.e); }
        }

        o.onNext(result);
        recurse(i + 1);
      };
    }

    FromObservable.prototype.subscribeCore = function (o) {
      var list = Object(this._iterable),
          it = getIterable(list);

      return this._scheduler.scheduleRecursive(0, createScheduleMethod(o, it, this._fn));
    };

    return FromObservable;
  }(ObservableBase));

  var maxSafeInteger = Math.pow(2, 53) - 1;

  function StringIterable(s) {
    this._s = s;
  }

  StringIterable.prototype[$iterator$] = function () {
    return new StringIterator(this._s);
  };

  function StringIterator(s) {
    this._s = s;
    this._l = s.length;
    this._i = 0;
  }

  StringIterator.prototype[$iterator$] = function () {
    return this;
  };

  StringIterator.prototype.next = function () {
    return this._i < this._l ? { done: false, value: this._s.charAt(this._i++) } : doneEnumerator;
  };

  function ArrayIterable(a) {
    this._a = a;
  }

  ArrayIterable.prototype[$iterator$] = function () {
    return new ArrayIterator(this._a);
  };

  function ArrayIterator(a) {
    this._a = a;
    this._l = toLength(a);
    this._i = 0;
  }

  ArrayIterator.prototype[$iterator$] = function () {
    return this;
  };

  ArrayIterator.prototype.next = function () {
    return this._i < this._l ? { done: false, value: this._a[this._i++] } : doneEnumerator;
  };

  function numberIsFinite(value) {
    return typeof value === 'number' && root.isFinite(value);
  }

  function isNan(n) {
    return n !== n;
  }

  function getIterable(o) {
    var i = o[$iterator$], it;
    if (!i && typeof o === 'string') {
      it = new StringIterable(o);
      return it[$iterator$]();
    }
    if (!i && o.length !== undefined) {
      it = new ArrayIterable(o);
      return it[$iterator$]();
    }
    if (!i) { throw new TypeError('Object is not iterable'); }
    return o[$iterator$]();
  }

  function sign(value) {
    var number = +value;
    if (number === 0) { return number; }
    if (isNaN(number)) { return number; }
    return number < 0 ? -1 : 1;
  }

  function toLength(o) {
    var len = +o.length;
    if (isNaN(len)) { return 0; }
    if (len === 0 || !numberIsFinite(len)) { return len; }
    len = sign(len) * Math.floor(Math.abs(len));
    if (len <= 0) { return 0; }
    if (len > maxSafeInteger) { return maxSafeInteger; }
    return len;
  }

  /**
  * This method creates a new Observable sequence from an array-like or iterable object.
  * @param {Any} arrayLike An array-like or iterable object to convert to an Observable sequence.
  * @param {Function} [mapFn] Map function to call on every element of the array.
  * @param {Any} [thisArg] The context to use calling the mapFn if provided.
  * @param {Scheduler} [scheduler] Optional scheduler to use for scheduling.  If not provided, defaults to Scheduler.currentThread.
  */
  var observableFrom = Observable.from = function (iterable, mapFn, thisArg, scheduler) {
    if (iterable == null) {
      throw new Error('iterable cannot be null.')
    }
    if (mapFn && !isFunction(mapFn)) {
      throw new Error('mapFn when provided must be a function');
    }
    if (mapFn) {
      var mapper = bindCallback(mapFn, thisArg, 2);
    }
    isScheduler(scheduler) || (scheduler = currentThreadScheduler);
    return new FromObservable(iterable, mapper, scheduler);
  }

  var FromArrayObservable = (function(__super__) {
    inherits(FromArrayObservable, __super__);
    function FromArrayObservable(args, scheduler) {
      this._args = args;
      this._scheduler = scheduler;
      __super__.call(this);
    }

    function scheduleMethod(o, args) {
      var len = args.length;
      return function loopRecursive (i, recurse) {
        if (i < len) {
          o.onNext(args[i]);
          recurse(i + 1);
        } else {
          o.onCompleted();
        }
      };
    }

    FromArrayObservable.prototype.subscribeCore = function (o) {
      return this._scheduler.scheduleRecursive(0, scheduleMethod(o, this._args));
    };

    return FromArrayObservable;
  }(ObservableBase));

  /**
  *  Converts an array to an observable sequence, using an optional scheduler to enumerate the array.
  * @deprecated use Observable.from or Observable.of
  * @param {Scheduler} [scheduler] Scheduler to run the enumeration of the input sequence on.
  * @returns {Observable} The observable sequence whose elements are pulled from the given enumerable sequence.
  */
  var observableFromArray = Observable.fromArray = function (array, scheduler) {
    isScheduler(scheduler) || (scheduler = currentThreadScheduler);
    return new FromArrayObservable(array, scheduler)
  };

  var GenerateObservable = (function (__super__) {
    inherits(GenerateObservable, __super__);
    function GenerateObservable(state, cndFn, itrFn, resFn, s) {
      this._initialState = state;
      this._cndFn = cndFn;
      this._itrFn = itrFn;
      this._resFn = resFn;
      this._s = s;
      __super__.call(this);
    }

    function scheduleRecursive(state, recurse) {
      if (state.first) {
        state.first = false;
      } else {
        state.newState = tryCatch(state.self._itrFn)(state.newState);
        if (state.newState === errorObj) { return state.o.onError(state.newState.e); }
      }
      var hasResult = tryCatch(state.self._cndFn)(state.newState);
      if (hasResult === errorObj) { return state.o.onError(hasResult.e); }
      if (hasResult) {
        var result = tryCatch(state.self._resFn)(state.newState);
        if (result === errorObj) { return state.o.onError(result.e); }
        state.o.onNext(result);
        recurse(state);
      } else {
        state.o.onCompleted();
      }
    }

    GenerateObservable.prototype.subscribeCore = function (o) {
      var state = {
        o: o,
        self: this,
        first: true,
        newState: this._initialState
      };
      return this._s.scheduleRecursive(state, scheduleRecursive);
    };

    return GenerateObservable;
  }(ObservableBase));

  /**
   *  Generates an observable sequence by running a state-driven loop producing the sequence's elements, using the specified scheduler to send out observer messages.
   *
   * @example
   *  var res = Rx.Observable.generate(0, function (x) { return x < 10; }, function (x) { return x + 1; }, function (x) { return x; });
   *  var res = Rx.Observable.generate(0, function (x) { return x < 10; }, function (x) { return x + 1; }, function (x) { return x; }, Rx.Scheduler.timeout);
   * @param {Mixed} initialState Initial state.
   * @param {Function} condition Condition to terminate generation (upon returning false).
   * @param {Function} iterate Iteration step function.
   * @param {Function} resultSelector Selector function for results produced in the sequence.
   * @param {Scheduler} [scheduler] Scheduler on which to run the generator loop. If not provided, defaults to Scheduler.currentThread.
   * @returns {Observable} The generated sequence.
   */
  Observable.generate = function (initialState, condition, iterate, resultSelector, scheduler) {
    isScheduler(scheduler) || (scheduler = currentThreadScheduler);
    return new GenerateObservable(initialState, condition, iterate, resultSelector, scheduler);
  };

  var NeverObservable = (function(__super__) {
    inherits(NeverObservable, __super__);
    function NeverObservable() {
      __super__.call(this);
    }

    NeverObservable.prototype.subscribeCore = function (observer) {
      return disposableEmpty;
    };

    return NeverObservable;
  }(ObservableBase));

  var NEVER_OBSERVABLE = new NeverObservable();

  /**
   * Returns a non-terminating observable sequence, which can be used to denote an infinite duration (e.g. when using reactive joins).
   * @returns {Observable} An observable sequence whose observers will never get called.
   */
  var observableNever = Observable.never = function () {
    return NEVER_OBSERVABLE;
  };

  function observableOf (scheduler, array) {
    isScheduler(scheduler) || (scheduler = currentThreadScheduler);
    return new FromArrayObservable(array, scheduler);
  }

  /**
  *  This method creates a new Observable instance with a variable number of arguments, regardless of number or type of the arguments.
  * @returns {Observable} The observable sequence whose elements are pulled from the given arguments.
  */
  Observable.of = function () {
    var len = arguments.length, args = new Array(len);
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    return new FromArrayObservable(args, currentThreadScheduler);
  };

  /**
  *  This method creates a new Observable instance with a variable number of arguments, regardless of number or type of the arguments.
  * @param {Scheduler} scheduler A scheduler to use for scheduling the arguments.
  * @returns {Observable} The observable sequence whose elements are pulled from the given arguments.
  */
  Observable.ofWithScheduler = function (scheduler) {
    var len = arguments.length, args = new Array(len - 1);
    for(var i = 1; i < len; i++) { args[i - 1] = arguments[i]; }
    return new FromArrayObservable(args, scheduler);
  };

  var PairsObservable = (function(__super__) {
    inherits(PairsObservable, __super__);
    function PairsObservable(o, scheduler) {
      this._o = o;
      this._keys = Object.keys(o);
      this._scheduler = scheduler;
      __super__.call(this);
    }

    function scheduleMethod(o, obj, keys) {
      return function loopRecursive(i, recurse) {
        if (i < keys.length) {
          var key = keys[i];
          o.onNext([key, obj[key]]);
          recurse(i + 1);
        } else {
          o.onCompleted();
        }
      };
    }

    PairsObservable.prototype.subscribeCore = function (o) {
      return this._scheduler.scheduleRecursive(0, scheduleMethod(o, this._o, this._keys));
    };

    return PairsObservable;
  }(ObservableBase));

  /**
   * Convert an object into an observable sequence of [key, value] pairs.
   * @param {Object} obj The object to inspect.
   * @param {Scheduler} [scheduler] Scheduler to run the enumeration of the input sequence on.
   * @returns {Observable} An observable sequence of [key, value] pairs from the object.
   */
  Observable.pairs = function (obj, scheduler) {
    scheduler || (scheduler = currentThreadScheduler);
    return new PairsObservable(obj, scheduler);
  };

    var RangeObservable = (function(__super__) {
    inherits(RangeObservable, __super__);
    function RangeObservable(start, count, scheduler) {
      this.start = start;
      this.rangeCount = count;
      this.scheduler = scheduler;
      __super__.call(this);
    }

    function loopRecursive(start, count, o) {
      return function loop (i, recurse) {
        if (i < count) {
          o.onNext(start + i);
          recurse(i + 1);
        } else {
          o.onCompleted();
        }
      };
    }

    RangeObservable.prototype.subscribeCore = function (o) {
      return this.scheduler.scheduleRecursive(
        0,
        loopRecursive(this.start, this.rangeCount, o)
      );
    };

    return RangeObservable;
  }(ObservableBase));

  /**
  *  Generates an observable sequence of integral numbers within a specified range, using the specified scheduler to send out observer messages.
  * @param {Number} start The value of the first integer in the sequence.
  * @param {Number} count The number of sequential integers to generate.
  * @param {Scheduler} [scheduler] Scheduler to run the generator loop on. If not specified, defaults to Scheduler.currentThread.
  * @returns {Observable} An observable sequence that contains a range of sequential integral numbers.
  */
  Observable.range = function (start, count, scheduler) {
    isScheduler(scheduler) || (scheduler = currentThreadScheduler);
    return new RangeObservable(start, count, scheduler);
  };

  var RepeatObservable = (function(__super__) {
    inherits(RepeatObservable, __super__);
    function RepeatObservable(value, repeatCount, scheduler) {
      this.value = value;
      this.repeatCount = repeatCount == null ? -1 : repeatCount;
      this.scheduler = scheduler;
      __super__.call(this);
    }

    RepeatObservable.prototype.subscribeCore = function (observer) {
      var sink = new RepeatSink(observer, this);
      return sink.run();
    };

    return RepeatObservable;
  }(ObservableBase));

  function RepeatSink(observer, parent) {
    this.observer = observer;
    this.parent = parent;
  }

  RepeatSink.prototype.run = function () {
    var observer = this.observer, value = this.parent.value;
    function loopRecursive(i, recurse) {
      if (i === -1 || i > 0) {
        observer.onNext(value);
        i > 0 && i--;
      }
      if (i === 0) { return observer.onCompleted(); }
      recurse(i);
    }

    return this.parent.scheduler.scheduleRecursive(this.parent.repeatCount, loopRecursive);
  };

  /**
   *  Generates an observable sequence that repeats the given element the specified number of times, using the specified scheduler to send out observer messages.
   * @param {Mixed} value Element to repeat.
   * @param {Number} repeatCount [Optiona] Number of times to repeat the element. If not specified, repeats indefinitely.
   * @param {Scheduler} scheduler Scheduler to run the producer loop on. If not specified, defaults to Scheduler.immediate.
   * @returns {Observable} An observable sequence that repeats the given element the specified number of times.
   */
  Observable.repeat = function (value, repeatCount, scheduler) {
    isScheduler(scheduler) || (scheduler = currentThreadScheduler);
    return new RepeatObservable(value, repeatCount, scheduler);
  };

  var JustObservable = (function(__super__) {
    inherits(JustObservable, __super__);
    function JustObservable(value, scheduler) {
      this._value = value;
      this._scheduler = scheduler;
      __super__.call(this);
    }

    JustObservable.prototype.subscribeCore = function (o) {
      var state = [this._value, o];
      return this._scheduler === immediateScheduler ?
        scheduleItem(null, state) :
        this._scheduler.schedule(state, scheduleItem);
    };

    function scheduleItem(s, state) {
      var value = state[0], observer = state[1];
      observer.onNext(value);
      observer.onCompleted();
      return disposableEmpty;
    }

    return JustObservable;
  }(ObservableBase));

  /**
   *  Returns an observable sequence that contains a single element, using the specified scheduler to send out observer messages.
   *  There is an alias called 'just' or browsers <IE9.
   * @param {Mixed} value Single element in the resulting observable sequence.
   * @param {Scheduler} scheduler Scheduler to send the single element on. If not specified, defaults to Scheduler.immediate.
   * @returns {Observable} An observable sequence containing the single specified element.
   */
  var observableReturn = Observable['return'] = Observable.just = function (value, scheduler) {
    isScheduler(scheduler) || (scheduler = immediateScheduler);
    return new JustObservable(value, scheduler);
  };

  var ThrowObservable = (function(__super__) {
    inherits(ThrowObservable, __super__);
    function ThrowObservable(error, scheduler) {
      this._error = error;
      this._scheduler = scheduler;
      __super__.call(this);
    }

    ThrowObservable.prototype.subscribeCore = function (o) {
      var state = [this._error, o];
      return this._scheduler === immediateScheduler ?
        scheduleItem(null, state) :
        this._scheduler.schedule(state, scheduleItem);
    };

    function scheduleItem(s, state) {
      var e = state[0], o = state[1];
      o.onError(e);
      return disposableEmpty;
    }

    return ThrowObservable;
  }(ObservableBase));

  /**
   *  Returns an observable sequence that terminates with an exception, using the specified scheduler to send out the single onError message.
   *  There is an alias to this method called 'throwError' for browsers <IE9.
   * @param {Mixed} error An object used for the sequence's termination.
   * @param {Scheduler} scheduler Scheduler to send the exceptional termination call on. If not specified, defaults to Scheduler.immediate.
   * @returns {Observable} The observable sequence that terminates exceptionally with the specified exception object.
   */
  var observableThrow = Observable['throw'] = function (error, scheduler) {
    isScheduler(scheduler) || (scheduler = immediateScheduler);
    return new ThrowObservable(error, scheduler);
  };

  var UsingObservable = (function (__super__) {
    inherits(UsingObservable, __super__);
    function UsingObservable(resFn, obsFn) {
      this._resFn = resFn;
      this._obsFn = obsFn;
      __super__.call(this);
    }

    UsingObservable.prototype.subscribeCore = function (o) {
      var disposable = disposableEmpty;
      var resource = tryCatch(this._resFn)();
      if (resource === errorObj) {
        return new BinaryDisposable(observableThrow(resource.e).subscribe(o), disposable);
      }
      resource && (disposable = resource);
      var source = tryCatch(this._obsFn)(resource);
      if (source === errorObj) {
        return new BinaryDisposable(observableThrow(source.e).subscribe(o), disposable);
      }
      return new BinaryDisposable(source.subscribe(o), disposable);
    };

    return UsingObservable;
  }(ObservableBase));

  /**
   * Constructs an observable sequence that depends on a resource object, whose lifetime is tied to the resulting observable sequence's lifetime.
   * @param {Function} resourceFactory Factory function to obtain a resource object.
   * @param {Function} observableFactory Factory function to obtain an observable sequence that depends on the obtained resource.
   * @returns {Observable} An observable sequence whose lifetime controls the lifetime of the dependent resource object.
   */
  Observable.using = function (resourceFactory, observableFactory) {
    return new UsingObservable(resourceFactory, observableFactory);
  };

  /**
   * Propagates the observable sequence or Promise that reacts first.
   * @param {Observable} rightSource Second observable sequence or Promise.
   * @returns {Observable} {Observable} An observable sequence that surfaces either of the given sequences, whichever reacted first.
   */
  observableProto.amb = function (rightSource) {
    var leftSource = this;
    return new AnonymousObservable(function (observer) {
      var choice,
        leftChoice = 'L', rightChoice = 'R',
        leftSubscription = new SingleAssignmentDisposable(),
        rightSubscription = new SingleAssignmentDisposable();

      isPromise(rightSource) && (rightSource = observableFromPromise(rightSource));

      function choiceL() {
        if (!choice) {
          choice = leftChoice;
          rightSubscription.dispose();
        }
      }

      function choiceR() {
        if (!choice) {
          choice = rightChoice;
          leftSubscription.dispose();
        }
      }

      var leftSubscribe = observerCreate(
        function (left) {
          choiceL();
          choice === leftChoice && observer.onNext(left);
        },
        function (e) {
          choiceL();
          choice === leftChoice && observer.onError(e);
        },
        function () {
          choiceL();
          choice === leftChoice && observer.onCompleted();
        }
      );
      var rightSubscribe = observerCreate(
        function (right) {
          choiceR();
          choice === rightChoice && observer.onNext(right);
        },
        function (e) {
          choiceR();
          choice === rightChoice && observer.onError(e);
        },
        function () {
          choiceR();
          choice === rightChoice && observer.onCompleted();
        }
      );

      leftSubscription.setDisposable(leftSource.subscribe(leftSubscribe));
      rightSubscription.setDisposable(rightSource.subscribe(rightSubscribe));

      return new BinaryDisposable(leftSubscription, rightSubscription);
    });
  };

  function amb(p, c) { return p.amb(c); }

  /**
   * Propagates the observable sequence or Promise that reacts first.
   * @returns {Observable} An observable sequence that surfaces any of the given sequences, whichever reacted first.
   */
  Observable.amb = function () {
    var acc = observableNever(), items;
    if (Array.isArray(arguments[0])) {
      items = arguments[0];
    } else {
      var len = arguments.length;
      items = new Array(items);
      for(var i = 0; i < len; i++) { items[i] = arguments[i]; }
    }
    for (var i = 0, len = items.length; i < len; i++) {
      acc = amb(acc, items[i]);
    }
    return acc;
  };

  var CatchObservable = (function (__super__) {
    inherits(CatchObservable, __super__);
    function CatchObservable(source, fn) {
      this.source = source;
      this._fn = fn;
      __super__.call(this);
    }

    CatchObservable.prototype.subscribeCore = function (o) {
      var d1 = new SingleAssignmentDisposable(), subscription = new SerialDisposable();
      subscription.setDisposable(d1);
      d1.setDisposable(this.source.subscribe(new CatchObserver(o, subscription, this._fn)));
      return subscription;
    };

    return CatchObservable;
  }(ObservableBase));

  var CatchObserver = (function(__super__) {
    inherits(CatchObserver, __super__);
    function CatchObserver(o, s, fn) {
      this._o = o;
      this._s = s;
      this._fn = fn;
      __super__.call(this);
    }

    CatchObserver.prototype.next = function (x) { this._o.onNext(x); };
    CatchObserver.prototype.completed = function () { return this._o.onCompleted(); };
    CatchObserver.prototype.error = function (e) {
      var result = tryCatch(this._fn)(e);
      if (result === errorObj) { return this._o.onError(result.e); }
      isPromise(result) && (result = observableFromPromise(result));

      var d = new SingleAssignmentDisposable();
      this._s.setDisposable(d);
      d.setDisposable(result.subscribe(this._o));
    };

    return CatchObserver;
  }(AbstractObserver));

  /**
   * Continues an observable sequence that is terminated by an exception with the next observable sequence.
   * @param {Mixed} handlerOrSecond Exception handler function that returns an observable sequence given the error that occurred in the first sequence, or a second observable sequence used to produce results when an error occurred in the first sequence.
   * @returns {Observable} An observable sequence containing the first sequence's elements, followed by the elements of the handler sequence in case an exception occurred.
   */
  observableProto['catch'] = function (handlerOrSecond) {
    return isFunction(handlerOrSecond) ? new CatchObservable(this, handlerOrSecond) : observableCatch([this, handlerOrSecond]);
  };

  /**
   * Continues an observable sequence that is terminated by an exception with the next observable sequence.
   * @param {Array | Arguments} args Arguments or an array to use as the next sequence if an error occurs.
   * @returns {Observable} An observable sequence containing elements from consecutive source sequences until a source sequence terminates successfully.
   */
  var observableCatch = Observable['catch'] = function () {
    var items;
    if (Array.isArray(arguments[0])) {
      items = arguments[0];
    } else {
      var len = arguments.length;
      items = new Array(len);
      for(var i = 0; i < len; i++) { items[i] = arguments[i]; }
    }
    return enumerableOf(items).catchError();
  };

  /**
   * Merges the specified observable sequences into one observable sequence by using the selector function whenever any of the observable sequences or Promises produces an element.
   * This can be in the form of an argument list of observables or an array.
   *
   * @example
   * 1 - obs = observable.combineLatest(obs1, obs2, obs3, function (o1, o2, o3) { return o1 + o2 + o3; });
   * 2 - obs = observable.combineLatest([obs1, obs2, obs3], function (o1, o2, o3) { return o1 + o2 + o3; });
   * @returns {Observable} An observable sequence containing the result of combining elements of the sources using the specified result selector function.
   */
  observableProto.combineLatest = function () {
    var len = arguments.length, args = new Array(len);
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    if (Array.isArray(args[0])) {
      args[0].unshift(this);
    } else {
      args.unshift(this);
    }
    return combineLatest.apply(this, args);
  };

  function falseFactory() { return false; }
  function argumentsToArray() {
    var len = arguments.length, args = new Array(len);
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    return args;
  }

  var CombineLatestObservable = (function(__super__) {
    inherits(CombineLatestObservable, __super__);
    function CombineLatestObservable(params, cb) {
      this._params = params;
      this._cb = cb;
      __super__.call(this);
    }

    CombineLatestObservable.prototype.subscribeCore = function(observer) {
      var len = this._params.length,
          subscriptions = new Array(len);

      var state = {
        hasValue: arrayInitialize(len, falseFactory),
        hasValueAll: false,
        isDone: arrayInitialize(len, falseFactory),
        values: new Array(len)
      };

      for (var i = 0; i < len; i++) {
        var source = this._params[i], sad = new SingleAssignmentDisposable();
        subscriptions[i] = sad;
        isPromise(source) && (source = observableFromPromise(source));
        sad.setDisposable(source.subscribe(new CombineLatestObserver(observer, i, this._cb, state)));
      }

      return new NAryDisposable(subscriptions);
    };

    return CombineLatestObservable;
  }(ObservableBase));

  var CombineLatestObserver = (function (__super__) {
    inherits(CombineLatestObserver, __super__);
    function CombineLatestObserver(o, i, cb, state) {
      this._o = o;
      this._i = i;
      this._cb = cb;
      this._state = state;
      __super__.call(this);
    }

    function notTheSame(i) {
      return function (x, j) {
        return j !== i;
      };
    }

    CombineLatestObserver.prototype.next = function (x) {
      this._state.values[this._i] = x;
      this._state.hasValue[this._i] = true;
      if (this._state.hasValueAll || (this._state.hasValueAll = this._state.hasValue.every(identity))) {
        var res = tryCatch(this._cb).apply(null, this._state.values);
        if (res === errorObj) { return this._o.onError(res.e); }
        this._o.onNext(res);
      } else if (this._state.isDone.filter(notTheSame(this._i)).every(identity)) {
        this._o.onCompleted();
      }
    };

    CombineLatestObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    CombineLatestObserver.prototype.completed = function () {
      this._state.isDone[this._i] = true;
      this._state.isDone.every(identity) && this._o.onCompleted();
    };

    return CombineLatestObserver;
  }(AbstractObserver));

  /**
  * Merges the specified observable sequences into one observable sequence by using the selector function whenever any of the observable sequences or Promises produces an element.
  *
  * @example
  * 1 - obs = Rx.Observable.combineLatest(obs1, obs2, obs3, function (o1, o2, o3) { return o1 + o2 + o3; });
  * 2 - obs = Rx.Observable.combineLatest([obs1, obs2, obs3], function (o1, o2, o3) { return o1 + o2 + o3; });
  * @returns {Observable} An observable sequence containing the result of combining elements of the sources using the specified result selector function.
  */
  var combineLatest = Observable.combineLatest = function () {
    var len = arguments.length, args = new Array(len);
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    var resultSelector = isFunction(args[len - 1]) ? args.pop() : argumentsToArray;
    Array.isArray(args[0]) && (args = args[0]);
    return new CombineLatestObservable(args, resultSelector);
  };

  /**
   * Concatenates all the observable sequences.  This takes in either an array or variable arguments to concatenate.
   * @returns {Observable} An observable sequence that contains the elements of each given sequence, in sequential order.
   */
  observableProto.concat = function () {
    for(var args = [], i = 0, len = arguments.length; i < len; i++) { args.push(arguments[i]); }
    args.unshift(this);
    return observableConcat.apply(null, args);
  };

  var ConcatObserver = (function(__super__) {
    inherits(ConcatObserver, __super__);
    function ConcatObserver(s, fn) {
      this._s = s;
      this._fn = fn;
      __super__.call(this);
    }

    ConcatObserver.prototype.next = function (x) { this._s.o.onNext(x); };
    ConcatObserver.prototype.error = function (e) { this._s.o.onError(e); };
    ConcatObserver.prototype.completed = function () { this._s.i++; this._fn(this._s); };

    return ConcatObserver;
  }(AbstractObserver));

  var ConcatObservable = (function(__super__) {
    inherits(ConcatObservable, __super__);
    function ConcatObservable(sources) {
      this._sources = sources;
      __super__.call(this);
    }

    function scheduleRecursive (state, recurse) {
      if (state.disposable.isDisposed) { return; }
      if (state.i === state.sources.length) { return state.o.onCompleted(); }

      // Check if promise
      var currentValue = state.sources[state.i];
      isPromise(currentValue) && (currentValue = observableFromPromise(currentValue));

      var d = new SingleAssignmentDisposable();
      state.subscription.setDisposable(d);
      d.setDisposable(currentValue.subscribe(new ConcatObserver(state, recurse)));
    }

    ConcatObservable.prototype.subscribeCore = function(o) {
      var subscription = new SerialDisposable();
      var disposable = disposableCreate(noop);
      var state = {
        o: o,
        i: 0,
        subscription: subscription,
        disposable: disposable,
        sources: this._sources
      };

      var cancelable = immediateScheduler.scheduleRecursive(state, scheduleRecursive);
      return new NAryDisposable([subscription, disposable, cancelable]);
    };

    return ConcatObservable;
  }(ObservableBase));

  /**
   * Concatenates all the observable sequences.
   * @param {Array | Arguments} args Arguments or an array to concat to the observable sequence.
   * @returns {Observable} An observable sequence that contains the elements of each given sequence, in sequential order.
   */
  var observableConcat = Observable.concat = function () {
    var args;
    if (Array.isArray(arguments[0])) {
      args = arguments[0];
    } else {
      args = new Array(arguments.length);
      for(var i = 0, len = arguments.length; i < len; i++) { args[i] = arguments[i]; }
    }
    return new ConcatObservable(args);
  };

  /**
   * Concatenates an observable sequence of observable sequences.
   * @returns {Observable} An observable sequence that contains the elements of each observed inner sequence, in sequential order.
   */
  observableProto.concatAll = function () {
    return this.merge(1);
  };

  var MergeObservable = (function (__super__) {
    inherits(MergeObservable, __super__);

    function MergeObservable(source, maxConcurrent) {
      this.source = source;
      this.maxConcurrent = maxConcurrent;
      __super__.call(this);
    }

    MergeObservable.prototype.subscribeCore = function(observer) {
      var g = new CompositeDisposable();
      g.add(this.source.subscribe(new MergeObserver(observer, this.maxConcurrent, g)));
      return g;
    };

    return MergeObservable;

  }(ObservableBase));

  var MergeObserver = (function (__super__) {
    function MergeObserver(o, max, g) {
      this.o = o;
      this.max = max;
      this.g = g;
      this.done = false;
      this.q = [];
      this.activeCount = 0;
      __super__.call(this);
    }

    inherits(MergeObserver, __super__);

    MergeObserver.prototype.handleSubscribe = function (xs) {
      var sad = new SingleAssignmentDisposable();
      this.g.add(sad);
      isPromise(xs) && (xs = observableFromPromise(xs));
      sad.setDisposable(xs.subscribe(new InnerObserver(this, sad)));
    };

    MergeObserver.prototype.next = function (innerSource) {
      if(this.activeCount < this.max) {
        this.activeCount++;
        this.handleSubscribe(innerSource);
      } else {
        this.q.push(innerSource);
      }
    };
    MergeObserver.prototype.error = function (e) { this.o.onError(e); };
    MergeObserver.prototype.completed = function () { this.done = true; this.activeCount === 0 && this.o.onCompleted(); };

    function InnerObserver(parent, sad) {
      this.parent = parent;
      this.sad = sad;
      __super__.call(this);
    }

    inherits(InnerObserver, __super__);

    InnerObserver.prototype.next = function (x) { this.parent.o.onNext(x); };
    InnerObserver.prototype.error = function (e) { this.parent.o.onError(e); };
    InnerObserver.prototype.completed = function () {
      this.parent.g.remove(this.sad);
      if (this.parent.q.length > 0) {
        this.parent.handleSubscribe(this.parent.q.shift());
      } else {
        this.parent.activeCount--;
        this.parent.done && this.parent.activeCount === 0 && this.parent.o.onCompleted();
      }
    };

    return MergeObserver;
  }(AbstractObserver));

  /**
  * Merges an observable sequence of observable sequences into an observable sequence, limiting the number of concurrent subscriptions to inner sequences.
  * Or merges two observable sequences into a single observable sequence.
  * @param {Mixed} [maxConcurrentOrOther] Maximum number of inner observable sequences being subscribed to concurrently or the second observable sequence.
  * @returns {Observable} The observable sequence that merges the elements of the inner sequences.
  */
  observableProto.merge = function (maxConcurrentOrOther) {
    return typeof maxConcurrentOrOther !== 'number' ?
      observableMerge(this, maxConcurrentOrOther) :
      new MergeObservable(this, maxConcurrentOrOther);
  };

  /**
   * Merges all the observable sequences into a single observable sequence.
   * The scheduler is optional and if not specified, the immediate scheduler is used.
   * @returns {Observable} The observable sequence that merges the elements of the observable sequences.
   */
  var observableMerge = Observable.merge = function () {
    var scheduler, sources = [], i, len = arguments.length;
    if (!arguments[0]) {
      scheduler = immediateScheduler;
      for(i = 1; i < len; i++) { sources.push(arguments[i]); }
    } else if (isScheduler(arguments[0])) {
      scheduler = arguments[0];
      for(i = 1; i < len; i++) { sources.push(arguments[i]); }
    } else {
      scheduler = immediateScheduler;
      for(i = 0; i < len; i++) { sources.push(arguments[i]); }
    }
    if (Array.isArray(sources[0])) {
      sources = sources[0];
    }
    return observableOf(scheduler, sources).mergeAll();
  };

  var CompositeError = Rx.CompositeError = function(errors) {
    this.innerErrors = errors;
    this.message = 'This contains multiple errors. Check the innerErrors';
    Error.call(this);
  };
  CompositeError.prototype = Object.create(Error.prototype);
  CompositeError.prototype.name = 'CompositeError';

  var MergeDelayErrorObservable = (function(__super__) {
    inherits(MergeDelayErrorObservable, __super__);
    function MergeDelayErrorObservable(source) {
      this.source = source;
      __super__.call(this);
    }

    MergeDelayErrorObservable.prototype.subscribeCore = function (o) {
      var group = new CompositeDisposable(),
        m = new SingleAssignmentDisposable(),
        state = { isStopped: false, errors: [], o: o };

      group.add(m);
      m.setDisposable(this.source.subscribe(new MergeDelayErrorObserver(group, state)));

      return group;
    };

    return MergeDelayErrorObservable;
  }(ObservableBase));

  var MergeDelayErrorObserver = (function(__super__) {
    inherits(MergeDelayErrorObserver, __super__);
    function MergeDelayErrorObserver(group, state) {
      this._group = group;
      this._state = state;
      __super__.call(this);
    }

    function setCompletion(o, errors) {
      if (errors.length === 0) {
        o.onCompleted();
      } else if (errors.length === 1) {
        o.onError(errors[0]);
      } else {
        o.onError(new CompositeError(errors));
      }
    }

    MergeDelayErrorObserver.prototype.next = function (x) {
      var inner = new SingleAssignmentDisposable();
      this._group.add(inner);

      // Check for promises support
      isPromise(x) && (x = observableFromPromise(x));
      inner.setDisposable(x.subscribe(new InnerObserver(inner, this._group, this._state)));
    };

    MergeDelayErrorObserver.prototype.error = function (e) {
      this._state.errors.push(e);
      this._state.isStopped = true;
      this._group.length === 1 && setCompletion(this._state.o, this._state.errors);
    };

    MergeDelayErrorObserver.prototype.completed = function () {
      this._state.isStopped = true;
      this._group.length === 1 && setCompletion(this._state.o, this._state.errors);
    };

    inherits(InnerObserver, __super__);
    function InnerObserver(inner, group, state) {
      this._inner = inner;
      this._group = group;
      this._state = state;
      __super__.call(this);
    }

    InnerObserver.prototype.next = function (x) { this._state.o.onNext(x); };
    InnerObserver.prototype.error = function (e) {
      this._state.errors.push(e);
      this._group.remove(this._inner);
      this._state.isStopped && this._group.length === 1 && setCompletion(this._state.o, this._state.errors);
    };
    InnerObserver.prototype.completed = function () {
      this._group.remove(this._inner);
      this._state.isStopped && this._group.length === 1 && setCompletion(this._state.o, this._state.errors);
    };

    return MergeDelayErrorObserver;
  }(AbstractObserver));

  /**
  * Flattens an Observable that emits Observables into one Observable, in a way that allows an Observer to
  * receive all successfully emitted items from all of the source Observables without being interrupted by
  * an error notification from one of them.
  *
  * This behaves like Observable.prototype.mergeAll except that if any of the merged Observables notify of an
  * error via the Observer's onError, mergeDelayError will refrain from propagating that
  * error notification until all of the merged Observables have finished emitting items.
  * @param {Array | Arguments} args Arguments or an array to merge.
  * @returns {Observable} an Observable that emits all of the items emitted by the Observables emitted by the Observable
  */
  Observable.mergeDelayError = function() {
    var args;
    if (Array.isArray(arguments[0])) {
      args = arguments[0];
    } else {
      var len = arguments.length;
      args = new Array(len);
      for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    }
    var source = observableOf(null, args);
    return new MergeDelayErrorObservable(source);
  };

  var MergeAllObservable = (function (__super__) {
    inherits(MergeAllObservable, __super__);

    function MergeAllObservable(source) {
      this.source = source;
      __super__.call(this);
    }

    MergeAllObservable.prototype.subscribeCore = function (o) {
      var g = new CompositeDisposable(), m = new SingleAssignmentDisposable();
      g.add(m);
      m.setDisposable(this.source.subscribe(new MergeAllObserver(o, g)));
      return g;
    };

    return MergeAllObservable;
  }(ObservableBase));

  var MergeAllObserver = (function (__super__) {
    function MergeAllObserver(o, g) {
      this.o = o;
      this.g = g;
      this.done = false;
      __super__.call(this);
    }

    inherits(MergeAllObserver, __super__);

    MergeAllObserver.prototype.next = function(innerSource) {
      var sad = new SingleAssignmentDisposable();
      this.g.add(sad);
      isPromise(innerSource) && (innerSource = observableFromPromise(innerSource));
      sad.setDisposable(innerSource.subscribe(new InnerObserver(this, sad)));
    };

    MergeAllObserver.prototype.error = function (e) {
      this.o.onError(e);
    };

    MergeAllObserver.prototype.completed = function () {
      this.done = true;
      this.g.length === 1 && this.o.onCompleted();
    };

    function InnerObserver(parent, sad) {
      this.parent = parent;
      this.sad = sad;
      __super__.call(this);
    }

    inherits(InnerObserver, __super__);

    InnerObserver.prototype.next = function (x) {
      this.parent.o.onNext(x);
    };
    InnerObserver.prototype.error = function (e) {
      this.parent.o.onError(e);
    };
    InnerObserver.prototype.completed = function () {
      this.parent.g.remove(this.sad);
      this.parent.done && this.parent.g.length === 1 && this.parent.o.onCompleted();
    };

    return MergeAllObserver;
  }(AbstractObserver));

  /**
  * Merges an observable sequence of observable sequences into an observable sequence.
  * @returns {Observable} The observable sequence that merges the elements of the inner sequences.
  */
  observableProto.mergeAll = function () {
    return new MergeAllObservable(this);
  };

  /**
   * Continues an observable sequence that is terminated normally or by an exception with the next observable sequence.
   * @param {Observable} second Second observable sequence used to produce results after the first sequence terminates.
   * @returns {Observable} An observable sequence that concatenates the first and second sequence, even if the first sequence terminates exceptionally.
   */
  observableProto.onErrorResumeNext = function (second) {
    if (!second) { throw new Error('Second observable is required'); }
    return onErrorResumeNext([this, second]);
  };

  var OnErrorResumeNextObservable = (function(__super__) {
    inherits(OnErrorResumeNextObservable, __super__);
    function OnErrorResumeNextObservable(sources) {
      this.sources = sources;
      __super__.call(this);
    }

    function scheduleMethod(state, recurse) {
      if (state.pos < state.sources.length) {
        var current = state.sources[state.pos++];
        isPromise(current) && (current = observableFromPromise(current));
        var d = new SingleAssignmentDisposable();
        state.subscription.setDisposable(d);
        d.setDisposable(current.subscribe(new OnErrorResumeNextObserver(state, recurse)));
      } else {
        state.o.onCompleted();
      }
    }

    OnErrorResumeNextObservable.prototype.subscribeCore = function (o) {
      var subscription = new SerialDisposable(),
          state = {pos: 0, subscription: subscription, o: o, sources: this.sources },
          cancellable = immediateScheduler.scheduleRecursive(state, scheduleMethod);

      return new BinaryDisposable(subscription, cancellable);
    };

    return OnErrorResumeNextObservable;
  }(ObservableBase));

  var OnErrorResumeNextObserver = (function(__super__) {
    inherits(OnErrorResumeNextObserver, __super__);
    function OnErrorResumeNextObserver(state, recurse) {
      this._state = state;
      this._recurse = recurse;
      __super__.call(this);
    }

    OnErrorResumeNextObserver.prototype.next = function (x) { this._state.o.onNext(x); };
    OnErrorResumeNextObserver.prototype.error = function () { this._recurse(this._state); };
    OnErrorResumeNextObserver.prototype.completed = function () { this._recurse(this._state); };

    return OnErrorResumeNextObserver;
  }(AbstractObserver));

  /**
   * Continues an observable sequence that is terminated normally or by an exception with the next observable sequence.
   * @returns {Observable} An observable sequence that concatenates the source sequences, even if a sequence terminates exceptionally.
   */
  var onErrorResumeNext = Observable.onErrorResumeNext = function () {
    var sources = [];
    if (Array.isArray(arguments[0])) {
      sources = arguments[0];
    } else {
      var len = arguments.length;
      sources = new Array(len);
      for(var i = 0; i < len; i++) { sources[i] = arguments[i]; }
    }
    return new OnErrorResumeNextObservable(sources);
  };

  var SkipUntilObservable = (function(__super__) {
    inherits(SkipUntilObservable, __super__);

    function SkipUntilObservable(source, other) {
      this._s = source;
      this._o = isPromise(other) ? observableFromPromise(other) : other;
      this._open = false;
      __super__.call(this);
    }

    SkipUntilObservable.prototype.subscribeCore = function(o) {
      var leftSubscription = new SingleAssignmentDisposable();
      leftSubscription.setDisposable(this._s.subscribe(new SkipUntilSourceObserver(o, this)));

      isPromise(this._o) && (this._o = observableFromPromise(this._o));

      var rightSubscription = new SingleAssignmentDisposable();
      rightSubscription.setDisposable(this._o.subscribe(new SkipUntilOtherObserver(o, this, rightSubscription)));

      return new BinaryDisposable(leftSubscription, rightSubscription);
    };

    return SkipUntilObservable;
  }(ObservableBase));

  var SkipUntilSourceObserver = (function(__super__) {
    inherits(SkipUntilSourceObserver, __super__);
    function SkipUntilSourceObserver(o, p) {
      this._o = o;
      this._p = p;
      __super__.call(this);
    }

    SkipUntilSourceObserver.prototype.next = function (x) {
      this._p._open && this._o.onNext(x);
    };

    SkipUntilSourceObserver.prototype.error = function (err) {
      this._o.onError(err);
    };

    SkipUntilSourceObserver.prototype.onCompleted = function () {
      this._p._open && this._o.onCompleted();
    };

    return SkipUntilSourceObserver;
  }(AbstractObserver));

  var SkipUntilOtherObserver = (function(__super__) {
    inherits(SkipUntilOtherObserver, __super__);
    function SkipUntilOtherObserver(o, p, r) {
      this._o = o;
      this._p = p;
      this._r = r;
      __super__.call(this);
    }

    SkipUntilOtherObserver.prototype.next = function () {
      this._p._open = true;
      this._r.dispose();
    };

    SkipUntilOtherObserver.prototype.error = function (err) {
      this._o.onError(err);
    };

    SkipUntilOtherObserver.prototype.onCompleted = function () {
      this._r.dispose();
    };

    return SkipUntilOtherObserver;
  }(AbstractObserver));

  /**
   * Returns the values from the source observable sequence only after the other observable sequence produces a value.
   * @param {Observable | Promise} other The observable sequence or Promise that triggers propagation of elements of the source sequence.
   * @returns {Observable} An observable sequence containing the elements of the source sequence starting from the point the other sequence triggered propagation.
   */
  observableProto.skipUntil = function (other) {
    return new SkipUntilObservable(this, other);
  };

  var SwitchObservable = (function(__super__) {
    inherits(SwitchObservable, __super__);
    function SwitchObservable(source) {
      this.source = source;
      __super__.call(this);
    }

    SwitchObservable.prototype.subscribeCore = function (o) {
      var inner = new SerialDisposable(), s = this.source.subscribe(new SwitchObserver(o, inner));
      return new BinaryDisposable(s, inner);
    };

    inherits(SwitchObserver, AbstractObserver);
    function SwitchObserver(o, inner) {
      this.o = o;
      this.inner = inner;
      this.stopped = false;
      this.latest = 0;
      this.hasLatest = false;
      AbstractObserver.call(this);
    }

    SwitchObserver.prototype.next = function (innerSource) {
      var d = new SingleAssignmentDisposable(), id = ++this.latest;
      this.hasLatest = true;
      this.inner.setDisposable(d);
      isPromise(innerSource) && (innerSource = observableFromPromise(innerSource));
      d.setDisposable(innerSource.subscribe(new InnerObserver(this, id)));
    };

    SwitchObserver.prototype.error = function (e) {
      this.o.onError(e);
    };

    SwitchObserver.prototype.completed = function () {
      this.stopped = true;
      !this.hasLatest && this.o.onCompleted();
    };

    inherits(InnerObserver, AbstractObserver);
    function InnerObserver(parent, id) {
      this.parent = parent;
      this.id = id;
      AbstractObserver.call(this);
    }
    InnerObserver.prototype.next = function (x) {
      this.parent.latest === this.id && this.parent.o.onNext(x);
    };

    InnerObserver.prototype.error = function (e) {
      this.parent.latest === this.id && this.parent.o.onError(e);
    };

    InnerObserver.prototype.completed = function () {
      if (this.parent.latest === this.id) {
        this.parent.hasLatest = false;
        this.parent.stopped && this.parent.o.onCompleted();
      }
    };

    return SwitchObservable;
  }(ObservableBase));

  /**
  * Transforms an observable sequence of observable sequences into an observable sequence producing values only from the most recent observable sequence.
  * @returns {Observable} The observable sequence that at any point in time produces the elements of the most recent inner observable sequence that has been received.
  */
  observableProto['switch'] = observableProto.switchLatest = function () {
    return new SwitchObservable(this);
  };

  var TakeUntilObservable = (function(__super__) {
    inherits(TakeUntilObservable, __super__);

    function TakeUntilObservable(source, other) {
      this.source = source;
      this.other = isPromise(other) ? observableFromPromise(other) : other;
      __super__.call(this);
    }

    TakeUntilObservable.prototype.subscribeCore = function(o) {
      return new BinaryDisposable(
        this.source.subscribe(o),
        this.other.subscribe(new TakeUntilObserver(o))
      );
    };

    return TakeUntilObservable;
  }(ObservableBase));

  var TakeUntilObserver = (function(__super__) {
    inherits(TakeUntilObserver, __super__);
    function TakeUntilObserver(o) {
      this._o = o;
      __super__.call(this);
    }

    TakeUntilObserver.prototype.next = function () {
      this._o.onCompleted();
    };

    TakeUntilObserver.prototype.error = function (err) {
      this._o.onError(err);
    };

    TakeUntilObserver.prototype.onCompleted = noop;

    return TakeUntilObserver;
  }(AbstractObserver));

  /**
   * Returns the values from the source observable sequence until the other observable sequence produces a value.
   * @param {Observable | Promise} other Observable sequence or Promise that terminates propagation of elements of the source sequence.
   * @returns {Observable} An observable sequence containing the elements of the source sequence up to the point the other sequence interrupted further propagation.
   */
  observableProto.takeUntil = function (other) {
    return new TakeUntilObservable(this, other);
  };

  function falseFactory() { return false; }
  function argumentsToArray() {
    var len = arguments.length, args = new Array(len);
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    return args;
  }

  var WithLatestFromObservable = (function(__super__) {
    inherits(WithLatestFromObservable, __super__);
    function WithLatestFromObservable(source, sources, resultSelector) {
      this._s = source;
      this._ss = sources;
      this._cb = resultSelector;
      __super__.call(this);
    }

    WithLatestFromObservable.prototype.subscribeCore = function (o) {
      var len = this._ss.length;
      var state = {
        hasValue: arrayInitialize(len, falseFactory),
        hasValueAll: false,
        values: new Array(len)
      };

      var n = this._ss.length, subscriptions = new Array(n + 1);
      for (var i = 0; i < n; i++) {
        var other = this._ss[i], sad = new SingleAssignmentDisposable();
        isPromise(other) && (other = observableFromPromise(other));
        sad.setDisposable(other.subscribe(new WithLatestFromOtherObserver(o, i, state)));
        subscriptions[i] = sad;
      }

      var outerSad = new SingleAssignmentDisposable();
      outerSad.setDisposable(this._s.subscribe(new WithLatestFromSourceObserver(o, this._cb, state)));
      subscriptions[n] = outerSad;

      return new NAryDisposable(subscriptions);
    };

    return WithLatestFromObservable;
  }(ObservableBase));

  var WithLatestFromOtherObserver = (function (__super__) {
    inherits(WithLatestFromOtherObserver, __super__);
    function WithLatestFromOtherObserver(o, i, state) {
      this._o = o;
      this._i = i;
      this._state = state;
      __super__.call(this);
    }

    WithLatestFromOtherObserver.prototype.next = function (x) {
      this._state.values[this._i] = x;
      this._state.hasValue[this._i] = true;
      this._state.hasValueAll = this._state.hasValue.every(identity);
    };

    WithLatestFromOtherObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    WithLatestFromOtherObserver.prototype.completed = noop;

    return WithLatestFromOtherObserver;
  }(AbstractObserver));

  var WithLatestFromSourceObserver = (function (__super__) {
    inherits(WithLatestFromSourceObserver, __super__);
    function WithLatestFromSourceObserver(o, cb, state) {
      this._o = o;
      this._cb = cb;
      this._state = state;
      __super__.call(this);
    }

    WithLatestFromSourceObserver.prototype.next = function (x) {
      var allValues = [x].concat(this._state.values);
      if (!this._state.hasValueAll) { return; }
      var res = tryCatch(this._cb).apply(null, allValues);
      if (res === errorObj) { return this._o.onError(res.e); }
      this._o.onNext(res);
    };

    WithLatestFromSourceObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    WithLatestFromSourceObserver.prototype.completed = function () {
      this._o.onCompleted();
    };

    return WithLatestFromSourceObserver;
  }(AbstractObserver));

  /**
   * Merges the specified observable sequences into one observable sequence by using the selector function only when the (first) source observable sequence produces an element.
   * @returns {Observable} An observable sequence containing the result of combining elements of the sources using the specified result selector function.
   */
  observableProto.withLatestFrom = function () {
    if (arguments.length === 0) { throw new Error('invalid arguments'); }

    var len = arguments.length, args = new Array(len);
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    var resultSelector = isFunction(args[len - 1]) ? args.pop() : argumentsToArray;
    Array.isArray(args[0]) && (args = args[0]);

    return new WithLatestFromObservable(this, args, resultSelector);
  };

  function falseFactory() { return false; }
  function emptyArrayFactory() { return []; }

  var ZipObservable = (function(__super__) {
    inherits(ZipObservable, __super__);
    function ZipObservable(sources, resultSelector) {
      this._s = sources;
      this._cb = resultSelector;
      __super__.call(this);
    }

    ZipObservable.prototype.subscribeCore = function(observer) {
      var n = this._s.length,
          subscriptions = new Array(n),
          done = arrayInitialize(n, falseFactory),
          q = arrayInitialize(n, emptyArrayFactory);

      for (var i = 0; i < n; i++) {
        var source = this._s[i], sad = new SingleAssignmentDisposable();
        subscriptions[i] = sad;
        isPromise(source) && (source = observableFromPromise(source));
        sad.setDisposable(source.subscribe(new ZipObserver(observer, i, this, q, done)));
      }

      return new NAryDisposable(subscriptions);
    };

    return ZipObservable;
  }(ObservableBase));

  var ZipObserver = (function (__super__) {
    inherits(ZipObserver, __super__);
    function ZipObserver(o, i, p, q, d) {
      this._o = o;
      this._i = i;
      this._p = p;
      this._q = q;
      this._d = d;
      __super__.call(this);
    }

    function notEmpty(x) { return x.length > 0; }
    function shiftEach(x) { return x.shift(); }
    function notTheSame(i) {
      return function (x, j) {
        return j !== i;
      };
    }

    ZipObserver.prototype.next = function (x) {
      this._q[this._i].push(x);
      if (this._q.every(notEmpty)) {
        var queuedValues = this._q.map(shiftEach);
        var res = tryCatch(this._p._cb).apply(null, queuedValues);
        if (res === errorObj) { return this._o.onError(res.e); }
        this._o.onNext(res);
      } else if (this._d.filter(notTheSame(this._i)).every(identity)) {
        this._o.onCompleted();
      }
    };

    ZipObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    ZipObserver.prototype.completed = function () {
      this._d[this._i] = true;
      this._d.every(identity) && this._o.onCompleted();
    };

    return ZipObserver;
  }(AbstractObserver));

  /**
   * Merges the specified observable sequences into one observable sequence by using the selector function whenever all of the observable sequences or an array have produced an element at a corresponding index.
   * The last element in the arguments must be a function to invoke for each series of elements at corresponding indexes in the args.
   * @returns {Observable} An observable sequence containing the result of combining elements of the args using the specified result selector function.
   */
  observableProto.zip = function () {
    if (arguments.length === 0) { throw new Error('invalid arguments'); }

    var len = arguments.length, args = new Array(len);
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    var resultSelector = isFunction(args[len - 1]) ? args.pop() : argumentsToArray;
    Array.isArray(args[0]) && (args = args[0]);

    var parent = this;
    args.unshift(parent);

    return new ZipObservable(args, resultSelector);
  };

  /**
   * Merges the specified observable sequences into one observable sequence by using the selector function whenever all of the observable sequences have produced an element at a corresponding index.
   * @param arguments Observable sources.
   * @param {Function} resultSelector Function to invoke for each series of elements at corresponding indexes in the sources.
   * @returns {Observable} An observable sequence containing the result of combining elements of the sources using the specified result selector function.
   */
  Observable.zip = function () {
    var len = arguments.length, args = new Array(len);
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    if (Array.isArray(args[0])) {
      args = isFunction(args[1]) ? args[0].concat(args[1]) : args[0];
    }
    var first = args.shift();
    return first.zip.apply(first, args);
  };

function falseFactory() { return false; }
function emptyArrayFactory() { return []; }
function argumentsToArray() {
  var len = arguments.length, args = new Array(len);
  for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
  return args;
}

var ZipIterableObservable = (function(__super__) {
  inherits(ZipIterableObservable, __super__);
  function ZipIterableObservable(sources, cb) {
    this.sources = sources;
    this._cb = cb;
    __super__.call(this);
  }

  ZipIterableObservable.prototype.subscribeCore = function (o) {
    var sources = this.sources, len = sources.length, subscriptions = new Array(len);

    var state = {
      q: arrayInitialize(len, emptyArrayFactory),
      done: arrayInitialize(len, falseFactory),
      cb: this._cb,
      o: o
    };

    for (var i = 0; i < len; i++) {
      (function (i) {
        var source = sources[i], sad = new SingleAssignmentDisposable();
        (isArrayLike(source) || isIterable(source)) && (source = observableFrom(source));

        subscriptions[i] = sad;
        sad.setDisposable(source.subscribe(new ZipIterableObserver(state, i)));
      }(i));
    }

    return new NAryDisposable(subscriptions);
  };

  return ZipIterableObservable;
}(ObservableBase));

var ZipIterableObserver = (function (__super__) {
  inherits(ZipIterableObserver, __super__);
  function ZipIterableObserver(s, i) {
    this._s = s;
    this._i = i;
    __super__.call(this);
  }

  function notEmpty(x) { return x.length > 0; }
  function shiftEach(x) { return x.shift(); }
  function notTheSame(i) {
    return function (x, j) {
      return j !== i;
    };
  }

  ZipIterableObserver.prototype.next = function (x) {
    this._s.q[this._i].push(x);
    if (this._s.q.every(notEmpty)) {
      var queuedValues = this._s.q.map(shiftEach),
          res = tryCatch(this._s.cb).apply(null, queuedValues);
      if (res === errorObj) { return this._s.o.onError(res.e); }
      this._s.o.onNext(res);
    } else if (this._s.done.filter(notTheSame(this._i)).every(identity)) {
      this._s.o.onCompleted();
    }
  };

  ZipIterableObserver.prototype.error = function (e) { this._s.o.onError(e); };

  ZipIterableObserver.prototype.completed = function () {
    this._s.done[this._i] = true;
    this._s.done.every(identity) && this._s.o.onCompleted();
  };

  return ZipIterableObserver;
}(AbstractObserver));

/**
 * Merges the specified observable sequences into one observable sequence by using the selector function whenever all of the observable sequences or an array have produced an element at a corresponding index.
 * The last element in the arguments must be a function to invoke for each series of elements at corresponding indexes in the args.
 * @returns {Observable} An observable sequence containing the result of combining elements of the args using the specified result selector function.
 */
observableProto.zipIterable = function () {
  if (arguments.length === 0) { throw new Error('invalid arguments'); }

  var len = arguments.length, args = new Array(len);
  for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
  var resultSelector = isFunction(args[len - 1]) ? args.pop() : argumentsToArray;

  var parent = this;
  args.unshift(parent);
  return new ZipIterableObservable(args, resultSelector);
};

  function asObservable(source) {
    return function subscribe(o) { return source.subscribe(o); };
  }

  /**
   *  Hides the identity of an observable sequence.
   * @returns {Observable} An observable sequence that hides the identity of the source sequence.
   */
  observableProto.asObservable = function () {
    return new AnonymousObservable(asObservable(this), this);
  };

  function toArray(x) { return x.toArray(); }
  function notEmpty(x) { return x.length > 0; }

  /**
   *  Projects each element of an observable sequence into zero or more buffers which are produced based on element count information.
   * @param {Number} count Length of each buffer.
   * @param {Number} [skip] Number of elements to skip between creation of consecutive buffers. If not provided, defaults to the count.
   * @returns {Observable} An observable sequence of buffers.
   */
  observableProto.bufferWithCount = observableProto.bufferCount = function (count, skip) {
    typeof skip !== 'number' && (skip = count);
    return this.windowWithCount(count, skip)
      .flatMap(toArray)
      .filter(notEmpty);
  };

  var DematerializeObservable = (function (__super__) {
    inherits(DematerializeObservable, __super__);
    function DematerializeObservable(source) {
      this.source = source;
      __super__.call(this);
    }

    DematerializeObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new DematerializeObserver(o));
    };

    return DematerializeObservable;
  }(ObservableBase));

  var DematerializeObserver = (function (__super__) {
    inherits(DematerializeObserver, __super__);

    function DematerializeObserver(o) {
      this._o = o;
      __super__.call(this);
    }

    DematerializeObserver.prototype.next = function (x) { x.accept(this._o); };
    DematerializeObserver.prototype.error = function (e) { this._o.onError(e); };
    DematerializeObserver.prototype.completed = function () { this._o.onCompleted(); };

    return DematerializeObserver;
  }(AbstractObserver));

  /**
   * Dematerializes the explicit notification values of an observable sequence as implicit notifications.
   * @returns {Observable} An observable sequence exhibiting the behavior corresponding to the source sequence's notification values.
   */
  observableProto.dematerialize = function () {
    return new DematerializeObservable(this);
  };

  var DistinctUntilChangedObservable = (function(__super__) {
    inherits(DistinctUntilChangedObservable, __super__);
    function DistinctUntilChangedObservable(source, keyFn, comparer) {
      this.source = source;
      this.keyFn = keyFn;
      this.comparer = comparer;
      __super__.call(this);
    }

    DistinctUntilChangedObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new DistinctUntilChangedObserver(o, this.keyFn, this.comparer));
    };

    return DistinctUntilChangedObservable;
  }(ObservableBase));

  var DistinctUntilChangedObserver = (function(__super__) {
    inherits(DistinctUntilChangedObserver, __super__);
    function DistinctUntilChangedObserver(o, keyFn, comparer) {
      this.o = o;
      this.keyFn = keyFn;
      this.comparer = comparer;
      this.hasCurrentKey = false;
      this.currentKey = null;
      __super__.call(this);
    }

    DistinctUntilChangedObserver.prototype.next = function (x) {
      var key = x, comparerEquals;
      if (isFunction(this.keyFn)) {
        key = tryCatch(this.keyFn)(x);
        if (key === errorObj) { return this.o.onError(key.e); }
      }
      if (this.hasCurrentKey) {
        comparerEquals = tryCatch(this.comparer)(this.currentKey, key);
        if (comparerEquals === errorObj) { return this.o.onError(comparerEquals.e); }
      }
      if (!this.hasCurrentKey || !comparerEquals) {
        this.hasCurrentKey = true;
        this.currentKey = key;
        this.o.onNext(x);
      }
    };
    DistinctUntilChangedObserver.prototype.error = function(e) {
      this.o.onError(e);
    };
    DistinctUntilChangedObserver.prototype.completed = function () {
      this.o.onCompleted();
    };

    return DistinctUntilChangedObserver;
  }(AbstractObserver));

  /**
  *  Returns an observable sequence that contains only distinct contiguous elements according to the keyFn and the comparer.
  * @param {Function} [keyFn] A function to compute the comparison key for each element. If not provided, it projects the value.
  * @param {Function} [comparer] Equality comparer for computed key values. If not provided, defaults to an equality comparer function.
  * @returns {Observable} An observable sequence only containing the distinct contiguous elements, based on a computed key value, from the source sequence.
  */
  observableProto.distinctUntilChanged = function (keyFn, comparer) {
    comparer || (comparer = defaultComparer);
    return new DistinctUntilChangedObservable(this, keyFn, comparer);
  };

  var TapObservable = (function(__super__) {
    inherits(TapObservable,__super__);
    function TapObservable(source, observerOrOnNext, onError, onCompleted) {
      this.source = source;
      this._oN = observerOrOnNext;
      this._oE = onError;
      this._oC = onCompleted;
      __super__.call(this);
    }

    TapObservable.prototype.subscribeCore = function(o) {
      return this.source.subscribe(new InnerObserver(o, this));
    };

    inherits(InnerObserver, AbstractObserver);
    function InnerObserver(o, p) {
      this.o = o;
      this.t = !p._oN || isFunction(p._oN) ?
        observerCreate(p._oN || noop, p._oE || noop, p._oC || noop) :
        p._oN;
      this.isStopped = false;
      AbstractObserver.call(this);
    }
    InnerObserver.prototype.next = function(x) {
      var res = tryCatch(this.t.onNext).call(this.t, x);
      if (res === errorObj) { this.o.onError(res.e); }
      this.o.onNext(x);
    };
    InnerObserver.prototype.error = function(err) {
      var res = tryCatch(this.t.onError).call(this.t, err);
      if (res === errorObj) { return this.o.onError(res.e); }
      this.o.onError(err);
    };
    InnerObserver.prototype.completed = function() {
      var res = tryCatch(this.t.onCompleted).call(this.t);
      if (res === errorObj) { return this.o.onError(res.e); }
      this.o.onCompleted();
    };

    return TapObservable;
  }(ObservableBase));

  /**
  *  Invokes an action for each element in the observable sequence and invokes an action upon graceful or exceptional termination of the observable sequence.
  *  This method can be used for debugging, logging, etc. of query behavior by intercepting the message stream to run arbitrary actions for messages on the pipeline.
  * @param {Function | Observer} observerOrOnNext Action to invoke for each element in the observable sequence or an o.
  * @param {Function} [onError]  Action to invoke upon exceptional termination of the observable sequence. Used if only the observerOrOnNext parameter is also a function.
  * @param {Function} [onCompleted]  Action to invoke upon graceful termination of the observable sequence. Used if only the observerOrOnNext parameter is also a function.
  * @returns {Observable} The source sequence with the side-effecting behavior applied.
  */
  observableProto['do'] = observableProto.tap = observableProto.doAction = function (observerOrOnNext, onError, onCompleted) {
    return new TapObservable(this, observerOrOnNext, onError, onCompleted);
  };

  /**
  *  Invokes an action for each element in the observable sequence.
  *  This method can be used for debugging, logging, etc. of query behavior by intercepting the message stream to run arbitrary actions for messages on the pipeline.
  * @param {Function} onNext Action to invoke for each element in the observable sequence.
  * @param {Any} [thisArg] Object to use as this when executing callback.
  * @returns {Observable} The source sequence with the side-effecting behavior applied.
  */
  observableProto.doOnNext = observableProto.tapOnNext = function (onNext, thisArg) {
    return this.tap(typeof thisArg !== 'undefined' ? function (x) { onNext.call(thisArg, x); } : onNext);
  };

  /**
  *  Invokes an action upon exceptional termination of the observable sequence.
  *  This method can be used for debugging, logging, etc. of query behavior by intercepting the message stream to run arbitrary actions for messages on the pipeline.
  * @param {Function} onError Action to invoke upon exceptional termination of the observable sequence.
  * @param {Any} [thisArg] Object to use as this when executing callback.
  * @returns {Observable} The source sequence with the side-effecting behavior applied.
  */
  observableProto.doOnError = observableProto.tapOnError = function (onError, thisArg) {
    return this.tap(noop, typeof thisArg !== 'undefined' ? function (e) { onError.call(thisArg, e); } : onError);
  };

  /**
  *  Invokes an action upon graceful termination of the observable sequence.
  *  This method can be used for debugging, logging, etc. of query behavior by intercepting the message stream to run arbitrary actions for messages on the pipeline.
  * @param {Function} onCompleted Action to invoke upon graceful termination of the observable sequence.
  * @param {Any} [thisArg] Object to use as this when executing callback.
  * @returns {Observable} The source sequence with the side-effecting behavior applied.
  */
  observableProto.doOnCompleted = observableProto.tapOnCompleted = function (onCompleted, thisArg) {
    return this.tap(noop, null, typeof thisArg !== 'undefined' ? function () { onCompleted.call(thisArg); } : onCompleted);
  };

  var FinallyObservable = (function (__super__) {
    inherits(FinallyObservable, __super__);
    function FinallyObservable(source, fn, thisArg) {
      this.source = source;
      this._fn = bindCallback(fn, thisArg, 0);
      __super__.call(this);
    }

    FinallyObservable.prototype.subscribeCore = function (o) {
      var d = tryCatch(this.source.subscribe).call(this.source, o);
      if (d === errorObj) {
        this._fn();
        thrower(d.e);
      }

      return new FinallyDisposable(d, this._fn);
    };

    function FinallyDisposable(s, fn) {
      this.isDisposed = false;
      this._s = s;
      this._fn = fn;
    }
    FinallyDisposable.prototype.dispose = function () {
      if (!this.isDisposed) {
        var res = tryCatch(this._s.dispose).call(this._s);
        this._fn();
        res === errorObj && thrower(res.e);
      }
    };

    return FinallyObservable;

  }(ObservableBase));

  /**
   *  Invokes a specified action after the source observable sequence terminates gracefully or exceptionally.
   * @param {Function} finallyAction Action to invoke after the source observable sequence terminates.
   * @returns {Observable} Source sequence with the action-invoking termination behavior applied.
   */
  observableProto['finally'] = function (action, thisArg) {
    return new FinallyObservable(this, action, thisArg);
  };

  var IgnoreElementsObservable = (function(__super__) {
    inherits(IgnoreElementsObservable, __super__);

    function IgnoreElementsObservable(source) {
      this.source = source;
      __super__.call(this);
    }

    IgnoreElementsObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new InnerObserver(o));
    };

    function InnerObserver(o) {
      this.o = o;
      this.isStopped = false;
    }
    InnerObserver.prototype.onNext = noop;
    InnerObserver.prototype.onError = function (err) {
      if(!this.isStopped) {
        this.isStopped = true;
        this.o.onError(err);
      }
    };
    InnerObserver.prototype.onCompleted = function () {
      if(!this.isStopped) {
        this.isStopped = true;
        this.o.onCompleted();
      }
    };
    InnerObserver.prototype.dispose = function() { this.isStopped = true; };
    InnerObserver.prototype.fail = function (e) {
      if (!this.isStopped) {
        this.isStopped = true;
        this.observer.onError(e);
        return true;
      }

      return false;
    };

    return IgnoreElementsObservable;
  }(ObservableBase));

  /**
   *  Ignores all elements in an observable sequence leaving only the termination messages.
   * @returns {Observable} An empty observable sequence that signals termination, successful or exceptional, of the source sequence.
   */
  observableProto.ignoreElements = function () {
    return new IgnoreElementsObservable(this);
  };

  var MaterializeObservable = (function (__super__) {
    inherits(MaterializeObservable, __super__);
    function MaterializeObservable(source, fn) {
      this.source = source;
      __super__.call(this);
    }

    MaterializeObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new MaterializeObserver(o));
    };

    return MaterializeObservable;
  }(ObservableBase));

  var MaterializeObserver = (function (__super__) {
    inherits(MaterializeObserver, __super__);

    function MaterializeObserver(o) {
      this._o = o;
      __super__.call(this);
    }

    MaterializeObserver.prototype.next = function (x) { this._o.onNext(notificationCreateOnNext(x)) };
    MaterializeObserver.prototype.error = function (e) { this._o.onNext(notificationCreateOnError(e)); this._o.onCompleted(); };
    MaterializeObserver.prototype.completed = function () { this._o.onNext(notificationCreateOnCompleted()); this._o.onCompleted(); };

    return MaterializeObserver;
  }(AbstractObserver));

  /**
   *  Materializes the implicit notifications of an observable sequence as explicit notification values.
   * @returns {Observable} An observable sequence containing the materialized notification values from the source sequence.
   */
  observableProto.materialize = function () {
    return new MaterializeObservable(this);
  };

  /**
   *  Repeats the observable sequence a specified number of times. If the repeat count is not specified, the sequence repeats indefinitely.
   * @param {Number} [repeatCount]  Number of times to repeat the sequence. If not provided, repeats the sequence indefinitely.
   * @returns {Observable} The observable sequence producing the elements of the given sequence repeatedly.
   */
  observableProto.repeat = function (repeatCount) {
    return enumerableRepeat(this, repeatCount).concat();
  };

  /**
   *  Repeats the source observable sequence the specified number of times or until it successfully terminates. If the retry count is not specified, it retries indefinitely.
   *  Note if you encounter an error and want it to retry once, then you must use .retry(2);
   *
   * @example
   *  var res = retried = retry.repeat();
   *  var res = retried = retry.repeat(2);
   * @param {Number} [retryCount]  Number of times to retry the sequence. If not provided, retry the sequence indefinitely.
   * @returns {Observable} An observable sequence producing the elements of the given sequence repeatedly until it terminates successfully.
   */
  observableProto.retry = function (retryCount) {
    return enumerableRepeat(this, retryCount).catchError();
  };

  function repeat(value) {
    return {
      '@@iterator': function () {
        return {
          next: function () {
            return { done: false, value: value };
          }
        };
      }
    };
  }

  var RetryWhenObservable = (function(__super__) {
    function createDisposable(state) {
      return {
        isDisposed: false,
        dispose: function () {
          if (!this.isDisposed) {
            this.isDisposed = true;
            state.isDisposed = true;
          }
        }
      };
    }

    function RetryWhenObservable(source, notifier) {
      this.source = source;
      this._notifier = notifier;
      __super__.call(this);
    }

    inherits(RetryWhenObservable, __super__);

    RetryWhenObservable.prototype.subscribeCore = function (o) {
      var exceptions = new Subject(),
        notifier = new Subject(),
        handled = this._notifier(exceptions),
        notificationDisposable = handled.subscribe(notifier);

      var e = this.source['@@iterator']();

      var state = { isDisposed: false },
        lastError,
        subscription = new SerialDisposable();
      var cancelable = currentThreadScheduler.scheduleRecursive(null, function (_, recurse) {
        if (state.isDisposed) { return; }
        var currentItem = e.next();

        if (currentItem.done) {
          if (lastError) {
            o.onError(lastError);
          } else {
            o.onCompleted();
          }
          return;
        }

        // Check if promise
        var currentValue = currentItem.value;
        isPromise(currentValue) && (currentValue = observableFromPromise(currentValue));

        var outer = new SingleAssignmentDisposable();
        var inner = new SingleAssignmentDisposable();
        subscription.setDisposable(new BinaryDisposable(inner, outer));
        outer.setDisposable(currentValue.subscribe(
          function(x) { o.onNext(x); },
          function (exn) {
            inner.setDisposable(notifier.subscribe(recurse, function(ex) {
              o.onError(ex);
            }, function() {
              o.onCompleted();
            }));

            exceptions.onNext(exn);
            outer.dispose();
          },
          function() { o.onCompleted(); }));
      });

      return new NAryDisposable([notificationDisposable, subscription, cancelable, createDisposable(state)]);
    };

    return RetryWhenObservable;
  }(ObservableBase));

  observableProto.retryWhen = function (notifier) {
    return new RetryWhenObservable(repeat(this), notifier);
  };

  function repeat(value) {
    return {
      '@@iterator': function () {
        return {
          next: function () {
            return { done: false, value: value };
          }
        };
      }
    };
  }

  var RepeatWhenObservable = (function(__super__) {
    function createDisposable(state) {
      return {
        isDisposed: false,
        dispose: function () {
          if (!this.isDisposed) {
            this.isDisposed = true;
            state.isDisposed = true;
          }
        }
      };
    }

    function RepeatWhenObservable(source, notifier) {
      this.source = source;
      this._notifier = notifier;
      __super__.call(this);
    }

    inherits(RepeatWhenObservable, __super__);

    RepeatWhenObservable.prototype.subscribeCore = function (o) {
      var completions = new Subject(),
        notifier = new Subject(),
        handled = this._notifier(completions),
        notificationDisposable = handled.subscribe(notifier);

      var e = this.source['@@iterator']();

      var state = { isDisposed: false },
        lastError,
        subscription = new SerialDisposable();
      var cancelable = currentThreadScheduler.scheduleRecursive(null, function (_, recurse) {
        if (state.isDisposed) { return; }
        var currentItem = e.next();

        if (currentItem.done) {
          if (lastError) {
            o.onError(lastError);
          } else {
            o.onCompleted();
          }
          return;
        }

        // Check if promise
        var currentValue = currentItem.value;
        isPromise(currentValue) && (currentValue = observableFromPromise(currentValue));

        var outer = new SingleAssignmentDisposable();
        var inner = new SingleAssignmentDisposable();
        subscription.setDisposable(new BinaryDisposable(inner, outer));
        outer.setDisposable(currentValue.subscribe(
          function(x) { o.onNext(x); },
          function (exn) { o.onError(exn); },
          function() {
            inner.setDisposable(notifier.subscribe(recurse, function(ex) {
              o.onError(ex);
            }, function() {
              o.onCompleted();
            }));

            completions.onNext(null);
            outer.dispose();
          }));
      });

      return new NAryDisposable([notificationDisposable, subscription, cancelable, createDisposable(state)]);
    };

    return RepeatWhenObservable;
  }(ObservableBase));

  observableProto.repeatWhen = function (notifier) {
    return new RepeatWhenObservable(repeat(this), notifier);
  };

  var ScanObservable = (function(__super__) {
    inherits(ScanObservable, __super__);
    function ScanObservable(source, accumulator, hasSeed, seed) {
      this.source = source;
      this.accumulator = accumulator;
      this.hasSeed = hasSeed;
      this.seed = seed;
      __super__.call(this);
    }

    ScanObservable.prototype.subscribeCore = function(o) {
      return this.source.subscribe(new ScanObserver(o,this));
    };

    return ScanObservable;
  }(ObservableBase));

  var ScanObserver = (function (__super__) {
    inherits(ScanObserver, __super__);
    function ScanObserver(o, parent) {
      this._o = o;
      this._p = parent;
      this._fn = parent.accumulator;
      this._hs = parent.hasSeed;
      this._s = parent.seed;
      this._ha = false;
      this._a = null;
      this._hv = false;
      this._i = 0;
      __super__.call(this);
    }

    ScanObserver.prototype.next = function (x) {
      !this._hv && (this._hv = true);
      if (this._ha) {
        this._a = tryCatch(this._fn)(this._a, x, this._i, this._p);
      } else {
        this._a = this._hs ? tryCatch(this._fn)(this._s, x, this._i, this._p) : x;
        this._ha = true;
      }
      if (this._a === errorObj) { return this._o.onError(this._a.e); }
      this._o.onNext(this._a);
      this._i++;
    };

    ScanObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    ScanObserver.prototype.completed = function () {
      !this._hv && this._hs && this._o.onNext(this._s);
      this._o.onCompleted();
    };

    return ScanObserver;
  }(AbstractObserver));

  /**
  *  Applies an accumulator function over an observable sequence and returns each intermediate result. The optional seed value is used as the initial accumulator value.
  *  For aggregation behavior with no intermediate results, see Observable.aggregate.
  * @param {Mixed} [seed] The initial accumulator value.
  * @param {Function} accumulator An accumulator function to be invoked on each element.
  * @returns {Observable} An observable sequence containing the accumulated values.
  */
  observableProto.scan = function () {
    var hasSeed = false, seed, accumulator = arguments[0];
    if (arguments.length === 2) {
      hasSeed = true;
      seed = arguments[1];
    }
    return new ScanObservable(this, accumulator, hasSeed, seed);
  };

  var SkipLastObservable = (function (__super__) {
    inherits(SkipLastObservable, __super__);
    function SkipLastObservable(source, c) {
      this.source = source;
      this._c = c;
      __super__.call(this);
    }

    SkipLastObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new SkipLastObserver(o, this._c));
    };

    return SkipLastObservable;
  }(ObservableBase));

  var SkipLastObserver = (function (__super__) {
    inherits(SkipLastObserver, __super__);
    function SkipLastObserver(o, c) {
      this._o = o;
      this._c = c;
      this._q = [];
      __super__.call(this);
    }

    SkipLastObserver.prototype.next = function (x) {
      this._q.push(x);
      this._q.length > this._c && this._o.onNext(this._q.shift());
    };

    SkipLastObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    SkipLastObserver.prototype.completed = function () {
      this._o.onCompleted();
    };

    return SkipLastObserver;
  }(AbstractObserver));

  /**
   *  Bypasses a specified number of elements at the end of an observable sequence.
   * @description
   *  This operator accumulates a queue with a length enough to store the first `count` elements. As more elements are
   *  received, elements are taken from the front of the queue and produced on the result sequence. This causes elements to be delayed.
   * @param count Number of elements to bypass at the end of the source sequence.
   * @returns {Observable} An observable sequence containing the source sequence elements except for the bypassed ones at the end.
   */
  observableProto.skipLast = function (count) {
    if (count < 0) { throw new ArgumentOutOfRangeError(); }
    return new SkipLastObservable(this, count);
  };

  /**
   *  Prepends a sequence of values to an observable sequence with an optional scheduler and an argument list of values to prepend.
   *  @example
   *  var res = source.startWith(1, 2, 3);
   *  var res = source.startWith(Rx.Scheduler.timeout, 1, 2, 3);
   * @param {Arguments} args The specified values to prepend to the observable sequence
   * @returns {Observable} The source sequence prepended with the specified values.
   */
  observableProto.startWith = function () {
    var values, scheduler, start = 0;
    if (!!arguments.length && isScheduler(arguments[0])) {
      scheduler = arguments[0];
      start = 1;
    } else {
      scheduler = immediateScheduler;
    }
    for(var args = [], i = start, len = arguments.length; i < len; i++) { args.push(arguments[i]); }
    return observableConcat.apply(null, [observableFromArray(args, scheduler), this]);
  };

  var TakeLastObserver = (function (__super__) {
    inherits(TakeLastObserver, __super__);
    function TakeLastObserver(o, c) {
      this._o = o;
      this._c = c;
      this._q = [];
      __super__.call(this);
    }

    TakeLastObserver.prototype.next = function (x) {
      this._q.push(x);
      this._q.length > this._c && this._q.shift();
    };

    TakeLastObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    TakeLastObserver.prototype.completed = function () {
      while (this._q.length > 0) { this._o.onNext(this._q.shift()); }
      this._o.onCompleted();
    };

    return TakeLastObserver;
  }(AbstractObserver));

  /**
   *  Returns a specified number of contiguous elements from the end of an observable sequence.
   * @description
   *  This operator accumulates a buffer with a length enough to store elements count elements. Upon completion of
   *  the source sequence, this buffer is drained on the result sequence. This causes the elements to be delayed.
   * @param {Number} count Number of elements to take from the end of the source sequence.
   * @returns {Observable} An observable sequence containing the specified number of elements from the end of the source sequence.
   */
  observableProto.takeLast = function (count) {
    if (count < 0) { throw new ArgumentOutOfRangeError(); }
    var source = this;
    return new AnonymousObservable(function (o) {
      return source.subscribe(new TakeLastObserver(o, count));
    }, source);
  };

  var TakeLastBufferObserver = (function (__super__) {
    inherits(TakeLastBufferObserver, __super__);
    function TakeLastBufferObserver(o, c) {
      this._o = o;
      this._c = c;
      this._q = [];
      __super__.call(this);
    }

    TakeLastBufferObserver.prototype.next = function (x) {
      this._q.push(x);
      this._q.length > this._c && this._q.shift();
    };

    TakeLastBufferObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    TakeLastBufferObserver.prototype.completed = function () {
      this._o.onNext(this._q);
      this._o.onCompleted();
    };

    return TakeLastBufferObserver;
  }(AbstractObserver));

  /**
   *  Returns an array with the specified number of contiguous elements from the end of an observable sequence.
   *
   * @description
   *  This operator accumulates a buffer with a length enough to store count elements. Upon completion of the
   *  source sequence, this buffer is produced on the result sequence.
   * @param {Number} count Number of elements to take from the end of the source sequence.
   * @returns {Observable} An observable sequence containing a single array with the specified number of elements from the end of the source sequence.
   */
  observableProto.takeLastBuffer = function (count) {
    if (count < 0) { throw new ArgumentOutOfRangeError(); }
    var source = this;
    return new AnonymousObservable(function (o) {
      return source.subscribe(new TakeLastBufferObserver(o, count));
    }, source);
  };

  /**
   *  Projects each element of an observable sequence into zero or more windows which are produced based on element count information.
   * @param {Number} count Length of each window.
   * @param {Number} [skip] Number of elements to skip between creation of consecutive windows. If not specified, defaults to the count.
   * @returns {Observable} An observable sequence of windows.
   */
  observableProto.windowWithCount = observableProto.windowCount = function (count, skip) {
    var source = this;
    +count || (count = 0);
    Math.abs(count) === Infinity && (count = 0);
    if (count <= 0) { throw new ArgumentOutOfRangeError(); }
    skip == null && (skip = count);
    +skip || (skip = 0);
    Math.abs(skip) === Infinity && (skip = 0);

    if (skip <= 0) { throw new ArgumentOutOfRangeError(); }
    return new AnonymousObservable(function (observer) {
      var m = new SingleAssignmentDisposable(),
        refCountDisposable = new RefCountDisposable(m),
        n = 0,
        q = [];

      function createWindow () {
        var s = new Subject();
        q.push(s);
        observer.onNext(addRef(s, refCountDisposable));
      }

      createWindow();

      m.setDisposable(source.subscribe(
        function (x) {
          for (var i = 0, len = q.length; i < len; i++) { q[i].onNext(x); }
          var c = n - count + 1;
          c >= 0 && c % skip === 0 && q.shift().onCompleted();
          ++n % skip === 0 && createWindow();
        },
        function (e) {
          while (q.length > 0) { q.shift().onError(e); }
          observer.onError(e);
        },
        function () {
          while (q.length > 0) { q.shift().onCompleted(); }
          observer.onCompleted();
        }
      ));
      return refCountDisposable;
    }, source);
  };

observableProto.flatMapConcat = observableProto.concatMap = function(selector, resultSelector, thisArg) {
    return new FlatMapObservable(this, selector, resultSelector, thisArg).merge(1);
};
  /**
   * Projects each notification of an observable sequence to an observable sequence and concats the resulting observable sequences into one observable sequence.
   * @param {Function} onNext A transform function to apply to each element; the second parameter of the function represents the index of the source element.
   * @param {Function} onError A transform function to apply when an error occurs in the source sequence.
   * @param {Function} onCompleted A transform function to apply when the end of the source sequence is reached.
   * @param {Any} [thisArg] An optional "this" to use to invoke each transform.
   * @returns {Observable} An observable sequence whose elements are the result of invoking the one-to-many transform function corresponding to each notification in the input sequence.
   */
  observableProto.concatMapObserver = observableProto.selectConcatObserver = function(onNext, onError, onCompleted, thisArg) {
    var source = this,
        onNextFunc = bindCallback(onNext, thisArg, 2),
        onErrorFunc = bindCallback(onError, thisArg, 1),
        onCompletedFunc = bindCallback(onCompleted, thisArg, 0);
    return new AnonymousObservable(function (observer) {
      var index = 0;
      return source.subscribe(
        function (x) {
          var result;
          try {
            result = onNextFunc(x, index++);
          } catch (e) {
            observer.onError(e);
            return;
          }
          isPromise(result) && (result = observableFromPromise(result));
          observer.onNext(result);
        },
        function (err) {
          var result;
          try {
            result = onErrorFunc(err);
          } catch (e) {
            observer.onError(e);
            return;
          }
          isPromise(result) && (result = observableFromPromise(result));
          observer.onNext(result);
          observer.onCompleted();
        },
        function () {
          var result;
          try {
            result = onCompletedFunc();
          } catch (e) {
            observer.onError(e);
            return;
          }
          isPromise(result) && (result = observableFromPromise(result));
          observer.onNext(result);
          observer.onCompleted();
        });
    }, this).concatAll();
  };

  var DefaultIfEmptyObserver = (function (__super__) {
    inherits(DefaultIfEmptyObserver, __super__);
    function DefaultIfEmptyObserver(o, d) {
      this._o = o;
      this._d = d;
      this._f = false;
      __super__.call(this);
    }

    DefaultIfEmptyObserver.prototype.next = function (x) {
      this._f = true;
      this._o.onNext(x);
    };

    DefaultIfEmptyObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    DefaultIfEmptyObserver.prototype.completed = function () {
      !this._f && this._o.onNext(this._d);
      this._o.onCompleted();
    };

    return DefaultIfEmptyObserver;
  }(AbstractObserver));

  /**
   *  Returns the elements of the specified sequence or the specified value in a singleton sequence if the sequence is empty.
   *
   *  var res = obs = xs.defaultIfEmpty();
   *  2 - obs = xs.defaultIfEmpty(false);
   *
   * @memberOf Observable#
   * @param defaultValue The value to return if the sequence is empty. If not provided, this defaults to null.
   * @returns {Observable} An observable sequence that contains the specified default value if the source is empty; otherwise, the elements of the source itself.
   */
    observableProto.defaultIfEmpty = function (defaultValue) {
      var source = this;
      defaultValue === undefined && (defaultValue = null);
      return new AnonymousObservable(function (o) {
        return source.subscribe(new DefaultIfEmptyObserver(o, defaultValue));
      }, source);
    };

  // Swap out for Array.findIndex
  function arrayIndexOfComparer(array, item, comparer) {
    for (var i = 0, len = array.length; i < len; i++) {
      if (comparer(array[i], item)) { return i; }
    }
    return -1;
  }

  function HashSet(comparer) {
    this.comparer = comparer;
    this.set = [];
  }
  HashSet.prototype.push = function(value) {
    var retValue = arrayIndexOfComparer(this.set, value, this.comparer) === -1;
    retValue && this.set.push(value);
    return retValue;
  };

  var DistinctObservable = (function (__super__) {
    inherits(DistinctObservable, __super__);
    function DistinctObservable(source, keyFn, cmpFn) {
      this.source = source;
      this._keyFn = keyFn;
      this._cmpFn = cmpFn;
      __super__.call(this);
    }

    DistinctObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new DistinctObserver(o, this._keyFn, this._cmpFn));
    };

    return DistinctObservable;
  }(ObservableBase));

  var DistinctObserver = (function (__super__) {
    inherits(DistinctObserver, __super__);
    function DistinctObserver(o, keyFn, cmpFn) {
      this._o = o;
      this._keyFn = keyFn;
      this._h = new HashSet(cmpFn);
      __super__.call(this);
    }

    DistinctObserver.prototype.next = function (x) {
      var key = x;
      if (isFunction(this._keyFn)) {
        key = tryCatch(this._keyFn)(x);
        if (key === errorObj) { return this._o.onError(key.e); }
      }
      this._h.push(key) && this._o.onNext(x);
    };

    DistinctObserver.prototype.error = function (e) { this._o.onError(e); };
    DistinctObserver.prototype.completed = function () { this._o.onCompleted(); };

    return DistinctObserver;
  }(AbstractObserver));

  /**
   *  Returns an observable sequence that contains only distinct elements according to the keySelector and the comparer.
   *  Usage of this operator should be considered carefully due to the maintenance of an internal lookup structure which can grow large.
   *
   * @example
   *  var res = obs = xs.distinct();
   *  2 - obs = xs.distinct(function (x) { return x.id; });
   *  2 - obs = xs.distinct(function (x) { return x.id; }, function (a,b) { return a === b; });
   * @param {Function} [keySelector]  A function to compute the comparison key for each element.
   * @param {Function} [comparer]  Used to compare items in the collection.
   * @returns {Observable} An observable sequence only containing the distinct elements, based on a computed key value, from the source sequence.
   */
  observableProto.distinct = function (keySelector, comparer) {
    comparer || (comparer = defaultComparer);
    return new DistinctObservable(this, keySelector, comparer);
  };

  var MapObservable = (function (__super__) {
    inherits(MapObservable, __super__);

    function MapObservable(source, selector, thisArg) {
      this.source = source;
      this.selector = bindCallback(selector, thisArg, 3);
      __super__.call(this);
    }

    function innerMap(selector, self) {
      return function (x, i, o) { return selector.call(this, self.selector(x, i, o), i, o); };
    }

    MapObservable.prototype.internalMap = function (selector, thisArg) {
      return new MapObservable(this.source, innerMap(selector, this), thisArg);
    };

    MapObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new InnerObserver(o, this.selector, this));
    };

    inherits(InnerObserver, AbstractObserver);
    function InnerObserver(o, selector, source) {
      this.o = o;
      this.selector = selector;
      this.source = source;
      this.i = 0;
      AbstractObserver.call(this);
    }

    InnerObserver.prototype.next = function(x) {
      var result = tryCatch(this.selector)(x, this.i++, this.source);
      if (result === errorObj) { return this.o.onError(result.e); }
      this.o.onNext(result);
    };

    InnerObserver.prototype.error = function (e) {
      this.o.onError(e);
    };

    InnerObserver.prototype.completed = function () {
      this.o.onCompleted();
    };

    return MapObservable;

  }(ObservableBase));

  /**
  * Projects each element of an observable sequence into a new form by incorporating the element's index.
  * @param {Function} selector A transform function to apply to each source element; the second parameter of the function represents the index of the source element.
  * @param {Any} [thisArg] Object to use as this when executing callback.
  * @returns {Observable} An observable sequence whose elements are the result of invoking the transform function on each element of source.
  */
  observableProto.map = observableProto.select = function (selector, thisArg) {
    var selectorFn = typeof selector === 'function' ? selector : function () { return selector; };
    return this instanceof MapObservable ?
      this.internalMap(selectorFn, thisArg) :
      new MapObservable(this, selectorFn, thisArg);
  };

  function plucker(args, len) {
    return function mapper(x) {
      var currentProp = x;
      for (var i = 0; i < len; i++) {
        var p = currentProp[args[i]];
        if (typeof p !== 'undefined') {
          currentProp = p;
        } else {
          return undefined;
        }
      }
      return currentProp;
    };
  }

  /**
   * Retrieves the value of a specified nested property from all elements in
   * the Observable sequence.
   * @param {Arguments} arguments The nested properties to pluck.
   * @returns {Observable} Returns a new Observable sequence of property values.
   */
  observableProto.pluck = function () {
    var len = arguments.length, args = new Array(len);
    if (len === 0) { throw new Error('List of properties cannot be empty.'); }
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    return this.map(plucker(args, len));
  };

  /**
   * Projects each notification of an observable sequence to an observable sequence and merges the resulting observable sequences into one observable sequence.
   * @param {Function} onNext A transform function to apply to each element; the second parameter of the function represents the index of the source element.
   * @param {Function} onError A transform function to apply when an error occurs in the source sequence.
   * @param {Function} onCompleted A transform function to apply when the end of the source sequence is reached.
   * @param {Any} [thisArg] An optional "this" to use to invoke each transform.
   * @returns {Observable} An observable sequence whose elements are the result of invoking the one-to-many transform function corresponding to each notification in the input sequence.
   */
  observableProto.flatMapObserver = observableProto.selectManyObserver = function (onNext, onError, onCompleted, thisArg) {
    var source = this;
    return new AnonymousObservable(function (observer) {
      var index = 0;

      return source.subscribe(
        function (x) {
          var result;
          try {
            result = onNext.call(thisArg, x, index++);
          } catch (e) {
            observer.onError(e);
            return;
          }
          isPromise(result) && (result = observableFromPromise(result));
          observer.onNext(result);
        },
        function (err) {
          var result;
          try {
            result = onError.call(thisArg, err);
          } catch (e) {
            observer.onError(e);
            return;
          }
          isPromise(result) && (result = observableFromPromise(result));
          observer.onNext(result);
          observer.onCompleted();
        },
        function () {
          var result;
          try {
            result = onCompleted.call(thisArg);
          } catch (e) {
            observer.onError(e);
            return;
          }
          isPromise(result) && (result = observableFromPromise(result));
          observer.onNext(result);
          observer.onCompleted();
        });
    }, source).mergeAll();
  };

observableProto.flatMap = observableProto.selectMany = observableProto.mergeMap = function(selector, resultSelector, thisArg) {
    return new FlatMapObservable(this, selector, resultSelector, thisArg).mergeAll();
};

observableProto.flatMapLatest = observableProto.switchMap = function(selector, resultSelector, thisArg) {
    return new FlatMapObservable(this, selector, resultSelector, thisArg).switchLatest();
};

  var SkipObservable = (function(__super__) {
    inherits(SkipObservable, __super__);
    function SkipObservable(source, count) {
      this.source = source;
      this._count = count;
      __super__.call(this);
    }

    SkipObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new SkipObserver(o, this._count));
    };

    function SkipObserver(o, c) {
      this._o = o;
      this._r = c;
      AbstractObserver.call(this);
    }

    inherits(SkipObserver, AbstractObserver);

    SkipObserver.prototype.next = function (x) {
      if (this._r <= 0) {
        this._o.onNext(x);
      } else {
        this._r--;
      }
    };
    SkipObserver.prototype.error = function(e) { this._o.onError(e); };
    SkipObserver.prototype.completed = function() { this._o.onCompleted(); };

    return SkipObservable;
  }(ObservableBase));

  /**
   * Bypasses a specified number of elements in an observable sequence and then returns the remaining elements.
   * @param {Number} count The number of elements to skip before returning the remaining elements.
   * @returns {Observable} An observable sequence that contains the elements that occur after the specified index in the input sequence.
   */
  observableProto.skip = function (count) {
    if (count < 0) { throw new ArgumentOutOfRangeError(); }
    return new SkipObservable(this, count);
  };

  var SkipWhileObservable = (function (__super__) {
    inherits(SkipWhileObservable, __super__);
    function SkipWhileObservable(source, fn) {
      this.source = source;
      this._fn = fn;
      __super__.call(this);
    }

    SkipWhileObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new SkipWhileObserver(o, this));
    };

    return SkipWhileObservable;
  }(ObservableBase));

  var SkipWhileObserver = (function (__super__) {
    inherits(SkipWhileObserver, __super__);

    function SkipWhileObserver(o, p) {
      this._o = o;
      this._p = p;
      this._i = 0;
      this._r = false;
      __super__.call(this);
    }

    SkipWhileObserver.prototype.next = function (x) {
      if (!this._r) {
        var res = tryCatch(this._p._fn)(x, this._i++, this._p);
        if (res === errorObj) { return this._o.onError(res.e); }
        this._r = !res;
      }
      this._r && this._o.onNext(x);
    };
    SkipWhileObserver.prototype.error = function (e) { this._o.onError(e); };
    SkipWhileObserver.prototype.completed = function () { this._o.onCompleted(); };

    return SkipWhileObserver;
  }(AbstractObserver));

  /**
   *  Bypasses elements in an observable sequence as long as a specified condition is true and then returns the remaining elements.
   *  The element's index is used in the logic of the predicate function.
   *
   *  var res = source.skipWhile(function (value) { return value < 10; });
   *  var res = source.skipWhile(function (value, index) { return value < 10 || index < 10; });
   * @param {Function} predicate A function to test each element for a condition; the second parameter of the function represents the index of the source element.
   * @param {Any} [thisArg] Object to use as this when executing callback.
   * @returns {Observable} An observable sequence that contains the elements from the input sequence starting at the first element in the linear series that does not pass the test specified by predicate.
   */
  observableProto.skipWhile = function (predicate, thisArg) {
    var fn = bindCallback(predicate, thisArg, 3);
    return new SkipWhileObservable(this, fn);
  };

  var TakeObservable = (function(__super__) {
    inherits(TakeObservable, __super__);
    function TakeObservable(source, count) {
      this.source = source;
      this._count = count;
      __super__.call(this);
    }

    TakeObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new TakeObserver(o, this._count));
    };

    function TakeObserver(o, c) {
      this._o = o;
      this._c = c;
      this._r = c;
      AbstractObserver.call(this);
    }

    inherits(TakeObserver, AbstractObserver);

    TakeObserver.prototype.next = function (x) {
      if (this._r-- > 0) {
        this._o.onNext(x);
        this._r <= 0 && this._o.onCompleted();
      }
    };

    TakeObserver.prototype.error = function (e) { this._o.onError(e); };
    TakeObserver.prototype.completed = function () { this._o.onCompleted(); };

    return TakeObservable;
  }(ObservableBase));

  /**
   *  Returns a specified number of contiguous elements from the start of an observable sequence, using the specified scheduler for the edge case of take(0).
   * @param {Number} count The number of elements to return.
   * @param {Scheduler} [scheduler] Scheduler used to produce an OnCompleted message in case <paramref name="count count</paramref> is set to 0.
   * @returns {Observable} An observable sequence that contains the specified number of elements from the start of the input sequence.
   */
  observableProto.take = function (count, scheduler) {
    if (count < 0) { throw new ArgumentOutOfRangeError(); }
    if (count === 0) { return observableEmpty(scheduler); }
    return new TakeObservable(this, count);
  };

  var TakeWhileObservable = (function (__super__) {
    inherits(TakeWhileObservable, __super__);
    function TakeWhileObservable(source, fn) {
      this.source = source;
      this._fn = fn;
      __super__.call(this);
    }

    TakeWhileObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new TakeWhileObserver(o, this));
    };

    return TakeWhileObservable;
  }(ObservableBase));

  var TakeWhileObserver = (function (__super__) {
    inherits(TakeWhileObserver, __super__);

    function TakeWhileObserver(o, p) {
      this._o = o;
      this._p = p;
      this._i = 0;
      this._r = true;
      __super__.call(this);
    }

    TakeWhileObserver.prototype.next = function (x) {
      if (this._r) {
        this._r = tryCatch(this._p._fn)(x, this._i++, this._p);
        if (this._r === errorObj) { return this._o.onError(this._r.e); }
      }
      if (this._r) {
        this._o.onNext(x);
      } else {
        this._o.onCompleted();
      }
    };
    TakeWhileObserver.prototype.error = function (e) { this._o.onError(e); };
    TakeWhileObserver.prototype.completed = function () { this._o.onCompleted(); };

    return TakeWhileObserver;
  }(AbstractObserver));

  /**
   *  Returns elements from an observable sequence as long as a specified condition is true.
   *  The element's index is used in the logic of the predicate function.
   * @param {Function} predicate A function to test each element for a condition; the second parameter of the function represents the index of the source element.
   * @param {Any} [thisArg] Object to use as this when executing callback.
   * @returns {Observable} An observable sequence that contains the elements from the input sequence that occur before the element at which the test no longer passes.
   */
  observableProto.takeWhile = function (predicate, thisArg) {
    var fn = bindCallback(predicate, thisArg, 3);
    return new TakeWhileObservable(this, fn);
  };

  var FilterObservable = (function (__super__) {
    inherits(FilterObservable, __super__);

    function FilterObservable(source, predicate, thisArg) {
      this.source = source;
      this.predicate = bindCallback(predicate, thisArg, 3);
      __super__.call(this);
    }

    FilterObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new InnerObserver(o, this.predicate, this));
    };

    function innerPredicate(predicate, self) {
      return function(x, i, o) { return self.predicate(x, i, o) && predicate.call(this, x, i, o); }
    }

    FilterObservable.prototype.internalFilter = function(predicate, thisArg) {
      return new FilterObservable(this.source, innerPredicate(predicate, this), thisArg);
    };

    inherits(InnerObserver, AbstractObserver);
    function InnerObserver(o, predicate, source) {
      this.o = o;
      this.predicate = predicate;
      this.source = source;
      this.i = 0;
      AbstractObserver.call(this);
    }

    InnerObserver.prototype.next = function(x) {
      var shouldYield = tryCatch(this.predicate)(x, this.i++, this.source);
      if (shouldYield === errorObj) {
        return this.o.onError(shouldYield.e);
      }
      shouldYield && this.o.onNext(x);
    };

    InnerObserver.prototype.error = function (e) {
      this.o.onError(e);
    };

    InnerObserver.prototype.completed = function () {
      this.o.onCompleted();
    };

    return FilterObservable;

  }(ObservableBase));

  /**
  *  Filters the elements of an observable sequence based on a predicate by incorporating the element's index.
  * @param {Function} predicate A function to test each source element for a condition; the second parameter of the function represents the index of the source element.
  * @param {Any} [thisArg] Object to use as this when executing callback.
  * @returns {Observable} An observable sequence that contains elements from the input sequence that satisfy the condition.
  */
  observableProto.filter = observableProto.where = function (predicate, thisArg) {
    return this instanceof FilterObservable ? this.internalFilter(predicate, thisArg) :
      new FilterObservable(this, predicate, thisArg);
  };

  var TransduceObserver = (function (__super__) {
    inherits(TransduceObserver, __super__);
    function TransduceObserver(o, xform) {
      this._o = o;
      this._xform = xform;
      __super__.call(this);
    }

    TransduceObserver.prototype.next = function (x) {
      var res = tryCatch(this._xform['@@transducer/step']).call(this._xform, this._o, x);
      if (res === errorObj) { this._o.onError(res.e); }
    };

    TransduceObserver.prototype.error = function (e) { this._o.onError(e); };

    TransduceObserver.prototype.completed = function () {
      this._xform['@@transducer/result'](this._o);
    };

    return TransduceObserver;
  }(AbstractObserver));

  function transformForObserver(o) {
    return {
      '@@transducer/init': function() {
        return o;
      },
      '@@transducer/step': function(obs, input) {
        return obs.onNext(input);
      },
      '@@transducer/result': function(obs) {
        return obs.onCompleted();
      }
    };
  }

  /**
   * Executes a transducer to transform the observable sequence
   * @param {Transducer} transducer A transducer to execute
   * @returns {Observable} An Observable sequence containing the results from the transducer.
   */
  observableProto.transduce = function(transducer) {
    var source = this;
    return new AnonymousObservable(function(o) {
      var xform = transducer(transformForObserver(o));
      return source.subscribe(new TransduceObserver(o, xform));
    }, source);
  };

  var AnonymousObservable = Rx.AnonymousObservable = (function (__super__) {
    inherits(AnonymousObservable, __super__);

    // Fix subscriber to check for undefined or function returned to decorate as Disposable
    function fixSubscriber(subscriber) {
      return subscriber && isFunction(subscriber.dispose) ? subscriber :
        isFunction(subscriber) ? disposableCreate(subscriber) : disposableEmpty;
    }

    function setDisposable(s, state) {
      var ado = state[0], self = state[1];
      var sub = tryCatch(self.__subscribe).call(self, ado);
      if (sub === errorObj && !ado.fail(errorObj.e)) { thrower(errorObj.e); }
      ado.setDisposable(fixSubscriber(sub));
    }

    function AnonymousObservable(subscribe, parent) {
      this.source = parent;
      this.__subscribe = subscribe;
      __super__.call(this);
    }

    AnonymousObservable.prototype._subscribe = function (o) {
      var ado = new AutoDetachObserver(o), state = [ado, this];

      if (currentThreadScheduler.scheduleRequired()) {
        currentThreadScheduler.schedule(state, setDisposable);
      } else {
        setDisposable(null, state);
      }
      return ado;
    };

    return AnonymousObservable;

  }(Observable));

  var AutoDetachObserver = (function (__super__) {
    inherits(AutoDetachObserver, __super__);

    function AutoDetachObserver(observer) {
      __super__.call(this);
      this.observer = observer;
      this.m = new SingleAssignmentDisposable();
    }

    var AutoDetachObserverPrototype = AutoDetachObserver.prototype;

    AutoDetachObserverPrototype.next = function (value) {
      var result = tryCatch(this.observer.onNext).call(this.observer, value);
      if (result === errorObj) {
        this.dispose();
        thrower(result.e);
      }
    };

    AutoDetachObserverPrototype.error = function (err) {
      var result = tryCatch(this.observer.onError).call(this.observer, err);
      this.dispose();
      result === errorObj && thrower(result.e);
    };

    AutoDetachObserverPrototype.completed = function () {
      var result = tryCatch(this.observer.onCompleted).call(this.observer);
      this.dispose();
      result === errorObj && thrower(result.e);
    };

    AutoDetachObserverPrototype.setDisposable = function (value) { this.m.setDisposable(value); };
    AutoDetachObserverPrototype.getDisposable = function () { return this.m.getDisposable(); };

    AutoDetachObserverPrototype.dispose = function () {
      __super__.prototype.dispose.call(this);
      this.m.dispose();
    };

    return AutoDetachObserver;
  }(AbstractObserver));

  var InnerSubscription = function (s, o) {
    this._s = s;
    this._o = o;
  };

  InnerSubscription.prototype.dispose = function () {
    if (!this._s.isDisposed && this._o !== null) {
      var idx = this._s.observers.indexOf(this._o);
      this._s.observers.splice(idx, 1);
      this._o = null;
    }
  };

  /**
   *  Represents an object that is both an observable sequence as well as an observer.
   *  Each notification is broadcasted to all subscribed observers.
   */
  var Subject = Rx.Subject = (function (__super__) {
    inherits(Subject, __super__);
    function Subject() {
      __super__.call(this);
      this.isDisposed = false;
      this.isStopped = false;
      this.observers = [];
      this.hasError = false;
    }

    addProperties(Subject.prototype, Observer.prototype, {
      _subscribe: function (o) {
        checkDisposed(this);
        if (!this.isStopped) {
          this.observers.push(o);
          return new InnerSubscription(this, o);
        }
        if (this.hasError) {
          o.onError(this.error);
          return disposableEmpty;
        }
        o.onCompleted();
        return disposableEmpty;
      },
      /**
       * Indicates whether the subject has observers subscribed to it.
       * @returns {Boolean} Indicates whether the subject has observers subscribed to it.
       */
      hasObservers: function () { checkDisposed(this); return this.observers.length > 0; },
      /**
       * Notifies all subscribed observers about the end of the sequence.
       */
      onCompleted: function () {
        checkDisposed(this);
        if (!this.isStopped) {
          this.isStopped = true;
          for (var i = 0, os = cloneArray(this.observers), len = os.length; i < len; i++) {
            os[i].onCompleted();
          }

          this.observers.length = 0;
        }
      },
      /**
       * Notifies all subscribed observers about the exception.
       * @param {Mixed} error The exception to send to all observers.
       */
      onError: function (error) {
        checkDisposed(this);
        if (!this.isStopped) {
          this.isStopped = true;
          this.error = error;
          this.hasError = true;
          for (var i = 0, os = cloneArray(this.observers), len = os.length; i < len; i++) {
            os[i].onError(error);
          }

          this.observers.length = 0;
        }
      },
      /**
       * Notifies all subscribed observers about the arrival of the specified element in the sequence.
       * @param {Mixed} value The value to send to all observers.
       */
      onNext: function (value) {
        checkDisposed(this);
        if (!this.isStopped) {
          for (var i = 0, os = cloneArray(this.observers), len = os.length; i < len; i++) {
            os[i].onNext(value);
          }
        }
      },
      /**
       * Unsubscribe all observers and release resources.
       */
      dispose: function () {
        this.isDisposed = true;
        this.observers = null;
      }
    });

    /**
     * Creates a subject from the specified observer and observable.
     * @param {Observer} observer The observer used to send messages to the subject.
     * @param {Observable} observable The observable used to subscribe to messages sent from the subject.
     * @returns {Subject} Subject implemented using the given observer and observable.
     */
    Subject.create = function (observer, observable) {
      return new AnonymousSubject(observer, observable);
    };

    return Subject;
  }(Observable));

  /**
   *  Represents the result of an asynchronous operation.
   *  The last value before the OnCompleted notification, or the error received through OnError, is sent to all subscribed observers.
   */
  var AsyncSubject = Rx.AsyncSubject = (function (__super__) {
    inherits(AsyncSubject, __super__);

    /**
     * Creates a subject that can only receive one value and that value is cached for all future observations.
     * @constructor
     */
    function AsyncSubject() {
      __super__.call(this);
      this.isDisposed = false;
      this.isStopped = false;
      this.hasValue = false;
      this.observers = [];
      this.hasError = false;
    }

    addProperties(AsyncSubject.prototype, Observer.prototype, {
      _subscribe: function (o) {
        checkDisposed(this);

        if (!this.isStopped) {
          this.observers.push(o);
          return new InnerSubscription(this, o);
        }

        if (this.hasError) {
          o.onError(this.error);
        } else if (this.hasValue) {
          o.onNext(this.value);
          o.onCompleted();
        } else {
          o.onCompleted();
        }

        return disposableEmpty;
      },
      /**
       * Indicates whether the subject has observers subscribed to it.
       * @returns {Boolean} Indicates whether the subject has observers subscribed to it.
       */
      hasObservers: function () { checkDisposed(this); return this.observers.length > 0; },
      /**
       * Notifies all subscribed observers about the end of the sequence, also causing the last received value to be sent out (if any).
       */
      onCompleted: function () {
        var i, len;
        checkDisposed(this);
        if (!this.isStopped) {
          this.isStopped = true;
          var os = cloneArray(this.observers), len = os.length;

          if (this.hasValue) {
            for (i = 0; i < len; i++) {
              var o = os[i];
              o.onNext(this.value);
              o.onCompleted();
            }
          } else {
            for (i = 0; i < len; i++) {
              os[i].onCompleted();
            }
          }

          this.observers.length = 0;
        }
      },
      /**
       * Notifies all subscribed observers about the error.
       * @param {Mixed} error The Error to send to all observers.
       */
      onError: function (error) {
        checkDisposed(this);
        if (!this.isStopped) {
          this.isStopped = true;
          this.hasError = true;
          this.error = error;

          for (var i = 0, os = cloneArray(this.observers), len = os.length; i < len; i++) {
            os[i].onError(error);
          }

          this.observers.length = 0;
        }
      },
      /**
       * Sends a value to the subject. The last value received before successful termination will be sent to all subscribed and future observers.
       * @param {Mixed} value The value to store in the subject.
       */
      onNext: function (value) {
        checkDisposed(this);
        if (this.isStopped) { return; }
        this.value = value;
        this.hasValue = true;
      },
      /**
       * Unsubscribe all observers and release resources.
       */
      dispose: function () {
        this.isDisposed = true;
        this.observers = null;
        this.error = null;
        this.value = null;
      }
    });

    return AsyncSubject;
  }(Observable));

  var AnonymousSubject = Rx.AnonymousSubject = (function (__super__) {
    inherits(AnonymousSubject, __super__);
    function AnonymousSubject(observer, observable) {
      this.observer = observer;
      this.observable = observable;
      __super__.call(this);
    }

    addProperties(AnonymousSubject.prototype, Observer.prototype, {
      _subscribe: function (o) {
        return this.observable.subscribe(o);
      },
      onCompleted: function () {
        this.observer.onCompleted();
      },
      onError: function (error) {
        this.observer.onError(error);
      },
      onNext: function (value) {
        this.observer.onNext(value);
      }
    });

    return AnonymousSubject;
  }(Observable));

  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    root.Rx = Rx;

    define(function() {
      return Rx;
    });
  } else if (freeExports && freeModule) {
    // in Node.js or RingoJS
    if (moduleExports) {
      (freeModule.exports = Rx).Rx = Rx;
    } else {
      freeExports.Rx = Rx;
    }
  } else {
    // in a browser or Rhino
    root.Rx = Rx;
  }

  // All code before this point will be filtered from stack traces.
  var rEndingLine = captureLine();

}.call(__commonjs_global));
});

var require$$0 = (rx && typeof rx === 'object' && 'default' in rx ? rx['default'] : rx);

var rx_time = __commonjs(function (module, exports, global) {
// Copyright (c) Microsoft, All rights reserved. See License.txt in the project root for license information.

;(function (factory) {
  var objectTypes = {
    'function': true,
    'object': true
  };

  function checkGlobal(value) {
    return (value && value.Object === Object) ? value : null;
  }

  var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType) ? exports : null;
  var freeModule = (objectTypes[typeof module] && module && !module.nodeType) ? module : null;
  var freeGlobal = checkGlobal(freeExports && freeModule && typeof global === 'object' && global);
  var freeSelf = checkGlobal(objectTypes[typeof self] && self);
  var freeWindow = checkGlobal(objectTypes[typeof window] && window);
  var moduleExports = (freeModule && freeModule.exports === freeExports) ? freeExports : null;
  var thisGlobal = checkGlobal(objectTypes[typeof this] && this);
  var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) || freeSelf || thisGlobal || Function('return this')();

  // Because of build optimizers
  if (typeof define === 'function' && define.amd) {
    define(['./rx'], function (Rx, exports) {
      return factory(root, exports, Rx);
    });
  } else if (typeof module === 'object' && module && module.exports === freeExports) {
    module.exports = factory(root, module.exports, require$$0);
  } else {
    root.Rx = factory(root, {}, root.Rx);
  }
}.call(__commonjs_global, function (root, exp, Rx, undefined) {

  // Refernces
  var inherits = Rx.internals.inherits,
    AbstractObserver = Rx.internals.AbstractObserver,
    Observable = Rx.Observable,
    observableProto = Observable.prototype,
    AnonymousObservable = Rx.AnonymousObservable,
    ObservableBase = Rx.ObservableBase,
    observableDefer = Observable.defer,
    observableEmpty = Observable.empty,
    observableNever = Observable.never,
    observableThrow = Observable['throw'],
    observableFromArray = Observable.fromArray,
    defaultScheduler = Rx.Scheduler['default'],
    SingleAssignmentDisposable = Rx.SingleAssignmentDisposable,
    SerialDisposable = Rx.SerialDisposable,
    CompositeDisposable = Rx.CompositeDisposable,
    BinaryDisposable = Rx.BinaryDisposable,
    RefCountDisposable = Rx.RefCountDisposable,
    Subject = Rx.Subject,
    addRef = Rx.internals.addRef,
    normalizeTime = Rx.Scheduler.normalize,
    helpers = Rx.helpers,
    isPromise = helpers.isPromise,
    isFunction = helpers.isFunction,
    isScheduler = Rx.Scheduler.isScheduler,
    observableFromPromise = Observable.fromPromise;

  var errorObj = {e: {}};
  
  function tryCatcherGen(tryCatchTarget) {
    return function tryCatcher() {
      try {
        return tryCatchTarget.apply(this, arguments);
      } catch (e) {
        errorObj.e = e;
        return errorObj;
      }
    };
  }

  var tryCatch = Rx.internals.tryCatch = function tryCatch(fn) {
    if (!isFunction(fn)) { throw new TypeError('fn must be a function'); }
    return tryCatcherGen(fn);
  };

  function thrower(e) {
    throw e;
  }

  var TimerObservable = (function(__super__) {
    inherits(TimerObservable, __super__);
    function TimerObservable(dt, s) {
      this._dt = dt;
      this._s = s;
      __super__.call(this);
    }

    TimerObservable.prototype.subscribeCore = function (o) {
      return this._s.scheduleFuture(o, this._dt, scheduleMethod);
    };

    function scheduleMethod(s, o) {
      o.onNext(0);
      o.onCompleted();
    }

    return TimerObservable;
  }(ObservableBase));

  function _observableTimer(dueTime, scheduler) {
    return new TimerObservable(dueTime, scheduler);
  }

  function observableTimerDateAndPeriod(dueTime, period, scheduler) {
    return new AnonymousObservable(function (observer) {
      var d = dueTime, p = normalizeTime(period);
      return scheduler.scheduleRecursiveFuture(0, d, function (count, self) {
        if (p > 0) {
          var now = scheduler.now();
          d = new Date(d.getTime() + p);
          d.getTime() <= now && (d = new Date(now + p));
        }
        observer.onNext(count);
        self(count + 1, new Date(d));
      });
    });
  }

  function observableTimerTimeSpanAndPeriod(dueTime, period, scheduler) {
    return dueTime === period ?
      new AnonymousObservable(function (observer) {
        return scheduler.schedulePeriodic(0, period, function (count) {
          observer.onNext(count);
          return count + 1;
        });
      }) :
      observableDefer(function () {
        return observableTimerDateAndPeriod(new Date(scheduler.now() + dueTime), period, scheduler);
      });
  }

  /**
   *  Returns an observable sequence that produces a value after each period.
   *
   * @example
   *  1 - res = Rx.Observable.interval(1000);
   *  2 - res = Rx.Observable.interval(1000, Rx.Scheduler.timeout);
   *
   * @param {Number} period Period for producing the values in the resulting sequence (specified as an integer denoting milliseconds).
   * @param {Scheduler} [scheduler] Scheduler to run the timer on. If not specified, Rx.Scheduler.timeout is used.
   * @returns {Observable} An observable sequence that produces a value after each period.
   */
  var observableinterval = Observable.interval = function (period, scheduler) {
    return observableTimerTimeSpanAndPeriod(period, period, isScheduler(scheduler) ? scheduler : defaultScheduler);
  };

  /**
   *  Returns an observable sequence that produces a value after dueTime has elapsed and then after each period.
   * @param {Number} dueTime Absolute (specified as a Date object) or relative time (specified as an integer denoting milliseconds) at which to produce the first value.
   * @param {Mixed} [periodOrScheduler]  Period to produce subsequent values (specified as an integer denoting milliseconds), or the scheduler to run the timer on. If not specified, the resulting timer is not recurring.
   * @param {Scheduler} [scheduler]  Scheduler to run the timer on. If not specified, the timeout scheduler is used.
   * @returns {Observable} An observable sequence that produces a value after due time has elapsed and then each period.
   */
  var observableTimer = Observable.timer = function (dueTime, periodOrScheduler, scheduler) {
    var period;
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    if (periodOrScheduler != null && typeof periodOrScheduler === 'number') {
      period = periodOrScheduler;
    } else if (isScheduler(periodOrScheduler)) {
      scheduler = periodOrScheduler;
    }
    if ((dueTime instanceof Date || typeof dueTime === 'number') && period === undefined) {
      return _observableTimer(dueTime, scheduler);
    }
    if (dueTime instanceof Date && period !== undefined) {
      return observableTimerDateAndPeriod(dueTime, periodOrScheduler, scheduler);
    }
    return observableTimerTimeSpanAndPeriod(dueTime, period, scheduler);
  };

  function observableDelayRelative(source, dueTime, scheduler) {
    return new AnonymousObservable(function (o) {
      var active = false,
        cancelable = new SerialDisposable(),
        exception = null,
        q = [],
        running = false,
        subscription;
      subscription = source.materialize().timestamp(scheduler).subscribe(function (notification) {
        var d, shouldRun;
        if (notification.value.kind === 'E') {
          q = [];
          q.push(notification);
          exception = notification.value.error;
          shouldRun = !running;
        } else {
          q.push({ value: notification.value, timestamp: notification.timestamp + dueTime });
          shouldRun = !active;
          active = true;
        }
        if (shouldRun) {
          if (exception !== null) {
            o.onError(exception);
          } else {
            d = new SingleAssignmentDisposable();
            cancelable.setDisposable(d);
            d.setDisposable(scheduler.scheduleRecursiveFuture(null, dueTime, function (_, self) {
              var e, recurseDueTime, result, shouldRecurse;
              if (exception !== null) {
                return;
              }
              running = true;
              do {
                result = null;
                if (q.length > 0 && q[0].timestamp - scheduler.now() <= 0) {
                  result = q.shift().value;
                }
                if (result !== null) {
                  result.accept(o);
                }
              } while (result !== null);
              shouldRecurse = false;
              recurseDueTime = 0;
              if (q.length > 0) {
                shouldRecurse = true;
                recurseDueTime = Math.max(0, q[0].timestamp - scheduler.now());
              } else {
                active = false;
              }
              e = exception;
              running = false;
              if (e !== null) {
                o.onError(e);
              } else if (shouldRecurse) {
                self(null, recurseDueTime);
              }
            }));
          }
        }
      });
      return new BinaryDisposable(subscription, cancelable);
    }, source);
  }

  function observableDelayAbsolute(source, dueTime, scheduler) {
    return observableDefer(function () {
      return observableDelayRelative(source, dueTime - scheduler.now(), scheduler);
    });
  }

  function delayWithSelector(source, subscriptionDelay, delayDurationSelector) {
    var subDelay, selector;
    if (isFunction(subscriptionDelay)) {
      selector = subscriptionDelay;
    } else {
      subDelay = subscriptionDelay;
      selector = delayDurationSelector;
    }
    return new AnonymousObservable(function (o) {
      var delays = new CompositeDisposable(), atEnd = false, subscription = new SerialDisposable();

      function start() {
        subscription.setDisposable(source.subscribe(
          function (x) {
            var delay = tryCatch(selector)(x);
            if (delay === errorObj) { return o.onError(delay.e); }
            var d = new SingleAssignmentDisposable();
            delays.add(d);
            d.setDisposable(delay.subscribe(
              function () {
                o.onNext(x);
                delays.remove(d);
                done();
              },
              function (e) { o.onError(e); },
              function () {
                o.onNext(x);
                delays.remove(d);
                done();
              }
            ));
          },
          function (e) { o.onError(e); },
          function () {
            atEnd = true;
            subscription.dispose();
            done();
          }
        ));
      }

      function done () {
        atEnd && delays.length === 0 && o.onCompleted();
      }

      if (!subDelay) {
        start();
      } else {
        subscription.setDisposable(subDelay.subscribe(start, function (e) { o.onError(e); }, start));
      }

      return new BinaryDisposable(subscription, delays);
    }, source);
  }

  /**
   *  Time shifts the observable sequence by dueTime.
   *  The relative time intervals between the values are preserved.
   *
   * @param {Number} dueTime Absolute (specified as a Date object) or relative time (specified as an integer denoting milliseconds) by which to shift the observable sequence.
   * @param {Scheduler} [scheduler] Scheduler to run the delay timers on. If not specified, the timeout scheduler is used.
   * @returns {Observable} Time-shifted sequence.
   */
  observableProto.delay = function () {
    var firstArg = arguments[0];
    if (typeof firstArg === 'number' || firstArg instanceof Date) {
      var dueTime = firstArg, scheduler = arguments[1];
      isScheduler(scheduler) || (scheduler = defaultScheduler);
      return dueTime instanceof Date ?
        observableDelayAbsolute(this, dueTime, scheduler) :
        observableDelayRelative(this, dueTime, scheduler);
    } else if (Observable.isObservable(firstArg) || isFunction(firstArg)) {
      return delayWithSelector(this, firstArg, arguments[1]);
    } else {
      throw new Error('Invalid arguments');
    }
  };

  var DebounceObservable = (function (__super__) {
    inherits(DebounceObservable, __super__);
    function DebounceObservable(source, dt, s) {
      isScheduler(s) || (s = defaultScheduler);
      this.source = source;
      this._dt = dt;
      this._s = s;
      __super__.call(this);
    }

    DebounceObservable.prototype.subscribeCore = function (o) {
      var cancelable = new SerialDisposable();
      return new BinaryDisposable(
        this.source.subscribe(new DebounceObserver(o, this._dt, this._s, cancelable)),
        cancelable);
    };

    return DebounceObservable;
  }(ObservableBase));

  var DebounceObserver = (function (__super__) {
    inherits(DebounceObserver, __super__);
    function DebounceObserver(observer, dueTime, scheduler, cancelable) {
      this._o = observer;
      this._d = dueTime;
      this._scheduler = scheduler;
      this._c = cancelable;
      this._v = null;
      this._hv = false;
      this._id = 0;
      __super__.call(this);
    }

    function scheduleFuture(s, state) {
      state.self._hv && state.self._id === state.currentId && state.self._o.onNext(state.x);
      state.self._hv = false;
    }

    DebounceObserver.prototype.next = function (x) {
      this._hv = true;
      this._v = x;
      var currentId = ++this._id, d = new SingleAssignmentDisposable();
      this._c.setDisposable(d);
      d.setDisposable(this._scheduler.scheduleFuture(this, this._d, function (_, self) {
        self._hv && self._id === currentId && self._o.onNext(x);
        self._hv = false;
      }));
    };

    DebounceObserver.prototype.error = function (e) {
      this._c.dispose();
      this._o.onError(e);
      this._hv = false;
      this._id++;
    };

    DebounceObserver.prototype.completed = function () {
      this._c.dispose();
      this._hv && this._o.onNext(this._v);
      this._o.onCompleted();
      this._hv = false;
      this._id++;
    };

    return DebounceObserver;
  }(AbstractObserver));

  function debounceWithSelector(source, durationSelector) {
    return new AnonymousObservable(function (o) {
      var value, hasValue = false, cancelable = new SerialDisposable(), id = 0;
      var subscription = source.subscribe(
        function (x) {
          var throttle = tryCatch(durationSelector)(x);
          if (throttle === errorObj) { return o.onError(throttle.e); }

          isPromise(throttle) && (throttle = observableFromPromise(throttle));

          hasValue = true;
          value = x;
          id++;
          var currentid = id, d = new SingleAssignmentDisposable();
          cancelable.setDisposable(d);
          d.setDisposable(throttle.subscribe(
            function () {
              hasValue && id === currentid && o.onNext(value);
              hasValue = false;
              d.dispose();
            },
            function (e) { o.onError(e); },
            function () {
              hasValue && id === currentid && o.onNext(value);
              hasValue = false;
              d.dispose();
            }
          ));
        },
        function (e) {
          cancelable.dispose();
          o.onError(e);
          hasValue = false;
          id++;
        },
        function () {
          cancelable.dispose();
          hasValue && o.onNext(value);
          o.onCompleted();
          hasValue = false;
          id++;
        }
      );
      return new BinaryDisposable(subscription, cancelable);
    }, source);
  }

  observableProto.debounce = function () {
    if (isFunction (arguments[0])) {
      return debounceWithSelector(this, arguments[0]);
    } else if (typeof arguments[0] === 'number') {
      return new DebounceObservable(this, arguments[0], arguments[1]);
    } else {
      throw new Error('Invalid arguments');
    }
  };

  /**
   *  Projects each element of an observable sequence into zero or more windows which are produced based on timing information.
   * @param {Number} timeSpan Length of each window (specified as an integer denoting milliseconds).
   * @param {Mixed} [timeShiftOrScheduler]  Interval between creation of consecutive windows (specified as an integer denoting milliseconds), or an optional scheduler parameter. If not specified, the time shift corresponds to the timeSpan parameter, resulting in non-overlapping adjacent windows.
   * @param {Scheduler} [scheduler]  Scheduler to run windowing timers on. If not specified, the timeout scheduler is used.
   * @returns {Observable} An observable sequence of windows.
   */
  observableProto.windowWithTime = observableProto.windowTime = function (timeSpan, timeShiftOrScheduler, scheduler) {
    var source = this, timeShift;
    timeShiftOrScheduler == null && (timeShift = timeSpan);
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    if (typeof timeShiftOrScheduler === 'number') {
      timeShift = timeShiftOrScheduler;
    } else if (isScheduler(timeShiftOrScheduler)) {
      timeShift = timeSpan;
      scheduler = timeShiftOrScheduler;
    }
    return new AnonymousObservable(function (observer) {
      var groupDisposable,
        nextShift = timeShift,
        nextSpan = timeSpan,
        q = [],
        refCountDisposable,
        timerD = new SerialDisposable(),
        totalTime = 0;
        groupDisposable = new CompositeDisposable(timerD),
        refCountDisposable = new RefCountDisposable(groupDisposable);

       function createTimer () {
        var m = new SingleAssignmentDisposable(),
          isSpan = false,
          isShift = false;
        timerD.setDisposable(m);
        if (nextSpan === nextShift) {
          isSpan = true;
          isShift = true;
        } else if (nextSpan < nextShift) {
            isSpan = true;
        } else {
          isShift = true;
        }
        var newTotalTime = isSpan ? nextSpan : nextShift,
          ts = newTotalTime - totalTime;
        totalTime = newTotalTime;
        if (isSpan) {
          nextSpan += timeShift;
        }
        if (isShift) {
          nextShift += timeShift;
        }
        m.setDisposable(scheduler.scheduleFuture(null, ts, function () {
          if (isShift) {
            var s = new Subject();
            q.push(s);
            observer.onNext(addRef(s, refCountDisposable));
          }
          isSpan && q.shift().onCompleted();
          createTimer();
        }));
      };
      q.push(new Subject());
      observer.onNext(addRef(q[0], refCountDisposable));
      createTimer();
      groupDisposable.add(source.subscribe(
        function (x) {
          for (var i = 0, len = q.length; i < len; i++) { q[i].onNext(x); }
        },
        function (e) {
          for (var i = 0, len = q.length; i < len; i++) { q[i].onError(e); }
          observer.onError(e);
        },
        function () {
          for (var i = 0, len = q.length; i < len; i++) { q[i].onCompleted(); }
          observer.onCompleted();
        }
      ));
      return refCountDisposable;
    }, source);
  };

  /**
   *  Projects each element of an observable sequence into a window that is completed when either it's full or a given amount of time has elapsed.
   * @param {Number} timeSpan Maximum time length of a window.
   * @param {Number} count Maximum element count of a window.
   * @param {Scheduler} [scheduler]  Scheduler to run windowing timers on. If not specified, the timeout scheduler is used.
   * @returns {Observable} An observable sequence of windows.
   */
  observableProto.windowWithTimeOrCount = observableProto.windowTimeOrCount = function (timeSpan, count, scheduler) {
    var source = this;
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return new AnonymousObservable(function (observer) {
      var timerD = new SerialDisposable(),
          groupDisposable = new CompositeDisposable(timerD),
          refCountDisposable = new RefCountDisposable(groupDisposable),
          n = 0,
          windowId = 0,
          s = new Subject();

      function createTimer(id) {
        var m = new SingleAssignmentDisposable();
        timerD.setDisposable(m);
        m.setDisposable(scheduler.scheduleFuture(null, timeSpan, function () {
          if (id !== windowId) { return; }
          n = 0;
          var newId = ++windowId;
          s.onCompleted();
          s = new Subject();
          observer.onNext(addRef(s, refCountDisposable));
          createTimer(newId);
        }));
      }

      observer.onNext(addRef(s, refCountDisposable));
      createTimer(0);

      groupDisposable.add(source.subscribe(
        function (x) {
          var newId = 0, newWindow = false;
          s.onNext(x);
          if (++n === count) {
            newWindow = true;
            n = 0;
            newId = ++windowId;
            s.onCompleted();
            s = new Subject();
            observer.onNext(addRef(s, refCountDisposable));
          }
          newWindow && createTimer(newId);
        },
        function (e) {
          s.onError(e);
          observer.onError(e);
        }, function () {
          s.onCompleted();
          observer.onCompleted();
        }
      ));
      return refCountDisposable;
    }, source);
  };

  function toArray(x) { return x.toArray(); }

  /**
   *  Projects each element of an observable sequence into zero or more buffers which are produced based on timing information.
   * @param {Number} timeSpan Length of each buffer (specified as an integer denoting milliseconds).
   * @param {Mixed} [timeShiftOrScheduler]  Interval between creation of consecutive buffers (specified as an integer denoting milliseconds), or an optional scheduler parameter. If not specified, the time shift corresponds to the timeSpan parameter, resulting in non-overlapping adjacent buffers.
   * @param {Scheduler} [scheduler]  Scheduler to run buffer timers on. If not specified, the timeout scheduler is used.
   * @returns {Observable} An observable sequence of buffers.
   */
  observableProto.bufferWithTime = observableProto.bufferTime = function (timeSpan, timeShiftOrScheduler, scheduler) {
    return this.windowWithTime(timeSpan, timeShiftOrScheduler, scheduler).flatMap(toArray);
  };

  function toArray(x) { return x.toArray(); }

  /**
   *  Projects each element of an observable sequence into a buffer that is completed when either it's full or a given amount of time has elapsed.
   * @param {Number} timeSpan Maximum time length of a buffer.
   * @param {Number} count Maximum element count of a buffer.
   * @param {Scheduler} [scheduler]  Scheduler to run bufferin timers on. If not specified, the timeout scheduler is used.
   * @returns {Observable} An observable sequence of buffers.
   */
  observableProto.bufferWithTimeOrCount = observableProto.bufferTimeOrCount = function (timeSpan, count, scheduler) {
    return this.windowWithTimeOrCount(timeSpan, count, scheduler).flatMap(toArray);
  };

  var TimeIntervalObservable = (function (__super__) {
    inherits(TimeIntervalObservable, __super__);
    function TimeIntervalObservable(source, s) {
      this.source = source;
      this._s = s;
      __super__.call(this);
    }

    TimeIntervalObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new TimeIntervalObserver(o, this._s));
    };

    return TimeIntervalObservable;
  }(ObservableBase));

  var TimeIntervalObserver = (function (__super__) {
    inherits(TimeIntervalObserver, __super__);

    function TimeIntervalObserver(o, s) {
      this._o = o;
      this._s = s;
      this._l = s.now();
      __super__.call(this);
    }

    TimeIntervalObserver.prototype.next = function (x) {
      var now = this._s.now(), span = now - this._l;
      this._l = now;
      this._o.onNext({ value: x, interval: span });
    };
    TimeIntervalObserver.prototype.error = function (e) { this._o.onError(e); };
    TimeIntervalObserver.prototype.completed = function () { this._o.onCompleted(); };

    return TimeIntervalObserver;
  }(AbstractObserver));

  /**
   *  Records the time interval between consecutive values in an observable sequence.
   *
   * @example
   *  1 - res = source.timeInterval();
   *  2 - res = source.timeInterval(Rx.Scheduler.timeout);
   *
   * @param [scheduler]  Scheduler used to compute time intervals. If not specified, the timeout scheduler is used.
   * @returns {Observable} An observable sequence with time interval information on values.
   */
  observableProto.timeInterval = function (scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return new TimeIntervalObservable(this, scheduler);
  };

  var TimestampObservable = (function (__super__) {
    inherits(TimestampObservable, __super__);
    function TimestampObservable(source, s) {
      this.source = source;
      this._s = s;
      __super__.call(this);
    }

    TimestampObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new TimestampObserver(o, this._s));
    };

    return TimestampObservable;
  }(ObservableBase));

  var TimestampObserver = (function (__super__) {
    inherits(TimestampObserver, __super__);
    function TimestampObserver(o, s) {
      this._o = o;
      this._s = s;
      __super__.call(this);
    }

    TimestampObserver.prototype.next = function (x) {
      this._o.onNext({ value: x, timestamp: this._s.now() });
    };

    TimestampObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    TimestampObserver.prototype.completed = function () {
      this._o.onCompleted();
    };

    return TimestampObserver;
  }(AbstractObserver));

  /**
   *  Records the timestamp for each value in an observable sequence.
   *
   * @example
   *  1 - res = source.timestamp(); // produces { value: x, timestamp: ts }
   *  2 - res = source.timestamp(Rx.Scheduler.default);
   *
   * @param {Scheduler} [scheduler]  Scheduler used to compute timestamps. If not specified, the default scheduler is used.
   * @returns {Observable} An observable sequence with timestamp information on values.
   */
  observableProto.timestamp = function (scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return new TimestampObservable(this, scheduler);
  };

  var SampleObservable = (function(__super__) {
    inherits(SampleObservable, __super__);
    function SampleObservable(source, sampler) {
      this.source = source;
      this._sampler = sampler;
      __super__.call(this);
    }

    SampleObservable.prototype.subscribeCore = function (o) {
      var state = {
        o: o,
        atEnd: false,
        value: null,
        hasValue: false,
        sourceSubscription: new SingleAssignmentDisposable()
      };

      state.sourceSubscription.setDisposable(this.source.subscribe(new SampleSourceObserver(state)));
      return new BinaryDisposable(
        state.sourceSubscription,
        this._sampler.subscribe(new SamplerObserver(state))
      );
    };

    return SampleObservable;
  }(ObservableBase));

  var SamplerObserver = (function(__super__) {
    inherits(SamplerObserver, __super__);
    function SamplerObserver(s) {
      this._s = s;
      __super__.call(this);
    }

    SamplerObserver.prototype._handleMessage = function () {
      if (this._s.hasValue) {
        this._s.hasValue = false;
        this._s.o.onNext(this._s.value);
      }
      this._s.atEnd && this._s.o.onCompleted();
    };

    SamplerObserver.prototype.next = function () { this._handleMessage(); };
    SamplerObserver.prototype.error = function (e) { this._s.onError(e); };
    SamplerObserver.prototype.completed = function () { this._handleMessage(); };

    return SamplerObserver;
  }(AbstractObserver));

  var SampleSourceObserver = (function(__super__) {
    inherits(SampleSourceObserver, __super__);
    function SampleSourceObserver(s) {
      this._s = s;
      __super__.call(this);
    }

    SampleSourceObserver.prototype.next = function (x) {
      this._s.hasValue = true;
      this._s.value = x;
    };
    SampleSourceObserver.prototype.error = function (e) { this._s.o.onError(e); };
    SampleSourceObserver.prototype.completed = function () {
      this._s.atEnd = true;
      this._s.sourceSubscription.dispose();
    };

    return SampleSourceObserver;
  }(AbstractObserver));

  /**
   *  Samples the observable sequence at each interval.
   *
   * @example
   *  1 - res = source.sample(sampleObservable); // Sampler tick sequence
   *  2 - res = source.sample(5000); // 5 seconds
   *  2 - res = source.sample(5000, Rx.Scheduler.timeout); // 5 seconds
   *
   * @param {Mixed} intervalOrSampler Interval at which to sample (specified as an integer denoting milliseconds) or Sampler Observable.
   * @param {Scheduler} [scheduler]  Scheduler to run the sampling timer on. If not specified, the timeout scheduler is used.
   * @returns {Observable} Sampled observable sequence.
   */
  observableProto.sample = function (intervalOrSampler, scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return typeof intervalOrSampler === 'number' ?
      new SampleObservable(this, observableinterval(intervalOrSampler, scheduler)) :
      new SampleObservable(this, intervalOrSampler);
  };

  var TimeoutError = Rx.TimeoutError = function(message) {
    this.message = message || 'Timeout has occurred';
    this.name = 'TimeoutError';
    Error.call(this);
  };
  TimeoutError.prototype = Object.create(Error.prototype);

  function timeoutWithSelector(source, firstTimeout, timeoutDurationSelector, other) {
    if (isFunction(firstTimeout)) {
      other = timeoutDurationSelector;
      timeoutDurationSelector = firstTimeout;
      firstTimeout = observableNever();
    }
    Observable.isObservable(other) || (other = observableThrow(new TimeoutError()));
    return new AnonymousObservable(function (o) {
      var subscription = new SerialDisposable(),
        timer = new SerialDisposable(),
        original = new SingleAssignmentDisposable();

      subscription.setDisposable(original);

      var id = 0, switched = false;

      function setTimer(timeout) {
        var myId = id, d = new SingleAssignmentDisposable();

        function timerWins() {
          switched = (myId === id);
          return switched;
        }

        timer.setDisposable(d);
        d.setDisposable(timeout.subscribe(function () {
          timerWins() && subscription.setDisposable(other.subscribe(o));
          d.dispose();
        }, function (e) {
          timerWins() && o.onError(e);
        }, function () {
          timerWins() && subscription.setDisposable(other.subscribe(o));
        }));
      };

      setTimer(firstTimeout);

      function oWins() {
        var res = !switched;
        if (res) { id++; }
        return res;
      }

      original.setDisposable(source.subscribe(function (x) {
        if (oWins()) {
          o.onNext(x);
          var timeout = tryCatch(timeoutDurationSelector)(x);
          if (timeout === errorObj) { return o.onError(timeout.e); }
          setTimer(isPromise(timeout) ? observableFromPromise(timeout) : timeout);
        }
      }, function (e) {
        oWins() && o.onError(e);
      }, function () {
        oWins() && o.onCompleted();
      }));
      return new BinaryDisposable(subscription, timer);
    }, source);
  }

  function timeout(source, dueTime, other, scheduler) {
    if (isScheduler(other)) {
      scheduler = other;
      other = observableThrow(new TimeoutError());
    }
    if (other instanceof Error) { other = observableThrow(other); }
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    Observable.isObservable(other) || (other = observableThrow(new TimeoutError()));
    return new AnonymousObservable(function (o) {
      var id = 0,
        original = new SingleAssignmentDisposable(),
        subscription = new SerialDisposable(),
        switched = false,
        timer = new SerialDisposable();

      subscription.setDisposable(original);

      function createTimer() {
        var myId = id;
        timer.setDisposable(scheduler.scheduleFuture(null, dueTime, function () {
          switched = id === myId;
          if (switched) {
            isPromise(other) && (other = observableFromPromise(other));
            subscription.setDisposable(other.subscribe(o));
          }
        }));
      }

      createTimer();

      original.setDisposable(source.subscribe(function (x) {
        if (!switched) {
          id++;
          o.onNext(x);
          createTimer();
        }
      }, function (e) {
        if (!switched) {
          id++;
          o.onError(e);
        }
      }, function () {
        if (!switched) {
          id++;
          o.onCompleted();
        }
      }));
      return new BinaryDisposable(subscription, timer);
    }, source);
  }

  observableProto.timeout = function () {
    var firstArg = arguments[0];
    if (firstArg instanceof Date || typeof firstArg === 'number') {
      return timeout(this, firstArg, arguments[1], arguments[2]);
    } else if (Observable.isObservable(firstArg) || isFunction(firstArg)) {
      return timeoutWithSelector(this, firstArg, arguments[1], arguments[2]);
    } else {
      throw new Error('Invalid arguments');
    }
  };

  var GenerateAbsoluteObservable = (function (__super__) {
    inherits(GenerateAbsoluteObservable, __super__);
    function GenerateAbsoluteObservable(state, cndFn, itrFn, resFn, timeFn, s) {
      this._state = state;
      this._cndFn = cndFn;
      this._itrFn = itrFn;
      this._resFn = resFn;
      this._timeFn = timeFn;
      this._s = s;
      __super__.call(this);
    }

    function scheduleRecursive(state, recurse) {
      state.hasResult && state.o.onNext(state.result);

      if (state.first) {
        state.first = false;
      } else {
        state.newState = tryCatch(state.self._itrFn)(state.newState);
        if (state.newState === errorObj) { return state.o.onError(state.newState.e); }
      }
      state.hasResult = tryCatch(state.self._cndFn)(state.newState);
      if (state.hasResult === errorObj) { return state.o.onError(state.hasResult.e); }
      if (state.hasResult) {
        state.result = tryCatch(state.self._resFn)(state.newState);
        if (state.result === errorObj) { return state.o.onError(state.result.e); }
        var time = tryCatch(state.self._timeFn)(state.newState);
        if (time === errorObj) { return state.o.onError(time.e); }
        recurse(state, time);
      } else {
        state.o.onCompleted();
      }
    }

    GenerateAbsoluteObservable.prototype.subscribeCore = function (o) {
      var state = {
        o: o,
        self: this,
        newState: this._state,
        first: true,
        hasResult: false
      };
      return this._s.scheduleRecursiveFuture(state, new Date(this._s.now()), scheduleRecursive);
    };

    return GenerateAbsoluteObservable;
  }(ObservableBase));

  /**
   *  GenerateAbsolutes an observable sequence by iterating a state from an initial state until the condition fails.
   *
   * @example
   *  res = source.generateWithAbsoluteTime(0,
   *      function (x) { return return true; },
   *      function (x) { return x + 1; },
   *      function (x) { return x; },
   *      function (x) { return new Date(); }
   *  });
   *
   * @param {Mixed} initialState Initial state.
   * @param {Function} condition Condition to terminate generation (upon returning false).
   * @param {Function} iterate Iteration step function.
   * @param {Function} resultSelector Selector function for results produced in the sequence.
   * @param {Function} timeSelector Time selector function to control the speed of values being produced each iteration, returning Date values.
   * @param {Scheduler} [scheduler]  Scheduler on which to run the generator loop. If not specified, the timeout scheduler is used.
   * @returns {Observable} The generated sequence.
   */
  Observable.generateWithAbsoluteTime = function (initialState, condition, iterate, resultSelector, timeSelector, scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return new GenerateAbsoluteObservable(initialState, condition, iterate, resultSelector, timeSelector, scheduler);
  };

  var GenerateRelativeObservable = (function (__super__) {
    inherits(GenerateRelativeObservable, __super__);
    function GenerateRelativeObservable(state, cndFn, itrFn, resFn, timeFn, s) {
      this._state = state;
      this._cndFn = cndFn;
      this._itrFn = itrFn;
      this._resFn = resFn;
      this._timeFn = timeFn;
      this._s = s;
      __super__.call(this);
    }

    function scheduleRecursive(state, recurse) {
      state.hasResult && state.o.onNext(state.result);

      if (state.first) {
        state.first = false;
      } else {
        state.newState = tryCatch(state.self._itrFn)(state.newState);
        if (state.newState === errorObj) { return state.o.onError(state.newState.e); }
      }

      state.hasResult = tryCatch(state.self._cndFn)(state.newState);
      if (state.hasResult === errorObj) { return state.o.onError(state.hasResult.e); }
      if (state.hasResult) {
        state.result = tryCatch(state.self._resFn)(state.newState);
        if (state.result === errorObj) { return state.o.onError(state.result.e); }
        var time = tryCatch(state.self._timeFn)(state.newState);
        if (time === errorObj) { return state.o.onError(time.e); }
        recurse(state, time);
      } else {
        state.o.onCompleted();
      }
    }

    GenerateRelativeObservable.prototype.subscribeCore = function (o) {
      var state = {
        o: o,
        self: this,
        newState: this._state,
        first: true,
        hasResult: false
      };
      return this._s.scheduleRecursiveFuture(state, 0, scheduleRecursive);
    };

    return GenerateRelativeObservable;
  }(ObservableBase));

  /**
   *  Generates an observable sequence by iterating a state from an initial state until the condition fails.
   *
   * @example
   *  res = source.generateWithRelativeTime(0,
   *      function (x) { return return true; },
   *      function (x) { return x + 1; },
   *      function (x) { return x; },
   *      function (x) { return 500; }
   *  );
   *
   * @param {Mixed} initialState Initial state.
   * @param {Function} condition Condition to terminate generation (upon returning false).
   * @param {Function} iterate Iteration step function.
   * @param {Function} resultSelector Selector function for results produced in the sequence.
   * @param {Function} timeSelector Time selector function to control the speed of values being produced each iteration, returning integer values denoting milliseconds.
   * @param {Scheduler} [scheduler]  Scheduler on which to run the generator loop. If not specified, the timeout scheduler is used.
   * @returns {Observable} The generated sequence.
   */
  Observable.generateWithRelativeTime = function (initialState, condition, iterate, resultSelector, timeSelector, scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return new GenerateRelativeObservable(initialState, condition, iterate, resultSelector, timeSelector, scheduler);
  };

  var DelaySubscription = (function(__super__) {
    inherits(DelaySubscription, __super__);
    function DelaySubscription(source, dt, s) {
      this.source = source;
      this._dt = dt;
      this._s = s;
      __super__.call(this);
    }

    DelaySubscription.prototype.subscribeCore = function (o) {
      var d = new SerialDisposable();

      d.setDisposable(this._s.scheduleFuture([this.source, o, d], this._dt, scheduleMethod));

      return d;
    };

    function scheduleMethod(s, state) {
      var source = state[0], o = state[1], d = state[2];
      d.setDisposable(source.subscribe(o));
    }

    return DelaySubscription;
  }(ObservableBase));

  /**
   *  Time shifts the observable sequence by delaying the subscription with the specified relative time duration, using the specified scheduler to run timers.
   *
   * @example
   *  1 - res = source.delaySubscription(5000); // 5s
   *  2 - res = source.delaySubscription(5000, Rx.Scheduler.default); // 5 seconds
   *
   * @param {Number} dueTime Relative or absolute time shift of the subscription.
   * @param {Scheduler} [scheduler]  Scheduler to run the subscription delay timer on. If not specified, the timeout scheduler is used.
   * @returns {Observable} Time-shifted sequence.
   */
  observableProto.delaySubscription = function (dueTime, scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return new DelaySubscription(this, dueTime, scheduler);
  };

  var SkipLastWithTimeObservable = (function (__super__) {
    inherits(SkipLastWithTimeObservable, __super__);
    function SkipLastWithTimeObservable(source, d, s) {
      this.source = source;
      this._d = d;
      this._s = s;
      __super__.call(this);
    }

    SkipLastWithTimeObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new SkipLastWithTimeObserver(o, this));
    };

    return SkipLastWithTimeObservable;
  }(ObservableBase));

  var SkipLastWithTimeObserver = (function (__super__) {
    inherits(SkipLastWithTimeObserver, __super__);

    function SkipLastWithTimeObserver(o, p) {
      this._o = o;
      this._s = p._s;
      this._d = p._d;
      this._q = [];
      __super__.call(this);
    }

    SkipLastWithTimeObserver.prototype.next = function (x) {
      var now = this._s.now();
      this._q.push({ interval: now, value: x });
      while (this._q.length > 0 && now - this._q[0].interval >= this._d) {
        this._o.onNext(this._q.shift().value);
      }
    };
    SkipLastWithTimeObserver.prototype.error = function (e) { this._o.onError(e); };
    SkipLastWithTimeObserver.prototype.completed = function () {
      var now = this._s.now();
      while (this._q.length > 0 && now - this._q[0].interval >= this._d) {
        this._o.onNext(this._q.shift().value);
      }
      this._o.onCompleted();
    };

    return SkipLastWithTimeObserver;
  }(AbstractObserver));

  /**
   *  Skips elements for the specified duration from the end of the observable source sequence, using the specified scheduler to run timers.
   * @description
   *  This operator accumulates a queue with a length enough to store elements received during the initial duration window.
   *  As more elements are received, elements older than the specified duration are taken from the queue and produced on the
   *  result sequence. This causes elements to be delayed with duration.
   * @param {Number} duration Duration for skipping elements from the end of the sequence.
   * @param {Scheduler} [scheduler]  Scheduler to run the timer on. If not specified, defaults to Rx.Scheduler.timeout
   * @returns {Observable} An observable sequence with the elements skipped during the specified duration from the end of the source sequence.
   */
  observableProto.skipLastWithTime = function (duration, scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return new SkipLastWithTimeObservable(this, duration, scheduler);
  };

  var TakeLastWithTimeObservable = (function (__super__) {
    inherits(TakeLastWithTimeObservable, __super__);
    function TakeLastWithTimeObservable(source, d, s) {
      this.source = source;
      this._d = d;
      this._s = s;
      __super__.call(this);
    }

    TakeLastWithTimeObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new TakeLastWithTimeObserver(o, this._d, this._s));
    };

    return TakeLastWithTimeObservable;
  }(ObservableBase));

  var TakeLastWithTimeObserver = (function (__super__) {
    inherits(TakeLastWithTimeObserver, __super__);

    function TakeLastWithTimeObserver(o, d, s) {
      this._o = o;
      this._d = d;
      this._s = s;
      this._q = [];
      __super__.call(this);
    }

    TakeLastWithTimeObserver.prototype.next = function (x) {
      var now = this._s.now();
      this._q.push({ interval: now, value: x });
      while (this._q.length > 0 && now - this._q[0].interval >= this._d) {
        this._q.shift();
      }
    };
    TakeLastWithTimeObserver.prototype.error = function (e) { this._o.onError(e); };
    TakeLastWithTimeObserver.prototype.completed = function () {
      var now = this._s.now();
      while (this._q.length > 0) {
        var next = this._q.shift();
        if (now - next.interval <= this._d) { this._o.onNext(next.value); }
      }
      this._o.onCompleted();
    };

    return TakeLastWithTimeObserver;
  }(AbstractObserver));

  /**
   *  Returns elements within the specified duration from the end of the observable source sequence, using the specified schedulers to run timers and to drain the collected elements.
   * @description
   *  This operator accumulates a queue with a length enough to store elements received during the initial duration window.
   *  As more elements are received, elements older than the specified duration are taken from the queue and produced on the
   *  result sequence. This causes elements to be delayed with duration.
   * @param {Number} duration Duration for taking elements from the end of the sequence.
   * @param {Scheduler} [scheduler]  Scheduler to run the timer on. If not specified, defaults to Rx.Scheduler.timeout.
   * @returns {Observable} An observable sequence with the elements taken during the specified duration from the end of the source sequence.
   */
  observableProto.takeLastWithTime = function (duration, scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return new TakeLastWithTimeObservable(this, duration, scheduler);
  };

  /**
   *  Returns an array with the elements within the specified duration from the end of the observable source sequence, using the specified scheduler to run timers.
   * @description
   *  This operator accumulates a queue with a length enough to store elements received during the initial duration window.
   *  As more elements are received, elements older than the specified duration are taken from the queue and produced on the
   *  result sequence. This causes elements to be delayed with duration.
   * @param {Number} duration Duration for taking elements from the end of the sequence.
   * @param {Scheduler} scheduler Scheduler to run the timer on. If not specified, defaults to Rx.Scheduler.timeout.
   * @returns {Observable} An observable sequence containing a single array with the elements taken during the specified duration from the end of the source sequence.
   */
  observableProto.takeLastBufferWithTime = function (duration, scheduler) {
    var source = this;
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return new AnonymousObservable(function (o) {
      var q = [];
      return source.subscribe(function (x) {
        var now = scheduler.now();
        q.push({ interval: now, value: x });
        while (q.length > 0 && now - q[0].interval >= duration) {
          q.shift();
        }
      }, function (e) { o.onError(e); }, function () {
        var now = scheduler.now(), res = [];
        while (q.length > 0) {
          var next = q.shift();
          now - next.interval <= duration && res.push(next.value);
        }
        o.onNext(res);
        o.onCompleted();
      });
    }, source);
  };

  var TakeWithTimeObservable = (function (__super__) {
    inherits(TakeWithTimeObservable, __super__);
    function TakeWithTimeObservable(source, d, s) {
      this.source = source;
      this._d = d;
      this._s = s;
      __super__.call(this);
    }

    function scheduleMethod(s, o) {
      o.onCompleted();
    }

    TakeWithTimeObservable.prototype.subscribeCore = function (o) {
      return new BinaryDisposable(
        this._s.scheduleFuture(o, this._d, scheduleMethod),
        this.source.subscribe(o)
      );
    };

    return TakeWithTimeObservable;
  }(ObservableBase));

  /**
   *  Takes elements for the specified duration from the start of the observable source sequence, using the specified scheduler to run timers.
   *
   * @example
   *  1 - res = source.takeWithTime(5000,  [optional scheduler]);
   * @description
   *  This operator accumulates a queue with a length enough to store elements received during the initial duration window.
   *  As more elements are received, elements older than the specified duration are taken from the queue and produced on the
   *  result sequence. This causes elements to be delayed with duration.
   * @param {Number} duration Duration for taking elements from the start of the sequence.
   * @param {Scheduler} scheduler Scheduler to run the timer on. If not specified, defaults to Rx.Scheduler.timeout.
   * @returns {Observable} An observable sequence with the elements taken during the specified duration from the start of the source sequence.
   */
  observableProto.takeWithTime = function (duration, scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return new TakeWithTimeObservable(this, duration, scheduler);
  };

  var SkipWithTimeObservable = (function (__super__) {
    inherits(SkipWithTimeObservable, __super__);
    function SkipWithTimeObservable(source, d, s) {
      this.source = source;
      this._d = d;
      this._s = s;
      this._open = false;
      __super__.call(this);
    }

    function scheduleMethod(s, self) {
      self._open = true;
    }

    SkipWithTimeObservable.prototype.subscribeCore = function (o) {
      return new BinaryDisposable(
        this._s.scheduleFuture(this, this._d, scheduleMethod),
        this.source.subscribe(new SkipWithTimeObserver(o, this))
      );
    };

    return SkipWithTimeObservable;
  }(ObservableBase));

  var SkipWithTimeObserver = (function (__super__) {
    inherits(SkipWithTimeObserver, __super__);

    function SkipWithTimeObserver(o, p) {
      this._o = o;
      this._p = p;
      __super__.call(this);
    }

    SkipWithTimeObserver.prototype.next = function (x) { this._p._open && this._o.onNext(x); };
    SkipWithTimeObserver.prototype.error = function (e) { this._o.onError(e); };
    SkipWithTimeObserver.prototype.completed = function () { this._o.onCompleted(); };

    return SkipWithTimeObserver;
  }(AbstractObserver));

  /**
   *  Skips elements for the specified duration from the start of the observable source sequence, using the specified scheduler to run timers.
   * @description
   *  Specifying a zero value for duration doesn't guarantee no elements will be dropped from the start of the source sequence.
   *  This is a side-effect of the asynchrony introduced by the scheduler, where the action that causes callbacks from the source sequence to be forwarded
   *  may not execute immediately, despite the zero due time.
   *
   *  Errors produced by the source sequence are always forwarded to the result sequence, even if the error occurs before the duration.
   * @param {Number} duration Duration for skipping elements from the start of the sequence.
   * @param {Scheduler} scheduler Scheduler to run the timer on. If not specified, defaults to Rx.Scheduler.timeout.
   * @returns {Observable} An observable sequence with the elements skipped during the specified duration from the start of the source sequence.
   */
  observableProto.skipWithTime = function (duration, scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return new SkipWithTimeObservable(this, duration, scheduler);
  };

  var SkipUntilWithTimeObservable = (function (__super__) {
    inherits(SkipUntilWithTimeObservable, __super__);
    function SkipUntilWithTimeObservable(source, startTime, scheduler) {
      this.source = source;
      this._st = startTime;
      this._s = scheduler;
      __super__.call(this);
    }

    function scheduleMethod(s, state) {
      state._open = true;
    }

    SkipUntilWithTimeObservable.prototype.subscribeCore = function (o) {
      this._open = false;
      return new BinaryDisposable(
        this._s.scheduleFuture(this, this._st, scheduleMethod),
        this.source.subscribe(new SkipUntilWithTimeObserver(o, this))
      );
    };

    return SkipUntilWithTimeObservable;
  }(ObservableBase));

  var SkipUntilWithTimeObserver = (function (__super__) {
    inherits(SkipUntilWithTimeObserver, __super__);

    function SkipUntilWithTimeObserver(o, p) {
      this._o = o;
      this._p = p;
      __super__.call(this);
    }

    SkipUntilWithTimeObserver.prototype.next = function (x) { this._p._open && this._o.onNext(x); };
    SkipUntilWithTimeObserver.prototype.error = function (e) { this._o.onError(e); };
    SkipUntilWithTimeObserver.prototype.completed = function () { this._o.onCompleted(); };

    return SkipUntilWithTimeObserver;
  }(AbstractObserver));


  /**
   *  Skips elements from the observable source sequence until the specified start time, using the specified scheduler to run timers.
   *  Errors produced by the source sequence are always forwarded to the result sequence, even if the error occurs before the start time.
   *
   * @examples
   *  1 - res = source.skipUntilWithTime(new Date(), [scheduler]);
   *  2 - res = source.skipUntilWithTime(5000, [scheduler]);
   * @param {Date|Number} startTime Time to start taking elements from the source sequence. If this value is less than or equal to Date(), no elements will be skipped.
   * @param {Scheduler} [scheduler] Scheduler to run the timer on. If not specified, defaults to Rx.Scheduler.timeout.
   * @returns {Observable} An observable sequence with the elements skipped until the specified start time.
   */
  observableProto.skipUntilWithTime = function (startTime, scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return new SkipUntilWithTimeObservable(this, startTime, scheduler);
  };

  /**
   *  Takes elements for the specified duration until the specified end time, using the specified scheduler to run timers.
   * @param {Number | Date} endTime Time to stop taking elements from the source sequence. If this value is less than or equal to new Date(), the result stream will complete immediately.
   * @param {Scheduler} [scheduler] Scheduler to run the timer on.
   * @returns {Observable} An observable sequence with the elements taken until the specified end time.
   */
  observableProto.takeUntilWithTime = function (endTime, scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    var source = this;
    return new AnonymousObservable(function (o) {
      return new BinaryDisposable(
        scheduler.scheduleFuture(o, endTime, function (_, o) { o.onCompleted(); }),
        source.subscribe(o));
    }, source);
  };

  /**
   * Returns an Observable that emits only the first item emitted by the source Observable during sequential time windows of a specified duration.
   * @param {Number} windowDuration time to wait before emitting another item after emitting the last item
   * @param {Scheduler} [scheduler] the Scheduler to use internally to manage the timers that handle timeout for each item. If not provided, defaults to Scheduler.timeout.
   * @returns {Observable} An Observable that performs the throttle operation.
   */
  observableProto.throttle = function (windowDuration, scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    var duration = +windowDuration || 0;
    if (duration <= 0) { throw new RangeError('windowDuration cannot be less or equal zero.'); }
    var source = this;
    return new AnonymousObservable(function (o) {
      var lastOnNext = 0;
      return source.subscribe(
        function (x) {
          var now = scheduler.now();
          if (lastOnNext === 0 || now - lastOnNext >= duration) {
            lastOnNext = now;
            o.onNext(x);
          }
        },function (e) { o.onError(e); }, function () { o.onCompleted(); }
      );
    }, source);
  };

  return Rx;
}));
});

var rx_testing = __commonjs(function (module, exports, global) {
// Copyright (c) Microsoft, All rights reserved. See License.txt in the project root for license information.

;(function (factory) {
  var objectTypes = {
    'function': true,
    'object': true
  };

  function checkGlobal(value) {
    return (value && value.Object === Object) ? value : null;
  }

  var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType) ? exports : null;
  var freeModule = (objectTypes[typeof module] && module && !module.nodeType) ? module : null;
  var freeGlobal = checkGlobal(freeExports && freeModule && typeof global === 'object' && global);
  var freeSelf = checkGlobal(objectTypes[typeof self] && self);
  var freeWindow = checkGlobal(objectTypes[typeof window] && window);
  var moduleExports = (freeModule && freeModule.exports === freeExports) ? freeExports : null;
  var thisGlobal = checkGlobal(objectTypes[typeof this] && this);
  var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) || freeSelf || thisGlobal || Function('return this')();

  // Because of build optimizers
  if (typeof define === 'function' && define.amd) {
    define(['./rx.virtualtime', 'exports'], function (Rx, exports) {
      root.Rx = factory(root, exports, Rx);
      return root.Rx;
    });
  } else if (typeof module === 'object' && module && module.exports === freeExports) {
    module.exports = factory(root, module.exports, require$$0);
  } else {
    root.Rx = factory(root, {}, root.Rx);
  }
}.call(__commonjs_global, function (root, exp, Rx, undefined) {

  // Defaults
  var Observer = Rx.Observer,
    Observable = Rx.Observable,
    Notification = Rx.Notification,
    VirtualTimeScheduler = Rx.VirtualTimeScheduler,
    Disposable = Rx.Disposable,
    disposableEmpty = Disposable.empty,
    disposableCreate = Disposable.create,
    CompositeDisposable = Rx.CompositeDisposable,
    inherits = Rx.internals.inherits,
    defaultComparer = Rx.internals.isEqual;

function OnNextPredicate(predicate) {
    this.predicate = predicate;
}

OnNextPredicate.prototype.equals = function (other) {
  if (other === this) { return true; }
  if (other == null) { return false; }
  if (other.kind !== 'N') { return false; }
  return this.predicate(other.value);
};

function OnErrorPredicate(predicate) {
  this.predicate = predicate;
}

OnErrorPredicate.prototype.equals = function (other) {
  if (other === this) { return true; }
  if (other == null) { return false; }
  if (other.kind !== 'E') { return false; }
  return this.predicate(other.error);
};

var ReactiveTest = Rx.ReactiveTest = {
  /** Default virtual time used for creation of observable sequences in unit tests. */
  created: 100,
  /** Default virtual time used to subscribe to observable sequences in unit tests. */
  subscribed: 200,
  /** Default virtual time used to dispose subscriptions in unit tests. */
  disposed: 1000,

  /**
   * Factory method for an OnNext notification record at a given time with a given value or a predicate function.
   *
   * 1 - ReactiveTest.onNext(200, 42);
   * 2 - ReactiveTest.onNext(200, function (x) { return x.length == 2; });
   *
   * @param ticks Recorded virtual time the OnNext notification occurs.
   * @param value Recorded value stored in the OnNext notification or a predicate.
   * @return Recorded OnNext notification.
   */
  onNext: function (ticks, value) {
    return typeof value === 'function' ?
      new Recorded(ticks, new OnNextPredicate(value)) :
      new Recorded(ticks, Notification.createOnNext(value));
  },
  /**
   * Factory method for an OnError notification record at a given time with a given error.
   *
   * 1 - ReactiveTest.onNext(200, new Error('error'));
   * 2 - ReactiveTest.onNext(200, function (e) { return e.message === 'error'; });
   *
   * @param ticks Recorded virtual time the OnError notification occurs.
   * @param exception Recorded exception stored in the OnError notification.
   * @return Recorded OnError notification.
   */
  onError: function (ticks, error) {
    return typeof error === 'function' ?
      new Recorded(ticks, new OnErrorPredicate(error)) :
      new Recorded(ticks, Notification.createOnError(error));
  },
  /**
   * Factory method for an OnCompleted notification record at a given time.
   *
   * @param ticks Recorded virtual time the OnCompleted notification occurs.
   * @return Recorded OnCompleted notification.
   */
  onCompleted: function (ticks) {
    return new Recorded(ticks, Notification.createOnCompleted());
  },
  /**
   * Factory method for a subscription record based on a given subscription and disposal time.
   *
   * @param start Virtual time indicating when the subscription was created.
   * @param end Virtual time indicating when the subscription was disposed.
   * @return Subscription object.
   */
  subscribe: function (start, end) {
    return new Subscription(start, end);
  }
};

  /**
   * Creates a new object recording the production of the specified value at the given virtual time.
   *
   * @constructor
   * @param {Number} time Virtual time the value was produced on.
   * @param {Mixed} value Value that was produced.
   * @param {Function} comparer An optional comparer.
   */
  var Recorded = Rx.Recorded = function (time, value, comparer) {
    this.time = time;
    this.value = value;
    this.comparer = comparer || defaultComparer;
  };

  /**
   * Checks whether the given recorded object is equal to the current instance.
   *
   * @param {Recorded} other Recorded object to check for equality.
   * @returns {Boolean} true if both objects are equal; false otherwise.
   */
  Recorded.prototype.equals = function (other) {
    return this.time === other.time && this.comparer(this.value, other.value);
  };

  /**
   * Returns a string representation of the current Recorded value.
   *
   * @returns {String} String representation of the current Recorded value.
   */
  Recorded.prototype.toString = function () {
    return this.value.toString() + '@' + this.time;
  };

  /**
   * Creates a new subscription object with the given virtual subscription and unsubscription time.
   *
   * @constructor
   * @param {Number} subscribe Virtual time at which the subscription occurred.
   * @param {Number} unsubscribe Virtual time at which the unsubscription occurred.
   */
  var Subscription = Rx.Subscription = function (start, end) {
    this.subscribe = start;
    this.unsubscribe = end || Number.MAX_VALUE;
  };

  /**
   * Checks whether the given subscription is equal to the current instance.
   * @param other Subscription object to check for equality.
   * @returns {Boolean} true if both objects are equal; false otherwise.
   */
  Subscription.prototype.equals = function (other) {
    return this.subscribe === other.subscribe && this.unsubscribe === other.unsubscribe;
  };

  /**
   * Returns a string representation of the current Subscription value.
   * @returns {String} String representation of the current Subscription value.
   */
  Subscription.prototype.toString = function () {
    return '(' + this.subscribe + ', ' + (this.unsubscribe === Number.MAX_VALUE ? 'Infinite' : this.unsubscribe) + ')';
  };

  var MockDisposable = Rx.MockDisposable = function (scheduler) {
    this.scheduler = scheduler;
    this.disposes = [];
    this.disposes.push(this.scheduler.clock);
  };

  MockDisposable.prototype.dispose = function () {
    this.disposes.push(this.scheduler.clock);
  };

  var MockObserver = (function (__super__) {
    inherits(MockObserver, __super__);

    function MockObserver(scheduler) {
      __super__.call(this);
      this.scheduler = scheduler;
      this.messages = [];
    }

    var MockObserverPrototype = MockObserver.prototype;

    MockObserverPrototype.onNext = function (value) {
      this.messages.push(new Recorded(this.scheduler.clock, Notification.createOnNext(value)));
    };

    MockObserverPrototype.onError = function (e) {
      this.messages.push(new Recorded(this.scheduler.clock, Notification.createOnError(e)));
    };

    MockObserverPrototype.onCompleted = function () {
      this.messages.push(new Recorded(this.scheduler.clock, Notification.createOnCompleted()));
    };

    return MockObserver;
  })(Observer);

  function MockPromise(scheduler, messages) {
    var self = this;
    this.scheduler = scheduler;
    this.messages = messages;
    this.subscriptions = [];
    this.observers = [];
    for (var i = 0, len = this.messages.length; i < len; i++) {
      var message = this.messages[i],
          notification = message.value;
      (function (innerNotification) {
        scheduler.scheduleAbsolute(null, message.time, function () {
          var obs = self.observers.slice(0);

          for (var j = 0, jLen = obs.length; j < jLen; j++) {
            innerNotification.accept(obs[j]);
          }
          return disposableEmpty;
        });
      })(notification);
    }
  }

  MockPromise.prototype.then = function (onResolved, onRejected) {
    var self = this;

    this.subscriptions.push(new Subscription(this.scheduler.clock));
    var index = this.subscriptions.length - 1;

    var newPromise;

    var observer = Rx.Observer.create(
      function (x) {
        var retValue = onResolved(x);
        if (retValue && typeof retValue.then === 'function') {
          newPromise = retValue;
        } else {
          var ticks = self.scheduler.clock;
          newPromise = new MockPromise(self.scheduler, [Rx.ReactiveTest.onNext(ticks, undefined), Rx.ReactiveTest.onCompleted(ticks)]);
        }
        var idx = self.observers.indexOf(observer);
        self.observers.splice(idx, 1);
        self.subscriptions[index] = new Subscription(self.subscriptions[index].subscribe, self.scheduler.clock);
      },
      function (err) {
        onRejected(err);
        var idx = self.observers.indexOf(observer);
        self.observers.splice(idx, 1);
        self.subscriptions[index] = new Subscription(self.subscriptions[index].subscribe, self.scheduler.clock);
      }
    );
    this.observers.push(observer);

    return newPromise || new MockPromise(this.scheduler, this.messages);
  };

  var HotObservable = (function (__super__) {
    inherits(HotObservable, __super__);

    function HotObservable(scheduler, messages) {
      __super__.call(this);
      var message, notification, observable = this;
      this.scheduler = scheduler;
      this.messages = messages;
      this.subscriptions = [];
      this.observers = [];
      for (var i = 0, len = this.messages.length; i < len; i++) {
        message = this.messages[i];
        notification = message.value;
        (function (innerNotification) {
          scheduler.scheduleAbsolute(null, message.time, function () {
            var obs = observable.observers.slice(0);

            for (var j = 0, jLen = obs.length; j < jLen; j++) {
              innerNotification.accept(obs[j]);
            }
            return disposableEmpty;
          });
        })(notification);
      }
    }

    HotObservable.prototype._subscribe = function (o) {
      var observable = this;
      this.observers.push(o);
      this.subscriptions.push(new Subscription(this.scheduler.clock));
      var index = this.subscriptions.length - 1;
      return disposableCreate(function () {
        var idx = observable.observers.indexOf(o);
        observable.observers.splice(idx, 1);
        observable.subscriptions[index] = new Subscription(observable.subscriptions[index].subscribe, observable.scheduler.clock);
      });
    };

    return HotObservable;
  })(Observable);

  var ColdObservable = (function (__super__) {
    inherits(ColdObservable, __super__);

    function ColdObservable(scheduler, messages) {
      __super__.call(this);
      this.scheduler = scheduler;
      this.messages = messages;
      this.subscriptions = [];
    }

    ColdObservable.prototype._subscribe = function (o) {
      var message, notification, observable = this;
      this.subscriptions.push(new Subscription(this.scheduler.clock));
      var index = this.subscriptions.length - 1;
      var d = new CompositeDisposable();
      for (var i = 0, len = this.messages.length; i < len; i++) {
        message = this.messages[i];
        notification = message.value;
        (function (innerNotification) {
          d.add(observable.scheduler.scheduleRelative(null, message.time, function () {
            innerNotification.accept(o);
            return disposableEmpty;
          }));
        })(notification);
      }
      return disposableCreate(function () {
        observable.subscriptions[index] = new Subscription(observable.subscriptions[index].subscribe, observable.scheduler.clock);
        d.dispose();
      });
    };

    return ColdObservable;
  })(Observable);

  /** Virtual time scheduler used for testing applications and libraries built using Reactive Extensions. */
  Rx.TestScheduler = (function (__super__) {
    inherits(TestScheduler, __super__);

    function baseComparer(x, y) {
      return x > y ? 1 : (x < y ? -1 : 0);
    }

    function TestScheduler() {
      __super__.call(this, 0, baseComparer);
    }

    /**
     * Schedules an action to be executed at the specified virtual time.
     *
     * @param state State passed to the action to be executed.
     * @param dueTime Absolute virtual time at which to execute the action.
     * @param action Action to be executed.
     * @return Disposable object used to cancel the scheduled action (best effort).
     */
    TestScheduler.prototype.scheduleAbsolute = function (state, dueTime, action) {
      dueTime <= this.clock && (dueTime = this.clock + 1);
      return __super__.prototype.scheduleAbsolute.call(this, state, dueTime, action);
    };
    /**
     * Adds a relative virtual time to an absolute virtual time value.
     *
     * @param absolute Absolute virtual time value.
     * @param relative Relative virtual time value to add.
     * @return Resulting absolute virtual time sum value.
     */
    TestScheduler.prototype.add = function (absolute, relative) {
      return absolute + relative;
    };
    /**
     * Converts the absolute virtual time value to a DateTimeOffset value.
     *
     * @param absolute Absolute virtual time value to convert.
     * @return Corresponding DateTimeOffset value.
     */
    TestScheduler.prototype.toAbsoluteTime = function (absolute) {
      return new Date(absolute).getTime();
    };
    /**
     * Converts the TimeSpan value to a relative virtual time value.
     *
     * @param timeSpan TimeSpan value to convert.
     * @return Corresponding relative virtual time value.
     */
    TestScheduler.prototype.toRelativeTime = function (timeSpan) {
      return timeSpan;
    };
    /**
     * Starts the test scheduler and uses the specified virtual times to invoke the factory function, subscribe to the resulting sequence, and dispose the subscription.
     *
     * @param create Factory method to create an observable sequence.
     * @param created Virtual time at which to invoke the factory to create an observable sequence.
     * @param subscribed Virtual time at which to subscribe to the created observable sequence.
     * @param disposed Virtual time at which to dispose the subscription.
     * @return Observer with timestamped recordings of notification messages that were received during the virtual time window when the subscription to the source sequence was active.
     */
    TestScheduler.prototype.startScheduler = function (createFn, settings) {
      settings || (settings = {});
      settings.created == null && (settings.created = ReactiveTest.created);
      settings.subscribed == null && (settings.subscribed = ReactiveTest.subscribed);
      settings.disposed == null && (settings.disposed = ReactiveTest.disposed);

      var observer = this.createObserver(), source, subscription;

      this.scheduleAbsolute(null, settings.created, function () {
        source = createFn();
        return disposableEmpty;
      });

      this.scheduleAbsolute(null, settings.subscribed, function () {
        subscription = source.subscribe(observer);
        return disposableEmpty;
      });

      this.scheduleAbsolute(null, settings.disposed, function () {
        subscription.dispose();
        return disposableEmpty;
      });

      this.start();

      return observer;
    };

    /**
     * Creates a hot observable using the specified timestamped notification messages either as an array or arguments.
     * @param messages Notifications to surface through the created sequence at their specified absolute virtual times.
     * @return Hot observable sequence that can be used to assert the timing of subscriptions and notifications.
     */
    TestScheduler.prototype.createHotObservable = function () {
      var len = arguments.length, args;
      if (Array.isArray(arguments[0])) {
        args = arguments[0];
      } else {
        args = new Array(len);
        for (var i = 0; i < len; i++) { args[i] = arguments[i]; }
      }
      return new HotObservable(this, args);
    };

    /**
     * Creates a cold observable using the specified timestamped notification messages either as an array or arguments.
     * @param messages Notifications to surface through the created sequence at their specified virtual time offsets from the sequence subscription time.
     * @return Cold observable sequence that can be used to assert the timing of subscriptions and notifications.
     */
    TestScheduler.prototype.createColdObservable = function () {
      var len = arguments.length, args;
      if (Array.isArray(arguments[0])) {
        args = arguments[0];
      } else {
        args = new Array(len);
        for (var i = 0; i < len; i++) { args[i] = arguments[i]; }
      }
      return new ColdObservable(this, args);
    };

    /**
     * Creates a resolved promise with the given value and ticks
     * @param {Number} ticks The absolute time of the resolution.
     * @param {Any} value The value to yield at the given tick.
     * @returns {MockPromise} A mock Promise which fulfills with the given value.
     */
    TestScheduler.prototype.createResolvedPromise = function (ticks, value) {
      return new MockPromise(this, [Rx.ReactiveTest.onNext(ticks, value), Rx.ReactiveTest.onCompleted(ticks)]);
    };

    /**
     * Creates a rejected promise with the given reason and ticks
     * @param {Number} ticks The absolute time of the resolution.
     * @param {Any} reason The reason for rejection to yield at the given tick.
     * @returns {MockPromise} A mock Promise which rejects with the given reason.
     */
    TestScheduler.prototype.createRejectedPromise = function (ticks, reason) {
      return new MockPromise(this, [Rx.ReactiveTest.onError(ticks, reason)]);
    };

    /**
     * Creates an observer that records received notification messages and timestamps those.
     * @return Observer that can be used to assert the timing of received notifications.
     */
    TestScheduler.prototype.createObserver = function () {
      return new MockObserver(this);
    };

    return TestScheduler;
  })(VirtualTimeScheduler);

  return Rx;
}));
});

var rx_virtualtime = __commonjs(function (module, exports, global) {
// Copyright (c) Microsoft, All rights reserved. See License.txt in the project root for license information.

;(function (factory) {
  var objectTypes = {
    'function': true,
    'object': true
  };

  function checkGlobal(value) {
    return (value && value.Object === Object) ? value : null;
  }

  var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType) ? exports : null;
  var freeModule = (objectTypes[typeof module] && module && !module.nodeType) ? module : null;
  var freeGlobal = checkGlobal(freeExports && freeModule && typeof global === 'object' && global);
  var freeSelf = checkGlobal(objectTypes[typeof self] && self);
  var freeWindow = checkGlobal(objectTypes[typeof window] && window);
  var moduleExports = (freeModule && freeModule.exports === freeExports) ? freeExports : null;
  var thisGlobal = checkGlobal(objectTypes[typeof this] && this);
  var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) || freeSelf || thisGlobal || Function('return this')();

  // Because of build optimizers
  if (typeof define === 'function' && define.amd) {
    define(['./rx'], function (Rx, exports) {
      return factory(root, exports, Rx);
    });
  } else if (typeof module === 'object' && module && module.exports === freeExports) {
    module.exports = factory(root, module.exports, require$$0);
  } else {
    root.Rx = factory(root, {}, root.Rx);
  }
}.call(__commonjs_global, function (root, exp, Rx, undefined) {

  // Aliases
  var Scheduler = Rx.Scheduler,
    ScheduledItem = Rx.internals.ScheduledItem,
    SchedulePeriodicRecursive  = Rx.internals.SchedulePeriodicRecursive,
    PriorityQueue = Rx.internals.PriorityQueue,
    inherits = Rx.internals.inherits,
    defaultSubComparer = Rx.helpers.defaultSubComparer,
    notImplemented = Rx.helpers.notImplemented;

  /** Provides a set of extension methods for virtual time scheduling. */
  var VirtualTimeScheduler = Rx.VirtualTimeScheduler = (function (__super__) {
    inherits(VirtualTimeScheduler, __super__);

    /**
     * Creates a new virtual time scheduler with the specified initial clock value and absolute time comparer.
     *
     * @constructor
     * @param {Number} initialClock Initial value for the clock.
     * @param {Function} comparer Comparer to determine causality of events based on absolute time.
     */
    function VirtualTimeScheduler(initialClock, comparer) {
      this.clock = initialClock;
      this.comparer = comparer;
      this.isEnabled = false;
      this.queue = new PriorityQueue(1024);
      __super__.call(this);
    }

    var VirtualTimeSchedulerPrototype = VirtualTimeScheduler.prototype;

    VirtualTimeSchedulerPrototype.now = function () {
      return this.toAbsoluteTime(this.clock);
    };

    VirtualTimeSchedulerPrototype.schedule = function (state, action) {
      return this.scheduleAbsolute(state, this.clock, action);
    };

    VirtualTimeSchedulerPrototype.scheduleFuture = function (state, dueTime, action) {
      var dt = dueTime instanceof Date ?
        this.toRelativeTime(dueTime - this.now()) :
        this.toRelativeTime(dueTime);

      return this.scheduleRelative(state, dt, action);
    };

    /**
     * Adds a relative time value to an absolute time value.
     * @param {Number} absolute Absolute virtual time value.
     * @param {Number} relative Relative virtual time value to add.
     * @return {Number} Resulting absolute virtual time sum value.
     */
    VirtualTimeSchedulerPrototype.add = notImplemented;

    /**
     * Converts an absolute time to a number
     * @param {Any} The absolute time.
     * @returns {Number} The absolute time in ms
     */
    VirtualTimeSchedulerPrototype.toAbsoluteTime = notImplemented;

    /**
     * Converts the TimeSpan value to a relative virtual time value.
     * @param {Number} timeSpan TimeSpan value to convert.
     * @return {Number} Corresponding relative virtual time value.
     */
    VirtualTimeSchedulerPrototype.toRelativeTime = notImplemented;

    /**
     * Schedules a periodic piece of work by dynamically discovering the scheduler's capabilities. The periodic task will be emulated using recursive scheduling.
     * @param {Mixed} state Initial state passed to the action upon the first iteration.
     * @param {Number} period Period for running the work periodically.
     * @param {Function} action Action to be executed, potentially updating the state.
     * @returns {Disposable} The disposable object used to cancel the scheduled recurring action (best effort).
     */
    VirtualTimeSchedulerPrototype.schedulePeriodic = function (state, period, action) {
      var s = new SchedulePeriodicRecursive(this, state, period, action);
      return s.start();
    };

    /**
     * Schedules an action to be executed after dueTime.
     * @param {Mixed} state State passed to the action to be executed.
     * @param {Number} dueTime Relative time after which to execute the action.
     * @param {Function} action Action to be executed.
     * @returns {Disposable} The disposable object used to cancel the scheduled action (best effort).
     */
    VirtualTimeSchedulerPrototype.scheduleRelative = function (state, dueTime, action) {
      var runAt = this.add(this.clock, dueTime);
      return this.scheduleAbsolute(state, runAt, action);
    };

    /**
     * Starts the virtual time scheduler.
     */
    VirtualTimeSchedulerPrototype.start = function () {
      if (!this.isEnabled) {
        this.isEnabled = true;
        do {
          var next = this.getNext();
          if (next !== null) {
            this.comparer(next.dueTime, this.clock) > 0 && (this.clock = next.dueTime);
            next.invoke();
          } else {
            this.isEnabled = false;
          }
        } while (this.isEnabled);
      }
    };

    /**
     * Stops the virtual time scheduler.
     */
    VirtualTimeSchedulerPrototype.stop = function () {
      this.isEnabled = false;
    };

    /**
     * Advances the scheduler's clock to the specified time, running all work till that point.
     * @param {Number} time Absolute time to advance the scheduler's clock to.
     */
    VirtualTimeSchedulerPrototype.advanceTo = function (time) {
      var dueToClock = this.comparer(this.clock, time);
      if (this.comparer(this.clock, time) > 0) { throw new ArgumentOutOfRangeError(); }
      if (dueToClock === 0) { return; }
      if (!this.isEnabled) {
        this.isEnabled = true;
        do {
          var next = this.getNext();
          if (next !== null && this.comparer(next.dueTime, time) <= 0) {
            this.comparer(next.dueTime, this.clock) > 0 && (this.clock = next.dueTime);
            next.invoke();
          } else {
            this.isEnabled = false;
          }
        } while (this.isEnabled);
        this.clock = time;
      }
    };

    /**
     * Advances the scheduler's clock by the specified relative time, running all work scheduled for that timespan.
     * @param {Number} time Relative time to advance the scheduler's clock by.
     */
    VirtualTimeSchedulerPrototype.advanceBy = function (time) {
      var dt = this.add(this.clock, time),
          dueToClock = this.comparer(this.clock, dt);
      if (dueToClock > 0) { throw new ArgumentOutOfRangeError(); }
      if (dueToClock === 0) {  return; }

      this.advanceTo(dt);
    };

    /**
     * Advances the scheduler's clock by the specified relative time.
     * @param {Number} time Relative time to advance the scheduler's clock by.
     */
    VirtualTimeSchedulerPrototype.sleep = function (time) {
      var dt = this.add(this.clock, time);
      if (this.comparer(this.clock, dt) >= 0) { throw new ArgumentOutOfRangeError(); }

      this.clock = dt;
    };

    /**
     * Gets the next scheduled item to be executed.
     * @returns {ScheduledItem} The next scheduled item.
     */
    VirtualTimeSchedulerPrototype.getNext = function () {
      while (this.queue.length > 0) {
        var next = this.queue.peek();
        if (next.isCancelled()) {
          this.queue.dequeue();
        } else {
          return next;
        }
      }
      return null;
    };

    /**
     * Schedules an action to be executed at dueTime.
     * @param {Mixed} state State passed to the action to be executed.
     * @param {Number} dueTime Absolute time at which to execute the action.
     * @param {Function} action Action to be executed.
     * @returns {Disposable} The disposable object used to cancel the scheduled action (best effort).
     */
    VirtualTimeSchedulerPrototype.scheduleAbsolute = function (state, dueTime, action) {
      var self = this;

      function run(scheduler, state1) {
        self.queue.remove(si);
        return action(scheduler, state1);
      }

      var si = new ScheduledItem(this, state, run, dueTime, this.comparer);
      this.queue.enqueue(si);

      return si.disposable;
    };

    return VirtualTimeScheduler;
  }(Scheduler));

  /** Provides a virtual time scheduler that uses Date for absolute time and number for relative time. */
  Rx.HistoricalScheduler = (function (__super__) {
    inherits(HistoricalScheduler, __super__);

    /**
     * Creates a new historical scheduler with the specified initial clock value.
     * @constructor
     * @param {Number} initialClock Initial value for the clock.
     * @param {Function} comparer Comparer to determine causality of events based on absolute time.
     */
    function HistoricalScheduler(initialClock, comparer) {
      var clock = initialClock == null ? 0 : initialClock;
      var cmp = comparer || defaultSubComparer;
      __super__.call(this, clock, cmp);
    }

    var HistoricalSchedulerProto = HistoricalScheduler.prototype;

    /**
     * Adds a relative time value to an absolute time value.
     * @param {Number} absolute Absolute virtual time value.
     * @param {Number} relative Relative virtual time value to add.
     * @return {Number} Resulting absolute virtual time sum value.
     */
    HistoricalSchedulerProto.add = function (absolute, relative) {
      return absolute + relative;
    };

    HistoricalSchedulerProto.toAbsoluteTime = function (absolute) {
      return new Date(absolute).getTime();
    };

    /**
     * Converts the TimeSpan value to a relative virtual time value.
     * @memberOf HistoricalScheduler
     * @param {Number} timeSpan TimeSpan value to convert.
     * @return {Number} Corresponding relative virtual time value.
     */
    HistoricalSchedulerProto.toRelativeTime = function (timeSpan) {
      return timeSpan;
    };

    return HistoricalScheduler;
  }(Rx.VirtualTimeScheduler));

  return Rx;
}));
});

var rx_sorting = __commonjs(function (module, exports, global) {
// Copyright (c) Microsoft, All rights reserved. See License.txt in the project root for license information.

;(function (factory) {
  var objectTypes = {
    'function': true,
    'object': true
  };

  function checkGlobal(value) {
    return (value && value.Object === Object) ? value : null;
  }

  var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType) ? exports : null;
  var freeModule = (objectTypes[typeof module] && module && !module.nodeType) ? module : null;
  var freeGlobal = checkGlobal(freeExports && freeModule && typeof global === 'object' && global);
  var freeSelf = checkGlobal(objectTypes[typeof self] && self);
  var freeWindow = checkGlobal(objectTypes[typeof window] && window);
  var moduleExports = (freeModule && freeModule.exports === freeExports) ? freeExports : null;
  var thisGlobal = checkGlobal(objectTypes[typeof this] && this);
  var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) || freeSelf || thisGlobal || Function('return this')();

  // Because of build optimizers
  if (typeof define === 'function' && define.amd) {
    define(['./rx'], function (Rx, exports) {
      return factory(root, exports, Rx);
    });
  } else if (typeof module === 'object' && module && module.exports === freeExports) {
    module.exports = factory(root, module.exports, require$$0);
  } else {
    root.Rx = factory(root, {}, root.Rx);
  }
}.call(__commonjs_global, function (root, exp, Rx, undefined) {

  var Observable = Rx.Observable,
    observableProto = Observable.prototype,
    AnonymousObservable = Rx.AnonymousObservable,
    observableNever = Observable.never,
    isEqual = Rx.internals.isEqual,
    defaultSubComparer = Rx.helpers.defaultSubComparer;

  /**
   * jortSort checks if your inputs are sorted.  Note that this is only for a sequence with an end.
   * See http://jort.technology/ for full details.
   * @returns {Observable} An observable which has a single value of true if sorted, else false.
   */
  observableProto.jortSort = function () {
    return this.jortSortUntil(observableNever());
  };

  /**
   * jortSort checks if your inputs are sorted until another Observable sequence fires.
   * See http://jort.technology/ for full details.
   * @returns {Observable} An observable which has a single value of true if sorted, else false.
   */
  observableProto.jortSortUntil = function (other) {
    var source = this;
    return new AnonymousObservable(function (observer) {
      var arr = [];
      return source.takeUntil(other).subscribe(
        arr.push.bind(arr),
        observer.onError.bind(observer),
        function () {
          var sorted = arr.slice(0).sort(defaultSubComparer);
          observer.onNext(isEqual(arr, sorted));
          observer.onCompleted();
        });
    }, source);
  };

  return Rx;
}));
});

var rx_joinpatterns = __commonjs(function (module, exports, global) {
// Copyright (c) Microsoft, All rights reserved. See License.txt in the project root for license information.

;(function (factory) {
  var objectTypes = {
    'function': true,
    'object': true
  };

  function checkGlobal(value) {
    return (value && value.Object === Object) ? value : null;
  }

  var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType) ? exports : null;
  var freeModule = (objectTypes[typeof module] && module && !module.nodeType) ? module : null;
  var freeGlobal = checkGlobal(freeExports && freeModule && typeof global === 'object' && global);
  var freeSelf = checkGlobal(objectTypes[typeof self] && self);
  var freeWindow = checkGlobal(objectTypes[typeof window] && window);
  var moduleExports = (freeModule && freeModule.exports === freeExports) ? freeExports : null;
  var thisGlobal = checkGlobal(objectTypes[typeof this] && this);
  var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) || freeSelf || thisGlobal || Function('return this')();

  // Because of build optimizers
  if (typeof define === 'function' && define.amd) {
    define(['./rx'], function (Rx, exports) {
      return factory(root, exports, Rx);
    });
  } else if (typeof module === 'object' && module && module.exports === freeExports) {
    module.exports = factory(root, module.exports, require$$0);
  } else {
    root.Rx = factory(root, {}, root.Rx);
  }
}.call(__commonjs_global, function (root, exp, Rx, undefined) {

  // Aliases
  var Observable = Rx.Observable,
    observableProto = Observable.prototype,
    AnonymousObservable = Rx.AnonymousObservable,
    observableThrow = Observable.throwError,
    observerCreate = Rx.Observer.create,
    SingleAssignmentDisposable = Rx.SingleAssignmentDisposable,
    CompositeDisposable = Rx.CompositeDisposable,
    AbstractObserver = Rx.internals.AbstractObserver,
    noop = Rx.helpers.noop,
    inherits = Rx.internals.inherits,
    isFunction = Rx.helpers.isFunction;

  var errorObj = {e: {}};
  
  function tryCatcherGen(tryCatchTarget) {
    return function tryCatcher() {
      try {
        return tryCatchTarget.apply(this, arguments);
      } catch (e) {
        errorObj.e = e;
        return errorObj;
      }
    };
  }

  var tryCatch = Rx.internals.tryCatch = function tryCatch(fn) {
    if (!isFunction(fn)) { throw new TypeError('fn must be a function'); }
    return tryCatcherGen(fn);
  };

  function thrower(e) {
    throw e;
  }

  var Map = root.Map || (function () {
    function Map() {
      this.size = 0;
      this._values = [];
      this._keys = [];
    }

    Map.prototype['delete'] = function (key) {
      var i = this._keys.indexOf(key);
      if (i === -1) { return false; }
      this._values.splice(i, 1);
      this._keys.splice(i, 1);
      this.size--;
      return true;
    };

    Map.prototype.get = function (key) {
      var i = this._keys.indexOf(key);
      return i === -1 ? undefined : this._values[i];
    };

    Map.prototype.set = function (key, value) {
      var i = this._keys.indexOf(key);
      if (i === -1) {
        this._keys.push(key);
        this._values.push(value);
        this.size++;
      } else {
        this._values[i] = value;
      }
      return this;
    };

    Map.prototype.forEach = function (cb, thisArg) {
      for (var i = 0; i < this.size; i++) {
        cb.call(thisArg, this._values[i], this._keys[i]);
      }
    };

    return Map;
  }());

  /**
   * @constructor
   * Represents a join pattern over observable sequences.
   */
  function Pattern(patterns) {
    this.patterns = patterns;
  }

  /**
   *  Creates a pattern that matches the current plan matches and when the specified observable sequences has an available value.
   *  @param other Observable sequence to match in addition to the current pattern.
   *  @return {Pattern} Pattern object that matches when all observable sequences in the pattern have an available value.
   */
  Pattern.prototype.and = function (other) {
    return new Pattern(this.patterns.concat(other));
  };

  /**
   *  Matches when all observable sequences in the pattern (specified using a chain of and operators) have an available value and projects the values.
   *  @param {Function} selector Selector that will be invoked with available values from the source sequences, in the same order of the sequences in the pattern.
   *  @return {Plan} Plan that produces the projected values, to be fed (with other plans) to the when operator.
   */
  Pattern.prototype.thenDo = function (selector) {
    return new Plan(this, selector);
  };

  function Plan(expression, selector) {
    this.expression = expression;
    this.selector = selector;
  }

  function handleOnError(o) { return function (e) { o.onError(e); }; }
  function handleOnNext(self, observer) {
    return function onNext () {
      var result = tryCatch(self.selector).apply(self, arguments);
      if (result === errorObj) { return observer.onError(result.e); }
      observer.onNext(result);
    };
  }

  Plan.prototype.activate = function (externalSubscriptions, observer, deactivate) {
    var joinObservers = [], errHandler = handleOnError(observer);
    for (var i = 0, len = this.expression.patterns.length; i < len; i++) {
      joinObservers.push(planCreateObserver(externalSubscriptions, this.expression.patterns[i], errHandler));
    }
    var activePlan = new ActivePlan(joinObservers, handleOnNext(this, observer), function () {
      for (var j = 0, jlen = joinObservers.length; j < jlen; j++) {
        joinObservers[j].removeActivePlan(activePlan);
      }
      deactivate(activePlan);
    });
    for (i = 0, len = joinObservers.length; i < len; i++) {
      joinObservers[i].addActivePlan(activePlan);
    }
    return activePlan;
  };

  function planCreateObserver(externalSubscriptions, observable, onError) {
    var entry = externalSubscriptions.get(observable);
    if (!entry) {
      var observer = new JoinObserver(observable, onError);
      externalSubscriptions.set(observable, observer);
      return observer;
    }
    return entry;
  }

  function ActivePlan(joinObserverArray, onNext, onCompleted) {
    this.joinObserverArray = joinObserverArray;
    this.onNext = onNext;
    this.onCompleted = onCompleted;
    this.joinObservers = new Map();
    for (var i = 0, len = this.joinObserverArray.length; i < len; i++) {
      var joinObserver = this.joinObserverArray[i];
      this.joinObservers.set(joinObserver, joinObserver);
    }
  }

  ActivePlan.prototype.dequeue = function () {
    this.joinObservers.forEach(function (v) { v.queue.shift(); });
  };

  ActivePlan.prototype.match = function () {
    var i, len, hasValues = true;
    for (i = 0, len = this.joinObserverArray.length; i < len; i++) {
      if (this.joinObserverArray[i].queue.length === 0) {
        hasValues = false;
        break;
      }
    }
    if (hasValues) {
      var firstValues = [],
          isCompleted = false;
      for (i = 0, len = this.joinObserverArray.length; i < len; i++) {
        firstValues.push(this.joinObserverArray[i].queue[0]);
        this.joinObserverArray[i].queue[0].kind === 'C' && (isCompleted = true);
      }
      if (isCompleted) {
        this.onCompleted();
      } else {
        this.dequeue();
        var values = [];
        for (i = 0, len = firstValues.length; i < firstValues.length; i++) {
          values.push(firstValues[i].value);
        }
        this.onNext.apply(this, values);
      }
    }
  };

  var JoinObserver = (function (__super__) {
    inherits(JoinObserver, __super__);

    function JoinObserver(source, onError) {
      __super__.call(this);
      this.source = source;
      this.onError = onError;
      this.queue = [];
      this.activePlans = [];
      this.subscription = new SingleAssignmentDisposable();
      this.isDisposed = false;
    }

    var JoinObserverPrototype = JoinObserver.prototype;

    JoinObserverPrototype.next = function (notification) {
      if (!this.isDisposed) {
        if (notification.kind === 'E') {
          return this.onError(notification.error);
        }
        this.queue.push(notification);
        var activePlans = this.activePlans.slice(0);
        for (var i = 0, len = activePlans.length; i < len; i++) {
          activePlans[i].match();
        }
      }
    };

    JoinObserverPrototype.error = noop;
    JoinObserverPrototype.completed = noop;

    JoinObserverPrototype.addActivePlan = function (activePlan) {
      this.activePlans.push(activePlan);
    };

    JoinObserverPrototype.subscribe = function () {
      this.subscription.setDisposable(this.source.materialize().subscribe(this));
    };

    JoinObserverPrototype.removeActivePlan = function (activePlan) {
      this.activePlans.splice(this.activePlans.indexOf(activePlan), 1);
      this.activePlans.length === 0 && this.dispose();
    };

    JoinObserverPrototype.dispose = function () {
      __super__.prototype.dispose.call(this);
      if (!this.isDisposed) {
        this.isDisposed = true;
        this.subscription.dispose();
      }
    };

    return JoinObserver;
  } (AbstractObserver));

  /**
   *  Creates a pattern that matches when both observable sequences have an available value.
   *
   *  @param right Observable sequence to match with the current sequence.
   *  @return {Pattern} Pattern object that matches when both observable sequences have an available value.
   */
  observableProto.and = function (right) {
    return new Pattern([this, right]);
  };

  /**
   *  Matches when the observable sequence has an available value and projects the value.
   *
   *  @param {Function} selector Selector that will be invoked for values in the source sequence.
   *  @returns {Plan} Plan that produces the projected values, to be fed (with other plans) to the when operator.
   */
  observableProto.thenDo = function (selector) {
    return new Pattern([this]).thenDo(selector);
  };

  /**
   *  Joins together the results from several patterns.
   *
   *  @param plans A series of plans (specified as an Array of as a series of arguments) created by use of the Then operator on patterns.
   *  @returns {Observable} Observable sequence with the results form matching several patterns.
   */
  Observable.when = function () {
    var len = arguments.length, plans;
    if (Array.isArray(arguments[0])) {
      plans = arguments[0];
    } else {
      plans = new Array(len);
      for(var i = 0; i < len; i++) { plans[i] = arguments[i]; }
    }
    return new AnonymousObservable(function (o) {
      var activePlans = [],
          externalSubscriptions = new Map();
      var outObserver = observerCreate(
        function (x) { o.onNext(x); },
        function (err) {
          externalSubscriptions.forEach(function (v) { v.onError(err); });
          o.onError(err);
        },
        function (x) { o.onCompleted(); }
      );
      try {
        for (var i = 0, len = plans.length; i < len; i++) {
          activePlans.push(plans[i].activate(externalSubscriptions, outObserver, function (activePlan) {
            var idx = activePlans.indexOf(activePlan);
            activePlans.splice(idx, 1);
            activePlans.length === 0 && o.onCompleted();
          }));
        }
      } catch (e) {
        return observableThrow(e).subscribe(o);
      }
      var group = new CompositeDisposable();
      externalSubscriptions.forEach(function (joinObserver) {
        joinObserver.subscribe();
        group.add(joinObserver);
      });

      return group;
    });
  };

  return Rx;
}));
});

var rx_experimental = __commonjs(function (module, exports, global) {
// Copyright (c) Microsoft, All rights reserved. See License.txt in the project root for license information.

;(function (factory) {
  var objectTypes = {
    'function': true,
    'object': true
  };

  function checkGlobal(value) {
    return (value && value.Object === Object) ? value : null;
  }

  var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType) ? exports : null;
  var freeModule = (objectTypes[typeof module] && module && !module.nodeType) ? module : null;
  var freeGlobal = checkGlobal(freeExports && freeModule && typeof global === 'object' && global);
  var freeSelf = checkGlobal(objectTypes[typeof self] && self);
  var freeWindow = checkGlobal(objectTypes[typeof window] && window);
  var moduleExports = (freeModule && freeModule.exports === freeExports) ? freeExports : null;
  var thisGlobal = checkGlobal(objectTypes[typeof this] && this);
  var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) || freeSelf || thisGlobal || Function('return this')();

  // Because of build optimizers
  if (typeof define === 'function' && define.amd) {
    define(['./rx'], function (Rx, exports) {
      return factory(root, exports, Rx);
    });
  } else if (typeof module === 'object' && module && module.exports === freeExports) {
    module.exports = factory(root, module.exports, require$$0);
  } else {
    root.Rx = factory(root, {}, root.Rx);
  }
}.call(__commonjs_global, function (root, exp, Rx, undefined) {

  // Aliases
  var Observable = Rx.Observable,
    observableProto = Observable.prototype,
    ObservableBase = Rx.ObservableBase,
    AbstractObserver = Rx.internals.AbstractObserver,
    FlatMapObservable = Rx.FlatMapObservable,
    observableConcat = Observable.concat,
    observableDefer = Observable.defer,
    observableEmpty = Observable.empty,
    disposableEmpty = Rx.Disposable.empty,
    CompositeDisposable = Rx.CompositeDisposable,
    SerialDisposable = Rx.SerialDisposable,
    SingleAssignmentDisposable = Rx.SingleAssignmentDisposable,
    Enumerable = Rx.internals.Enumerable,
    enumerableOf = Enumerable.of,
    currentThreadScheduler = Rx.Scheduler.currentThread,
    AsyncSubject = Rx.AsyncSubject,
    Observer = Rx.Observer,
    inherits = Rx.internals.inherits,
    addProperties = Rx.internals.addProperties,
    helpers = Rx.helpers,
    noop = helpers.noop,
    isPromise = helpers.isPromise,
    isFunction = helpers.isFunction,
    isIterable = Rx.helpers.isIterable,
    isArrayLike = Rx.helpers.isArrayLike,
    isScheduler = Rx.Scheduler.isScheduler,
    observableFromPromise = Observable.fromPromise;

  var errorObj = {e: {}};
  
  function tryCatcherGen(tryCatchTarget) {
    return function tryCatcher() {
      try {
        return tryCatchTarget.apply(this, arguments);
      } catch (e) {
        errorObj.e = e;
        return errorObj;
      }
    };
  }

  var tryCatch = Rx.internals.tryCatch = function tryCatch(fn) {
    if (!isFunction(fn)) { throw new TypeError('fn must be a function'); }
    return tryCatcherGen(fn);
  };

  function thrower(e) {
    throw e;
  }

  // Shim in iterator support
  var $iterator$ = (typeof Symbol === 'function' && Symbol.iterator) ||
    '_es6shim_iterator_';
  // Bug for mozilla version
  if (root.Set && typeof new root.Set()['@@iterator'] === 'function') {
    $iterator$ = '@@iterator';
  }

  var doneEnumerator = Rx.doneEnumerator = { done: true, value: undefined };

  var isIterable = Rx.helpers.isIterable = function (o) {
    return o && o[$iterator$] !== undefined;
  };

  var isArrayLike = Rx.helpers.isArrayLike = function (o) {
    return o && o.length !== undefined;
  };

  Rx.helpers.iterator = $iterator$;

  var WhileEnumerable = (function(__super__) {
    inherits(WhileEnumerable, __super__);
    function WhileEnumerable(c, s) {
      this.c = c;
      this.s = s;
    }
    WhileEnumerable.prototype[$iterator$] = function () {
      var self = this;
      return {
        next: function () {
          return self.c() ?
           { done: false, value: self.s } :
           { done: true, value: void 0 };
        }
      };
    };
    return WhileEnumerable;
  }(Enumerable));
  
  function enumerableWhile(condition, source) {
    return new WhileEnumerable(condition, source);
  }  

   /**
   *  Returns an observable sequence that is the result of invoking the selector on the source sequence, without sharing subscriptions.
   *  This operator allows for a fluent style of writing queries that use the same sequence multiple times.
   *
   * @param {Function} selector Selector function which can use the source sequence as many times as needed, without sharing subscriptions to the source sequence.
   * @returns {Observable} An observable sequence that contains the elements of a sequence produced by multicasting the source sequence within a selector function.
   */
  observableProto.letBind = observableProto['let'] = function (func) {
    return func(this);
  };

   /**
   *  Determines whether an observable collection contains values. 
   *
   * @example
   *  1 - res = Rx.Observable.if(condition, obs1);
   *  2 - res = Rx.Observable.if(condition, obs1, obs2);
   *  3 - res = Rx.Observable.if(condition, obs1, scheduler);
   * @param {Function} condition The condition which determines if the thenSource or elseSource will be run.
   * @param {Observable} thenSource The observable sequence or Promise that will be run if the condition function returns true.
   * @param {Observable} [elseSource] The observable sequence or Promise that will be run if the condition function returns false. If this is not provided, it defaults to Rx.Observabe.Empty with the specified scheduler.
   * @returns {Observable} An observable sequence which is either the thenSource or elseSource.
   */
  Observable['if'] = function (condition, thenSource, elseSourceOrScheduler) {
    return observableDefer(function () {
      elseSourceOrScheduler || (elseSourceOrScheduler = observableEmpty());

      isPromise(thenSource) && (thenSource = observableFromPromise(thenSource));
      isPromise(elseSourceOrScheduler) && (elseSourceOrScheduler = observableFromPromise(elseSourceOrScheduler));

      // Assume a scheduler for empty only
      typeof elseSourceOrScheduler.now === 'function' && (elseSourceOrScheduler = observableEmpty(elseSourceOrScheduler));
      return condition() ? thenSource : elseSourceOrScheduler;
    });
  };

   /**
   *  Concatenates the observable sequences obtained by running the specified result selector for each element in source.
   * There is an alias for this method called 'forIn' for browsers <IE9
   * @param {Array} sources An array of values to turn into an observable sequence.
   * @param {Function} resultSelector A function to apply to each item in the sources array to turn it into an observable sequence.
   * @returns {Observable} An observable sequence from the concatenated observable sequences.
   */
  Observable['for'] = Observable.forIn = function (sources, resultSelector, thisArg) {
    return enumerableOf(sources, resultSelector, thisArg).concat();
  };

   /**
   *  Repeats source as long as condition holds emulating a while loop.
   * There is an alias for this method called 'whileDo' for browsers <IE9
   *
   * @param {Function} condition The condition which determines if the source will be repeated.
   * @param {Observable} source The observable sequence that will be run if the condition function returns true.
   * @returns {Observable} An observable sequence which is repeated as long as the condition holds.
   */
  var observableWhileDo = Observable['while'] = Observable.whileDo = function (condition, source) {
    isPromise(source) && (source = observableFromPromise(source));
    return enumerableWhile(condition, source).concat();
  };

   /**
   *  Repeats source as long as condition holds emulating a do while loop.
   *
   * @param {Function} condition The condition which determines if the source will be repeated.
   * @param {Observable} source The observable sequence that will be run if the condition function returns true.
   * @returns {Observable} An observable sequence which is repeated as long as the condition holds.
   */
  observableProto.doWhile = function (condition) {
    return observableConcat([this, observableWhileDo(condition, this)]);
  };

   /**
   *  Uses selector to determine which source in sources to use.
   * @param {Function} selector The function which extracts the value for to test in a case statement.
   * @param {Array} sources A object which has keys which correspond to the case statement labels.
   * @param {Observable} [elseSource] The observable sequence or Promise that will be run if the sources are not matched. If this is not provided, it defaults to Rx.Observabe.empty with the specified scheduler.
   *
   * @returns {Observable} An observable sequence which is determined by a case statement.
   */
  Observable['case'] = function (selector, sources, defaultSourceOrScheduler) {
    return observableDefer(function () {
      isPromise(defaultSourceOrScheduler) && (defaultSourceOrScheduler = observableFromPromise(defaultSourceOrScheduler));
      defaultSourceOrScheduler || (defaultSourceOrScheduler = observableEmpty());

      isScheduler(defaultSourceOrScheduler) && (defaultSourceOrScheduler = observableEmpty(defaultSourceOrScheduler));

      var result = sources[selector()];
      isPromise(result) && (result = observableFromPromise(result));

      return result || defaultSourceOrScheduler;
    });
  };

  var ExpandObservable = (function(__super__) {
    inherits(ExpandObservable, __super__);
    function ExpandObservable(source, fn, scheduler) {
      this.source = source;
      this._fn = fn;
      this._scheduler = scheduler;
      __super__.call(this);
    }

    function scheduleRecursive(args, recurse) {
      var state = args[0], self = args[1];
      var work;
      if (state.q.length > 0) {
        work = state.q.shift();
      } else {
        state.isAcquired = false;
        return;
      }
      var m1 = new SingleAssignmentDisposable();
      state.d.add(m1);
      m1.setDisposable(work.subscribe(new ExpandObserver(state, self, m1)));
      recurse([state, self]);
    }

    ExpandObservable.prototype._ensureActive = function (state) {
      var isOwner = false;
      if (state.q.length > 0) {
        isOwner = !state.isAcquired;
        state.isAcquired = true;
      }
      isOwner && state.m.setDisposable(this._scheduler.scheduleRecursive([state, this], scheduleRecursive));
    };

    ExpandObservable.prototype.subscribeCore = function (o) {
      var m = new SerialDisposable(),
        d = new CompositeDisposable(m),
        state = {
          q: [],
          m: m,
          d: d,
          activeCount: 0,
          isAcquired: false,
          o: o
        };

      state.q.push(this.source);
      state.activeCount++;
      this._ensureActive(state);
      return d;
    };

    return ExpandObservable;
  }(ObservableBase));

  var ExpandObserver = (function(__super__) {
    inherits(ExpandObserver, __super__);
    function ExpandObserver(state, parent, m1) {
      this._s = state;
      this._p = parent;
      this._m1 = m1;
      __super__.call(this);
    }

    ExpandObserver.prototype.next = function (x) {
      this._s.o.onNext(x);
      var result = tryCatch(this._p._fn)(x);
      if (result === errorObj) { return this._s.o.onError(result.e); }
      this._s.q.push(result);
      this._s.activeCount++;
      this._p._ensureActive(this._s);
    };

    ExpandObserver.prototype.error = function (e) {
      this._s.o.onError(e);
    };

    ExpandObserver.prototype.completed = function () {
      this._s.d.remove(this._m1);
      this._s.activeCount--;
      this._s.activeCount === 0 && this._s.o.onCompleted();
    };

    return ExpandObserver;
  }(AbstractObserver));

   /**
   *  Expands an observable sequence by recursively invoking selector.
   *
   * @param {Function} selector Selector function to invoke for each produced element, resulting in another sequence to which the selector will be invoked recursively again.
   * @param {Scheduler} [scheduler] Scheduler on which to perform the expansion. If not provided, this defaults to the current thread scheduler.
   * @returns {Observable} An observable sequence containing all the elements produced by the recursive expansion.
   */
  observableProto.expand = function (selector, scheduler) {
    isScheduler(scheduler) || (scheduler = currentThreadScheduler);
    return new ExpandObservable(this, selector, scheduler);
  };

  function argumentsToArray() {
    var len = arguments.length, args = new Array(len);
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    return args;
  }

  var ForkJoinObservable = (function (__super__) {
    inherits(ForkJoinObservable, __super__);
    function ForkJoinObservable(sources, cb) {
      this._sources = sources;
      this._cb = cb;
      __super__.call(this);
    }

    ForkJoinObservable.prototype.subscribeCore = function (o) {
      if (this._sources.length === 0) {
        o.onCompleted();
        return disposableEmpty;
      }

      var count = this._sources.length;
      var state = {
        finished: false,
        hasResults: new Array(count),
        hasCompleted: new Array(count),
        results: new Array(count)
      };

      var subscriptions = new CompositeDisposable();
      for (var i = 0, len = this._sources.length; i < len; i++) {
        var source = this._sources[i];
        isPromise(source) && (source = observableFromPromise(source));
        subscriptions.add(source.subscribe(new ForkJoinObserver(o, state, i, this._cb, subscriptions)));
      }

      return subscriptions;
    };

    return ForkJoinObservable;
  }(ObservableBase));

  var ForkJoinObserver = (function(__super__) {
    inherits(ForkJoinObserver, __super__);
    function ForkJoinObserver(o, s, i, cb, subs) {
      this._o = o;
      this._s = s;
      this._i = i;
      this._cb = cb;
      this._subs = subs;
      __super__.call(this);
    }

    ForkJoinObserver.prototype.next = function (x) {
      if (!this._s.finished) {
        this._s.hasResults[this._i] = true;
        this._s.results[this._i] = x;
      }
    };

    ForkJoinObserver.prototype.error = function (e) {
      this._s.finished = true;
      this._o.onError(e);
      this._subs.dispose();
    };

    ForkJoinObserver.prototype.completed = function () {
      if (!this._s.finished) {
        if (!this._s.hasResults[this._i]) {
          return this._o.onCompleted();
        }
        this._s.hasCompleted[this._i] = true;
        for (var i = 0; i < this._s.results.length; i++) {
          if (!this._s.hasCompleted[i]) { return; }
        }
        this._s.finished = true;

        var res = tryCatch(this._cb).apply(null, this._s.results);
        if (res === errorObj) { return this._o.onError(res.e); }

        this._o.onNext(res);
        this._o.onCompleted();
      }
    };

    return ForkJoinObserver;
  }(AbstractObserver));

   /**
   *  Runs all observable sequences in parallel and collect their last elements.
   *
   * @example
   *  1 - res = Rx.Observable.forkJoin([obs1, obs2]);
   *  1 - res = Rx.Observable.forkJoin(obs1, obs2, ...);
   * @returns {Observable} An observable sequence with an array collecting the last elements of all the input sequences.
   */
  Observable.forkJoin = function () {
    var len = arguments.length, args = new Array(len);
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    var resultSelector = isFunction(args[len - 1]) ? args.pop() : argumentsToArray;
    Array.isArray(args[0]) && (args = args[0]);
    return new ForkJoinObservable(args, resultSelector);
  };

   /**
   *  Runs two observable sequences in parallel and combines their last elemenets.
   * @param {Observable} second Second observable sequence.
   * @param {Function} resultSelector Result selector function to invoke with the last elements of both sequences.
   * @returns {Observable} An observable sequence with the result of calling the selector function with the last elements of both input sequences.
   */
  observableProto.forkJoin = function () {
    var len = arguments.length, args = new Array(len);
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    if (Array.isArray(args[0])) {
      args[0].unshift(this);
    } else {
      args.unshift(this);
    }
    return Observable.forkJoin.apply(null, args);
  };

  /**
   * Comonadic bind operator.
   * @param {Function} selector A transform function to apply to each element.
   * @param {Object} scheduler Scheduler used to execute the operation. If not specified, defaults to the ImmediateScheduler.
   * @returns {Observable} An observable sequence which results from the comonadic bind operation.
   */
  observableProto.manySelect = observableProto.extend = function (selector, scheduler) {
    isScheduler(scheduler) || (scheduler = Rx.Scheduler.immediate);
    var source = this;
    return observableDefer(function () {
      var chain;

      return source
        .map(function (x) {
          var curr = new ChainObservable(x);

          chain && chain.onNext(x);
          chain = curr;

          return curr;
        })
        .tap(
          noop,
          function (e) { chain && chain.onError(e); },
          function () { chain && chain.onCompleted(); }
        )
        .observeOn(scheduler)
        .map(selector);
    }, source);
  };

  var ChainObservable = (function (__super__) {
    inherits(ChainObservable, __super__);
    function ChainObservable(head) {
      __super__.call(this);
      this.head = head;
      this.tail = new AsyncSubject();
    }

    addProperties(ChainObservable.prototype, Observer, {
      _subscribe: function (o) {
        var g = new CompositeDisposable();
        g.add(currentThreadScheduler.schedule(this, function (_, self) {
          o.onNext(self.head);
          g.add(self.tail.mergeAll().subscribe(o));
        }));

        return g;
      },
      onCompleted: function () {
        this.onNext(Observable.empty());
      },
      onError: function (e) {
        this.onNext(Observable['throw'](e));
      },
      onNext: function (v) {
        this.tail.onNext(v);
        this.tail.onCompleted();
      }
    });

    return ChainObservable;

  }(Observable));

  var SwitchFirstObservable = (function (__super__) {
    inherits(SwitchFirstObservable, __super__);
    function SwitchFirstObservable(source) {
      this.source = source;
      __super__.call(this);
    }

    SwitchFirstObservable.prototype.subscribeCore = function (o) {
      var m = new SingleAssignmentDisposable(),
        g = new CompositeDisposable(),
        state = {
          hasCurrent: false,
          isStopped: false,
          o: o,
          g: g
        };

      g.add(m);
      m.setDisposable(this.source.subscribe(new SwitchFirstObserver(state)));
      return g;
    };

    return SwitchFirstObservable;
  }(ObservableBase));

  var SwitchFirstObserver = (function(__super__) {
    inherits(SwitchFirstObserver, __super__);
    function SwitchFirstObserver(state) {
      this._s = state;
      __super__.call(this);
    }

    SwitchFirstObserver.prototype.next = function (x) {
      if (!this._s.hasCurrent) {
        this._s.hasCurrent = true;
        isPromise(x) && (x = observableFromPromise(x));
        var inner = new SingleAssignmentDisposable();
        this._s.g.add(inner);
        inner.setDisposable(x.subscribe(new InnerObserver(this._s, inner)));
      }
    };

    SwitchFirstObserver.prototype.error = function (e) {
      this._s.o.onError(e);
    };

    SwitchFirstObserver.prototype.completed = function () {
      this._s.isStopped = true;
      !this._s.hasCurrent && this._s.g.length === 1 && this._s.o.onCompleted();
    };

    inherits(InnerObserver, __super__);
    function InnerObserver(state, inner) {
      this._s = state;
      this._i = inner;
      __super__.call(this);
    }

    InnerObserver.prototype.next = function (x) { this._s.o.onNext(x); };
    InnerObserver.prototype.error = function (e) { this._s.o.onError(e); };
    InnerObserver.prototype.completed = function () {
      this._s.g.remove(this._i);
      this._s.hasCurrent = false;
      this._s.isStopped && this._s.g.length === 1 && this._s.o.onCompleted();
    };

    return SwitchFirstObserver;
  }(AbstractObserver));

  /**
   * Performs a exclusive waiting for the first to finish before subscribing to another observable.
   * Observables that come in between subscriptions will be dropped on the floor.
   * @returns {Observable} A exclusive observable with only the results that happen when subscribed.
   */
  observableProto.switchFirst = function () {
    return new SwitchFirstObservable(this);
  };

observableProto.flatMapFirst = observableProto.exhaustMap = function(selector, resultSelector, thisArg) {
    return new FlatMapObservable(this, selector, resultSelector, thisArg).switchFirst();
};

observableProto.flatMapWithMaxConcurrent = observableProto.flatMapMaxConcurrent = function(limit, selector, resultSelector, thisArg) {
    return new FlatMapObservable(this, selector, resultSelector, thisArg).merge(limit);
};

  return Rx;
}));
});

var rx_coincidence = __commonjs(function (module, exports, global) {
// Copyright (c) Microsoft, All rights reserved. See License.txt in the project root for license information.

;(function (factory) {
  var objectTypes = {
    'function': true,
    'object': true
  };

  function checkGlobal(value) {
    return (value && value.Object === Object) ? value : null;
  }

  var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType) ? exports : null;
  var freeModule = (objectTypes[typeof module] && module && !module.nodeType) ? module : null;
  var freeGlobal = checkGlobal(freeExports && freeModule && typeof global === 'object' && global);
  var freeSelf = checkGlobal(objectTypes[typeof self] && self);
  var freeWindow = checkGlobal(objectTypes[typeof window] && window);
  var moduleExports = (freeModule && freeModule.exports === freeExports) ? freeExports : null;
  var thisGlobal = checkGlobal(objectTypes[typeof this] && this);
  var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) || freeSelf || thisGlobal || Function('return this')();

  // Because of build optimizers
  if (typeof define === 'function' && define.amd) {
    define(['./rx'], function (Rx, exports) {
      return factory(root, exports, Rx);
    });
  } else if (typeof module === 'object' && module && module.exports === freeExports) {
    module.exports = factory(root, module.exports, require$$0);
  } else {
    root.Rx = factory(root, {}, root.Rx);
  }
}.call(__commonjs_global, function (root, exp, Rx, undefined) {

  var Observable = Rx.Observable,
    ObservableBase = Rx.ObservableBase,
    AbstractObserver = Rx.internals.AbstractObserver,
    CompositeDisposable = Rx.CompositeDisposable,
    BinaryDisposable = Rx.BinaryDisposable,
    RefCountDisposable = Rx.RefCountDisposable,
    SingleAssignmentDisposable = Rx.SingleAssignmentDisposable,
    SerialDisposable = Rx.SerialDisposable,
    Subject = Rx.Subject,
    observableProto = Observable.prototype,
    observableEmpty = Observable.empty,
    observableNever = Observable.never,
    AnonymousObservable = Rx.AnonymousObservable,
    addRef = Rx.internals.addRef,
    inherits = Rx.internals.inherits,
    bindCallback = Rx.internals.bindCallback,
    noop = Rx.helpers.noop,
    isPromise = Rx.helpers.isPromise,
    isFunction = Rx.helpers.isFunction,
    observableFromPromise = Observable.fromPromise;

  var errorObj = {e: {}};
  
  function tryCatcherGen(tryCatchTarget) {
    return function tryCatcher() {
      try {
        return tryCatchTarget.apply(this, arguments);
      } catch (e) {
        errorObj.e = e;
        return errorObj;
      }
    };
  }

  var tryCatch = Rx.internals.tryCatch = function tryCatch(fn) {
    if (!isFunction(fn)) { throw new TypeError('fn must be a function'); }
    return tryCatcherGen(fn);
  };

  function thrower(e) {
    throw e;
  }

  var Map = root.Map || (function () {
    function Map() {
      this.size = 0;
      this._values = [];
      this._keys = [];
    }

    Map.prototype['delete'] = function (key) {
      var i = this._keys.indexOf(key);
      if (i === -1) { return false; }
      this._values.splice(i, 1);
      this._keys.splice(i, 1);
      this.size--;
      return true;
    };

    Map.prototype.get = function (key) {
      var i = this._keys.indexOf(key);
      return i === -1 ? undefined : this._values[i];
    };

    Map.prototype.set = function (key, value) {
      var i = this._keys.indexOf(key);
      if (i === -1) {
        this._keys.push(key);
        this._values.push(value);
        this.size++;
      } else {
        this._values[i] = value;
      }
      return this;
    };

    Map.prototype.forEach = function (cb, thisArg) {
      for (var i = 0; i < this.size; i++) {
        cb.call(thisArg, this._values[i], this._keys[i]);
      }
    };

    return Map;
  }());

  /**
   *  Correlates the elements of two sequences based on overlapping durations.
   *
   *  @param {Observable} right The right observable sequence to join elements for.
   *  @param {Function} leftDurationSelector A function to select the duration (expressed as an observable sequence) of each element of the left observable sequence, used to determine overlap.
   *  @param {Function} rightDurationSelector A function to select the duration (expressed as an observable sequence) of each element of the right observable sequence, used to determine overlap.
   *  @param {Function} resultSelector A function invoked to compute a result element for any two overlapping elements of the left and right observable sequences. The parameters passed to the function correspond with the elements from the left and right source sequences for which overlap occurs.
   *  @returns {Observable} An observable sequence that contains result elements computed from source elements that have an overlapping duration.
   */
  observableProto.join = function (right, leftDurationSelector, rightDurationSelector, resultSelector) {
    var left = this;
    return new AnonymousObservable(function (o) {
      var group = new CompositeDisposable();
      var leftDone = false, rightDone = false;
      var leftId = 0, rightId = 0;
      var leftMap = new Map(), rightMap = new Map();
      var handleError = function (e) { o.onError(e); };

      group.add(left.subscribe(
        function (value) {
          var id = leftId++, md = new SingleAssignmentDisposable();

          leftMap.set(id, value);
          group.add(md);

          var duration = tryCatch(leftDurationSelector)(value);
          if (duration === errorObj) { return o.onError(duration.e); }

          md.setDisposable(duration.take(1).subscribe(
            noop,
            handleError,
            function () {
              leftMap['delete'](id) && leftMap.size === 0 && leftDone && o.onCompleted();
              group.remove(md);
            }));

          rightMap.forEach(function (v) {
            var result = tryCatch(resultSelector)(value, v);
            if (result === errorObj) { return o.onError(result.e); }
            o.onNext(result);
          });
        },
        handleError,
        function () {
          leftDone = true;
          (rightDone || leftMap.size === 0) && o.onCompleted();
        })
      );

      group.add(right.subscribe(
        function (value) {
          var id = rightId++, md = new SingleAssignmentDisposable();

          rightMap.set(id, value);
          group.add(md);

          var duration = tryCatch(rightDurationSelector)(value);
          if (duration === errorObj) { return o.onError(duration.e); }

          md.setDisposable(duration.take(1).subscribe(
            noop,
            handleError,
            function () {
              rightMap['delete'](id) && rightMap.size === 0 && rightDone && o.onCompleted();
              group.remove(md);
            }));

          leftMap.forEach(function (v) {
            var result = tryCatch(resultSelector)(v, value);
            if (result === errorObj) { return o.onError(result.e); }
            o.onNext(result);
          });
        },
        handleError,
        function () {
          rightDone = true;
          (leftDone || rightMap.size === 0) && o.onCompleted();
        })
      );
      return group;
    }, left);
  };

  /**
   *  Correlates the elements of two sequences based on overlapping durations, and groups the results.
   *
   *  @param {Observable} right The right observable sequence to join elements for.
   *  @param {Function} leftDurationSelector A function to select the duration (expressed as an observable sequence) of each element of the left observable sequence, used to determine overlap.
   *  @param {Function} rightDurationSelector A function to select the duration (expressed as an observable sequence) of each element of the right observable sequence, used to determine overlap.
   *  @param {Function} resultSelector A function invoked to compute a result element for any element of the left sequence with overlapping elements from the right observable sequence. The first parameter passed to the function is an element of the left sequence. The second parameter passed to the function is an observable sequence with elements from the right sequence that overlap with the left sequence's element.
   *  @returns {Observable} An observable sequence that contains result elements computed from source elements that have an overlapping duration.
   */
  observableProto.groupJoin = function (right, leftDurationSelector, rightDurationSelector, resultSelector) {
    var left = this;
    return new AnonymousObservable(function (o) {
      var group = new CompositeDisposable();
      var r = new RefCountDisposable(group);
      var leftMap = new Map(), rightMap = new Map();
      var leftId = 0, rightId = 0;
      var handleError = function (e) { return function (v) { v.onError(e); }; };

      function handleError(e) { };

      group.add(left.subscribe(
        function (value) {
          var s = new Subject();
          var id = leftId++;
          leftMap.set(id, s);

          var result = tryCatch(resultSelector)(value, addRef(s, r));
          if (result === errorObj) {
            leftMap.forEach(handleError(result.e));
            return o.onError(result.e);
          }
          o.onNext(result);

          rightMap.forEach(function (v) { s.onNext(v); });

          var md = new SingleAssignmentDisposable();
          group.add(md);

          var duration = tryCatch(leftDurationSelector)(value);
          if (duration === errorObj) {
            leftMap.forEach(handleError(duration.e));
            return o.onError(duration.e);
          }

          md.setDisposable(duration.take(1).subscribe(
            noop,
            function (e) {
              leftMap.forEach(handleError(e));
              o.onError(e);
            },
            function () {
              leftMap['delete'](id) && s.onCompleted();
              group.remove(md);
            }));
        },
        function (e) {
          leftMap.forEach(handleError(e));
          o.onError(e);
        },
        function () { o.onCompleted(); })
      );

      group.add(right.subscribe(
        function (value) {
          var id = rightId++;
          rightMap.set(id, value);

          var md = new SingleAssignmentDisposable();
          group.add(md);

          var duration = tryCatch(rightDurationSelector)(value);
          if (duration === errorObj) {
            leftMap.forEach(handleError(duration.e));
            return o.onError(duration.e);
          }

          md.setDisposable(duration.take(1).subscribe(
            noop,
            function (e) {
              leftMap.forEach(handleError(e));
              o.onError(e);
            },
            function () {
              rightMap['delete'](id);
              group.remove(md);
            }));

          leftMap.forEach(function (v) { v.onNext(value); });
        },
        function (e) {
          leftMap.forEach(handleError(e));
          o.onError(e);
        })
      );

      return r;
    }, left);
  };

  function toArray(x) { return x.toArray(); }

  /**
   *  Projects each element of an observable sequence into zero or more buffers.
   *  @param {Mixed} bufferOpeningsOrClosingSelector Observable sequence whose elements denote the creation of new windows, or, a function invoked to define the boundaries of the produced windows (a new window is started when the previous one is closed, resulting in non-overlapping windows).
   *  @param {Function} [bufferClosingSelector] A function invoked to define the closing of each produced window. If a closing selector function is specified for the first parameter, this parameter is ignored.
   *  @returns {Observable} An observable sequence of windows.
   */
  observableProto.buffer = function () {
    return this.window.apply(this, arguments)
      .flatMap(toArray);
  };

  /**
   *  Projects each element of an observable sequence into zero or more windows.
   *
   *  @param {Mixed} windowOpeningsOrClosingSelector Observable sequence whose elements denote the creation of new windows, or, a function invoked to define the boundaries of the produced windows (a new window is started when the previous one is closed, resulting in non-overlapping windows).
   *  @param {Function} [windowClosingSelector] A function invoked to define the closing of each produced window. If a closing selector function is specified for the first parameter, this parameter is ignored.
   *  @returns {Observable} An observable sequence of windows.
   */
  observableProto.window = function (windowOpeningsOrClosingSelector, windowClosingSelector) {
    if (arguments.length === 1 && typeof arguments[0] !== 'function') {
      return observableWindowWithBoundaries.call(this, windowOpeningsOrClosingSelector);
    }
    return typeof windowOpeningsOrClosingSelector === 'function' ?
      observableWindowWithClosingSelector.call(this, windowOpeningsOrClosingSelector) :
      observableWindowWithOpenings.call(this, windowOpeningsOrClosingSelector, windowClosingSelector);
  };

  function observableWindowWithOpenings(windowOpenings, windowClosingSelector) {
    return windowOpenings.groupJoin(this, windowClosingSelector, observableEmpty, function (_, win) {
      return win;
    });
  }

  function observableWindowWithBoundaries(windowBoundaries) {
    var source = this;
    return new AnonymousObservable(function (observer) {
      var win = new Subject(),
        d = new CompositeDisposable(),
        r = new RefCountDisposable(d);

      observer.onNext(addRef(win, r));

      d.add(source.subscribe(function (x) {
        win.onNext(x);
      }, function (err) {
        win.onError(err);
        observer.onError(err);
      }, function () {
        win.onCompleted();
        observer.onCompleted();
      }));

      isPromise(windowBoundaries) && (windowBoundaries = observableFromPromise(windowBoundaries));

      d.add(windowBoundaries.subscribe(function (w) {
        win.onCompleted();
        win = new Subject();
        observer.onNext(addRef(win, r));
      }, function (err) {
        win.onError(err);
        observer.onError(err);
      }, function () {
        win.onCompleted();
        observer.onCompleted();
      }));

      return r;
    }, source);
  }

  function observableWindowWithClosingSelector(windowClosingSelector) {
    var source = this;
    return new AnonymousObservable(function (observer) {
      var m = new SerialDisposable(),
        d = new CompositeDisposable(m),
        r = new RefCountDisposable(d),
        win = new Subject();
      observer.onNext(addRef(win, r));
      d.add(source.subscribe(function (x) {
          win.onNext(x);
      }, function (err) {
          win.onError(err);
          observer.onError(err);
      }, function () {
          win.onCompleted();
          observer.onCompleted();
      }));

      function createWindowClose () {
        var windowClose;
        try {
          windowClose = windowClosingSelector();
        } catch (e) {
          observer.onError(e);
          return;
        }

        isPromise(windowClose) && (windowClose = observableFromPromise(windowClose));

        var m1 = new SingleAssignmentDisposable();
        m.setDisposable(m1);
        m1.setDisposable(windowClose.take(1).subscribe(noop, function (err) {
          win.onError(err);
          observer.onError(err);
        }, function () {
          win.onCompleted();
          win = new Subject();
          observer.onNext(addRef(win, r));
          createWindowClose();
        }));
      }

      createWindowClose();
      return r;
    }, source);
  }

  var PairwiseObservable = (function (__super__) {
    inherits(PairwiseObservable, __super__);
    function PairwiseObservable(source) {
      this.source = source;
      __super__.call(this);
    }

    PairwiseObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new PairwiseObserver(o));
    };

    return PairwiseObservable;
  }(ObservableBase));

  var PairwiseObserver = (function(__super__) {
    inherits(PairwiseObserver, __super__);
    function PairwiseObserver(o) {
      this._o = o;
      this._p = null;
      this._hp = false;
      __super__.call(this);
    }

    PairwiseObserver.prototype.next = function (x) {
      if (this._hp) {
        this._o.onNext([this._p, x]);
      } else {
        this._hp = true;
      }
      this._p = x;
    };
    PairwiseObserver.prototype.error = function (err) { this._o.onError(err); };
    PairwiseObserver.prototype.completed = function () { this._o.onCompleted(); };

    return PairwiseObserver;
  }(AbstractObserver));

  /**
   * Returns a new observable that triggers on the second and subsequent triggerings of the input observable.
   * The Nth triggering of the input observable passes the arguments from the N-1th and Nth triggering as a pair.
   * The argument passed to the N-1th triggering is held in hidden internal state until the Nth triggering occurs.
   * @returns {Observable} An observable that triggers on successive pairs of observations from the input observable as an array.
   */
  observableProto.pairwise = function () {
    return new PairwiseObservable(this);
  };

  /**
   * Returns two observables which partition the observations of the source by the given function.
   * The first will trigger observations for those values for which the predicate returns true.
   * The second will trigger observations for those values where the predicate returns false.
   * The predicate is executed once for each subscribed observer.
   * Both also propagate all error observations arising from the source and each completes
   * when the source completes.
   * @param {Function} predicate
   *    The function to determine which output Observable will trigger a particular observation.
   * @returns {Array}
   *    An array of observables. The first triggers when the predicate returns true,
   *    and the second triggers when the predicate returns false.
  */
  observableProto.partition = function(predicate, thisArg) {
    var fn = bindCallback(predicate, thisArg, 3);
    return [
      this.filter(predicate, thisArg),
      this.filter(function (x, i, o) { return !fn(x, i, o); })
    ];
  };

  /**
   *  Groups the elements of an observable sequence according to a specified key selector function and comparer and selects the resulting elements by using a specified function.
   *
   * @example
   *  var res = observable.groupBy(function (x) { return x.id; });
   *  2 - observable.groupBy(function (x) { return x.id; }), function (x) { return x.name; });
   *  3 - observable.groupBy(function (x) { return x.id; }), function (x) { return x.name; }, function (x) { return x.toString(); });
   * @param {Function} keySelector A function to extract the key for each element.
   * @param {Function} [elementSelector]  A function to map each source element to an element in an observable group.
   * @returns {Observable} A sequence of observable groups, each of which corresponds to a unique key value, containing all elements that share that same key value.
   */
  observableProto.groupBy = function (keySelector, elementSelector) {
    return this.groupByUntil(keySelector, elementSelector, observableNever);
  };

    /**
     *  Groups the elements of an observable sequence according to a specified key selector function.
     *  A duration selector function is used to control the lifetime of groups. When a group expires, it receives an OnCompleted notification. When a new element with the same
     *  key value as a reclaimed group occurs, the group will be reborn with a new lifetime request.
     *
     * @example
     *  var res = observable.groupByUntil(function (x) { return x.id; }, null,  function () { return Rx.Observable.never(); });
     *  2 - observable.groupBy(function (x) { return x.id; }), function (x) { return x.name; },  function () { return Rx.Observable.never(); });
     *  3 - observable.groupBy(function (x) { return x.id; }), function (x) { return x.name; },  function () { return Rx.Observable.never(); }, function (x) { return x.toString(); });
     * @param {Function} keySelector A function to extract the key for each element.
     * @param {Function} durationSelector A function to signal the expiration of a group.
     * @returns {Observable}
     *  A sequence of observable groups, each of which corresponds to a unique key value, containing all elements that share that same key value.
     *  If a group's lifetime expires, a new group with the same key value can be created once an element with such a key value is encoutered.
     *
     */
    observableProto.groupByUntil = function (keySelector, elementSelector, durationSelector) {
      var source = this;
      return new AnonymousObservable(function (o) {
        var map = new Map(),
          groupDisposable = new CompositeDisposable(),
          refCountDisposable = new RefCountDisposable(groupDisposable),
          handleError = function (e) { return function (item) { item.onError(e); }; };

        groupDisposable.add(
          source.subscribe(function (x) {
            var key = tryCatch(keySelector)(x);
            if (key === errorObj) {
              map.forEach(handleError(key.e));
              return o.onError(key.e);
            }

            var fireNewMapEntry = false, writer = map.get(key);
            if (writer === undefined) {
              writer = new Subject();
              map.set(key, writer);
              fireNewMapEntry = true;
            }

            if (fireNewMapEntry) {
              var group = new GroupedObservable(key, writer, refCountDisposable),
                durationGroup = new GroupedObservable(key, writer);
              var duration = tryCatch(durationSelector)(durationGroup);
              if (duration === errorObj) {
                map.forEach(handleError(duration.e));
                return o.onError(duration.e);
              }

              o.onNext(group);

              var md = new SingleAssignmentDisposable();
              groupDisposable.add(md);

              md.setDisposable(duration.take(1).subscribe(
                noop,
                function (e) {
                  map.forEach(handleError(e));
                  o.onError(e);
                },
                function () {
                  if (map['delete'](key)) { writer.onCompleted(); }
                  groupDisposable.remove(md);
                }));
            }

            var element = x;
            if (isFunction(elementSelector)) {
              element = tryCatch(elementSelector)(x);
              if (element === errorObj) {
                map.forEach(handleError(element.e));
                return o.onError(element.e);
              }
            }

            writer.onNext(element);
        }, function (e) {
          map.forEach(handleError(e));
          o.onError(e);
        }, function () {
          map.forEach(function (item) { item.onCompleted(); });
          o.onCompleted();
        }));

      return refCountDisposable;
    }, source);
  };

  var UnderlyingObservable = (function (__super__) {
    inherits(UnderlyingObservable, __super__);
    function UnderlyingObservable(m, u) {
      this._m = m;
      this._u = u;
      __super__.call(this);
    }

    UnderlyingObservable.prototype.subscribeCore = function (o) {
      return new BinaryDisposable(this._m.getDisposable(), this._u.subscribe(o));
    };

    return UnderlyingObservable;
  }(ObservableBase));

  var GroupedObservable = (function (__super__) {
    inherits(GroupedObservable, __super__);
    function GroupedObservable(key, underlyingObservable, mergedDisposable) {
      __super__.call(this);
      this.key = key;
      this.underlyingObservable = !mergedDisposable ?
        underlyingObservable :
        new UnderlyingObservable(mergedDisposable, underlyingObservable);
    }

    GroupedObservable.prototype._subscribe = function (o) {
      return this.underlyingObservable.subscribe(o);
    };

    return GroupedObservable;
  }(Observable));

  return Rx;
}));
});

var rx_binding = __commonjs(function (module, exports, global) {
// Copyright (c) Microsoft, All rights reserved. See License.txt in the project root for license information.

;(function (factory) {
  var objectTypes = {
    'function': true,
    'object': true
  };

  function checkGlobal(value) {
    return (value && value.Object === Object) ? value : null;
  }

  var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType) ? exports : null;
  var freeModule = (objectTypes[typeof module] && module && !module.nodeType) ? module : null;
  var freeGlobal = checkGlobal(freeExports && freeModule && typeof global === 'object' && global);
  var freeSelf = checkGlobal(objectTypes[typeof self] && self);
  var freeWindow = checkGlobal(objectTypes[typeof window] && window);
  var moduleExports = (freeModule && freeModule.exports === freeExports) ? freeExports : null;
  var thisGlobal = checkGlobal(objectTypes[typeof this] && this);
  var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) || freeSelf || thisGlobal || Function('return this')();

  // Because of build optimizers
  if (typeof define === 'function' && define.amd) {
    define(['./rx'], function (Rx, exports) {
      return factory(root, exports, Rx);
    });
  } else if (typeof module === 'object' && module && module.exports === freeExports) {
    module.exports = factory(root, module.exports, require$$0);
  } else {
    root.Rx = factory(root, {}, root.Rx);
  }
}.call(__commonjs_global, function (root, exp, Rx, undefined) {

  var Observable = Rx.Observable,
    observableProto = Observable.prototype,
    AnonymousObservable = Rx.AnonymousObservable,
    ObservableBase = Rx.ObservableBase,
    Subject = Rx.Subject,
    AsyncSubject = Rx.AsyncSubject,
    Observer = Rx.Observer,
    ScheduledObserver = Rx.internals.ScheduledObserver,
    disposableCreate = Rx.Disposable.create,
    disposableEmpty = Rx.Disposable.empty,
    BinaryDisposable = Rx.BinaryDisposable,
    currentThreadScheduler = Rx.Scheduler.currentThread,
    isFunction = Rx.helpers.isFunction,
    inherits = Rx.internals.inherits,
    addProperties = Rx.internals.addProperties,
    checkDisposed = Rx.Disposable.checkDisposed;

  // Utilities
  function cloneArray(arr) {
    var len = arr.length, a = new Array(len);
    for(var i = 0; i < len; i++) { a[i] = arr[i]; }
    return a;
  }

  var MulticastObservable = (function (__super__) {
    inherits(MulticastObservable, __super__);
    function MulticastObservable(source, fn1, fn2) {
      this.source = source;
      this._fn1 = fn1;
      this._fn2 = fn2;
      __super__.call(this);
    }

    MulticastObservable.prototype.subscribeCore = function (o) {
      var connectable = this.source.multicast(this._fn1());
      return new BinaryDisposable(this._fn2(connectable).subscribe(o), connectable.connect());
    };

    return MulticastObservable;
  }(ObservableBase));

  /**
   * Multicasts the source sequence notifications through an instantiated subject into all uses of the sequence within a selector function. Each
   * subscription to the resulting sequence causes a separate multicast invocation, exposing the sequence resulting from the selector function's
   * invocation. For specializations with fixed subject types, see Publish, PublishLast, and Replay.
   *
   * @example
   * 1 - res = source.multicast(observable);
   * 2 - res = source.multicast(function () { return new Subject(); }, function (x) { return x; });
   *
   * @param {Function|Subject} subjectOrSubjectSelector
   * Factory function to create an intermediate subject through which the source sequence's elements will be multicast to the selector function.
   * Or:
   * Subject to push source elements into.
   *
   * @param {Function} [selector] Optional selector function which can use the multicasted source sequence subject to the policies enforced by the created subject. Specified only if <paramref name="subjectOrSubjectSelector" is a factory function.
   * @returns {Observable} An observable sequence that contains the elements of a sequence produced by multicasting the source sequence within a selector function.
   */
  observableProto.multicast = function (subjectOrSubjectSelector, selector) {
    return isFunction(subjectOrSubjectSelector) ?
      new MulticastObservable(this, subjectOrSubjectSelector, selector) :
      new ConnectableObservable(this, subjectOrSubjectSelector);
  };

  /**
   * Returns an observable sequence that is the result of invoking the selector on a connectable observable sequence that shares a single subscription to the underlying sequence.
   * This operator is a specialization of Multicast using a regular Subject.
   *
   * @example
   * var resres = source.publish();
   * var res = source.publish(function (x) { return x; });
   *
   * @param {Function} [selector] Selector function which can use the multicasted source sequence as many times as needed, without causing multiple subscriptions to the source sequence. Subscribers to the given source will receive all notifications of the source from the time of the subscription on.
   * @returns {Observable} An observable sequence that contains the elements of a sequence produced by multicasting the source sequence within a selector function.
   */
  observableProto.publish = function (selector) {
    return selector && isFunction(selector) ?
      this.multicast(function () { return new Subject(); }, selector) :
      this.multicast(new Subject());
  };

  /**
   * Returns an observable sequence that shares a single subscription to the underlying sequence.
   * This operator is a specialization of publish which creates a subscription when the number of observers goes from zero to one, then shares that subscription with all subsequent observers until the number of observers returns to zero, at which point the subscription is disposed.
   * @returns {Observable} An observable sequence that contains the elements of a sequence produced by multicasting the source sequence.
   */
  observableProto.share = function () {
    return this.publish().refCount();
  };

  /**
   * Returns an observable sequence that is the result of invoking the selector on a connectable observable sequence that shares a single subscription to the underlying sequence containing only the last notification.
   * This operator is a specialization of Multicast using a AsyncSubject.
   *
   * @example
   * var res = source.publishLast();
   * var res = source.publishLast(function (x) { return x; });
   *
   * @param selector [Optional] Selector function which can use the multicasted source sequence as many times as needed, without causing multiple subscriptions to the source sequence. Subscribers to the given source will only receive the last notification of the source.
   * @returns {Observable} An observable sequence that contains the elements of a sequence produced by multicasting the source sequence within a selector function.
   */
  observableProto.publishLast = function (selector) {
    return selector && isFunction(selector) ?
      this.multicast(function () { return new AsyncSubject(); }, selector) :
      this.multicast(new AsyncSubject());
  };

  /**
   * Returns an observable sequence that is the result of invoking the selector on a connectable observable sequence that shares a single subscription to the underlying sequence and starts with initialValue.
   * This operator is a specialization of Multicast using a BehaviorSubject.
   *
   * @example
   * var res = source.publishValue(42);
   * var res = source.publishValue(function (x) { return x.select(function (y) { return y * y; }) }, 42);
   *
   * @param {Function} [selector] Optional selector function which can use the multicasted source sequence as many times as needed, without causing multiple subscriptions to the source sequence. Subscribers to the given source will receive immediately receive the initial value, followed by all notifications of the source from the time of the subscription on.
   * @param {Mixed} initialValue Initial value received by observers upon subscription.
   * @returns {Observable} An observable sequence that contains the elements of a sequence produced by multicasting the source sequence within a selector function.
   */
  observableProto.publishValue = function (initialValueOrSelector, initialValue) {
    return arguments.length === 2 ?
      this.multicast(function () {
        return new BehaviorSubject(initialValue);
      }, initialValueOrSelector) :
      this.multicast(new BehaviorSubject(initialValueOrSelector));
  };

  /**
   * Returns an observable sequence that shares a single subscription to the underlying sequence and starts with an initialValue.
   * This operator is a specialization of publishValue which creates a subscription when the number of observers goes from zero to one, then shares that subscription with all subsequent observers until the number of observers returns to zero, at which point the subscription is disposed.
   * @param {Mixed} initialValue Initial value received by observers upon subscription.
   * @returns {Observable} An observable sequence that contains the elements of a sequence produced by multicasting the source sequence.
   */
  observableProto.shareValue = function (initialValue) {
    return this.publishValue(initialValue).refCount();
  };

  /**
   * Returns an observable sequence that is the result of invoking the selector on a connectable observable sequence that shares a single subscription to the underlying sequence replaying notifications subject to a maximum time length for the replay buffer.
   * This operator is a specialization of Multicast using a ReplaySubject.
   *
   * @example
   * var res = source.replay(null, 3);
   * var res = source.replay(null, 3, 500);
   * var res = source.replay(null, 3, 500, scheduler);
   * var res = source.replay(function (x) { return x.take(6).repeat(); }, 3, 500, scheduler);
   *
   * @param selector [Optional] Selector function which can use the multicasted source sequence as many times as needed, without causing multiple subscriptions to the source sequence. Subscribers to the given source will receive all the notifications of the source subject to the specified replay buffer trimming policy.
   * @param bufferSize [Optional] Maximum element count of the replay buffer.
   * @param windowSize [Optional] Maximum time length of the replay buffer.
   * @param scheduler [Optional] Scheduler where connected observers within the selector function will be invoked on.
   * @returns {Observable} An observable sequence that contains the elements of a sequence produced by multicasting the source sequence within a selector function.
   */
  observableProto.replay = function (selector, bufferSize, windowSize, scheduler) {
    return selector && isFunction(selector) ?
      this.multicast(function () { return new ReplaySubject(bufferSize, windowSize, scheduler); }, selector) :
      this.multicast(new ReplaySubject(bufferSize, windowSize, scheduler));
  };

  /**
   * Returns an observable sequence that shares a single subscription to the underlying sequence replaying notifications subject to a maximum time length for the replay buffer.
   * This operator is a specialization of replay which creates a subscription when the number of observers goes from zero to one, then shares that subscription with all subsequent observers until the number of observers returns to zero, at which point the subscription is disposed.
   *
   * @example
   * var res = source.shareReplay(3);
   * var res = source.shareReplay(3, 500);
   * var res = source.shareReplay(3, 500, scheduler);
   *

   * @param bufferSize [Optional] Maximum element count of the replay buffer.
   * @param window [Optional] Maximum time length of the replay buffer.
   * @param scheduler [Optional] Scheduler where connected observers within the selector function will be invoked on.
   * @returns {Observable} An observable sequence that contains the elements of a sequence produced by multicasting the source sequence.
   */
  observableProto.shareReplay = function (bufferSize, windowSize, scheduler) {
    return this.replay(null, bufferSize, windowSize, scheduler).refCount();
  };

  var InnerSubscription = function (s, o) {
    this._s = s;
    this._o = o;
  };

  InnerSubscription.prototype.dispose = function () {
    if (!this._s.isDisposed && this._o !== null) {
      var idx = this._s.observers.indexOf(this._o);
      this._s.observers.splice(idx, 1);
      this._o = null;
    }
  };

  /**
   *  Represents a value that changes over time.
   *  Observers can subscribe to the subject to receive the last (or initial) value and all subsequent notifications.
   */
  var BehaviorSubject = Rx.BehaviorSubject = (function (__super__) {
    inherits(BehaviorSubject, __super__);
    function BehaviorSubject(value) {
      __super__.call(this);
      this.value = value;
      this.observers = [];
      this.isDisposed = false;
      this.isStopped = false;
      this.hasError = false;
    }

    addProperties(BehaviorSubject.prototype, Observer.prototype, {
      _subscribe: function (o) {
        checkDisposed(this);
        if (!this.isStopped) {
          this.observers.push(o);
          o.onNext(this.value);
          return new InnerSubscription(this, o);
        }
        if (this.hasError) {
          o.onError(this.error);
        } else {
          o.onCompleted();
        }
        return disposableEmpty;
      },
      /**
       * Gets the current value or throws an exception.
       * Value is frozen after onCompleted is called.
       * After onError is called always throws the specified exception.
       * An exception is always thrown after dispose is called.
       * @returns {Mixed} The initial value passed to the constructor until onNext is called; after which, the last value passed to onNext.
       */
      getValue: function () {
        checkDisposed(this);
        if (this.hasError) { thrower(this.error); }
        return this.value;
      },
      /**
       * Indicates whether the subject has observers subscribed to it.
       * @returns {Boolean} Indicates whether the subject has observers subscribed to it.
       */
      hasObservers: function () { checkDisposed(this); return this.observers.length > 0; },
      /**
       * Notifies all subscribed observers about the end of the sequence.
       */
      onCompleted: function () {
        checkDisposed(this);
        if (this.isStopped) { return; }
        this.isStopped = true;
        for (var i = 0, os = cloneArray(this.observers), len = os.length; i < len; i++) {
          os[i].onCompleted();
        }

        this.observers.length = 0;
      },
      /**
       * Notifies all subscribed observers about the exception.
       * @param {Mixed} error The exception to send to all observers.
       */
      onError: function (error) {
        checkDisposed(this);
        if (this.isStopped) { return; }
        this.isStopped = true;
        this.hasError = true;
        this.error = error;

        for (var i = 0, os = cloneArray(this.observers), len = os.length; i < len; i++) {
          os[i].onError(error);
        }

        this.observers.length = 0;
      },
      /**
       * Notifies all subscribed observers about the arrival of the specified element in the sequence.
       * @param {Mixed} value The value to send to all observers.
       */
      onNext: function (value) {
        checkDisposed(this);
        if (this.isStopped) { return; }
        this.value = value;
        for (var i = 0, os = cloneArray(this.observers), len = os.length; i < len; i++) {
          os[i].onNext(value);
        }
      },
      /**
       * Unsubscribe all observers and release resources.
       */
      dispose: function () {
        this.isDisposed = true;
        this.observers = null;
        this.value = null;
        this.error = null;
      }
    });

    return BehaviorSubject;
  }(Observable));

  /**
   * Represents an object that is both an observable sequence as well as an observer.
   * Each notification is broadcasted to all subscribed and future observers, subject to buffer trimming policies.
   */
  var ReplaySubject = Rx.ReplaySubject = (function (__super__) {

    var maxSafeInteger = Math.pow(2, 53) - 1;

    function createRemovableDisposable(subject, observer) {
      return disposableCreate(function () {
        observer.dispose();
        !subject.isDisposed && subject.observers.splice(subject.observers.indexOf(observer), 1);
      });
    }

    inherits(ReplaySubject, __super__);

    /**
     *  Initializes a new instance of the ReplaySubject class with the specified buffer size, window size and scheduler.
     *  @param {Number} [bufferSize] Maximum element count of the replay buffer.
     *  @param {Number} [windowSize] Maximum time length of the replay buffer.
     *  @param {Scheduler} [scheduler] Scheduler the observers are invoked on.
     */
    function ReplaySubject(bufferSize, windowSize, scheduler) {
      this.bufferSize = bufferSize == null ? maxSafeInteger : bufferSize;
      this.windowSize = windowSize == null ? maxSafeInteger : windowSize;
      this.scheduler = scheduler || currentThreadScheduler;
      this.q = [];
      this.observers = [];
      this.isStopped = false;
      this.isDisposed = false;
      this.hasError = false;
      this.error = null;
      __super__.call(this);
    }

    addProperties(ReplaySubject.prototype, Observer.prototype, {
      _subscribe: function (o) {
        checkDisposed(this);
        var so = new ScheduledObserver(this.scheduler, o), subscription = createRemovableDisposable(this, so);

        this._trim(this.scheduler.now());
        this.observers.push(so);

        for (var i = 0, len = this.q.length; i < len; i++) {
          so.onNext(this.q[i].value);
        }

        if (this.hasError) {
          so.onError(this.error);
        } else if (this.isStopped) {
          so.onCompleted();
        }

        so.ensureActive();
        return subscription;
      },
      /**
       * Indicates whether the subject has observers subscribed to it.
       * @returns {Boolean} Indicates whether the subject has observers subscribed to it.
       */
      hasObservers: function () { checkDisposed(this); return this.observers.length > 0; },
      _trim: function (now) {
        while (this.q.length > this.bufferSize) {
          this.q.shift();
        }
        while (this.q.length > 0 && (now - this.q[0].interval) > this.windowSize) {
          this.q.shift();
        }
      },
      /**
       * Notifies all subscribed observers about the arrival of the specified element in the sequence.
       * @param {Mixed} value The value to send to all observers.
       */
      onNext: function (value) {
        checkDisposed(this);
        if (this.isStopped) { return; }
        var now = this.scheduler.now();
        this.q.push({ interval: now, value: value });
        this._trim(now);

        for (var i = 0, os = cloneArray(this.observers), len = os.length; i < len; i++) {
          var observer = os[i];
          observer.onNext(value);
          observer.ensureActive();
        }
      },
      /**
       * Notifies all subscribed observers about the exception.
       * @param {Mixed} error The exception to send to all observers.
       */
      onError: function (error) {
        checkDisposed(this);
        if (this.isStopped) { return; }
        this.isStopped = true;
        this.error = error;
        this.hasError = true;
        var now = this.scheduler.now();
        this._trim(now);
        for (var i = 0, os = cloneArray(this.observers), len = os.length; i < len; i++) {
          var observer = os[i];
          observer.onError(error);
          observer.ensureActive();
        }
        this.observers.length = 0;
      },
      /**
       * Notifies all subscribed observers about the end of the sequence.
       */
      onCompleted: function () {
        checkDisposed(this);
        if (this.isStopped) { return; }
        this.isStopped = true;
        var now = this.scheduler.now();
        this._trim(now);
        for (var i = 0, os = cloneArray(this.observers), len = os.length; i < len; i++) {
          var observer = os[i];
          observer.onCompleted();
          observer.ensureActive();
        }
        this.observers.length = 0;
      },
      /**
       * Unsubscribe all observers and release resources.
       */
      dispose: function () {
        this.isDisposed = true;
        this.observers = null;
      }
    });

    return ReplaySubject;
  }(Observable));

  var RefCountObservable = (function (__super__) {
    inherits(RefCountObservable, __super__);
    function RefCountObservable(source) {
      this.source = source;
      this._count = 0;
      this._connectableSubscription = null;
      __super__.call(this);
    }

    RefCountObservable.prototype.subscribeCore = function (o) {
      var subscription = this.source.subscribe(o);
      ++this._count === 1 && (this._connectableSubscription = this.source.connect());
      return new RefCountDisposable(this, subscription);
    };

    function RefCountDisposable(p, s) {
      this._p = p;
      this._s = s;
      this.isDisposed = false;
    }

    RefCountDisposable.prototype.dispose = function () {
      if (!this.isDisposed) {
        this.isDisposed = true;
        this._s.dispose();
        --this._p._count === 0 && this._p._connectableSubscription.dispose();
      }
    };

    return RefCountObservable;
  }(ObservableBase));

  var ConnectableObservable = Rx.ConnectableObservable = (function (__super__) {
    inherits(ConnectableObservable, __super__);
    function ConnectableObservable(source, subject) {
      this.source = source;
      this._connection = null;
      this._source = source.asObservable();
      this._subject = subject;
      __super__.call(this);
    }

    function ConnectDisposable(parent, subscription) {
      this._p = parent;
      this._s = subscription;
    }

    ConnectDisposable.prototype.dispose = function () {
      if (this._s) {
        this._s.dispose();
        this._s = null;
        this._p._connection = null;
      }
    };

    ConnectableObservable.prototype.connect = function () {
      if (!this._connection) {
        if (this._subject.isStopped) {
          return disposableEmpty;
        }
        var subscription = this._source.subscribe(this._subject);
        this._connection = new ConnectDisposable(this, subscription);
      }
      return this._connection;
    };

    ConnectableObservable.prototype._subscribe = function (o) {
      return this._subject.subscribe(o);
    };

    ConnectableObservable.prototype.refCount = function () {
      return new RefCountObservable(this);
    };

    return ConnectableObservable;
  }(Observable));

  /**
   * Returns an observable sequence that shares a single subscription to the underlying sequence. This observable sequence
   * can be resubscribed to, even if all prior subscriptions have ended. (unlike `.publish().refCount()`)
   * @returns {Observable} An observable sequence that contains the elements of a sequence produced by multicasting the source.
   */
  observableProto.singleInstance = function() {
    var source = this, hasObservable = false, observable;

    function getObservable() {
      if (!hasObservable) {
        hasObservable = true;
        observable = source['finally'](function() { hasObservable = false; }).publish().refCount();
      }
      return observable;
    }

    return new AnonymousObservable(function(o) {
      return getObservable().subscribe(o);
    });
  };

  return Rx;
}));
});

var rx_backpressure = __commonjs(function (module, exports, global) {
// Copyright (c) Microsoft, All rights reserved. See License.txt in the project root for license information.

;(function (factory) {
  var objectTypes = {
    'function': true,
    'object': true
  };

  function checkGlobal(value) {
    return (value && value.Object === Object) ? value : null;
  }

  var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType) ? exports : null;
  var freeModule = (objectTypes[typeof module] && module && !module.nodeType) ? module : null;
  var freeGlobal = checkGlobal(freeExports && freeModule && typeof global === 'object' && global);
  var freeSelf = checkGlobal(objectTypes[typeof self] && self);
  var freeWindow = checkGlobal(objectTypes[typeof window] && window);
  var moduleExports = (freeModule && freeModule.exports === freeExports) ? freeExports : null;
  var thisGlobal = checkGlobal(objectTypes[typeof this] && this);
  var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) || freeSelf || thisGlobal || Function('return this')();

  // Because of build optimizers
  if (typeof define === 'function' && define.amd) {
    define(['./rx'], function (Rx, exports) {
      return factory(root, exports, Rx);
    });
  } else if (typeof module === 'object' && module && module.exports === freeExports) {
    module.exports = factory(root, module.exports, require$$0);
  } else {
    root.Rx = factory(root, {}, root.Rx);
  }
}.call(__commonjs_global, function (root, exp, Rx, undefined) {

  // References
  var Observable = Rx.Observable,
    observableProto = Observable.prototype,
    AnonymousObservable = Rx.AnonymousObservable,
    AbstractObserver = Rx.internals.AbstractObserver,
    CompositeDisposable = Rx.CompositeDisposable,
    BinaryDisposable = Rx.BinaryDisposable,
    NAryDisposable = Rx.NAryDisposable,
    Notification = Rx.Notification,
    Subject = Rx.Subject,
    Observer = Rx.Observer,
    disposableEmpty = Rx.Disposable.empty,
    disposableCreate = Rx.Disposable.create,
    inherits = Rx.internals.inherits,
    addProperties = Rx.internals.addProperties,
    defaultScheduler = Rx.Scheduler['default'],
    currentThreadScheduler = Rx.Scheduler.currentThread,
    identity = Rx.helpers.identity,
    isScheduler = Rx.Scheduler.isScheduler,
    isFunction = Rx.helpers.isFunction,
    checkDisposed = Rx.Disposable.checkDisposed;

  var errorObj = {e: {}};
  
  function tryCatcherGen(tryCatchTarget) {
    return function tryCatcher() {
      try {
        return tryCatchTarget.apply(this, arguments);
      } catch (e) {
        errorObj.e = e;
        return errorObj;
      }
    };
  }

  var tryCatch = Rx.internals.tryCatch = function tryCatch(fn) {
    if (!isFunction(fn)) { throw new TypeError('fn must be a function'); }
    return tryCatcherGen(fn);
  };

  function thrower(e) {
    throw e;
  }

  /**
  * Used to pause and resume streams.
  */
  Rx.Pauser = (function (__super__) {
    inherits(Pauser, __super__);
    function Pauser() {
      __super__.call(this);
    }

    /**
     * Pauses the underlying sequence.
     */
    Pauser.prototype.pause = function () { this.onNext(false); };

    /**
    * Resumes the underlying sequence.
    */
    Pauser.prototype.resume = function () { this.onNext(true); };

    return Pauser;
  }(Subject));

  var PausableObservable = (function (__super__) {
    inherits(PausableObservable, __super__);
    function PausableObservable(source, pauser) {
      this.source = source;
      this.controller = new Subject();
      this.paused = true;

      if (pauser && pauser.subscribe) {
        this.pauser = this.controller.merge(pauser);
      } else {
        this.pauser = this.controller;
      }

      __super__.call(this);
    }

    PausableObservable.prototype._subscribe = function (o) {
      var conn = this.source.publish(),
        subscription = conn.subscribe(o),
        connection = disposableEmpty;

      var pausable = this.pauser.startWith(!this.paused).distinctUntilChanged().subscribe(function (b) {
        if (b) {
          connection = conn.connect();
        } else {
          connection.dispose();
          connection = disposableEmpty;
        }
      });

      return new NAryDisposable([subscription, connection, pausable]);
    };

    PausableObservable.prototype.pause = function () {
      this.paused = true;
      this.controller.onNext(false);
    };

    PausableObservable.prototype.resume = function () {
      this.paused = false;
      this.controller.onNext(true);
    };

    return PausableObservable;

  }(Observable));

  /**
   * Pauses the underlying observable sequence based upon the observable sequence which yields true/false.
   * @example
   * var pauser = new Rx.Subject();
   * var source = Rx.Observable.interval(100).pausable(pauser);
   * @param {Observable} pauser The observable sequence used to pause the underlying sequence.
   * @returns {Observable} The observable sequence which is paused based upon the pauser.
   */
  observableProto.pausable = function (pauser) {
    return new PausableObservable(this, pauser);
  };

  function combineLatestSource(source, subject, resultSelector) {
    return new AnonymousObservable(function (o) {
      var hasValue = [false, false],
        hasValueAll = false,
        isDone = false,
        values = new Array(2),
        err;

      function next(x, i) {
        values[i] = x;
        hasValue[i] = true;
        if (hasValueAll || (hasValueAll = hasValue.every(identity))) {
          if (err) { return o.onError(err); }
          var res = tryCatch(resultSelector).apply(null, values);
          if (res === errorObj) { return o.onError(res.e); }
          o.onNext(res);
        }
        isDone && values[1] && o.onCompleted();
      }

      return new BinaryDisposable(
        source.subscribe(
          function (x) {
            next(x, 0);
          },
          function (e) {
            if (values[1]) {
              o.onError(e);
            } else {
              err = e;
            }
          },
          function () {
            isDone = true;
            values[1] && o.onCompleted();
          }),
        subject.subscribe(
          function (x) {
            next(x, 1);
          },
          function (e) { o.onError(e); },
          function () {
            isDone = true;
            next(true, 1);
          })
        );
    }, source);
  }

  var PausableBufferedObservable = (function (__super__) {
    inherits(PausableBufferedObservable, __super__);
    function PausableBufferedObservable(source, pauser) {
      this.source = source;
      this.controller = new Subject();
      this.paused = true;

      if (pauser && pauser.subscribe) {
        this.pauser = this.controller.merge(pauser);
      } else {
        this.pauser = this.controller;
      }

      __super__.call(this);
    }

    PausableBufferedObservable.prototype._subscribe = function (o) {
      var q = [], previousShouldFire;

      function drainQueue() { while (q.length > 0) { o.onNext(q.shift()); } }

      var subscription =
        combineLatestSource(
          this.source,
          this.pauser.startWith(!this.paused).distinctUntilChanged(),
          function (data, shouldFire) {
            return { data: data, shouldFire: shouldFire };
          })
          .subscribe(
            function (results) {
              if (previousShouldFire !== undefined && results.shouldFire !== previousShouldFire) {
                previousShouldFire = results.shouldFire;
                // change in shouldFire
                if (results.shouldFire) { drainQueue(); }
              } else {
                previousShouldFire = results.shouldFire;
                // new data
                if (results.shouldFire) {
                  o.onNext(results.data);
                } else {
                  q.push(results.data);
                }
              }
            },
            function (err) {
              drainQueue();
              o.onError(err);
            },
            function () {
              drainQueue();
              o.onCompleted();
            }
          );
      return subscription;      
    };

    PausableBufferedObservable.prototype.pause = function () {
      this.paused = true;
      this.controller.onNext(false);
    };

    PausableBufferedObservable.prototype.resume = function () {
      this.paused = false;
      this.controller.onNext(true);
    };

    return PausableBufferedObservable;

  }(Observable));

  /**
   * Pauses the underlying observable sequence based upon the observable sequence which yields true/false,
   * and yields the values that were buffered while paused.
   * @example
   * var pauser = new Rx.Subject();
   * var source = Rx.Observable.interval(100).pausableBuffered(pauser);
   * @param {Observable} pauser The observable sequence used to pause the underlying sequence.
   * @returns {Observable} The observable sequence which is paused based upon the pauser.
   */
  observableProto.pausableBuffered = function (pauser) {
    return new PausableBufferedObservable(this, pauser);
  };

  var ControlledObservable = (function (__super__) {
    inherits(ControlledObservable, __super__);
    function ControlledObservable (source, enableQueue, scheduler) {
      __super__.call(this);
      this.subject = new ControlledSubject(enableQueue, scheduler);
      this.source = source.multicast(this.subject).refCount();
    }

    ControlledObservable.prototype._subscribe = function (o) {
      return this.source.subscribe(o);
    };

    ControlledObservable.prototype.request = function (numberOfItems) {
      return this.subject.request(numberOfItems == null ? -1 : numberOfItems);
    };

    return ControlledObservable;

  }(Observable));

  var ControlledSubject = (function (__super__) {
    inherits(ControlledSubject, __super__);
    function ControlledSubject(enableQueue, scheduler) {
      enableQueue == null && (enableQueue = true);

      __super__.call(this);
      this.subject = new Subject();
      this.enableQueue = enableQueue;
      this.queue = enableQueue ? [] : null;
      this.requestedCount = 0;
      this.requestedDisposable = null;
      this.error = null;
      this.hasFailed = false;
      this.hasCompleted = false;
      this.scheduler = scheduler || currentThreadScheduler;
    }

    addProperties(ControlledSubject.prototype, Observer, {
      _subscribe: function (o) {
        return this.subject.subscribe(o);
      },
      onCompleted: function () {
        this.hasCompleted = true;
        if (!this.enableQueue || this.queue.length === 0) {
          this.subject.onCompleted();
          this.disposeCurrentRequest();
        } else {
          this.queue.push(Notification.createOnCompleted());
        }
      },
      onError: function (error) {
        this.hasFailed = true;
        this.error = error;
        if (!this.enableQueue || this.queue.length === 0) {
          this.subject.onError(error);
          this.disposeCurrentRequest();
        } else {
          this.queue.push(Notification.createOnError(error));
        }
      },
      onNext: function (value) {
        if (this.requestedCount <= 0) {
          this.enableQueue && this.queue.push(Notification.createOnNext(value));
        } else {
          (this.requestedCount-- === 0) && this.disposeCurrentRequest();
          this.subject.onNext(value);
        }
      },
      _processRequest: function (numberOfItems) {
        if (this.enableQueue) {
          while (this.queue.length > 0 && (numberOfItems > 0 || this.queue[0].kind !== 'N')) {
            var first = this.queue.shift();
            first.accept(this.subject);
            if (first.kind === 'N') {
              numberOfItems--;
            } else {
              this.disposeCurrentRequest();
              this.queue = [];
            }
          }
        }

        return numberOfItems;
      },
      request: function (number) {
        this.disposeCurrentRequest();
        var self = this;

        this.requestedDisposable = this.scheduler.schedule(number,
        function(s, i) {
          var remaining = self._processRequest(i);
          var stopped = self.hasCompleted || self.hasFailed;
          if (!stopped && remaining > 0) {
            self.requestedCount = remaining;

            return disposableCreate(function () {
              self.requestedCount = 0;
            });
              // Scheduled item is still in progress. Return a new
              // disposable to allow the request to be interrupted
              // via dispose.
          }
        });

        return this.requestedDisposable;
      },
      disposeCurrentRequest: function () {
        if (this.requestedDisposable) {
          this.requestedDisposable.dispose();
          this.requestedDisposable = null;
        }
      }
    });

    return ControlledSubject;
  }(Observable));

  /**
   * Attaches a controller to the observable sequence with the ability to queue.
   * @example
   * var source = Rx.Observable.interval(100).controlled();
   * source.request(3); // Reads 3 values
   * @param {bool} enableQueue truthy value to determine if values should be queued pending the next request
   * @param {Scheduler} scheduler determines how the requests will be scheduled
   * @returns {Observable} The observable sequence which only propagates values on request.
   */
  observableProto.controlled = function (enableQueue, scheduler) {

    if (enableQueue && isScheduler(enableQueue)) {
      scheduler = enableQueue;
      enableQueue = true;
    }

    if (enableQueue == null) {  enableQueue = true; }
    return new ControlledObservable(this, enableQueue, scheduler);
  };

  var StopAndWaitObservable = (function (__super__) {
    inherits(StopAndWaitObservable, __super__);
    function StopAndWaitObservable (source) {
      __super__.call(this);
      this.source = source;
    }

    function scheduleMethod(s, self) {
      return self.source.request(1);
    }

    StopAndWaitObservable.prototype._subscribe = function (o) {
      this.subscription = this.source.subscribe(new StopAndWaitObserver(o, this, this.subscription));
      return new BinaryDisposable(
        this.subscription,
        defaultScheduler.schedule(this, scheduleMethod)
      );
    };

    var StopAndWaitObserver = (function (__sub__) {
      inherits(StopAndWaitObserver, __sub__);
      function StopAndWaitObserver (observer, observable, cancel) {
        __sub__.call(this);
        this.observer = observer;
        this.observable = observable;
        this.cancel = cancel;
        this.scheduleDisposable = null;
      }

      StopAndWaitObserver.prototype.completed = function () {
        this.observer.onCompleted();
        this.dispose();
      };

      StopAndWaitObserver.prototype.error = function (error) {
        this.observer.onError(error);
        this.dispose();
      };

      function innerScheduleMethod(s, self) {
        return self.observable.source.request(1);
      }

      StopAndWaitObserver.prototype.next = function (value) {
        this.observer.onNext(value);
        this.scheduleDisposable = defaultScheduler.schedule(this, innerScheduleMethod);
      };

      StopAndWaitObserver.dispose = function () {
        this.observer = null;
        if (this.cancel) {
          this.cancel.dispose();
          this.cancel = null;
        }
        if (this.scheduleDisposable) {
          this.scheduleDisposable.dispose();
          this.scheduleDisposable = null;
        }
        __sub__.prototype.dispose.call(this);
      };

      return StopAndWaitObserver;
    }(AbstractObserver));

    return StopAndWaitObservable;
  }(Observable));


  /**
   * Attaches a stop and wait observable to the current observable.
   * @returns {Observable} A stop and wait observable.
   */
  ControlledObservable.prototype.stopAndWait = function () {
    return new StopAndWaitObservable(this);
  };

  var WindowedObservable = (function (__super__) {
    inherits(WindowedObservable, __super__);
    function WindowedObservable(source, windowSize) {
      __super__.call(this);
      this.source = source;
      this.windowSize = windowSize;
    }

    function scheduleMethod(s, self) {
      return self.source.request(self.windowSize);
    }

    WindowedObservable.prototype._subscribe = function (o) {
      this.subscription = this.source.subscribe(new WindowedObserver(o, this, this.subscription));
      return new BinaryDisposable(
        this.subscription,
        defaultScheduler.schedule(this, scheduleMethod)
      );
    };

    var WindowedObserver = (function (__sub__) {
      inherits(WindowedObserver, __sub__);
      function WindowedObserver(observer, observable, cancel) {
        this.observer = observer;
        this.observable = observable;
        this.cancel = cancel;
        this.received = 0;
        this.scheduleDisposable = null;
        __sub__.call(this);
      }

      WindowedObserver.prototype.completed = function () {
        this.observer.onCompleted();
        this.dispose();
      };

      WindowedObserver.prototype.error = function (error) {
        this.observer.onError(error);
        this.dispose();
      };

      function innerScheduleMethod(s, self) {
        return self.observable.source.request(self.observable.windowSize);
      }

      WindowedObserver.prototype.next = function (value) {
        this.observer.onNext(value);
        this.received = ++this.received % this.observable.windowSize;
        this.received === 0 && (this.scheduleDisposable = defaultScheduler.schedule(this, innerScheduleMethod));
      };

      WindowedObserver.prototype.dispose = function () {
        this.observer = null;
        if (this.cancel) {
          this.cancel.dispose();
          this.cancel = null;
        }
        if (this.scheduleDisposable) {
          this.scheduleDisposable.dispose();
          this.scheduleDisposable = null;
        }
        __sub__.prototype.dispose.call(this);
      };

      return WindowedObserver;
    }(AbstractObserver));

    return WindowedObservable;
  }(Observable));

  /**
   * Creates a sliding windowed observable based upon the window size.
   * @param {Number} windowSize The number of items in the window
   * @returns {Observable} A windowed observable based upon the window size.
   */
  ControlledObservable.prototype.windowed = function (windowSize) {
    return new WindowedObservable(this, windowSize);
  };

  /**
   * Pipes the existing Observable sequence into a Node.js Stream.
   * @param {Stream} dest The destination Node.js stream.
   * @returns {Stream} The destination stream.
   */
  observableProto.pipe = function (dest) {
    var source = this.pausableBuffered();

    function onDrain() {
      source.resume();
    }

    dest.addListener('drain', onDrain);

    source.subscribe(
      function (x) {
        !dest.write(x) && source.pause();
      },
      function (err) {
        dest.emit('error', err);
      },
      function () {
        // Hack check because STDIO is not closable
        !dest._isStdio && dest.end();
        dest.removeListener('drain', onDrain);
      });

    source.resume();

    return dest;
  };

  return Rx;
}));
});

var rx_async = __commonjs(function (module, exports, global) {
// Copyright (c) Microsoft, All rights reserved. See License.txt in the project root for license information.

;(function (factory) {
  var objectTypes = {
    'function': true,
    'object': true
  };

  function checkGlobal(value) {
    return (value && value.Object === Object) ? value : null;
  }

  var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType) ? exports : null;
  var freeModule = (objectTypes[typeof module] && module && !module.nodeType) ? module : null;
  var freeGlobal = checkGlobal(freeExports && freeModule && typeof global === 'object' && global);
  var freeSelf = checkGlobal(objectTypes[typeof self] && self);
  var freeWindow = checkGlobal(objectTypes[typeof window] && window);
  var moduleExports = (freeModule && freeModule.exports === freeExports) ? freeExports : null;
  var thisGlobal = checkGlobal(objectTypes[typeof this] && this);
  var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) || freeSelf || thisGlobal || Function('return this')();

  // Because of build optimizers
  if (typeof define === 'function' && define.amd) {
    define(['./rx.binding', 'exports'], function (Rx, exports) {
      root.Rx = factory(root, exports, Rx);
      return root.Rx;
    });
  } else if (typeof module === 'object' && module && module.exports === freeExports) {
    module.exports = factory(root, module.exports, require$$0);
  } else {
    root.Rx = factory(root, {}, root.Rx);
  }
}.call(__commonjs_global, function (root, exp, Rx, undefined) {

  // Aliases
  var Observable = Rx.Observable,
    observableFromPromise = Observable.fromPromise,
    observableThrow = Observable.throwError,
    AnonymousObservable = Rx.AnonymousObservable,
    ObservableBase = Rx.ObservableBase,
    AsyncSubject = Rx.AsyncSubject,
    disposableCreate = Rx.Disposable.create,
    CompositeDisposable = Rx.CompositeDisposable,
    immediateScheduler = Rx.Scheduler.immediate,
    defaultScheduler = Rx.Scheduler['default'],
    inherits = Rx.internals.inherits,
    isScheduler = Rx.Scheduler.isScheduler,
    isPromise = Rx.helpers.isPromise,
    isFunction = Rx.helpers.isFunction,
    isIterable = Rx.helpers.isIterable,
    isArrayLike = Rx.helpers.isArrayLike;

  var errorObj = {e: {}};
  
  function tryCatcherGen(tryCatchTarget) {
    return function tryCatcher() {
      try {
        return tryCatchTarget.apply(this, arguments);
      } catch (e) {
        errorObj.e = e;
        return errorObj;
      }
    };
  }

  var tryCatch = Rx.internals.tryCatch = function tryCatch(fn) {
    if (!isFunction(fn)) { throw new TypeError('fn must be a function'); }
    return tryCatcherGen(fn);
  };

  function thrower(e) {
    throw e;
  }

  Observable.wrap = function (fn) {
    function createObservable() {
      return Observable.spawn.call(this, fn.apply(this, arguments));
    }

    createObservable.__generatorFunction__ = fn;
    return createObservable;
  };

  var spawn = Observable.spawn = function () {
    var gen = arguments[0], self = this, args = [];
    for (var i = 1, len = arguments.length; i < len; i++) { args.push(arguments[i]); }

    return new AnonymousObservable(function (o) {
      var g = new CompositeDisposable();

      if (isFunction(gen)) { gen = gen.apply(self, args); }
      if (!gen || !isFunction(gen.next)) {
        o.onNext(gen);
        return o.onCompleted();
      }

      function processGenerator(res) {
        var ret = tryCatch(gen.next).call(gen, res);
        if (ret === errorObj) { return o.onError(ret.e); }
        next(ret);
      }

      processGenerator();

      function onError(err) {
        var ret = tryCatch(gen.next).call(gen, err);
        if (ret === errorObj) { return o.onError(ret.e); }
        next(ret);
      }

      function next(ret) {
        if (ret.done) {
          o.onNext(ret.value);
          o.onCompleted();
          return;
        }
        var obs = toObservable.call(self, ret.value);
        var value = null;
        var hasValue = false;
        if (Observable.isObservable(obs)) {
          g.add(obs.subscribe(function(val) {
            hasValue = true;
            value = val;
          }, onError, function() {
            hasValue && processGenerator(value);
          }));
        } else {
          onError(new TypeError('type not supported'));
        }
      }

      return g;
    });
  };

  function toObservable(obj) {
    if (!obj) { return obj; }
    if (Observable.isObservable(obj)) { return obj; }
    if (isPromise(obj)) { return Observable.fromPromise(obj); }
    if (isGeneratorFunction(obj) || isGenerator(obj)) { return spawn.call(this, obj); }
    if (isFunction(obj)) { return thunkToObservable.call(this, obj); }
    if (isArrayLike(obj) || isIterable(obj)) { return arrayToObservable.call(this, obj); }
    if (isObject(obj)) {return objectToObservable.call(this, obj);}
    return obj;
  }

  function arrayToObservable (obj) {
    return Observable.from(obj).concatMap(function(o) {
      if(Observable.isObservable(o) || isObject(o)) {
        return toObservable.call(null, o);
      } else {
        return Rx.Observable.just(o);
      }
    }).toArray();
  }

  function objectToObservable (obj) {
    var results = new obj.constructor(), keys = Object.keys(obj), observables = [];
    for (var i = 0, len = keys.length; i < len; i++) {
      var key = keys[i];
      var observable = toObservable.call(this, obj[key]);

      if(observable && Observable.isObservable(observable)) {
        defer(observable, key);
      } else {
        results[key] = obj[key];
      }
    }

    return Observable.forkJoin.apply(Observable, observables).map(function() {
      return results;
    });


    function defer (observable, key) {
      results[key] = undefined;
      observables.push(observable.map(function (next) {
        results[key] = next;
      }));
    }
  }

  function thunkToObservable(fn) {
    var self = this;
    return new AnonymousObservable(function (o) {
      fn.call(self, function () {
        var err = arguments[0], res = arguments[1];
        if (err) { return o.onError(err); }
        if (arguments.length > 2) {
          var args = [];
          for (var i = 1, len = arguments.length; i < len; i++) { args.push(arguments[i]); }
          res = args;
        }
        o.onNext(res);
        o.onCompleted();
      });
    });
  }

  function isGenerator(obj) {
    return isFunction (obj.next) && isFunction (obj['throw']);
  }

  function isGeneratorFunction(obj) {
    var ctor = obj.constructor;
    if (!ctor) { return false; }
    if (ctor.name === 'GeneratorFunction' || ctor.displayName === 'GeneratorFunction') { return true; }
    return isGenerator(ctor.prototype);
  }

  function isObject(val) {
    return Object == val.constructor;
  }

  /**
   * Invokes the specified function asynchronously on the specified scheduler, surfacing the result through an observable sequence.
   *
   * @example
   * var res = Rx.Observable.start(function () { console.log('hello'); });
   * var res = Rx.Observable.start(function () { console.log('hello'); }, Rx.Scheduler.timeout);
   * var res = Rx.Observable.start(function () { this.log('hello'); }, Rx.Scheduler.timeout, console);
   *
   * @param {Function} func Function to run asynchronously.
   * @param {Scheduler} [scheduler]  Scheduler to run the function on. If not specified, defaults to Scheduler.timeout.
   * @param [context]  The context for the func parameter to be executed.  If not specified, defaults to undefined.
   * @returns {Observable} An observable sequence exposing the function's result value, or an exception.
   *
   * Remarks
   * * The function is called immediately, not during the subscription of the resulting sequence.
   * * Multiple subscriptions to the resulting sequence can observe the function's result.
   */
  Observable.start = function (func, context, scheduler) {
    return observableToAsync(func, context, scheduler)();
  };

  /**
   * Converts the function into an asynchronous function. Each invocation of the resulting asynchronous function causes an invocation of the original synchronous function on the specified scheduler.
   * @param {Function} function Function to convert to an asynchronous function.
   * @param {Scheduler} [scheduler] Scheduler to run the function on. If not specified, defaults to Scheduler.timeout.
   * @param {Mixed} [context] The context for the func parameter to be executed.  If not specified, defaults to undefined.
   * @returns {Function} Asynchronous function.
   */
  var observableToAsync = Observable.toAsync = function (func, context, scheduler) {
    isScheduler(scheduler) || (scheduler = defaultScheduler);
    return function () {
      var args = arguments,
        subject = new AsyncSubject();

      scheduler.schedule(null, function () {
        var result;
        try {
          result = func.apply(context, args);
        } catch (e) {
          subject.onError(e);
          return;
        }
        subject.onNext(result);
        subject.onCompleted();
      });
      return subject.asObservable();
    };
  };

function createCbObservable(fn, ctx, selector, args) {
  var o = new AsyncSubject();

  args.push(createCbHandler(o, ctx, selector));
  fn.apply(ctx, args);

  return o.asObservable();
}

function createCbHandler(o, ctx, selector) {
  return function handler () {
    var len = arguments.length, results = new Array(len);
    for(var i = 0; i < len; i++) { results[i] = arguments[i]; }

    if (isFunction(selector)) {
      results = tryCatch(selector).apply(ctx, results);
      if (results === errorObj) { return o.onError(results.e); }
      o.onNext(results);
    } else {
      if (results.length <= 1) {
        o.onNext(results[0]);
      } else {
        o.onNext(results);
      }
    }

    o.onCompleted();
  };
}

/**
 * Converts a callback function to an observable sequence.
 *
 * @param {Function} fn Function with a callback as the last parameter to convert to an Observable sequence.
 * @param {Mixed} [ctx] The context for the func parameter to be executed.  If not specified, defaults to undefined.
 * @param {Function} [selector] A selector which takes the arguments from the callback to produce a single item to yield on next.
 * @returns {Function} A function, when executed with the required parameters minus the callback, produces an Observable sequence with a single value of the arguments to the callback as an array.
 */
Observable.fromCallback = function (fn, ctx, selector) {
  return function () {
    typeof ctx === 'undefined' && (ctx = this); 

    var len = arguments.length, args = new Array(len)
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    return createCbObservable(fn, ctx, selector, args);
  };
};

function createNodeObservable(fn, ctx, selector, args) {
  var o = new AsyncSubject();

  args.push(createNodeHandler(o, ctx, selector));
  fn.apply(ctx, args);

  return o.asObservable();
}

function createNodeHandler(o, ctx, selector) {
  return function handler () {
    var err = arguments[0];
    if (err) { return o.onError(err); }

    var len = arguments.length, results = [];
    for(var i = 1; i < len; i++) { results[i - 1] = arguments[i]; }

    if (isFunction(selector)) {
      var results = tryCatch(selector).apply(ctx, results);
      if (results === errorObj) { return o.onError(results.e); }
      o.onNext(results);
    } else {
      if (results.length <= 1) {
        o.onNext(results[0]);
      } else {
        o.onNext(results);
      }
    }

    o.onCompleted();
  };
}

/**
 * Converts a Node.js callback style function to an observable sequence.  This must be in function (err, ...) format.
 * @param {Function} fn The function to call
 * @param {Mixed} [ctx] The context for the func parameter to be executed.  If not specified, defaults to undefined.
 * @param {Function} [selector] A selector which takes the arguments from the callback minus the error to produce a single item to yield on next.
 * @returns {Function} An async function which when applied, returns an observable sequence with the callback arguments as an array.
 */
Observable.fromNodeCallback = function (fn, ctx, selector) {
  return function () {
    typeof ctx === 'undefined' && (ctx = this); 
    var len = arguments.length, args = new Array(len);
    for(var i = 0; i < len; i++) { args[i] = arguments[i]; }
    return createNodeObservable(fn, ctx, selector, args);
  };
};

  function isNodeList(el) {
    if (root.StaticNodeList) {
      // IE8 Specific
      // instanceof is slower than Object#toString, but Object#toString will not work as intended in IE8
      return el instanceof root.StaticNodeList || el instanceof root.NodeList;
    } else {
      return Object.prototype.toString.call(el) === '[object NodeList]';
    }
  }

  function ListenDisposable(e, n, fn) {
    this._e = e;
    this._n = n;
    this._fn = fn;
    this._e.addEventListener(this._n, this._fn, false);
    this.isDisposed = false;
  }
  ListenDisposable.prototype.dispose = function () {
    if (!this.isDisposed) {
      this._e.removeEventListener(this._n, this._fn, false);
      this.isDisposed = true;
    }
  };

  function createEventListener (el, eventName, handler) {
    var disposables = new CompositeDisposable();

    // Asume NodeList or HTMLCollection
    var elemToString = Object.prototype.toString.call(el);
    if (isNodeList(el) || elemToString === '[object HTMLCollection]') {
      for (var i = 0, len = el.length; i < len; i++) {
        disposables.add(createEventListener(el.item(i), eventName, handler));
      }
    } else if (el) {
      disposables.add(new ListenDisposable(el, eventName, handler));
    }

    return disposables;
  }

  /**
   * Configuration option to determine whether to use native events only
   */
  Rx.config.useNativeEvents = false;

  var EventObservable = (function(__super__) {
    inherits(EventObservable, __super__);
    function EventObservable(el, name, fn) {
      this._el = el;
      this._n = name;
      this._fn = fn;
      __super__.call(this);
    }

    function createHandler(o, fn) {
      return function handler () {
        var results = arguments[0];
        if (isFunction(fn)) {
          results = tryCatch(fn).apply(null, arguments);
          if (results === errorObj) { return o.onError(results.e); }
        }
        o.onNext(results);
      };
    }

    EventObservable.prototype.subscribeCore = function (o) {
      return createEventListener(
        this._el,
        this._n,
        createHandler(o, this._fn));
    };

    return EventObservable;
  }(ObservableBase));

  /**
   * Creates an observable sequence by adding an event listener to the matching DOMElement or each item in the NodeList.
   * @param {Object} element The DOMElement or NodeList to attach a listener.
   * @param {String} eventName The event name to attach the observable sequence.
   * @param {Function} [selector] A selector which takes the arguments from the event handler to produce a single item to yield on next.
   * @returns {Observable} An observable sequence of events from the specified element and the specified event.
   */
  Observable.fromEvent = function (element, eventName, selector) {
    // Node.js specific
    if (element.addListener) {
      return fromEventPattern(
        function (h) { element.addListener(eventName, h); },
        function (h) { element.removeListener(eventName, h); },
        selector);
    }

    // Use only if non-native events are allowed
    if (!Rx.config.useNativeEvents) {
      // Handles jq, Angular.js, Zepto, Marionette, Ember.js
      if (typeof element.on === 'function' && typeof element.off === 'function') {
        return fromEventPattern(
          function (h) { element.on(eventName, h); },
          function (h) { element.off(eventName, h); },
          selector);
      }
    }

    return new EventObservable(element, eventName, selector).publish().refCount();
  };

  var EventPatternObservable = (function(__super__) {
    inherits(EventPatternObservable, __super__);
    function EventPatternObservable(add, del, fn) {
      this._add = add;
      this._del = del;
      this._fn = fn;
      __super__.call(this);
    }

    function createHandler(o, fn) {
      return function handler () {
        var results = arguments[0];
        if (isFunction(fn)) {
          results = tryCatch(fn).apply(null, arguments);
          if (results === errorObj) { return o.onError(results.e); }
        }
        o.onNext(results);
      };
    }

    EventPatternObservable.prototype.subscribeCore = function (o) {
      var fn = createHandler(o, this._fn);
      var returnValue = this._add(fn);
      return new EventPatternDisposable(this._del, fn, returnValue);
    };

    function EventPatternDisposable(del, fn, ret) {
      this._del = del;
      this._fn = fn;
      this._ret = ret;
      this.isDisposed = false;
    }

    EventPatternDisposable.prototype.dispose = function () {
      if(!this.isDisposed) {
        isFunction(this._del) && this._del(this._fn, this._ret);
        this.isDisposed = true;
      }
    };

    return EventPatternObservable;
  }(ObservableBase));

  /**
   * Creates an observable sequence from an event emitter via an addHandler/removeHandler pair.
   * @param {Function} addHandler The function to add a handler to the emitter.
   * @param {Function} [removeHandler] The optional function to remove a handler from an emitter.
   * @param {Function} [selector] A selector which takes the arguments from the event handler to produce a single item to yield on next.
   * @returns {Observable} An observable sequence which wraps an event from an event emitter
   */
  var fromEventPattern = Observable.fromEventPattern = function (addHandler, removeHandler, selector) {
    return new EventPatternObservable(addHandler, removeHandler, selector).publish().refCount();
  };

  /**
   * Invokes the asynchronous function, surfacing the result through an observable sequence.
   * @param {Function} functionAsync Asynchronous function which returns a Promise to run.
   * @returns {Observable} An observable sequence exposing the function's result value, or an exception.
   */
  Observable.startAsync = function (functionAsync) {
    var promise = tryCatch(functionAsync)();
    if (promise === errorObj) { return observableThrow(promise.e); }
    return observableFromPromise(promise);
  };

  return Rx;
}));
});

var rx_aggregates = __commonjs(function (module, exports, global) {
// Copyright (c) Microsoft, All rights reserved. See License.txt in the project root for license information.

;(function (factory) {
  var objectTypes = {
    'function': true,
    'object': true
  };

  function checkGlobal(value) {
    return (value && value.Object === Object) ? value : null;
  }

  var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType) ? exports : null;
  var freeModule = (objectTypes[typeof module] && module && !module.nodeType) ? module : null;
  var freeGlobal = checkGlobal(freeExports && freeModule && typeof global === 'object' && global);
  var freeSelf = checkGlobal(objectTypes[typeof self] && self);
  var freeWindow = checkGlobal(objectTypes[typeof window] && window);
  var moduleExports = (freeModule && freeModule.exports === freeExports) ? freeExports : null;
  var thisGlobal = checkGlobal(objectTypes[typeof this] && this);
  var root = freeGlobal || ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) || freeSelf || thisGlobal || Function('return this')();

  // Because of build optimizers
  if (typeof define === 'function' && define.amd) {
    define(['./rx'], function (Rx, exports) {
      return factory(root, exports, Rx);
    });
  } else if (typeof module === 'object' && module && module.exports === freeExports) {
    module.exports = factory(root, module.exports, require$$0);
  } else {
    root.Rx = factory(root, {}, root.Rx);
  }
}.call(__commonjs_global, function (root, exp, Rx, undefined) {

  // References
  var Observable = Rx.Observable,
    observableProto = Observable.prototype,
    BinaryDisposable = Rx.BinaryDisposable,
    AnonymousObservable = Rx.AnonymousObservable,
    AbstractObserver = Rx.internals.AbstractObserver,
    disposableEmpty = Rx.Disposable.empty,
    helpers = Rx.helpers,
    defaultComparer = helpers.defaultComparer,
    identity = helpers.identity,
    defaultSubComparer = helpers.defaultSubComparer,
    isFunction = helpers.isFunction,
    isPromise = helpers.isPromise,
    isArrayLike = helpers.isArrayLike,
    isIterable = helpers.isIterable,
    inherits = Rx.internals.inherits,
    observableFromPromise = Observable.fromPromise,
    observableFrom = Observable.from,
    bindCallback = Rx.internals.bindCallback,
    EmptyError = Rx.EmptyError,
    ObservableBase = Rx.ObservableBase,
    ArgumentOutOfRangeError = Rx.ArgumentOutOfRangeError;

  var errorObj = {e: {}};
  
  function tryCatcherGen(tryCatchTarget) {
    return function tryCatcher() {
      try {
        return tryCatchTarget.apply(this, arguments);
      } catch (e) {
        errorObj.e = e;
        return errorObj;
      }
    };
  }

  var tryCatch = Rx.internals.tryCatch = function tryCatch(fn) {
    if (!isFunction(fn)) { throw new TypeError('fn must be a function'); }
    return tryCatcherGen(fn);
  };

  function thrower(e) {
    throw e;
  }

  var ExtremaByObservable = (function (__super__) {
    inherits(ExtremaByObservable, __super__);
    function ExtremaByObservable(source, k, c) {
      this.source = source;
      this._k = k;
      this._c = c;
      __super__.call(this);
    }

    ExtremaByObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new ExtremaByObserver(o, this._k, this._c));
    };

    return ExtremaByObservable;
  }(ObservableBase));

  var ExtremaByObserver = (function (__super__) {
    inherits(ExtremaByObserver, __super__);
    function ExtremaByObserver(o, k, c) {
      this._o = o;
      this._k = k;
      this._c = c;
      this._v = null;
      this._hv = false;
      this._l = [];
      __super__.call(this);
    }

    ExtremaByObserver.prototype.next = function (x) {
      var key = tryCatch(this._k)(x);
      if (key === errorObj) { return this._o.onError(key.e); }
      var comparison = 0;
      if (!this._hv) {
        this._hv = true;
        this._v = key;
      } else {
        comparison = tryCatch(this._c)(key, this._v);
        if (comparison === errorObj) { return this._o.onError(comparison.e); }
      }
      if (comparison > 0) {
        this._v = key;
        this._l = [];
      }
      if (comparison >= 0) { this._l.push(x); }
    };

    ExtremaByObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    ExtremaByObserver.prototype.completed = function () {
      this._o.onNext(this._l);
      this._o.onCompleted();
    };

    return ExtremaByObserver;
  }(AbstractObserver));

  function firstOnly(x) {
    if (x.length === 0) { throw new EmptyError(); }
    return x[0];
  }

  var ReduceObservable = (function(__super__) {
    inherits(ReduceObservable, __super__);
    function ReduceObservable(source, accumulator, hasSeed, seed) {
      this.source = source;
      this.accumulator = accumulator;
      this.hasSeed = hasSeed;
      this.seed = seed;
      __super__.call(this);
    }

    ReduceObservable.prototype.subscribeCore = function(observer) {
      return this.source.subscribe(new ReduceObserver(observer,this));
    };

    return ReduceObservable;
  }(ObservableBase));

  var ReduceObserver = (function (__super__) {
    inherits(ReduceObserver, __super__);
    function ReduceObserver(o, parent) {
      this._o = o;
      this._p = parent;
      this._fn = parent.accumulator;
      this._hs = parent.hasSeed;
      this._s = parent.seed;
      this._ha = false;
      this._a = null;
      this._hv = false;
      this._i = 0;
      __super__.call(this);
    }

    ReduceObserver.prototype.next = function (x) {
      !this._hv && (this._hv = true);
      if (this._ha) {
        this._a = tryCatch(this._fn)(this._a, x, this._i, this._p);
      } else {
        this._a = this._hs ? tryCatch(this._fn)(this._s, x, this._i, this._p) : x;
        this._ha = true;
      }
      if (this._a === errorObj) { return this._o.onError(this._a.e); }
      this._i++;
    };

    ReduceObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    ReduceObserver.prototype.completed = function () {
      this._hv && this._o.onNext(this._a);
      !this._hv && this._hs && this._o.onNext(this._s);
      !this._hv && !this._hs && this._o.onError(new EmptyError());
      this._o.onCompleted();
    };

    return ReduceObserver;
  }(AbstractObserver));

  /**
  * Applies an accumulator function over an observable sequence, returning the result of the aggregation as a single element in the result sequence. The specified seed value is used as the initial accumulator value.
  * For aggregation behavior with incremental intermediate results, see Observable.scan.
  * @param {Function} accumulator An accumulator function to be invoked on each element.
  * @param {Any} [seed] The initial accumulator value.
  * @returns {Observable} An observable sequence containing a single element with the final accumulator value.
  */
  observableProto.reduce = function () {
    var hasSeed = false, seed, accumulator = arguments[0];
    if (arguments.length === 2) {
      hasSeed = true;
      seed = arguments[1];
    }
    return new ReduceObservable(this, accumulator, hasSeed, seed);
  };

  var SomeObservable = (function (__super__) {
    inherits(SomeObservable, __super__);
    function SomeObservable(source, fn) {
      this.source = source;
      this._fn = fn;
      __super__.call(this);
    }

    SomeObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new SomeObserver(o, this._fn, this.source));
    };

    return SomeObservable;
  }(ObservableBase));

  var SomeObserver = (function (__super__) {
    inherits(SomeObserver, __super__);

    function SomeObserver(o, fn, s) {
      this._o = o;
      this._fn = fn;
      this._s = s;
      this._i = 0;
      __super__.call(this);
    }

    SomeObserver.prototype.next = function (x) {
      var result = tryCatch(this._fn)(x, this._i++, this._s);
      if (result === errorObj) { return this._o.onError(result.e); }
      if (Boolean(result)) {
        this._o.onNext(true);
        this._o.onCompleted();
      }
    };
    SomeObserver.prototype.error = function (e) { this._o.onError(e); };
    SomeObserver.prototype.completed = function () {
      this._o.onNext(false);
      this._o.onCompleted();
    };

    return SomeObserver;
  }(AbstractObserver));

  /**
   * Determines whether any element of an observable sequence satisfies a condition if present, else if any items are in the sequence.
   * @param {Function} [predicate] A function to test each element for a condition.
   * @returns {Observable} An observable sequence containing a single element determining whether any elements in the source sequence pass the test in the specified predicate if given, else if any items are in the sequence.
   */
  observableProto.some = function (predicate, thisArg) {
    var fn = bindCallback(predicate, thisArg, 3);
    return new SomeObservable(this, fn);
  };

  var IsEmptyObservable = (function (__super__) {
    inherits(IsEmptyObservable, __super__);
    function IsEmptyObservable(source) {
      this.source = source;
      __super__.call(this);
    }

    IsEmptyObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new IsEmptyObserver(o));
    };

    return IsEmptyObservable;
  }(ObservableBase));

  var IsEmptyObserver = (function(__super__) {
    inherits(IsEmptyObserver, __super__);
    function IsEmptyObserver(o) {
      this._o = o;
      __super__.call(this);
    }

    IsEmptyObserver.prototype.next = function () {
      this._o.onNext(false);
      this._o.onCompleted();
    };
    IsEmptyObserver.prototype.error = function (e) { this._o.onError(e); };
    IsEmptyObserver.prototype.completed = function () {
      this._o.onNext(true);
      this._o.onCompleted();
    };

    return IsEmptyObserver;
  }(AbstractObserver));

  /**
   * Determines whether an observable sequence is empty.
   * @returns {Observable} An observable sequence containing a single element determining whether the source sequence is empty.
   */
  observableProto.isEmpty = function () {
    return new IsEmptyObservable(this);
  };

  var EveryObservable = (function (__super__) {
    inherits(EveryObservable, __super__);
    function EveryObservable(source, fn) {
      this.source = source;
      this._fn = fn;
      __super__.call(this);
    }

    EveryObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new EveryObserver(o, this._fn, this.source));
    };

    return EveryObservable;
  }(ObservableBase));

  var EveryObserver = (function (__super__) {
    inherits(EveryObserver, __super__);

    function EveryObserver(o, fn, s) {
      this._o = o;
      this._fn = fn;
      this._s = s;
      this._i = 0;
      __super__.call(this);
    }

    EveryObserver.prototype.next = function (x) {
      var result = tryCatch(this._fn)(x, this._i++, this._s);
      if (result === errorObj) { return this._o.onError(result.e); }
      if (!Boolean(result)) {
        this._o.onNext(false);
        this._o.onCompleted();
      }
    };
    EveryObserver.prototype.error = function (e) { this._o.onError(e); };
    EveryObserver.prototype.completed = function () {
      this._o.onNext(true);
      this._o.onCompleted();
    };

    return EveryObserver;
  }(AbstractObserver));

  /**
   * Determines whether all elements of an observable sequence satisfy a condition.
   * @param {Function} [predicate] A function to test each element for a condition.
   * @param {Any} [thisArg] Object to use as this when executing callback.
   * @returns {Observable} An observable sequence containing a single element determining whether all elements in the source sequence pass the test in the specified predicate.
   */
  observableProto.every = function (predicate, thisArg) {
    var fn = bindCallback(predicate, thisArg, 3);
    return new EveryObservable(this, fn);
  };

  var IncludesObservable = (function (__super__) {
    inherits(IncludesObservable, __super__);
    function IncludesObservable(source, elem, idx) {
      var n = +idx || 0;
      Math.abs(n) === Infinity && (n = 0);

      this.source = source;
      this._elem = elem;
      this._n = n;
      __super__.call(this);
    }

    IncludesObservable.prototype.subscribeCore = function (o) {
      if (this._n < 0) {
        o.onNext(false);
        o.onCompleted();
        return disposableEmpty;
      }

      return this.source.subscribe(new IncludesObserver(o, this._elem, this._n));
    };

    return IncludesObservable;
  }(ObservableBase));

  var IncludesObserver = (function (__super__) {
    inherits(IncludesObserver, __super__);
    function IncludesObserver(o, elem, n) {
      this._o = o;
      this._elem = elem;
      this._n = n;
      this._i = 0;
      __super__.call(this);
    }

    function comparer(a, b) {
      return (a === 0 && b === 0) || (a === b || (isNaN(a) && isNaN(b)));
    }

    IncludesObserver.prototype.next = function (x) {
      if (this._i++ >= this._n && comparer(x, this._elem)) {
        this._o.onNext(true);
        this._o.onCompleted();
      }
    };
    IncludesObserver.prototype.error = function (e) { this._o.onError(e); };
    IncludesObserver.prototype.completed = function () { this._o.onNext(false); this._o.onCompleted(); };

    return IncludesObserver;
  }(AbstractObserver));

  /**
   * Determines whether an observable sequence includes a specified element with an optional equality comparer.
   * @param searchElement The value to locate in the source sequence.
   * @param {Number} [fromIndex] An equality comparer to compare elements.
   * @returns {Observable} An observable sequence containing a single element determining whether the source sequence includes an element that has the specified value from the given index.
   */
  observableProto.includes = function (searchElement, fromIndex) {
    return new IncludesObservable(this, searchElement, fromIndex);
  };

  var CountObservable = (function (__super__) {
    inherits(CountObservable, __super__);
    function CountObservable(source, fn) {
      this.source = source;
      this._fn = fn;
      __super__.call(this);
    }

    CountObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new CountObserver(o, this._fn, this.source));
    };

    return CountObservable;
  }(ObservableBase));

  var CountObserver = (function (__super__) {
    inherits(CountObserver, __super__);

    function CountObserver(o, fn, s) {
      this._o = o;
      this._fn = fn;
      this._s = s;
      this._i = 0;
      this._c = 0;
      __super__.call(this);
    }

    CountObserver.prototype.next = function (x) {
      if (this._fn) {
        var result = tryCatch(this._fn)(x, this._i++, this._s);
        if (result === errorObj) { return this._o.onError(result.e); }
        Boolean(result) && (this._c++);
      } else {
        this._c++;
      }
    };
    CountObserver.prototype.error = function (e) { this._o.onError(e); };
    CountObserver.prototype.completed = function () {
      this._o.onNext(this._c);
      this._o.onCompleted();
    };

    return CountObserver;
  }(AbstractObserver));

  /**
   * Returns an observable sequence containing a value that represents how many elements in the specified observable sequence satisfy a condition if provided, else the count of items.
   * @example
   * res = source.count();
   * res = source.count(function (x) { return x > 3; });
   * @param {Function} [predicate]A function to test each element for a condition.
   * @param {Any} [thisArg] Object to use as this when executing callback.
   * @returns {Observable} An observable sequence containing a single element with a number that represents how many elements in the input sequence satisfy the condition in the predicate function if provided, else the count of items in the sequence.
   */
  observableProto.count = function (predicate, thisArg) {
    var fn = bindCallback(predicate, thisArg, 3);
    return new CountObservable(this, fn);
  };

  var IndexOfObservable = (function (__super__) {
    inherits(IndexOfObservable, __super__);
    function IndexOfObservable(source, e, n) {
      this.source = source;
      this._e = e;
      this._n = n;
      __super__.call(this);
    }

    IndexOfObservable.prototype.subscribeCore = function (o) {
      if (this._n < 0) {
        o.onNext(-1);
        o.onCompleted();
        return disposableEmpty;
      }

      return this.source.subscribe(new IndexOfObserver(o, this._e, this._n));
    };

    return IndexOfObservable;
  }(ObservableBase));

  var IndexOfObserver = (function (__super__) {
    inherits(IndexOfObserver, __super__);
    function IndexOfObserver(o, e, n) {
      this._o = o;
      this._e = e;
      this._n = n;
      this._i = 0;
      __super__.call(this);
    }

    IndexOfObserver.prototype.next = function (x) {
      if (this._i >= this._n && x === this._e) {
        this._o.onNext(this._i);
        this._o.onCompleted();
      }
      this._i++;
    };
    IndexOfObserver.prototype.error = function (e) { this._o.onError(e); };
    IndexOfObserver.prototype.completed = function () { this._o.onNext(-1); this._o.onCompleted(); };

    return IndexOfObserver;
  }(AbstractObserver));

  /**
   * Returns the first index at which a given element can be found in the observable sequence, or -1 if it is not present.
   * @param {Any} searchElement Element to locate in the array.
   * @param {Number} [fromIndex] The index to start the search.  If not specified, defaults to 0.
   * @returns {Observable} And observable sequence containing the first index at which a given element can be found in the observable sequence, or -1 if it is not present.
   */
  observableProto.indexOf = function(searchElement, fromIndex) {
    var n = +fromIndex || 0;
    Math.abs(n) === Infinity && (n = 0);
    return new IndexOfObservable(this, searchElement, n);
  };

  var SumObservable = (function (__super__) {
    inherits(SumObservable, __super__);
    function SumObservable(source, fn) {
      this.source = source;
      this._fn = fn;
      __super__.call(this);
    }

    SumObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new SumObserver(o, this._fn, this.source));
    };

    return SumObservable;
  }(ObservableBase));

  var SumObserver = (function (__super__) {
    inherits(SumObserver, __super__);

    function SumObserver(o, fn, s) {
      this._o = o;
      this._fn = fn;
      this._s = s;
      this._i = 0;
      this._c = 0;
      __super__.call(this);
    }

    SumObserver.prototype.next = function (x) {
      if (this._fn) {
        var result = tryCatch(this._fn)(x, this._i++, this._s);
        if (result === errorObj) { return this._o.onError(result.e); }
        this._c += result;
      } else {
        this._c += x;
      }
    };
    SumObserver.prototype.error = function (e) { this._o.onError(e); };
    SumObserver.prototype.completed = function () {
      this._o.onNext(this._c);
      this._o.onCompleted();
    };

    return SumObserver;
  }(AbstractObserver));

  /**
   * Computes the sum of a sequence of values that are obtained by invoking an optional transform function on each element of the input sequence, else if not specified computes the sum on each item in the sequence.
   * @param {Function} [selector] A transform function to apply to each element.
   * @param {Any} [thisArg] Object to use as this when executing callback.
   * @returns {Observable} An observable sequence containing a single element with the sum of the values in the source sequence.
   */
  observableProto.sum = function (keySelector, thisArg) {
    var fn = bindCallback(keySelector, thisArg, 3);
    return new SumObservable(this, fn);
  };

  /**
   * Returns the elements in an observable sequence with the minimum key value according to the specified comparer.
   * @example
   * var res = source.minBy(function (x) { return x.value; });
   * var res = source.minBy(function (x) { return x.value; }, function (x, y) { return x - y; });
   * @param {Function} keySelector Key selector function.
   * @param {Function} [comparer] Comparer used to compare key values.
   * @returns {Observable} An observable sequence containing a list of zero or more elements that have a minimum key value.
   */
  observableProto.minBy = function (keySelector, comparer) {
    comparer || (comparer = defaultSubComparer);
    return new ExtremaByObservable(this, keySelector, function (x, y) { return comparer(x, y) * -1; });
  };

  /**
   * Returns the minimum element in an observable sequence according to the optional comparer else a default greater than less than check.
   * @example
   * var res = source.min();
   * var res = source.min(function (x, y) { return x.value - y.value; });
   * @param {Function} [comparer] Comparer used to compare elements.
   * @returns {Observable} An observable sequence containing a single element with the minimum element in the source sequence.
   */
  observableProto.min = function (comparer) {
    return this.minBy(identity, comparer).map(firstOnly);
  };

  /**
   * Returns the elements in an observable sequence with the maximum  key value according to the specified comparer.
   * @example
   * var res = source.maxBy(function (x) { return x.value; });
   * var res = source.maxBy(function (x) { return x.value; }, function (x, y) { return x - y;; });
   * @param {Function} keySelector Key selector function.
   * @param {Function} [comparer]  Comparer used to compare key values.
   * @returns {Observable} An observable sequence containing a list of zero or more elements that have a maximum key value.
   */
  observableProto.maxBy = function (keySelector, comparer) {
    comparer || (comparer = defaultSubComparer);
    return new ExtremaByObservable(this, keySelector, comparer);
  };

  /**
   * Returns the maximum value in an observable sequence according to the specified comparer.
   * @example
   * var res = source.max();
   * var res = source.max(function (x, y) { return x.value - y.value; });
   * @param {Function} [comparer] Comparer used to compare elements.
   * @returns {Observable} An observable sequence containing a single element with the maximum element in the source sequence.
   */
  observableProto.max = function (comparer) {
    return this.maxBy(identity, comparer).map(firstOnly);
  };

  var AverageObservable = (function (__super__) {
    inherits(AverageObservable, __super__);
    function AverageObservable(source, fn) {
      this.source = source;
      this._fn = fn;
      __super__.call(this);
    }

    AverageObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new AverageObserver(o, this._fn, this.source));
    };

    return AverageObservable;
  }(ObservableBase));

  var AverageObserver = (function(__super__) {
    inherits(AverageObserver, __super__);
    function AverageObserver(o, fn, s) {
      this._o = o;
      this._fn = fn;
      this._s = s;
      this._c = 0;
      this._t = 0;
      __super__.call(this);
    }

    AverageObserver.prototype.next = function (x) {
      if(this._fn) {
        var r = tryCatch(this._fn)(x, this._c++, this._s);
        if (r === errorObj) { return this._o.onError(r.e); }
        this._t += r;
      } else {
        this._c++;
        this._t += x;
      }
    };
    AverageObserver.prototype.error = function (e) { this._o.onError(e); };
    AverageObserver.prototype.completed = function () {
      if (this._c === 0) { return this._o.onError(new EmptyError()); }
      this._o.onNext(this._t / this._c);
      this._o.onCompleted();
    };

    return AverageObserver;
  }(AbstractObserver));

  /**
   * Computes the average of an observable sequence of values that are in the sequence or obtained by invoking a transform function on each element of the input sequence if present.
   * @param {Function} [selector] A transform function to apply to each element.
   * @param {Any} [thisArg] Object to use as this when executing callback.
   * @returns {Observable} An observable sequence containing a single element with the average of the sequence of values.
   */
  observableProto.average = function (keySelector, thisArg) {
    var source = this, fn;
    if (isFunction(keySelector)) {
      fn = bindCallback(keySelector, thisArg, 3);
    }
    return new AverageObservable(source, fn);
  };

  /**
   *  Determines whether two sequences are equal by comparing the elements pairwise using a specified equality comparer.
   *
   * @example
   * var res = res = source.sequenceEqual([1,2,3]);
   * var res = res = source.sequenceEqual([{ value: 42 }], function (x, y) { return x.value === y.value; });
   * 3 - res = source.sequenceEqual(Rx.Observable.returnValue(42));
   * 4 - res = source.sequenceEqual(Rx.Observable.returnValue({ value: 42 }), function (x, y) { return x.value === y.value; });
   * @param {Observable} second Second observable sequence or array to compare.
   * @param {Function} [comparer] Comparer used to compare elements of both sequences.
   * @returns {Observable} An observable sequence that contains a single element which indicates whether both sequences are of equal length and their corresponding elements are equal according to the specified equality comparer.
   */
  observableProto.sequenceEqual = function (second, comparer) {
    var first = this;
    comparer || (comparer = defaultComparer);
    return new AnonymousObservable(function (o) {
      var donel = false, doner = false, ql = [], qr = [];
      var subscription1 = first.subscribe(function (x) {
        if (qr.length > 0) {
          var v = qr.shift();
          var equal = tryCatch(comparer)(v, x);
          if (equal === errorObj) { return o.onError(equal.e); }
          if (!equal) {
            o.onNext(false);
            o.onCompleted();
          }
        } else if (doner) {
          o.onNext(false);
          o.onCompleted();
        } else {
          ql.push(x);
        }
      }, function(e) { o.onError(e); }, function () {
        donel = true;
        if (ql.length === 0) {
          if (qr.length > 0) {
            o.onNext(false);
            o.onCompleted();
          } else if (doner) {
            o.onNext(true);
            o.onCompleted();
          }
        }
      });

      (isArrayLike(second) || isIterable(second)) && (second = observableFrom(second));
      isPromise(second) && (second = observableFromPromise(second));
      var subscription2 = second.subscribe(function (x) {
        if (ql.length > 0) {
          var v = ql.shift();
          var equal = tryCatch(comparer)(v, x);
          if (equal === errorObj) { return o.onError(equal.e); }
          if (!equal) {
            o.onNext(false);
            o.onCompleted();
          }
        } else if (donel) {
          o.onNext(false);
          o.onCompleted();
        } else {
          qr.push(x);
        }
      }, function(e) { o.onError(e); }, function () {
        doner = true;
        if (qr.length === 0) {
          if (ql.length > 0) {
            o.onNext(false);
            o.onCompleted();
          } else if (donel) {
            o.onNext(true);
            o.onCompleted();
          }
        }
      });
      return new BinaryDisposable(subscription1, subscription2);
    }, first);
  };

  var ElementAtObservable = (function (__super__) {
    inherits(ElementAtObservable, __super__);
    function ElementAtObservable(source, i, d) {
      this.source = source;
      this._i = i;
      this._d = d;
      __super__.call(this);
    }

    ElementAtObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new ElementAtObserver(o, this._i, this._d));
    };

    return ElementAtObservable;
  }(ObservableBase));

  var ElementAtObserver = (function (__super__) {
    inherits(ElementAtObserver, __super__);

    function ElementAtObserver(o, i, d) {
      this._o = o;
      this._i = i;
      this._d = d;
      __super__.call(this);
    }

    ElementAtObserver.prototype.next = function (x) {
      if (this._i-- === 0) {
        this._o.onNext(x);
        this._o.onCompleted();
      }
    };
    ElementAtObserver.prototype.error = function (e) { this._o.onError(e); };
    ElementAtObserver.prototype.completed = function () {
      if (this._d === undefined) {
        this._o.onError(new ArgumentOutOfRangeError());
      } else {
        this._o.onNext(this._d);
        this._o.onCompleted();
      }
    };

    return ElementAtObserver;
  }(AbstractObserver));

  /**
   * Returns the element at a specified index in a sequence or default value if not found.
   * @param {Number} index The zero-based index of the element to retrieve.
   * @param {Any} [defaultValue] The default value to use if elementAt does not find a value.
   * @returns {Observable} An observable sequence that produces the element at the specified position in the source sequence.
   */
  observableProto.elementAt =  function (index, defaultValue) {
    if (index < 0) { throw new ArgumentOutOfRangeError(); }
    return new ElementAtObservable(this, index, defaultValue);
  };

  var SingleObserver = (function(__super__) {
    inherits(SingleObserver, __super__);
    function SingleObserver(o, obj, s) {
      this._o = o;
      this._obj = obj;
      this._s = s;
      this._i = 0;
      this._hv = false;
      this._v = null;
      __super__.call(this);
    }

    SingleObserver.prototype.next = function (x) {
      var shouldYield = false;
      if (this._obj.predicate) {
        var res = tryCatch(this._obj.predicate)(x, this._i++, this._s);
        if (res === errorObj) { return this._o.onError(res.e); }
        Boolean(res) && (shouldYield = true);
      } else if (!this._obj.predicate) {
        shouldYield = true;
      }
      if (shouldYield) {
        if (this._hv) {
          return this._o.onError(new Error('Sequence contains more than one matching element'));
        }
        this._hv = true;
        this._v = x;
      }
    };
    SingleObserver.prototype.error = function (e) { this._o.onError(e); };
    SingleObserver.prototype.completed = function () {
      if (this._hv) {
        this._o.onNext(this._v);
        this._o.onCompleted();
      }
      else if (this._obj.defaultValue === undefined) {
        this._o.onError(new EmptyError());
      } else {
        this._o.onNext(this._obj.defaultValue);
        this._o.onCompleted();
      }
    };

    return SingleObserver;
  }(AbstractObserver));


    /**
     * Returns the only element of an observable sequence that satisfies the condition in the optional predicate, and reports an exception if there is not exactly one element in the observable sequence.
     * @returns {Observable} Sequence containing the single element in the observable sequence that satisfies the condition in the predicate.
     */
    observableProto.single = function (predicate, thisArg) {
      var obj = {}, source = this;
      if (typeof arguments[0] === 'object') {
        obj = arguments[0];
      } else {
        obj = {
          predicate: arguments[0],
          thisArg: arguments[1],
          defaultValue: arguments[2]
        };
      }
      if (isFunction (obj.predicate)) {
        var fn = obj.predicate;
        obj.predicate = bindCallback(fn, obj.thisArg, 3);
      }
      return new AnonymousObservable(function (o) {
        return source.subscribe(new SingleObserver(o, obj, source));
      }, source);
    };

  var FirstObservable = (function (__super__) {
    inherits(FirstObservable, __super__);
    function FirstObservable(source, obj) {
      this.source = source;
      this._obj = obj;
      __super__.call(this);
    }

    FirstObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new FirstObserver(o, this._obj, this.source));
    };

    return FirstObservable;
  }(ObservableBase));

  var FirstObserver = (function(__super__) {
    inherits(FirstObserver, __super__);
    function FirstObserver(o, obj, s) {
      this._o = o;
      this._obj = obj;
      this._s = s;
      this._i = 0;
      __super__.call(this);
    }

    FirstObserver.prototype.next = function (x) {
      if (this._obj.predicate) {
        var res = tryCatch(this._obj.predicate)(x, this._i++, this._s);
        if (res === errorObj) { return this._o.onError(res.e); }
        if (Boolean(res)) {
          this._o.onNext(x);
          this._o.onCompleted();
        }
      } else if (!this._obj.predicate) {
        this._o.onNext(x);
        this._o.onCompleted();
      }
    };
    FirstObserver.prototype.error = function (e) { this._o.onError(e); };
    FirstObserver.prototype.completed = function () {
      if (this._obj.defaultValue === undefined) {
        this._o.onError(new EmptyError());
      } else {
        this._o.onNext(this._obj.defaultValue);
        this._o.onCompleted();
      }
    };

    return FirstObserver;
  }(AbstractObserver));

  /**
   * Returns the first element of an observable sequence that satisfies the condition in the predicate if present else the first item in the sequence.
   * @returns {Observable} Sequence containing the first element in the observable sequence that satisfies the condition in the predicate if provided, else the first item in the sequence.
   */
  observableProto.first = function () {
    var obj = {}, source = this;
    if (typeof arguments[0] === 'object') {
      obj = arguments[0];
    } else {
      obj = {
        predicate: arguments[0],
        thisArg: arguments[1],
        defaultValue: arguments[2]
      };
    }
    if (isFunction (obj.predicate)) {
      var fn = obj.predicate;
      obj.predicate = bindCallback(fn, obj.thisArg, 3);
    }
    return new FirstObservable(this, obj);
  };

  var LastObservable = (function (__super__) {
    inherits(LastObservable, __super__);
    function LastObservable(source, obj) {
      this.source = source;
      this._obj = obj;
      __super__.call(this);
    }

    LastObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new LastObserver(o, this._obj, this.source));
    };

    return LastObservable;
  }(ObservableBase));

  var LastObserver = (function(__super__) {
    inherits(LastObserver, __super__);
    function LastObserver(o, obj, s) {
      this._o = o;
      this._obj = obj;
      this._s = s;
      this._i = 0;
      this._hv = false;
      this._v = null;
      __super__.call(this);
    }

    LastObserver.prototype.next = function (x) {
      var shouldYield = false;
      if (this._obj.predicate) {
        var res = tryCatch(this._obj.predicate)(x, this._i++, this._s);
        if (res === errorObj) { return this._o.onError(res.e); }
        Boolean(res) && (shouldYield = true);
      } else if (!this._obj.predicate) {
        shouldYield = true;
      }
      if (shouldYield) {
        this._hv = true;
        this._v = x;
      }
    };
    LastObserver.prototype.error = function (e) { this._o.onError(e); };
    LastObserver.prototype.completed = function () {
      if (this._hv) {
        this._o.onNext(this._v);
        this._o.onCompleted();
      }
      else if (this._obj.defaultValue === undefined) {
        this._o.onError(new EmptyError());
      } else {
        this._o.onNext(this._obj.defaultValue);
        this._o.onCompleted();
      }
    };

    return LastObserver;
  }(AbstractObserver));

  /**
   * Returns the last element of an observable sequence that satisfies the condition in the predicate if specified, else the last element.
   * @returns {Observable} Sequence containing the last element in the observable sequence that satisfies the condition in the predicate.
   */
  observableProto.last = function () {
    var obj = {}, source = this;
    if (typeof arguments[0] === 'object') {
      obj = arguments[0];
    } else {
      obj = {
        predicate: arguments[0],
        thisArg: arguments[1],
        defaultValue: arguments[2]
      };
    }
    if (isFunction (obj.predicate)) {
      var fn = obj.predicate;
      obj.predicate = bindCallback(fn, obj.thisArg, 3);
    }
    return new LastObservable(this, obj);
  };

  var FindValueObserver = (function(__super__) {
    inherits(FindValueObserver, __super__);
    function FindValueObserver(observer, source, callback, yieldIndex) {
      this._o = observer;
      this._s = source;
      this._cb = callback;
      this._y = yieldIndex;
      this._i = 0;
      __super__.call(this);
    }

    FindValueObserver.prototype.next = function (x) {
      var shouldRun = tryCatch(this._cb)(x, this._i, this._s);
      if (shouldRun === errorObj) { return this._o.onError(shouldRun.e); }
      if (shouldRun) {
        this._o.onNext(this._y ? this._i : x);
        this._o.onCompleted();
      } else {
        this._i++;
      }
    };

    FindValueObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    FindValueObserver.prototype.completed = function () {
      this._y && this._o.onNext(-1);
      this._o.onCompleted();
    };

    return FindValueObserver;
  }(AbstractObserver));

  function findValue (source, predicate, thisArg, yieldIndex) {
    var callback = bindCallback(predicate, thisArg, 3);
    return new AnonymousObservable(function (o) {
      return source.subscribe(new FindValueObserver(o, source, callback, yieldIndex));
    }, source);
  }

  /**
   * Searches for an element that matches the conditions defined by the specified predicate, and returns the first occurrence within the entire Observable sequence.
   * @param {Function} predicate The predicate that defines the conditions of the element to search for.
   * @param {Any} [thisArg] Object to use as `this` when executing the predicate.
   * @returns {Observable} An Observable sequence with the first element that matches the conditions defined by the specified predicate, if found; otherwise, undefined.
   */
  observableProto.find = function (predicate, thisArg) {
    return findValue(this, predicate, thisArg, false);
  };

  /**
   * Searches for an element that matches the conditions defined by the specified predicate, and returns
   * an Observable sequence with the zero-based index of the first occurrence within the entire Observable sequence.
   * @param {Function} predicate The predicate that defines the conditions of the element to search for.
   * @param {Any} [thisArg] Object to use as `this` when executing the predicate.
   * @returns {Observable} An Observable sequence with the zero-based index of the first occurrence of an element that matches the conditions defined by match, if found; otherwise, –1.
  */
  observableProto.findIndex = function (predicate, thisArg) {
    return findValue(this, predicate, thisArg, true);
  };

  var ToSetObservable = (function (__super__) {
    inherits(ToSetObservable, __super__);
    function ToSetObservable(source) {
      this.source = source;
      __super__.call(this);
    }

    ToSetObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new ToSetObserver(o));
    };

    return ToSetObservable;
  }(ObservableBase));

  var ToSetObserver = (function (__super__) {
    inherits(ToSetObserver, __super__);
    function ToSetObserver(o) {
      this._o = o;
      this._s = new root.Set();
      __super__.call(this);
    }

    ToSetObserver.prototype.next = function (x) {
      this._s.add(x);
    };

    ToSetObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    ToSetObserver.prototype.completed = function () {
      this._o.onNext(this._s);
      this._o.onCompleted();
    };

    return ToSetObserver;
  }(AbstractObserver));

  /**
   * Converts the observable sequence to a Set if it exists.
   * @returns {Observable} An observable sequence with a single value of a Set containing the values from the observable sequence.
   */
  observableProto.toSet = function () {
    if (typeof root.Set === 'undefined') { throw new TypeError(); }
    return new ToSetObservable(this);
  };

  var ToMapObservable = (function (__super__) {
    inherits(ToMapObservable, __super__);
    function ToMapObservable(source, k, e) {
      this.source = source;
      this._k = k;
      this._e = e;
      __super__.call(this);
    }

    ToMapObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new ToMapObserver(o, this._k, this._e));
    };

    return ToMapObservable;
  }(ObservableBase));

  var ToMapObserver = (function (__super__) {
    inherits(ToMapObserver, __super__);
    function ToMapObserver(o, k, e) {
      this._o = o;
      this._k = k;
      this._e = e;
      this._m = new root.Map();
      __super__.call(this);
    }

    ToMapObserver.prototype.next = function (x) {
      var key = tryCatch(this._k)(x);
      if (key === errorObj) { return this._o.onError(key.e); }
      var elem = x;
      if (this._e) {
        elem = tryCatch(this._e)(x);
        if (elem === errorObj) { return this._o.onError(elem.e); }
      }

      this._m.set(key, elem);
    };

    ToMapObserver.prototype.error = function (e) {
      this._o.onError(e);
    };

    ToMapObserver.prototype.completed = function () {
      this._o.onNext(this._m);
      this._o.onCompleted();
    };

    return ToMapObserver;
  }(AbstractObserver));

  /**
  * Converts the observable sequence to a Map if it exists.
  * @param {Function} keySelector A function which produces the key for the Map.
  * @param {Function} [elementSelector] An optional function which produces the element for the Map. If not present, defaults to the value from the observable sequence.
  * @returns {Observable} An observable sequence with a single value of a Map containing the values from the observable sequence.
  */
  observableProto.toMap = function (keySelector, elementSelector) {
    if (typeof root.Map === 'undefined') { throw new TypeError(); }
    return new ToMapObservable(this, keySelector, elementSelector);
  };

  var SliceObservable = (function (__super__) {
    inherits(SliceObservable, __super__);
    function SliceObservable(source, b, e) {
      this.source = source;
      this._b = b;
      this._e = e;
      __super__.call(this);
    }

    SliceObservable.prototype.subscribeCore = function (o) {
      return this.source.subscribe(new SliceObserver(o, this._b, this._e));
    };

    return SliceObservable;
  }(ObservableBase));

  var SliceObserver = (function (__super__) {
    inherits(SliceObserver, __super__);

    function SliceObserver(o, b, e) {
      this._o = o;
      this._b = b;
      this._e = e;
      this._i = 0;
      __super__.call(this);
    }

    SliceObserver.prototype.next = function (x) {
      if (this._i >= this._b) {
        if (this._e === this._i) {
          this._o.onCompleted();
        } else {
          this._o.onNext(x);
        }
      }
      this._i++;
    };
    SliceObserver.prototype.error = function (e) { this._o.onError(e); };
    SliceObserver.prototype.completed = function () { this._o.onCompleted(); };

    return SliceObserver;
  }(AbstractObserver));

  /*
  * The slice() method returns a shallow copy of a portion of an Observable into a new Observable object.
  * Unlike the array version, this does not support negative numbers for being or end.
  * @param {Number} [begin] Zero-based index at which to begin extraction. If omitted, this will default to zero.
  * @param {Number} [end] Zero-based index at which to end extraction. slice extracts up to but not including end.
  * If omitted, this will emit the rest of the Observable object.
  * @returns {Observable} A shallow copy of a portion of an Observable into a new Observable object.
  */
  observableProto.slice = function (begin, end) {
    var start = begin || 0;
    if (start < 0) { throw new Rx.ArgumentOutOfRangeError(); }
    if (typeof end === 'number' && end < start) {
      throw new Rx.ArgumentOutOfRangeError();
    }
    return new SliceObservable(this, start, end);
  };

  var LastIndexOfObservable = (function (__super__) {
    inherits(LastIndexOfObservable, __super__);
    function LastIndexOfObservable(source, e, n) {
      this.source = source;
      this._e = e;
      this._n = n;
      __super__.call(this);
    }

    LastIndexOfObservable.prototype.subscribeCore = function (o) {
      if (this._n < 0) {
        o.onNext(-1);
        o.onCompleted();
        return disposableEmpty;
      }

      return this.source.subscribe(new LastIndexOfObserver(o, this._e, this._n));
    };

    return LastIndexOfObservable;
  }(ObservableBase));

  var LastIndexOfObserver = (function (__super__) {
    inherits(LastIndexOfObserver, __super__);
    function LastIndexOfObserver(o, e, n) {
      this._o = o;
      this._e = e;
      this._n = n;
      this._v = 0;
      this._hv = false;
      this._i = 0;
      __super__.call(this);
    }

    LastIndexOfObserver.prototype.next = function (x) {
      if (this._i >= this._n && x === this._e) {
        this._hv = true;
        this._v = this._i;
      }
      this._i++;
    };
    LastIndexOfObserver.prototype.error = function (e) { this._o.onError(e); };
    LastIndexOfObserver.prototype.completed = function () {
      if (this._hv) {
        this._o.onNext(this._v);
      } else {
        this._o.onNext(-1);
      }
      this._o.onCompleted();
    };

    return LastIndexOfObserver;
  }(AbstractObserver));

  /**
   * Returns the last index at which a given element can be found in the observable sequence, or -1 if it is not present.
   * @param {Any} searchElement Element to locate in the array.
   * @param {Number} [fromIndex] The index to start the search.  If not specified, defaults to 0.
   * @returns {Observable} And observable sequence containing the last index at which a given element can be found in the observable sequence, or -1 if it is not present.
   */
  observableProto.lastIndexOf = function(searchElement, fromIndex) {
    var n = +fromIndex || 0;
    Math.abs(n) === Infinity && (n = 0);
    return new LastIndexOfObservable(this, searchElement, n);
  };

  return Rx;
}));
});

var index = __commonjs(function (module) {
var Rx = require$$0;












module.exports = Rx;
});

var Rx = (index && typeof index === 'object' && 'default' in index ? index['default'] : index);

var ramda = __commonjs(function (module, exports, global) {
//  Ramda v0.21.0
//  https://github.com/ramda/ramda
//  (c) 2013-2016 Scott Sauyet, Michael Hurley, and David Chambers
//  Ramda may be freely distributed under the MIT license.

;(function() {

  'use strict';

  /**
     * A special placeholder value used to specify "gaps" within curried functions,
     * allowing partial application of any combination of arguments, regardless of
     * their positions.
     *
     * If `g` is a curried ternary function and `_` is `R.__`, the following are
     * equivalent:
     *
     *   - `g(1, 2, 3)`
     *   - `g(_, 2, 3)(1)`
     *   - `g(_, _, 3)(1)(2)`
     *   - `g(_, _, 3)(1, 2)`
     *   - `g(_, 2, _)(1, 3)`
     *   - `g(_, 2)(1)(3)`
     *   - `g(_, 2)(1, 3)`
     *   - `g(_, 2)(_, 3)(1)`
     *
     * @constant
     * @memberOf R
     * @since v0.6.0
     * @category Function
     * @example
     *
     *      var greet = R.replace('{name}', R.__, 'Hello, {name}!');
     *      greet('Alice'); //=> 'Hello, Alice!'
     */
    var __ = { '@@functional/placeholder': true };

    /* eslint-disable no-unused-vars */
    var _arity = function _arity(n, fn) {
        /* eslint-disable no-unused-vars */
        switch (n) {
        case 0:
            return function () {
                return fn.apply(this, arguments);
            };
        case 1:
            return function (a0) {
                return fn.apply(this, arguments);
            };
        case 2:
            return function (a0, a1) {
                return fn.apply(this, arguments);
            };
        case 3:
            return function (a0, a1, a2) {
                return fn.apply(this, arguments);
            };
        case 4:
            return function (a0, a1, a2, a3) {
                return fn.apply(this, arguments);
            };
        case 5:
            return function (a0, a1, a2, a3, a4) {
                return fn.apply(this, arguments);
            };
        case 6:
            return function (a0, a1, a2, a3, a4, a5) {
                return fn.apply(this, arguments);
            };
        case 7:
            return function (a0, a1, a2, a3, a4, a5, a6) {
                return fn.apply(this, arguments);
            };
        case 8:
            return function (a0, a1, a2, a3, a4, a5, a6, a7) {
                return fn.apply(this, arguments);
            };
        case 9:
            return function (a0, a1, a2, a3, a4, a5, a6, a7, a8) {
                return fn.apply(this, arguments);
            };
        case 10:
            return function (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
                return fn.apply(this, arguments);
            };
        default:
            throw new Error('First argument to _arity must be a non-negative integer no greater than ten');
        }
    };

    var _arrayFromIterator = function _arrayFromIterator(iter) {
        var list = [];
        var next;
        while (!(next = iter.next()).done) {
            list.push(next.value);
        }
        return list;
    };

    var _arrayOf = function _arrayOf() {
        return Array.prototype.slice.call(arguments);
    };

    var _cloneRegExp = function _cloneRegExp(pattern) {
        return new RegExp(pattern.source, (pattern.global ? 'g' : '') + (pattern.ignoreCase ? 'i' : '') + (pattern.multiline ? 'm' : '') + (pattern.sticky ? 'y' : '') + (pattern.unicode ? 'u' : ''));
    };

    var _complement = function _complement(f) {
        return function () {
            return !f.apply(this, arguments);
        };
    };

    /**
     * Private `concat` function to merge two array-like objects.
     *
     * @private
     * @param {Array|Arguments} [set1=[]] An array-like object.
     * @param {Array|Arguments} [set2=[]] An array-like object.
     * @return {Array} A new, merged array.
     * @example
     *
     *      _concat([4, 5, 6], [1, 2, 3]); //=> [4, 5, 6, 1, 2, 3]
     */
    var _concat = function _concat(set1, set2) {
        set1 = set1 || [];
        set2 = set2 || [];
        var idx;
        var len1 = set1.length;
        var len2 = set2.length;
        var result = [];
        idx = 0;
        while (idx < len1) {
            result[result.length] = set1[idx];
            idx += 1;
        }
        idx = 0;
        while (idx < len2) {
            result[result.length] = set2[idx];
            idx += 1;
        }
        return result;
    };

    var _containsWith = function _containsWith(pred, x, list) {
        var idx = 0;
        var len = list.length;
        while (idx < len) {
            if (pred(x, list[idx])) {
                return true;
            }
            idx += 1;
        }
        return false;
    };

    var _filter = function _filter(fn, list) {
        var idx = 0;
        var len = list.length;
        var result = [];
        while (idx < len) {
            if (fn(list[idx])) {
                result[result.length] = list[idx];
            }
            idx += 1;
        }
        return result;
    };

    var _forceReduced = function _forceReduced(x) {
        return {
            '@@transducer/value': x,
            '@@transducer/reduced': true
        };
    };

    // String(x => x) evaluates to "x => x", so the pattern may not match.
    var _functionName = function _functionName(f) {
        // String(x => x) evaluates to "x => x", so the pattern may not match.
        var match = String(f).match(/^function (\w*)/);
        return match == null ? '' : match[1];
    };

    var _has = function _has(prop, obj) {
        return Object.prototype.hasOwnProperty.call(obj, prop);
    };

    var _identity = function _identity(x) {
        return x;
    };

    var _isArguments = function () {
        var toString = Object.prototype.toString;
        return toString.call(arguments) === '[object Arguments]' ? function _isArguments(x) {
            return toString.call(x) === '[object Arguments]';
        } : function _isArguments(x) {
            return _has('callee', x);
        };
    }();

    /**
     * Tests whether or not an object is an array.
     *
     * @private
     * @param {*} val The object to test.
     * @return {Boolean} `true` if `val` is an array, `false` otherwise.
     * @example
     *
     *      _isArray([]); //=> true
     *      _isArray(null); //=> false
     *      _isArray({}); //=> false
     */
    var _isArray = Array.isArray || function _isArray(val) {
        return val != null && val.length >= 0 && Object.prototype.toString.call(val) === '[object Array]';
    };

    var _isFunction = function _isNumber(x) {
        return Object.prototype.toString.call(x) === '[object Function]';
    };

    /**
     * Determine if the passed argument is an integer.
     *
     * @private
     * @param {*} n
     * @category Type
     * @return {Boolean}
     */
    var _isInteger = Number.isInteger || function _isInteger(n) {
        return n << 0 === n;
    };

    var _isNumber = function _isNumber(x) {
        return Object.prototype.toString.call(x) === '[object Number]';
    };

    var _isObject = function _isObject(x) {
        return Object.prototype.toString.call(x) === '[object Object]';
    };

    var _isPlaceholder = function _isPlaceholder(a) {
        return a != null && typeof a === 'object' && a['@@functional/placeholder'] === true;
    };

    var _isRegExp = function _isRegExp(x) {
        return Object.prototype.toString.call(x) === '[object RegExp]';
    };

    var _isString = function _isString(x) {
        return Object.prototype.toString.call(x) === '[object String]';
    };

    var _isTransformer = function _isTransformer(obj) {
        return typeof obj['@@transducer/step'] === 'function';
    };

    var _map = function _map(fn, functor) {
        var idx = 0;
        var len = functor.length;
        var result = Array(len);
        while (idx < len) {
            result[idx] = fn(functor[idx]);
            idx += 1;
        }
        return result;
    };

    // Based on https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
    var _objectAssign = function _objectAssign(target) {
        if (target == null) {
            throw new TypeError('Cannot convert undefined or null to object');
        }
        var output = Object(target);
        var idx = 1;
        var length = arguments.length;
        while (idx < length) {
            var source = arguments[idx];
            if (source != null) {
                for (var nextKey in source) {
                    if (_has(nextKey, source)) {
                        output[nextKey] = source[nextKey];
                    }
                }
            }
            idx += 1;
        }
        return output;
    };

    var _of = function _of(x) {
        return [x];
    };

    var _pipe = function _pipe(f, g) {
        return function () {
            return g.call(this, f.apply(this, arguments));
        };
    };

    var _pipeP = function _pipeP(f, g) {
        return function () {
            var ctx = this;
            return f.apply(ctx, arguments).then(function (x) {
                return g.call(ctx, x);
            });
        };
    };

    // \b matches word boundary; [\b] matches backspace
    var _quote = function _quote(s) {
        var escaped = s.replace(/\\/g, '\\\\').replace(/[\b]/g, '\\b')    // \b matches word boundary; [\b] matches backspace
    .replace(/\f/g, '\\f').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\v/g, '\\v').replace(/\0/g, '\\0');
        return '"' + escaped.replace(/"/g, '\\"') + '"';
    };

    var _reduced = function _reduced(x) {
        return x && x['@@transducer/reduced'] ? x : {
            '@@transducer/value': x,
            '@@transducer/reduced': true
        };
    };

    /**
     * An optimized, private array `slice` implementation.
     *
     * @private
     * @param {Arguments|Array} args The array or arguments object to consider.
     * @param {Number} [from=0] The array index to slice from, inclusive.
     * @param {Number} [to=args.length] The array index to slice to, exclusive.
     * @return {Array} A new, sliced array.
     * @example
     *
     *      _slice([1, 2, 3, 4, 5], 1, 3); //=> [2, 3]
     *
     *      var firstThreeArgs = function(a, b, c, d) {
     *        return _slice(arguments, 0, 3);
     *      };
     *      firstThreeArgs(1, 2, 3, 4); //=> [1, 2, 3]
     */
    var _slice = function _slice(args, from, to) {
        switch (arguments.length) {
        case 1:
            return _slice(args, 0, args.length);
        case 2:
            return _slice(args, from, args.length);
        default:
            var list = [];
            var idx = 0;
            var len = Math.max(0, Math.min(args.length, to) - from);
            while (idx < len) {
                list[idx] = args[from + idx];
                idx += 1;
            }
            return list;
        }
    };

    /**
     * Polyfill from <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString>.
     */
    var _toISOString = function () {
        var pad = function pad(n) {
            return (n < 10 ? '0' : '') + n;
        };
        return typeof Date.prototype.toISOString === 'function' ? function _toISOString(d) {
            return d.toISOString();
        } : function _toISOString(d) {
            return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + '.' + (d.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) + 'Z';
        };
    }();

    var _xfBase = {
        init: function () {
            return this.xf['@@transducer/init']();
        },
        result: function (result) {
            return this.xf['@@transducer/result'](result);
        }
    };

    var _xwrap = function () {
        function XWrap(fn) {
            this.f = fn;
        }
        XWrap.prototype['@@transducer/init'] = function () {
            throw new Error('init not implemented on XWrap');
        };
        XWrap.prototype['@@transducer/result'] = function (acc) {
            return acc;
        };
        XWrap.prototype['@@transducer/step'] = function (acc, x) {
            return this.f(acc, x);
        };
        return function _xwrap(fn) {
            return new XWrap(fn);
        };
    }();

    var _aperture = function _aperture(n, list) {
        var idx = 0;
        var limit = list.length - (n - 1);
        var acc = new Array(limit >= 0 ? limit : 0);
        while (idx < limit) {
            acc[idx] = _slice(list, idx, idx + n);
            idx += 1;
        }
        return acc;
    };

    var _assign = typeof Object.assign === 'function' ? Object.assign : _objectAssign;

    /**
     * Similar to hasMethod, this checks whether a function has a [methodname]
     * function. If it isn't an array it will execute that function otherwise it
     * will default to the ramda implementation.
     *
     * @private
     * @param {Function} fn ramda implemtation
     * @param {String} methodname property to check for a custom implementation
     * @return {Object} Whatever the return value of the method is.
     */
    var _checkForMethod = function _checkForMethod(methodname, fn) {
        return function () {
            var length = arguments.length;
            if (length === 0) {
                return fn();
            }
            var obj = arguments[length - 1];
            return _isArray(obj) || typeof obj[methodname] !== 'function' ? fn.apply(this, arguments) : obj[methodname].apply(obj, _slice(arguments, 0, length - 1));
        };
    };

    /**
     * Optimized internal one-arity curry function.
     *
     * @private
     * @category Function
     * @param {Function} fn The function to curry.
     * @return {Function} The curried function.
     */
    var _curry1 = function _curry1(fn) {
        return function f1(a) {
            if (arguments.length === 0 || _isPlaceholder(a)) {
                return f1;
            } else {
                return fn.apply(this, arguments);
            }
        };
    };

    /**
     * Optimized internal two-arity curry function.
     *
     * @private
     * @category Function
     * @param {Function} fn The function to curry.
     * @return {Function} The curried function.
     */
    var _curry2 = function _curry2(fn) {
        return function f2(a, b) {
            switch (arguments.length) {
            case 0:
                return f2;
            case 1:
                return _isPlaceholder(a) ? f2 : _curry1(function (_b) {
                    return fn(a, _b);
                });
            default:
                return _isPlaceholder(a) && _isPlaceholder(b) ? f2 : _isPlaceholder(a) ? _curry1(function (_a) {
                    return fn(_a, b);
                }) : _isPlaceholder(b) ? _curry1(function (_b) {
                    return fn(a, _b);
                }) : fn(a, b);
            }
        };
    };

    /**
     * Optimized internal three-arity curry function.
     *
     * @private
     * @category Function
     * @param {Function} fn The function to curry.
     * @return {Function} The curried function.
     */
    var _curry3 = function _curry3(fn) {
        return function f3(a, b, c) {
            switch (arguments.length) {
            case 0:
                return f3;
            case 1:
                return _isPlaceholder(a) ? f3 : _curry2(function (_b, _c) {
                    return fn(a, _b, _c);
                });
            case 2:
                return _isPlaceholder(a) && _isPlaceholder(b) ? f3 : _isPlaceholder(a) ? _curry2(function (_a, _c) {
                    return fn(_a, b, _c);
                }) : _isPlaceholder(b) ? _curry2(function (_b, _c) {
                    return fn(a, _b, _c);
                }) : _curry1(function (_c) {
                    return fn(a, b, _c);
                });
            default:
                return _isPlaceholder(a) && _isPlaceholder(b) && _isPlaceholder(c) ? f3 : _isPlaceholder(a) && _isPlaceholder(b) ? _curry2(function (_a, _b) {
                    return fn(_a, _b, c);
                }) : _isPlaceholder(a) && _isPlaceholder(c) ? _curry2(function (_a, _c) {
                    return fn(_a, b, _c);
                }) : _isPlaceholder(b) && _isPlaceholder(c) ? _curry2(function (_b, _c) {
                    return fn(a, _b, _c);
                }) : _isPlaceholder(a) ? _curry1(function (_a) {
                    return fn(_a, b, c);
                }) : _isPlaceholder(b) ? _curry1(function (_b) {
                    return fn(a, _b, c);
                }) : _isPlaceholder(c) ? _curry1(function (_c) {
                    return fn(a, b, _c);
                }) : fn(a, b, c);
            }
        };
    };

    /**
     * Internal curryN function.
     *
     * @private
     * @category Function
     * @param {Number} length The arity of the curried function.
     * @param {Array} received An array of arguments received thus far.
     * @param {Function} fn The function to curry.
     * @return {Function} The curried function.
     */
    var _curryN = function _curryN(length, received, fn) {
        return function () {
            var combined = [];
            var argsIdx = 0;
            var left = length;
            var combinedIdx = 0;
            while (combinedIdx < received.length || argsIdx < arguments.length) {
                var result;
                if (combinedIdx < received.length && (!_isPlaceholder(received[combinedIdx]) || argsIdx >= arguments.length)) {
                    result = received[combinedIdx];
                } else {
                    result = arguments[argsIdx];
                    argsIdx += 1;
                }
                combined[combinedIdx] = result;
                if (!_isPlaceholder(result)) {
                    left -= 1;
                }
                combinedIdx += 1;
            }
            return left <= 0 ? fn.apply(this, combined) : _arity(left, _curryN(length, combined, fn));
        };
    };

    /**
     * Returns a function that dispatches with different strategies based on the
     * object in list position (last argument). If it is an array, executes [fn].
     * Otherwise, if it has a function with [methodname], it will execute that
     * function (functor case). Otherwise, if it is a transformer, uses transducer
     * [xf] to return a new transformer (transducer case). Otherwise, it will
     * default to executing [fn].
     *
     * @private
     * @param {String} methodname property to check for a custom implementation
     * @param {Function} xf transducer to initialize if object is transformer
     * @param {Function} fn default ramda implementation
     * @return {Function} A function that dispatches on object in list position
     */
    var _dispatchable = function _dispatchable(methodname, xf, fn) {
        return function () {
            var length = arguments.length;
            if (length === 0) {
                return fn();
            }
            var obj = arguments[length - 1];
            if (!_isArray(obj)) {
                var args = _slice(arguments, 0, length - 1);
                if (typeof obj[methodname] === 'function') {
                    return obj[methodname].apply(obj, args);
                }
                if (_isTransformer(obj)) {
                    var transducer = xf.apply(null, args);
                    return transducer(obj);
                }
            }
            return fn.apply(this, arguments);
        };
    };

    var _dropLastWhile = function dropLastWhile(pred, list) {
        var idx = list.length - 1;
        while (idx >= 0 && pred(list[idx])) {
            idx -= 1;
        }
        return _slice(list, 0, idx + 1);
    };

    var _xall = function () {
        function XAll(f, xf) {
            this.xf = xf;
            this.f = f;
            this.all = true;
        }
        XAll.prototype['@@transducer/init'] = _xfBase.init;
        XAll.prototype['@@transducer/result'] = function (result) {
            if (this.all) {
                result = this.xf['@@transducer/step'](result, true);
            }
            return this.xf['@@transducer/result'](result);
        };
        XAll.prototype['@@transducer/step'] = function (result, input) {
            if (!this.f(input)) {
                this.all = false;
                result = _reduced(this.xf['@@transducer/step'](result, false));
            }
            return result;
        };
        return _curry2(function _xall(f, xf) {
            return new XAll(f, xf);
        });
    }();

    var _xany = function () {
        function XAny(f, xf) {
            this.xf = xf;
            this.f = f;
            this.any = false;
        }
        XAny.prototype['@@transducer/init'] = _xfBase.init;
        XAny.prototype['@@transducer/result'] = function (result) {
            if (!this.any) {
                result = this.xf['@@transducer/step'](result, false);
            }
            return this.xf['@@transducer/result'](result);
        };
        XAny.prototype['@@transducer/step'] = function (result, input) {
            if (this.f(input)) {
                this.any = true;
                result = _reduced(this.xf['@@transducer/step'](result, true));
            }
            return result;
        };
        return _curry2(function _xany(f, xf) {
            return new XAny(f, xf);
        });
    }();

    var _xaperture = function () {
        function XAperture(n, xf) {
            this.xf = xf;
            this.pos = 0;
            this.full = false;
            this.acc = new Array(n);
        }
        XAperture.prototype['@@transducer/init'] = _xfBase.init;
        XAperture.prototype['@@transducer/result'] = function (result) {
            this.acc = null;
            return this.xf['@@transducer/result'](result);
        };
        XAperture.prototype['@@transducer/step'] = function (result, input) {
            this.store(input);
            return this.full ? this.xf['@@transducer/step'](result, this.getCopy()) : result;
        };
        XAperture.prototype.store = function (input) {
            this.acc[this.pos] = input;
            this.pos += 1;
            if (this.pos === this.acc.length) {
                this.pos = 0;
                this.full = true;
            }
        };
        XAperture.prototype.getCopy = function () {
            return _concat(_slice(this.acc, this.pos), _slice(this.acc, 0, this.pos));
        };
        return _curry2(function _xaperture(n, xf) {
            return new XAperture(n, xf);
        });
    }();

    var _xdrop = function () {
        function XDrop(n, xf) {
            this.xf = xf;
            this.n = n;
        }
        XDrop.prototype['@@transducer/init'] = _xfBase.init;
        XDrop.prototype['@@transducer/result'] = _xfBase.result;
        XDrop.prototype['@@transducer/step'] = function (result, input) {
            if (this.n > 0) {
                this.n -= 1;
                return result;
            }
            return this.xf['@@transducer/step'](result, input);
        };
        return _curry2(function _xdrop(n, xf) {
            return new XDrop(n, xf);
        });
    }();

    var _xdropLast = function () {
        function XDropLast(n, xf) {
            this.xf = xf;
            this.pos = 0;
            this.full = false;
            this.acc = new Array(n);
        }
        XDropLast.prototype['@@transducer/init'] = _xfBase.init;
        XDropLast.prototype['@@transducer/result'] = function (result) {
            this.acc = null;
            return this.xf['@@transducer/result'](result);
        };
        XDropLast.prototype['@@transducer/step'] = function (result, input) {
            if (this.full) {
                result = this.xf['@@transducer/step'](result, this.acc[this.pos]);
            }
            this.store(input);
            return result;
        };
        XDropLast.prototype.store = function (input) {
            this.acc[this.pos] = input;
            this.pos += 1;
            if (this.pos === this.acc.length) {
                this.pos = 0;
                this.full = true;
            }
        };
        return _curry2(function _xdropLast(n, xf) {
            return new XDropLast(n, xf);
        });
    }();

    var _xdropRepeatsWith = function () {
        function XDropRepeatsWith(pred, xf) {
            this.xf = xf;
            this.pred = pred;
            this.lastValue = undefined;
            this.seenFirstValue = false;
        }
        XDropRepeatsWith.prototype['@@transducer/init'] = function () {
            return this.xf['@@transducer/init']();
        };
        XDropRepeatsWith.prototype['@@transducer/result'] = function (result) {
            return this.xf['@@transducer/result'](result);
        };
        XDropRepeatsWith.prototype['@@transducer/step'] = function (result, input) {
            var sameAsLast = false;
            if (!this.seenFirstValue) {
                this.seenFirstValue = true;
            } else if (this.pred(this.lastValue, input)) {
                sameAsLast = true;
            }
            this.lastValue = input;
            return sameAsLast ? result : this.xf['@@transducer/step'](result, input);
        };
        return _curry2(function _xdropRepeatsWith(pred, xf) {
            return new XDropRepeatsWith(pred, xf);
        });
    }();

    var _xdropWhile = function () {
        function XDropWhile(f, xf) {
            this.xf = xf;
            this.f = f;
        }
        XDropWhile.prototype['@@transducer/init'] = _xfBase.init;
        XDropWhile.prototype['@@transducer/result'] = _xfBase.result;
        XDropWhile.prototype['@@transducer/step'] = function (result, input) {
            if (this.f) {
                if (this.f(input)) {
                    return result;
                }
                this.f = null;
            }
            return this.xf['@@transducer/step'](result, input);
        };
        return _curry2(function _xdropWhile(f, xf) {
            return new XDropWhile(f, xf);
        });
    }();

    var _xfilter = function () {
        function XFilter(f, xf) {
            this.xf = xf;
            this.f = f;
        }
        XFilter.prototype['@@transducer/init'] = _xfBase.init;
        XFilter.prototype['@@transducer/result'] = _xfBase.result;
        XFilter.prototype['@@transducer/step'] = function (result, input) {
            return this.f(input) ? this.xf['@@transducer/step'](result, input) : result;
        };
        return _curry2(function _xfilter(f, xf) {
            return new XFilter(f, xf);
        });
    }();

    var _xfind = function () {
        function XFind(f, xf) {
            this.xf = xf;
            this.f = f;
            this.found = false;
        }
        XFind.prototype['@@transducer/init'] = _xfBase.init;
        XFind.prototype['@@transducer/result'] = function (result) {
            if (!this.found) {
                result = this.xf['@@transducer/step'](result, void 0);
            }
            return this.xf['@@transducer/result'](result);
        };
        XFind.prototype['@@transducer/step'] = function (result, input) {
            if (this.f(input)) {
                this.found = true;
                result = _reduced(this.xf['@@transducer/step'](result, input));
            }
            return result;
        };
        return _curry2(function _xfind(f, xf) {
            return new XFind(f, xf);
        });
    }();

    var _xfindIndex = function () {
        function XFindIndex(f, xf) {
            this.xf = xf;
            this.f = f;
            this.idx = -1;
            this.found = false;
        }
        XFindIndex.prototype['@@transducer/init'] = _xfBase.init;
        XFindIndex.prototype['@@transducer/result'] = function (result) {
            if (!this.found) {
                result = this.xf['@@transducer/step'](result, -1);
            }
            return this.xf['@@transducer/result'](result);
        };
        XFindIndex.prototype['@@transducer/step'] = function (result, input) {
            this.idx += 1;
            if (this.f(input)) {
                this.found = true;
                result = _reduced(this.xf['@@transducer/step'](result, this.idx));
            }
            return result;
        };
        return _curry2(function _xfindIndex(f, xf) {
            return new XFindIndex(f, xf);
        });
    }();

    var _xfindLast = function () {
        function XFindLast(f, xf) {
            this.xf = xf;
            this.f = f;
        }
        XFindLast.prototype['@@transducer/init'] = _xfBase.init;
        XFindLast.prototype['@@transducer/result'] = function (result) {
            return this.xf['@@transducer/result'](this.xf['@@transducer/step'](result, this.last));
        };
        XFindLast.prototype['@@transducer/step'] = function (result, input) {
            if (this.f(input)) {
                this.last = input;
            }
            return result;
        };
        return _curry2(function _xfindLast(f, xf) {
            return new XFindLast(f, xf);
        });
    }();

    var _xfindLastIndex = function () {
        function XFindLastIndex(f, xf) {
            this.xf = xf;
            this.f = f;
            this.idx = -1;
            this.lastIdx = -1;
        }
        XFindLastIndex.prototype['@@transducer/init'] = _xfBase.init;
        XFindLastIndex.prototype['@@transducer/result'] = function (result) {
            return this.xf['@@transducer/result'](this.xf['@@transducer/step'](result, this.lastIdx));
        };
        XFindLastIndex.prototype['@@transducer/step'] = function (result, input) {
            this.idx += 1;
            if (this.f(input)) {
                this.lastIdx = this.idx;
            }
            return result;
        };
        return _curry2(function _xfindLastIndex(f, xf) {
            return new XFindLastIndex(f, xf);
        });
    }();

    var _xmap = function () {
        function XMap(f, xf) {
            this.xf = xf;
            this.f = f;
        }
        XMap.prototype['@@transducer/init'] = _xfBase.init;
        XMap.prototype['@@transducer/result'] = _xfBase.result;
        XMap.prototype['@@transducer/step'] = function (result, input) {
            return this.xf['@@transducer/step'](result, this.f(input));
        };
        return _curry2(function _xmap(f, xf) {
            return new XMap(f, xf);
        });
    }();

    var _xtake = function () {
        function XTake(n, xf) {
            this.xf = xf;
            this.n = n;
        }
        XTake.prototype['@@transducer/init'] = _xfBase.init;
        XTake.prototype['@@transducer/result'] = _xfBase.result;
        XTake.prototype['@@transducer/step'] = function (result, input) {
            if (this.n === 0) {
                return _reduced(result);
            } else {
                this.n -= 1;
                return this.xf['@@transducer/step'](result, input);
            }
        };
        return _curry2(function _xtake(n, xf) {
            return new XTake(n, xf);
        });
    }();

    var _xtakeWhile = function () {
        function XTakeWhile(f, xf) {
            this.xf = xf;
            this.f = f;
        }
        XTakeWhile.prototype['@@transducer/init'] = _xfBase.init;
        XTakeWhile.prototype['@@transducer/result'] = _xfBase.result;
        XTakeWhile.prototype['@@transducer/step'] = function (result, input) {
            return this.f(input) ? this.xf['@@transducer/step'](result, input) : _reduced(result);
        };
        return _curry2(function _xtakeWhile(f, xf) {
            return new XTakeWhile(f, xf);
        });
    }();

    /**
     * Adds two values.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Math
     * @sig Number -> Number -> Number
     * @param {Number} a
     * @param {Number} b
     * @return {Number}
     * @see R.subtract
     * @example
     *
     *      R.add(2, 3);       //=>  5
     *      R.add(7)(10);      //=> 17
     */
    var add = _curry2(function add(a, b) {
        return Number(a) + Number(b);
    });

    /**
     * Applies a function to the value at the given index of an array, returning a
     * new copy of the array with the element at the given index replaced with the
     * result of the function application.
     *
     * @func
     * @memberOf R
     * @since v0.14.0
     * @category List
     * @sig (a -> a) -> Number -> [a] -> [a]
     * @param {Function} fn The function to apply.
     * @param {Number} idx The index.
     * @param {Array|Arguments} list An array-like object whose value
     *        at the supplied index will be replaced.
     * @return {Array} A copy of the supplied array-like object with
     *         the element at index `idx` replaced with the value
     *         returned by applying `fn` to the existing element.
     * @see R.update
     * @example
     *
     *      R.adjust(R.add(10), 1, [0, 1, 2]);     //=> [0, 11, 2]
     *      R.adjust(R.add(10))(1)([0, 1, 2]);     //=> [0, 11, 2]
     */
    var adjust = _curry3(function adjust(fn, idx, list) {
        if (idx >= list.length || idx < -list.length) {
            return list;
        }
        var start = idx < 0 ? list.length : 0;
        var _idx = start + idx;
        var _list = _concat(list);
        _list[_idx] = fn(list[_idx]);
        return _list;
    });

    /**
     * Returns `true` if all elements of the list match the predicate, `false` if
     * there are any that don't.
     *
     * Dispatches to the `all` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig (a -> Boolean) -> [a] -> Boolean
     * @param {Function} fn The predicate function.
     * @param {Array} list The array to consider.
     * @return {Boolean} `true` if the predicate is satisfied by every element, `false`
     *         otherwise.
     * @see R.any, R.none, R.transduce
     * @example
     *
     *      var lessThan2 = R.flip(R.lt)(2);
     *      var lessThan3 = R.flip(R.lt)(3);
     *      R.all(lessThan2)([1, 2]); //=> false
     *      R.all(lessThan3)([1, 2]); //=> true
     */
    var all = _curry2(_dispatchable('all', _xall, function all(fn, list) {
        var idx = 0;
        while (idx < list.length) {
            if (!fn(list[idx])) {
                return false;
            }
            idx += 1;
        }
        return true;
    }));

    /**
     * Returns a function that always returns the given value. Note that for
     * non-primitives the value returned is a reference to the original value.
     *
     * This function is known as `const`, `constant`, or `K` (for K combinator) in
     * other languages and libraries.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig a -> (* -> a)
     * @param {*} val The value to wrap in a function
     * @return {Function} A Function :: * -> val.
     * @example
     *
     *      var t = R.always('Tee');
     *      t(); //=> 'Tee'
     */
    var always = _curry1(function always(val) {
        return function () {
            return val;
        };
    });

    /**
     * Returns `true` if both arguments are `true`; `false` otherwise.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Logic
     * @sig * -> * -> *
     * @param {Boolean} a A boolean value
     * @param {Boolean} b A boolean value
     * @return {Boolean} `true` if both arguments are `true`, `false` otherwise
     * @see R.both
     * @example
     *
     *      R.and(true, true); //=> true
     *      R.and(true, false); //=> false
     *      R.and(false, true); //=> false
     *      R.and(false, false); //=> false
     */
    var and = _curry2(function and(a, b) {
        return a && b;
    });

    /**
     * Returns `true` if at least one of elements of the list match the predicate,
     * `false` otherwise.
     *
     * Dispatches to the `any` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig (a -> Boolean) -> [a] -> Boolean
     * @param {Function} fn The predicate function.
     * @param {Array} list The array to consider.
     * @return {Boolean} `true` if the predicate is satisfied by at least one element, `false`
     *         otherwise.
     * @see R.all, R.none, R.transduce
     * @example
     *
     *      var lessThan0 = R.flip(R.lt)(0);
     *      var lessThan2 = R.flip(R.lt)(2);
     *      R.any(lessThan0)([1, 2]); //=> false
     *      R.any(lessThan2)([1, 2]); //=> true
     */
    var any = _curry2(_dispatchable('any', _xany, function any(fn, list) {
        var idx = 0;
        while (idx < list.length) {
            if (fn(list[idx])) {
                return true;
            }
            idx += 1;
        }
        return false;
    }));

    /**
     * Returns a new list, composed of n-tuples of consecutive elements If `n` is
     * greater than the length of the list, an empty list is returned.
     *
     * Dispatches to the `aperture` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.12.0
     * @category List
     * @sig Number -> [a] -> [[a]]
     * @param {Number} n The size of the tuples to create
     * @param {Array} list The list to split into `n`-tuples
     * @return {Array} The new list.
     * @see R.transduce
     * @example
     *
     *      R.aperture(2, [1, 2, 3, 4, 5]); //=> [[1, 2], [2, 3], [3, 4], [4, 5]]
     *      R.aperture(3, [1, 2, 3, 4, 5]); //=> [[1, 2, 3], [2, 3, 4], [3, 4, 5]]
     *      R.aperture(7, [1, 2, 3, 4, 5]); //=> []
     */
    var aperture = _curry2(_dispatchable('aperture', _xaperture, _aperture));

    /**
     * Returns a new list containing the contents of the given list, followed by
     * the given element.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig a -> [a] -> [a]
     * @param {*} el The element to add to the end of the new list.
     * @param {Array} list The list whose contents will be added to the beginning of the output
     *        list.
     * @return {Array} A new list containing the contents of the old list followed by `el`.
     * @see R.prepend
     * @example
     *
     *      R.append('tests', ['write', 'more']); //=> ['write', 'more', 'tests']
     *      R.append('tests', []); //=> ['tests']
     *      R.append(['tests'], ['write', 'more']); //=> ['write', 'more', ['tests']]
     */
    var append = _curry2(function append(el, list) {
        return _concat(list, [el]);
    });

    /**
     * Applies function `fn` to the argument list `args`. This is useful for
     * creating a fixed-arity function from a variadic function. `fn` should be a
     * bound function if context is significant.
     *
     * @func
     * @memberOf R
     * @since v0.7.0
     * @category Function
     * @sig (*... -> a) -> [*] -> a
     * @param {Function} fn
     * @param {Array} args
     * @return {*}
     * @see R.call, R.unapply
     * @example
     *
     *      var nums = [1, 2, 3, -99, 42, 6, 7];
     *      R.apply(Math.max, nums); //=> 42
     */
    var apply = _curry2(function apply(fn, args) {
        return fn.apply(this, args);
    });

    /**
     * Makes a shallow clone of an object, setting or overriding the specified
     * property with the given value. Note that this copies and flattens prototype
     * properties onto the new object as well. All non-primitive properties are
     * copied by reference.
     *
     * @func
     * @memberOf R
     * @since v0.8.0
     * @category Object
     * @sig String -> a -> {k: v} -> {k: v}
     * @param {String} prop the property name to set
     * @param {*} val the new value
     * @param {Object} obj the object to clone
     * @return {Object} a new object similar to the original except for the specified property.
     * @see R.dissoc
     * @example
     *
     *      R.assoc('c', 3, {a: 1, b: 2}); //=> {a: 1, b: 2, c: 3}
     */
    var assoc = _curry3(function assoc(prop, val, obj) {
        var result = {};
        for (var p in obj) {
            result[p] = obj[p];
        }
        result[prop] = val;
        return result;
    });

    /**
     * Makes a shallow clone of an object, setting or overriding the nodes required
     * to create the given path, and placing the specific value at the tail end of
     * that path. Note that this copies and flattens prototype properties onto the
     * new object as well. All non-primitive properties are copied by reference.
     *
     * @func
     * @memberOf R
     * @since v0.8.0
     * @category Object
     * @sig [String] -> a -> {k: v} -> {k: v}
     * @param {Array} path the path to set
     * @param {*} val the new value
     * @param {Object} obj the object to clone
     * @return {Object} a new object similar to the original except along the specified path.
     * @see R.dissocPath
     * @example
     *
     *      R.assocPath(['a', 'b', 'c'], 42, {a: {b: {c: 0}}}); //=> {a: {b: {c: 42}}}
     */
    var assocPath = _curry3(function assocPath(path, val, obj) {
        switch (path.length) {
        case 0:
            return val;
        case 1:
            return assoc(path[0], val, obj);
        default:
            return assoc(path[0], assocPath(_slice(path, 1), val, Object(obj[path[0]])), obj);
        }
    });

    /**
     * Creates a function that is bound to a context.
     * Note: `R.bind` does not provide the additional argument-binding capabilities of
     * [Function.prototype.bind](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind).
     *
     * @func
     * @memberOf R
     * @since v0.6.0
     * @category Function
     * @category Object
     * @sig (* -> *) -> {*} -> (* -> *)
     * @param {Function} fn The function to bind to context
     * @param {Object} thisObj The context to bind `fn` to
     * @return {Function} A function that will execute in the context of `thisObj`.
     * @see R.partial
     */
    var bind = _curry2(function bind(fn, thisObj) {
        return _arity(fn.length, function () {
            return fn.apply(thisObj, arguments);
        });
    });

    /**
     * Restricts a number to be within a range.
     *
     * Also works for other ordered types such as Strings and Dates.
     *
     * @func
     * @memberOf R
     * @since v0.20.0
     * @category Relation
     * @sig Ord a => a -> a -> a -> a
     * @param {Number} minimum number
     * @param {Number} maximum number
     * @param {Number} value to be clamped
     * @return {Number} Returns the clamped value
     * @example
     *
     *      R.clamp(1, 10, -1) // => 1
     *      R.clamp(1, 10, 11) // => 10
     *      R.clamp(1, 10, 4)  // => 4
     */
    var clamp = _curry3(function clamp(min, max, value) {
        if (min > max) {
            throw new Error('min must not be greater than max in clamp(min, max, value)');
        }
        return value < min ? min : value > max ? max : value;
    });

    /**
     * Makes a comparator function out of a function that reports whether the first
     * element is less than the second.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig (a, b -> Boolean) -> (a, b -> Number)
     * @param {Function} pred A predicate function of arity two.
     * @return {Function} A Function :: a -> b -> Int that returns `-1` if a < b, `1` if b < a, otherwise `0`.
     * @example
     *
     *      var cmp = R.comparator((a, b) => a.age < b.age);
     *      var people = [
     *        // ...
     *      ];
     *      R.sort(cmp, people);
     */
    var comparator = _curry1(function comparator(pred) {
        return function (a, b) {
            return pred(a, b) ? -1 : pred(b, a) ? 1 : 0;
        };
    });

    /**
     * Returns a curried equivalent of the provided function, with the specified
     * arity. The curried function has two unusual capabilities. First, its
     * arguments needn't be provided one at a time. If `g` is `R.curryN(3, f)`, the
     * following are equivalent:
     *
     *   - `g(1)(2)(3)`
     *   - `g(1)(2, 3)`
     *   - `g(1, 2)(3)`
     *   - `g(1, 2, 3)`
     *
     * Secondly, the special placeholder value `R.__` may be used to specify
     * "gaps", allowing partial application of any combination of arguments,
     * regardless of their positions. If `g` is as above and `_` is `R.__`, the
     * following are equivalent:
     *
     *   - `g(1, 2, 3)`
     *   - `g(_, 2, 3)(1)`
     *   - `g(_, _, 3)(1)(2)`
     *   - `g(_, _, 3)(1, 2)`
     *   - `g(_, 2)(1)(3)`
     *   - `g(_, 2)(1, 3)`
     *   - `g(_, 2)(_, 3)(1)`
     *
     * @func
     * @memberOf R
     * @since v0.5.0
     * @category Function
     * @sig Number -> (* -> a) -> (* -> a)
     * @param {Number} length The arity for the returned function.
     * @param {Function} fn The function to curry.
     * @return {Function} A new, curried function.
     * @see R.curry
     * @example
     *
     *      var sumArgs = (...args) => R.sum(args);
     *
     *      var curriedAddFourNumbers = R.curryN(4, sumArgs);
     *      var f = curriedAddFourNumbers(1, 2);
     *      var g = f(3);
     *      g(4); //=> 10
     */
    var curryN = _curry2(function curryN(length, fn) {
        if (length === 1) {
            return _curry1(fn);
        }
        return _arity(length, _curryN(length, [], fn));
    });

    /**
     * Decrements its argument.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Math
     * @sig Number -> Number
     * @param {Number} n
     * @return {Number}
     * @see R.inc
     * @example
     *
     *      R.dec(42); //=> 41
     */
    var dec = add(-1);

    /**
     * Returns the second argument if it is not `null`, `undefined` or `NaN`
     * otherwise the first argument is returned.
     *
     * @func
     * @memberOf R
     * @since v0.10.0
     * @category Logic
     * @sig a -> b -> a | b
     * @param {a} val The default value.
     * @param {b} val The value to return if it is not null or undefined
     * @return {*} The the second value or the default value
     * @example
     *
     *      var defaultTo42 = R.defaultTo(42);
     *
     *      defaultTo42(null);  //=> 42
     *      defaultTo42(undefined);  //=> 42
     *      defaultTo42('Ramda');  //=> 'Ramda'
     *      defaultTo42(parseInt('string')); //=> 42
     */
    var defaultTo = _curry2(function defaultTo(d, v) {
        return v == null || v !== v ? d : v;
    });

    /**
     * Finds the set (i.e. no duplicates) of all elements in the first list not
     * contained in the second list. Duplication is determined according to the
     * value returned by applying the supplied predicate to two list elements.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig (a -> a -> Boolean) -> [*] -> [*] -> [*]
     * @param {Function} pred A predicate used to test whether two items are equal.
     * @param {Array} list1 The first list.
     * @param {Array} list2 The second list.
     * @return {Array} The elements in `list1` that are not in `list2`.
     * @see R.difference
     * @example
     *
     *      var cmp = (x, y) => x.a === y.a;
     *      var l1 = [{a: 1}, {a: 2}, {a: 3}];
     *      var l2 = [{a: 3}, {a: 4}];
     *      R.differenceWith(cmp, l1, l2); //=> [{a: 1}, {a: 2}]
     */
    var differenceWith = _curry3(function differenceWith(pred, first, second) {
        var out = [];
        var idx = 0;
        var firstLen = first.length;
        while (idx < firstLen) {
            if (!_containsWith(pred, first[idx], second) && !_containsWith(pred, first[idx], out)) {
                out.push(first[idx]);
            }
            idx += 1;
        }
        return out;
    });

    /**
     * Returns a new object that does not contain a `prop` property.
     *
     * @func
     * @memberOf R
     * @since v0.10.0
     * @category Object
     * @sig String -> {k: v} -> {k: v}
     * @param {String} prop the name of the property to dissociate
     * @param {Object} obj the object to clone
     * @return {Object} a new object similar to the original but without the specified property
     * @see R.assoc
     * @example
     *
     *      R.dissoc('b', {a: 1, b: 2, c: 3}); //=> {a: 1, c: 3}
     */
    var dissoc = _curry2(function dissoc(prop, obj) {
        var result = {};
        for (var p in obj) {
            if (p !== prop) {
                result[p] = obj[p];
            }
        }
        return result;
    });

    /**
     * Makes a shallow clone of an object, omitting the property at the given path.
     * Note that this copies and flattens prototype properties onto the new object
     * as well. All non-primitive properties are copied by reference.
     *
     * @func
     * @memberOf R
     * @since v0.11.0
     * @category Object
     * @sig [String] -> {k: v} -> {k: v}
     * @param {Array} path the path to set
     * @param {Object} obj the object to clone
     * @return {Object} a new object without the property at path
     * @see R.assocPath
     * @example
     *
     *      R.dissocPath(['a', 'b', 'c'], {a: {b: {c: 42}}}); //=> {a: {b: {}}}
     */
    var dissocPath = _curry2(function dissocPath(path, obj) {
        switch (path.length) {
        case 0:
            return obj;
        case 1:
            return dissoc(path[0], obj);
        default:
            var head = path[0];
            var tail = _slice(path, 1);
            return obj[head] == null ? obj : assoc(head, dissocPath(tail, obj[head]), obj);
        }
    });

    /**
     * Divides two numbers. Equivalent to `a / b`.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Math
     * @sig Number -> Number -> Number
     * @param {Number} a The first value.
     * @param {Number} b The second value.
     * @return {Number} The result of `a / b`.
     * @see R.multiply
     * @example
     *
     *      R.divide(71, 100); //=> 0.71
     *
     *      var half = R.divide(R.__, 2);
     *      half(42); //=> 21
     *
     *      var reciprocal = R.divide(1);
     *      reciprocal(4);   //=> 0.25
     */
    var divide = _curry2(function divide(a, b) {
        return a / b;
    });

    /**
     * Returns a new list containing the last `n` elements of a given list, passing
     * each value to the supplied predicate function, skipping elements while the
     * predicate function returns `true`. The predicate function is passed one
     * argument: *(value)*.
     *
     * Dispatches to the `dropWhile` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category List
     * @sig (a -> Boolean) -> [a] -> [a]
     * @param {Function} fn The function called per iteration.
     * @param {Array} list The collection to iterate over.
     * @return {Array} A new array.
     * @see R.takeWhile, R.transduce, R.addIndex
     * @example
     *
     *      var lteTwo = x => x <= 2;
     *
     *      R.dropWhile(lteTwo, [1, 2, 3, 4, 3, 2, 1]); //=> [3, 4, 3, 2, 1]
     */
    var dropWhile = _curry2(_dispatchable('dropWhile', _xdropWhile, function dropWhile(pred, list) {
        var idx = 0;
        var len = list.length;
        while (idx < len && pred(list[idx])) {
            idx += 1;
        }
        return _slice(list, idx);
    }));

    /**
     * Returns the empty value of its argument's type. Ramda defines the empty
     * value of Array (`[]`), Object (`{}`), String (`''`), and Arguments. Other
     * types are supported if they define `<Type>.empty` and/or
     * `<Type>.prototype.empty`.
     *
     * Dispatches to the `empty` method of the first argument, if present.
     *
     * @func
     * @memberOf R
     * @since v0.3.0
     * @category Function
     * @sig a -> a
     * @param {*} x
     * @return {*}
     * @example
     *
     *      R.empty(Just(42));      //=> Nothing()
     *      R.empty([1, 2, 3]);     //=> []
     *      R.empty('unicorns');    //=> ''
     *      R.empty({x: 1, y: 2});  //=> {}
     */
    // else
    var empty = _curry1(function empty(x) {
        return x != null && typeof x.empty === 'function' ? x.empty() : x != null && x.constructor != null && typeof x.constructor.empty === 'function' ? x.constructor.empty() : _isArray(x) ? [] : _isString(x) ? '' : _isObject(x) ? {} : _isArguments(x) ? function () {
            return arguments;
        }() : // else
        void 0;
    });

    /**
     * Creates a new object by recursively evolving a shallow copy of `object`,
     * according to the `transformation` functions. All non-primitive properties
     * are copied by reference.
     *
     * A `transformation` function will not be invoked if its corresponding key
     * does not exist in the evolved object.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Object
     * @sig {k: (v -> v)} -> {k: v} -> {k: v}
     * @param {Object} transformations The object specifying transformation functions to apply
     *        to the object.
     * @param {Object} object The object to be transformed.
     * @return {Object} The transformed object.
     * @example
     *
     *      var tomato  = {firstName: '  Tomato ', data: {elapsed: 100, remaining: 1400}, id:123};
     *      var transformations = {
     *        firstName: R.trim,
     *        lastName: R.trim, // Will not get invoked.
     *        data: {elapsed: R.add(1), remaining: R.add(-1)}
     *      };
     *      R.evolve(transformations, tomato); //=> {firstName: 'Tomato', data: {elapsed: 101, remaining: 1399}, id:123}
     */
    var evolve = _curry2(function evolve(transformations, object) {
        var result = {};
        var transformation, key, type;
        for (key in object) {
            transformation = transformations[key];
            type = typeof transformation;
            result[key] = type === 'function' ? transformation(object[key]) : type === 'object' ? evolve(transformations[key], object[key]) : object[key];
        }
        return result;
    });

    /**
     * Returns the first element of the list which matches the predicate, or
     * `undefined` if no element matches.
     *
     * Dispatches to the `find` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig (a -> Boolean) -> [a] -> a | undefined
     * @param {Function} fn The predicate function used to determine if the element is the
     *        desired one.
     * @param {Array} list The array to consider.
     * @return {Object} The element found, or `undefined`.
     * @see R.transduce
     * @example
     *
     *      var xs = [{a: 1}, {a: 2}, {a: 3}];
     *      R.find(R.propEq('a', 2))(xs); //=> {a: 2}
     *      R.find(R.propEq('a', 4))(xs); //=> undefined
     */
    var find = _curry2(_dispatchable('find', _xfind, function find(fn, list) {
        var idx = 0;
        var len = list.length;
        while (idx < len) {
            if (fn(list[idx])) {
                return list[idx];
            }
            idx += 1;
        }
    }));

    /**
     * Returns the index of the first element of the list which matches the
     * predicate, or `-1` if no element matches.
     *
     * Dispatches to the `findIndex` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.1.1
     * @category List
     * @sig (a -> Boolean) -> [a] -> Number
     * @param {Function} fn The predicate function used to determine if the element is the
     * desired one.
     * @param {Array} list The array to consider.
     * @return {Number} The index of the element found, or `-1`.
     * @see R.transduce
     * @example
     *
     *      var xs = [{a: 1}, {a: 2}, {a: 3}];
     *      R.findIndex(R.propEq('a', 2))(xs); //=> 1
     *      R.findIndex(R.propEq('a', 4))(xs); //=> -1
     */
    var findIndex = _curry2(_dispatchable('findIndex', _xfindIndex, function findIndex(fn, list) {
        var idx = 0;
        var len = list.length;
        while (idx < len) {
            if (fn(list[idx])) {
                return idx;
            }
            idx += 1;
        }
        return -1;
    }));

    /**
     * Returns the last element of the list which matches the predicate, or
     * `undefined` if no element matches.
     *
     * Dispatches to the `findLast` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.1.1
     * @category List
     * @sig (a -> Boolean) -> [a] -> a | undefined
     * @param {Function} fn The predicate function used to determine if the element is the
     * desired one.
     * @param {Array} list The array to consider.
     * @return {Object} The element found, or `undefined`.
     * @see R.transduce
     * @example
     *
     *      var xs = [{a: 1, b: 0}, {a:1, b: 1}];
     *      R.findLast(R.propEq('a', 1))(xs); //=> {a: 1, b: 1}
     *      R.findLast(R.propEq('a', 4))(xs); //=> undefined
     */
    var findLast = _curry2(_dispatchable('findLast', _xfindLast, function findLast(fn, list) {
        var idx = list.length - 1;
        while (idx >= 0) {
            if (fn(list[idx])) {
                return list[idx];
            }
            idx -= 1;
        }
    }));

    /**
     * Returns the index of the last element of the list which matches the
     * predicate, or `-1` if no element matches.
     *
     * Dispatches to the `findLastIndex` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.1.1
     * @category List
     * @sig (a -> Boolean) -> [a] -> Number
     * @param {Function} fn The predicate function used to determine if the element is the
     * desired one.
     * @param {Array} list The array to consider.
     * @return {Number} The index of the element found, or `-1`.
     * @see R.transduce
     * @example
     *
     *      var xs = [{a: 1, b: 0}, {a:1, b: 1}];
     *      R.findLastIndex(R.propEq('a', 1))(xs); //=> 1
     *      R.findLastIndex(R.propEq('a', 4))(xs); //=> -1
     */
    var findLastIndex = _curry2(_dispatchable('findLastIndex', _xfindLastIndex, function findLastIndex(fn, list) {
        var idx = list.length - 1;
        while (idx >= 0) {
            if (fn(list[idx])) {
                return idx;
            }
            idx -= 1;
        }
        return -1;
    }));

    /**
     * Iterate over an input `list`, calling a provided function `fn` for each
     * element in the list.
     *
     * `fn` receives one argument: *(value)*.
     *
     * Note: `R.forEach` does not skip deleted or unassigned indices (sparse
     * arrays), unlike the native `Array.prototype.forEach` method. For more
     * details on this behavior, see:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach#Description
     *
     * Also note that, unlike `Array.prototype.forEach`, Ramda's `forEach` returns
     * the original array. In some libraries this function is named `each`.
     *
     * Dispatches to the `forEach` method of the second argument, if present.
     *
     * @func
     * @memberOf R
     * @since v0.1.1
     * @category List
     * @sig (a -> *) -> [a] -> [a]
     * @param {Function} fn The function to invoke. Receives one argument, `value`.
     * @param {Array} list The list to iterate over.
     * @return {Array} The original list.
     * @see R.addIndex
     * @example
     *
     *      var printXPlusFive = x => console.log(x + 5);
     *      R.forEach(printXPlusFive, [1, 2, 3]); //=> [1, 2, 3]
     *      //-> 6
     *      //-> 7
     *      //-> 8
     */
    var forEach = _curry2(_checkForMethod('forEach', function forEach(fn, list) {
        var len = list.length;
        var idx = 0;
        while (idx < len) {
            fn(list[idx]);
            idx += 1;
        }
        return list;
    }));

    /**
     * Creates a new object out of a list key-value pairs.
     *
     * @func
     * @memberOf R
     * @since v0.3.0
     * @category List
     * @sig [[k,v]] -> {k: v}
     * @param {Array} pairs An array of two-element arrays that will be the keys and values of the output object.
     * @return {Object} The object made by pairing up `keys` and `values`.
     * @see R.toPairs, R.pair
     * @example
     *
     *      R.fromPairs([['a', 1], ['b', 2],  ['c', 3]]); //=> {a: 1, b: 2, c: 3}
     */
    var fromPairs = _curry1(function fromPairs(pairs) {
        var idx = 0;
        var len = pairs.length;
        var out = {};
        while (idx < len) {
            if (_isArray(pairs[idx]) && pairs[idx].length) {
                out[pairs[idx][0]] = pairs[idx][1];
            }
            idx += 1;
        }
        return out;
    });

    /**
     * Takes a list and returns a list of lists where each sublist's elements are
     * all "equal" according to the provided equality function.
     *
     * @func
     * @memberOf R
     * @since v0.21.0
     * @category List
     * @sig (a, a -> Boolean) -> [a] -> [[a]]
     * @param {Function} fn Function for determining whether two given (adjacent)
     *        elements should be in the same group
     * @param {Array} list The array to group. Also accepts a string, which will be
     *        treated as a list of characters.
     * @return {List} A list that contains sublists of equal elements,
     *         whose concatenations is equal to the original list.
     * @example
     *
     *    groupWith(R.equals, [0, 1, 1, 2, 3, 5, 8, 13, 21])
     *    // [[0], [1, 1], [2, 3, 5, 8, 13, 21]]
     *
     *    groupWith((a, b) => a % 2 === b % 2, [0, 1, 1, 2, 3, 5, 8, 13, 21])
     *    // [[0], [1, 1], [2], [3, 5], [8], [13, 21]]
     *
     *    R.groupWith(R.eqBy(isVowel), 'aestiou')
     *    // ['ae', 'st', 'iou']
     */
    var groupWith = _curry2(function (fn, list) {
        var res = [];
        var idx = 0;
        var len = list.length;
        while (idx < len) {
            var nextidx = idx + 1;
            while (nextidx < len && fn(list[idx], list[nextidx])) {
                nextidx += 1;
            }
            res.push(list.slice(idx, nextidx));
            idx = nextidx;
        }
        return res;
    });

    /**
     * Returns `true` if the first argument is greater than the second; `false`
     * otherwise.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig Ord a => a -> a -> Boolean
     * @param {*} a
     * @param {*} b
     * @return {Boolean}
     * @see R.lt
     * @example
     *
     *      R.gt(2, 1); //=> true
     *      R.gt(2, 2); //=> false
     *      R.gt(2, 3); //=> false
     *      R.gt('a', 'z'); //=> false
     *      R.gt('z', 'a'); //=> true
     */
    var gt = _curry2(function gt(a, b) {
        return a > b;
    });

    /**
     * Returns `true` if the first argument is greater than or equal to the second;
     * `false` otherwise.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig Ord a => a -> a -> Boolean
     * @param {Number} a
     * @param {Number} b
     * @return {Boolean}
     * @see R.lte
     * @example
     *
     *      R.gte(2, 1); //=> true
     *      R.gte(2, 2); //=> true
     *      R.gte(2, 3); //=> false
     *      R.gte('a', 'z'); //=> false
     *      R.gte('z', 'a'); //=> true
     */
    var gte = _curry2(function gte(a, b) {
        return a >= b;
    });

    /**
     * Returns whether or not an object has an own property with the specified name
     *
     * @func
     * @memberOf R
     * @since v0.7.0
     * @category Object
     * @sig s -> {s: x} -> Boolean
     * @param {String} prop The name of the property to check for.
     * @param {Object} obj The object to query.
     * @return {Boolean} Whether the property exists.
     * @example
     *
     *      var hasName = R.has('name');
     *      hasName({name: 'alice'});   //=> true
     *      hasName({name: 'bob'});     //=> true
     *      hasName({});                //=> false
     *
     *      var point = {x: 0, y: 0};
     *      var pointHas = R.has(R.__, point);
     *      pointHas('x');  //=> true
     *      pointHas('y');  //=> true
     *      pointHas('z');  //=> false
     */
    var has = _curry2(_has);

    /**
     * Returns whether or not an object or its prototype chain has a property with
     * the specified name
     *
     * @func
     * @memberOf R
     * @since v0.7.0
     * @category Object
     * @sig s -> {s: x} -> Boolean
     * @param {String} prop The name of the property to check for.
     * @param {Object} obj The object to query.
     * @return {Boolean} Whether the property exists.
     * @example
     *
     *      function Rectangle(width, height) {
     *        this.width = width;
     *        this.height = height;
     *      }
     *      Rectangle.prototype.area = function() {
     *        return this.width * this.height;
     *      };
     *
     *      var square = new Rectangle(2, 2);
     *      R.hasIn('width', square);  //=> true
     *      R.hasIn('area', square);  //=> true
     */
    var hasIn = _curry2(function hasIn(prop, obj) {
        return prop in obj;
    });

    /**
     * Returns true if its arguments are identical, false otherwise. Values are
     * identical if they reference the same memory. `NaN` is identical to `NaN`;
     * `0` and `-0` are not identical.
     *
     * @func
     * @memberOf R
     * @since v0.15.0
     * @category Relation
     * @sig a -> a -> Boolean
     * @param {*} a
     * @param {*} b
     * @return {Boolean}
     * @example
     *
     *      var o = {};
     *      R.identical(o, o); //=> true
     *      R.identical(1, 1); //=> true
     *      R.identical(1, '1'); //=> false
     *      R.identical([], []); //=> false
     *      R.identical(0, -0); //=> false
     *      R.identical(NaN, NaN); //=> true
     */
    // SameValue algorithm
    // Steps 1-5, 7-10
    // Steps 6.b-6.e: +0 != -0
    // Step 6.a: NaN == NaN
    var identical = _curry2(function identical(a, b) {
        // SameValue algorithm
        if (a === b) {
            // Steps 1-5, 7-10
            // Steps 6.b-6.e: +0 != -0
            return a !== 0 || 1 / a === 1 / b;
        } else {
            // Step 6.a: NaN == NaN
            return a !== a && b !== b;
        }
    });

    /**
     * A function that does nothing but return the parameter supplied to it. Good
     * as a default or placeholder function.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig a -> a
     * @param {*} x The value to return.
     * @return {*} The input value, `x`.
     * @example
     *
     *      R.identity(1); //=> 1
     *
     *      var obj = {};
     *      R.identity(obj) === obj; //=> true
     */
    var identity = _curry1(_identity);

    /**
     * Creates a function that will process either the `onTrue` or the `onFalse`
     * function depending upon the result of the `condition` predicate.
     *
     * @func
     * @memberOf R
     * @since v0.8.0
     * @category Logic
     * @sig (*... -> Boolean) -> (*... -> *) -> (*... -> *) -> (*... -> *)
     * @param {Function} condition A predicate function
     * @param {Function} onTrue A function to invoke when the `condition` evaluates to a truthy value.
     * @param {Function} onFalse A function to invoke when the `condition` evaluates to a falsy value.
     * @return {Function} A new unary function that will process either the `onTrue` or the `onFalse`
     *                    function depending upon the result of the `condition` predicate.
     * @see R.unless, R.when
     * @example
     *
     *      var incCount = R.ifElse(
     *        R.has('count'),
     *        R.over(R.lensProp('count'), R.inc),
     *        R.assoc('count', 1)
     *      );
     *      incCount({});           //=> { count: 1 }
     *      incCount({ count: 1 }); //=> { count: 2 }
     */
    var ifElse = _curry3(function ifElse(condition, onTrue, onFalse) {
        return curryN(Math.max(condition.length, onTrue.length, onFalse.length), function _ifElse() {
            return condition.apply(this, arguments) ? onTrue.apply(this, arguments) : onFalse.apply(this, arguments);
        });
    });

    /**
     * Increments its argument.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Math
     * @sig Number -> Number
     * @param {Number} n
     * @return {Number}
     * @see R.dec
     * @example
     *
     *      R.inc(42); //=> 43
     */
    var inc = add(1);

    /**
     * Inserts the supplied element into the list, at index `index`. _Note that
     * this is not destructive_: it returns a copy of the list with the changes.
     * <small>No lists have been harmed in the application of this function.</small>
     *
     * @func
     * @memberOf R
     * @since v0.2.2
     * @category List
     * @sig Number -> a -> [a] -> [a]
     * @param {Number} index The position to insert the element
     * @param {*} elt The element to insert into the Array
     * @param {Array} list The list to insert into
     * @return {Array} A new Array with `elt` inserted at `index`.
     * @example
     *
     *      R.insert(2, 'x', [1,2,3,4]); //=> [1,2,'x',3,4]
     */
    var insert = _curry3(function insert(idx, elt, list) {
        idx = idx < list.length && idx >= 0 ? idx : list.length;
        var result = _slice(list);
        result.splice(idx, 0, elt);
        return result;
    });

    /**
     * Inserts the sub-list into the list, at index `index`. _Note that this is not
     * destructive_: it returns a copy of the list with the changes.
     * <small>No lists have been harmed in the application of this function.</small>
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category List
     * @sig Number -> [a] -> [a] -> [a]
     * @param {Number} index The position to insert the sub-list
     * @param {Array} elts The sub-list to insert into the Array
     * @param {Array} list The list to insert the sub-list into
     * @return {Array} A new Array with `elts` inserted starting at `index`.
     * @example
     *
     *      R.insertAll(2, ['x','y','z'], [1,2,3,4]); //=> [1,2,'x','y','z',3,4]
     */
    var insertAll = _curry3(function insertAll(idx, elts, list) {
        idx = idx < list.length && idx >= 0 ? idx : list.length;
        return _concat(_concat(_slice(list, 0, idx), elts), _slice(list, idx));
    });

    /**
     * Creates a new list with the separator interposed between elements.
     *
     * Dispatches to the `intersperse` method of the second argument, if present.
     *
     * @func
     * @memberOf R
     * @since v0.14.0
     * @category List
     * @sig a -> [a] -> [a]
     * @param {*} separator The element to add to the list.
     * @param {Array} list The list to be interposed.
     * @return {Array} The new list.
     * @example
     *
     *      R.intersperse('n', ['ba', 'a', 'a']); //=> ['ba', 'n', 'a', 'n', 'a']
     */
    var intersperse = _curry2(_checkForMethod('intersperse', function intersperse(separator, list) {
        var out = [];
        var idx = 0;
        var length = list.length;
        while (idx < length) {
            if (idx === length - 1) {
                out.push(list[idx]);
            } else {
                out.push(list[idx], separator);
            }
            idx += 1;
        }
        return out;
    }));

    /**
     * See if an object (`val`) is an instance of the supplied constructor. This
     * function will check up the inheritance chain, if any.
     *
     * @func
     * @memberOf R
     * @since v0.3.0
     * @category Type
     * @sig (* -> {*}) -> a -> Boolean
     * @param {Object} ctor A constructor
     * @param {*} val The value to test
     * @return {Boolean}
     * @example
     *
     *      R.is(Object, {}); //=> true
     *      R.is(Number, 1); //=> true
     *      R.is(Object, 1); //=> false
     *      R.is(String, 's'); //=> true
     *      R.is(String, new String('')); //=> true
     *      R.is(Object, new String('')); //=> true
     *      R.is(Object, 's'); //=> false
     *      R.is(Number, {}); //=> false
     */
    var is = _curry2(function is(Ctor, val) {
        return val != null && val.constructor === Ctor || val instanceof Ctor;
    });

    /**
     * Tests whether or not an object is similar to an array.
     *
     * @func
     * @memberOf R
     * @since v0.5.0
     * @category Type
     * @category List
     * @sig * -> Boolean
     * @param {*} x The object to test.
     * @return {Boolean} `true` if `x` has a numeric length property and extreme indices defined; `false` otherwise.
     * @example
     *
     *      R.isArrayLike([]); //=> true
     *      R.isArrayLike(true); //=> false
     *      R.isArrayLike({}); //=> false
     *      R.isArrayLike({length: 10}); //=> false
     *      R.isArrayLike({0: 'zero', 9: 'nine', length: 10}); //=> true
     */
    var isArrayLike = _curry1(function isArrayLike(x) {
        if (_isArray(x)) {
            return true;
        }
        if (!x) {
            return false;
        }
        if (typeof x !== 'object') {
            return false;
        }
        if (x instanceof String) {
            return false;
        }
        if (x.nodeType === 1) {
            return !!x.length;
        }
        if (x.length === 0) {
            return true;
        }
        if (x.length > 0) {
            return x.hasOwnProperty(0) && x.hasOwnProperty(x.length - 1);
        }
        return false;
    });

    /**
     * Checks if the input value is `null` or `undefined`.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Type
     * @sig * -> Boolean
     * @param {*} x The value to test.
     * @return {Boolean} `true` if `x` is `undefined` or `null`, otherwise `false`.
     * @example
     *
     *      R.isNil(null); //=> true
     *      R.isNil(undefined); //=> true
     *      R.isNil(0); //=> false
     *      R.isNil([]); //=> false
     */
    var isNil = _curry1(function isNil(x) {
        return x == null;
    });

    /**
     * Returns a list containing the names of all the enumerable own properties of
     * the supplied object.
     * Note that the order of the output array is not guaranteed to be consistent
     * across different JS platforms.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Object
     * @sig {k: v} -> [k]
     * @param {Object} obj The object to extract properties from
     * @return {Array} An array of the object's own properties.
     * @example
     *
     *      R.keys({a: 1, b: 2, c: 3}); //=> ['a', 'b', 'c']
     */
    // cover IE < 9 keys issues
    // Safari bug
    var keys = function () {
        // cover IE < 9 keys issues
        var hasEnumBug = !{ toString: null }.propertyIsEnumerable('toString');
        var nonEnumerableProps = [
            'constructor',
            'valueOf',
            'isPrototypeOf',
            'toString',
            'propertyIsEnumerable',
            'hasOwnProperty',
            'toLocaleString'
        ];
        // Safari bug
        var hasArgsEnumBug = function () {
            'use strict';
            return arguments.propertyIsEnumerable('length');
        }();
        var contains = function contains(list, item) {
            var idx = 0;
            while (idx < list.length) {
                if (list[idx] === item) {
                    return true;
                }
                idx += 1;
            }
            return false;
        };
        return typeof Object.keys === 'function' && !hasArgsEnumBug ? _curry1(function keys(obj) {
            return Object(obj) !== obj ? [] : Object.keys(obj);
        }) : _curry1(function keys(obj) {
            if (Object(obj) !== obj) {
                return [];
            }
            var prop, nIdx;
            var ks = [];
            var checkArgsLength = hasArgsEnumBug && _isArguments(obj);
            for (prop in obj) {
                if (_has(prop, obj) && (!checkArgsLength || prop !== 'length')) {
                    ks[ks.length] = prop;
                }
            }
            if (hasEnumBug) {
                nIdx = nonEnumerableProps.length - 1;
                while (nIdx >= 0) {
                    prop = nonEnumerableProps[nIdx];
                    if (_has(prop, obj) && !contains(ks, prop)) {
                        ks[ks.length] = prop;
                    }
                    nIdx -= 1;
                }
            }
            return ks;
        });
    }();

    /**
     * Returns a list containing the names of all the properties of the supplied
     * object, including prototype properties.
     * Note that the order of the output array is not guaranteed to be consistent
     * across different JS platforms.
     *
     * @func
     * @memberOf R
     * @since v0.2.0
     * @category Object
     * @sig {k: v} -> [k]
     * @param {Object} obj The object to extract properties from
     * @return {Array} An array of the object's own and prototype properties.
     * @example
     *
     *      var F = function() { this.x = 'X'; };
     *      F.prototype.y = 'Y';
     *      var f = new F();
     *      R.keysIn(f); //=> ['x', 'y']
     */
    var keysIn = _curry1(function keysIn(obj) {
        var prop;
        var ks = [];
        for (prop in obj) {
            ks[ks.length] = prop;
        }
        return ks;
    });

    /**
     * Returns the number of elements in the array by returning `list.length`.
     *
     * @func
     * @memberOf R
     * @since v0.3.0
     * @category List
     * @sig [a] -> Number
     * @param {Array} list The array to inspect.
     * @return {Number} The length of the array.
     * @example
     *
     *      R.length([]); //=> 0
     *      R.length([1, 2, 3]); //=> 3
     */
    var length = _curry1(function length(list) {
        return list != null && is(Number, list.length) ? list.length : NaN;
    });

    /**
     * Returns `true` if the first argument is less than the second; `false`
     * otherwise.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig Ord a => a -> a -> Boolean
     * @param {*} a
     * @param {*} b
     * @return {Boolean}
     * @see R.gt
     * @example
     *
     *      R.lt(2, 1); //=> false
     *      R.lt(2, 2); //=> false
     *      R.lt(2, 3); //=> true
     *      R.lt('a', 'z'); //=> true
     *      R.lt('z', 'a'); //=> false
     */
    var lt = _curry2(function lt(a, b) {
        return a < b;
    });

    /**
     * Returns `true` if the first argument is less than or equal to the second;
     * `false` otherwise.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig Ord a => a -> a -> Boolean
     * @param {Number} a
     * @param {Number} b
     * @return {Boolean}
     * @see R.gte
     * @example
     *
     *      R.lte(2, 1); //=> false
     *      R.lte(2, 2); //=> true
     *      R.lte(2, 3); //=> true
     *      R.lte('a', 'z'); //=> true
     *      R.lte('z', 'a'); //=> false
     */
    var lte = _curry2(function lte(a, b) {
        return a <= b;
    });

    /**
     * The mapAccum function behaves like a combination of map and reduce; it
     * applies a function to each element of a list, passing an accumulating
     * parameter from left to right, and returning a final value of this
     * accumulator together with the new list.
     *
     * The iterator function receives two arguments, *acc* and *value*, and should
     * return a tuple *[acc, value]*.
     *
     * @func
     * @memberOf R
     * @since v0.10.0
     * @category List
     * @sig (acc -> x -> (acc, y)) -> acc -> [x] -> (acc, [y])
     * @param {Function} fn The function to be called on every element of the input `list`.
     * @param {*} acc The accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @see R.addIndex
     * @example
     *
     *      var digits = ['1', '2', '3', '4'];
     *      var appender = (a, b) => [a + b, a + b];
     *
     *      R.mapAccum(appender, 0, digits); //=> ['01234', ['01', '012', '0123', '01234']]
     */
    var mapAccum = _curry3(function mapAccum(fn, acc, list) {
        var idx = 0;
        var len = list.length;
        var result = [];
        var tuple = [acc];
        while (idx < len) {
            tuple = fn(tuple[0], list[idx]);
            result[idx] = tuple[1];
            idx += 1;
        }
        return [
            tuple[0],
            result
        ];
    });

    /**
     * The mapAccumRight function behaves like a combination of map and reduce; it
     * applies a function to each element of a list, passing an accumulating
     * parameter from right to left, and returning a final value of this
     * accumulator together with the new list.
     *
     * Similar to `mapAccum`, except moves through the input list from the right to
     * the left.
     *
     * The iterator function receives two arguments, *acc* and *value*, and should
     * return a tuple *[acc, value]*.
     *
     * @func
     * @memberOf R
     * @since v0.10.0
     * @category List
     * @sig (acc -> x -> (acc, y)) -> acc -> [x] -> (acc, [y])
     * @param {Function} fn The function to be called on every element of the input `list`.
     * @param {*} acc The accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @see R.addIndex
     * @example
     *
     *      var digits = ['1', '2', '3', '4'];
     *      var append = (a, b) => [a + b, a + b];
     *
     *      R.mapAccumRight(append, 0, digits); //=> ['04321', ['04321', '0432', '043', '04']]
     */
    var mapAccumRight = _curry3(function mapAccumRight(fn, acc, list) {
        var idx = list.length - 1;
        var result = [];
        var tuple = [acc];
        while (idx >= 0) {
            tuple = fn(tuple[0], list[idx]);
            result[idx] = tuple[1];
            idx -= 1;
        }
        return [
            tuple[0],
            result
        ];
    });

    /**
     * Tests a regular expression against a String. Note that this function will
     * return an empty array when there are no matches. This differs from
     * [`String.prototype.match`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match)
     * which returns `null` when there are no matches.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category String
     * @sig RegExp -> String -> [String | Undefined]
     * @param {RegExp} rx A regular expression.
     * @param {String} str The string to match against
     * @return {Array} The list of matches or empty array.
     * @see R.test
     * @example
     *
     *      R.match(/([a-z]a)/g, 'bananas'); //=> ['ba', 'na', 'na']
     *      R.match(/a/, 'b'); //=> []
     *      R.match(/a/, null); //=> TypeError: null does not have a method named "match"
     */
    var match = _curry2(function match(rx, str) {
        return str.match(rx) || [];
    });

    /**
     * mathMod behaves like the modulo operator should mathematically, unlike the
     * `%` operator (and by extension, R.modulo). So while "-17 % 5" is -2,
     * mathMod(-17, 5) is 3. mathMod requires Integer arguments, and returns NaN
     * when the modulus is zero or negative.
     *
     * @func
     * @memberOf R
     * @since v0.3.0
     * @category Math
     * @sig Number -> Number -> Number
     * @param {Number} m The dividend.
     * @param {Number} p the modulus.
     * @return {Number} The result of `b mod a`.
     * @example
     *
     *      R.mathMod(-17, 5);  //=> 3
     *      R.mathMod(17, 5);   //=> 2
     *      R.mathMod(17, -5);  //=> NaN
     *      R.mathMod(17, 0);   //=> NaN
     *      R.mathMod(17.2, 5); //=> NaN
     *      R.mathMod(17, 5.3); //=> NaN
     *
     *      var clock = R.mathMod(R.__, 12);
     *      clock(15); //=> 3
     *      clock(24); //=> 0
     *
     *      var seventeenMod = R.mathMod(17);
     *      seventeenMod(3);  //=> 2
     *      seventeenMod(4);  //=> 1
     *      seventeenMod(10); //=> 7
     */
    var mathMod = _curry2(function mathMod(m, p) {
        if (!_isInteger(m)) {
            return NaN;
        }
        if (!_isInteger(p) || p < 1) {
            return NaN;
        }
        return (m % p + p) % p;
    });

    /**
     * Returns the larger of its two arguments.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig Ord a => a -> a -> a
     * @param {*} a
     * @param {*} b
     * @return {*}
     * @see R.maxBy, R.min
     * @example
     *
     *      R.max(789, 123); //=> 789
     *      R.max('a', 'b'); //=> 'b'
     */
    var max = _curry2(function max(a, b) {
        return b > a ? b : a;
    });

    /**
     * Takes a function and two values, and returns whichever value produces the
     * larger result when passed to the provided function.
     *
     * @func
     * @memberOf R
     * @since v0.8.0
     * @category Relation
     * @sig Ord b => (a -> b) -> a -> a -> a
     * @param {Function} f
     * @param {*} a
     * @param {*} b
     * @return {*}
     * @see R.max, R.minBy
     * @example
     *
     *      //  square :: Number -> Number
     *      var square = n => n * n;
     *
     *      R.maxBy(square, -3, 2); //=> -3
     *
     *      R.reduce(R.maxBy(square), 0, [3, -5, 4, 1, -2]); //=> -5
     *      R.reduce(R.maxBy(square), 0, []); //=> 0
     */
    var maxBy = _curry3(function maxBy(f, a, b) {
        return f(b) > f(a) ? b : a;
    });

    /**
     * Create a new object with the own properties of the first object merged with
     * the own properties of the second object. If a key exists in both objects,
     * the value from the second object will be used.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Object
     * @sig {k: v} -> {k: v} -> {k: v}
     * @param {Object} l
     * @param {Object} r
     * @return {Object}
     * @see R.mergeWith, R.mergeWithKey
     * @example
     *
     *      R.merge({ 'name': 'fred', 'age': 10 }, { 'age': 40 });
     *      //=> { 'name': 'fred', 'age': 40 }
     *
     *      var resetToDefault = R.merge(R.__, {x: 0});
     *      resetToDefault({x: 5, y: 2}); //=> {x: 0, y: 2}
     */
    var merge = _curry2(function merge(l, r) {
        return _assign({}, l, r);
    });

    /**
     * Merges a list of objects together into one object.
     *
     * @func
     * @memberOf R
     * @since v0.10.0
     * @category List
     * @sig [{k: v}] -> {k: v}
     * @param {Array} list An array of objects
     * @return {Object} A merged object.
     * @see R.reduce
     * @example
     *
     *      R.mergeAll([{foo:1},{bar:2},{baz:3}]); //=> {foo:1,bar:2,baz:3}
     *      R.mergeAll([{foo:1},{foo:2},{bar:2}]); //=> {foo:2,bar:2}
     */
    var mergeAll = _curry1(function mergeAll(list) {
        return _assign.apply(null, [{}].concat(list));
    });

    /**
     * Creates a new object with the own properties of the two provided objects. If
     * a key exists in both objects, the provided function is applied to the key
     * and the values associated with the key in each object, with the result being
     * used as the value associated with the key in the returned object. The key
     * will be excluded from the returned object if the resulting value is
     * `undefined`.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category Object
     * @sig (String -> a -> a -> a) -> {a} -> {a} -> {a}
     * @param {Function} fn
     * @param {Object} l
     * @param {Object} r
     * @return {Object}
     * @see R.merge, R.mergeWith
     * @example
     *
     *      let concatValues = (k, l, r) => k == 'values' ? R.concat(l, r) : r
     *      R.mergeWithKey(concatValues,
     *                     { a: true, thing: 'foo', values: [10, 20] },
     *                     { b: true, thing: 'bar', values: [15, 35] });
     *      //=> { a: true, b: true, thing: 'bar', values: [10, 20, 15, 35] }
     */
    var mergeWithKey = _curry3(function mergeWithKey(fn, l, r) {
        var result = {};
        var k;
        for (k in l) {
            if (_has(k, l)) {
                result[k] = _has(k, r) ? fn(k, l[k], r[k]) : l[k];
            }
        }
        for (k in r) {
            if (_has(k, r) && !_has(k, result)) {
                result[k] = r[k];
            }
        }
        return result;
    });

    /**
     * Returns the smaller of its two arguments.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig Ord a => a -> a -> a
     * @param {*} a
     * @param {*} b
     * @return {*}
     * @see R.minBy, R.max
     * @example
     *
     *      R.min(789, 123); //=> 123
     *      R.min('a', 'b'); //=> 'a'
     */
    var min = _curry2(function min(a, b) {
        return b < a ? b : a;
    });

    /**
     * Takes a function and two values, and returns whichever value produces the
     * smaller result when passed to the provided function.
     *
     * @func
     * @memberOf R
     * @since v0.8.0
     * @category Relation
     * @sig Ord b => (a -> b) -> a -> a -> a
     * @param {Function} f
     * @param {*} a
     * @param {*} b
     * @return {*}
     * @see R.min, R.maxBy
     * @example
     *
     *      //  square :: Number -> Number
     *      var square = n => n * n;
     *
     *      R.minBy(square, -3, 2); //=> 2
     *
     *      R.reduce(R.minBy(square), Infinity, [3, -5, 4, 1, -2]); //=> 1
     *      R.reduce(R.minBy(square), Infinity, []); //=> Infinity
     */
    var minBy = _curry3(function minBy(f, a, b) {
        return f(b) < f(a) ? b : a;
    });

    /**
     * Divides the second parameter by the first and returns the remainder. Note
     * that this function preserves the JavaScript-style behavior for modulo. For
     * mathematical modulo see `mathMod`.
     *
     * @func
     * @memberOf R
     * @since v0.1.1
     * @category Math
     * @sig Number -> Number -> Number
     * @param {Number} a The value to the divide.
     * @param {Number} b The pseudo-modulus
     * @return {Number} The result of `b % a`.
     * @see R.mathMod
     * @example
     *
     *      R.modulo(17, 3); //=> 2
     *      // JS behavior:
     *      R.modulo(-17, 3); //=> -2
     *      R.modulo(17, -3); //=> 2
     *
     *      var isOdd = R.modulo(R.__, 2);
     *      isOdd(42); //=> 0
     *      isOdd(21); //=> 1
     */
    var modulo = _curry2(function modulo(a, b) {
        return a % b;
    });

    /**
     * Multiplies two numbers. Equivalent to `a * b` but curried.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Math
     * @sig Number -> Number -> Number
     * @param {Number} a The first value.
     * @param {Number} b The second value.
     * @return {Number} The result of `a * b`.
     * @see R.divide
     * @example
     *
     *      var double = R.multiply(2);
     *      var triple = R.multiply(3);
     *      double(3);       //=>  6
     *      triple(4);       //=> 12
     *      R.multiply(2, 5);  //=> 10
     */
    var multiply = _curry2(function multiply(a, b) {
        return a * b;
    });

    /**
     * Wraps a function of any arity (including nullary) in a function that accepts
     * exactly `n` parameters. Any extraneous parameters will not be passed to the
     * supplied function.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig Number -> (* -> a) -> (* -> a)
     * @param {Number} n The desired arity of the new function.
     * @param {Function} fn The function to wrap.
     * @return {Function} A new function wrapping `fn`. The new function is guaranteed to be of
     *         arity `n`.
     * @example
     *
     *      var takesTwoArgs = (a, b) => [a, b];
     *
     *      takesTwoArgs.length; //=> 2
     *      takesTwoArgs(1, 2); //=> [1, 2]
     *
     *      var takesOneArg = R.nAry(1, takesTwoArgs);
     *      takesOneArg.length; //=> 1
     *      // Only `n` arguments are passed to the wrapped function
     *      takesOneArg(1, 2); //=> [1, undefined]
     */
    var nAry = _curry2(function nAry(n, fn) {
        switch (n) {
        case 0:
            return function () {
                return fn.call(this);
            };
        case 1:
            return function (a0) {
                return fn.call(this, a0);
            };
        case 2:
            return function (a0, a1) {
                return fn.call(this, a0, a1);
            };
        case 3:
            return function (a0, a1, a2) {
                return fn.call(this, a0, a1, a2);
            };
        case 4:
            return function (a0, a1, a2, a3) {
                return fn.call(this, a0, a1, a2, a3);
            };
        case 5:
            return function (a0, a1, a2, a3, a4) {
                return fn.call(this, a0, a1, a2, a3, a4);
            };
        case 6:
            return function (a0, a1, a2, a3, a4, a5) {
                return fn.call(this, a0, a1, a2, a3, a4, a5);
            };
        case 7:
            return function (a0, a1, a2, a3, a4, a5, a6) {
                return fn.call(this, a0, a1, a2, a3, a4, a5, a6);
            };
        case 8:
            return function (a0, a1, a2, a3, a4, a5, a6, a7) {
                return fn.call(this, a0, a1, a2, a3, a4, a5, a6, a7);
            };
        case 9:
            return function (a0, a1, a2, a3, a4, a5, a6, a7, a8) {
                return fn.call(this, a0, a1, a2, a3, a4, a5, a6, a7, a8);
            };
        case 10:
            return function (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
                return fn.call(this, a0, a1, a2, a3, a4, a5, a6, a7, a8, a9);
            };
        default:
            throw new Error('First argument to nAry must be a non-negative integer no greater than ten');
        }
    });

    /**
     * Negates its argument.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Math
     * @sig Number -> Number
     * @param {Number} n
     * @return {Number}
     * @example
     *
     *      R.negate(42); //=> -42
     */
    var negate = _curry1(function negate(n) {
        return -n;
    });

    /**
     * Returns `true` if no elements of the list match the predicate, `false`
     * otherwise.
     *
     * Dispatches to the `any` method of the second argument, if present.
     *
     * @func
     * @memberOf R
     * @since v0.12.0
     * @category List
     * @sig (a -> Boolean) -> [a] -> Boolean
     * @param {Function} fn The predicate function.
     * @param {Array} list The array to consider.
     * @return {Boolean} `true` if the predicate is not satisfied by every element, `false` otherwise.
     * @see R.all, R.any
     * @example
     *
     *      var isEven = n => n % 2 === 0;
     *
     *      R.none(isEven, [1, 3, 5, 7, 9, 11]); //=> true
     *      R.none(isEven, [1, 3, 5, 7, 8, 11]); //=> false
     */
    var none = _curry2(_complement(_dispatchable('any', _xany, any)));

    /**
     * A function that returns the `!` of its argument. It will return `true` when
     * passed false-y value, and `false` when passed a truth-y one.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Logic
     * @sig * -> Boolean
     * @param {*} a any value
     * @return {Boolean} the logical inverse of passed argument.
     * @see R.complement
     * @example
     *
     *      R.not(true); //=> false
     *      R.not(false); //=> true
     *      R.not(0); => true
     *      R.not(1); => false
     */
    var not = _curry1(function not(a) {
        return !a;
    });

    /**
     * Returns the nth element of the given list or string. If n is negative the
     * element at index length + n is returned.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig Number -> [a] -> a | Undefined
     * @sig Number -> String -> String
     * @param {Number} offset
     * @param {*} list
     * @return {*}
     * @example
     *
     *      var list = ['foo', 'bar', 'baz', 'quux'];
     *      R.nth(1, list); //=> 'bar'
     *      R.nth(-1, list); //=> 'quux'
     *      R.nth(-99, list); //=> undefined
     *
     *      R.nth(2, 'abc'); //=> 'c'
     *      R.nth(3, 'abc'); //=> ''
     */
    var nth = _curry2(function nth(offset, list) {
        var idx = offset < 0 ? list.length + offset : offset;
        return _isString(list) ? list.charAt(idx) : list[idx];
    });

    /**
     * Returns a function which returns its nth argument.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Function
     * @sig Number -> *... -> *
     * @param {Number} n
     * @return {Function}
     * @example
     *
     *      R.nthArg(1)('a', 'b', 'c'); //=> 'b'
     *      R.nthArg(-1)('a', 'b', 'c'); //=> 'c'
     */
    var nthArg = _curry1(function nthArg(n) {
        return function () {
            return nth(n, arguments);
        };
    });

    /**
     * Creates an object containing a single key:value pair.
     *
     * @func
     * @memberOf R
     * @since v0.18.0
     * @category Object
     * @sig String -> a -> {String:a}
     * @param {String} key
     * @param {*} val
     * @return {Object}
     * @see R.pair
     * @example
     *
     *      var matchPhrases = R.compose(
     *        R.objOf('must'),
     *        R.map(R.objOf('match_phrase'))
     *      );
     *      matchPhrases(['foo', 'bar', 'baz']); //=> {must: [{match_phrase: 'foo'}, {match_phrase: 'bar'}, {match_phrase: 'baz'}]}
     */
    var objOf = _curry2(function objOf(key, val) {
        var obj = {};
        obj[key] = val;
        return obj;
    });

    /**
     * Returns a singleton array containing the value provided.
     *
     * Note this `of` is different from the ES6 `of`; See
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/of
     *
     * @func
     * @memberOf R
     * @since v0.3.0
     * @category Function
     * @sig a -> [a]
     * @param {*} x any value
     * @return {Array} An array wrapping `x`.
     * @example
     *
     *      R.of(null); //=> [null]
     *      R.of([42]); //=> [[42]]
     */
    var of = _curry1(_of);

    /**
     * Accepts a function `fn` and returns a function that guards invocation of
     * `fn` such that `fn` can only ever be called once, no matter how many times
     * the returned function is invoked. The first value calculated is returned in
     * subsequent invocations.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig (a... -> b) -> (a... -> b)
     * @param {Function} fn The function to wrap in a call-only-once wrapper.
     * @return {Function} The wrapped function.
     * @example
     *
     *      var addOneOnce = R.once(x => x + 1);
     *      addOneOnce(10); //=> 11
     *      addOneOnce(addOneOnce(50)); //=> 11
     */
    var once = _curry1(function once(fn) {
        var called = false;
        var result;
        return _arity(fn.length, function () {
            if (called) {
                return result;
            }
            called = true;
            result = fn.apply(this, arguments);
            return result;
        });
    });

    /**
     * Returns `true` if one or both of its arguments are `true`. Returns `false`
     * if both arguments are `false`.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Logic
     * @sig * -> * -> *
     * @param {Boolean} a A boolean value
     * @param {Boolean} b A boolean value
     * @return {Boolean} `true` if one or both arguments are `true`, `false` otherwise
     * @see R.either
     * @example
     *
     *      R.or(true, true); //=> true
     *      R.or(true, false); //=> true
     *      R.or(false, true); //=> true
     *      R.or(false, false); //=> false
     */
    var or = _curry2(function or(a, b) {
        return a || b;
    });

    /**
     * Returns the result of "setting" the portion of the given data structure
     * focused by the given lens to the result of applying the given function to
     * the focused value.
     *
     * @func
     * @memberOf R
     * @since v0.16.0
     * @category Object
     * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
     * @sig Lens s a -> (a -> a) -> s -> s
     * @param {Lens} lens
     * @param {*} v
     * @param {*} x
     * @return {*}
     * @see R.prop, R.lensIndex, R.lensProp
     * @example
     *
     *      var headLens = R.lensIndex(0);
     *
     *      R.over(headLens, R.toUpper, ['foo', 'bar', 'baz']); //=> ['FOO', 'bar', 'baz']
     */
    // `Identity` is a functor that holds a single value, where `map` simply
    // transforms the held value with the provided function.
    // The value returned by the getter function is first transformed with `f`,
    // then set as the value of an `Identity`. This is then mapped over with the
    // setter function of the lens.
    var over = function () {
        // `Identity` is a functor that holds a single value, where `map` simply
        // transforms the held value with the provided function.
        var Identity = function (x) {
            return {
                value: x,
                map: function (f) {
                    return Identity(f(x));
                }
            };
        };
        return _curry3(function over(lens, f, x) {
            // The value returned by the getter function is first transformed with `f`,
            // then set as the value of an `Identity`. This is then mapped over with the
            // setter function of the lens.
            return lens(function (y) {
                return Identity(f(y));
            })(x).value;
        });
    }();

    /**
     * Takes two arguments, `fst` and `snd`, and returns `[fst, snd]`.
     *
     * @func
     * @memberOf R
     * @since v0.18.0
     * @category List
     * @sig a -> b -> (a,b)
     * @param {*} fst
     * @param {*} snd
     * @return {Array}
     * @see R.objOf, R.of
     * @example
     *
     *      R.pair('foo', 'bar'); //=> ['foo', 'bar']
     */
    var pair = _curry2(function pair(fst, snd) {
        return [
            fst,
            snd
        ];
    });

    /**
     * Retrieve the value at a given path.
     *
     * @func
     * @memberOf R
     * @since v0.2.0
     * @category Object
     * @sig [String] -> {k: v} -> v | Undefined
     * @param {Array} path The path to use.
     * @param {Object} obj The object to retrieve the nested property from.
     * @return {*} The data at `path`.
     * @example
     *
     *      R.path(['a', 'b'], {a: {b: 2}}); //=> 2
     *      R.path(['a', 'b'], {c: {b: 2}}); //=> undefined
     */
    var path = _curry2(function path(paths, obj) {
        var val = obj;
        var idx = 0;
        while (idx < paths.length) {
            if (val == null) {
                return;
            }
            val = val[paths[idx]];
            idx += 1;
        }
        return val;
    });

    /**
     * If the given, non-null object has a value at the given path, returns the
     * value at that path. Otherwise returns the provided default value.
     *
     * @func
     * @memberOf R
     * @since v0.18.0
     * @category Object
     * @sig a -> [String] -> Object -> a
     * @param {*} d The default value.
     * @param {Array} p The path to use.
     * @param {Object} obj The object to retrieve the nested property from.
     * @return {*} The data at `path` of the supplied object or the default value.
     * @example
     *
     *      R.pathOr('N/A', ['a', 'b'], {a: {b: 2}}); //=> 2
     *      R.pathOr('N/A', ['a', 'b'], {c: {b: 2}}); //=> "N/A"
     */
    var pathOr = _curry3(function pathOr(d, p, obj) {
        return defaultTo(d, path(p, obj));
    });

    /**
     * Returns `true` if the specified object property at given path satisfies the
     * given predicate; `false` otherwise.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category Logic
     * @sig (a -> Boolean) -> [String] -> Object -> Boolean
     * @param {Function} pred
     * @param {Array} propPath
     * @param {*} obj
     * @return {Boolean}
     * @see R.propSatisfies, R.path
     * @example
     *
     *      R.pathSatisfies(y => y > 0, ['x', 'y'], {x: {y: 2}}); //=> true
     */
    var pathSatisfies = _curry3(function pathSatisfies(pred, propPath, obj) {
        return propPath.length > 0 && pred(path(propPath, obj));
    });

    /**
     * Returns a partial copy of an object containing only the keys specified. If
     * the key does not exist, the property is ignored.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Object
     * @sig [k] -> {k: v} -> {k: v}
     * @param {Array} names an array of String property names to copy onto a new object
     * @param {Object} obj The object to copy from
     * @return {Object} A new object with only properties from `names` on it.
     * @see R.omit, R.props
     * @example
     *
     *      R.pick(['a', 'd'], {a: 1, b: 2, c: 3, d: 4}); //=> {a: 1, d: 4}
     *      R.pick(['a', 'e', 'f'], {a: 1, b: 2, c: 3, d: 4}); //=> {a: 1}
     */
    var pick = _curry2(function pick(names, obj) {
        var result = {};
        var idx = 0;
        while (idx < names.length) {
            if (names[idx] in obj) {
                result[names[idx]] = obj[names[idx]];
            }
            idx += 1;
        }
        return result;
    });

    /**
     * Similar to `pick` except that this one includes a `key: undefined` pair for
     * properties that don't exist.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Object
     * @sig [k] -> {k: v} -> {k: v}
     * @param {Array} names an array of String property names to copy onto a new object
     * @param {Object} obj The object to copy from
     * @return {Object} A new object with only properties from `names` on it.
     * @see R.pick
     * @example
     *
     *      R.pickAll(['a', 'd'], {a: 1, b: 2, c: 3, d: 4}); //=> {a: 1, d: 4}
     *      R.pickAll(['a', 'e', 'f'], {a: 1, b: 2, c: 3, d: 4}); //=> {a: 1, e: undefined, f: undefined}
     */
    var pickAll = _curry2(function pickAll(names, obj) {
        var result = {};
        var idx = 0;
        var len = names.length;
        while (idx < len) {
            var name = names[idx];
            result[name] = obj[name];
            idx += 1;
        }
        return result;
    });

    /**
     * Returns a partial copy of an object containing only the keys that satisfy
     * the supplied predicate.
     *
     * @func
     * @memberOf R
     * @since v0.8.0
     * @category Object
     * @sig (v, k -> Boolean) -> {k: v} -> {k: v}
     * @param {Function} pred A predicate to determine whether or not a key
     *        should be included on the output object.
     * @param {Object} obj The object to copy from
     * @return {Object} A new object with only properties that satisfy `pred`
     *         on it.
     * @see R.pick, R.filter
     * @example
     *
     *      var isUpperCase = (val, key) => key.toUpperCase() === key;
     *      R.pickBy(isUpperCase, {a: 1, b: 2, A: 3, B: 4}); //=> {A: 3, B: 4}
     */
    var pickBy = _curry2(function pickBy(test, obj) {
        var result = {};
        for (var prop in obj) {
            if (test(obj[prop], prop, obj)) {
                result[prop] = obj[prop];
            }
        }
        return result;
    });

    /**
     * Returns a new list with the given element at the front, followed by the
     * contents of the list.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig a -> [a] -> [a]
     * @param {*} el The item to add to the head of the output list.
     * @param {Array} list The array to add to the tail of the output list.
     * @return {Array} A new array.
     * @see R.append
     * @example
     *
     *      R.prepend('fee', ['fi', 'fo', 'fum']); //=> ['fee', 'fi', 'fo', 'fum']
     */
    var prepend = _curry2(function prepend(el, list) {
        return _concat([el], list);
    });

    /**
     * Returns a function that when supplied an object returns the indicated
     * property of that object, if it exists.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Object
     * @sig s -> {s: a} -> a | Undefined
     * @param {String} p The property name
     * @param {Object} obj The object to query
     * @return {*} The value at `obj.p`.
     * @example
     *
     *      R.prop('x', {x: 100}); //=> 100
     *      R.prop('x', {}); //=> undefined
     */
    var prop = _curry2(function prop(p, obj) {
        return obj[p];
    });

    /**
     * If the given, non-null object has an own property with the specified name,
     * returns the value of that property. Otherwise returns the provided default
     * value.
     *
     * @func
     * @memberOf R
     * @since v0.6.0
     * @category Object
     * @sig a -> String -> Object -> a
     * @param {*} val The default value.
     * @param {String} p The name of the property to return.
     * @param {Object} obj The object to query.
     * @return {*} The value of given property of the supplied object or the default value.
     * @example
     *
     *      var alice = {
     *        name: 'ALICE',
     *        age: 101
     *      };
     *      var favorite = R.prop('favoriteLibrary');
     *      var favoriteWithDefault = R.propOr('Ramda', 'favoriteLibrary');
     *
     *      favorite(alice);  //=> undefined
     *      favoriteWithDefault(alice);  //=> 'Ramda'
     */
    var propOr = _curry3(function propOr(val, p, obj) {
        return obj != null && _has(p, obj) ? obj[p] : val;
    });

    /**
     * Returns `true` if the specified object property satisfies the given
     * predicate; `false` otherwise.
     *
     * @func
     * @memberOf R
     * @since v0.16.0
     * @category Logic
     * @sig (a -> Boolean) -> String -> {String: a} -> Boolean
     * @param {Function} pred
     * @param {String} name
     * @param {*} obj
     * @return {Boolean}
     * @see R.propEq, R.propIs
     * @example
     *
     *      R.propSatisfies(x => x > 0, 'x', {x: 1, y: 2}); //=> true
     */
    var propSatisfies = _curry3(function propSatisfies(pred, name, obj) {
        return pred(obj[name]);
    });

    /**
     * Acts as multiple `prop`: array of keys in, array of values out. Preserves
     * order.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Object
     * @sig [k] -> {k: v} -> [v]
     * @param {Array} ps The property names to fetch
     * @param {Object} obj The object to query
     * @return {Array} The corresponding values or partially applied function.
     * @example
     *
     *      R.props(['x', 'y'], {x: 1, y: 2}); //=> [1, 2]
     *      R.props(['c', 'a', 'b'], {b: 2, a: 1}); //=> [undefined, 1, 2]
     *
     *      var fullName = R.compose(R.join(' '), R.props(['first', 'last']));
     *      fullName({last: 'Bullet-Tooth', age: 33, first: 'Tony'}); //=> 'Tony Bullet-Tooth'
     */
    var props = _curry2(function props(ps, obj) {
        var len = ps.length;
        var out = [];
        var idx = 0;
        while (idx < len) {
            out[idx] = obj[ps[idx]];
            idx += 1;
        }
        return out;
    });

    /**
     * Returns a list of numbers from `from` (inclusive) to `to` (exclusive).
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig Number -> Number -> [Number]
     * @param {Number} from The first number in the list.
     * @param {Number} to One more than the last number in the list.
     * @return {Array} The list of numbers in tthe set `[a, b)`.
     * @example
     *
     *      R.range(1, 5);    //=> [1, 2, 3, 4]
     *      R.range(50, 53);  //=> [50, 51, 52]
     */
    var range = _curry2(function range(from, to) {
        if (!(_isNumber(from) && _isNumber(to))) {
            throw new TypeError('Both arguments to range must be numbers');
        }
        var result = [];
        var n = from;
        while (n < to) {
            result.push(n);
            n += 1;
        }
        return result;
    });

    /**
     * Returns a single item by iterating through the list, successively calling
     * the iterator function and passing it an accumulator value and the current
     * value from the array, and then passing the result to the next call.
     *
     * Similar to `reduce`, except moves through the input list from the right to
     * the left.
     *
     * The iterator function receives two values: *(acc, value)*
     *
     * Note: `R.reduceRight` does not skip deleted or unassigned indices (sparse
     * arrays), unlike the native `Array.prototype.reduce` method. For more details
     * on this behavior, see:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduceRight#Description
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig (a,b -> a) -> a -> [b] -> a
     * @param {Function} fn The iterator function. Receives two values, the accumulator and the
     *        current element from the array.
     * @param {*} acc The accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @see R.addIndex
     * @example
     *
     *      var pairs = [ ['a', 1], ['b', 2], ['c', 3] ];
     *      var flattenPairs = (acc, pair) => acc.concat(pair);
     *
     *      R.reduceRight(flattenPairs, [], pairs); //=> [ 'c', 3, 'b', 2, 'a', 1 ]
     */
    var reduceRight = _curry3(function reduceRight(fn, acc, list) {
        var idx = list.length - 1;
        while (idx >= 0) {
            acc = fn(acc, list[idx]);
            idx -= 1;
        }
        return acc;
    });

    /**
     * Returns a value wrapped to indicate that it is the final value of the reduce
     * and transduce functions. The returned value should be considered a black
     * box: the internal structure is not guaranteed to be stable.
     *
     * Note: this optimization is unavailable to functions not explicitly listed
     * above. For instance, it is not currently supported by reduceRight.
     *
     * @func
     * @memberOf R
     * @since v0.15.0
     * @category List
     * @sig a -> *
     * @param {*} x The final value of the reduce.
     * @return {*} The wrapped value.
     * @see R.reduce, R.transduce
     * @example
     *
     *      R.reduce(
     *        R.pipe(R.add, R.when(R.gte(R.__, 10), R.reduced)),
     *        0,
     *        [1, 2, 3, 4, 5]) // 10
     */
    var reduced = _curry1(_reduced);

    /**
     * Removes the sub-list of `list` starting at index `start` and containing
     * `count` elements. _Note that this is not destructive_: it returns a copy of
     * the list with the changes.
     * <small>No lists have been harmed in the application of this function.</small>
     *
     * @func
     * @memberOf R
     * @since v0.2.2
     * @category List
     * @sig Number -> Number -> [a] -> [a]
     * @param {Number} start The position to start removing elements
     * @param {Number} count The number of elements to remove
     * @param {Array} list The list to remove from
     * @return {Array} A new Array with `count` elements from `start` removed.
     * @example
     *
     *      R.remove(2, 3, [1,2,3,4,5,6,7,8]); //=> [1,2,6,7,8]
     */
    var remove = _curry3(function remove(start, count, list) {
        return _concat(_slice(list, 0, Math.min(start, list.length)), _slice(list, Math.min(list.length, start + count)));
    });

    /**
     * Replace a substring or regex match in a string with a replacement.
     *
     * @func
     * @memberOf R
     * @since v0.7.0
     * @category String
     * @sig RegExp|String -> String -> String -> String
     * @param {RegExp|String} pattern A regular expression or a substring to match.
     * @param {String} replacement The string to replace the matches with.
     * @param {String} str The String to do the search and replacement in.
     * @return {String} The result.
     * @example
     *
     *      R.replace('foo', 'bar', 'foo foo foo'); //=> 'bar foo foo'
     *      R.replace(/foo/, 'bar', 'foo foo foo'); //=> 'bar foo foo'
     *
     *      // Use the "g" (global) flag to replace all occurrences:
     *      R.replace(/foo/g, 'bar', 'foo foo foo'); //=> 'bar bar bar'
     */
    var replace = _curry3(function replace(regex, replacement, str) {
        return str.replace(regex, replacement);
    });

    /**
     * Returns a new list or string with the elements or characters in reverse
     * order.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig [a] -> [a]
     * @sig String -> String
     * @param {Array|String} list
     * @return {Array|String}
     * @example
     *
     *      R.reverse([1, 2, 3]);  //=> [3, 2, 1]
     *      R.reverse([1, 2]);     //=> [2, 1]
     *      R.reverse([1]);        //=> [1]
     *      R.reverse([]);         //=> []
     *
     *      R.reverse('abc');      //=> 'cba'
     *      R.reverse('ab');       //=> 'ba'
     *      R.reverse('a');        //=> 'a'
     *      R.reverse('');         //=> ''
     */
    var reverse = _curry1(function reverse(list) {
        return _isString(list) ? list.split('').reverse().join('') : _slice(list).reverse();
    });

    /**
     * Scan is similar to reduce, but returns a list of successively reduced values
     * from the left
     *
     * @func
     * @memberOf R
     * @since v0.10.0
     * @category List
     * @sig (a,b -> a) -> a -> [b] -> [a]
     * @param {Function} fn The iterator function. Receives two values, the accumulator and the
     *        current element from the array
     * @param {*} acc The accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {Array} A list of all intermediately reduced values.
     * @example
     *
     *      var numbers = [1, 2, 3, 4];
     *      var factorials = R.scan(R.multiply, 1, numbers); //=> [1, 1, 2, 6, 24]
     */
    var scan = _curry3(function scan(fn, acc, list) {
        var idx = 0;
        var len = list.length;
        var result = [acc];
        while (idx < len) {
            acc = fn(acc, list[idx]);
            result[idx + 1] = acc;
            idx += 1;
        }
        return result;
    });

    /**
     * Returns the result of "setting" the portion of the given data structure
     * focused by the given lens to the given value.
     *
     * @func
     * @memberOf R
     * @since v0.16.0
     * @category Object
     * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
     * @sig Lens s a -> a -> s -> s
     * @param {Lens} lens
     * @param {*} v
     * @param {*} x
     * @return {*}
     * @see R.prop, R.lensIndex, R.lensProp
     * @example
     *
     *      var xLens = R.lensProp('x');
     *
     *      R.set(xLens, 4, {x: 1, y: 2});  //=> {x: 4, y: 2}
     *      R.set(xLens, 8, {x: 1, y: 2});  //=> {x: 8, y: 2}
     */
    var set = _curry3(function set(lens, v, x) {
        return over(lens, always(v), x);
    });

    /**
     * Returns the elements of the given list or string (or object with a `slice`
     * method) from `fromIndex` (inclusive) to `toIndex` (exclusive).
     *
     * Dispatches to the `slice` method of the third argument, if present.
     *
     * @func
     * @memberOf R
     * @since v0.1.4
     * @category List
     * @sig Number -> Number -> [a] -> [a]
     * @sig Number -> Number -> String -> String
     * @param {Number} fromIndex The start index (inclusive).
     * @param {Number} toIndex The end index (exclusive).
     * @param {*} list
     * @return {*}
     * @example
     *
     *      R.slice(1, 3, ['a', 'b', 'c', 'd']);        //=> ['b', 'c']
     *      R.slice(1, Infinity, ['a', 'b', 'c', 'd']); //=> ['b', 'c', 'd']
     *      R.slice(0, -1, ['a', 'b', 'c', 'd']);       //=> ['a', 'b', 'c']
     *      R.slice(-3, -1, ['a', 'b', 'c', 'd']);      //=> ['b', 'c']
     *      R.slice(0, 3, 'ramda');                     //=> 'ram'
     */
    var slice = _curry3(_checkForMethod('slice', function slice(fromIndex, toIndex, list) {
        return Array.prototype.slice.call(list, fromIndex, toIndex);
    }));

    /**
     * Returns a copy of the list, sorted according to the comparator function,
     * which should accept two values at a time and return a negative number if the
     * first value is smaller, a positive number if it's larger, and zero if they
     * are equal. Please note that this is a **copy** of the list. It does not
     * modify the original.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig (a,a -> Number) -> [a] -> [a]
     * @param {Function} comparator A sorting function :: a -> b -> Int
     * @param {Array} list The list to sort
     * @return {Array} a new array with its elements sorted by the comparator function.
     * @example
     *
     *      var diff = function(a, b) { return a - b; };
     *      R.sort(diff, [4,2,7,5]); //=> [2, 4, 5, 7]
     */
    var sort = _curry2(function sort(comparator, list) {
        return _slice(list).sort(comparator);
    });

    /**
     * Sorts the list according to the supplied function.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig Ord b => (a -> b) -> [a] -> [a]
     * @param {Function} fn
     * @param {Array} list The list to sort.
     * @return {Array} A new list sorted by the keys generated by `fn`.
     * @example
     *
     *      var sortByFirstItem = R.sortBy(R.prop(0));
     *      var sortByNameCaseInsensitive = R.sortBy(R.compose(R.toLower, R.prop('name')));
     *      var pairs = [[-1, 1], [-2, 2], [-3, 3]];
     *      sortByFirstItem(pairs); //=> [[-3, 3], [-2, 2], [-1, 1]]
     *      var alice = {
     *        name: 'ALICE',
     *        age: 101
     *      };
     *      var bob = {
     *        name: 'Bob',
     *        age: -10
     *      };
     *      var clara = {
     *        name: 'clara',
     *        age: 314.159
     *      };
     *      var people = [clara, bob, alice];
     *      sortByNameCaseInsensitive(people); //=> [alice, bob, clara]
     */
    var sortBy = _curry2(function sortBy(fn, list) {
        return _slice(list).sort(function (a, b) {
            var aa = fn(a);
            var bb = fn(b);
            return aa < bb ? -1 : aa > bb ? 1 : 0;
        });
    });

    /**
     * Splits a given list or string at a given index.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category List
     * @sig Number -> [a] -> [[a], [a]]
     * @sig Number -> String -> [String, String]
     * @param {Number} index The index where the array/string is split.
     * @param {Array|String} array The array/string to be split.
     * @return {Array}
     * @example
     *
     *      R.splitAt(1, [1, 2, 3]);          //=> [[1], [2, 3]]
     *      R.splitAt(5, 'hello world');      //=> ['hello', ' world']
     *      R.splitAt(-1, 'foobar');          //=> ['fooba', 'r']
     */
    var splitAt = _curry2(function splitAt(index, array) {
        return [
            slice(0, index, array),
            slice(index, length(array), array)
        ];
    });

    /**
     * Splits a collection into slices of the specified length.
     *
     * @func
     * @memberOf R
     * @since v0.16.0
     * @category List
     * @sig Number -> [a] -> [[a]]
     * @sig Number -> String -> [String]
     * @param {Number} n
     * @param {Array} list
     * @return {Array}
     * @example
     *
     *      R.splitEvery(3, [1, 2, 3, 4, 5, 6, 7]); //=> [[1, 2, 3], [4, 5, 6], [7]]
     *      R.splitEvery(3, 'foobarbaz'); //=> ['foo', 'bar', 'baz']
     */
    var splitEvery = _curry2(function splitEvery(n, list) {
        if (n <= 0) {
            throw new Error('First argument to splitEvery must be a positive integer');
        }
        var result = [];
        var idx = 0;
        while (idx < list.length) {
            result.push(slice(idx, idx += n, list));
        }
        return result;
    });

    /**
     * Takes a list and a predicate and returns a pair of lists with the following properties:
     *
     *  - the result of concatenating the two output lists is equivalent to the input list;
     *  - none of the elements of the first output list satisfies the predicate; and
     *  - if the second output list is non-empty, its first element satisfies the predicate.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category List
     * @sig (a -> Boolean) -> [a] -> [[a], [a]]
     * @param {Function} pred The predicate that determines where the array is split.
     * @param {Array} list The array to be split.
     * @return {Array}
     * @example
     *
     *      R.splitWhen(R.equals(2), [1, 2, 3, 1, 2, 3]);   //=> [[1], [2, 3, 1, 2, 3]]
     */
    var splitWhen = _curry2(function splitWhen(pred, list) {
        var idx = 0;
        var len = list.length;
        var prefix = [];
        while (idx < len && !pred(list[idx])) {
            prefix.push(list[idx]);
            idx += 1;
        }
        return [
            prefix,
            _slice(list, idx)
        ];
    });

    /**
     * Subtracts its second argument from its first argument.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Math
     * @sig Number -> Number -> Number
     * @param {Number} a The first value.
     * @param {Number} b The second value.
     * @return {Number} The result of `a - b`.
     * @see R.add
     * @example
     *
     *      R.subtract(10, 8); //=> 2
     *
     *      var minus5 = R.subtract(R.__, 5);
     *      minus5(17); //=> 12
     *
     *      var complementaryAngle = R.subtract(90);
     *      complementaryAngle(30); //=> 60
     *      complementaryAngle(72); //=> 18
     */
    var subtract = _curry2(function subtract(a, b) {
        return Number(a) - Number(b);
    });

    /**
     * Returns all but the first element of the given list or string (or object
     * with a `tail` method).
     *
     * Dispatches to the `slice` method of the first argument, if present.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig [a] -> [a]
     * @sig String -> String
     * @param {*} list
     * @return {*}
     * @see R.head, R.init, R.last
     * @example
     *
     *      R.tail([1, 2, 3]);  //=> [2, 3]
     *      R.tail([1, 2]);     //=> [2]
     *      R.tail([1]);        //=> []
     *      R.tail([]);         //=> []
     *
     *      R.tail('abc');  //=> 'bc'
     *      R.tail('ab');   //=> 'b'
     *      R.tail('a');    //=> ''
     *      R.tail('');     //=> ''
     */
    var tail = _checkForMethod('tail', slice(1, Infinity));

    /**
     * Returns the first `n` elements of the given list, string, or
     * transducer/transformer (or object with a `take` method).
     *
     * Dispatches to the `take` method of the second argument, if present.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig Number -> [a] -> [a]
     * @sig Number -> String -> String
     * @param {Number} n
     * @param {*} list
     * @return {*}
     * @see R.drop
     * @example
     *
     *      R.take(1, ['foo', 'bar', 'baz']); //=> ['foo']
     *      R.take(2, ['foo', 'bar', 'baz']); //=> ['foo', 'bar']
     *      R.take(3, ['foo', 'bar', 'baz']); //=> ['foo', 'bar', 'baz']
     *      R.take(4, ['foo', 'bar', 'baz']); //=> ['foo', 'bar', 'baz']
     *      R.take(3, 'ramda');               //=> 'ram'
     *
     *      var personnel = [
     *        'Dave Brubeck',
     *        'Paul Desmond',
     *        'Eugene Wright',
     *        'Joe Morello',
     *        'Gerry Mulligan',
     *        'Bob Bates',
     *        'Joe Dodge',
     *        'Ron Crotty'
     *      ];
     *
     *      var takeFive = R.take(5);
     *      takeFive(personnel);
     *      //=> ['Dave Brubeck', 'Paul Desmond', 'Eugene Wright', 'Joe Morello', 'Gerry Mulligan']
     */
    var take = _curry2(_dispatchable('take', _xtake, function take(n, xs) {
        return slice(0, n < 0 ? Infinity : n, xs);
    }));

    /**
     * Returns a new list containing the last `n` elements of a given list, passing
     * each value to the supplied predicate function, and terminating when the
     * predicate function returns `false`. Excludes the element that caused the
     * predicate function to fail. The predicate function is passed one argument:
     * *(value)*.
     *
     * @func
     * @memberOf R
     * @since v0.16.0
     * @category List
     * @sig (a -> Boolean) -> [a] -> [a]
     * @param {Function} fn The function called per iteration.
     * @param {Array} list The collection to iterate over.
     * @return {Array} A new array.
     * @see R.dropLastWhile, R.addIndex
     * @example
     *
     *      var isNotOne = x => x !== 1;
     *
     *      R.takeLastWhile(isNotOne, [1, 2, 3, 4]); //=> [2, 3, 4]
     */
    var takeLastWhile = _curry2(function takeLastWhile(fn, list) {
        var idx = list.length - 1;
        while (idx >= 0 && fn(list[idx])) {
            idx -= 1;
        }
        return _slice(list, idx + 1, Infinity);
    });

    /**
     * Returns a new list containing the first `n` elements of a given list,
     * passing each value to the supplied predicate function, and terminating when
     * the predicate function returns `false`. Excludes the element that caused the
     * predicate function to fail. The predicate function is passed one argument:
     * *(value)*.
     *
     * Dispatches to the `takeWhile` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig (a -> Boolean) -> [a] -> [a]
     * @param {Function} fn The function called per iteration.
     * @param {Array} list The collection to iterate over.
     * @return {Array} A new array.
     * @see R.dropWhile, R.transduce, R.addIndex
     * @example
     *
     *      var isNotFour = x => x !== 4;
     *
     *      R.takeWhile(isNotFour, [1, 2, 3, 4, 3, 2, 1]); //=> [1, 2, 3]
     */
    var takeWhile = _curry2(_dispatchable('takeWhile', _xtakeWhile, function takeWhile(fn, list) {
        var idx = 0;
        var len = list.length;
        while (idx < len && fn(list[idx])) {
            idx += 1;
        }
        return _slice(list, 0, idx);
    }));

    /**
     * Runs the given function with the supplied object, then returns the object.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig (a -> *) -> a -> a
     * @param {Function} fn The function to call with `x`. The return value of `fn` will be thrown away.
     * @param {*} x
     * @return {*} `x`.
     * @example
     *
     *      var sayX = x => console.log('x is ' + x);
     *      R.tap(sayX, 100); //=> 100
     *      //-> 'x is 100'
     */
    var tap = _curry2(function tap(fn, x) {
        fn(x);
        return x;
    });

    /**
     * Calls an input function `n` times, returning an array containing the results
     * of those function calls.
     *
     * `fn` is passed one argument: The current value of `n`, which begins at `0`
     * and is gradually incremented to `n - 1`.
     *
     * @func
     * @memberOf R
     * @since v0.2.3
     * @category List
     * @sig (Number -> a) -> Number -> [a]
     * @param {Function} fn The function to invoke. Passed one argument, the current value of `n`.
     * @param {Number} n A value between `0` and `n - 1`. Increments after each function call.
     * @return {Array} An array containing the return values of all calls to `fn`.
     * @example
     *
     *      R.times(R.identity, 5); //=> [0, 1, 2, 3, 4]
     */
    var times = _curry2(function times(fn, n) {
        var len = Number(n);
        var idx = 0;
        var list;
        if (len < 0 || isNaN(len)) {
            throw new RangeError('n must be a non-negative number');
        }
        list = new Array(len);
        while (idx < len) {
            list[idx] = fn(idx);
            idx += 1;
        }
        return list;
    });

    /**
     * Converts an object into an array of key, value arrays. Only the object's
     * own properties are used.
     * Note that the order of the output array is not guaranteed to be consistent
     * across different JS platforms.
     *
     * @func
     * @memberOf R
     * @since v0.4.0
     * @category Object
     * @sig {String: *} -> [[String,*]]
     * @param {Object} obj The object to extract from
     * @return {Array} An array of key, value arrays from the object's own properties.
     * @see R.fromPairs
     * @example
     *
     *      R.toPairs({a: 1, b: 2, c: 3}); //=> [['a', 1], ['b', 2], ['c', 3]]
     */
    var toPairs = _curry1(function toPairs(obj) {
        var pairs = [];
        for (var prop in obj) {
            if (_has(prop, obj)) {
                pairs[pairs.length] = [
                    prop,
                    obj[prop]
                ];
            }
        }
        return pairs;
    });

    /**
     * Converts an object into an array of key, value arrays. The object's own
     * properties and prototype properties are used. Note that the order of the
     * output array is not guaranteed to be consistent across different JS
     * platforms.
     *
     * @func
     * @memberOf R
     * @since v0.4.0
     * @category Object
     * @sig {String: *} -> [[String,*]]
     * @param {Object} obj The object to extract from
     * @return {Array} An array of key, value arrays from the object's own
     *         and prototype properties.
     * @example
     *
     *      var F = function() { this.x = 'X'; };
     *      F.prototype.y = 'Y';
     *      var f = new F();
     *      R.toPairsIn(f); //=> [['x','X'], ['y','Y']]
     */
    var toPairsIn = _curry1(function toPairsIn(obj) {
        var pairs = [];
        for (var prop in obj) {
            pairs[pairs.length] = [
                prop,
                obj[prop]
            ];
        }
        return pairs;
    });

    /**
     * Transposes the rows and columns of a 2D list.
     * When passed a list of `n` lists of length `x`,
     * returns a list of `x` lists of length `n`.
     *
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category List
     * @sig [[a]] -> [[a]]
     * @param {Array} list A 2D list
     * @return {Array} A 2D list
     * @example
     *
     *      R.transpose([[1, 'a'], [2, 'b'], [3, 'c']]) //=> [[1, 2, 3], ['a', 'b', 'c']]
     *      R.transpose([[1, 2, 3], ['a', 'b', 'c']]) //=> [[1, 'a'], [2, 'b'], [3, 'c']]
     *
     * If some of the rows are shorter than the following rows, their elements are skipped:
     *
     *      R.transpose([[10, 11], [20], [], [30, 31, 32]]) //=> [[10, 20, 30], [11, 31], [32]]
     */
    var transpose = _curry1(function transpose(outerlist) {
        var i = 0;
        var result = [];
        while (i < outerlist.length) {
            var innerlist = outerlist[i];
            var j = 0;
            while (j < innerlist.length) {
                if (typeof result[j] === 'undefined') {
                    result[j] = [];
                }
                result[j].push(innerlist[j]);
                j += 1;
            }
            i += 1;
        }
        return result;
    });

    /**
     * Removes (strips) whitespace from both ends of the string.
     *
     * @func
     * @memberOf R
     * @since v0.6.0
     * @category String
     * @sig String -> String
     * @param {String} str The string to trim.
     * @return {String} Trimmed version of `str`.
     * @example
     *
     *      R.trim('   xyz  '); //=> 'xyz'
     *      R.map(R.trim, R.split(',', 'x, y, z')); //=> ['x', 'y', 'z']
     */
    var trim = function () {
        var ws = '\t\n\x0B\f\r \xA0\u1680\u180E\u2000\u2001\u2002\u2003' + '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028' + '\u2029\uFEFF';
        var zeroWidth = '\u200B';
        var hasProtoTrim = typeof String.prototype.trim === 'function';
        if (!hasProtoTrim || (ws.trim() || !zeroWidth.trim())) {
            return _curry1(function trim(str) {
                var beginRx = new RegExp('^[' + ws + '][' + ws + ']*');
                var endRx = new RegExp('[' + ws + '][' + ws + ']*$');
                return str.replace(beginRx, '').replace(endRx, '');
            });
        } else {
            return _curry1(function trim(str) {
                return str.trim();
            });
        }
    }();

    /**
     * `tryCatch` takes two functions, a `tryer` and a `catcher`. The returned
     * function evaluates the `tryer`; if it does not throw, it simply returns the
     * result. If the `tryer` *does* throw, the returned function evaluates the
     * `catcher` function and returns its result. Note that for effective
     * composition with this function, both the `tryer` and `catcher` functions
     * must return the same type of results.
     *
     * @func
     * @memberOf R
     * @since v0.20.0
     * @category Function
     * @sig (...x -> a) -> ((e, ...x) -> a) -> (...x -> a)
     * @param {Function} tryer The function that may throw.
     * @param {Function} catcher The function that will be evaluated if `tryer` throws.
     * @return {Function} A new function that will catch exceptions and send then to the catcher.
     * @example
     *
     *      R.tryCatch(R.prop('x'), R.F, {x: true}); //=> true
     *      R.tryCatch(R.prop('x'), R.F, null);      //=> false
     */
    var tryCatch = _curry2(function _tryCatch(tryer, catcher) {
        return _arity(tryer.length, function () {
            try {
                return tryer.apply(this, arguments);
            } catch (e) {
                return catcher.apply(this, _concat([e], arguments));
            }
        });
    });

    /**
     * Gives a single-word string description of the (native) type of a value,
     * returning such answers as 'Object', 'Number', 'Array', or 'Null'. Does not
     * attempt to distinguish user Object types any further, reporting them all as
     * 'Object'.
     *
     * @func
     * @memberOf R
     * @since v0.8.0
     * @category Type
     * @sig (* -> {*}) -> String
     * @param {*} val The value to test
     * @return {String}
     * @example
     *
     *      R.type({}); //=> "Object"
     *      R.type(1); //=> "Number"
     *      R.type(false); //=> "Boolean"
     *      R.type('s'); //=> "String"
     *      R.type(null); //=> "Null"
     *      R.type([]); //=> "Array"
     *      R.type(/[A-z]/); //=> "RegExp"
     */
    var type = _curry1(function type(val) {
        return val === null ? 'Null' : val === undefined ? 'Undefined' : Object.prototype.toString.call(val).slice(8, -1);
    });

    /**
     * Takes a function `fn`, which takes a single array argument, and returns a
     * function which:
     *
     *   - takes any number of positional arguments;
     *   - passes these arguments to `fn` as an array; and
     *   - returns the result.
     *
     * In other words, R.unapply derives a variadic function from a function which
     * takes an array. R.unapply is the inverse of R.apply.
     *
     * @func
     * @memberOf R
     * @since v0.8.0
     * @category Function
     * @sig ([*...] -> a) -> (*... -> a)
     * @param {Function} fn
     * @return {Function}
     * @see R.apply
     * @example
     *
     *      R.unapply(JSON.stringify)(1, 2, 3); //=> '[1,2,3]'
     */
    var unapply = _curry1(function unapply(fn) {
        return function () {
            return fn(_slice(arguments));
        };
    });

    /**
     * Wraps a function of any arity (including nullary) in a function that accepts
     * exactly 1 parameter. Any extraneous parameters will not be passed to the
     * supplied function.
     *
     * @func
     * @memberOf R
     * @since v0.2.0
     * @category Function
     * @sig (* -> b) -> (a -> b)
     * @param {Function} fn The function to wrap.
     * @return {Function} A new function wrapping `fn`. The new function is guaranteed to be of
     *         arity 1.
     * @example
     *
     *      var takesTwoArgs = function(a, b) {
     *        return [a, b];
     *      };
     *      takesTwoArgs.length; //=> 2
     *      takesTwoArgs(1, 2); //=> [1, 2]
     *
     *      var takesOneArg = R.unary(takesTwoArgs);
     *      takesOneArg.length; //=> 1
     *      // Only 1 argument is passed to the wrapped function
     *      takesOneArg(1, 2); //=> [1, undefined]
     */
    var unary = _curry1(function unary(fn) {
        return nAry(1, fn);
    });

    /**
     * Returns a function of arity `n` from a (manually) curried function.
     *
     * @func
     * @memberOf R
     * @since v0.14.0
     * @category Function
     * @sig Number -> (a -> b) -> (a -> c)
     * @param {Number} length The arity for the returned function.
     * @param {Function} fn The function to uncurry.
     * @return {Function} A new function.
     * @see R.curry
     * @example
     *
     *      var addFour = a => b => c => d => a + b + c + d;
     *
     *      var uncurriedAddFour = R.uncurryN(4, addFour);
     *      uncurriedAddFour(1, 2, 3, 4); //=> 10
     */
    var uncurryN = _curry2(function uncurryN(depth, fn) {
        return curryN(depth, function () {
            var currentDepth = 1;
            var value = fn;
            var idx = 0;
            var endIdx;
            while (currentDepth <= depth && typeof value === 'function') {
                endIdx = currentDepth === depth ? arguments.length : idx + value.length;
                value = value.apply(this, _slice(arguments, idx, endIdx));
                currentDepth += 1;
                idx = endIdx;
            }
            return value;
        });
    });

    /**
     * Builds a list from a seed value. Accepts an iterator function, which returns
     * either false to stop iteration or an array of length 2 containing the value
     * to add to the resulting list and the seed to be used in the next call to the
     * iterator function.
     *
     * The iterator function receives one argument: *(seed)*.
     *
     * @func
     * @memberOf R
     * @since v0.10.0
     * @category List
     * @sig (a -> [b]) -> * -> [b]
     * @param {Function} fn The iterator function. receives one argument, `seed`, and returns
     *        either false to quit iteration or an array of length two to proceed. The element
     *        at index 0 of this array will be added to the resulting array, and the element
     *        at index 1 will be passed to the next call to `fn`.
     * @param {*} seed The seed value.
     * @return {Array} The final list.
     * @example
     *
     *      var f = n => n > 50 ? false : [-n, n + 10];
     *      R.unfold(f, 10); //=> [-10, -20, -30, -40, -50]
     */
    var unfold = _curry2(function unfold(fn, seed) {
        var pair = fn(seed);
        var result = [];
        while (pair && pair.length) {
            result[result.length] = pair[0];
            pair = fn(pair[1]);
        }
        return result;
    });

    /**
     * Returns a new list containing only one copy of each element in the original
     * list, based upon the value returned by applying the supplied predicate to
     * two list elements. Prefers the first item if two items compare equal based
     * on the predicate.
     *
     * @func
     * @memberOf R
     * @since v0.2.0
     * @category List
     * @sig (a, a -> Boolean) -> [a] -> [a]
     * @param {Function} pred A predicate used to test whether two items are equal.
     * @param {Array} list The array to consider.
     * @return {Array} The list of unique items.
     * @example
     *
     *      var strEq = R.eqBy(String);
     *      R.uniqWith(strEq)([1, '1', 2, 1]); //=> [1, 2]
     *      R.uniqWith(strEq)([{}, {}]);       //=> [{}]
     *      R.uniqWith(strEq)([1, '1', 1]);    //=> [1]
     *      R.uniqWith(strEq)(['1', 1, 1]);    //=> ['1']
     */
    var uniqWith = _curry2(function uniqWith(pred, list) {
        var idx = 0;
        var len = list.length;
        var result = [];
        var item;
        while (idx < len) {
            item = list[idx];
            if (!_containsWith(pred, item, result)) {
                result[result.length] = item;
            }
            idx += 1;
        }
        return result;
    });

    /**
     * Tests the final argument by passing it to the given predicate function. If
     * the predicate is not satisfied, the function will return the result of
     * calling the `whenFalseFn` function with the same argument. If the predicate
     * is satisfied, the argument is returned as is.
     *
     * @func
     * @memberOf R
     * @since v0.18.0
     * @category Logic
     * @sig (a -> Boolean) -> (a -> a) -> a -> a
     * @param {Function} pred        A predicate function
     * @param {Function} whenFalseFn A function to invoke when the `pred` evaluates
     *                               to a falsy value.
     * @param {*}        x           An object to test with the `pred` function and
     *                               pass to `whenFalseFn` if necessary.
     * @return {*} Either `x` or the result of applying `x` to `whenFalseFn`.
     * @see R.ifElse, R.when
     * @example
     *
     *      // coerceArray :: (a|[a]) -> [a]
     *      var coerceArray = R.unless(R.isArrayLike, R.of);
     *      coerceArray([1, 2, 3]); //=> [1, 2, 3]
     *      coerceArray(1);         //=> [1]
     */
    var unless = _curry3(function unless(pred, whenFalseFn, x) {
        return pred(x) ? x : whenFalseFn(x);
    });

    /**
     * Takes a predicate, a transformation function, and an initial value,
     * and returns a value of the same type as the initial value.
     * It does so by applying the transformation until the predicate is satisfied,
     * at which point it returns the satisfactory value.
     *
     * @func
     * @memberOf R
     * @since v0.20.0
     * @category Logic
     * @sig (a -> Boolean) -> (a -> a) -> a -> a
     * @param {Function} pred A predicate function
     * @param {Function} fn The iterator function
     * @param {*} init Initial value
     * @return {*} Final value that satisfies predicate
     * @example
     *
     *      R.until(R.gt(R.__, 100), R.multiply(2))(1) // => 128
     */
    var until = _curry3(function until(pred, fn, init) {
        var val = init;
        while (!pred(val)) {
            val = fn(val);
        }
        return val;
    });

    /**
     * Returns a new copy of the array with the element at the provided index
     * replaced with the given value.
     *
     * @func
     * @memberOf R
     * @since v0.14.0
     * @category List
     * @sig Number -> a -> [a] -> [a]
     * @param {Number} idx The index to update.
     * @param {*} x The value to exist at the given index of the returned array.
     * @param {Array|Arguments} list The source array-like object to be updated.
     * @return {Array} A copy of `list` with the value at index `idx` replaced with `x`.
     * @see R.adjust
     * @example
     *
     *      R.update(1, 11, [0, 1, 2]);     //=> [0, 11, 2]
     *      R.update(1)(11)([0, 1, 2]);     //=> [0, 11, 2]
     */
    var update = _curry3(function update(idx, x, list) {
        return adjust(always(x), idx, list);
    });

    /**
     * Accepts a function `fn` and a list of transformer functions and returns a
     * new curried function. When the new function is invoked, it calls the
     * function `fn` with parameters consisting of the result of calling each
     * supplied handler on successive arguments to the new function.
     *
     * If more arguments are passed to the returned function than transformer
     * functions, those arguments are passed directly to `fn` as additional
     * parameters. If you expect additional arguments that don't need to be
     * transformed, although you can ignore them, it's best to pass an identity
     * function so that the new function reports the correct arity.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig (x1 -> x2 -> ... -> z) -> [(a -> x1), (b -> x2), ...] -> (a -> b -> ... -> z)
     * @param {Function} fn The function to wrap.
     * @param {Array} transformers A list of transformer functions
     * @return {Function} The wrapped function.
     * @example
     *
     *      R.useWith(Math.pow, [R.identity, R.identity])(3, 4); //=> 81
     *      R.useWith(Math.pow, [R.identity, R.identity])(3)(4); //=> 81
     *      R.useWith(Math.pow, [R.dec, R.inc])(3, 4); //=> 32
     *      R.useWith(Math.pow, [R.dec, R.inc])(3)(4); //=> 32
     */
    var useWith = _curry2(function useWith(fn, transformers) {
        return curryN(transformers.length, function () {
            var args = [];
            var idx = 0;
            while (idx < transformers.length) {
                args.push(transformers[idx].call(this, arguments[idx]));
                idx += 1;
            }
            return fn.apply(this, args.concat(_slice(arguments, transformers.length)));
        });
    });

    /**
     * Returns a list of all the enumerable own properties of the supplied object.
     * Note that the order of the output array is not guaranteed across different
     * JS platforms.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Object
     * @sig {k: v} -> [v]
     * @param {Object} obj The object to extract values from
     * @return {Array} An array of the values of the object's own properties.
     * @example
     *
     *      R.values({a: 1, b: 2, c: 3}); //=> [1, 2, 3]
     */
    var values = _curry1(function values(obj) {
        var props = keys(obj);
        var len = props.length;
        var vals = [];
        var idx = 0;
        while (idx < len) {
            vals[idx] = obj[props[idx]];
            idx += 1;
        }
        return vals;
    });

    /**
     * Returns a list of all the properties, including prototype properties, of the
     * supplied object.
     * Note that the order of the output array is not guaranteed to be consistent
     * across different JS platforms.
     *
     * @func
     * @memberOf R
     * @since v0.2.0
     * @category Object
     * @sig {k: v} -> [v]
     * @param {Object} obj The object to extract values from
     * @return {Array} An array of the values of the object's own and prototype properties.
     * @example
     *
     *      var F = function() { this.x = 'X'; };
     *      F.prototype.y = 'Y';
     *      var f = new F();
     *      R.valuesIn(f); //=> ['X', 'Y']
     */
    var valuesIn = _curry1(function valuesIn(obj) {
        var prop;
        var vs = [];
        for (prop in obj) {
            vs[vs.length] = obj[prop];
        }
        return vs;
    });

    /**
     * Returns a "view" of the given data structure, determined by the given lens.
     * The lens's focus determines which portion of the data structure is visible.
     *
     * @func
     * @memberOf R
     * @since v0.16.0
     * @category Object
     * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
     * @sig Lens s a -> s -> a
     * @param {Lens} lens
     * @param {*} x
     * @return {*}
     * @see R.prop, R.lensIndex, R.lensProp
     * @example
     *
     *      var xLens = R.lensProp('x');
     *
     *      R.view(xLens, {x: 1, y: 2});  //=> 1
     *      R.view(xLens, {x: 4, y: 2});  //=> 4
     */
    // `Const` is a functor that effectively ignores the function given to `map`.
    // Using `Const` effectively ignores the setter function of the `lens`,
    // leaving the value returned by the getter function unmodified.
    var view = function () {
        // `Const` is a functor that effectively ignores the function given to `map`.
        var Const = function (x) {
            return {
                value: x,
                map: function () {
                    return this;
                }
            };
        };
        return _curry2(function view(lens, x) {
            // Using `Const` effectively ignores the setter function of the `lens`,
            // leaving the value returned by the getter function unmodified.
            return lens(Const)(x).value;
        });
    }();

    /**
     * Tests the final argument by passing it to the given predicate function. If
     * the predicate is satisfied, the function will return the result of calling
     * the `whenTrueFn` function with the same argument. If the predicate is not
     * satisfied, the argument is returned as is.
     *
     * @func
     * @memberOf R
     * @since v0.18.0
     * @category Logic
     * @sig (a -> Boolean) -> (a -> a) -> a -> a
     * @param {Function} pred       A predicate function
     * @param {Function} whenTrueFn A function to invoke when the `condition`
     *                              evaluates to a truthy value.
     * @param {*}        x          An object to test with the `pred` function and
     *                              pass to `whenTrueFn` if necessary.
     * @return {*} Either `x` or the result of applying `x` to `whenTrueFn`.
     * @see R.ifElse, R.unless
     * @example
     *
     *      // truncate :: String -> String
     *      var truncate = R.when(
     *        R.propSatisfies(R.gt(R.__, 10), 'length'),
     *        R.pipe(R.take(10), R.append('…'), R.join(''))
     *      );
     *      truncate('12345');         //=> '12345'
     *      truncate('0123456789ABC'); //=> '0123456789…'
     */
    var when = _curry3(function when(pred, whenTrueFn, x) {
        return pred(x) ? whenTrueFn(x) : x;
    });

    /**
     * Takes a spec object and a test object; returns true if the test satisfies
     * the spec. Each of the spec's own properties must be a predicate function.
     * Each predicate is applied to the value of the corresponding property of the
     * test object. `where` returns true if all the predicates return true, false
     * otherwise.
     *
     * `where` is well suited to declaratively expressing constraints for other
     * functions such as `filter` and `find`.
     *
     * @func
     * @memberOf R
     * @since v0.1.1
     * @category Object
     * @sig {String: (* -> Boolean)} -> {String: *} -> Boolean
     * @param {Object} spec
     * @param {Object} testObj
     * @return {Boolean}
     * @example
     *
     *      // pred :: Object -> Boolean
     *      var pred = R.where({
     *        a: R.equals('foo'),
     *        b: R.complement(R.equals('bar')),
     *        x: R.gt(_, 10),
     *        y: R.lt(_, 20)
     *      });
     *
     *      pred({a: 'foo', b: 'xxx', x: 11, y: 19}); //=> true
     *      pred({a: 'xxx', b: 'xxx', x: 11, y: 19}); //=> false
     *      pred({a: 'foo', b: 'bar', x: 11, y: 19}); //=> false
     *      pred({a: 'foo', b: 'xxx', x: 10, y: 19}); //=> false
     *      pred({a: 'foo', b: 'xxx', x: 11, y: 20}); //=> false
     */
    var where = _curry2(function where(spec, testObj) {
        for (var prop in spec) {
            if (_has(prop, spec) && !spec[prop](testObj[prop])) {
                return false;
            }
        }
        return true;
    });

    /**
     * Wrap a function inside another to allow you to make adjustments to the
     * parameters, or do other processing either before the internal function is
     * called or with its results.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig (a... -> b) -> ((a... -> b) -> a... -> c) -> (a... -> c)
     * @param {Function} fn The function to wrap.
     * @param {Function} wrapper The wrapper function.
     * @return {Function} The wrapped function.
     * @example
     *
     *      var greet = name => 'Hello ' + name;
     *
     *      var shoutedGreet = R.wrap(greet, (gr, name) => gr(name).toUpperCase());
     *
     *      shoutedGreet("Kathy"); //=> "HELLO KATHY"
     *
     *      var shortenedGreet = R.wrap(greet, function(gr, name) {
     *        return gr(name.substring(0, 3));
     *      });
     *      shortenedGreet("Robert"); //=> "Hello Rob"
     */
    var wrap = _curry2(function wrap(fn, wrapper) {
        return curryN(fn.length, function () {
            return wrapper.apply(this, _concat([fn], arguments));
        });
    });

    /**
     * Creates a new list out of the two supplied by creating each possible pair
     * from the lists.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig [a] -> [b] -> [[a,b]]
     * @param {Array} as The first list.
     * @param {Array} bs The second list.
     * @return {Array} The list made by combining each possible pair from
     *         `as` and `bs` into pairs (`[a, b]`).
     * @example
     *
     *      R.xprod([1, 2], ['a', 'b']); //=> [[1, 'a'], [1, 'b'], [2, 'a'], [2, 'b']]
     */
    // = xprodWith(prepend); (takes about 3 times as long...)
    var xprod = _curry2(function xprod(a, b) {
        // = xprodWith(prepend); (takes about 3 times as long...)
        var idx = 0;
        var ilen = a.length;
        var j;
        var jlen = b.length;
        var result = [];
        while (idx < ilen) {
            j = 0;
            while (j < jlen) {
                result[result.length] = [
                    a[idx],
                    b[j]
                ];
                j += 1;
            }
            idx += 1;
        }
        return result;
    });

    /**
     * Creates a new list out of the two supplied by pairing up equally-positioned
     * items from both lists. The returned list is truncated to the length of the
     * shorter of the two input lists.
     * Note: `zip` is equivalent to `zipWith(function(a, b) { return [a, b] })`.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig [a] -> [b] -> [[a,b]]
     * @param {Array} list1 The first array to consider.
     * @param {Array} list2 The second array to consider.
     * @return {Array} The list made by pairing up same-indexed elements of `list1` and `list2`.
     * @example
     *
     *      R.zip([1, 2, 3], ['a', 'b', 'c']); //=> [[1, 'a'], [2, 'b'], [3, 'c']]
     */
    var zip = _curry2(function zip(a, b) {
        var rv = [];
        var idx = 0;
        var len = Math.min(a.length, b.length);
        while (idx < len) {
            rv[idx] = [
                a[idx],
                b[idx]
            ];
            idx += 1;
        }
        return rv;
    });

    /**
     * Creates a new object out of a list of keys and a list of values.
     * Key/value pairing is truncated to the length of the shorter of the two lists.
     * Note: `zipObj` is equivalent to `pipe(zipWith(pair), fromPairs)`.
     *
     * @func
     * @memberOf R
     * @since v0.3.0
     * @category List
     * @sig [String] -> [*] -> {String: *}
     * @param {Array} keys The array that will be properties on the output object.
     * @param {Array} values The list of values on the output object.
     * @return {Object} The object made by pairing up same-indexed elements of `keys` and `values`.
     * @example
     *
     *      R.zipObj(['a', 'b', 'c'], [1, 2, 3]); //=> {a: 1, b: 2, c: 3}
     */
    var zipObj = _curry2(function zipObj(keys, values) {
        var idx = 0;
        var len = Math.min(keys.length, values.length);
        var out = {};
        while (idx < len) {
            out[keys[idx]] = values[idx];
            idx += 1;
        }
        return out;
    });

    /**
     * Creates a new list out of the two supplied by applying the function to each
     * equally-positioned pair in the lists. The returned list is truncated to the
     * length of the shorter of the two input lists.
     *
     * @function
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig (a,b -> c) -> [a] -> [b] -> [c]
     * @param {Function} fn The function used to combine the two elements into one value.
     * @param {Array} list1 The first array to consider.
     * @param {Array} list2 The second array to consider.
     * @return {Array} The list made by combining same-indexed elements of `list1` and `list2`
     *         using `fn`.
     * @example
     *
     *      var f = (x, y) => {
     *        // ...
     *      };
     *      R.zipWith(f, [1, 2, 3], ['a', 'b', 'c']);
     *      //=> [f(1, 'a'), f(2, 'b'), f(3, 'c')]
     */
    var zipWith = _curry3(function zipWith(fn, a, b) {
        var rv = [];
        var idx = 0;
        var len = Math.min(a.length, b.length);
        while (idx < len) {
            rv[idx] = fn(a[idx], b[idx]);
            idx += 1;
        }
        return rv;
    });

    /**
     * A function that always returns `false`. Any passed in parameters are ignored.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Function
     * @sig * -> Boolean
     * @param {*}
     * @return {Boolean}
     * @see R.always, R.T
     * @example
     *
     *      R.F(); //=> false
     */
    var F = always(false);

    /**
     * A function that always returns `true`. Any passed in parameters are ignored.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Function
     * @sig * -> Boolean
     * @param {*}
     * @return {Boolean}
     * @see R.always, R.F
     * @example
     *
     *      R.T(); //=> true
     */
    var T = always(true);

    /**
     * Copies an object.
     *
     * @private
     * @param {*} value The value to be copied
     * @param {Array} refFrom Array containing the source references
     * @param {Array} refTo Array containing the copied source references
     * @param {Boolean} deep Whether or not to perform deep cloning.
     * @return {*} The copied value.
     */
    var _clone = function _clone(value, refFrom, refTo, deep) {
        var copy = function copy(copiedValue) {
            var len = refFrom.length;
            var idx = 0;
            while (idx < len) {
                if (value === refFrom[idx]) {
                    return refTo[idx];
                }
                idx += 1;
            }
            refFrom[idx + 1] = value;
            refTo[idx + 1] = copiedValue;
            for (var key in value) {
                copiedValue[key] = deep ? _clone(value[key], refFrom, refTo, true) : value[key];
            }
            return copiedValue;
        };
        switch (type(value)) {
        case 'Object':
            return copy({});
        case 'Array':
            return copy([]);
        case 'Date':
            return new Date(value.valueOf());
        case 'RegExp':
            return _cloneRegExp(value);
        default:
            return value;
        }
    };

    var _createPartialApplicator = function _createPartialApplicator(concat) {
        return _curry2(function (fn, args) {
            return _arity(Math.max(0, fn.length - args.length), function () {
                return fn.apply(this, concat(args, arguments));
            });
        });
    };

    var _dropLast = function dropLast(n, xs) {
        return take(n < xs.length ? xs.length - n : 0, xs);
    };

    // Values of other types are only equal if identical.
    var _equals = function _equals(a, b, stackA, stackB) {
        if (identical(a, b)) {
            return true;
        }
        if (type(a) !== type(b)) {
            return false;
        }
        if (a == null || b == null) {
            return false;
        }
        if (typeof a.equals === 'function' || typeof b.equals === 'function') {
            return typeof a.equals === 'function' && a.equals(b) && typeof b.equals === 'function' && b.equals(a);
        }
        switch (type(a)) {
        case 'Arguments':
        case 'Array':
        case 'Object':
            if (typeof a.constructor === 'function' && _functionName(a.constructor) === 'Promise') {
                return a === b;
            }
            break;
        case 'Boolean':
        case 'Number':
        case 'String':
            if (!(typeof a === typeof b && identical(a.valueOf(), b.valueOf()))) {
                return false;
            }
            break;
        case 'Date':
            if (!identical(a.valueOf(), b.valueOf())) {
                return false;
            }
            break;
        case 'Error':
            return a.name === b.name && a.message === b.message;
        case 'RegExp':
            if (!(a.source === b.source && a.global === b.global && a.ignoreCase === b.ignoreCase && a.multiline === b.multiline && a.sticky === b.sticky && a.unicode === b.unicode)) {
                return false;
            }
            break;
        case 'Map':
        case 'Set':
            if (!_equals(_arrayFromIterator(a.entries()), _arrayFromIterator(b.entries()), stackA, stackB)) {
                return false;
            }
            break;
        case 'Int8Array':
        case 'Uint8Array':
        case 'Uint8ClampedArray':
        case 'Int16Array':
        case 'Uint16Array':
        case 'Int32Array':
        case 'Uint32Array':
        case 'Float32Array':
        case 'Float64Array':
            break;
        case 'ArrayBuffer':
            break;
        default:
            // Values of other types are only equal if identical.
            return false;
        }
        var keysA = keys(a);
        if (keysA.length !== keys(b).length) {
            return false;
        }
        var idx = stackA.length - 1;
        while (idx >= 0) {
            if (stackA[idx] === a) {
                return stackB[idx] === b;
            }
            idx -= 1;
        }
        stackA.push(a);
        stackB.push(b);
        idx = keysA.length - 1;
        while (idx >= 0) {
            var key = keysA[idx];
            if (!(_has(key, b) && _equals(b[key], a[key], stackA, stackB))) {
                return false;
            }
            idx -= 1;
        }
        stackA.pop();
        stackB.pop();
        return true;
    };

    /**
     * `_makeFlat` is a helper function that returns a one-level or fully recursive
     * function based on the flag passed in.
     *
     * @private
     */
    var _makeFlat = function _makeFlat(recursive) {
        return function flatt(list) {
            var value, jlen, j;
            var result = [];
            var idx = 0;
            var ilen = list.length;
            while (idx < ilen) {
                if (isArrayLike(list[idx])) {
                    value = recursive ? flatt(list[idx]) : list[idx];
                    j = 0;
                    jlen = value.length;
                    while (j < jlen) {
                        result[result.length] = value[j];
                        j += 1;
                    }
                } else {
                    result[result.length] = list[idx];
                }
                idx += 1;
            }
            return result;
        };
    };

    var _reduce = function () {
        function _arrayReduce(xf, acc, list) {
            var idx = 0;
            var len = list.length;
            while (idx < len) {
                acc = xf['@@transducer/step'](acc, list[idx]);
                if (acc && acc['@@transducer/reduced']) {
                    acc = acc['@@transducer/value'];
                    break;
                }
                idx += 1;
            }
            return xf['@@transducer/result'](acc);
        }
        function _iterableReduce(xf, acc, iter) {
            var step = iter.next();
            while (!step.done) {
                acc = xf['@@transducer/step'](acc, step.value);
                if (acc && acc['@@transducer/reduced']) {
                    acc = acc['@@transducer/value'];
                    break;
                }
                step = iter.next();
            }
            return xf['@@transducer/result'](acc);
        }
        function _methodReduce(xf, acc, obj) {
            return xf['@@transducer/result'](obj.reduce(bind(xf['@@transducer/step'], xf), acc));
        }
        var symIterator = typeof Symbol !== 'undefined' ? Symbol.iterator : '@@iterator';
        return function _reduce(fn, acc, list) {
            if (typeof fn === 'function') {
                fn = _xwrap(fn);
            }
            if (isArrayLike(list)) {
                return _arrayReduce(fn, acc, list);
            }
            if (typeof list.reduce === 'function') {
                return _methodReduce(fn, acc, list);
            }
            if (list[symIterator] != null) {
                return _iterableReduce(fn, acc, list[symIterator]());
            }
            if (typeof list.next === 'function') {
                return _iterableReduce(fn, acc, list);
            }
            throw new TypeError('reduce: list must be array or iterable');
        };
    }();

    var _stepCat = function () {
        var _stepCatArray = {
            '@@transducer/init': Array,
            '@@transducer/step': function (xs, x) {
                xs.push(x);
                return xs;
            },
            '@@transducer/result': _identity
        };
        var _stepCatString = {
            '@@transducer/init': String,
            '@@transducer/step': function (a, b) {
                return a + b;
            },
            '@@transducer/result': _identity
        };
        var _stepCatObject = {
            '@@transducer/init': Object,
            '@@transducer/step': function (result, input) {
                return _assign(result, isArrayLike(input) ? objOf(input[0], input[1]) : input);
            },
            '@@transducer/result': _identity
        };
        return function _stepCat(obj) {
            if (_isTransformer(obj)) {
                return obj;
            }
            if (isArrayLike(obj)) {
                return _stepCatArray;
            }
            if (typeof obj === 'string') {
                return _stepCatString;
            }
            if (typeof obj === 'object') {
                return _stepCatObject;
            }
            throw new Error('Cannot create transformer for ' + obj);
        };
    }();

    var _xdropLastWhile = function () {
        function XDropLastWhile(fn, xf) {
            this.f = fn;
            this.retained = [];
            this.xf = xf;
        }
        XDropLastWhile.prototype['@@transducer/init'] = _xfBase.init;
        XDropLastWhile.prototype['@@transducer/result'] = function (result) {
            this.retained = null;
            return this.xf['@@transducer/result'](result);
        };
        XDropLastWhile.prototype['@@transducer/step'] = function (result, input) {
            return this.f(input) ? this.retain(result, input) : this.flush(result, input);
        };
        XDropLastWhile.prototype.flush = function (result, input) {
            result = _reduce(this.xf['@@transducer/step'], result, this.retained);
            this.retained = [];
            return this.xf['@@transducer/step'](result, input);
        };
        XDropLastWhile.prototype.retain = function (result, input) {
            this.retained.push(input);
            return result;
        };
        return _curry2(function _xdropLastWhile(fn, xf) {
            return new XDropLastWhile(fn, xf);
        });
    }();

    var _xgroupBy = function () {
        function XGroupBy(f, xf) {
            this.xf = xf;
            this.f = f;
            this.inputs = {};
        }
        XGroupBy.prototype['@@transducer/init'] = _xfBase.init;
        XGroupBy.prototype['@@transducer/result'] = function (result) {
            var key;
            for (key in this.inputs) {
                if (_has(key, this.inputs)) {
                    result = this.xf['@@transducer/step'](result, this.inputs[key]);
                    if (result['@@transducer/reduced']) {
                        result = result['@@transducer/value'];
                        break;
                    }
                }
            }
            this.inputs = null;
            return this.xf['@@transducer/result'](result);
        };
        XGroupBy.prototype['@@transducer/step'] = function (result, input) {
            var key = this.f(input);
            this.inputs[key] = this.inputs[key] || [
                key,
                []
            ];
            this.inputs[key][1] = append(input, this.inputs[key][1]);
            return result;
        };
        return _curry2(function _xgroupBy(f, xf) {
            return new XGroupBy(f, xf);
        });
    }();

    /**
     * Creates a new list iteration function from an existing one by adding two new
     * parameters to its callback function: the current index, and the entire list.
     *
     * This would turn, for instance, Ramda's simple `map` function into one that
     * more closely resembles `Array.prototype.map`. Note that this will only work
     * for functions in which the iteration callback function is the first
     * parameter, and where the list is the last parameter. (This latter might be
     * unimportant if the list parameter is not used.)
     *
     * @func
     * @memberOf R
     * @since v0.15.0
     * @category Function
     * @category List
     * @sig ((a ... -> b) ... -> [a] -> *) -> (a ..., Int, [a] -> b) ... -> [a] -> *)
     * @param {Function} fn A list iteration function that does not pass index or list to its callback
     * @return {Function} An altered list iteration function that passes (item, index, list) to its callback
     * @example
     *
     *      var mapIndexed = R.addIndex(R.map);
     *      mapIndexed((val, idx) => idx + '-' + val, ['f', 'o', 'o', 'b', 'a', 'r']);
     *      //=> ['0-f', '1-o', '2-o', '3-b', '4-a', '5-r']
     */
    var addIndex = _curry1(function addIndex(fn) {
        return curryN(fn.length, function () {
            var idx = 0;
            var origFn = arguments[0];
            var list = arguments[arguments.length - 1];
            var args = _slice(arguments);
            args[0] = function () {
                var result = origFn.apply(this, _concat(arguments, [
                    idx,
                    list
                ]));
                idx += 1;
                return result;
            };
            return fn.apply(this, args);
        });
    });

    /**
     * Wraps a function of any arity (including nullary) in a function that accepts
     * exactly 2 parameters. Any extraneous parameters will not be passed to the
     * supplied function.
     *
     * @func
     * @memberOf R
     * @since v0.2.0
     * @category Function
     * @sig (* -> c) -> (a, b -> c)
     * @param {Function} fn The function to wrap.
     * @return {Function} A new function wrapping `fn`. The new function is guaranteed to be of
     *         arity 2.
     * @example
     *
     *      var takesThreeArgs = function(a, b, c) {
     *        return [a, b, c];
     *      };
     *      takesThreeArgs.length; //=> 3
     *      takesThreeArgs(1, 2, 3); //=> [1, 2, 3]
     *
     *      var takesTwoArgs = R.binary(takesThreeArgs);
     *      takesTwoArgs.length; //=> 2
     *      // Only 2 arguments are passed to the wrapped function
     *      takesTwoArgs(1, 2, 3); //=> [1, 2, undefined]
     */
    var binary = _curry1(function binary(fn) {
        return nAry(2, fn);
    });

    /**
     * Creates a deep copy of the value which may contain (nested) `Array`s and
     * `Object`s, `Number`s, `String`s, `Boolean`s and `Date`s. `Function`s are not
     * copied, but assigned by their reference.
     *
     * Dispatches to a `clone` method if present.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Object
     * @sig {*} -> {*}
     * @param {*} value The object or array to clone
     * @return {*} A new object or array.
     * @example
     *
     *      var objects = [{}, {}, {}];
     *      var objectsClone = R.clone(objects);
     *      objects[0] === objectsClone[0]; //=> false
     */
    var clone = _curry1(function clone(value) {
        return value != null && typeof value.clone === 'function' ? value.clone() : _clone(value, [], [], true);
    });

    /**
     * Returns a curried equivalent of the provided function. The curried function
     * has two unusual capabilities. First, its arguments needn't be provided one
     * at a time. If `f` is a ternary function and `g` is `R.curry(f)`, the
     * following are equivalent:
     *
     *   - `g(1)(2)(3)`
     *   - `g(1)(2, 3)`
     *   - `g(1, 2)(3)`
     *   - `g(1, 2, 3)`
     *
     * Secondly, the special placeholder value `R.__` may be used to specify
     * "gaps", allowing partial application of any combination of arguments,
     * regardless of their positions. If `g` is as above and `_` is `R.__`, the
     * following are equivalent:
     *
     *   - `g(1, 2, 3)`
     *   - `g(_, 2, 3)(1)`
     *   - `g(_, _, 3)(1)(2)`
     *   - `g(_, _, 3)(1, 2)`
     *   - `g(_, 2)(1)(3)`
     *   - `g(_, 2)(1, 3)`
     *   - `g(_, 2)(_, 3)(1)`
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig (* -> a) -> (* -> a)
     * @param {Function} fn The function to curry.
     * @return {Function} A new, curried function.
     * @see R.curryN
     * @example
     *
     *      var addFourNumbers = (a, b, c, d) => a + b + c + d;
     *
     *      var curriedAddFourNumbers = R.curry(addFourNumbers);
     *      var f = curriedAddFourNumbers(1, 2);
     *      var g = f(3);
     *      g(4); //=> 10
     */
    var curry = _curry1(function curry(fn) {
        return curryN(fn.length, fn);
    });

    /**
     * Returns all but the first `n` elements of the given list, string, or
     * transducer/transformer (or object with a `drop` method).
     *
     * Dispatches to the `drop` method of the second argument, if present.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig Number -> [a] -> [a]
     * @sig Number -> String -> String
     * @param {Number} n
     * @param {*} list
     * @return {*}
     * @see R.take, R.transduce
     * @example
     *
     *      R.drop(1, ['foo', 'bar', 'baz']); //=> ['bar', 'baz']
     *      R.drop(2, ['foo', 'bar', 'baz']); //=> ['baz']
     *      R.drop(3, ['foo', 'bar', 'baz']); //=> []
     *      R.drop(4, ['foo', 'bar', 'baz']); //=> []
     *      R.drop(3, 'ramda');               //=> 'da'
     */
    var drop = _curry2(_dispatchable('drop', _xdrop, function drop(n, xs) {
        return slice(Math.max(0, n), Infinity, xs);
    }));

    /**
     * Returns a list containing all but the last `n` elements of the given `list`.
     *
     * @func
     * @memberOf R
     * @since v0.16.0
     * @category List
     * @sig Number -> [a] -> [a]
     * @sig Number -> String -> String
     * @param {Number} n The number of elements of `xs` to skip.
     * @param {Array} xs The collection to consider.
     * @return {Array}
     * @see R.takeLast
     * @example
     *
     *      R.dropLast(1, ['foo', 'bar', 'baz']); //=> ['foo', 'bar']
     *      R.dropLast(2, ['foo', 'bar', 'baz']); //=> ['foo']
     *      R.dropLast(3, ['foo', 'bar', 'baz']); //=> []
     *      R.dropLast(4, ['foo', 'bar', 'baz']); //=> []
     *      R.dropLast(3, 'ramda');               //=> 'ra'
     */
    var dropLast = _curry2(_dispatchable('dropLast', _xdropLast, _dropLast));

    /**
     * Returns a new list containing all but last the`n` elements of a given list,
     * passing each value from the right to the supplied predicate function,
     * skipping elements while the predicate function returns `true`. The predicate
     * function is passed one argument: (value)*.
     *
     * @func
     * @memberOf R
     * @since v0.16.0
     * @category List
     * @sig (a -> Boolean) -> [a] -> [a]
     * @param {Function} fn The function called per iteration.
     * @param {Array} list The collection to iterate over.
     * @return {Array} A new array.
     * @see R.takeLastWhile, R.addIndex
     * @example
     *
     *      var lteThree = x => x <= 3;
     *
     *      R.dropLastWhile(lteThree, [1, 2, 3, 4, 3, 2, 1]); //=> [1, 2, 3, 4]
     */
    var dropLastWhile = _curry2(_dispatchable('dropLastWhile', _xdropLastWhile, _dropLastWhile));

    /**
     * Returns `true` if its arguments are equivalent, `false` otherwise. Handles
     * cyclical data structures.
     *
     * Dispatches symmetrically to the `equals` methods of both arguments, if
     * present.
     *
     * @func
     * @memberOf R
     * @since v0.15.0
     * @category Relation
     * @sig a -> b -> Boolean
     * @param {*} a
     * @param {*} b
     * @return {Boolean}
     * @example
     *
     *      R.equals(1, 1); //=> true
     *      R.equals(1, '1'); //=> false
     *      R.equals([1, 2, 3], [1, 2, 3]); //=> true
     *
     *      var a = {}; a.v = a;
     *      var b = {}; b.v = b;
     *      R.equals(a, b); //=> true
     */
    var equals = _curry2(function equals(a, b) {
        return _equals(a, b, [], []);
    });

    /**
     * Takes a predicate and a "filterable", and returns a new filterable of the
     * same type containing the members of the given filterable which satisfy the
     * given predicate.
     *
     * Dispatches to the `filter` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig Filterable f => (a -> Boolean) -> f a -> f a
     * @param {Function} pred
     * @param {Array} filterable
     * @return {Array}
     * @see R.reject, R.transduce, R.addIndex
     * @example
     *
     *      var isEven = n => n % 2 === 0;
     *
     *      R.filter(isEven, [1, 2, 3, 4]); //=> [2, 4]
     *
     *      R.filter(isEven, {a: 1, b: 2, c: 3, d: 4}); //=> {b: 2, d: 4}
     */
    // else
    var filter = _curry2(_dispatchable('filter', _xfilter, function (pred, filterable) {
        return _isObject(filterable) ? _reduce(function (acc, key) {
            if (pred(filterable[key])) {
                acc[key] = filterable[key];
            }
            return acc;
        }, {}, keys(filterable)) : // else
        _filter(pred, filterable);
    }));

    /**
     * Returns a new list by pulling every item out of it (and all its sub-arrays)
     * and putting them in a new array, depth-first.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig [a] -> [b]
     * @param {Array} list The array to consider.
     * @return {Array} The flattened list.
     * @see R.unnest
     * @example
     *
     *      R.flatten([1, 2, [3, 4], 5, [6, [7, 8, [9, [10, 11], 12]]]]);
     *      //=> [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
     */
    var flatten = _curry1(_makeFlat(true));

    /**
     * Returns a new function much like the supplied one, except that the first two
     * arguments' order is reversed.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig (a -> b -> c -> ... -> z) -> (b -> a -> c -> ... -> z)
     * @param {Function} fn The function to invoke with its first two parameters reversed.
     * @return {*} The result of invoking `fn` with its first two parameters' order reversed.
     * @example
     *
     *      var mergeThree = (a, b, c) => [].concat(a, b, c);
     *
     *      mergeThree(1, 2, 3); //=> [1, 2, 3]
     *
     *      R.flip(mergeThree)(1, 2, 3); //=> [2, 1, 3]
     */
    var flip = _curry1(function flip(fn) {
        return curry(function (a, b) {
            var args = _slice(arguments);
            args[0] = b;
            args[1] = a;
            return fn.apply(this, args);
        });
    });

    /**
     * Returns the first element of the given list or string. In some libraries
     * this function is named `first`.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig [a] -> a | Undefined
     * @sig String -> String
     * @param {Array|String} list
     * @return {*}
     * @see R.tail, R.init, R.last
     * @example
     *
     *      R.head(['fi', 'fo', 'fum']); //=> 'fi'
     *      R.head([]); //=> undefined
     *
     *      R.head('abc'); //=> 'a'
     *      R.head(''); //=> ''
     */
    var head = nth(0);

    /**
     * Returns all but the last element of the given list or string.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category List
     * @sig [a] -> [a]
     * @sig String -> String
     * @param {*} list
     * @return {*}
     * @see R.last, R.head, R.tail
     * @example
     *
     *      R.init([1, 2, 3]);  //=> [1, 2]
     *      R.init([1, 2]);     //=> [1]
     *      R.init([1]);        //=> []
     *      R.init([]);         //=> []
     *
     *      R.init('abc');  //=> 'ab'
     *      R.init('ab');   //=> 'a'
     *      R.init('a');    //=> ''
     *      R.init('');     //=> ''
     */
    var init = slice(0, -1);

    /**
     * Combines two lists into a set (i.e. no duplicates) composed of those
     * elements common to both lists. Duplication is determined according to the
     * value returned by applying the supplied predicate to two list elements.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig (a -> a -> Boolean) -> [*] -> [*] -> [*]
     * @param {Function} pred A predicate function that determines whether
     *        the two supplied elements are equal.
     * @param {Array} list1 One list of items to compare
     * @param {Array} list2 A second list of items to compare
     * @return {Array} A new list containing those elements common to both lists.
     * @see R.intersection
     * @example
     *
     *      var buffaloSpringfield = [
     *        {id: 824, name: 'Richie Furay'},
     *        {id: 956, name: 'Dewey Martin'},
     *        {id: 313, name: 'Bruce Palmer'},
     *        {id: 456, name: 'Stephen Stills'},
     *        {id: 177, name: 'Neil Young'}
     *      ];
     *      var csny = [
     *        {id: 204, name: 'David Crosby'},
     *        {id: 456, name: 'Stephen Stills'},
     *        {id: 539, name: 'Graham Nash'},
     *        {id: 177, name: 'Neil Young'}
     *      ];
     *
     *      R.intersectionWith(R.eqBy(R.prop('id')), buffaloSpringfield, csny);
     *      //=> [{id: 456, name: 'Stephen Stills'}, {id: 177, name: 'Neil Young'}]
     */
    var intersectionWith = _curry3(function intersectionWith(pred, list1, list2) {
        var lookupList, filteredList;
        if (list1.length > list2.length) {
            lookupList = list1;
            filteredList = list2;
        } else {
            lookupList = list2;
            filteredList = list1;
        }
        var results = [];
        var idx = 0;
        while (idx < filteredList.length) {
            if (_containsWith(pred, filteredList[idx], lookupList)) {
                results[results.length] = filteredList[idx];
            }
            idx += 1;
        }
        return uniqWith(pred, results);
    });

    /**
     * Transforms the items of the list with the transducer and appends the
     * transformed items to the accumulator using an appropriate iterator function
     * based on the accumulator type.
     *
     * The accumulator can be an array, string, object or a transformer. Iterated
     * items will be appended to arrays and concatenated to strings. Objects will
     * be merged directly or 2-item arrays will be merged as key, value pairs.
     *
     * The accumulator can also be a transformer object that provides a 2-arity
     * reducing iterator function, step, 0-arity initial value function, init, and
     * 1-arity result extraction function result. The step function is used as the
     * iterator function in reduce. The result function is used to convert the
     * final accumulator into the return type and in most cases is R.identity. The
     * init function is used to provide the initial accumulator.
     *
     * The iteration is performed with R.reduce after initializing the transducer.
     *
     * @func
     * @memberOf R
     * @since v0.12.0
     * @category List
     * @sig a -> (b -> b) -> [c] -> a
     * @param {*} acc The initial accumulator value.
     * @param {Function} xf The transducer function. Receives a transformer and returns a transformer.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @example
     *
     *      var numbers = [1, 2, 3, 4];
     *      var transducer = R.compose(R.map(R.add(1)), R.take(2));
     *
     *      R.into([], transducer, numbers); //=> [2, 3]
     *
     *      var intoArray = R.into([]);
     *      intoArray(transducer, numbers); //=> [2, 3]
     */
    var into = _curry3(function into(acc, xf, list) {
        return _isTransformer(acc) ? _reduce(xf(acc), acc['@@transducer/init'](), list) : _reduce(xf(_stepCat(acc)), _clone(acc, [], [], false), list);
    });

    /**
     * Same as R.invertObj, however this accounts for objects with duplicate values
     * by putting the values into an array.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Object
     * @sig {s: x} -> {x: [ s, ... ]}
     * @param {Object} obj The object or array to invert
     * @return {Object} out A new object with keys
     * in an array.
     * @example
     *
     *      var raceResultsByFirstName = {
     *        first: 'alice',
     *        second: 'jake',
     *        third: 'alice',
     *      };
     *      R.invert(raceResultsByFirstName);
     *      //=> { 'alice': ['first', 'third'], 'jake':['second'] }
     */
    var invert = _curry1(function invert(obj) {
        var props = keys(obj);
        var len = props.length;
        var idx = 0;
        var out = {};
        while (idx < len) {
            var key = props[idx];
            var val = obj[key];
            var list = _has(val, out) ? out[val] : out[val] = [];
            list[list.length] = key;
            idx += 1;
        }
        return out;
    });

    /**
     * Returns a new object with the keys of the given object as values, and the
     * values of the given object, which are coerced to strings, as keys. Note
     * that the last key found is preferred when handling the same value.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Object
     * @sig {s: x} -> {x: s}
     * @param {Object} obj The object or array to invert
     * @return {Object} out A new object
     * @example
     *
     *      var raceResults = {
     *        first: 'alice',
     *        second: 'jake'
     *      };
     *      R.invertObj(raceResults);
     *      //=> { 'alice': 'first', 'jake':'second' }
     *
     *      // Alternatively:
     *      var raceResults = ['alice', 'jake'];
     *      R.invertObj(raceResults);
     *      //=> { 'alice': '0', 'jake':'1' }
     */
    var invertObj = _curry1(function invertObj(obj) {
        var props = keys(obj);
        var len = props.length;
        var idx = 0;
        var out = {};
        while (idx < len) {
            var key = props[idx];
            out[obj[key]] = key;
            idx += 1;
        }
        return out;
    });

    /**
     * Returns `true` if the given value is its type's empty value; `false`
     * otherwise.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Logic
     * @sig a -> Boolean
     * @param {*} x
     * @return {Boolean}
     * @see R.empty
     * @example
     *
     *      R.isEmpty([1, 2, 3]);   //=> false
     *      R.isEmpty([]);          //=> true
     *      R.isEmpty('');          //=> true
     *      R.isEmpty(null);        //=> false
     *      R.isEmpty({});          //=> true
     *      R.isEmpty({length: 0}); //=> false
     */
    var isEmpty = _curry1(function isEmpty(x) {
        return x != null && equals(x, empty(x));
    });

    /**
     * Returns the last element of the given list or string.
     *
     * @func
     * @memberOf R
     * @since v0.1.4
     * @category List
     * @sig [a] -> a | Undefined
     * @sig String -> String
     * @param {*} list
     * @return {*}
     * @see R.init, R.head, R.tail
     * @example
     *
     *      R.last(['fi', 'fo', 'fum']); //=> 'fum'
     *      R.last([]); //=> undefined
     *
     *      R.last('abc'); //=> 'c'
     *      R.last(''); //=> ''
     */
    var last = nth(-1);

    /**
     * Returns the position of the last occurrence of an item in an array, or -1 if
     * the item is not included in the array. `R.equals` is used to determine
     * equality.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig a -> [a] -> Number
     * @param {*} target The item to find.
     * @param {Array} xs The array to search in.
     * @return {Number} the index of the target, or -1 if the target is not found.
     * @see R.indexOf
     * @example
     *
     *      R.lastIndexOf(3, [-1,3,3,0,1,2,3,4]); //=> 6
     *      R.lastIndexOf(10, [1,2,3,4]); //=> -1
     */
    var lastIndexOf = _curry2(function lastIndexOf(target, xs) {
        if (typeof xs.lastIndexOf === 'function' && !_isArray(xs)) {
            return xs.lastIndexOf(target);
        } else {
            var idx = xs.length - 1;
            while (idx >= 0) {
                if (equals(xs[idx], target)) {
                    return idx;
                }
                idx -= 1;
            }
            return -1;
        }
    });

    /**
     * Takes a function and
     * a [functor](https://github.com/fantasyland/fantasy-land#functor),
     * applies the function to each of the functor's values, and returns
     * a functor of the same shape.
     *
     * Ramda provides suitable `map` implementations for `Array` and `Object`,
     * so this function may be applied to `[1, 2, 3]` or `{x: 1, y: 2, z: 3}`.
     *
     * Dispatches to the `map` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * Also treats functions as functors and will compose them together.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig Functor f => (a -> b) -> f a -> f b
     * @param {Function} fn The function to be called on every element of the input `list`.
     * @param {Array} list The list to be iterated over.
     * @return {Array} The new list.
     * @see R.transduce, R.addIndex
     * @example
     *
     *      var double = x => x * 2;
     *
     *      R.map(double, [1, 2, 3]); //=> [2, 4, 6]
     *
     *      R.map(double, {x: 1, y: 2, z: 3}); //=> {x: 2, y: 4, z: 6}
     */
    var map = _curry2(_dispatchable('map', _xmap, function map(fn, functor) {
        switch (Object.prototype.toString.call(functor)) {
        case '[object Function]':
            return curryN(functor.length, function () {
                return fn.call(this, functor.apply(this, arguments));
            });
        case '[object Object]':
            return _reduce(function (acc, key) {
                acc[key] = fn(functor[key]);
                return acc;
            }, {}, keys(functor));
        default:
            return _map(fn, functor);
        }
    }));

    /**
     * An Object-specific version of `map`. The function is applied to three
     * arguments: *(value, key, obj)*. If only the value is significant, use
     * `map` instead.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Object
     * @sig ((*, String, Object) -> *) -> Object -> Object
     * @param {Function} fn
     * @param {Object} obj
     * @return {Object}
     * @see R.map
     * @example
     *
     *      var values = { x: 1, y: 2, z: 3 };
     *      var prependKeyAndDouble = (num, key, obj) => key + (num * 2);
     *
     *      R.mapObjIndexed(prependKeyAndDouble, values); //=> { x: 'x2', y: 'y4', z: 'z6' }
     */
    var mapObjIndexed = _curry2(function mapObjIndexed(fn, obj) {
        return _reduce(function (acc, key) {
            acc[key] = fn(obj[key], key, obj);
            return acc;
        }, {}, keys(obj));
    });

    /**
     * Creates a new object with the own properties of the two provided objects. If
     * a key exists in both objects, the provided function is applied to the values
     * associated with the key in each object, with the result being used as the
     * value associated with the key in the returned object. The key will be
     * excluded from the returned object if the resulting value is `undefined`.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category Object
     * @sig (a -> a -> a) -> {a} -> {a} -> {a}
     * @param {Function} fn
     * @param {Object} l
     * @param {Object} r
     * @return {Object}
     * @see R.merge, R.mergeWithKey
     * @example
     *
     *      R.mergeWith(R.concat,
     *                  { a: true, values: [10, 20] },
     *                  { b: true, values: [15, 35] });
     *      //=> { a: true, b: true, values: [10, 20, 15, 35] }
     */
    var mergeWith = _curry3(function mergeWith(fn, l, r) {
        return mergeWithKey(function (_, _l, _r) {
            return fn(_l, _r);
        }, l, r);
    });

    /**
     * Takes a function `f` and a list of arguments, and returns a function `g`.
     * When applied, `g` returns the result of applying `f` to the arguments
     * provided initially followed by the arguments provided to `g`.
     *
     * @func
     * @memberOf R
     * @since v0.10.0
     * @category Function
     * @sig ((a, b, c, ..., n) -> x) -> [a, b, c, ...] -> ((d, e, f, ..., n) -> x)
     * @param {Function} f
     * @param {Array} args
     * @return {Function}
     * @see R.partialRight
     * @example
     *
     *      var multiply = (a, b) => a * b;
     *      var double = R.partial(multiply, [2]);
     *      double(2); //=> 4
     *
     *      var greet = (salutation, title, firstName, lastName) =>
     *        salutation + ', ' + title + ' ' + firstName + ' ' + lastName + '!';
     *
     *      var sayHello = R.partial(greet, ['Hello']);
     *      var sayHelloToMs = R.partial(sayHello, ['Ms.']);
     *      sayHelloToMs('Jane', 'Jones'); //=> 'Hello, Ms. Jane Jones!'
     */
    var partial = _createPartialApplicator(_concat);

    /**
     * Takes a function `f` and a list of arguments, and returns a function `g`.
     * When applied, `g` returns the result of applying `f` to the arguments
     * provided to `g` followed by the arguments provided initially.
     *
     * @func
     * @memberOf R
     * @since v0.10.0
     * @category Function
     * @sig ((a, b, c, ..., n) -> x) -> [d, e, f, ..., n] -> ((a, b, c, ...) -> x)
     * @param {Function} f
     * @param {Array} args
     * @return {Function}
     * @see R.partial
     * @example
     *
     *      var greet = (salutation, title, firstName, lastName) =>
     *        salutation + ', ' + title + ' ' + firstName + ' ' + lastName + '!';
     *
     *      var greetMsJaneJones = R.partialRight(greet, ['Ms.', 'Jane', 'Jones']);
     *
     *      greetMsJaneJones('Hello'); //=> 'Hello, Ms. Jane Jones!'
     */
    var partialRight = _createPartialApplicator(flip(_concat));

    /**
     * Determines whether a nested path on an object has a specific value, in
     * `R.equals` terms. Most likely used to filter a list.
     *
     * @func
     * @memberOf R
     * @since v0.7.0
     * @category Relation
     * @sig [String] -> * -> {String: *} -> Boolean
     * @param {Array} path The path of the nested property to use
     * @param {*} val The value to compare the nested property with
     * @param {Object} obj The object to check the nested property in
     * @return {Boolean} `true` if the value equals the nested object property,
     *         `false` otherwise.
     * @example
     *
     *      var user1 = { address: { zipCode: 90210 } };
     *      var user2 = { address: { zipCode: 55555 } };
     *      var user3 = { name: 'Bob' };
     *      var users = [ user1, user2, user3 ];
     *      var isFamous = R.pathEq(['address', 'zipCode'], 90210);
     *      R.filter(isFamous, users); //=> [ user1 ]
     */
    var pathEq = _curry3(function pathEq(_path, val, obj) {
        return equals(path(_path, obj), val);
    });

    /**
     * Returns a new list by plucking the same named property off all objects in
     * the list supplied.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig k -> [{k: v}] -> [v]
     * @param {Number|String} key The key name to pluck off of each object.
     * @param {Array} list The array to consider.
     * @return {Array} The list of values for the given key.
     * @see R.props
     * @example
     *
     *      R.pluck('a')([{a: 1}, {a: 2}]); //=> [1, 2]
     *      R.pluck(0)([[1, 2], [3, 4]]);   //=> [1, 3]
     */
    var pluck = _curry2(function pluck(p, list) {
        return map(prop(p), list);
    });

    /**
     * Reasonable analog to SQL `select` statement.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Object
     * @category Relation
     * @sig [k] -> [{k: v}] -> [{k: v}]
     * @param {Array} props The property names to project
     * @param {Array} objs The objects to query
     * @return {Array} An array of objects with just the `props` properties.
     * @example
     *
     *      var abby = {name: 'Abby', age: 7, hair: 'blond', grade: 2};
     *      var fred = {name: 'Fred', age: 12, hair: 'brown', grade: 7};
     *      var kids = [abby, fred];
     *      R.project(['name', 'grade'], kids); //=> [{name: 'Abby', grade: 2}, {name: 'Fred', grade: 7}]
     */
    // passing `identity` gives correct arity
    var project = useWith(_map, [
        pickAll,
        identity
    ]);

    /**
     * Returns `true` if the specified object property is equal, in `R.equals`
     * terms, to the given value; `false` otherwise.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig String -> a -> Object -> Boolean
     * @param {String} name
     * @param {*} val
     * @param {*} obj
     * @return {Boolean}
     * @see R.equals, R.propSatisfies
     * @example
     *
     *      var abby = {name: 'Abby', age: 7, hair: 'blond'};
     *      var fred = {name: 'Fred', age: 12, hair: 'brown'};
     *      var rusty = {name: 'Rusty', age: 10, hair: 'brown'};
     *      var alois = {name: 'Alois', age: 15, disposition: 'surly'};
     *      var kids = [abby, fred, rusty, alois];
     *      var hasBrownHair = R.propEq('hair', 'brown');
     *      R.filter(hasBrownHair, kids); //=> [fred, rusty]
     */
    var propEq = _curry3(function propEq(name, val, obj) {
        return propSatisfies(equals(val), name, obj);
    });

    /**
     * Returns `true` if the specified object property is of the given type;
     * `false` otherwise.
     *
     * @func
     * @memberOf R
     * @since v0.16.0
     * @category Type
     * @sig Type -> String -> Object -> Boolean
     * @param {Function} type
     * @param {String} name
     * @param {*} obj
     * @return {Boolean}
     * @see R.is, R.propSatisfies
     * @example
     *
     *      R.propIs(Number, 'x', {x: 1, y: 2});  //=> true
     *      R.propIs(Number, 'x', {x: 'foo'});    //=> false
     *      R.propIs(Number, 'x', {});            //=> false
     */
    var propIs = _curry3(function propIs(type, name, obj) {
        return propSatisfies(is(type), name, obj);
    });

    /**
     * Returns a single item by iterating through the list, successively calling
     * the iterator function and passing it an accumulator value and the current
     * value from the array, and then passing the result to the next call.
     *
     * The iterator function receives two values: *(acc, value)*. It may use
     * `R.reduced` to shortcut the iteration.
     *
     * Note: `R.reduce` does not skip deleted or unassigned indices (sparse
     * arrays), unlike the native `Array.prototype.reduce` method. For more details
     * on this behavior, see:
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce#Description
     *
     * Dispatches to the `reduce` method of the third argument, if present.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig ((a, b) -> a) -> a -> [b] -> a
     * @param {Function} fn The iterator function. Receives two values, the accumulator and the
     *        current element from the array.
     * @param {*} acc The accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @see R.reduced, R.addIndex
     * @example
     *
     *      var numbers = [1, 2, 3];
     *      var add = (a, b) => a + b;
     *
     *      R.reduce(add, 10, numbers); //=> 16
     */
    var reduce = _curry3(_reduce);

    /**
     * Groups the elements of the list according to the result of calling
     * the String-returning function `keyFn` on each element and reduces the elements
     * of each group to a single value via the reducer function `valueFn`.
     *
     * This function is basically a more general `groupBy` function.
     *
     * @func
     * @memberOf R
     * @since v0.20.0
     * @category List
     * @sig ((a, b) -> a) -> a -> (b -> String) -> [b] -> {String: a}
     * @param {Function} valueFn The function that reduces the elements of each group to a single
     *        value. Receives two values, accumulator for a particular group and the current element.
     * @param {*} acc The (initial) accumulator value for each group.
     * @param {Function} keyFn The function that maps the list's element into a key.
     * @param {Array} list The array to group.
     * @return {Object} An object with the output of `keyFn` for keys, mapped to the output of
     *         `valueFn` for elements which produced that key when passed to `keyFn`.
     * @see R.groupBy, R.reduce
     * @example
     *
     *      var reduceToNamesBy = R.reduceBy((acc, student) => acc.concat(student.name), []);
     *      var namesByGrade = reduceToNamesBy(function(student) {
     *        var score = student.score;
     *        return score < 65 ? 'F' :
     *               score < 70 ? 'D' :
     *               score < 80 ? 'C' :
     *               score < 90 ? 'B' : 'A';
     *      });
     *      var students = [{name: 'Lucy', score: 92},
     *                      {name: 'Drew', score: 85},
     *                      // ...
     *                      {name: 'Bart', score: 62}];
     *      namesByGrade(students);
     *      // {
     *      //   'A': ['Lucy'],
     *      //   'B': ['Drew']
     *      //   // ...,
     *      //   'F': ['Bart']
     *      // }
     */
    var reduceBy = _curryN(4, [], function reduceBy(valueFn, valueAcc, keyFn, list) {
        return _reduce(function (acc, elt) {
            var key = keyFn(elt);
            acc[key] = valueFn(_has(key, acc) ? acc[key] : valueAcc, elt);
            return acc;
        }, {}, list);
    });

    /**
     * The complement of `filter`.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig Filterable f => (a -> Boolean) -> f a -> f a
     * @param {Function} pred
     * @param {Array} filterable
     * @return {Array}
     * @see R.filter, R.transduce, R.addIndex
     * @example
     *
     *      var isOdd = (n) => n % 2 === 1;
     *
     *      R.reject(isOdd, [1, 2, 3, 4]); //=> [2, 4]
     *
     *      R.reject(isOdd, {a: 1, b: 2, c: 3, d: 4}); //=> {b: 2, d: 4}
     */
    var reject = _curry2(function reject(pred, filterable) {
        return filter(_complement(pred), filterable);
    });

    /**
     * Returns a fixed list of size `n` containing a specified identical value.
     *
     * @func
     * @memberOf R
     * @since v0.1.1
     * @category List
     * @sig a -> n -> [a]
     * @param {*} value The value to repeat.
     * @param {Number} n The desired size of the output list.
     * @return {Array} A new array containing `n` `value`s.
     * @example
     *
     *      R.repeat('hi', 5); //=> ['hi', 'hi', 'hi', 'hi', 'hi']
     *
     *      var obj = {};
     *      var repeatedObjs = R.repeat(obj, 5); //=> [{}, {}, {}, {}, {}]
     *      repeatedObjs[0] === repeatedObjs[1]; //=> true
     */
    var repeat = _curry2(function repeat(value, n) {
        return times(always(value), n);
    });

    /**
     * Adds together all the elements of a list.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Math
     * @sig [Number] -> Number
     * @param {Array} list An array of numbers
     * @return {Number} The sum of all the numbers in the list.
     * @see R.reduce
     * @example
     *
     *      R.sum([2,4,6,8,100,1]); //=> 121
     */
    var sum = reduce(add, 0);

    /**
     * Returns a new list containing the last `n` elements of the given list.
     * If `n > list.length`, returns a list of `list.length` elements.
     *
     * @func
     * @memberOf R
     * @since v0.16.0
     * @category List
     * @sig Number -> [a] -> [a]
     * @sig Number -> String -> String
     * @param {Number} n The number of elements to return.
     * @param {Array} xs The collection to consider.
     * @return {Array}
     * @see R.dropLast
     * @example
     *
     *      R.takeLast(1, ['foo', 'bar', 'baz']); //=> ['baz']
     *      R.takeLast(2, ['foo', 'bar', 'baz']); //=> ['bar', 'baz']
     *      R.takeLast(3, ['foo', 'bar', 'baz']); //=> ['foo', 'bar', 'baz']
     *      R.takeLast(4, ['foo', 'bar', 'baz']); //=> ['foo', 'bar', 'baz']
     *      R.takeLast(3, 'ramda');               //=> 'mda'
     */
    var takeLast = _curry2(function takeLast(n, xs) {
        return drop(n >= 0 ? xs.length - n : 0, xs);
    });

    /**
     * Initializes a transducer using supplied iterator function. Returns a single
     * item by iterating through the list, successively calling the transformed
     * iterator function and passing it an accumulator value and the current value
     * from the array, and then passing the result to the next call.
     *
     * The iterator function receives two values: *(acc, value)*. It will be
     * wrapped as a transformer to initialize the transducer. A transformer can be
     * passed directly in place of an iterator function. In both cases, iteration
     * may be stopped early with the `R.reduced` function.
     *
     * A transducer is a function that accepts a transformer and returns a
     * transformer and can be composed directly.
     *
     * A transformer is an an object that provides a 2-arity reducing iterator
     * function, step, 0-arity initial value function, init, and 1-arity result
     * extraction function, result. The step function is used as the iterator
     * function in reduce. The result function is used to convert the final
     * accumulator into the return type and in most cases is R.identity. The init
     * function can be used to provide an initial accumulator, but is ignored by
     * transduce.
     *
     * The iteration is performed with R.reduce after initializing the transducer.
     *
     * @func
     * @memberOf R
     * @since v0.12.0
     * @category List
     * @sig (c -> c) -> (a,b -> a) -> a -> [b] -> a
     * @param {Function} xf The transducer function. Receives a transformer and returns a transformer.
     * @param {Function} fn The iterator function. Receives two values, the accumulator and the
     *        current element from the array. Wrapped as transformer, if necessary, and used to
     *        initialize the transducer
     * @param {*} acc The initial accumulator value.
     * @param {Array} list The list to iterate over.
     * @return {*} The final, accumulated value.
     * @see R.reduce, R.reduced, R.into
     * @example
     *
     *      var numbers = [1, 2, 3, 4];
     *      var transducer = R.compose(R.map(R.add(1)), R.take(2));
     *
     *      R.transduce(transducer, R.flip(R.append), [], numbers); //=> [2, 3]
     */
    var transduce = curryN(4, function transduce(xf, fn, acc, list) {
        return _reduce(xf(typeof fn === 'function' ? _xwrap(fn) : fn), acc, list);
    });

    /**
     * Combines two lists into a set (i.e. no duplicates) composed of the elements
     * of each list. Duplication is determined according to the value returned by
     * applying the supplied predicate to two list elements.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig (a -> a -> Boolean) -> [*] -> [*] -> [*]
     * @param {Function} pred A predicate used to test whether two items are equal.
     * @param {Array} list1 The first list.
     * @param {Array} list2 The second list.
     * @return {Array} The first and second lists concatenated, with
     *         duplicates removed.
     * @see R.union
     * @example
     *
     *      var l1 = [{a: 1}, {a: 2}];
     *      var l2 = [{a: 1}, {a: 4}];
     *      R.unionWith(R.eqBy(R.prop('a')), l1, l2); //=> [{a: 1}, {a: 2}, {a: 4}]
     */
    var unionWith = _curry3(function unionWith(pred, list1, list2) {
        return uniqWith(pred, _concat(list1, list2));
    });

    /**
     * Takes a spec object and a test object; returns true if the test satisfies
     * the spec, false otherwise. An object satisfies the spec if, for each of the
     * spec's own properties, accessing that property of the object gives the same
     * value (in `R.equals` terms) as accessing that property of the spec.
     *
     * `whereEq` is a specialization of [`where`](#where).
     *
     * @func
     * @memberOf R
     * @since v0.14.0
     * @category Object
     * @sig {String: *} -> {String: *} -> Boolean
     * @param {Object} spec
     * @param {Object} testObj
     * @return {Boolean}
     * @see R.where
     * @example
     *
     *      // pred :: Object -> Boolean
     *      var pred = R.whereEq({a: 1, b: 2});
     *
     *      pred({a: 1});              //=> false
     *      pred({a: 1, b: 2});        //=> true
     *      pred({a: 1, b: 2, c: 3});  //=> true
     *      pred({a: 1, b: 1});        //=> false
     */
    var whereEq = _curry2(function whereEq(spec, testObj) {
        return where(map(equals, spec), testObj);
    });

    var _flatCat = function () {
        var preservingReduced = function (xf) {
            return {
                '@@transducer/init': _xfBase.init,
                '@@transducer/result': function (result) {
                    return xf['@@transducer/result'](result);
                },
                '@@transducer/step': function (result, input) {
                    var ret = xf['@@transducer/step'](result, input);
                    return ret['@@transducer/reduced'] ? _forceReduced(ret) : ret;
                }
            };
        };
        return function _xcat(xf) {
            var rxf = preservingReduced(xf);
            return {
                '@@transducer/init': _xfBase.init,
                '@@transducer/result': function (result) {
                    return rxf['@@transducer/result'](result);
                },
                '@@transducer/step': function (result, input) {
                    return !isArrayLike(input) ? _reduce(rxf, result, [input]) : _reduce(rxf, result, input);
                }
            };
        };
    }();

    // Array.prototype.indexOf doesn't exist below IE9
    // manually crawl the list to distinguish between +0 and -0
    // NaN
    // non-zero numbers can utilise Set
    // all these types can utilise Set
    // null can utilise Set
    // anything else not covered above, defer to R.equals
    var _indexOf = function _indexOf(list, a, idx) {
        var inf, item;
        // Array.prototype.indexOf doesn't exist below IE9
        if (typeof list.indexOf === 'function') {
            switch (typeof a) {
            case 'number':
                if (a === 0) {
                    // manually crawl the list to distinguish between +0 and -0
                    inf = 1 / a;
                    while (idx < list.length) {
                        item = list[idx];
                        if (item === 0 && 1 / item === inf) {
                            return idx;
                        }
                        idx += 1;
                    }
                    return -1;
                } else if (a !== a) {
                    // NaN
                    while (idx < list.length) {
                        item = list[idx];
                        if (typeof item === 'number' && item !== item) {
                            return idx;
                        }
                        idx += 1;
                    }
                    return -1;
                }
                // non-zero numbers can utilise Set
                return list.indexOf(a, idx);
            // all these types can utilise Set
            case 'string':
            case 'boolean':
            case 'function':
            case 'undefined':
                return list.indexOf(a, idx);
            case 'object':
                if (a === null) {
                    // null can utilise Set
                    return list.indexOf(a, idx);
                }
            }
        }
        // anything else not covered above, defer to R.equals
        while (idx < list.length) {
            if (equals(list[idx], a)) {
                return idx;
            }
            idx += 1;
        }
        return -1;
    };

    var _xchain = _curry2(function _xchain(f, xf) {
        return map(f, _flatCat(xf));
    });

    /**
     * Takes a list of predicates and returns a predicate that returns true for a
     * given list of arguments if every one of the provided predicates is satisfied
     * by those arguments.
     *
     * The function returned is a curried function whose arity matches that of the
     * highest-arity predicate.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Logic
     * @sig [(*... -> Boolean)] -> (*... -> Boolean)
     * @param {Array} preds
     * @return {Function}
     * @see R.anyPass
     * @example
     *
     *      var isQueen = R.propEq('rank', 'Q');
     *      var isSpade = R.propEq('suit', '♠︎');
     *      var isQueenOfSpades = R.allPass([isQueen, isSpade]);
     *
     *      isQueenOfSpades({rank: 'Q', suit: '♣︎'}); //=> false
     *      isQueenOfSpades({rank: 'Q', suit: '♠︎'}); //=> true
     */
    var allPass = _curry1(function allPass(preds) {
        return curryN(reduce(max, 0, pluck('length', preds)), function () {
            var idx = 0;
            var len = preds.length;
            while (idx < len) {
                if (!preds[idx].apply(this, arguments)) {
                    return false;
                }
                idx += 1;
            }
            return true;
        });
    });

    /**
     * Returns `true` if all elements are unique, in `R.equals` terms, otherwise
     * `false`.
     *
     * @func
     * @memberOf R
     * @since v0.18.0
     * @category List
     * @sig [a] -> Boolean
     * @param {Array} list The array to consider.
     * @return {Boolean} `true` if all elements are unique, else `false`.
     * @deprecated since v0.20.0
     * @example
     *
     *      R.allUniq(['1', 1]); //=> true
     *      R.allUniq([1, 1]);   //=> false
     *      R.allUniq([[42], [42]]); //=> false
     */
    var allUniq = _curry1(function allUniq(list) {
        var len = list.length;
        var idx = 0;
        while (idx < len) {
            if (_indexOf(list, list[idx], idx + 1) >= 0) {
                return false;
            }
            idx += 1;
        }
        return true;
    });

    /**
     * Takes a list of predicates and returns a predicate that returns true for a
     * given list of arguments if at least one of the provided predicates is
     * satisfied by those arguments.
     *
     * The function returned is a curried function whose arity matches that of the
     * highest-arity predicate.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Logic
     * @sig [(*... -> Boolean)] -> (*... -> Boolean)
     * @param {Array} preds
     * @return {Function}
     * @see R.allPass
     * @example
     *
     *      var gte = R.anyPass([R.gt, R.equals]);
     *
     *      gte(3, 2); //=> true
     *      gte(2, 2); //=> true
     *      gte(2, 3); //=> false
     */
    var anyPass = _curry1(function anyPass(preds) {
        return curryN(reduce(max, 0, pluck('length', preds)), function () {
            var idx = 0;
            var len = preds.length;
            while (idx < len) {
                if (preds[idx].apply(this, arguments)) {
                    return true;
                }
                idx += 1;
            }
            return false;
        });
    });

    /**
     * ap applies a list of functions to a list of values.
     *
     * Dispatches to the `ap` method of the second argument, if present. Also
     * treats functions as applicatives.
     *
     * @func
     * @memberOf R
     * @since v0.3.0
     * @category Function
     * @sig [f] -> [a] -> [f a]
     * @param {Array} fns An array of functions
     * @param {Array} vs An array of values
     * @return {Array} An array of results of applying each of `fns` to all of `vs` in turn.
     * @example
     *
     *      R.ap([R.multiply(2), R.add(3)], [1,2,3]); //=> [2, 4, 6, 4, 5, 6]
     */
    // else
    var ap = _curry2(function ap(applicative, fn) {
        return typeof applicative.ap === 'function' ? applicative.ap(fn) : typeof applicative === 'function' ? curryN(Math.max(applicative.length, fn.length), function () {
            return applicative.apply(this, arguments)(fn.apply(this, arguments));
        }) : // else
        _reduce(function (acc, f) {
            return _concat(acc, map(f, fn));
        }, [], applicative);
    });

    /**
     * Given a spec object recursively mapping properties to functions, creates a
     * function producing an object of the same structure, by mapping each property
     * to the result of calling its associated function with the supplied arguments.
     *
     * @func
     * @memberOf R
     * @since v0.20.0
     * @category Function
     * @sig {k: ((a, b, ..., m) -> v)} -> ((a, b, ..., m) -> {k: v})
     * @param {Object} spec an object recursively mapping properties to functions for
     *        producing the values for these properties.
     * @return {Function} A function that returns an object of the same structure
     * as `spec', with each property set to the value returned by calling its
     * associated function with the supplied arguments.
     * @see R.juxt
     * @example
     *
     *      var getMetrics = R.applySpec({
     *                                      sum: R.add,
     *                                      nested: { mul: R.multiply }
     *                                   });
     *      getMetrics(2, 4); // => { sum: 6, nested: { mul: 8 } }
     */
    var applySpec = _curry1(function applySpec(spec) {
        spec = map(function (v) {
            return typeof v == 'function' ? v : applySpec(v);
        }, spec);
        return curryN(reduce(max, 0, pluck('length', values(spec))), function () {
            var args = arguments;
            return map(function (f) {
                return apply(f, args);
            }, spec);
        });
    });

    /**
     * Returns the result of calling its first argument with the remaining
     * arguments. This is occasionally useful as a converging function for
     * `R.converge`: the left branch can produce a function while the right branch
     * produces a value to be passed to that function as an argument.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category Function
     * @sig (*... -> a),*... -> a
     * @param {Function} fn The function to apply to the remaining arguments.
     * @param {...*} args Any number of positional arguments.
     * @return {*}
     * @see R.apply
     * @example
     *
     *      var indentN = R.pipe(R.times(R.always(' ')),
     *                           R.join(''),
     *                           R.replace(/^(?!$)/gm));
     *
     *      var format = R.converge(R.call, [
     *                                  R.pipe(R.prop('indent'), indentN),
     *                                  R.prop('value')
     *                              ]);
     *
     *      format({indent: 2, value: 'foo\nbar\nbaz\n'}); //=> '  foo\n  bar\n  baz\n'
     */
    var call = curry(function call(fn) {
        return fn.apply(this, _slice(arguments, 1));
    });

    /**
     * `chain` maps a function over a list and concatenates the results. `chain`
     * is also known as `flatMap` in some libraries
     *
     * Dispatches to the `chain` method of the second argument, if present.
     *
     * @func
     * @memberOf R
     * @since v0.3.0
     * @category List
     * @sig (a -> [b]) -> [a] -> [b]
     * @param {Function} fn
     * @param {Array} list
     * @return {Array}
     * @example
     *
     *      var duplicate = n => [n, n];
     *      R.chain(duplicate, [1, 2, 3]); //=> [1, 1, 2, 2, 3, 3]
     */
    var chain = _curry2(_dispatchable('chain', _xchain, function chain(fn, monad) {
        if (typeof monad === 'function') {
            return function () {
                return monad.call(this, fn.apply(this, arguments)).apply(this, arguments);
            };
        }
        return _makeFlat(false)(map(fn, monad));
    }));

    /**
     * Returns a function, `fn`, which encapsulates if/else-if/else logic.
     * `R.cond` takes a list of [predicate, transform] pairs. All of the arguments
     * to `fn` are applied to each of the predicates in turn until one returns a
     * "truthy" value, at which point `fn` returns the result of applying its
     * arguments to the corresponding transformer. If none of the predicates
     * matches, `fn` returns undefined.
     *
     * @func
     * @memberOf R
     * @since v0.6.0
     * @category Logic
     * @sig [[(*... -> Boolean),(*... -> *)]] -> (*... -> *)
     * @param {Array} pairs
     * @return {Function}
     * @example
     *
     *      var fn = R.cond([
     *        [R.equals(0),   R.always('water freezes at 0°C')],
     *        [R.equals(100), R.always('water boils at 100°C')],
     *        [R.T,           temp => 'nothing special happens at ' + temp + '°C']
     *      ]);
     *      fn(0); //=> 'water freezes at 0°C'
     *      fn(50); //=> 'nothing special happens at 50°C'
     *      fn(100); //=> 'water boils at 100°C'
     */
    var cond = _curry1(function cond(pairs) {
        var arity = reduce(max, 0, map(function (pair) {
            return pair[0].length;
        }, pairs));
        return _arity(arity, function () {
            var idx = 0;
            while (idx < pairs.length) {
                if (pairs[idx][0].apply(this, arguments)) {
                    return pairs[idx][1].apply(this, arguments);
                }
                idx += 1;
            }
        });
    });

    /**
     * Wraps a constructor function inside a curried function that can be called
     * with the same arguments and returns the same type. The arity of the function
     * returned is specified to allow using variadic constructor functions.
     *
     * @func
     * @memberOf R
     * @since v0.4.0
     * @category Function
     * @sig Number -> (* -> {*}) -> (* -> {*})
     * @param {Number} n The arity of the constructor function.
     * @param {Function} Fn The constructor function to wrap.
     * @return {Function} A wrapped, curried constructor function.
     * @example
     *
     *      // Variadic constructor function
     *      var Widget = () => {
     *        this.children = Array.prototype.slice.call(arguments);
     *        // ...
     *      };
     *      Widget.prototype = {
     *        // ...
     *      };
     *      var allConfigs = [
     *        // ...
     *      ];
     *      R.map(R.constructN(1, Widget), allConfigs); // a list of Widgets
     */
    var constructN = _curry2(function constructN(n, Fn) {
        if (n > 10) {
            throw new Error('Constructor with greater than ten arguments');
        }
        if (n === 0) {
            return function () {
                return new Fn();
            };
        }
        return curry(nAry(n, function ($0, $1, $2, $3, $4, $5, $6, $7, $8, $9) {
            switch (arguments.length) {
            case 1:
                return new Fn($0);
            case 2:
                return new Fn($0, $1);
            case 3:
                return new Fn($0, $1, $2);
            case 4:
                return new Fn($0, $1, $2, $3);
            case 5:
                return new Fn($0, $1, $2, $3, $4);
            case 6:
                return new Fn($0, $1, $2, $3, $4, $5);
            case 7:
                return new Fn($0, $1, $2, $3, $4, $5, $6);
            case 8:
                return new Fn($0, $1, $2, $3, $4, $5, $6, $7);
            case 9:
                return new Fn($0, $1, $2, $3, $4, $5, $6, $7, $8);
            case 10:
                return new Fn($0, $1, $2, $3, $4, $5, $6, $7, $8, $9);
            }
        }));
    });

    /**
     * Accepts a converging function and a list of branching functions and returns
     * a new function. When invoked, this new function is applied to some
     * arguments, each branching function is applied to those same arguments. The
     * results of each branching function are passed as arguments to the converging
     * function to produce the return value.
     *
     * @func
     * @memberOf R
     * @since v0.4.2
     * @category Function
     * @sig (x1 -> x2 -> ... -> z) -> [(a -> b -> ... -> x1), (a -> b -> ... -> x2), ...] -> (a -> b -> ... -> z)
     * @param {Function} after A function. `after` will be invoked with the return values of
     *        `fn1` and `fn2` as its arguments.
     * @param {Array} functions A list of functions.
     * @return {Function} A new function.
     * @example
     *
     *      var add = (a, b) => a + b;
     *      var multiply = (a, b) => a * b;
     *      var subtract = (a, b) => a - b;
     *
     *      //≅ multiply( add(1, 2), subtract(1, 2) );
     *      R.converge(multiply, [add, subtract])(1, 2); //=> -3
     *
     *      var add3 = (a, b, c) => a + b + c;
     *      R.converge(add3, [multiply, add, subtract])(1, 2); //=> 4
     */
    var converge = _curry2(function converge(after, fns) {
        return curryN(reduce(max, 0, pluck('length', fns)), function () {
            var args = arguments;
            var context = this;
            return after.apply(context, _map(function (fn) {
                return fn.apply(context, args);
            }, fns));
        });
    });

    /**
     * Counts the elements of a list according to how many match each value of a
     * key generated by the supplied function. Returns an object mapping the keys
     * produced by `fn` to the number of occurrences in the list. Note that all
     * keys are coerced to strings because of how JavaScript objects work.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig (a -> String) -> [a] -> {*}
     * @param {Function} fn The function used to map values to keys.
     * @param {Array} list The list to count elements from.
     * @return {Object} An object mapping keys to number of occurrences in the list.
     * @example
     *
     *      var numbers = [1.0, 1.1, 1.2, 2.0, 3.0, 2.2];
     *      var letters = R.split('', 'abcABCaaaBBc');
     *      R.countBy(Math.floor)(numbers);    //=> {'1': 3, '2': 2, '3': 1}
     *      R.countBy(R.toLower)(letters);   //=> {'a': 5, 'b': 4, 'c': 3}
     */
    var countBy = reduceBy(function (acc, elem) {
        return acc + 1;
    }, 0);

    /**
     * Returns a new list without any consecutively repeating elements. Equality is
     * determined by applying the supplied predicate two consecutive elements. The
     * first element in a series of equal element is the one being preserved.
     *
     * Dispatches to the `dropRepeatsWith` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.14.0
     * @category List
     * @sig (a, a -> Boolean) -> [a] -> [a]
     * @param {Function} pred A predicate used to test whether two items are equal.
     * @param {Array} list The array to consider.
     * @return {Array} `list` without repeating elements.
     * @see R.transduce
     * @example
     *
     *      var l = [1, -1, 1, 3, 4, -4, -4, -5, 5, 3, 3];
     *      R.dropRepeatsWith(R.eqBy(Math.abs), l); //=> [1, 3, 4, -5, 3]
     */
    var dropRepeatsWith = _curry2(_dispatchable('dropRepeatsWith', _xdropRepeatsWith, function dropRepeatsWith(pred, list) {
        var result = [];
        var idx = 1;
        var len = list.length;
        if (len !== 0) {
            result[0] = list[0];
            while (idx < len) {
                if (!pred(last(result), list[idx])) {
                    result[result.length] = list[idx];
                }
                idx += 1;
            }
        }
        return result;
    }));

    /**
     * Takes a function and two values in its domain and returns `true` if the
     * values map to the same value in the codomain; `false` otherwise.
     *
     * @func
     * @memberOf R
     * @since v0.18.0
     * @category Relation
     * @sig (a -> b) -> a -> a -> Boolean
     * @param {Function} f
     * @param {*} x
     * @param {*} y
     * @return {Boolean}
     * @example
     *
     *      R.eqBy(Math.abs, 5, -5); //=> true
     */
    var eqBy = _curry3(function eqBy(f, x, y) {
        return equals(f(x), f(y));
    });

    /**
     * Reports whether two objects have the same value, in `R.equals` terms, for
     * the specified property. Useful as a curried predicate.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Object
     * @sig k -> {k: v} -> {k: v} -> Boolean
     * @param {String} prop The name of the property to compare
     * @param {Object} obj1
     * @param {Object} obj2
     * @return {Boolean}
     *
     * @example
     *
     *      var o1 = { a: 1, b: 2, c: 3, d: 4 };
     *      var o2 = { a: 10, b: 20, c: 3, d: 40 };
     *      R.eqProps('a', o1, o2); //=> false
     *      R.eqProps('c', o1, o2); //=> true
     */
    var eqProps = _curry3(function eqProps(prop, obj1, obj2) {
        return equals(obj1[prop], obj2[prop]);
    });

    /**
     * Splits a list into sub-lists stored in an object, based on the result of
     * calling a String-returning function on each element, and grouping the
     * results according to values returned.
     *
     * Dispatches to the `groupBy` method of the second argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig (a -> String) -> [a] -> {String: [a]}
     * @param {Function} fn Function :: a -> String
     * @param {Array} list The array to group
     * @return {Object} An object with the output of `fn` for keys, mapped to arrays of elements
     *         that produced that key when passed to `fn`.
     * @see R.transduce
     * @example
     *
     *      var byGrade = R.groupBy(function(student) {
     *        var score = student.score;
     *        return score < 65 ? 'F' :
     *               score < 70 ? 'D' :
     *               score < 80 ? 'C' :
     *               score < 90 ? 'B' : 'A';
     *      });
     *      var students = [{name: 'Abby', score: 84},
     *                      {name: 'Eddy', score: 58},
     *                      // ...
     *                      {name: 'Jack', score: 69}];
     *      byGrade(students);
     *      // {
     *      //   'A': [{name: 'Dianne', score: 99}],
     *      //   'B': [{name: 'Abby', score: 84}]
     *      //   // ...,
     *      //   'F': [{name: 'Eddy', score: 58}]
     *      // }
     */
    var groupBy = _curry2(_dispatchable('groupBy', _xgroupBy, reduceBy(function (acc, item) {
        if (acc == null) {
            acc = [];
        }
        acc.push(item);
        return acc;
    }, null)));

    /**
     * Given a function that generates a key, turns a list of objects into an
     * object indexing the objects by the given key. Note that if multiple
     * objects generate the same value for the indexing key only the last value
     * will be included in the generated object.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category List
     * @sig (a -> String) -> [{k: v}] -> {k: {k: v}}
     * @param {Function} fn Function :: a -> String
     * @param {Array} array The array of objects to index
     * @return {Object} An object indexing each array element by the given property.
     * @example
     *
     *      var list = [{id: 'xyz', title: 'A'}, {id: 'abc', title: 'B'}];
     *      R.indexBy(R.prop('id'), list);
     *      //=> {abc: {id: 'abc', title: 'B'}, xyz: {id: 'xyz', title: 'A'}}
     */
    var indexBy = reduceBy(function (acc, elem) {
        return elem;
    }, null);

    /**
     * Returns the position of the first occurrence of an item in an array, or -1
     * if the item is not included in the array. `R.equals` is used to determine
     * equality.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig a -> [a] -> Number
     * @param {*} target The item to find.
     * @param {Array} xs The array to search in.
     * @return {Number} the index of the target, or -1 if the target is not found.
     * @see R.lastIndexOf
     * @example
     *
     *      R.indexOf(3, [1,2,3,4]); //=> 2
     *      R.indexOf(10, [1,2,3,4]); //=> -1
     */
    var indexOf = _curry2(function indexOf(target, xs) {
        return typeof xs.indexOf === 'function' && !_isArray(xs) ? xs.indexOf(target) : _indexOf(xs, target, 0);
    });

    /**
     * juxt applies a list of functions to a list of values.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category Function
     * @sig [(a, b, ..., m) -> n] -> ((a, b, ..., m) -> [n])
     * @param {Array} fns An array of functions
     * @return {Function} A function that returns a list of values after applying each of the original `fns` to its parameters.
     * @see R.applySpec
     * @example
     *
     *      var range = R.juxt([Math.min, Math.max]);
     *      range(3, 4, 9, -3); //=> [-3, 9]
     */
    var juxt = _curry1(function juxt(fns) {
        return converge(_arrayOf, fns);
    });

    /**
     * Returns a lens for the given getter and setter functions. The getter "gets"
     * the value of the focus; the setter "sets" the value of the focus. The setter
     * should not mutate the data structure.
     *
     * @func
     * @memberOf R
     * @since v0.8.0
     * @category Object
     * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
     * @sig (s -> a) -> ((a, s) -> s) -> Lens s a
     * @param {Function} getter
     * @param {Function} setter
     * @return {Lens}
     * @see R.view, R.set, R.over, R.lensIndex, R.lensProp
     * @example
     *
     *      var xLens = R.lens(R.prop('x'), R.assoc('x'));
     *
     *      R.view(xLens, {x: 1, y: 2});            //=> 1
     *      R.set(xLens, 4, {x: 1, y: 2});          //=> {x: 4, y: 2}
     *      R.over(xLens, R.negate, {x: 1, y: 2});  //=> {x: -1, y: 2}
     */
    var lens = _curry2(function lens(getter, setter) {
        return function (toFunctorFn) {
            return function (target) {
                return map(function (focus) {
                    return setter(focus, target);
                }, toFunctorFn(getter(target)));
            };
        };
    });

    /**
     * Returns a lens whose focus is the specified index.
     *
     * @func
     * @memberOf R
     * @since v0.14.0
     * @category Object
     * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
     * @sig Number -> Lens s a
     * @param {Number} n
     * @return {Lens}
     * @see R.view, R.set, R.over
     * @example
     *
     *      var headLens = R.lensIndex(0);
     *
     *      R.view(headLens, ['a', 'b', 'c']);            //=> 'a'
     *      R.set(headLens, 'x', ['a', 'b', 'c']);        //=> ['x', 'b', 'c']
     *      R.over(headLens, R.toUpper, ['a', 'b', 'c']); //=> ['A', 'b', 'c']
     */
    var lensIndex = _curry1(function lensIndex(n) {
        return lens(nth(n), update(n));
    });

    /**
     * Returns a lens whose focus is the specified path.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category Object
     * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
     * @sig [String] -> Lens s a
     * @param {Array} path The path to use.
     * @return {Lens}
     * @see R.view, R.set, R.over
     * @example
     *
     *      var xyLens = R.lensPath(['x', 'y']);
     *
     *      R.view(xyLens, {x: {y: 2, z: 3}});            //=> 2
     *      R.set(xyLens, 4, {x: {y: 2, z: 3}});          //=> {x: {y: 4, z: 3}}
     *      R.over(xyLens, R.negate, {x: {y: 2, z: 3}});  //=> {x: {y: -2, z: 3}}
     */
    var lensPath = _curry1(function lensPath(p) {
        return lens(path(p), assocPath(p));
    });

    /**
     * Returns a lens whose focus is the specified property.
     *
     * @func
     * @memberOf R
     * @since v0.14.0
     * @category Object
     * @typedefn Lens s a = Functor f => (a -> f a) -> s -> f s
     * @sig String -> Lens s a
     * @param {String} k
     * @return {Lens}
     * @see R.view, R.set, R.over
     * @example
     *
     *      var xLens = R.lensProp('x');
     *
     *      R.view(xLens, {x: 1, y: 2});            //=> 1
     *      R.set(xLens, 4, {x: 1, y: 2});          //=> {x: 4, y: 2}
     *      R.over(xLens, R.negate, {x: 1, y: 2});  //=> {x: -1, y: 2}
     */
    var lensProp = _curry1(function lensProp(k) {
        return lens(prop(k), assoc(k));
    });

    /**
     * "lifts" a function to be the specified arity, so that it may "map over" that
     * many lists, Functions or other objects that satisfy the [FantasyLand Apply spec](https://github.com/fantasyland/fantasy-land#apply).
     *
     * @func
     * @memberOf R
     * @since v0.7.0
     * @category Function
     * @sig Number -> (*... -> *) -> ([*]... -> [*])
     * @param {Function} fn The function to lift into higher context
     * @return {Function} The lifted function.
     * @see R.lift, R.ap
     * @example
     *
     *      var madd3 = R.liftN(3, R.curryN(3, (...args) => R.sum(args)));
     *      madd3([1,2,3], [1,2,3], [1]); //=> [3, 4, 5, 4, 5, 6, 5, 6, 7]
     */
    var liftN = _curry2(function liftN(arity, fn) {
        var lifted = curryN(arity, fn);
        return curryN(arity, function () {
            return _reduce(ap, map(lifted, arguments[0]), _slice(arguments, 1));
        });
    });

    /**
     * Returns the mean of the given list of numbers.
     *
     * @func
     * @memberOf R
     * @since v0.14.0
     * @category Math
     * @sig [Number] -> Number
     * @param {Array} list
     * @return {Number}
     * @example
     *
     *      R.mean([2, 7, 9]); //=> 6
     *      R.mean([]); //=> NaN
     */
    var mean = _curry1(function mean(list) {
        return sum(list) / list.length;
    });

    /**
     * Returns the median of the given list of numbers.
     *
     * @func
     * @memberOf R
     * @since v0.14.0
     * @category Math
     * @sig [Number] -> Number
     * @param {Array} list
     * @return {Number}
     * @example
     *
     *      R.median([2, 9, 7]); //=> 7
     *      R.median([7, 2, 10, 9]); //=> 8
     *      R.median([]); //=> NaN
     */
    var median = _curry1(function median(list) {
        var len = list.length;
        if (len === 0) {
            return NaN;
        }
        var width = 2 - len % 2;
        var idx = (len - width) / 2;
        return mean(_slice(list).sort(function (a, b) {
            return a < b ? -1 : a > b ? 1 : 0;
        }).slice(idx, idx + width));
    });

    /**
     * Takes a predicate and a list or other "filterable" object and returns the
     * pair of filterable objects of the same type of elements which do and do not
     * satisfy, the predicate, respectively.
     *
     * @func
     * @memberOf R
     * @since v0.1.4
     * @category List
     * @sig Filterable f => (a -> Boolean) -> f a -> [f a, f a]
     * @param {Function} pred A predicate to determine which side the element belongs to.
     * @param {Array} filterable the list (or other filterable) to partition.
     * @return {Array} An array, containing first the subset of elements that satisfy the
     *         predicate, and second the subset of elements that do not satisfy.
     * @see R.filter, R.reject
     * @example
     *
     *      R.partition(R.contains('s'), ['sss', 'ttt', 'foo', 'bars']);
     *      // => [ [ 'sss', 'bars' ],  [ 'ttt', 'foo' ] ]
     *
     *      R.partition(R.contains('s'), { a: 'sss', b: 'ttt', foo: 'bars' });
     *      // => [ { a: 'sss', foo: 'bars' }, { b: 'ttt' }  ]
     */
    var partition = juxt([
        filter,
        reject
    ]);

    /**
     * Performs left-to-right function composition. The leftmost function may have
     * any arity; the remaining functions must be unary.
     *
     * In some libraries this function is named `sequence`.
     *
     * **Note:** The result of pipe is not automatically curried.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig (((a, b, ..., n) -> o), (o -> p), ..., (x -> y), (y -> z)) -> ((a, b, ..., n) -> z)
     * @param {...Function} functions
     * @return {Function}
     * @see R.compose
     * @example
     *
     *      var f = R.pipe(Math.pow, R.negate, R.inc);
     *
     *      f(3, 4); // -(3^4) + 1
     */
    var pipe = function pipe() {
        if (arguments.length === 0) {
            throw new Error('pipe requires at least one argument');
        }
        return _arity(arguments[0].length, reduce(_pipe, arguments[0], tail(arguments)));
    };

    /**
     * Performs left-to-right composition of one or more Promise-returning
     * functions. The leftmost function may have any arity; the remaining functions
     * must be unary.
     *
     * @func
     * @memberOf R
     * @since v0.10.0
     * @category Function
     * @sig ((a -> Promise b), (b -> Promise c), ..., (y -> Promise z)) -> (a -> Promise z)
     * @param {...Function} functions
     * @return {Function}
     * @see R.composeP
     * @example
     *
     *      //  followersForUser :: String -> Promise [User]
     *      var followersForUser = R.pipeP(db.getUserById, db.getFollowers);
     */
    var pipeP = function pipeP() {
        if (arguments.length === 0) {
            throw new Error('pipeP requires at least one argument');
        }
        return _arity(arguments[0].length, reduce(_pipeP, arguments[0], tail(arguments)));
    };

    /**
     * Multiplies together all the elements of a list.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Math
     * @sig [Number] -> Number
     * @param {Array} list An array of numbers
     * @return {Number} The product of all the numbers in the list.
     * @see R.reduce
     * @example
     *
     *      R.product([2,4,6,8,100,1]); //=> 38400
     */
    var product = reduce(multiply, 1);

    /**
     * Transforms a [Traversable](https://github.com/fantasyland/fantasy-land#traversable)
     * of [Applicative](https://github.com/fantasyland/fantasy-land#applicative) into an
     * Applicative of Traversable.
     *
     * Dispatches to the `sequence` method of the second argument, if present.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category List
     * @sig (Applicative f, Traversable t) => (a -> f a) -> t (f a) -> f (t a)
     * @param {Function} of
     * @param {*} traversable
     * @return {*}
     * @see R.traverse
     * @example
     *
     *      R.sequence(Maybe.of, [Just(1), Just(2), Just(3)]);   //=> Just([1, 2, 3])
     *      R.sequence(Maybe.of, [Just(1), Just(2), Nothing()]); //=> Nothing()
     *
     *      R.sequence(R.of, Just([1, 2, 3])); //=> [Just(1), Just(2), Just(3)]
     *      R.sequence(R.of, Nothing());       //=> [Nothing()]
     */
    var sequence = _curry2(function sequence(of, traversable) {
        return typeof traversable.sequence === 'function' ? traversable.sequence(of) : reduceRight(function (acc, x) {
            return ap(map(prepend, x), acc);
        }, of([]), traversable);
    });

    /**
     * Maps an [Applicative](https://github.com/fantasyland/fantasy-land#applicative)-returning
     * function over a [Traversable](https://github.com/fantasyland/fantasy-land#traversable),
     * then uses [`sequence`](#sequence) to transform the resulting Traversable of Applicative
     * into an Applicative of Traversable.
     *
     * Dispatches to the `sequence` method of the third argument, if present.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category List
     * @sig (Applicative f, Traversable t) => (a -> f a) -> (a -> f b) -> t a -> f (t b)
     * @param {Function} of
     * @param {Function} f
     * @param {*} traversable
     * @return {*}
     * @see R.sequence
     * @example
     *
     *      // Returns `Nothing` if the given divisor is `0`
     *      safeDiv = n => d => d === 0 ? Nothing() : Just(n / d)
     *
     *      R.traverse(Maybe.of, safeDiv(10), [2, 4, 5]); //=> Just([5, 2.5, 2])
     *      R.traverse(Maybe.of, safeDiv(10), [2, 0, 5]); //=> Nothing
     */
    var traverse = _curry3(function traverse(of, f, traversable) {
        return sequence(of, map(f, traversable));
    });

    /**
     * Shorthand for `R.chain(R.identity)`, which removes one level of nesting from
     * any [Chain](https://github.com/fantasyland/fantasy-land#chain).
     *
     * @func
     * @memberOf R
     * @since v0.3.0
     * @category List
     * @sig Chain c => c (c a) -> c a
     * @param {*} list
     * @return {*}
     * @see R.flatten, R.chain
     * @example
     *
     *      R.unnest([1, [2], [[3]]]); //=> [1, 2, [3]]
     *      R.unnest([[1, 2], [3, 4], [5, 6]]); //=> [1, 2, 3, 4, 5, 6]
     */
    var unnest = chain(_identity);

    var _contains = function _contains(a, list) {
        return _indexOf(list, a, 0) >= 0;
    };

    //  mapPairs :: (Object, [String]) -> [String]
    var _toString = function _toString(x, seen) {
        var recur = function recur(y) {
            var xs = seen.concat([x]);
            return _contains(y, xs) ? '<Circular>' : _toString(y, xs);
        };
        //  mapPairs :: (Object, [String]) -> [String]
        var mapPairs = function (obj, keys) {
            return _map(function (k) {
                return _quote(k) + ': ' + recur(obj[k]);
            }, keys.slice().sort());
        };
        switch (Object.prototype.toString.call(x)) {
        case '[object Arguments]':
            return '(function() { return arguments; }(' + _map(recur, x).join(', ') + '))';
        case '[object Array]':
            return '[' + _map(recur, x).concat(mapPairs(x, reject(function (k) {
                return /^\d+$/.test(k);
            }, keys(x)))).join(', ') + ']';
        case '[object Boolean]':
            return typeof x === 'object' ? 'new Boolean(' + recur(x.valueOf()) + ')' : x.toString();
        case '[object Date]':
            return 'new Date(' + (isNaN(x.valueOf()) ? recur(NaN) : _quote(_toISOString(x))) + ')';
        case '[object Null]':
            return 'null';
        case '[object Number]':
            return typeof x === 'object' ? 'new Number(' + recur(x.valueOf()) + ')' : 1 / x === -Infinity ? '-0' : x.toString(10);
        case '[object String]':
            return typeof x === 'object' ? 'new String(' + recur(x.valueOf()) + ')' : _quote(x);
        case '[object Undefined]':
            return 'undefined';
        default:
            if (typeof x.toString === 'function') {
                var repr = x.toString();
                if (repr !== '[object Object]') {
                    return repr;
                }
            }
            return '{' + mapPairs(x, keys(x)).join(', ') + '}';
        }
    };

    /**
     * Performs right-to-left function composition. The rightmost function may have
     * any arity; the remaining functions must be unary.
     *
     * **Note:** The result of compose is not automatically curried.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig ((y -> z), (x -> y), ..., (o -> p), ((a, b, ..., n) -> o)) -> ((a, b, ..., n) -> z)
     * @param {...Function} functions
     * @return {Function}
     * @see R.pipe
     * @example
     *
     *      var f = R.compose(R.inc, R.negate, Math.pow);
     *
     *      f(3, 4); // -(3^4) + 1
     */
    var compose = function compose() {
        if (arguments.length === 0) {
            throw new Error('compose requires at least one argument');
        }
        return pipe.apply(this, reverse(arguments));
    };

    /**
     * Returns the right-to-left Kleisli composition of the provided functions,
     * each of which must return a value of a type supported by [`chain`](#chain).
     *
     * `R.composeK(h, g, f)` is equivalent to `R.compose(R.chain(h), R.chain(g), R.chain(f))`.
     *
     * @func
     * @memberOf R
     * @since v0.16.0
     * @category Function
     * @sig Chain m => ((y -> m z), (x -> m y), ..., (a -> m b)) -> (m a -> m z)
     * @param {...Function}
     * @return {Function}
     * @see R.pipeK
     * @example
     *
     *      //  parseJson :: String -> Maybe *
     *      //  get :: String -> Object -> Maybe *
     *
     *      //  getStateCode :: Maybe String -> Maybe String
     *      var getStateCode = R.composeK(
     *        R.compose(Maybe.of, R.toUpper),
     *        get('state'),
     *        get('address'),
     *        get('user'),
     *        parseJson
     *      );
     *
     *      getStateCode(Maybe.of('{"user":{"address":{"state":"ny"}}}'));
     *      //=> Just('NY')
     *      getStateCode(Maybe.of('[Invalid JSON]'));
     *      //=> Nothing()
     */
    var composeK = function composeK() {
        return compose.apply(this, prepend(identity, map(chain, arguments)));
    };

    /**
     * Performs right-to-left composition of one or more Promise-returning
     * functions. The rightmost function may have any arity; the remaining
     * functions must be unary.
     *
     * @func
     * @memberOf R
     * @since v0.10.0
     * @category Function
     * @sig ((y -> Promise z), (x -> Promise y), ..., (a -> Promise b)) -> (a -> Promise z)
     * @param {...Function} functions
     * @return {Function}
     * @see R.pipeP
     * @example
     *
     *      //  followersForUser :: String -> Promise [User]
     *      var followersForUser = R.composeP(db.getFollowers, db.getUserById);
     */
    var composeP = function composeP() {
        if (arguments.length === 0) {
            throw new Error('composeP requires at least one argument');
        }
        return pipeP.apply(this, reverse(arguments));
    };

    /**
     * Wraps a constructor function inside a curried function that can be called
     * with the same arguments and returns the same type.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig (* -> {*}) -> (* -> {*})
     * @param {Function} Fn The constructor function to wrap.
     * @return {Function} A wrapped, curried constructor function.
     * @example
     *
     *      // Constructor function
     *      var Widget = config => {
     *        // ...
     *      };
     *      Widget.prototype = {
     *        // ...
     *      };
     *      var allConfigs = [
     *        // ...
     *      ];
     *      R.map(R.construct(Widget), allConfigs); // a list of Widgets
     */
    var construct = _curry1(function construct(Fn) {
        return constructN(Fn.length, Fn);
    });

    /**
     * Returns `true` if the specified value is equal, in `R.equals` terms, to at
     * least one element of the given list; `false` otherwise.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig a -> [a] -> Boolean
     * @param {Object} a The item to compare against.
     * @param {Array} list The array to consider.
     * @return {Boolean} `true` if the item is in the list, `false` otherwise.
     * @see R.any
     * @example
     *
     *      R.contains(3, [1, 2, 3]); //=> true
     *      R.contains(4, [1, 2, 3]); //=> false
     *      R.contains([42], [[42]]); //=> true
     */
    var contains = _curry2(_contains);

    /**
     * Finds the set (i.e. no duplicates) of all elements in the first list not
     * contained in the second list.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig [*] -> [*] -> [*]
     * @param {Array} list1 The first list.
     * @param {Array} list2 The second list.
     * @return {Array} The elements in `list1` that are not in `list2`.
     * @see R.differenceWith
     * @example
     *
     *      R.difference([1,2,3,4], [7,6,5,4,3]); //=> [1,2]
     *      R.difference([7,6,5,4,3], [1,2,3,4]); //=> [7,6,5]
     */
    var difference = _curry2(function difference(first, second) {
        var out = [];
        var idx = 0;
        var firstLen = first.length;
        while (idx < firstLen) {
            if (!_contains(first[idx], second) && !_contains(first[idx], out)) {
                out[out.length] = first[idx];
            }
            idx += 1;
        }
        return out;
    });

    /**
     * Returns a new list without any consecutively repeating elements. `R.equals`
     * is used to determine equality.
     *
     * Dispatches to the `dropRepeats` method of the first argument, if present.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.14.0
     * @category List
     * @sig [a] -> [a]
     * @param {Array} list The array to consider.
     * @return {Array} `list` without repeating elements.
     * @see R.transduce
     * @example
     *
     *     R.dropRepeats([1, 1, 1, 2, 3, 4, 4, 2, 2]); //=> [1, 2, 3, 4, 2]
     */
    var dropRepeats = _curry1(_dispatchable('dropRepeats', _xdropRepeatsWith(equals), dropRepeatsWith(equals)));

    /**
     * "lifts" a function of arity > 1 so that it may "map over" a list, Function or other
     * object that satisfies the [FantasyLand Apply spec](https://github.com/fantasyland/fantasy-land#apply).
     *
     * @func
     * @memberOf R
     * @since v0.7.0
     * @category Function
     * @sig (*... -> *) -> ([*]... -> [*])
     * @param {Function} fn The function to lift into higher context
     * @return {Function} The lifted function.
     * @see R.liftN
     * @example
     *
     *      var madd3 = R.lift(R.curry((a, b, c) => a + b + c));
     *
     *      madd3([1,2,3], [1,2,3], [1]); //=> [3, 4, 5, 4, 5, 6, 5, 6, 7]
     *
     *      var madd5 = R.lift(R.curry((a, b, c, d, e) => a + b + c + d + e));
     *
     *      madd5([1,2], [3], [4, 5], [6], [7, 8]); //=> [21, 22, 22, 23, 22, 23, 23, 24]
     */
    var lift = _curry1(function lift(fn) {
        return liftN(fn.length, fn);
    });

    /**
     * Returns a partial copy of an object omitting the keys specified.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Object
     * @sig [String] -> {String: *} -> {String: *}
     * @param {Array} names an array of String property names to omit from the new object
     * @param {Object} obj The object to copy from
     * @return {Object} A new object with properties from `names` not on it.
     * @see R.pick
     * @example
     *
     *      R.omit(['a', 'd'], {a: 1, b: 2, c: 3, d: 4}); //=> {b: 2, c: 3}
     */
    var omit = _curry2(function omit(names, obj) {
        var result = {};
        for (var prop in obj) {
            if (!_contains(prop, names)) {
                result[prop] = obj[prop];
            }
        }
        return result;
    });

    /**
     * Returns the left-to-right Kleisli composition of the provided functions,
     * each of which must return a value of a type supported by [`chain`](#chain).
     *
     * `R.pipeK(f, g, h)` is equivalent to `R.pipe(R.chain(f), R.chain(g), R.chain(h))`.
     *
     * @func
     * @memberOf R
     * @since v0.16.0
     * @category Function
     * @sig Chain m => ((a -> m b), (b -> m c), ..., (y -> m z)) -> (m a -> m z)
     * @param {...Function}
     * @return {Function}
     * @see R.composeK
     * @example
     *
     *      //  parseJson :: String -> Maybe *
     *      //  get :: String -> Object -> Maybe *
     *
     *      //  getStateCode :: Maybe String -> Maybe String
     *      var getStateCode = R.pipeK(
     *        parseJson,
     *        get('user'),
     *        get('address'),
     *        get('state'),
     *        R.compose(Maybe.of, R.toUpper)
     *      );
     *
     *      getStateCode(Maybe.of('{"user":{"address":{"state":"ny"}}}'));
     *      //=> Just('NY')
     *      getStateCode(Maybe.of('[Invalid JSON]'));
     *      //=> Nothing()
     */
    var pipeK = function pipeK() {
        return composeK.apply(this, reverse(arguments));
    };

    /**
     * Returns the string representation of the given value. `eval`'ing the output
     * should result in a value equivalent to the input value. Many of the built-in
     * `toString` methods do not satisfy this requirement.
     *
     * If the given value is an `[object Object]` with a `toString` method other
     * than `Object.prototype.toString`, this method is invoked with no arguments
     * to produce the return value. This means user-defined constructor functions
     * can provide a suitable `toString` method. For example:
     *
     *     function Point(x, y) {
     *       this.x = x;
     *       this.y = y;
     *     }
     *
     *     Point.prototype.toString = function() {
     *       return 'new Point(' + this.x + ', ' + this.y + ')';
     *     };
     *
     *     R.toString(new Point(1, 2)); //=> 'new Point(1, 2)'
     *
     * @func
     * @memberOf R
     * @since v0.14.0
     * @category String
     * @sig * -> String
     * @param {*} val
     * @return {String}
     * @example
     *
     *      R.toString(42); //=> '42'
     *      R.toString('abc'); //=> '"abc"'
     *      R.toString([1, 2, 3]); //=> '[1, 2, 3]'
     *      R.toString({foo: 1, bar: 2, baz: 3}); //=> '{"bar": 2, "baz": 3, "foo": 1}'
     *      R.toString(new Date('2001-02-03T04:05:06Z')); //=> 'new Date("2001-02-03T04:05:06.000Z")'
     */
    var toString = _curry1(function toString(val) {
        return _toString(val, []);
    });

    /**
     * Returns a new list without values in the first argument.
     * `R.equals` is used to determine equality.
     *
     * Acts as a transducer if a transformer is given in list position.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category List
     * @sig [a] -> [a] -> [a]
     * @param {Array} list1 The values to be removed from `list2`.
     * @param {Array} list2 The array to remove values from.
     * @return {Array} The new array without values in `list1`.
     * @see R.transduce
     * @example
     *
     *      R.without([1, 2], [1, 2, 1, 3, 4]); //=> [3, 4]
     */
    var without = _curry2(function (xs, list) {
        return reject(flip(_contains)(xs), list);
    });

    // A simple Set type that honours R.equals semantics
    /* globals Set */
    /**
       * Combines the logic for checking whether an item is a member of the set and
       * for adding a new item to the set.
       *
       * @param item       The item to check or add to the Set instance.
       * @param shouldAdd  If true, the item will be added to the set if it doesn't
       *                   already exist.
       * @param set        The set instance to check or add to.
       * @return {boolean} When shouldAdd is true, this will return true when a new
       *                   item was added otherwise false. When shouldAdd is false,
       *                   this will return true if the item already exists, otherwise
       *                   false.
       */
    // distinguish between +0 and -0
    // these types can all utilise Set
    // set._items['boolean'] holds a two element array
    // representing [ falseExists, trueExists ]
    // compare functions for reference equality
    /* falls through */
    // reduce the search size of heterogeneous sets by creating buckets
    // for each type.
    // scan through all previously applied items
    var _Set = function () {
        function _Set() {
            /* globals Set */
            this._nativeSet = typeof Set === 'function' ? new Set() : null;
            this._items = {};
        }
        _Set.prototype.add = function (item) {
            return hasOrAdd(item, true, this);
        };
        _Set.prototype.has = function (item) {
            return hasOrAdd(item, false, this);
        };
        /**
       * Combines the logic for checking whether an item is a member of the set and
       * for adding a new item to the set.
       *
       * @param item       The item to check or add to the Set instance.
       * @param shouldAdd  If true, the item will be added to the set if it doesn't
       *                   already exist.
       * @param set        The set instance to check or add to.
       * @return {boolean} When shouldAdd is true, this will return true when a new
       *                   item was added otherwise false. When shouldAdd is false,
       *                   this will return true if the item already exists, otherwise
       *                   false.
       */
        function hasOrAdd(item, shouldAdd, set) {
            var type = typeof item;
            var prevSize, newSize;
            switch (type) {
            case 'string':
            case 'number':
                // distinguish between +0 and -0
                if (item === 0 && !set._items['-0'] && 1 / item === -Infinity) {
                    if (shouldAdd) {
                        set._items['-0'] = true;
                    }
                    return shouldAdd;
                }
                // these types can all utilise Set
                if (set._nativeSet !== null) {
                    if (shouldAdd) {
                        prevSize = set._nativeSet.size;
                        set._nativeSet.add(item);
                        newSize = set._nativeSet.size;
                        return newSize > prevSize;
                    } else {
                        return set._nativeSet.has(item);
                    }
                } else {
                    if (!(type in set._items)) {
                        if (shouldAdd) {
                            set._items[type] = {};
                            set._items[type][item] = true;
                        }
                        return shouldAdd;
                    } else if (item in set._items[type]) {
                        return !shouldAdd;
                    } else {
                        if (shouldAdd) {
                            set._items[type][item] = true;
                        }
                        return shouldAdd;
                    }
                }
            case 'boolean':
                // set._items['boolean'] holds a two element array
                // representing [ falseExists, trueExists ]
                if (type in set._items) {
                    var bIdx = item ? 1 : 0;
                    if (set._items[type][bIdx]) {
                        return !shouldAdd;
                    } else {
                        if (shouldAdd) {
                            set._items[type][bIdx] = true;
                        }
                        return shouldAdd;
                    }
                } else {
                    if (shouldAdd) {
                        set._items[type] = item ? [
                            false,
                            true
                        ] : [
                            true,
                            false
                        ];
                    }
                    return shouldAdd;
                }
            case 'function':
                // compare functions for reference equality
                if (set._nativeSet !== null) {
                    if (shouldAdd) {
                        prevSize = set._nativeSet.size;
                        set._nativeSet.add(item);
                        newSize = set._nativeSet.size;
                        return newSize > prevSize;
                    } else {
                        return set._nativeSet.has(item);
                    }
                } else {
                    if (!(type in set._items)) {
                        if (shouldAdd) {
                            set._items[type] = [item];
                        }
                        return shouldAdd;
                    }
                    if (!_contains(item, set._items[type])) {
                        if (shouldAdd) {
                            set._items[type].push(item);
                        }
                        return shouldAdd;
                    }
                }
                return !shouldAdd;
            case 'undefined':
                if (set._items[type]) {
                    return !shouldAdd;
                } else {
                    if (shouldAdd) {
                        set._items[type] = true;
                    }
                    return shouldAdd;
                }
            case 'object':
                if (item === null) {
                    if (!set._items['null']) {
                        if (shouldAdd) {
                            set._items['null'] = true;
                        }
                        return shouldAdd;
                    }
                    return !shouldAdd;
                }
            /* falls through */
            default:
                // reduce the search size of heterogeneous sets by creating buckets
                // for each type.
                type = Object.prototype.toString.call(item);
                if (!(type in set._items)) {
                    if (shouldAdd) {
                        set._items[type] = [item];
                    }
                    return shouldAdd;
                }
                // scan through all previously applied items
                if (!_contains(item, set._items[type])) {
                    if (shouldAdd) {
                        set._items[type].push(item);
                    }
                    return shouldAdd;
                }
                return !shouldAdd;
            }
        }
        return _Set;
    }();

    /**
     * A function wrapping calls to the two functions in an `&&` operation,
     * returning the result of the first function if it is false-y and the result
     * of the second function otherwise. Note that this is short-circuited,
     * meaning that the second function will not be invoked if the first returns a
     * false-y value.
     *
     * In addition to functions, `R.both` also accepts any fantasy-land compatible
     * applicative functor.
     *
     * @func
     * @memberOf R
     * @since v0.12.0
     * @category Logic
     * @sig (*... -> Boolean) -> (*... -> Boolean) -> (*... -> Boolean)
     * @param {Function} f a predicate
     * @param {Function} g another predicate
     * @return {Function} a function that applies its arguments to `f` and `g` and `&&`s their outputs together.
     * @see R.and
     * @example
     *
     *      var gt10 = x => x > 10;
     *      var even = x => x % 2 === 0;
     *      var f = R.both(gt10, even);
     *      f(100); //=> true
     *      f(101); //=> false
     */
    var both = _curry2(function both(f, g) {
        return _isFunction(f) ? function _both() {
            return f.apply(this, arguments) && g.apply(this, arguments);
        } : lift(and)(f, g);
    });

    /**
     * Takes a function `f` and returns a function `g` such that:
     *
     *   - applying `g` to zero or more arguments will give __true__ if applying
     *     the same arguments to `f` gives a logical __false__ value; and
     *
     *   - applying `g` to zero or more arguments will give __false__ if applying
     *     the same arguments to `f` gives a logical __true__ value.
     *
     * `R.complement` will work on all other functors as well.
     *
     * @func
     * @memberOf R
     * @since v0.12.0
     * @category Logic
     * @sig (*... -> *) -> (*... -> Boolean)
     * @param {Function} f
     * @return {Function}
     * @see R.not
     * @example
     *
     *      var isEven = n => n % 2 === 0;
     *      var isOdd = R.complement(isEven);
     *      isOdd(21); //=> true
     *      isOdd(42); //=> false
     */
    var complement = lift(not);

    /**
     * A function wrapping calls to the two functions in an `||` operation,
     * returning the result of the first function if it is truth-y and the result
     * of the second function otherwise. Note that this is short-circuited,
     * meaning that the second function will not be invoked if the first returns a
     * truth-y value.
     *
     * In addition to functions, `R.either` also accepts any fantasy-land compatible
     * applicative functor.
     *
     * @func
     * @memberOf R
     * @since v0.12.0
     * @category Logic
     * @sig (*... -> Boolean) -> (*... -> Boolean) -> (*... -> Boolean)
     * @param {Function} f a predicate
     * @param {Function} g another predicate
     * @return {Function} a function that applies its arguments to `f` and `g` and `||`s their outputs together.
     * @see R.or
     * @example
     *
     *      var gt10 = x => x > 10;
     *      var even = x => x % 2 === 0;
     *      var f = R.either(gt10, even);
     *      f(101); //=> true
     *      f(8); //=> true
     */
    var either = _curry2(function either(f, g) {
        return _isFunction(f) ? function _either() {
            return f.apply(this, arguments) || g.apply(this, arguments);
        } : lift(or)(f, g);
    });

    /**
     * Turns a named method with a specified arity into a function that can be
     * called directly supplied with arguments and a target object.
     *
     * The returned function is curried and accepts `arity + 1` parameters where
     * the final parameter is the target object.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig Number -> String -> (a -> b -> ... -> n -> Object -> *)
     * @param {Number} arity Number of arguments the returned function should take
     *        before the target object.
     * @param {String} method Name of the method to call.
     * @return {Function} A new curried function.
     * @example
     *
     *      var sliceFrom = R.invoker(1, 'slice');
     *      sliceFrom(6, 'abcdefghijklm'); //=> 'ghijklm'
     *      var sliceFrom6 = R.invoker(2, 'slice')(6);
     *      sliceFrom6(8, 'abcdefghijklm'); //=> 'gh'
     */
    var invoker = _curry2(function invoker(arity, method) {
        return curryN(arity + 1, function () {
            var target = arguments[arity];
            if (target != null && is(Function, target[method])) {
                return target[method].apply(target, _slice(arguments, 0, arity));
            }
            throw new TypeError(toString(target) + ' does not have a method named "' + method + '"');
        });
    });

    /**
     * Returns a string made by inserting the `separator` between each element and
     * concatenating all the elements into a single string.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig String -> [a] -> String
     * @param {Number|String} separator The string used to separate the elements.
     * @param {Array} xs The elements to join into a string.
     * @return {String} str The string made by concatenating `xs` with `separator`.
     * @see R.split
     * @example
     *
     *      var spacer = R.join(' ');
     *      spacer(['a', 2, 3.4]);   //=> 'a 2 3.4'
     *      R.join('|', [1, 2, 3]);    //=> '1|2|3'
     */
    var join = invoker(1, 'join');

    /**
     * Creates a new function that, when invoked, caches the result of calling `fn`
     * for a given argument set and returns the result. Subsequent calls to the
     * memoized `fn` with the same argument set will not result in an additional
     * call to `fn`; instead, the cached result for that set of arguments will be
     * returned.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Function
     * @sig (*... -> a) -> (*... -> a)
     * @param {Function} fn The function to memoize.
     * @return {Function} Memoized version of `fn`.
     * @example
     *
     *      var count = 0;
     *      var factorial = R.memoize(n => {
     *        count += 1;
     *        return R.product(R.range(1, n + 1));
     *      });
     *      factorial(5); //=> 120
     *      factorial(5); //=> 120
     *      factorial(5); //=> 120
     *      count; //=> 1
     */
    var memoize = _curry1(function memoize(fn) {
        var cache = {};
        return _arity(fn.length, function () {
            var key = toString(arguments);
            if (!_has(key, cache)) {
                cache[key] = fn.apply(this, arguments);
            }
            return cache[key];
        });
    });

    /**
     * Splits a string into an array of strings based on the given
     * separator.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category String
     * @sig (String | RegExp) -> String -> [String]
     * @param {String|RegExp} sep The pattern.
     * @param {String} str The string to separate into an array.
     * @return {Array} The array of strings from `str` separated by `str`.
     * @see R.join
     * @example
     *
     *      var pathComponents = R.split('/');
     *      R.tail(pathComponents('/usr/local/bin/node')); //=> ['usr', 'local', 'bin', 'node']
     *
     *      R.split('.', 'a.b.c.xyz.d'); //=> ['a', 'b', 'c', 'xyz', 'd']
     */
    var split = invoker(1, 'split');

    /**
     * Determines whether a given string matches a given regular expression.
     *
     * @func
     * @memberOf R
     * @since v0.12.0
     * @category String
     * @sig RegExp -> String -> Boolean
     * @param {RegExp} pattern
     * @param {String} str
     * @return {Boolean}
     * @see R.match
     * @example
     *
     *      R.test(/^x/, 'xyz'); //=> true
     *      R.test(/^y/, 'xyz'); //=> false
     */
    var test = _curry2(function test(pattern, str) {
        if (!_isRegExp(pattern)) {
            throw new TypeError('\u2018test\u2019 requires a value of type RegExp as its first argument; received ' + toString(pattern));
        }
        return _cloneRegExp(pattern).test(str);
    });

    /**
     * The lower case version of a string.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category String
     * @sig String -> String
     * @param {String} str The string to lower case.
     * @return {String} The lower case version of `str`.
     * @see R.toUpper
     * @example
     *
     *      R.toLower('XYZ'); //=> 'xyz'
     */
    var toLower = invoker(0, 'toLowerCase');

    /**
     * The upper case version of a string.
     *
     * @func
     * @memberOf R
     * @since v0.9.0
     * @category String
     * @sig String -> String
     * @param {String} str The string to upper case.
     * @return {String} The upper case version of `str`.
     * @see R.toLower
     * @example
     *
     *      R.toUpper('abc'); //=> 'ABC'
     */
    var toUpper = invoker(0, 'toUpperCase');

    /**
     * Returns a new list containing only one copy of each element in the original
     * list, based upon the value returned by applying the supplied function to
     * each list element. Prefers the first item if the supplied function produces
     * the same value on two items. `R.equals` is used for comparison.
     *
     * @func
     * @memberOf R
     * @since v0.16.0
     * @category List
     * @sig (a -> b) -> [a] -> [a]
     * @param {Function} fn A function used to produce a value to use during comparisons.
     * @param {Array} list The array to consider.
     * @return {Array} The list of unique items.
     * @example
     *
     *      R.uniqBy(Math.abs, [-1, -5, 2, 10, 1, 2]); //=> [-1, -5, 2, 10]
     */
    var uniqBy = _curry2(function uniqBy(fn, list) {
        var set = new _Set();
        var result = [];
        var idx = 0;
        var appliedItem, item;
        while (idx < list.length) {
            item = list[idx];
            appliedItem = fn(item);
            if (set.add(appliedItem)) {
                result.push(item);
            }
            idx += 1;
        }
        return result;
    });

    /**
     * Returns the result of concatenating the given lists or strings.
     *
     * Dispatches to the `concat` method of the first argument, if present.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig [a] -> [a] -> [a]
     * @sig String -> String -> String
     * @param {Array|String} a
     * @param {Array|String} b
     * @return {Array|String}
     *
     * @example
     *
     *      R.concat([], []); //=> []
     *      R.concat([4, 5, 6], [1, 2, 3]); //=> [4, 5, 6, 1, 2, 3]
     *      R.concat('ABC', 'DEF'); // 'ABCDEF'
     */
    var concat = flip(invoker(1, 'concat'));

    /**
     * Finds the set (i.e. no duplicates) of all elements contained in the first or
     * second list, but not both.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category Relation
     * @sig [*] -> [*] -> [*]
     * @param {Array} list1 The first list.
     * @param {Array} list2 The second list.
     * @return {Array} The elements in `list1` or `list2`, but not both.
     * @see R.symmetricDifferenceWith
     * @example
     *
     *      R.symmetricDifference([1,2,3,4], [7,6,5,4,3]); //=> [1,2,7,6,5]
     *      R.symmetricDifference([7,6,5,4,3], [1,2,3,4]); //=> [7,6,5,1,2]
     */
    var symmetricDifference = _curry2(function symmetricDifference(list1, list2) {
        return concat(difference(list1, list2), difference(list2, list1));
    });

    /**
     * Finds the set (i.e. no duplicates) of all elements contained in the first or
     * second list, but not both. Duplication is determined according to the value
     * returned by applying the supplied predicate to two list elements.
     *
     * @func
     * @memberOf R
     * @since v0.19.0
     * @category Relation
     * @sig (a -> a -> Boolean) -> [a] -> [a] -> [a]
     * @param {Function} pred A predicate used to test whether two items are equal.
     * @param {Array} list1 The first list.
     * @param {Array} list2 The second list.
     * @return {Array} The elements in `list1` or `list2`, but not both.
     * @see R.symmetricDifference
     * @example
     *
     *      var eqA = R.eqBy(R.prop('a'));
     *      var l1 = [{a: 1}, {a: 2}, {a: 3}, {a: 4}];
     *      var l2 = [{a: 3}, {a: 4}, {a: 5}, {a: 6}];
     *      R.symmetricDifferenceWith(eqA, l1, l2); //=> [{a: 1}, {a: 2}, {a: 5}, {a: 6}]
     */
    var symmetricDifferenceWith = _curry3(function symmetricDifferenceWith(pred, list1, list2) {
        return concat(differenceWith(pred, list1, list2), differenceWith(pred, list2, list1));
    });

    /**
     * Returns a new list containing only one copy of each element in the original
     * list. `R.equals` is used to determine equality.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category List
     * @sig [a] -> [a]
     * @param {Array} list The array to consider.
     * @return {Array} The list of unique items.
     * @example
     *
     *      R.uniq([1, 1, 2, 1]); //=> [1, 2]
     *      R.uniq([1, '1']);     //=> [1, '1']
     *      R.uniq([[42], [42]]); //=> [[42]]
     */
    var uniq = uniqBy(identity);

    /**
     * Combines two lists into a set (i.e. no duplicates) composed of those
     * elements common to both lists.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig [*] -> [*] -> [*]
     * @param {Array} list1 The first list.
     * @param {Array} list2 The second list.
     * @return {Array} The list of elements found in both `list1` and `list2`.
     * @see R.intersectionWith
     * @example
     *
     *      R.intersection([1,2,3,4], [7,6,5,4,3]); //=> [4, 3]
     */
    var intersection = _curry2(function intersection(list1, list2) {
        var lookupList, filteredList;
        if (list1.length > list2.length) {
            lookupList = list1;
            filteredList = list2;
        } else {
            lookupList = list2;
            filteredList = list1;
        }
        return uniq(_filter(flip(_contains)(lookupList), filteredList));
    });

    /**
     * Combines two lists into a set (i.e. no duplicates) composed of the elements
     * of each list.
     *
     * @func
     * @memberOf R
     * @since v0.1.0
     * @category Relation
     * @sig [*] -> [*] -> [*]
     * @param {Array} as The first list.
     * @param {Array} bs The second list.
     * @return {Array} The first and second lists concatenated, with
     *         duplicates removed.
     * @example
     *
     *      R.union([1, 2, 3], [2, 3, 4]); //=> [1, 2, 3, 4]
     */
    var union = _curry2(compose(uniq, _concat));

    var R = {
        F: F,
        T: T,
        __: __,
        add: add,
        addIndex: addIndex,
        adjust: adjust,
        all: all,
        allPass: allPass,
        allUniq: allUniq,
        always: always,
        and: and,
        any: any,
        anyPass: anyPass,
        ap: ap,
        aperture: aperture,
        append: append,
        apply: apply,
        applySpec: applySpec,
        assoc: assoc,
        assocPath: assocPath,
        binary: binary,
        bind: bind,
        both: both,
        call: call,
        chain: chain,
        clamp: clamp,
        clone: clone,
        comparator: comparator,
        complement: complement,
        compose: compose,
        composeK: composeK,
        composeP: composeP,
        concat: concat,
        cond: cond,
        construct: construct,
        constructN: constructN,
        contains: contains,
        converge: converge,
        countBy: countBy,
        curry: curry,
        curryN: curryN,
        dec: dec,
        defaultTo: defaultTo,
        difference: difference,
        differenceWith: differenceWith,
        dissoc: dissoc,
        dissocPath: dissocPath,
        divide: divide,
        drop: drop,
        dropLast: dropLast,
        dropLastWhile: dropLastWhile,
        dropRepeats: dropRepeats,
        dropRepeatsWith: dropRepeatsWith,
        dropWhile: dropWhile,
        either: either,
        empty: empty,
        eqBy: eqBy,
        eqProps: eqProps,
        equals: equals,
        evolve: evolve,
        filter: filter,
        find: find,
        findIndex: findIndex,
        findLast: findLast,
        findLastIndex: findLastIndex,
        flatten: flatten,
        flip: flip,
        forEach: forEach,
        fromPairs: fromPairs,
        groupBy: groupBy,
        groupWith: groupWith,
        gt: gt,
        gte: gte,
        has: has,
        hasIn: hasIn,
        head: head,
        identical: identical,
        identity: identity,
        ifElse: ifElse,
        inc: inc,
        indexBy: indexBy,
        indexOf: indexOf,
        init: init,
        insert: insert,
        insertAll: insertAll,
        intersection: intersection,
        intersectionWith: intersectionWith,
        intersperse: intersperse,
        into: into,
        invert: invert,
        invertObj: invertObj,
        invoker: invoker,
        is: is,
        isArrayLike: isArrayLike,
        isEmpty: isEmpty,
        isNil: isNil,
        join: join,
        juxt: juxt,
        keys: keys,
        keysIn: keysIn,
        last: last,
        lastIndexOf: lastIndexOf,
        length: length,
        lens: lens,
        lensIndex: lensIndex,
        lensPath: lensPath,
        lensProp: lensProp,
        lift: lift,
        liftN: liftN,
        lt: lt,
        lte: lte,
        map: map,
        mapAccum: mapAccum,
        mapAccumRight: mapAccumRight,
        mapObjIndexed: mapObjIndexed,
        match: match,
        mathMod: mathMod,
        max: max,
        maxBy: maxBy,
        mean: mean,
        median: median,
        memoize: memoize,
        merge: merge,
        mergeAll: mergeAll,
        mergeWith: mergeWith,
        mergeWithKey: mergeWithKey,
        min: min,
        minBy: minBy,
        modulo: modulo,
        multiply: multiply,
        nAry: nAry,
        negate: negate,
        none: none,
        not: not,
        nth: nth,
        nthArg: nthArg,
        objOf: objOf,
        of: of,
        omit: omit,
        once: once,
        or: or,
        over: over,
        pair: pair,
        partial: partial,
        partialRight: partialRight,
        partition: partition,
        path: path,
        pathEq: pathEq,
        pathOr: pathOr,
        pathSatisfies: pathSatisfies,
        pick: pick,
        pickAll: pickAll,
        pickBy: pickBy,
        pipe: pipe,
        pipeK: pipeK,
        pipeP: pipeP,
        pluck: pluck,
        prepend: prepend,
        product: product,
        project: project,
        prop: prop,
        propEq: propEq,
        propIs: propIs,
        propOr: propOr,
        propSatisfies: propSatisfies,
        props: props,
        range: range,
        reduce: reduce,
        reduceBy: reduceBy,
        reduceRight: reduceRight,
        reduced: reduced,
        reject: reject,
        remove: remove,
        repeat: repeat,
        replace: replace,
        reverse: reverse,
        scan: scan,
        sequence: sequence,
        set: set,
        slice: slice,
        sort: sort,
        sortBy: sortBy,
        split: split,
        splitAt: splitAt,
        splitEvery: splitEvery,
        splitWhen: splitWhen,
        subtract: subtract,
        sum: sum,
        symmetricDifference: symmetricDifference,
        symmetricDifferenceWith: symmetricDifferenceWith,
        tail: tail,
        take: take,
        takeLast: takeLast,
        takeLastWhile: takeLastWhile,
        takeWhile: takeWhile,
        tap: tap,
        test: test,
        times: times,
        toLower: toLower,
        toPairs: toPairs,
        toPairsIn: toPairsIn,
        toString: toString,
        toUpper: toUpper,
        transduce: transduce,
        transpose: transpose,
        traverse: traverse,
        trim: trim,
        tryCatch: tryCatch,
        type: type,
        unapply: unapply,
        unary: unary,
        uncurryN: uncurryN,
        unfold: unfold,
        union: union,
        unionWith: unionWith,
        uniq: uniq,
        uniqBy: uniqBy,
        uniqWith: uniqWith,
        unless: unless,
        unnest: unnest,
        until: until,
        update: update,
        useWith: useWith,
        values: values,
        valuesIn: valuesIn,
        view: view,
        when: when,
        where: where,
        whereEq: whereEq,
        without: without,
        wrap: wrap,
        xprod: xprod,
        zip: zip,
        zipObj: zipObj,
        zipWith: zipWith
    };
  /* eslint-env amd */

  /* TEST_ENTRY_POINT */

  if (typeof exports === 'object') {
    module.exports = R;
  } else if (typeof define === 'function' && define.amd) {
    define(function() { return R; });
  } else {
    this.R = R;
  }

}.call(__commonjs_global));
});

var R = (ramda && typeof ramda === 'object' && 'default' in ramda ? ramda['default'] : ramda);

var q = __commonjs(function (module, exports) {
// vim:ts=4:sts=4:sw=4:
/*!
 *
 * Copyright 2009-2012 Kris Kowal under the terms of the MIT
 * license found at http://github.com/kriskowal/q/raw/master/LICENSE
 *
 * With parts by Tyler Close
 * Copyright 2007-2009 Tyler Close under the terms of the MIT X license found
 * at http://www.opensource.org/licenses/mit-license.html
 * Forked at ref_send.js version: 2009-05-11
 *
 * With parts by Mark Miller
 * Copyright (C) 2011 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

(function (definition) {
    "use strict";

    // This file will function properly as a <script> tag, or a module
    // using CommonJS and NodeJS or RequireJS module formats.  In
    // Common/Node/RequireJS, the module exports the Q API and when
    // executed as a simple <script>, it creates a Q global instead.

    // Montage Require
    if (typeof bootstrap === "function") {
        bootstrap("promise", definition);

    // CommonJS
    } else if (typeof exports === "object" && typeof module === "object") {
        module.exports = definition();

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
        define(definition);

    // SES (Secure EcmaScript)
    } else if (typeof ses !== "undefined") {
        if (!ses.ok()) {
            return;
        } else {
            ses.makeQ = definition;
        }

    // <script>
    } else if (typeof window !== "undefined" || typeof self !== "undefined") {
        // Prefer window over self for add-on scripts. Use self for
        // non-windowed contexts.
        var global = typeof window !== "undefined" ? window : self;

        // Get the `window` object, save the previous Q global
        // and initialize Q as a global.
        var previousQ = global.Q;
        global.Q = definition();

        // Add a noConflict function so Q can be removed from the
        // global namespace.
        global.Q.noConflict = function () {
            global.Q = previousQ;
            return this;
        };

    } else {
        throw new Error("This environment was not anticipated by Q. Please file a bug.");
    }

})(function () {
"use strict";

var hasStacks = false;
try {
    throw new Error();
} catch (e) {
    hasStacks = !!e.stack;
}

// All code after this point will be filtered from stack traces reported
// by Q.
var qStartingLine = captureLine();
var qFileName;

// shims

// used for fallback in "allResolved"
var noop = function () {};

// Use the fastest possible means to execute a task in a future turn
// of the event loop.
var nextTick =(function () {
    // linked list of tasks (single, with head node)
    var head = {task: void 0, next: null};
    var tail = head;
    var flushing = false;
    var requestTick = void 0;
    var isNodeJS = false;
    // queue for late tasks, used by unhandled rejection tracking
    var laterQueue = [];

    function flush() {
        /* jshint loopfunc: true */
        var task, domain;

        while (head.next) {
            head = head.next;
            task = head.task;
            head.task = void 0;
            domain = head.domain;

            if (domain) {
                head.domain = void 0;
                domain.enter();
            }
            runSingle(task, domain);

        }
        while (laterQueue.length) {
            task = laterQueue.pop();
            runSingle(task);
        }
        flushing = false;
    }
    // runs a single function in the async queue
    function runSingle(task, domain) {
        try {
            task();

        } catch (e) {
            if (isNodeJS) {
                // In node, uncaught exceptions are considered fatal errors.
                // Re-throw them synchronously to interrupt flushing!

                // Ensure continuation if the uncaught exception is suppressed
                // listening "uncaughtException" events (as domains does).
                // Continue in next event to avoid tick recursion.
                if (domain) {
                    domain.exit();
                }
                setTimeout(flush, 0);
                if (domain) {
                    domain.enter();
                }

                throw e;

            } else {
                // In browsers, uncaught exceptions are not fatal.
                // Re-throw them asynchronously to avoid slow-downs.
                setTimeout(function () {
                    throw e;
                }, 0);
            }
        }

        if (domain) {
            domain.exit();
        }
    }

    nextTick = function (task) {
        tail = tail.next = {
            task: task,
            domain: isNodeJS && process.domain,
            next: null
        };

        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };

    if (typeof process === "object" &&
        process.toString() === "[object process]" && process.nextTick) {
        // Ensure Q is in a real Node environment, with a `process.nextTick`.
        // To see through fake Node environments:
        // * Mocha test runner - exposes a `process` global without a `nextTick`
        // * Browserify - exposes a `process.nexTick` function that uses
        //   `setTimeout`. In this case `setImmediate` is preferred because
        //    it is faster. Browserify's `process.toString()` yields
        //   "[object Object]", while in a real Node environment
        //   `process.nextTick()` yields "[object process]".
        isNodeJS = true;

        requestTick = function () {
            process.nextTick(flush);
        };

    } else if (typeof setImmediate === "function") {
        // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
        if (typeof window !== "undefined") {
            requestTick = setImmediate.bind(window, flush);
        } else {
            requestTick = function () {
                setImmediate(flush);
            };
        }

    } else if (typeof MessageChannel !== "undefined") {
        // modern browsers
        // http://www.nonblocking.io/2011/06/windownexttick.html
        var channel = new MessageChannel();
        // At least Safari Version 6.0.5 (8536.30.1) intermittently cannot create
        // working message ports the first time a page loads.
        channel.port1.onmessage = function () {
            requestTick = requestPortTick;
            channel.port1.onmessage = flush;
            flush();
        };
        var requestPortTick = function () {
            // Opera requires us to provide a message payload, regardless of
            // whether we use it.
            channel.port2.postMessage(0);
        };
        requestTick = function () {
            setTimeout(flush, 0);
            requestPortTick();
        };

    } else {
        // old browsers
        requestTick = function () {
            setTimeout(flush, 0);
        };
    }
    // runs a task after all other tasks have been run
    // this is useful for unhandled rejection tracking that needs to happen
    // after all `then`d tasks have been run.
    nextTick.runAfter = function (task) {
        laterQueue.push(task);
        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };
    return nextTick;
})();

// Attempt to make generics safe in the face of downstream
// modifications.
// There is no situation where this is necessary.
// If you need a security guarantee, these primordials need to be
// deeply frozen anyway, and if you don’t need a security guarantee,
// this is just plain paranoid.
// However, this **might** have the nice side-effect of reducing the size of
// the minified code by reducing x.call() to merely x()
// See Mark Miller’s explanation of what this does.
// http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
var call = Function.call;
function uncurryThis(f) {
    return function () {
        return call.apply(f, arguments);
    };
}
// This is equivalent, but slower:
// uncurryThis = Function_bind.bind(Function_bind.call);
// http://jsperf.com/uncurrythis

var array_slice = uncurryThis(Array.prototype.slice);

var array_reduce = uncurryThis(
    Array.prototype.reduce || function (callback, basis) {
        var index = 0,
            length = this.length;
        // concerning the initial value, if one is not provided
        if (arguments.length === 1) {
            // seek to the first value in the array, accounting
            // for the possibility that is is a sparse array
            do {
                if (index in this) {
                    basis = this[index++];
                    break;
                }
                if (++index >= length) {
                    throw new TypeError();
                }
            } while (1);
        }
        // reduce
        for (; index < length; index++) {
            // account for the possibility that the array is sparse
            if (index in this) {
                basis = callback(basis, this[index], index);
            }
        }
        return basis;
    }
);

var array_indexOf = uncurryThis(
    Array.prototype.indexOf || function (value) {
        // not a very good shim, but good enough for our one use of it
        for (var i = 0; i < this.length; i++) {
            if (this[i] === value) {
                return i;
            }
        }
        return -1;
    }
);

var array_map = uncurryThis(
    Array.prototype.map || function (callback, thisp) {
        var self = this;
        var collect = [];
        array_reduce(self, function (undefined, value, index) {
            collect.push(callback.call(thisp, value, index, self));
        }, void 0);
        return collect;
    }
);

var object_create = Object.create || function (prototype) {
    function Type() { }
    Type.prototype = prototype;
    return new Type();
};

var object_hasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty);

var object_keys = Object.keys || function (object) {
    var keys = [];
    for (var key in object) {
        if (object_hasOwnProperty(object, key)) {
            keys.push(key);
        }
    }
    return keys;
};

var object_toString = uncurryThis(Object.prototype.toString);

function isObject(value) {
    return value === Object(value);
}

// generator related shims

// FIXME: Remove this function once ES6 generators are in SpiderMonkey.
function isStopIteration(exception) {
    return (
        object_toString(exception) === "[object StopIteration]" ||
        exception instanceof QReturnValue
    );
}

// FIXME: Remove this helper and Q.return once ES6 generators are in
// SpiderMonkey.
var QReturnValue;
if (typeof ReturnValue !== "undefined") {
    QReturnValue = ReturnValue;
} else {
    QReturnValue = function (value) {
        this.value = value;
    };
}

// long stack traces

var STACK_JUMP_SEPARATOR = "From previous event:";

function makeStackTraceLong(error, promise) {
    // If possible, transform the error stack trace by removing Node and Q
    // cruft, then concatenating with the stack trace of `promise`. See #57.
    if (hasStacks &&
        promise.stack &&
        typeof error === "object" &&
        error !== null &&
        error.stack &&
        error.stack.indexOf(STACK_JUMP_SEPARATOR) === -1
    ) {
        var stacks = [];
        for (var p = promise; !!p; p = p.source) {
            if (p.stack) {
                stacks.unshift(p.stack);
            }
        }
        stacks.unshift(error.stack);

        var concatedStacks = stacks.join("\n" + STACK_JUMP_SEPARATOR + "\n");
        error.stack = filterStackString(concatedStacks);
    }
}

function filterStackString(stackString) {
    var lines = stackString.split("\n");
    var desiredLines = [];
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];

        if (!isInternalFrame(line) && !isNodeFrame(line) && line) {
            desiredLines.push(line);
        }
    }
    return desiredLines.join("\n");
}

function isNodeFrame(stackLine) {
    return stackLine.indexOf("(module.js:") !== -1 ||
           stackLine.indexOf("(node.js:") !== -1;
}

function getFileNameAndLineNumber(stackLine) {
    // Named functions: "at functionName (filename:lineNumber:columnNumber)"
    // In IE10 function name can have spaces ("Anonymous function") O_o
    var attempt1 = /at .+ \((.+):(\d+):(?:\d+)\)$/.exec(stackLine);
    if (attempt1) {
        return [attempt1[1], Number(attempt1[2])];
    }

    // Anonymous functions: "at filename:lineNumber:columnNumber"
    var attempt2 = /at ([^ ]+):(\d+):(?:\d+)$/.exec(stackLine);
    if (attempt2) {
        return [attempt2[1], Number(attempt2[2])];
    }

    // Firefox style: "function@filename:lineNumber or @filename:lineNumber"
    var attempt3 = /.*@(.+):(\d+)$/.exec(stackLine);
    if (attempt3) {
        return [attempt3[1], Number(attempt3[2])];
    }
}

function isInternalFrame(stackLine) {
    var fileNameAndLineNumber = getFileNameAndLineNumber(stackLine);

    if (!fileNameAndLineNumber) {
        return false;
    }

    var fileName = fileNameAndLineNumber[0];
    var lineNumber = fileNameAndLineNumber[1];

    return fileName === qFileName &&
        lineNumber >= qStartingLine &&
        lineNumber <= qEndingLine;
}

// discover own file name and line number range for filtering stack
// traces
function captureLine() {
    if (!hasStacks) {
        return;
    }

    try {
        throw new Error();
    } catch (e) {
        var lines = e.stack.split("\n");
        var firstLine = lines[0].indexOf("@") > 0 ? lines[1] : lines[2];
        var fileNameAndLineNumber = getFileNameAndLineNumber(firstLine);
        if (!fileNameAndLineNumber) {
            return;
        }

        qFileName = fileNameAndLineNumber[0];
        return fileNameAndLineNumber[1];
    }
}

function deprecate(callback, name, alternative) {
    return function () {
        if (typeof console !== "undefined" &&
            typeof console.warn === "function") {
            console.warn(name + " is deprecated, use " + alternative +
                         " instead.", new Error("").stack);
        }
        return callback.apply(callback, arguments);
    };
}

// end of shims
// beginning of real work

/**
 * Constructs a promise for an immediate reference, passes promises through, or
 * coerces promises from different systems.
 * @param value immediate reference or promise
 */
function Q(value) {
    // If the object is already a Promise, return it directly.  This enables
    // the resolve function to both be used to created references from objects,
    // but to tolerably coerce non-promises to promises.
    if (value instanceof Promise) {
        return value;
    }

    // assimilate thenables
    if (isPromiseAlike(value)) {
        return coerce(value);
    } else {
        return fulfill(value);
    }
}
Q.resolve = Q;

/**
 * Performs a task in a future turn of the event loop.
 * @param {Function} task
 */
Q.nextTick = nextTick;

/**
 * Controls whether or not long stack traces will be on
 */
Q.longStackSupport = false;

// enable long stacks if Q_DEBUG is set
if (typeof process === "object" && process && process.env && process.env.Q_DEBUG) {
    Q.longStackSupport = true;
}

/**
 * Constructs a {promise, resolve, reject} object.
 *
 * `resolve` is a callback to invoke with a more resolved value for the
 * promise. To fulfill the promise, invoke `resolve` with any value that is
 * not a thenable. To reject the promise, invoke `resolve` with a rejected
 * thenable, or invoke `reject` with the reason directly. To resolve the
 * promise to another thenable, thus putting it in the same state, invoke
 * `resolve` with that other thenable.
 */
Q.defer = defer;
function defer() {
    // if "messages" is an "Array", that indicates that the promise has not yet
    // been resolved.  If it is "undefined", it has been resolved.  Each
    // element of the messages array is itself an array of complete arguments to
    // forward to the resolved promise.  We coerce the resolution value to a
    // promise using the `resolve` function because it handles both fully
    // non-thenable values and other thenables gracefully.
    var messages = [], progressListeners = [], resolvedPromise;

    var deferred = object_create(defer.prototype);
    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, operands) {
        var args = array_slice(arguments);
        if (messages) {
            messages.push(args);
            if (op === "when" && operands[1]) { // progress operand
                progressListeners.push(operands[1]);
            }
        } else {
            Q.nextTick(function () {
                resolvedPromise.promiseDispatch.apply(resolvedPromise, args);
            });
        }
    };

    // XXX deprecated
    promise.valueOf = function () {
        if (messages) {
            return promise;
        }
        var nearerValue = nearer(resolvedPromise);
        if (isPromise(nearerValue)) {
            resolvedPromise = nearerValue; // shorten chain
        }
        return nearerValue;
    };

    promise.inspect = function () {
        if (!resolvedPromise) {
            return { state: "pending" };
        }
        return resolvedPromise.inspect();
    };

    if (Q.longStackSupport && hasStacks) {
        try {
            throw new Error();
        } catch (e) {
            // NOTE: don't try to use `Error.captureStackTrace` or transfer the
            // accessor around; that causes memory leaks as per GH-111. Just
            // reify the stack trace as a string ASAP.
            //
            // At the same time, cut off the first line; it's always just
            // "[object Promise]\n", as per the `toString`.
            promise.stack = e.stack.substring(e.stack.indexOf("\n") + 1);
        }
    }

    // NOTE: we do the checks for `resolvedPromise` in each method, instead of
    // consolidating them into `become`, since otherwise we'd create new
    // promises with the lines `become(whatever(value))`. See e.g. GH-252.

    function become(newPromise) {
        resolvedPromise = newPromise;
        promise.source = newPromise;

        array_reduce(messages, function (undefined, message) {
            Q.nextTick(function () {
                newPromise.promiseDispatch.apply(newPromise, message);
            });
        }, void 0);

        messages = void 0;
        progressListeners = void 0;
    }

    deferred.promise = promise;
    deferred.resolve = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(Q(value));
    };

    deferred.fulfill = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(fulfill(value));
    };
    deferred.reject = function (reason) {
        if (resolvedPromise) {
            return;
        }

        become(reject(reason));
    };
    deferred.notify = function (progress) {
        if (resolvedPromise) {
            return;
        }

        array_reduce(progressListeners, function (undefined, progressListener) {
            Q.nextTick(function () {
                progressListener(progress);
            });
        }, void 0);
    };

    return deferred;
}

/**
 * Creates a Node-style callback that will resolve or reject the deferred
 * promise.
 * @returns a nodeback
 */
defer.prototype.makeNodeResolver = function () {
    var self = this;
    return function (error, value) {
        if (error) {
            self.reject(error);
        } else if (arguments.length > 2) {
            self.resolve(array_slice(arguments, 1));
        } else {
            self.resolve(value);
        }
    };
};

/**
 * @param resolver {Function} a function that returns nothing and accepts
 * the resolve, reject, and notify functions for a deferred.
 * @returns a promise that may be resolved with the given resolve and reject
 * functions, or rejected by a thrown exception in resolver
 */
Q.Promise = promise; // ES6
Q.promise = promise;
function promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("resolver must be a function.");
    }
    var deferred = defer();
    try {
        resolver(deferred.resolve, deferred.reject, deferred.notify);
    } catch (reason) {
        deferred.reject(reason);
    }
    return deferred.promise;
}

promise.race = race; // ES6
promise.all = all; // ES6
promise.reject = reject; // ES6
promise.resolve = Q; // ES6

// XXX experimental.  This method is a way to denote that a local value is
// serializable and should be immediately dispatched to a remote upon request,
// instead of passing a reference.
Q.passByCopy = function (object) {
    //freeze(object);
    //passByCopies.set(object, true);
    return object;
};

Promise.prototype.passByCopy = function () {
    //freeze(object);
    //passByCopies.set(object, true);
    return this;
};

/**
 * If two promises eventually fulfill to the same value, promises that value,
 * but otherwise rejects.
 * @param x {Any*}
 * @param y {Any*}
 * @returns {Any*} a promise for x and y if they are the same, but a rejection
 * otherwise.
 *
 */
Q.join = function (x, y) {
    return Q(x).join(y);
};

Promise.prototype.join = function (that) {
    return Q([this, that]).spread(function (x, y) {
        if (x === y) {
            // TODO: "===" should be Object.is or equiv
            return x;
        } else {
            throw new Error("Can't join: not the same: " + x + " " + y);
        }
    });
};

/**
 * Returns a promise for the first of an array of promises to become settled.
 * @param answers {Array[Any*]} promises to race
 * @returns {Any*} the first promise to be settled
 */
Q.race = race;
function race(answerPs) {
    return promise(function (resolve, reject) {
        // Switch to this once we can assume at least ES5
        // answerPs.forEach(function (answerP) {
        //     Q(answerP).then(resolve, reject);
        // });
        // Use this in the meantime
        for (var i = 0, len = answerPs.length; i < len; i++) {
            Q(answerPs[i]).then(resolve, reject);
        }
    });
}

Promise.prototype.race = function () {
    return this.then(Q.race);
};

/**
 * Constructs a Promise with a promise descriptor object and optional fallback
 * function.  The descriptor contains methods like when(rejected), get(name),
 * set(name, value), post(name, args), and delete(name), which all
 * return either a value, a promise for a value, or a rejection.  The fallback
 * accepts the operation name, a resolver, and any further arguments that would
 * have been forwarded to the appropriate method above had a method been
 * provided with the proper name.  The API makes no guarantees about the nature
 * of the returned object, apart from that it is usable whereever promises are
 * bought and sold.
 */
Q.makePromise = Promise;
function Promise(descriptor, fallback, inspect) {
    if (fallback === void 0) {
        fallback = function (op) {
            return reject(new Error(
                "Promise does not support operation: " + op
            ));
        };
    }
    if (inspect === void 0) {
        inspect = function () {
            return {state: "unknown"};
        };
    }

    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, args) {
        var result;
        try {
            if (descriptor[op]) {
                result = descriptor[op].apply(promise, args);
            } else {
                result = fallback.call(promise, op, args);
            }
        } catch (exception) {
            result = reject(exception);
        }
        if (resolve) {
            resolve(result);
        }
    };

    promise.inspect = inspect;

    // XXX deprecated `valueOf` and `exception` support
    if (inspect) {
        var inspected = inspect();
        if (inspected.state === "rejected") {
            promise.exception = inspected.reason;
        }

        promise.valueOf = function () {
            var inspected = inspect();
            if (inspected.state === "pending" ||
                inspected.state === "rejected") {
                return promise;
            }
            return inspected.value;
        };
    }

    return promise;
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.then = function (fulfilled, rejected, progressed) {
    var self = this;
    var deferred = defer();
    var done = false;   // ensure the untrusted promise makes at most a
                        // single call to one of the callbacks

    function _fulfilled(value) {
        try {
            return typeof fulfilled === "function" ? fulfilled(value) : value;
        } catch (exception) {
            return reject(exception);
        }
    }

    function _rejected(exception) {
        if (typeof rejected === "function") {
            makeStackTraceLong(exception, self);
            try {
                return rejected(exception);
            } catch (newException) {
                return reject(newException);
            }
        }
        return reject(exception);
    }

    function _progressed(value) {
        return typeof progressed === "function" ? progressed(value) : value;
    }

    Q.nextTick(function () {
        self.promiseDispatch(function (value) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_fulfilled(value));
        }, "when", [function (exception) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_rejected(exception));
        }]);
    });

    // Progress propagator need to be attached in the current tick.
    self.promiseDispatch(void 0, "when", [void 0, function (value) {
        var newValue;
        var threw = false;
        try {
            newValue = _progressed(value);
        } catch (e) {
            threw = true;
            if (Q.onerror) {
                Q.onerror(e);
            } else {
                throw e;
            }
        }

        if (!threw) {
            deferred.notify(newValue);
        }
    }]);

    return deferred.promise;
};

Q.tap = function (promise, callback) {
    return Q(promise).tap(callback);
};

/**
 * Works almost like "finally", but not called for rejections.
 * Original resolution value is passed through callback unaffected.
 * Callback may return a promise that will be awaited for.
 * @param {Function} callback
 * @returns {Q.Promise}
 * @example
 * doSomething()
 *   .then(...)
 *   .tap(console.log)
 *   .then(...);
 */
Promise.prototype.tap = function (callback) {
    callback = Q(callback);

    return this.then(function (value) {
        return callback.fcall(value).thenResolve(value);
    });
};

/**
 * Registers an observer on a promise.
 *
 * Guarantees:
 *
 * 1. that fulfilled and rejected will be called only once.
 * 2. that either the fulfilled callback or the rejected callback will be
 *    called, but not both.
 * 3. that fulfilled and rejected will not be called in this turn.
 *
 * @param value      promise or immediate reference to observe
 * @param fulfilled  function to be called with the fulfilled value
 * @param rejected   function to be called with the rejection exception
 * @param progressed function to be called on any progress notifications
 * @return promise for the return value from the invoked callback
 */
Q.when = when;
function when(value, fulfilled, rejected, progressed) {
    return Q(value).then(fulfilled, rejected, progressed);
}

Promise.prototype.thenResolve = function (value) {
    return this.then(function () { return value; });
};

Q.thenResolve = function (promise, value) {
    return Q(promise).thenResolve(value);
};

Promise.prototype.thenReject = function (reason) {
    return this.then(function () { throw reason; });
};

Q.thenReject = function (promise, reason) {
    return Q(promise).thenReject(reason);
};

/**
 * If an object is not a promise, it is as "near" as possible.
 * If a promise is rejected, it is as "near" as possible too.
 * If it’s a fulfilled promise, the fulfillment value is nearer.
 * If it’s a deferred promise and the deferred has been resolved, the
 * resolution is "nearer".
 * @param object
 * @returns most resolved (nearest) form of the object
 */

// XXX should we re-do this?
Q.nearer = nearer;
function nearer(value) {
    if (isPromise(value)) {
        var inspected = value.inspect();
        if (inspected.state === "fulfilled") {
            return inspected.value;
        }
    }
    return value;
}

/**
 * @returns whether the given object is a promise.
 * Otherwise it is a fulfilled value.
 */
Q.isPromise = isPromise;
function isPromise(object) {
    return object instanceof Promise;
}

Q.isPromiseAlike = isPromiseAlike;
function isPromiseAlike(object) {
    return isObject(object) && typeof object.then === "function";
}

/**
 * @returns whether the given object is a pending promise, meaning not
 * fulfilled or rejected.
 */
Q.isPending = isPending;
function isPending(object) {
    return isPromise(object) && object.inspect().state === "pending";
}

Promise.prototype.isPending = function () {
    return this.inspect().state === "pending";
};

/**
 * @returns whether the given object is a value or fulfilled
 * promise.
 */
Q.isFulfilled = isFulfilled;
function isFulfilled(object) {
    return !isPromise(object) || object.inspect().state === "fulfilled";
}

Promise.prototype.isFulfilled = function () {
    return this.inspect().state === "fulfilled";
};

/**
 * @returns whether the given object is a rejected promise.
 */
Q.isRejected = isRejected;
function isRejected(object) {
    return isPromise(object) && object.inspect().state === "rejected";
}

Promise.prototype.isRejected = function () {
    return this.inspect().state === "rejected";
};

//// BEGIN UNHANDLED REJECTION TRACKING

// This promise library consumes exceptions thrown in handlers so they can be
// handled by a subsequent promise.  The exceptions get added to this array when
// they are created, and removed when they are handled.  Note that in ES6 or
// shimmed environments, this would naturally be a `Set`.
var unhandledReasons = [];
var unhandledRejections = [];
var reportedUnhandledRejections = [];
var trackUnhandledRejections = true;

function resetUnhandledRejections() {
    unhandledReasons.length = 0;
    unhandledRejections.length = 0;

    if (!trackUnhandledRejections) {
        trackUnhandledRejections = true;
    }
}

function trackRejection(promise, reason) {
    if (!trackUnhandledRejections) {
        return;
    }
    if (typeof process === "object" && typeof process.emit === "function") {
        Q.nextTick.runAfter(function () {
            if (array_indexOf(unhandledRejections, promise) !== -1) {
                process.emit("unhandledRejection", reason, promise);
                reportedUnhandledRejections.push(promise);
            }
        });
    }

    unhandledRejections.push(promise);
    if (reason && typeof reason.stack !== "undefined") {
        unhandledReasons.push(reason.stack);
    } else {
        unhandledReasons.push("(no stack) " + reason);
    }
}

function untrackRejection(promise) {
    if (!trackUnhandledRejections) {
        return;
    }

    var at = array_indexOf(unhandledRejections, promise);
    if (at !== -1) {
        if (typeof process === "object" && typeof process.emit === "function") {
            Q.nextTick.runAfter(function () {
                var atReport = array_indexOf(reportedUnhandledRejections, promise);
                if (atReport !== -1) {
                    process.emit("rejectionHandled", unhandledReasons[at], promise);
                    reportedUnhandledRejections.splice(atReport, 1);
                }
            });
        }
        unhandledRejections.splice(at, 1);
        unhandledReasons.splice(at, 1);
    }
}

Q.resetUnhandledRejections = resetUnhandledRejections;

Q.getUnhandledReasons = function () {
    // Make a copy so that consumers can't interfere with our internal state.
    return unhandledReasons.slice();
};

Q.stopUnhandledRejectionTracking = function () {
    resetUnhandledRejections();
    trackUnhandledRejections = false;
};

resetUnhandledRejections();

//// END UNHANDLED REJECTION TRACKING

/**
 * Constructs a rejected promise.
 * @param reason value describing the failure
 */
Q.reject = reject;
function reject(reason) {
    var rejection = Promise({
        "when": function (rejected) {
            // note that the error has been handled
            if (rejected) {
                untrackRejection(this);
            }
            return rejected ? rejected(reason) : this;
        }
    }, function fallback() {
        return this;
    }, function inspect() {
        return { state: "rejected", reason: reason };
    });

    // Note that the reason has not been handled.
    trackRejection(rejection, reason);

    return rejection;
}

/**
 * Constructs a fulfilled promise for an immediate reference.
 * @param value immediate reference
 */
Q.fulfill = fulfill;
function fulfill(value) {
    return Promise({
        "when": function () {
            return value;
        },
        "get": function (name) {
            return value[name];
        },
        "set": function (name, rhs) {
            value[name] = rhs;
        },
        "delete": function (name) {
            delete value[name];
        },
        "post": function (name, args) {
            // Mark Miller proposes that post with no name should apply a
            // promised function.
            if (name === null || name === void 0) {
                return value.apply(void 0, args);
            } else {
                return value[name].apply(value, args);
            }
        },
        "apply": function (thisp, args) {
            return value.apply(thisp, args);
        },
        "keys": function () {
            return object_keys(value);
        }
    }, void 0, function inspect() {
        return { state: "fulfilled", value: value };
    });
}

/**
 * Converts thenables to Q promises.
 * @param promise thenable promise
 * @returns a Q promise
 */
function coerce(promise) {
    var deferred = defer();
    Q.nextTick(function () {
        try {
            promise.then(deferred.resolve, deferred.reject, deferred.notify);
        } catch (exception) {
            deferred.reject(exception);
        }
    });
    return deferred.promise;
}

/**
 * Annotates an object such that it will never be
 * transferred away from this process over any promise
 * communication channel.
 * @param object
 * @returns promise a wrapping of that object that
 * additionally responds to the "isDef" message
 * without a rejection.
 */
Q.master = master;
function master(object) {
    return Promise({
        "isDef": function () {}
    }, function fallback(op, args) {
        return dispatch(object, op, args);
    }, function () {
        return Q(object).inspect();
    });
}

/**
 * Spreads the values of a promised array of arguments into the
 * fulfillment callback.
 * @param fulfilled callback that receives variadic arguments from the
 * promised array
 * @param rejected callback that receives the exception if the promise
 * is rejected.
 * @returns a promise for the return value or thrown exception of
 * either callback.
 */
Q.spread = spread;
function spread(value, fulfilled, rejected) {
    return Q(value).spread(fulfilled, rejected);
}

Promise.prototype.spread = function (fulfilled, rejected) {
    return this.all().then(function (array) {
        return fulfilled.apply(void 0, array);
    }, rejected);
};

/**
 * The async function is a decorator for generator functions, turning
 * them into asynchronous generators.  Although generators are only part
 * of the newest ECMAScript 6 drafts, this code does not cause syntax
 * errors in older engines.  This code should continue to work and will
 * in fact improve over time as the language improves.
 *
 * ES6 generators are currently part of V8 version 3.19 with the
 * --harmony-generators runtime flag enabled.  SpiderMonkey has had them
 * for longer, but under an older Python-inspired form.  This function
 * works on both kinds of generators.
 *
 * Decorates a generator function such that:
 *  - it may yield promises
 *  - execution will continue when that promise is fulfilled
 *  - the value of the yield expression will be the fulfilled value
 *  - it returns a promise for the return value (when the generator
 *    stops iterating)
 *  - the decorated function returns a promise for the return value
 *    of the generator or the first rejected promise among those
 *    yielded.
 *  - if an error is thrown in the generator, it propagates through
 *    every following yield until it is caught, or until it escapes
 *    the generator function altogether, and is translated into a
 *    rejection for the promise returned by the decorated generator.
 */
Q.async = async;
function async(makeGenerator) {
    return function () {
        // when verb is "send", arg is a value
        // when verb is "throw", arg is an exception
        function continuer(verb, arg) {
            var result;

            // Until V8 3.19 / Chromium 29 is released, SpiderMonkey is the only
            // engine that has a deployed base of browsers that support generators.
            // However, SM's generators use the Python-inspired semantics of
            // outdated ES6 drafts.  We would like to support ES6, but we'd also
            // like to make it possible to use generators in deployed browsers, so
            // we also support Python-style generators.  At some point we can remove
            // this block.

            if (typeof StopIteration === "undefined") {
                // ES6 Generators
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    return reject(exception);
                }
                if (result.done) {
                    return Q(result.value);
                } else {
                    return when(result.value, callback, errback);
                }
            } else {
                // SpiderMonkey Generators
                // FIXME: Remove this case when SM does ES6 generators.
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    if (isStopIteration(exception)) {
                        return Q(exception.value);
                    } else {
                        return reject(exception);
                    }
                }
                return when(result, callback, errback);
            }
        }
        var generator = makeGenerator.apply(this, arguments);
        var callback = continuer.bind(continuer, "next");
        var errback = continuer.bind(continuer, "throw");
        return callback();
    };
}

/**
 * The spawn function is a small wrapper around async that immediately
 * calls the generator and also ends the promise chain, so that any
 * unhandled errors are thrown instead of forwarded to the error
 * handler. This is useful because it's extremely common to run
 * generators at the top-level to work with libraries.
 */
Q.spawn = spawn;
function spawn(makeGenerator) {
    Q.done(Q.async(makeGenerator)());
}

// FIXME: Remove this interface once ES6 generators are in SpiderMonkey.
/**
 * Throws a ReturnValue exception to stop an asynchronous generator.
 *
 * This interface is a stop-gap measure to support generator return
 * values in older Firefox/SpiderMonkey.  In browsers that support ES6
 * generators like Chromium 29, just use "return" in your generator
 * functions.
 *
 * @param value the return value for the surrounding generator
 * @throws ReturnValue exception with the value.
 * @example
 * // ES6 style
 * Q.async(function* () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      return foo + bar;
 * })
 * // Older SpiderMonkey style
 * Q.async(function () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      Q.return(foo + bar);
 * })
 */
Q["return"] = _return;
function _return(value) {
    throw new QReturnValue(value);
}

/**
 * The promised function decorator ensures that any promise arguments
 * are settled and passed as values (`this` is also settled and passed
 * as a value).  It will also ensure that the result of a function is
 * always a promise.
 *
 * @example
 * var add = Q.promised(function (a, b) {
 *     return a + b;
 * });
 * add(Q(a), Q(B));
 *
 * @param {function} callback The function to decorate
 * @returns {function} a function that has been decorated.
 */
Q.promised = promised;
function promised(callback) {
    return function () {
        return spread([this, all(arguments)], function (self, args) {
            return callback.apply(self, args);
        });
    };
}

/**
 * sends a message to a value in a future turn
 * @param object* the recipient
 * @param op the name of the message operation, e.g., "when",
 * @param args further arguments to be forwarded to the operation
 * @returns result {Promise} a promise for the result of the operation
 */
Q.dispatch = dispatch;
function dispatch(object, op, args) {
    return Q(object).dispatch(op, args);
}

Promise.prototype.dispatch = function (op, args) {
    var self = this;
    var deferred = defer();
    Q.nextTick(function () {
        self.promiseDispatch(deferred.resolve, op, args);
    });
    return deferred.promise;
};

/**
 * Gets the value of a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to get
 * @return promise for the property value
 */
Q.get = function (object, key) {
    return Q(object).dispatch("get", [key]);
};

Promise.prototype.get = function (key) {
    return this.dispatch("get", [key]);
};

/**
 * Sets the value of a property in a future turn.
 * @param object    promise or immediate reference for object object
 * @param name      name of property to set
 * @param value     new value of property
 * @return promise for the return value
 */
Q.set = function (object, key, value) {
    return Q(object).dispatch("set", [key, value]);
};

Promise.prototype.set = function (key, value) {
    return this.dispatch("set", [key, value]);
};

/**
 * Deletes a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to delete
 * @return promise for the return value
 */
Q.del = // XXX legacy
Q["delete"] = function (object, key) {
    return Q(object).dispatch("delete", [key]);
};

Promise.prototype.del = // XXX legacy
Promise.prototype["delete"] = function (key) {
    return this.dispatch("delete", [key]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param value     a value to post, typically an array of
 *                  invocation arguments for promises that
 *                  are ultimately backed with `resolve` values,
 *                  as opposed to those backed with URLs
 *                  wherein the posted value can be any
 *                  JSON serializable object.
 * @return promise for the return value
 */
// bound locally because it is used by other methods
Q.mapply = // XXX As proposed by "Redsandro"
Q.post = function (object, name, args) {
    return Q(object).dispatch("post", [name, args]);
};

Promise.prototype.mapply = // XXX As proposed by "Redsandro"
Promise.prototype.post = function (name, args) {
    return this.dispatch("post", [name, args]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param ...args   array of invocation arguments
 * @return promise for the return value
 */
Q.send = // XXX Mark Miller's proposed parlance
Q.mcall = // XXX As proposed by "Redsandro"
Q.invoke = function (object, name /*...args*/) {
    return Q(object).dispatch("post", [name, array_slice(arguments, 2)]);
};

Promise.prototype.send = // XXX Mark Miller's proposed parlance
Promise.prototype.mcall = // XXX As proposed by "Redsandro"
Promise.prototype.invoke = function (name /*...args*/) {
    return this.dispatch("post", [name, array_slice(arguments, 1)]);
};

/**
 * Applies the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param args      array of application arguments
 */
Q.fapply = function (object, args) {
    return Q(object).dispatch("apply", [void 0, args]);
};

Promise.prototype.fapply = function (args) {
    return this.dispatch("apply", [void 0, args]);
};

/**
 * Calls the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q["try"] =
Q.fcall = function (object /* ...args*/) {
    return Q(object).dispatch("apply", [void 0, array_slice(arguments, 1)]);
};

Promise.prototype.fcall = function (/*...args*/) {
    return this.dispatch("apply", [void 0, array_slice(arguments)]);
};

/**
 * Binds the promised function, transforming return values into a fulfilled
 * promise and thrown errors into a rejected one.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q.fbind = function (object /*...args*/) {
    var promise = Q(object);
    var args = array_slice(arguments, 1);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};
Promise.prototype.fbind = function (/*...args*/) {
    var promise = this;
    var args = array_slice(arguments);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};

/**
 * Requests the names of the owned properties of a promised
 * object in a future turn.
 * @param object    promise or immediate reference for target object
 * @return promise for the keys of the eventually settled object
 */
Q.keys = function (object) {
    return Q(object).dispatch("keys", []);
};

Promise.prototype.keys = function () {
    return this.dispatch("keys", []);
};

/**
 * Turns an array of promises into a promise for an array.  If any of
 * the promises gets rejected, the whole array is rejected immediately.
 * @param {Array*} an array (or promise for an array) of values (or
 * promises for values)
 * @returns a promise for an array of the corresponding values
 */
// By Mark Miller
// http://wiki.ecmascript.org/doku.php?id=strawman:concurrency&rev=1308776521#allfulfilled
Q.all = all;
function all(promises) {
    return when(promises, function (promises) {
        var pendingCount = 0;
        var deferred = defer();
        array_reduce(promises, function (undefined, promise, index) {
            var snapshot;
            if (
                isPromise(promise) &&
                (snapshot = promise.inspect()).state === "fulfilled"
            ) {
                promises[index] = snapshot.value;
            } else {
                ++pendingCount;
                when(
                    promise,
                    function (value) {
                        promises[index] = value;
                        if (--pendingCount === 0) {
                            deferred.resolve(promises);
                        }
                    },
                    deferred.reject,
                    function (progress) {
                        deferred.notify({ index: index, value: progress });
                    }
                );
            }
        }, void 0);
        if (pendingCount === 0) {
            deferred.resolve(promises);
        }
        return deferred.promise;
    });
}

Promise.prototype.all = function () {
    return all(this);
};

/**
 * Returns the first resolved promise of an array. Prior rejected promises are
 * ignored.  Rejects only if all promises are rejected.
 * @param {Array*} an array containing values or promises for values
 * @returns a promise fulfilled with the value of the first resolved promise,
 * or a rejected promise if all promises are rejected.
 */
Q.any = any;

function any(promises) {
    if (promises.length === 0) {
        return Q.resolve();
    }

    var deferred = Q.defer();
    var pendingCount = 0;
    array_reduce(promises, function (prev, current, index) {
        var promise = promises[index];

        pendingCount++;

        when(promise, onFulfilled, onRejected, onProgress);
        function onFulfilled(result) {
            deferred.resolve(result);
        }
        function onRejected() {
            pendingCount--;
            if (pendingCount === 0) {
                deferred.reject(new Error(
                    "Can't get fulfillment value from any promise, all " +
                    "promises were rejected."
                ));
            }
        }
        function onProgress(progress) {
            deferred.notify({
                index: index,
                value: progress
            });
        }
    }, undefined);

    return deferred.promise;
}

Promise.prototype.any = function () {
    return any(this);
};

/**
 * Waits for all promises to be settled, either fulfilled or
 * rejected.  This is distinct from `all` since that would stop
 * waiting at the first rejection.  The promise returned by
 * `allResolved` will never be rejected.
 * @param promises a promise for an array (or an array) of promises
 * (or values)
 * @return a promise for an array of promises
 */
Q.allResolved = deprecate(allResolved, "allResolved", "allSettled");
function allResolved(promises) {
    return when(promises, function (promises) {
        promises = array_map(promises, Q);
        return when(all(array_map(promises, function (promise) {
            return when(promise, noop, noop);
        })), function () {
            return promises;
        });
    });
}

Promise.prototype.allResolved = function () {
    return allResolved(this);
};

/**
 * @see Promise#allSettled
 */
Q.allSettled = allSettled;
function allSettled(promises) {
    return Q(promises).allSettled();
}

/**
 * Turns an array of promises into a promise for an array of their states (as
 * returned by `inspect`) when they have all settled.
 * @param {Array[Any*]} values an array (or promise for an array) of values (or
 * promises for values)
 * @returns {Array[State]} an array of states for the respective values.
 */
Promise.prototype.allSettled = function () {
    return this.then(function (promises) {
        return all(array_map(promises, function (promise) {
            promise = Q(promise);
            function regardless() {
                return promise.inspect();
            }
            return promise.then(regardless, regardless);
        }));
    });
};

/**
 * Captures the failure of a promise, giving an oportunity to recover
 * with a callback.  If the given promise is fulfilled, the returned
 * promise is fulfilled.
 * @param {Any*} promise for something
 * @param {Function} callback to fulfill the returned promise if the
 * given promise is rejected
 * @returns a promise for the return value of the callback
 */
Q.fail = // XXX legacy
Q["catch"] = function (object, rejected) {
    return Q(object).then(void 0, rejected);
};

Promise.prototype.fail = // XXX legacy
Promise.prototype["catch"] = function (rejected) {
    return this.then(void 0, rejected);
};

/**
 * Attaches a listener that can respond to progress notifications from a
 * promise's originating deferred. This listener receives the exact arguments
 * passed to ``deferred.notify``.
 * @param {Any*} promise for something
 * @param {Function} callback to receive any progress notifications
 * @returns the given promise, unchanged
 */
Q.progress = progress;
function progress(object, progressed) {
    return Q(object).then(void 0, void 0, progressed);
}

Promise.prototype.progress = function (progressed) {
    return this.then(void 0, void 0, progressed);
};

/**
 * Provides an opportunity to observe the settling of a promise,
 * regardless of whether the promise is fulfilled or rejected.  Forwards
 * the resolution to the returned promise when the callback is done.
 * The callback can return a promise to defer completion.
 * @param {Any*} promise
 * @param {Function} callback to observe the resolution of the given
 * promise, takes no arguments.
 * @returns a promise for the resolution of the given promise when
 * ``fin`` is done.
 */
Q.fin = // XXX legacy
Q["finally"] = function (object, callback) {
    return Q(object)["finally"](callback);
};

Promise.prototype.fin = // XXX legacy
Promise.prototype["finally"] = function (callback) {
    callback = Q(callback);
    return this.then(function (value) {
        return callback.fcall().then(function () {
            return value;
        });
    }, function (reason) {
        // TODO attempt to recycle the rejection with "this".
        return callback.fcall().then(function () {
            throw reason;
        });
    });
};

/**
 * Terminates a chain of promises, forcing rejections to be
 * thrown as exceptions.
 * @param {Any*} promise at the end of a chain of promises
 * @returns nothing
 */
Q.done = function (object, fulfilled, rejected, progress) {
    return Q(object).done(fulfilled, rejected, progress);
};

Promise.prototype.done = function (fulfilled, rejected, progress) {
    var onUnhandledError = function (error) {
        // forward to a future turn so that ``when``
        // does not catch it and turn it into a rejection.
        Q.nextTick(function () {
            makeStackTraceLong(error, promise);
            if (Q.onerror) {
                Q.onerror(error);
            } else {
                throw error;
            }
        });
    };

    // Avoid unnecessary `nextTick`ing via an unnecessary `when`.
    var promise = fulfilled || rejected || progress ?
        this.then(fulfilled, rejected, progress) :
        this;

    if (typeof process === "object" && process && process.domain) {
        onUnhandledError = process.domain.bind(onUnhandledError);
    }

    promise.then(void 0, onUnhandledError);
};

/**
 * Causes a promise to be rejected if it does not get fulfilled before
 * some milliseconds time out.
 * @param {Any*} promise
 * @param {Number} milliseconds timeout
 * @param {Any*} custom error message or Error object (optional)
 * @returns a promise for the resolution of the given promise if it is
 * fulfilled before the timeout, otherwise rejected.
 */
Q.timeout = function (object, ms, error) {
    return Q(object).timeout(ms, error);
};

Promise.prototype.timeout = function (ms, error) {
    var deferred = defer();
    var timeoutId = setTimeout(function () {
        if (!error || "string" === typeof error) {
            error = new Error(error || "Timed out after " + ms + " ms");
            error.code = "ETIMEDOUT";
        }
        deferred.reject(error);
    }, ms);

    this.then(function (value) {
        clearTimeout(timeoutId);
        deferred.resolve(value);
    }, function (exception) {
        clearTimeout(timeoutId);
        deferred.reject(exception);
    }, deferred.notify);

    return deferred.promise;
};

/**
 * Returns a promise for the given value (or promised value), some
 * milliseconds after it resolved. Passes rejections immediately.
 * @param {Any*} promise
 * @param {Number} milliseconds
 * @returns a promise for the resolution of the given promise after milliseconds
 * time has elapsed since the resolution of the given promise.
 * If the given promise rejects, that is passed immediately.
 */
Q.delay = function (object, timeout) {
    if (timeout === void 0) {
        timeout = object;
        object = void 0;
    }
    return Q(object).delay(timeout);
};

Promise.prototype.delay = function (timeout) {
    return this.then(function (value) {
        var deferred = defer();
        setTimeout(function () {
            deferred.resolve(value);
        }, timeout);
        return deferred.promise;
    });
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided as an array, and returns a promise.
 *
 *      Q.nfapply(FS.readFile, [__filename])
 *      .then(function (content) {
 *      })
 *
 */
Q.nfapply = function (callback, args) {
    return Q(callback).nfapply(args);
};

Promise.prototype.nfapply = function (args) {
    var deferred = defer();
    var nodeArgs = array_slice(args);
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided individually, and returns a promise.
 * @example
 * Q.nfcall(FS.readFile, __filename)
 * .then(function (content) {
 * })
 *
 */
Q.nfcall = function (callback /*...args*/) {
    var args = array_slice(arguments, 1);
    return Q(callback).nfapply(args);
};

Promise.prototype.nfcall = function (/*...args*/) {
    var nodeArgs = array_slice(arguments);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Wraps a NodeJS continuation passing function and returns an equivalent
 * version that returns a promise.
 * @example
 * Q.nfbind(FS.readFile, __filename)("utf-8")
 * .then(console.log)
 * .done()
 */
Q.nfbind =
Q.denodeify = function (callback /*...args*/) {
    var baseArgs = array_slice(arguments, 1);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        Q(callback).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nfbind =
Promise.prototype.denodeify = function (/*...args*/) {
    var args = array_slice(arguments);
    args.unshift(this);
    return Q.denodeify.apply(void 0, args);
};

Q.nbind = function (callback, thisp /*...args*/) {
    var baseArgs = array_slice(arguments, 2);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        function bound() {
            return callback.apply(thisp, arguments);
        }
        Q(bound).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nbind = function (/*thisp, ...args*/) {
    var args = array_slice(arguments, 0);
    args.unshift(this);
    return Q.nbind.apply(void 0, args);
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback with a given array of arguments, plus a provided callback.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param {Array} args arguments to pass to the method; the callback
 * will be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nmapply = // XXX As proposed by "Redsandro"
Q.npost = function (object, name, args) {
    return Q(object).npost(name, args);
};

Promise.prototype.nmapply = // XXX As proposed by "Redsandro"
Promise.prototype.npost = function (name, args) {
    var nodeArgs = array_slice(args || []);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback, forwarding the given variadic arguments, plus a provided
 * callback argument.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param ...args arguments to pass to the method; the callback will
 * be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nsend = // XXX Based on Mark Miller's proposed "send"
Q.nmcall = // XXX Based on "Redsandro's" proposal
Q.ninvoke = function (object, name /*...args*/) {
    var nodeArgs = array_slice(arguments, 2);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    Q(object).dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

Promise.prototype.nsend = // XXX Based on Mark Miller's proposed "send"
Promise.prototype.nmcall = // XXX Based on "Redsandro's" proposal
Promise.prototype.ninvoke = function (name /*...args*/) {
    var nodeArgs = array_slice(arguments, 1);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * If a function would like to support both Node continuation-passing-style and
 * promise-returning-style, it can end its internal promise chain with
 * `nodeify(nodeback)`, forwarding the optional nodeback argument.  If the user
 * elects to use a nodeback, the result will be sent there.  If they do not
 * pass a nodeback, they will receive the result promise.
 * @param object a result (or a promise for a result)
 * @param {Function} nodeback a Node.js-style callback
 * @returns either the promise or nothing
 */
Q.nodeify = nodeify;
function nodeify(object, nodeback) {
    return Q(object).nodeify(nodeback);
}

Promise.prototype.nodeify = function (nodeback) {
    if (nodeback) {
        this.then(function (value) {
            Q.nextTick(function () {
                nodeback(null, value);
            });
        }, function (error) {
            Q.nextTick(function () {
                nodeback(error);
            });
        });
    } else {
        return this;
    }
};

Q.noConflict = function() {
    throw new Error("Q.noConflict only works when Q is used as a global");
};

// All code before this point will be filtered from stack traces.
var qEndingLine = captureLine();

return Q;

});
});

var require$$0$2 = (q && typeof q === 'object' && 'default' in q ? q['default'] : q);

var pingPromise = __commonjs(function (module, exports) {
/**
* LICENSE MIT
* (C) Daniel Zelisko
* http://github.com/danielzzz/node-ping
*
* a simple wrapper for ping
* Now with support of not only english Windows.
*
*/

//system library
var sys = require$$3,
    cp = require$$2,
    os = require$$1;

//3rd-party library
var Q = require$$0$2;

/**
 * Class::PromisePing
 *
 * @param addr string
 * @param config dict
 * {
 *      options: [...]
 * }
 *
 * @return Class::Q promise
 */
function probe(addr, config) {
    var p = os.platform();
    var ls = null;
    var outstring = "";
    var deferred = Q.defer();
    var default_cfg = {
        "numeric": true,
        "timeout": 2,
        "min_reply": 1,
        "extra": []
    };
    var args = [];
    config = config ? config : default_cfg;

    if (p === 'linux') {
        //linux
        args = [];
        if (config.numeric !== false) {
            args.push("-n");
        }
        if (config.timeout !== false) {
            args.push(sys.format("-w %d",
                        config.timeout ?
                        config.timeout : default_cfg.timeout));
        }
        if (config.min_reply !== false) {
            args.push(sys.format("-c %d",
                        config.min_reply ?
                        config.min_reply : default_cfg.min_reply));
        }
        if (config.extra !== false) {
            args = args.concat(config.extra ?
                    config.extra : default_cfg.extra);
        }
        args.push(addr);
        ls = cp.spawn('/bin/ping', args);
    } else if (p.match(/^win/)) {
        //windows
        args = ['-n', '1', '-w', '5000'];
        //TODO: No idea for how to write ping commands in Window
        if (config.extra !== false) {
            args = args.concat(config.extra ?
                    config.extra : default_cfg.extra);
        }
        args.push(addr);
        ls = cp.spawn('C:/windows/system32/ping.exe', args);
    } else if (p === 'darwin') {
        //mac osx
        args = [];
        //TODO: No idea for how to write ping commands in MAC osx
        if (config.extra !== false) {
            args = args.concat(config.extra ?
                    config.extra : default_cfg.extra);
        }
        args.push(addr);
        ls = cp.spawn('/sbin/ping', args);
    }

    ls.on('error', function (e) {
        var err = new Error(
            "ping.probe: there was an error while executing the ping program. check the path or permissions...");
        deferred.reject(err);
    });


    ls.stdout.on('data', function (data) {
        outstring += String(data);
    });

    /*
    ls.stderr.on('data', function (data) {
      //sys.print('stderr: ' + data);
    });
    **/

    ls.on('exit', function (code) {
        var result;
        // workaround for windows machines
        // if host is unreachable ping will return
        // a successfull error code
        // so we need to handle this ourself
        if (p.match(/^win/)) {
            var lines = outstring.split('\n');
            // this is my solution on Chinese Windows8 64bit
            result  = false;
            for (var t = 0; t < lines.length; t++) {
                if (lines[t].search(/TTL=[0-9]+/i) > 0) {
                    result	= true;
                    break;
                }
            }
            // below is not working on My Chinese Windows8 64bit
            /*
            for (var t = 0; t < lines.length; t++) {
                if (lines[t].match (/[0-9]:/)) {
                    result = (lines[t].indexOf ("=") != -1);
                    break;
                }
            }
            */
        }
        else {
            result = (code === 0) ? true : false;
        }
        deferred.resolve({
            host: addr,
            alive: result,
            output: outstring
        });
    });
    return deferred.promise;
}

exports.probe = probe;
});

var require$$0$1 = (pingPromise && typeof pingPromise === 'object' && 'default' in pingPromise ? pingPromise['default'] : pingPromise);

var pingSys = __commonjs(function (module, exports) {
/**
* LICENSE MIT
* (C) Daniel Zelisko
* http://github.com/danielzzz/node-ping
*
* a simple wrapper for ping
* Now with support of not only english Windows.
*
*/

//system library
var sys = require$$3,
    cp = require$$2,
    os = require$$1;

/**
 * Class::Ping construtor
 *
 * @param addr string
 * @param cb function (data, err)
 *      arguments order is based on compatabile issue
 */
function probe(addr, cb) {
        var p = os.platform();
        var ls = null;
        var outstring = "";

        if (p === 'linux') {
            //linux
            ls = cp.spawn('/bin/ping', ['-n', '-w 2', '-c 1', addr]);
        } else if (p.match(/^win/)) {
            //windows
            ls = cp.spawn('C:/windows/system32/ping.exe', ['-n', '1', '-w', '5000', addr]);
        } else if (p === 'darwin') {
            //mac osx
            ls = cp.spawn('/sbin/ping', ['-n', '-t 2', '-c 1', addr]);
        }

        ls.on('error', function (e) {
            var err = new Error('ping.probe: there was an error while executing the ping program. check the path or permissions...');
            cb(null, err);
        });


        ls.stdout.on('data', function (data) {
            outstring += String(data);
        });

        ls.stderr.on('data', function (data) {
          //sys.print('stderr: ' + data);
        });

        ls.on('exit', function (code) {
            var result;
            // workaround for windows machines
            // if host is unreachable ping will return
            // a successfull error code
            // so we need to handle this ourself
            if (p.match(/^win/)) {
                var lines = outstring.split('\n');
                result  = false;
                for (var t = 0; t < lines.length; t++) {
                    if (lines[t].search(/TTL=[0-9]+/i) > 0) {
						result	= true;
						break;
					}
                }
                // below is not working on My Chinese Windows8 64bit
                /*
                for (var t = 0; t < lines.length; t++) {
                    if (lines[t].match (/[0-9]:/)) {
                        result = (lines[t].indexOf ("=") != -1);
                        break;
                    }
                }
                */
            } else {
                result = (code === 0) ? true : false;
            }

            if (cb) {
                cb(result, null);
            }
        });
}

exports.probe = probe;
});

var require$$1$1 = (pingSys && typeof pingSys === 'object' && 'default' in pingSys ? pingSys['default'] : pingSys);

var index$1 = __commonjs(function (module) {
var ping = {};

ping.sys = require$$1$1;
//ping.pcap = require('./lib/ping-pcap');
ping.promise = require$$0$1;

module.exports = ping;
});

var pingRaw = (index$1 && typeof index$1 === 'object' && 'default' in index$1 ? index$1['default'] : index$1);

const config = {
  timeout: 10,
  extra: ["-i 2"],
}
function promisablePing(host) {
  return new Promise((resolve, reject) => {
    pingRaw.sys.probe(host
      , isAlive => isAlive ? resolve(host) : reject(`${host}: unreachable.`)
      , config)
  })
}
function ping(host) {
  return Rx.Observable.create(observer => {
    return promisablePing(host)
      .then(host => observer.onNext(host))
      .then(_ => observer.onCompleted())
      .catch(err => observer.onError(err))
  })
}

var tasks = R.range(1, 199).map(i => ping(`192.168.50.${i}`))
Rx.Observable
  .merge(...tasks)
  .subscribe(
    host => console.log(`pong: ${host}`),
    err => console.error(err)
  )