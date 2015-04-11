var map = require('map-stream');
var gutil = require('gulp-util');
var getFileSize = require("filesize");

module.exports = function(){
  'use strict';


  return map(function(file,callback){
  	var filenameShort = file.path.split(/\/|\\/).pop()

  	//Check if file.stat exists (gulp.concat removes it for example)
  	var filesize = file.stat ? getFileSize(file.stat.size) : getFileSize(Buffer.byteLength(String(file.contents)));

  	gutil.log("Size",gutil.colors.cyan(filenameShort),":",gutil.colors.magenta(filesize));

  	callback(null,file)
  });


};
