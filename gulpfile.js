var gulp = require('gulp');
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');

var dirs = {
	dist: 'dist',
	source: 'src',
	adapters: 'adapters',
};
dirs.adaptersDist = dirs.dist + '/adapters';

gulp.task('build', [
	'concat:sources',
	'copy:adapters'
]);

gulp.task('clean', function (done) {
	require('del')([
		dirs.dist
	], done);
});

gulp.task('concat:sources', ['clean'], function() {
	return gulp.src([
		'src/module.js',
		'src/**/*.js'
		//'adapters/**/*.js' // TODO
	])
		//.pipe(sourcemaps.init())
		.pipe(concat('ia-auth.js'))
		//.pipe(sourcemaps.write())
		.pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:adapters', ['clean'], function() {
	return gulp.src('adapters/**/*.js')
		.pipe(gulp.dest(dirs.adaptersDist));
});
