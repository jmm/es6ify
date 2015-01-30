'use strict';
/*jshint asi: true */

var test       =  require('tap').test
  , fs         =  require('fs')
  , path       =  require('path')
  , through    =  require('through')
  , convert    =  require('convert-source-map')
  , compile    =  require('../compile')
  , proxyquire =  require('proxyquire')

test('transform adds sourcemap comment and uses cache on second time', function (t) {

    t.plan(3);
    var data = '';
    var compiles = 0;

    function trackingCompile() {
      compiles++;
      var args = [].slice.call(arguments);
      return compile.apply(this, args);
    }

    var es6ify = proxyquire('..', { './compile' : trackingCompile } )

    var sourceRoot = path.join(__dirname, '..', 'example', 'src');
    var relPath = path.join('features', 'iterators.js');

    var opts = {sourceRoot: sourceRoot};

    es6ify = es6ify.configure(opts);

    var file = path.join(sourceRoot, relPath);
    if (! opts.sourceRoot) relPath = path.basename(file);

    var contents = fs.readFileSync(file).toString();

    // first time
    fs.createReadStream(file)
      .pipe(es6ify(file))
      .on('error', console.error)
      .pipe(through(write));

    // second time
    fs.createReadStream(file)
      .pipe(es6ify(file))
      .on('error', console.error)
      .pipe(through(write, end));

    function write (buf) { data += buf; }
    function end () {
      var sourceMap = convert.fromSource(data).toObject();

      // Traceur converts all \s to /s so we need to do so also before comparing
      var fileConverted = (opts.sourceRoot ? relPath : file)
        .replace(/\\/g, '/');
      var relPathConverted = relPath.replace(/\\/g, '/');
      var sourceRootConverted = (opts.sourceRoot ? sourceRoot : path.dirname(file) + '/')
        .replace(/\\/g, '/');

      t.deepEqual(
          sourceMap
        , { version: 3,
            file: fileConverted,
            sources: [
              relPathConverted,
              '@traceur/generated/TemplateParser/2',
              '@traceur/generated/TemplateParser/3',
            ],
            names: [],
            mappings: sourceMap.mappings,
            sourceRoot: sourceRootConverted,
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
