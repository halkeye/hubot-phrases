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

module.exports = (robot) ->
  if robot.adapter.bot?
    robot.adapter.action = (envelope, strings...) ->
      target = @_getTargetFromEnvelope envelope
      unless target
        return console.log "ERROR: Not sure who to send to. envelope=", envelope
      for str in strings
        @bot.action target, str

  class Factoids
    @get = (str) ->
      if !robot.brain.data.factoids
        return
      factoid = robot.brain.data.factoids[str]
      if !factoid
        return
      if factoid.alias
        return @get factoid.alias
      return factoid.tidbits[Math.floor(Math.random() * factoid.tidbits.length)]

  robot.hear /^(.*)\??$/, (msg) =>
    factoid_name = msg.match[1]
    factoid = Factoids.get factoid_name
    if !factoid
      return
    console.log factoid
    tidbit = factoid.tidbit

    if robot.variables?
      tidbit = robot.variables.process tidbit, msg.message.user

    if factoid.verb == "<reply>"
      msg.send tidbit
    else if factoid.verb == "<action>"
      if msg.action?
        msg.action tidbit
      else
        msg.send "/me " + tidbit
    else if factoid.verb == "is" && factoid_name.toLowerCase() == robot.name.toLowerCase()
      msg.send "I am " + tidbit
    else
      msg.send [factoid_name, factoid.verb, factoid.tidbit].join ' '

