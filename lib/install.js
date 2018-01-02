var path = require('path');
var fs = require('fs');
var chalk = require('chalk');
var series = require('async-each-series');
var exec = require('child_process').exec;
var restorelinks = require('./restorelinks');

function findversion(pkgname, range, done) {
  exec('npm view ' + pkgname + '@\"' + range + '\" version --json', function(err, stdout, stderr) {
    if( err ) return done(err);
    if( stderr ) return done(new Error(stderr));
    
    var version = JSON.parse(stdout);
    if( Array.isArray(version) ) version = version[version.length - 1];
    done(null, version);
  });
}

function findpeer(pkgname, version, done) {
  exec('npm view ' + pkgname + '@\"' + version + '\" peerDependencies --json', function(err, stdout, stderr) {
    if( err ) return done(err);
    if( stderr ) return done(new Error(stderr));
    if( !stdout ) return done();
    
    var peers = JSON.parse(stdout);
    done(null, peers);
  });
}

function isinstalled(cwd, pkgname, version) {
  var pkgfile = path.join(cwd, 'node_modules', pkgname, 'package.json');
  if( !fs.existsSync(pkgfile) ) return false;
  
  var pkg = require(pkgfile);
  if( pkg.version !== version ) return false;
  return true;
}

module.exports = function(pkgs, options, done) {
  options = options || {};
  
  var cwd = options.cwd || process.cwd();
  var verbose = options.verbose === true ? true : false;
  var force = options.force === true ? true : false;
  var peers = {};
  
  restorelinks({
    cwd: cwd,
    verbose: verbose
  });
  
  if( !pkgs || !pkgs.length ) pkgs = ['.'];
  
  pkgs.forEach(function(pkg) {
    if( !pkg ) return;
    var pkgname = pkg.trim();
      
    if( pkg == '.' ) {
      var cwdpkg = require(path.join(cwd, 'package.json'));
      var peerDependencies = cwdpkg.peerDependencies || {};
      Object.keys(peerDependencies).forEach(function(pkgname) {
        if( peers[pkgname] ) return;
        peers[pkgname] = peerDependencies[pkgname];
      });
    } else {
      var version;
      var splits = pkgname.split('@');
      if( pkgname.startsWith('@') && splits.length >= 3 ) {
        pkgname = splits[1];
        version = splits[2];
      } else if( !pkgname.startsWith('@') && splits.length >= 2 ) {
        pkgname = splits[0];
        version = splits[1];
      }
      
      peers[pkgname] = version || 'latest';
    }
  });
  
  if( !Object.keys(peers).length ) return done();
  
  var confirmed = {};
  var extract = function(pkgname, peers, done) {
    var range = peers[pkgname];
    
    if( verbose ) console.log('* [peerdeps] npm view %s@\"%s\" version', pkgname, range);
    findversion(pkgname, range, function(err, version) {
      if( err ) return done(err);
      if( !version )
        return done(new Error('cannot resolve satisfying version:' + pkgname, range));
      if( confirmed[pkgname] ) {
        if( confirmed[pkgname] !== version )
          return done(new Error('version conflicted, ' + pkgname + '@' + version + ' & ' + pkgname + '@' + confirmed[pkgname]));
        
        return done();
      }
      
      console.log('%s satisfying version is %s', chalk.white(pkgname), chalk.blue(version));
      confirmed[pkgname] = version;
      
      if( verbose ) console.log('* [peerdeps] npm view %s@\"%s\" peerDependencies', pkgname, version);
      findpeer(pkgname, version, function(err, pkgpeers) {
        if( err ) return done(err);
        if( !pkgpeers ) return done();
        if( verbose ) console.log('* [peerdeps] %s peer dependencies found', pkgname, pkgpeers);
        
        series(Object.keys(pkgpeers), function(pkgname, done) {
          extract(pkgname, pkgpeers, done);
        }, done);
      });
    });
  }
  
  series(Object.keys(peers), function(pkgname, done) {
    extract(pkgname, peers, done);
  }, function(err) {
    if( err ) return done(err);
    
    var tobeinstalled = [];
    var skipped = [];
    
    Object.keys(confirmed).forEach(function(pkgname) {
      var version = confirmed[pkgname];
      
      if( !force && isinstalled(cwd, pkgname, version) ) {
        skipped.push(pkgname + '@' + version);
      } else {
        tobeinstalled.push(pkgname + '@' + version);
      }
    });
    
    console.log('%s peer packages will be installed. %s', chalk.cyan(tobeinstalled.length), chalk.blue(tobeinstalled.join(' ')));
    
    if( verbose && skipped.length ) console.log('* [peerdeps] %s peer packages are skipped, %s', chalk.cyan(skipped.length), chalk.white(skipped.join(' ')));
    
    if( !tobeinstalled.length ) return done(null, {
      installed: tobeinstalled,
      skipped: skipped
    });
    
    var cmdstr = 'npm install ' + tobeinstalled.join(' ');
    console.log(cmdstr);
    
    var child = exec(cmdstr, {
      cwd: cwd
    }, function(err, stdout, stderr) {
      if( err ) return done(err);
      
      console.log(stdout);
      
      done(null, {
        installed: tobeinstalled,
        skipped: skipped
      });
    });
    
    if( verbose ) child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
  });
};