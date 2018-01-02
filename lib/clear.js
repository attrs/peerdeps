var fs = require('fs-extra');
var path = require('path');

function ensure(dir, visitor) {
  var pkgfile = path.join(dir, 'package.json');
    
  if( fs.existsSync(pkgfile) ) {
    visitor(dir, require(pkgfile));
  }
  
  visit(dir, visitor);
}

function visit(dir, visitor) {
  var node_modules = path.join(dir, 'node_modules');
  if( !fs.existsSync(node_modules) ) return;
  
  fs.readdirSync(node_modules).forEach(function(filename) {
    if( filename[0] === '.' ) return;
    
    var cdir = path.join(node_modules, filename);
    //var stat = fs.lstatSync(cdir);
    //if( !stat.isDirectory() && !stat.isSymbolicLink() ) return;
    
    if( filename[0] === '@' ) {
      (function(dir) {
        fs.readdirSync(dir).forEach(function(filename) {
          if( filename[0] === '.' ) return;
          var cdir = path.join(dir, filename);
          //var stat = fs.lstatSync(cdir);
          //if( !stat.isDirectory() && !stat.isSymbolicLink() ) return;
          
          ensure(cdir, visitor);
        });
      })(cdir);
    } else { 
      ensure(cdir, visitor);
    }
  });
}

module.exports = function(options) {
  options = options || {};
  var cwd = options.cwd || process.cwd();
  var verbose = options.verbose === true ? true : false;
  
  visit(cwd, function(pkgdir, pkg) {
    if( verbose ) console.log('- checking...', pkgdir);
    var peers = pkg.peerDependencies;
    if( peers ) {
      Object.keys(peers).forEach(function(pkgname) {
        var cdir = path.join(pkgdir, 'node_modules', pkgname);
        if( fs.existsSync(cdir) ) {
          // if exists peer depenency package in thier node_modules, let's rename it.
          
          var tmp = path.join(pkgdir, 'node_modules', '.ctypebk', pkgname);
          var tmpbase = path.dirname(tmp);
          
          console.log('- validating', cdir, '->', tmp);
          
          if( !fs.existsSync(tmpbase) ) fs.ensureDirSync(tmpbase);
          if( fs.existsSync(tmp) ) fs.removeSync(tmp);
          
          fs.renameSync(cdir, tmp);
        }
      });
    }
  });
};