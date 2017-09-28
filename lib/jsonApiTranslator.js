'use strict'

const _ = require('lodash')
const url = require('url')
const querystring = require('querystring')
const ess = require('agco-event-source-stream')
const inflect = require('i')()

function isJSONAPI_0_8(req) {
    return !req.headers.jsonapiversion || req.headers.jsonapiversion !== '1.0'
}
function isTranslationRequired(req) {
    return isJSONAPI_0_8(req) && req.route.settings.tags && -1 < req.route.settings.tags.indexOf('jsonapi')
}
function isSingleSegmentUrl(req) {
    return !!req.raw.req.url.match('^\/([^/?]*)([?].*)?$')
}
function isTwoSegmentUrl(req) {
    return !!req.raw.req.url.match('^\/([^/?]*)\/([^/?]*)([?].*)?$')
}
function isSingleResourcePost(req) {
    return req.method === 'post' && isSingleSegmentUrl(req)
}
function isSingleResourcePatch(req) {
    return req.method === 'patch' && isTwoSegmentUrl(req)
}
function isGetMany(req) {
    return req.method === 'get' && isSingleSegmentUrl(req)
}
function isDeleteRequest(req) {
    return req.method === 'delete'
}

function translateEntityFrom_1_0_to_0_8(data) {
    const attributes = data.attributes
    const relationships = data.relationships
    delete data.attributes
    delete data.relationships
    delete data.type
    _.forEach(attributes, function (item, key) {
        data[key] = item
    })
    _.forEach(relationships, function (item, key) {
        data.links = data.links || {}
        if (_.isArray(item.data)) {
            data.links[key] = _.map(item.data, function (item) {
                return item.id
            })
            if (_.isEmpty(data.links[key])) {
                delete data.links[key]
            }
        } else {
            data.links[key] = item.data.id
        }
    })
    if (_.isEmpty(data.links)) {
        delete data.links
    }
    return data
}

function transformSingleResourcePayload(req, resourceName, schema) {
    function transformRelationship(item, key) {
        const relationshipSchema = schema.relationships[key].data
        if (_.isArray(relationshipSchema)) {
            return {
                data: _.map(item, function (item) {
                    return {id: item, type: relationshipSchema[0].type}
                })
            }
        } else {
            return {data: {id: item, type: relationshipSchema.type}}
        }
    }

    const payload = {
        type: resourceName
    }
    if (!req.payload[resourceName]) {
        throw new Error('Payload not compatible with JSONAPI 0.8');
    }
    req.payload = req.payload[resourceName][0]
    _.forEach(req.payload, function (item, key) {
        if (key === 'links') {
            _.forEach(item, function (item, key) {
                payload.relationships = payload.relationships || {}
                payload.relationships[key] = transformRelationship(item, key)
            })
        } else if (key === 'id') {
            payload.id = item
        } else if (schema.relationships && schema.relationships[key]) {
            payload.relationships = payload.relationships || {}
            payload.relationships[key] = transformRelationship(item, key)
        } else {
            payload.attributes = payload.attributes || {}
            payload.attributes[key] = item
        }
    })
    req.payload = {data: payload}
}

function transformQuery(req, schema) {
    function transforComparators(value) {
        if (_.isArray(value)) {
            return value.map(transforComparators)
        }
        const split = value.split('=')
        if (split.length > 1) {
            if (split[0] === 'le') {
                split[0] = 'lte'
            } else if (split[0] === 'ge') {
                split[0] = 'gte'
            }
            value = split.join('=')
        }
        return value
    }
    function transformRelationships(key) {
        if(_.startsWith(key, 'links.')){
            return `relationships.${key.replace(/^links\./, '')}.data.id`;
        }
        const relationships = schema.relationships || {};
        if(relationships[key]){
            return `relationships.${key}.data.id`;
        }
        return key;
    }

    return _.reduce(req.query, function (acc, value, key) {
        if (key === 'include' || key === 'sort') {
            acc[key] = value;
        } else if (key === 'limit' || key === 'offset') {
            acc.page = acc.page || {}
            acc.page[key] = value;
        } else {
            acc.filter = acc.filter || {}
            key = transformRelationships(key)
            value = transforComparators(value)
            acc.filter[key] = value
        }
        return acc;
    }, {})
}

function hasMatchingPatchRoute(req) {
    const allRoutes = _(req.server.table()).map('table').flatten().value();
    return !!_.find(allRoutes, function (route) {
        const routeMatcher = '^' + route.path.replace(/\{[^)]*\}/, '[^/]*').split('/').join('\\/') + '$';
        return 'patch' === route.method && req.url.pathname.match(new RegExp(routeMatcher));
    });
}

