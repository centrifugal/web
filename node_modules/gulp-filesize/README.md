gulp-filesize
===========

[Gulp](https://github.com/wearefractal/gulp) extension to log filesizes in human readable Strings to the console.

    var size = require('gulp-filesize');

Example
-------
    
	gulp.src('./css/*.css')
	//all your gulp tasks
	.pipe(gulp.dest('./dist/')
	.pipe(size()) // [gulp] Size example.css: 265.32 kB  
	

License
-------

MIT