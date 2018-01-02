var fs = require('fs-extra');
var path = require('path');
var chalk = require('chalk');
var restorelinks = require('./restorelinks');

module.exports = function(links, options) {
  var cwd = options.cwd || process.cwd();
  var verbose = options.verbose === true ? true : false;
  
  restorelinks({
    cwd: cwd,
    verbose: verbose
  });
  
  if( !links || typeof links !== 'object' || !Object.keys(links).length ) return;
  
  // create symlinks
  for(var k in links) {
    var src = links[k];
    var dir = path.resolve(cwd, 'node_modules', k);
    
    if( !fs.existsSync(src) ) {
      if( verbose ) console.warn('* [peerdeps] link failure %s -> not found src directory(%s)', chalk.yellow(k), chalk.gray(src));
      continue;
    }
    
    if( !fs.lstatSync(src).isDirectory() ) {
      if( verbose ) console.warn('* [peerdeps] link failure %s -> src is not a directory(%s)', chalk.yellow(k), chalk.gray(src));
      continue;
    }
    
    if( fs.existsSync(dir) ) (function() {
      if( fs.lstatSync(dir).isSymbolicLink() ) return fs.unlinkSync(dir);
      var dirname = path.dirname(dir);
      var filename = path.basename(dir);
      fs.renameSync(dir, path.join(dirname, '-' + filename));
    })();
    
    try {
      if( fs.lstatSync(dir).isSymbolicLink() ) fs.unlinkSync(dir);
    } catch(err) {}
    
    fs.ensureSymlinkSync(src, dir);
    if( verbose ) console.log('* [peerdeps] link success %s -> %s', chalk.cyan(k), chalk.white(src));
  }
  
  // Set the global NODE_PATH because symbolic link's require follows its physical path.
  (function() {
    var nodepath = process.env.NODE_PATH = path.resolve(cwd, 'node_modules');
    if( !fs.existsSync(nodepath) ) fs.ensureDirSync(nodepath);
    require('module').Module._initPaths();
  })();
};