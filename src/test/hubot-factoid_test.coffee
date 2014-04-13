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
hubot_variables = require('hubot-variables')(robot)

user = {}
send_message = (msg) ->
  user = robot.brain.userForId '1', name: 'Shell', room: 'Shell', roles: [ "edit_factoids" ]
  robot.adapter.receive new TextMessage user, msg, 'messageId'

robot.logger.info = sinon.spy()

variables_handler = robot.variables
robot.variables = null

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
              robot.adapter.send.args[0][1].should.eql("#{user.name}: Okay.")
            it '#brain factoids updated', ()->
              robot.factoid.facts.should.not.be.empty
              robot.factoid.facts["#{isare}.something"].name.should.be.eql("#{isare}.something")
              robot.factoid.facts["#{isare}.something"].tidbits.should.be.eql([ { tidbit: 'moocow', verb: isare.replace(' also', '') } ])
              return
  describe '#What was that', () ->
    before (done) ->
      robot.brain.data.factoids = {
        dammit:
          readonly: false
          tidbits: [
            tidbit: "takes a quarter from $who and places it in the swear jar."
            verb: "<action>"
          ]
        rofl:
          readonly: false
          tidbits: [
            tidbit: "I am also amused"
            verb: "<reply>"
          ]
        variables:
          readonly: false
          tidbits: [
            tidbit: "Hey, you are $who"
            verb: "<reply>"
          ]
        lolalias:
          readonly: false
          alias: "rofl"
      }
      robot.brain.once 'finished_loading_factoids', done
      robot.brain.emit('loaded', robot.brain.data)

    describe '#basic', () ->
      before () ->
        robot.factoid.last_factoid = null
        robot.adapter.send = sinon.spy()
        send_message "dammit"
        send_message "#{robot.name}: what was that"
      it 'responded at all', () ->
        robot.adapter.send.args.should.not.be.empty
      it 'responding to factoid', () ->
        robot.adapter.send.args[0].should.not.be.empty
        robot.adapter.send.args[0][1].should.eql("* takes a quarter from $who and places it in the swear jar.")
      it 'responding to "what was that"', () ->
        robot.adapter.send.args[1].should.not.be.empty
        robot.adapter.send.args[1][1].should.eql("#{user.name}: That was \'dammit\' (#0): <action> takes a quarter from $who and places it in the swear jar.")

    describe '#something random', () ->
      before () ->
        robot.factoid.last_factoid = null
        robot.adapter.send = sinon.spy()
        send_message "something random"
        send_message "#{robot.name}: what was that"
      it 'responded at all', () ->
        robot.adapter.send.args.should.not.be.empty
      it 'responding to "what was that"', () ->
        robot.adapter.send.args[1].should.not.be.empty
        robot.adapter.send.args[1][1].should.match(new RegExp("^#{user.name}: That was"))

    describe '#alias', () ->
      before () ->
        robot.factoid.last_factoid = null
        robot.adapter.send = sinon.spy()
        send_message "lolalias"
        send_message "#{robot.name}: what was that"
      it 'responded at all', () ->
        robot.adapter.send.args.should.not.be.empty
      it 'responding to factoid', () ->
        robot.adapter.send.args[0].should.not.be.empty
        robot.adapter.send.args[0][1].should.eql("I am also amused")
      it 'responding to "what was that"', () ->
        robot.adapter.send.args[1].should.not.be.empty
        robot.adapter.send.args[1][1].should.eql("#{user.name}: That was 'lolalias' => 'rofl' (#0): <reply> I am also amused")
    
    describe '#variables', () ->
      before () ->
        robot.variables = variables_handler
        robot.factoid.last_factoid = null
        robot.adapter.send = sinon.spy()
        send_message "variables"
        send_message "#{robot.name}: what was that"
      after () ->
        robot.variables = null
      it 'responded at all', () ->
        robot.adapter.send.args.should.not.be.empty
      it 'responding to factoid', () ->
        robot.adapter.send.args[0].should.not.be.empty
        robot.adapter.send.args[0][1].should.eql("Hey, you are #{user.name}")
      it 'responding to "what was that"', () ->
        robot.adapter.send.args[1].should.not.be.empty
        robot.adapter.send.args[1][1].should.eql("#{user.name}: That was 'variables' (#0): <reply> Hey, you are $who ; vars used: { who: '#{user.name}' }")
    # halkeye: That was 'give me a weapon' (#863): <action> gives $weapon to $who;  vars used: { 'weapon' => [ 'a Biggoron Sword' ]};.









#robot.hear /^(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.factoid.setAddressed
#robot.hear /^(.*?)(<'s>)\s+(.*)()/i, robot.factoid.setAdressed
#robot.hear /^(.*)\??$/, (msg) =>
#robot.respond /(?:do something|something random)$/, (msg) =>
#robot.respond /(un)?protect\s*(.*)$/, (msg) =>
#robot.respond /alias (.*?) => (.*?)$/, robot.factoid.alias
#robot.respond /literal(?:\[([*\d]+)\])?\s+(.*)$/, (msg) =>
#robot.respond /forget #(\d+)$/, (msg) =>
#robot.respond /forget that$/, (msg) =>
#robot.respond /forget (.*)#(\d+)$/, (msg) =>
#robot.respond /what was that\??$/, (msg) ->
#robot.respond /(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.factoid.setAddressed
#robot.respond /(.*?)(<'s>)\s+(.*)()/i, robot.factoid.set
#robot.router.get "/#{robot.name}/factoid/:factoid", (req, res) ->
