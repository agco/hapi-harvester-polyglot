'use strict'

const _ = require('lodash')
const apiTranslator = require('./jsonApiTranslator')
const debug = require('debug')('hapi-harvester-ployglot')

exports.register = function (server, opts, next) {

    server.ext('onRequest', (request, reply) => {
        if (request.query.jsonapiversion) {
            request.headers.jsonapiversion = request.query.jsonapiversion
            delete request.query.jsonapiversion
        }
        if (!apiTranslator.translatePutToPatchIfRequired(server.plugins['hapi-harvester'].schemas, request)) {
            if (apiTranslator.translateSseUrlIfRequired(server.plugins['hapi-harvester'].schemas, request,reply)) {
                return
            }
        }
        reply.continue()
    })

    server.ext('onPostAuth', (request, reply) => {
        try {
            apiTranslator.translateRequestIfRequired(server.plugins['hapi-harvester'].schemas, request)
        } catch (e) {
            debug(e)
            reply({
                message: e.message
            }).code(400)
            return
        }
        reply.continue()
    })

    server.ext('onPreResponse', (request, reply) => {
        apiTranslator.translateResponseIfRequired(server.plugins['hapi-harvester'].schemas, request, reply)
        reply.continue()
    })

    next()

}

exports.register.attributes = {
    pkg: require('../package.json')
}

