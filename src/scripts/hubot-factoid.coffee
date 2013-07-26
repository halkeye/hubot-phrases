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

  robot.hear /^(.*)\??$/, (msg) =>
    factoid_name = msg.match[1]
    factoid = robot.factoid.get factoid_name
    return unless factoid
    robot.factoid.output msg, factoid

