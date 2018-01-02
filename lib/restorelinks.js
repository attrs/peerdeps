var fs = require('fs');
var path = require('path');

module.exports = function(options) {
  options = options || {};
  var cwd = options.cwd || process.cwd();
  var verbose = options.verbose === true ? true : false;
  
  var node_modules = path.join(cwd, 'node_modules');
  
  if( fs.existsSync(node_modules) ) {
    var list = fs.readdirSync(node_modules);
    list.forEach(function(filename) {
      var cdir = path.join(node_modules, filename);
      var bkdir = path.join(path.dirname(cdir), '-' + path.basename(cdir));
      var stat = fs.lstatSync(cdir);
      
      if( filename[0] === '@' && stat.isDirectory() ) {
        (function(dir) {
          fs.readdirSync(dir).forEach(function(filename) {
            var cdir = path.join(dir, filename);
            var bkdir = path.join(path.dirname(cdir), '-' + path.basename(cdir));
            var stat = fs.lstatSync(cdir);
            
            if( filename[0] === '.' || !stat.isSymbolicLink() ) return;
            
            fs.unlinkSync(cdir);
            
            if( fs.existsSync(bkdir) && fs.statSync(bkdir).isDirectory() ) {
              fs.renameSync(bkdir, cdir);
              if( verbose) console.log('* [peerdeps] restore link', cdir);
            }
          });
        })(cdir);
      } else {
        if( filename[0] === '.' || !stat.isSymbolicLink() ) return;
        
        fs.unlinkSync(cdir);
        
        if( fs.existsSync(bkdir) && fs.statSync(bkdir).isDirectory() ) {
          fs.renameSync(bkdir, cdir);
          if( verbose) console.log('* [peerdeps] restore link', cdir);
        }
      }
    });
  }
};