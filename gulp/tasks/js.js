var gulp = require('gulp'),
    util = require('gulp-util'),
    notify = require('gulp-notify'),
    browserify = require('browserify'),  // Bundles JS.
    reactify = require('reactify'),  // Transforms React JSX to JS.
    source = require('vinyl-source-stream'),
    plumber = require('gulp-plumber'),
    paths = require('../config.js');  // To compile Stylus CSS.


// Our JS task. It will Browserify our code and compile React JSX files.
gulp.task('js', ['clean'], function() {
  // Browserify/bundle the JS.
  browserify(paths.app_js)
    .transform(reactify)
    .bundle()
    .on('error', function(err){
      util.log(util.colors.red('Error'), err.message);
      notify.onError("JS error: <%= error.message %>")(err);
      this.end();
    })
    .on('end', function(){
        util.log(util.colors.cyan('Save'), paths.dest + paths.bundle_js)
    })
    .pipe(source(paths.bundle_js))
    .pipe(gulp.dest(paths.dest));
});