module.exports = function(grunt) {
  'use strict';

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    eslint: {
      target: ['src/**/*.js'],
    },
    simplemocha: {
      all: {
        src: [
          'node_modules/should/should.js',
          'src/test/**/*.js'
        ],
        options: {
          globals: ['should'],
          timeout: 3000,
          ignoreLeaks: false,
          //grep: '**/*.js'
          ui: 'bdd',
          bail: true,
          //reporter: 'tap'
          reporter: 'spec'
        }
      }
    },
    watch: {
      gruntfile: {
        files: '<%= eslint.gruntfile.src %>',
        tasks: ['eslint:gruntfile']
      },
      coffeeLib: {
        files: '<%= eslint.scripts.src %>',
        tasks: ['eslint:scripts', 'simplemocha']
      },
      coffeeTest: {
        files: ['<%= eslint.test.src %>','node_modules/hubot-variables/src/scripts/*.coffee'],
        tasks: [ 'eslint:test', 'simplemocha']
      }
    },
    clean: ['out/']});

  // plugins.
  grunt.loadNpmTasks('grunt-simple-mocha');
  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // tasks.
  grunt.registerTask('compile', [ 'eslint' ]);

  grunt.registerTask('test', [ 'simplemocha' ]);
  return grunt.registerTask('default', ['compile', 'test']);
};

