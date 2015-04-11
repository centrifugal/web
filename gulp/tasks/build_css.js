var gulp = require('gulp'),
    minify = require('gulp-minify-css'),
    paths = require('../config.js');


gulp.task('build_css', ['clean'], function(){
  return gulp.src(paths.dest + 'bundle.css')
    .pipe(minify())
    .pipe(gulp.dest(paths.dest));
});