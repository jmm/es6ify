'use strict';

var through     =  require('through')
  , compile     =  require('./compile')
  , crypto      =  require('crypto')
  , path        =  require('path')
  , runtime     =  require.resolve(require('traceur').RUNTIME_PATH)
  , cache       =  {};

function getHash(data) {
  return crypto
    .createHash('md5')
    .update(data)
    .digest('hex');
}

/**
 * Compile function, exposed to be used from other libraries, not needed when using es6ify as a transform.
 *
 * @name es6ify::compileFile
 * @function
 * @param {string} file name of the file that is being compiled to ES5
 * @param {string} src source of the file being compiled to ES5
 * @return {string} compiled source
 */
function compileFile(file, src, opts) {
  var compiled;
  if (opts.traceurOverrides === undefined) opts.traceurOverrides = {};
  compiled = compile(file, src, opts);
  if (compiled.error) throw new Error(compiled.error);

  return compiled.source;
}

/**
 * The es6ify plugin to be used with browserify.
 *
 * #### Example
 *
 * `browserify().plugin(es6ify, { filePattern: /\.es6$/ })`
 *
 * @name es6ify
 * @function
 * @param {{filePattern: (undefined|!RegExp), basedir: (undefined|string), traceurOverrides: (undefined|object), includeRuntime: (undefined|boolean)}=} opts
 * filePattern (default: `/\.js$/`) pattern of files that will be es6ified
 * basedir Base path to compute relative paths for `sources`
 * traceurOverrides Allows to override traceur compiler defaults. In order to support async functions (`async`/`await`) do: `{ asyncFunctions: true }`.
 * includeRuntime (default: `true`) Include traceur runtime.
 * @return
 */

exports = module.exports = function es6ify(b, opts) {
  var transform;
  if (opts === undefined) opts = {};
  if (opts.filePattern === undefined) opts.filePattern = /\.js$/;
  else if (!(opts.filePattern instanceof RegExp)) {
    throw new Error("`filePattern` must be a RegExp if defined.");
  }

  if (opts.basedir === undefined) opts.basedir = b._options.basedir;
  if (opts.includeRuntime === undefined) opts.includeRuntime = true;
  if (opts.includeRuntime) b.add(runtime);

  transform = makeTransform();

  b.transform(transform);

  // Browserify doesn't specify a return value for plugins, so return the
  // transform for use in tests.
  return transform;

  function makeTransform() {
    return function es6ify(file) {

      // Don't es6ify the traceur runtime
      if (file === runtime) return through();

      if (!opts.filePattern.test(file)) return through();

      var data = '';
      return through(write, end);

      function write (buf) { data += buf; }
      function end () {
        var hash = getHash(data)
          , cached = cache[file];

        if (!cached || cached.hash !== hash) {
          try {
            cache[file] = {
              compiled: compileFile(file, data, opts),
              hash: hash
            };
          } catch (ex) {
            this.emit('error', ex);
            return this.queue(null);
          }
        }

        this.queue(cache[file].compiled);
        this.queue(null);
      }
    };
  }
  // makeTransform
}

/**
 * The traceur runtime exposed here so it can be included in the bundle via:
 *
 * `browserify.add(es6ify.runtime)`
 *
 * ### Note
 *
 * The runtime is quite large and not needed for all ES6 features and therefore not added to the bundle by default.
 * See [this comment](https://github.com/google/traceur-compiler/issues/1007#issuecomment-42837067) for details.
 *
 * @name e6ify::runtime
 */
exports.runtime = runtime;

exports.compileFile = compileFile;
