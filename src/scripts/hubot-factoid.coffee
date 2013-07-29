# Description:
#   factoid (responses) support for hubot
#
# Dependencies:
#   None
#
# Configuration:
#   None
#
# Commands:
#   None
#
# Notes:
#   Copyright (c) 2013 Gavin Mogan
#   Licensed under the MIT license.
#
# Author:
#   halkeye

'use strict'

util = require 'util'
os = require 'os'

module.exports = (robot) ->
  class Factoid
    constructor: (name, data) ->
      @name = name
      @tidbits = []
      @alias = false
      @readonly = data.readonly
      if data.alias
        @alias = data.alias
      else
        for tid in data.tidbits
          @tidbits.push tid
    tidbit: () ->
      @tidbits[Math.floor(Math.random() * @tidbits.length)]
    toObj: () ->
      if @alias
        return {
          alias: @alias
          readonly: @readonly,
        }
      return {
        readonly: @readonly,
        tidbits: @tidbits
      }
    save: () ->
      robot.brain.data.factoids[@name] = @toObj()


  class FactoidHandler
    constructor: () ->
      @facts = {}
      robot.brain.on 'loaded', (data) =>
        @facts = {}
        if robot.brain.data.factoids
          robot.logger.info "Loading saved factoids"
          keys = Object.keys(data.factoids)
          for key in keys
            @facts[key] = new Factoid(key, data.factoids[key])
    has_facts: () ->
      return Object.keys(@facts).length
    get: (str) ->
      return unless @has_facts()
      factoid = @facts[str]
      return unless factoid
      robot.logger.debug util.inspect factoid
      return @get(factoid.alias) if factoid.alias
      return factoid
    random: () ->
      return unless @has_facts()
      keys = Object.keys @facts
      factoid = keys[Math.floor(Math.random() * keys.length)]
      return @get factoid
    output: (msg, factoid) ->
      tidbit = factoid.tidbit()

      output = tidbit.tidbit
      if robot.variables?
        output = robot.variables.process output, msg.message.user
      if tidbit.verb == "<reply>"
        msg.send output
      else if tidbit.verb == "<action>"
        if msg.emote?
          msg.emote output
        else
          msg.send "/me " + output
      else if tidbit.verb == "is" && factoid.name.toLowerCase() == robot.name.toLowerCase()
        msg.send "I am " + output
      else
        msg.send [factoid.name, tidbit.verb, output].join ' '

  robot.factoid = new FactoidHandler

  robot.respond /something random$/, (msg) =>
    factoid = do robot.factoid.random
    robot.factoid.output msg, factoid

  robot.hear /^something random$/, (msg) =>
    factoid = do robot.factoid.random
    robot.factoid.output msg, factoid


  robot.router.get "/#{robot.name}/factoid/:factoid", (req, res) ->
    factoid_name = req.params.factoid
    return res.status(404).send('Not Found') unless factoid_name
    factoid = robot.factoid.get factoid_name
    return res.status(404).send('Not Found') unless factoid
    res.setHeader 'content-type', 'text/plain'
    content = []
    content.push 'Factoid: [' + factoid_name + ']'
    content.push 'Protected: ' + factoid.readonly ? "true" : "false"
    content.push ""
    content.push "Tidbits:"
    for tidbit in factoid.tidbits
      content.push tidbit.verb + "|" + tidbit.tidbit
    res.send content.join "\n"
    res.end
    #res.send require('util').inspect(req.params)


  robot.hear /^literal(?:\[([*\d]+)\])?\s+(.*)$/, (msg) =>
    page = msg.match[1]
    factoid_name = msg.match[2]
    factoid = robot.factoid.get factoid_name
    if !factoid
      msg.reply "No such factoid"
      return
    baseurl = process.env.HUBOT_URL || 'http://' + os.hostname() + ':' + robot.server.address().port
    msg.reply baseurl + '/' + robot.name + '/factoid/' + encodeURIComponent(factoid_name)

  robot.hear /^forget #(\d+)$/, (msg) =>
    msg.reply "Sorry, syntax is now \"forget <factoid>#<index from 0>\" or \"forget that\""

  robot.hear /^forget that$/, (msg) =>
    msg.reply "FIXME - not implemented yet"

  robot.hear /^forget (.*)#(\d+)$/, (msg) =>
    factoid_name = msg.match[1]
    tid = parseInt(msg.match[2], 10)-1
    factoid = robot.factoid.get factoid_name
    if !factoid
      msg.reply "No such factoid"
      return
    if tid < 0
      msg.reply "Sorry, you must provide a number greater than 0 (as this is 1 based)"
      return
    if !factoid.tidbits[tid]
      msg.reply "Can't find tidbit #" + tid
      return
    tidbit = factoid.tidbits.splice(tid, 1)
    msg.reply "Deleted tidbit: " + tidbit[0].verb + '|' + tidbit[0].tidbit

  robot.hear /^(.*)\??$/, (msg) =>
    factoid_name = msg.match[1]
    factoid = robot.factoid.get factoid_name
    return unless factoid
    robot.factoid.output msg, factoid

