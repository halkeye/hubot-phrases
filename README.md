# hubot-phrases

[![Build Status](https://travis-ci.org/halkeye/hubot-phrases.png?branch=master)](https://travis-ci.org/halkeye/hubot-phrases)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/667ad904c0dd4cea94f50e513720e71a)](https://www.codacy.com/app/halkeye/hubot-phrases?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=halkeye/hubot-phrases&amp;utm_campaign=Badge_Grade)
[![Codacy Badge](https://api.codacy.com/project/badge/Coverage/667ad904c0dd4cea94f50e513720e71a)](https://www.codacy.com/app/halkeye/hubot-phrases?utm_source=github.com&utm_medium=referral&utm_content=halkeye/hubot-phrases&utm_campaign=Badge_Coverage) [![Greenkeeper badge](https://badges.greenkeeper.io/halkeye/hubot-phrases.svg)](https://greenkeeper.io/)

phrases (responses) support for hubot

## Getting Started
1. Install the module: `npm install --save hubot-phrases`
2. Add it `hubot-phrases` to your external-scripts.json file in your hubot directory

## Usage

* hubot literal <phrase> - Outputs information about a phrase. if greater than 10 tidbits, then output a url instead
* hubot do something|something random - output a random phrase
* hubot forget <phrase>#<num> - Deletes the <num>th response of <phrase>
* hubot forget that - Deletes the last used response
* hubot what was that - Outputs what the last phrase was
* hubot X <reply>|<action>|is Y - Sets a response for X to be Y
* [phrase] - Outputs a random tidbit/reply that matches <phrase>

## Configuration

None

## Release History

2016-12-30 - 1.0.2

* Minor bug fix to handle when no existing data

2016-12-27 - 1.0.1

* Full cleanup/rename of factoid to phrases
* Update documentation

2016-12-27 - 1.0.0

* Remove coffeescript
* Test coverage
* minor bug fixes

## License
Copyright (c) 2013,2016 Gavin Mogan
Licensed under the MIT license.
