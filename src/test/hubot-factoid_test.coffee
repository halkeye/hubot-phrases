'use strict'
process.env.PORT = 0 # pick a random port for this test
Hubot = require('hubot')
Path = require('path')
request = require('supertest')
sinon = require('sinon')

adapterPath = Path.join Path.dirname(require.resolve 'hubot'), "src", "adapters"
robot = Hubot.loadBot adapterPath, "shell", true, "MochaHubot"
{TextMessage} = require Path.join(adapterPath,'../message')

hubot_factoid = require('../scripts/hubot-factoid')(robot)

###
======== A Handy Little Mocha Reference ========
https://github.com/visionmedia/should.js
https://github.com/visionmedia/mocha

Mocha hooks:
  before ()-> # before describe
  after ()-> # after describe
  beforeEach ()-> # before each it
  afterEach ()-> # after each it

Should assertions:
  should.exist('hello')
  should.fail('expected an error!')
  true.should.be.ok
  true.should.be.true
  false.should.be.false

  (()-> arguments)(1,2,3).should.be.arguments
  [1,2,3].should.eql([1,2,3])
  should.strictEqual(undefined, value)
  user.age.should.be.within(5, 50)
  username.should.match(/^\w+$/)

  user.should.be.a('object')
  [].should.be.an.instanceOf(Array)

  user.should.have.property('age', 15)

  user.age.should.be.above(5)
  user.age.should.be.below(100)
  user.pets.should.have.length(5)

  res.should.have.status(200) #res.statusCode should be 200
  res.should.be.json
  res.should.be.html
  res.should.have.header('Content-Length', '123')

  [].should.be.empty
  [1,2,3].should.include(3)
  'foo bar baz'.should.include('foo')
  { name: 'TJ', pet: tobi }.user.should.include({ pet: tobi, name: 'TJ' })
  { foo: 'bar', baz: 'raz' }.should.have.keys('foo', 'bar')

  (()-> throw new Error('failed to baz')).should.throwError(/^fail.+/)

  user.should.have.property('pets').with.lengthOf(4)
  user.should.be.a('object').and.have.property('name', 'tj')
###

user = {}
send_message = (msg) ->
  user = robot.brain.userForId '1', name: 'Shell', room: 'Shell', roles: [ "edit_factoids" ]
  robot.adapter.receive new TextMessage user, msg, 'messageId'

robot.logger.info = sinon.spy()

describe '#Commands', ()->
  [['Addressed', "#{robot.name}: "], ['Not Addressed', '']].forEach (type) ->
    describe type[0], ()->
      describe '#Randoms', ()->
        before (done) ->
          robot.brain.data.factoids = {
            dammit:
              readonly: false
              tidbits: [
                tidbit: "takes a quarter from $who and places it in the swear jar."
                verb: "<action>"
              ]
          }
          robot.brain.once 'finished_loading_factoids', done
          robot.brain.emit('loaded', robot.brain.data)

        describe '#something random', ()->
          before () ->
            robot.adapter.send = sinon.spy()
            send_message "something random"
          it '#outputs text', ()->
            robot.adapter.send.args.should.not.be.empty
            robot.adapter.send.args[0].should.not.be.empty
          it '#outputs quarter', ()->
            robot.adapter.send.args[0][1].should.eql("* takes a quarter from $who and places it in the swear jar.")
        describe '#do something', ()->
          before () ->
            robot.adapter.send = sinon.spy()
            send_message "do something"
          it '#outputs text', ()->
            robot.adapter.send.args.should.not.be.empty
            robot.adapter.send.args[0].should.not.be.empty
          it '#outputs quarter', ()->
            robot.adapter.send.args[0][1].should.eql("* takes a quarter from $who and places it in the swear jar.")
      describe '#Adding', ()->
        before (done) ->
          robot.brain.data.factoids = {}
          robot.brain.once 'finished_loading_factoids', done
          robot.brain.emit 'loaded', robot.brain.data

        ['is','are','is also'].forEach (isare) ->
          describe "##{isare} something", ()->
            before () ->
              robot.adapter.send = sinon.spy()
              send_message "#{type[1]}#{isare}.something #{isare} moocow"
            it '#outputs okay', ()->
              robot.adapter.send.args.should.not.be.empty
              robot.adapter.send.args[0].should.not.be.empty
              robot.adapter.send.args[0][1].should.eql("Shell: Okay.")
            it '#brain factoids updated', ()->
              robot.factoid.facts.should.not.be.empty
              robot.factoid.facts["#{isare}.something"].name.should.be.eql("#{isare}.something")
              robot.factoid.facts["#{isare}.something"].tidbits.should.be.eql([ { tidbit: 'moocow', verb: isare.replace(' also', '') } ])
              return










###
robot.hear /^(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.factoid.setAddressed
robot.hear /^(.*?)(<'s>)\s+(.*)()/i, robot.factoid.setAdressed
robot.hear /^(.*?)\s+(is(?: also)?|are)\s+(.*)/i, robot.factoid.setAddressed
robot.hear /^(.*)\??$/, (msg) =>
robot.respond /(?:do something|something random)$/, (msg) =>
robot.respond /(un)?protect\s*(.*)$/, (msg) =>
robot.respond /alias (.*?) => (.*?)$/, robot.factoid.alias
robot.respond /literal(?:\[([*\d]+)\])?\s+(.*)$/, (msg) =>
robot.respond /forget #(\d+)$/, (msg) =>
robot.respond /forget that$/, (msg) =>
robot.respond /forget (.*)#(\d+)$/, (msg) =>
robot.respond /what was that\??$/, (msg) ->
robot.respond /(.*?) (?:is ?|are ?)(<\w+>)\s*(.*)()/i, robot.factoid.setAddressed
robot.respond /(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.factoid.setAddressed
robot.respond /(.*?)(<'s>)\s+(.*)()/i, robot.factoid.set
robot.respond /(.*?)\s+(is(?: also)?|are)\s+(.*)/i, robot.factoid.set
robot.router.get "/#{robot.name}/factoid/:factoid", (req, res) ->
###
