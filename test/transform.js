'use strict';
/*jshint asi: true */

var test       =  require('tap').test
  , fs         =  require('fs')
  , path       =  require('path')
  , through    =  require('through')
  , convert    =  require('convert-source-map')
  , compile    =  require('../compile')
  , proxyquire =  require('proxyquire')

/**
 * @function
 * @param {{useSourceRoot: boolean}} opts
 * useSourceRoot Do or don't specify sourceRoot to traceur.
 */
function addsSourceMap (t, opts) {
  t.plan(3);
  var data = '';
  var compiles = 0;

  function trackingCompile() {
    compiles++;
    var args = [].slice.call(arguments);
    return compile.apply(this, args);
  }

  // Input / output paths
  var paths = { out: {} };

  paths.in = {
    sourceRoot: path.join(__dirname, '..', 'example', 'src'),
    // Path that should wind up in `sources` in the map when sourceRoot is used.
    sources: path.join('features', 'iterators.js'),
  };
  paths.in.file = path.join(paths.in.sourceRoot, paths.in.sources);

  var es6ifyOpts = {};
  if (opts.useSourceRoot) es6ifyOpts.sourceRoot = paths.in.sourceRoot;
  var es6ify = proxyquire('..', { './compile' : trackingCompile } )
  es6ify = es6ify.configure(es6ifyOpts);

  var contents = fs.readFileSync(paths.in.file, { encoding: 'utf8' });

  // Run without, then with, `end()`
  [undefined, end].forEach(function (end) {
    fs.createReadStream(paths.in.file)
      .pipe(es6ify(paths.in.file))
      .on('error', console.error)
      .pipe(through(write, end));
  });

  function write (buf) { data += buf; }
  function end () {
    var sourceMap = convert.fromSource(data).toObject();

    paths.out.sources =
      opts.useSourceRoot ?
      paths.in.sources :
      path.basename(paths.in.sources);

    paths.out.file = opts.useSourceRoot ? paths.out.sources : paths.in.file;

    paths.out.sourceRoot =
      opts.useSourceRoot ?
      paths.in.sourceRoot :
      path.dirname(paths.in.file) + '/';

    // Traceur converts all "\" to "/" so we need to do so also before comparing
    Object.keys(paths.out).forEach(function (key) {
      paths.out[key] = paths.out[key].replace(/\\/g, '/');
    });

    t.deepEqual(
        sourceMap
      , { version: 3,
          file: paths.out.file,
          sources: [
            paths.out.sources,
            '@traceur/generated/TemplateParser/2',
            '@traceur/generated/TemplateParser/3',
          ],
          names: [],
          mappings: sourceMap.mappings,
          sourceRoot: paths.out.sourceRoot,
          sourcesContent: [
            contents,

            '\n        for (var $__placeholder__0 =\n' +
            '                 $__placeholder__1[\n' +
            '                     $traceurRuntime.toProperty(Symbol.iterator)](),\n' +
            '                 $__placeholder__2;\n' +
            '             !($__placeholder__3 = $__placeholder__4.next()).done; ) {\n' +
            '          $__placeholder__5;\n' +
            '          $__placeholder__6;\n' +
            '        }',

            'void 0'
          ] }
      , 'adds sourcemap comment including original source'
    );
    t.ok(sourceMap.mappings.length);
    t.equal(compiles, 1, 'compiles only the first time');
  }
}
// addsSourceMap

test('transform adds sourcemap comment and uses cache on second time', function (t) {

});

test('transform does not add sourcemaps if traceurOverrides.sourceMaps is false', function (t) {

    t.plan(1);
    var data = '';

    var es6ify = require('..');
    var file = path.join(__dirname, '../example/src/features/iterators.js');

    es6ify.traceurOverrides = { sourceMaps: false };

    fs.createReadStream(file)
      .pipe(es6ify(file))
      .on('error', function (e) { throw e; })
      .pipe(through(write, end));

    function write (buf) { data += buf; }
    function end () {
      var sourceMap = convert.fromSource(data);
      t.ok(sourceMap === null);
    }
})
