var gulp = require('gulp'),
    util = require('gulp-util'),
    notify = require('gulp-notify'),
    plumber = require('gulp-plumber'),
    stylus = require('gulp-stylus'),
    concat = require('gulp-concat-css'),
    paths = require('../config.js');


// Our CSS task. It finds all our Stylus files and compiles them.
gulp.task('css', ['clean'], function() {
  return gulp.src(paths.css)
    .pipe(plumber({errorHandler: notify.onError("CSS error: <%= error.message %>")}))
    .pipe(stylus())
    .pipe(concat(paths.bundle_css))
    .on('end', function(){
        util.log(util.colors.cyan('Save'), paths.dest + paths.bundle_css)
    })
    .pipe(gulp.dest(paths.dest));
});