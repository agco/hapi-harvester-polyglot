'use strict';

const utils = require('./utils')
const Joi = require('joi')
const Promise = require('bluebird')

Promise.longStackTraces()

before(function () {
    const schema = {
        people: {
            type: 'people',
            attributes: {
                name: Joi.string().required().description('name'),
                appearances: Joi.number().required().description('appearances')
            },
            relationships: {
                pets: {data: [{type: 'pets'}]},
                soulmate: {data: {type: 'people', inverse: 'soulmate'}},
                lovers: {
                    data: [
                        {type: 'people', inverse: 'lovers'}
                    ]
                }
            }
        },
        pets: {
            type: 'pets',
            attributes: {
                name: Joi.string().required().description('name'),
                appearances: Joi.number().required().description('appearances'),
                adopted: Joi.date()
            },
            relationships: {
                owner: {data: {type: 'people'}},
                food: {data: {type: 'foobars'}}
            }
        },
        collars: {
            type: 'collars',
            attributes: {
                name: Joi.string().required().description('name')
            },
            relationships: {
                collarOwner: {data: {type: 'pets'}}
            }
        },
        foobars: {
            type: 'foobars',
            attributes: {
                foo: Joi.string().required().description('name')
            }
        }
    }
    this.timeout(5000)
    return utils.buildDefaultServer(schema).then(function (res) {
        global.server = res.server;
        global.harvester = res.harvester;
        global.baseUrl = `http://localhost:${res.server.info.port}`
    })
})
