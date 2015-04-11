var gulp = require('gulp'),
    uglify = require('gulp-uglify'),
    sourcemaps = require('gulp-sourcemaps'),
    paths = require('../config.js');


gulp.task('build_js', ['clean'], function(){
  return gulp.src(paths.dest + 'bundle.js')
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(paths.dest));
});
