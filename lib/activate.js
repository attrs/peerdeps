var series = require('async-each-series');
var path = require('path');
var fs = require('fs-extra');
var chalk = require('chalk');
var link = require('./link');
var clear = require('./clear');

function ispackage(src) {
  if( ~['.', '/'].indexOf(src[0]) ) return false;
  if( src.startsWith('@') && src.indexOf('/') === src.lastIndexOf('/') ) return true;
  if( ~src.indexOf('/') ) return false;
  return true;
}

function isdep(pkg, pkgname) {
  var peers = pkg.peerDependencies || {};
  var deps = pkg.dependencies || {};
  var optional = pkg.optionalDependencies || {};
  
  if( peers[pkgname] || deps[pkgname] || optional[pkgname] ) return true;
  return false;
}

module.exports = function(options, done) {
  options = options || {};
  var cwd = options.cwd || process.cwd();
  var verbose = options.verbose === true ? true : false;
  var cleardeps = options.cleardeps === true ? true : false;
  var context = options.context || {};
  var exports = context.exports = {};
  var pkgs = options.pkgs || [];
  var rc = options.rc || {};
  //var links = options.links || rc.links;
  var env = options.env || rc.env;
  
  if( typeof pkgs == 'string' ) pkgs = [pkgs];
  if( !Array.isArray(pkgs) ) return done(new Error('option pkgs must be an array'));
  if( !pkgs.length ) pkgs.push('.');
  
  // set NODE_PATH
  var nodepath = process.env.NODE_PATH = path.resolve(cwd, 'node_modules');
  if( !fs.existsSync(nodepath) ) fs.ensureDirSync(nodepath);
  require('module').Module._initPaths();
  
  // overwrite env
  env && typeof env == 'object' && (function() {
    for(var k in env ) {
      process.env[k] = env[k];
    }
  })();
  
  // link rc links
  /*link(links, {
    cwd: cwd,
    verbose: verbose
  });*/
  
  // clear invalid peer deps
  if( cleardeps ) clear({
    cwd: cwd,
    verbose: verbose
  });
  
  // check options
  if( typeof pkgs == 'string' ) pkgs = [pkgs];
  if( pkgs && !Array.isArray(pkgs) ) return done(new Error('option pkgs must be a string or array.'));
  
  var exec = function(pkgdir, done) {
    var pkgfile = path.join(pkgdir, 'package.json');
    if( !fs.existsSync(pkgfile) ) return done(new Error('package.json not found in ' + pkgfile));
    
    var pkgdir = path.dirname(pkgfile);
    var pkg = require(pkgfile);
    var pkgname = pkg.name;
    var main = pkg.main;
    var activator = pkg.activator;
    
    if( !pkgname ) return done(new Error('package.json/name is not defined. ' + pkgfile));
    if( typeof activator == 'string' ) activator = [activator];
    if( activator && !Array.isArray(activator) ) return done(new Error('package.json/activator must be a string or array. ' + pkgfile));
    if( exports[pkgname] ) return done();
    
    if( verbose ) console.log('* [peerdeps] package loading..', chalk.cyan(pkgname), chalk.gray(pkgdir));
    exports[pkgname] = {};
    
    if( !activator ) {
      //if( main ) exports[pkgname] = require(path.resolve(pkgdir, main)) || {};
      if( verbose ) console.log('* [peerdeps] activator not found', chalk.cyan(pkgname), chalk.gray(pkgdir));
      return done();
    }
    
    series(activator, function(src, done) {
      if( ispackage(src) ) {
        exec(path.join(cwd, 'node_modules', src), done);
      } else {
        var activatorfn = require(path.join(pkgdir, src));
        var returnobject;
        
        context.require = function(name) {
          if( !exports[name] ) throw new Error('Cannot find module \'' + name + '\'');
          if( !isdep(pkg, name) && verbose ) console.warn(chalk.yellow('[warn] unspecified module access.'), chalk.white(name), 'in', chalk.cyan(pkgname));
          return exports[name];
        };
        
        var finish = function(err, result) {
          if( err ) return done(err);
          exports[pkgname] = result || {};
          if( verbose ) console.log('* [peerdeps] package activated', chalk.cyan(pkgname), chalk.gray(pkgdir));
          done();
        };
        
        if( activatorfn instanceof Promise ) {
          returnobject = activatorfn;
        } else if( typeof activatorfn == 'function' ) {
          returnobject = activatorfn(context, finish);
        } else {
          exports[pkgname] = activatorfn || {};
          if( verbose ) console.log('* [peerdeps] package has no activator(bypass)', chalk.cyan(pkgname), chalk.gray(pkgdir));
          return done();
        }
        
        if( returnobject && returnobject instanceof Promise ) {
          returnobject.then(function(result) {
            finish(null, result);
          }, function(err) {
            finish(err);
          });
        }
      }
    }, done);
  };
  
  series(pkgs || [], function(pkgname, done) {
    if( !pkgname || typeof pkgname != 'string' ) return done();
    
    var pkgdir = path.join(cwd, 'node_modules', pkgname);
    if( pkgname == '.' ) pkgdir = cwd;
    if( pkgname.startsWith('/') && fs.existsSync(pkgname) ) pkgdir = pkgname;
    
    if( !fs.existsSync(pkgdir) ) return done(new Error('package \'' + pkgname + '\' not found.' + pkgdir));
    
    exec(pkgdir, done);
  }, done);
};