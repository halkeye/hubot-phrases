# Description:
#   factoid (responses) support for hubot
#
# Dependencies:
#   None
#
# Configuration:
#   HUBOT_URL - Base url instead of hostname:port, ex: "http://hubot.kodekoan.com"
#
# URLS:
#   /hubot/factoid/:factoid
#
# Commands:
#   hubot literal <factoid> - Outputs information about a factoid. Right now only the url
#   hubot do something - see something random
#   hubot something random - see somethin random
#   do something - see something random
#   something random - Outputs a random factoid
#   hubot forget <factoid>#<num> - Deletes the <num>th response of <factoid>
#   hubot forget that - Deletes the last used response
#   hubot what was that - Outputs what the last factoid was
#   <factoid> - Outputs a random reply that matches <factoid>
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
      if !data
        data = {}
      @name = name
      @tidbits = []
      @alias = false
      @readonly = true
      if data.readonly? && data.readonly == false
        @readonly = false
      if data.alias
        @alias = data.alias
      else if data.tidbits
        for tid in data.tidbits
          @tidbits.push tid
    can_alias: (user) ->
      # FIXME - op only commands according to bucket
      return @can_edit user
    can_edit: (user) ->
      if user.roles
        if "edit_factoids" in user.roles
          return true
        if "edit_factoid_" + @name in user.roles
          return true
      if @readonly
        return false
      return true
    tidbit: () ->
      @tidbits[Math.floor(Math.random() * @tidbits.length)]
    add_tidbit: (tidbit, verb) ->
      # FIXME - add validation
      @tidbits.push {
        tidbit: tidbit,
        verb: verb
      }

    to_obj: () ->
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
      robot.brain.data.factoids[@name] = @to_obj()


  class FactoidHandler
    constructor: () ->
      @stats = {}
      @facts = {}
      @last_factoid = {}
      robot.brain.on 'loaded', (data) =>
        @facts = {}
        if robot.brain.data.factoids
          robot.logger.info "Loading saved factoids"
          keys = Object.keys(data.factoids)
          for key in keys
            @facts[key] = new Factoid(key, data.factoids[key])
        robot.brain.emit 'finished_loading_factoids'
    has_facts: () ->
      return Object.keys(@facts).length
    get: (str, history) ->
      return unless @has_facts()
      factoid = @facts[str]
      return unless factoid
      robot.logger.debug util.inspect factoid
      history.push factoid if history
      return @get(factoid.alias, history) if factoid.alias
      return factoid
    random: (history) ->
      return unless @has_facts()
      keys = Object.keys @facts
      factoid = keys[Math.floor(Math.random() * keys.length)]
      return @get factoid, history
    output: (msg, factoid, history) ->
      tidbit = factoid.tidbit()
      output_history = { factoid: factoid, tidbit: tidbit }
      # FIXME this should be per room
      history.push output_history if history
      output = tidbit.tidbit
      if robot.variables?
        output = robot.variables.process output, msg.message.user, output_history
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
    alias: (msg) =>
      src_name = msg.match[1].trim()
      target_name = msg.match[2].trim()
      src = robot.factoid.get src_name
      if src
        msg.reply "Sorry, there is already a factoid for '#{src_name}'."
        return
      target = robot.factoid.get target_name
      if !target
        msg.reply "Sorry, there is no factoid for the target '#{target_name}'."
        return
      if !target.can_alias msg.message.user
        robot.logger.debug "#{factoid} that factoid is protected"
        msg.reply "Sorry, that factoid is protected"
        return
      msg.finish()
      robot.logger.info "#{msg.message.user.name} aliased '#{src_name}' to '#{target_name}'"
      factoid = @facts[src_name] = new Factoid(src_name)
      factoid.alias = target_name
      factoid.save()
      msg.reply "Okay."
    setAddressed: (msg) =>
      msg.message.addressed = true
      @set msg
    set: (msg) =>
      msg.finish() # we are adding a message, so ignore any other handler type
      fact = msg.match[1].trim()
      verb = msg.match[2].trim()
      tidbit = msg.match[3].trim()
      forced = !!msg.match[4]
      if !msg.message.addressed && /^[^a-zA-Z]*<.?\S+>/.test(fact)
        robot.logger.debug "Not learning from what seems to be an IRC quote: $fact"
        return
      if !msg.message.addressed && !forced && /\=~/.test(fact)
        robot.logger.debug  "Not learning what looks like a botched =~ query"
        msg.reply "Fix your =~ command."
        return

      if fact == 'you' and verb == 'are'
        fact = robot.name
        verb = "is"
      else if fact == "I" and verb == "am"
        fact = msg.message.user.name
        verb = "is"

      @stats.learn++
      matches = tidbit.match(/^<(action|reply)>\s*(.*)/)
      if matches
        verb = "<" + matches[1] + ">"
        tidbit = matches[2]
      else if verb == "is also"
        also = 1
        verb = "is"
      else if forced
        if verb != "<action>" and verb != "<reply>"
          verb = verb.replace(/^<|>$/,'')
        if /\sis\salso$/.test(fact)
          also = 1
        else
          fact.replace(/\sis$/, '')

      if verb.toLowerCase == '<alias>'
        msg.reply "please use the 'alias' command."
        return

      fact = fact.trim()
      robot.logger.debug "Learning #{fact} #{verb} #{tidbit}"

      if fact.toLowerCase() == msg.message.user.name.toLowerCase() or fact.toLowerCase() == msg.message.user.name.toLowerCase() + " quotes"
        robot.logger.debug "Not allowing #{msg.message.user.name} to edit his own factoid"
        msg.reply "Please don't edit your own factoids."
        return

      factoid = @get fact
      if !factoid
        factoid = @facts[fact] = new Factoid(fact)
      if !factoid.can_edit msg.message.user
        robot.logger.debug "#{factoid} that factoid is protected"
        msg.reply "Sorry, that factoid is protected"
        return

      for t in factoid.tidbits
        if tidbit.toLowerCase() == t.tidbit.toLowerCase()
          msg.reply "I already had it that way"
          return

      factoid.add_tidbit tidbit, verb
      factoid.tidbits.push
      factoid.save()
      robot.logger.debug "#{msg.message.user.name} taught in #{msg.message.user.room} #{factoid.tidbits.length} '#{fact}', '#{verb}' '#{tidbit}'"
      msg.reply "Okay."
    handler_literal: (msg) ->
      # page - http://wiki.xkcd.com/irc/bucket#Listing_factoids
      page = msg.match[1]
      factoid_name = msg.match[2].trim()
      factoid = robot.factoid.get factoid_name
      if !factoid
        msg.reply "No such factoid"
        return
      msg.finish()
      if factoid.tidbits.length > 10
        baseurl = (process.env.HUBOT_URL || 'http://' + os.hostname() + ':' + robot.server.address().port).replace(/\/+$/, '')
        msg.reply baseurl + '/' + robot.name + '/factoid/' + encodeURIComponent(factoid_name)
        return
      response = []
      factoid.tidbits.forEach (tidbit) ->
        response.push "#{tidbit.verb} #{tidbit.tidbit}"
      msg.reply "#{factoid.name} (#{factoid.tidbits.length}): #{response.join('|')}"

  robot.factoid = new FactoidHandler
  robot.factoid.last_factoid = null

  robot.respond /(?:do something|something random)$/, (msg) =>
    history = []
    factoid = robot.factoid.random history
    robot.factoid.output msg, factoid, history
    robot.factoid.last_factoid = history if history.length > 0

  robot.hear /^(?:do something|something random)$/, (msg) =>
    history = []
    factoid = robot.factoid.random history
    robot.factoid.output msg, factoid, history
    robot.factoid.last_factoid = history if history.length > 0

  robot.respond /(un)?protect\s*(.*)$/, (msg) =>
    protect = !msg.match[1]
    factoid_name = msg.match[2].trim()
    factoid = robot.factoid.get factoid_name
    if !factoid
      msg.reply "No such factoid"
      return
    msg.finish()
    if factoid.readonly == protect
      msg.reply "I already had it that way"
      return
    factoid.readonly = protect
    factoid.save()
    msg.reply "Okay."

  robot.respond /alias (.*?) => (.*?)$/, robot.factoid.alias

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


  robot.respond /literal(?:\[([*\d]+)\])?\s+(.*)$/, robot.factoid.handler_literal
  robot.hear /^literal(?:\[([*\d]+)\])?\s+(.*)$/, robot.factoid.handler_literal

  robot.respond /forget #(\d+)$/, (msg) =>
    msg.reply "Sorry, syntax is now \"forget <factoid>#<index from 0>\" or \"forget that\""

  robot.respond /forget that$/, (msg) =>
    msg.reply "FIXME - not implemented yet"

  robot.respond /forget (.*)#(\d+)$/, (msg) =>
    factoid_name = msg.match[1].trim()
    tid = parseInt(msg.match[2], 10)-1
    factoid = robot.factoid.get factoid_name
    if !factoid
      msg.reply "No such factoid"
      return
    if !factoid.can_edit msg.message.user
      msg.reply "Sorry, you don't have permissions to edit '"+factoid.name+"'."
      return
    if tid < 0
      msg.reply "Sorry, you must provide a number greater than 0 (as this is 1 based)"
      return
    if !factoid.tidbits[tid]
      msg.reply "Can't find tidbit #" + tid
      return
    tidbit = factoid.tidbits.splice(tid, 1)
    msg.reply "Deleted tidbit: " + tidbit[0].verb + '|' + tidbit[0].tidbit
    factoid.save()

  robot.respond /what was that\??$/, (msg) ->
    # FIXME this should be per room
    return unless robot.factoid.last_factoid
    msg.finish()
    # halkeye: That was 'rofl' (#315): <reply> I am also amused
    # halkeye: That was 'that's what she said' => 'thats what she said' (#65): <reply> No, that's what HE said.
    # halkeye: That was 'give me a weapon' (#863): <action> gives $weapon to $who;  vars used: { 'weapon' => [ 'a Biggoron Sword' ]};.
    lf = robot.factoid.last_factoid.slice(-1)[0]
    name = lf.factoid.name
    tidbit = lf.tidbit
    idx = lf.factoid.tidbits.map((tid) -> tid.tidbit).indexOf(tidbit.tidbit)

    response = []
    response.push "That was"
    if robot.factoid.last_factoid.length > 2
      robot.factoid.last_factoid.slice(0,-2).forEach (fact) ->
        response.push "'#{fact.name}' =>"
    response.push "'" + name + "'"
    response.push "(#"+idx+"):"
    response.push tidbit.verb
    response.push tidbit.tidbit
    if lf.vars
      response.push ";"
      response.push "vars used:"
      response.push util.inspect lf.vars, { depth: null }
    msg.reply response.join ' '

  robot.respond /(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.factoid.setAddressed
  robot.respond /(.*?)(<'s>)\s+(.*)()/i, robot.factoid.setAddressed
  robot.respond /(.*?)\s+(is(?: also)?|are)\s+(.*)/i, robot.factoid.setAddressed
  robot.hear /^(.*?)\s+(<\w+(?:'t)?>)\s*(.*)()/i, robot.factoid.set
  robot.hear /^(.*?)(<'s>)\s+(.*)()/i, robot.factoid.set
  robot.hear /^(.*?)\s+(is(?: also)?|are)\s+(.*)/i, robot.factoid.set

  ## FIXME, make these loaded once brain is loaded so it doesn't need to do wildcard match
  robot.hear /^(.*)\??$/, (msg) =>
    factoid_name = msg.match[1].trim()
    # FIXME this should be per room
    history = []
    factoid = robot.factoid.get factoid_name, history
    return unless factoid
    robot.factoid.output msg, factoid, history
    robot.factoid.last_factoid = history if history.length > 0