function hasMatchingSSERoute(req) {
    if (_.last(req.url.pathname.split('/')) !== 'stream') {
        return false;
    }
    const allRoutes = _(req.server.table()).map('table').flatten().value();
    return !!_.find(allRoutes, function (route) {
        return 'get' === route.method && req.url.pathname + 'ing' === route.path;
    });
}

module.exports = {
    translateSseUrlIfRequired: function (schemas, req,reply) {
        if (isJSONAPI_0_8(req) && 'get' === req.method && hasMatchingSSERoute(req)) {
            const transformedQuery = transformQuery(req);
            _.forEach(transformedQuery.filter, function (item, key) {
                delete req.url.query[key]
                if (key === 'resources') {
                    req.url.query[key] = _(item.split(',')).map(function(item) {
                        return inflect.pluralize(item)
                    }).thru(function(items){
                        return items.join(',')
                    }).value()
                } else {
                    req.url.query['attributes.' + key] = item
                }
            });
            req.url.search = '?' + querystring.stringify(req.url.query)

            req.url.protocol = req.connection.info.protocol
            req.url.host = req.info.host
            req.url.pathname += 'ing'
            let originalRequestClosed = false
            const proxyUrl = url.format(req.url);
            const essOptions = {retry: false, headers: _.pick(req.headers, 'last-event-id', 'authorization')};
            const essProxyRequest = ess(proxyUrl, essOptions)
            essProxyRequest.on('data', function (event) {
                const data = JSON.parse(event.data)
                if (_.isObject(data)) {
                    event.data = JSON.stringify(translateEntityFrom_1_0_to_0_8(data))
                }
                reply.event(event)
            }).on('close',function() {
                if (!originalRequestClosed) {
                    reply.event(null)
                }
            }).on('end', function () {
                if (!originalRequestClosed) {
                    reply.event(null)
                }
            }).on('response', function (response) {
                if (response.statusCode !== 200) {
                    originalRequestClosed = true
                    reply().code(response.statusCode)
                }
            })
            req.on('disconnect', function () {
                originalRequestClosed = true
                essProxyRequest.destroy();
            })
            return true
        }
        return false
    },
    translatePutToPatchIfRequired: function (schemas, req) {
        if (isJSONAPI_0_8(req) && 'put' === req.method && hasMatchingPatchRoute(req)) {
            req.setMethod('patch')
            return true
        }
        return false
    },
    translateOptionsIfRequired: function (req) {
        if (isJSONAPI_0_8(req)
            && 'options' === req.method
            && hasMatchingPatchRoute(req)
            && _.get(req, 'headers.access-control-request-method') === 'PUT') {
                _.set(req, 'headers.access-control-request-method', 'PATCH');
                _.set(req, 'polyglot.translatePreflight', 'PUT');
                return true
        }
        return false
    },
    translateRequestIfRequired: function (schemas, req) {
        if (!isTranslationRequired(req)) {
            return req
        }
        var match = req.raw.req.url.match('\/([^/?]*)')
        if (match) {
            const resourceName = match[1]
            const schema = schemas[resourceName]
            if (isSingleResourcePost(req)) {
                transformSingleResourcePayload(req, resourceName, schema)
            } else if (isSingleResourcePatch(req)) {
                if (!req.putToPatch) {
                    transformSingleResourcePayload(req, resourceName, schema)
                }
            } else if (isGetMany(req)) {
                req.query = transformQuery(req, schema);
            }
        }
        return req
    },
    translateResponseIfRequired: function (schemas, request, reply) {
        if(_.get(request, 'polyglot.translatePreflight')){
            _.set(request, 'response.headers.access-control-allow-methods', request.polyglot.translatePreflight)
            return reply
        }

        if (!isTranslationRequired(request) || request.response.statusCode >= 400) {
            return reply
        }
        //console.log('before response transform', JSON.stringify(request.response.source, null, '  '))
        if (isDeleteRequest(request)) {
            return reply
        }
        const data = request.response.source.data
        if (_.isArray(data)) {
            const type = request.raw.req.url.match('\/([^/?]*)')[1];
            request.response.source[type] = data.map(translateEntityFrom_1_0_to_0_8)
        } else {
            request.response.source[data.type] = [translateEntityFrom_1_0_to_0_8(data)]
        }
        request.response.source.linked = _.reduce(request.response.source.included, function (acc, item) {
            acc[item.type] = acc[item.type] || []
            acc[item.type].push(translateEntityFrom_1_0_to_0_8(item))
            return acc
        }, {})
        if (_.isEmpty(request.response.source.linked)) {
            delete request.response.source.linked
        }
        delete request.response.source.data
        delete request.response.source.included
        return reply
    }
}
