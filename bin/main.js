#!/usr/bin/env node

var commander = require('commander');
var path = require('path');
var fs = require('fs-extra');
var chalk = require('chalk');
var http = require('http');
var JSON5 = require('json5');
var pkg = require('../package.json');
var lib = require('../');

var title = process.title = pkg.name.split('/')[1] || pkg.name.split('/')[0];
var bin = Object.keys(pkg.bin)[0];
  
commander
  .version(pkg.version)

commander
  .command('run [pkgs...]')
  .description('Run')
  .option('-i, --install', 'Install Peer Dependencies Automatically.')
  .option('-v, --verbose', 'Verbose Mode')
  .option('-c, --rcfile [rcfile]', 'apply config file(default is .peerdepsrc)')
  .action(function(pkgs, options) {
    process.env.NODE_ENV = 'production';
    
    var cwd = process.cwd();
    var rcfile = options.rcfile;
    var rc;
    
    if( rcfile ) {
      rcfile = path.resolve(cwd, (typeof rcfile == 'string') ? rcfile : '.peerdepsrc');
      
      if( fs.existsSync(rcfile) ) {
        console.log(chalk.blue('use config file: ') + chalk.white(rcfile));
        rc = JSON5.parse(fs.readFileSync(rcfile));
      }
    }
    
    var verbose = options.verbose;
    var install = options.install ? lib.install : function(pkgs, options, done) { done(); };
    
    install(pkgs, {
      cwd: cwd,
      verbose: verbose,
    }, function(err) {
      if( err ) return console.error(chalk.red(err.stack || err));
      
      lib.activate({
        cwd: cwd,
        verbose: verbose,
        pkgs: pkgs,
        links: rc && rc.links,
        env: rc && rc.env
      }, function(err, ctx) {
        if( err ) return console.error(chalk.red(err.stack || err));
        console.log('platform initialized.');
      });
    });
  })
  .on('--help', function() {
    console.log('  Examples:');
    console.log();
    console.log('  $ %s up', bin);
    console.log('  $ %s up pkgname', bin);
    console.log();
  });

commander
  .command('install [pkgs...]')
  .alias('i')
  .description('Install Peer Dependencies')
  .option('-f, --force', 'Force install')
  .option('-v, --verbose', 'Verbose Mode')
  .action(function(pkgs, options) {
    var cwd = process.cwd();
    var verbose = options.verbose;
    var force = options.force;
    
    lib.install(pkgs, {
      cwd: cwd,
      verbose: verbose,
      force: force
    }, function(err, result) {
      if( err ) return console.error(chalk.red(err.stack || err));
      
      var installed = result.installed;
      var skipped = result.skipped;
      
      if( verbose ) console.log('* [peerdeps] %s peer packages are skipped.', chalk.blue(skipped.length));
      skipped.forEach(function(pkg) {
        if( verbose ) console.log(' - ' + chalk.white(pkg));
      });
      
      console.log('%s peer packages are installed.', chalk.blue(installed.length));
      installed.forEach(function(pkg) {
        console.log(' - ' + chalk.white(pkg));
      });
    });
  })
  .on('--help', function() {
    console.log('  Examples:');
    console.log();
    console.log('  $ %s install', bin);
    console.log('  $ %s install pkg1 pkg2 pkg3', bin);
    console.log('  $ %s i pkg1 pkg2 pkg3', bin);
    console.log();
  });

commander
  .command('restore')
  .alias('r')
  .description('Restore Linked Packages')
  .option('-v, --verbose', 'Verbose Mode')
  .action(function(options) {
    var cwd = process.cwd();
    var verbose = options.verbose;
    
    lib.restorelinks({
      cwd: cwd,
      verbose: verbose
    });
    
    console.log('links has been restored');
  })
  .on('--help', function() {
    console.log('  Examples:');
    console.log();
    console.log('  $ %s restore', bin);
    console.log('  $ %s r', bin);
    console.log();
  });

commander
  .command('clear')
  .alias('c')
  .description('Clear Invalid Peer in Sub-packages')
  .option('-v, --verbose', 'Verbose Mode')
  .action(function(options) {
    var cwd = process.cwd();
    var verbose = options.verbose;
    
    lib.clear({
      cwd: cwd,
      verbose: verbose
    });
    
    console.log('invalid peer deps has been cleared.');
  })
  .on('--help', function() {
    console.log('  Examples:');
    console.log();
    console.log('  $ %s validate', bin);
    console.log();
  });

commander
  .action(function (action) {
    console.log('Unknown Command \'%s\'', action || '');
    commander.outputHelp();
  })
  .parse(process.argv);



if( !process.argv.slice(2).length ) commander.outputHelp();