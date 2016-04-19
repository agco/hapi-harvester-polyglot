'use strict'

const chai = require('chai')
const expect = chai.expect
const Joi = require('joi')
const utils = require('./utils')
const seeder = require('./seeder')

require('bluebird').longStackTraces();

describe('jsonApiTranslator', function () {
    const schema = {
        brands: {
            type: 'brands',
            attributes: {
                code: Joi.string().min(2).max(10),
                type: Joi.string(),
                year: Joi.number()
            }
        },
        people: {
            type: 'people',
            attributes: {
                name: Joi.string()
            },
            relationships: {
                pets: {
                    data: [{type: 'pets'}]
                },
                soulmate: {
                    data: {type: 'people'}
                }
            }
        },
        pets: {
            type: 'pets',
            attributes: {
                name: Joi.string()
            },
            relationships: {
                owner: {
                    data: {type: 'people'}
                }
            }
        }
    }

    it('should translate POST single resource with relationships', function () {
        const payload = {
            people: [
                {
                    id: 'd7b93612-1820-47e0-b547-0b6e484319c5',
                    name: 'Dilbert',
                    links: {
                        pets: ['a7b93612-1820-47e0-b547-0b6e484319c5', 'b7b93612-1820-47e0-b547-0b6e484319c5']
                    },
                    soulmate: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                }
            ]
        }
        const expectedResponse = {
            people: [
                {
                    name: 'Dilbert',
                    links: {
                        pets: ['a7b93612-1820-47e0-b547-0b6e484319c5', 'b7b93612-1820-47e0-b547-0b6e484319c5'],
                        soulmate: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                    }
                }
            ]
        }
        return server.injectThen({method: 'post', url: '/people', payload: payload, headers: {jsonapiversion: '0.8'}}).then(function (res) {
            expect(res.statusCode).to.equal(201)
            const payload = JSON.parse(res.payload)
            delete payload.people[0].id
            expect(payload).to.eql(expectedResponse)
        })
    })
    it('should translate GET single resource', function () {
        const expectedResponse = {
            people: [
                {
                    links: {
                        pets: [
                            'a7b93612-1820-47e0-b547-0b6e484319c5',
                            'b7b93612-1820-47e0-b547-0b6e484319c5'
                        ],
                        soulmate: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                    },
                    name: 'Dilbert'
                }
            ]
        }
        return server.injectThen({method: 'get', url: '/people/d7b93612-1820-47e0-b547-0b6e484319c5', headers: {jsonapiversion: '0.8'}}).then(function (res) {
            expect(res.statusCode).to.equal(200)
            const payload = JSON.parse(res.payload)
            delete payload.people[0].id
            expect(payload).to.eql(expectedResponse)
        })
    })
    describe('GET by id with include', function () {
        beforeEach(function () {
            return seeder(server).dropCollectionsAndSeed({
                people: [
                    {
                        pets: [
                            'a7b93612-1820-47e0-b547-0b6e484319c5',
                            'b7b93612-1820-47e0-b547-0b6e484319c5'
                        ],
                        soulmate: 'c7b93612-1820-47e0-b547-0b6e484319c5',
                        id: 'd7b93612-1820-47e0-b547-0b6e484319c5',
                        name: 'Dilbert'
                    },
                    {
                        id: 'c7b93612-1820-47e0-b547-0b6e484319c5',
                        name: 'Smok Wawelski'
                    }
                ],
                pets: [
                    {
                        id: 'a7b93612-1820-47e0-b547-0b6e484319c5',
                        name: 'Dogbert'
                    },
                    {
                        id: 'b7b93612-1820-47e0-b547-0b6e484319c5',
                        name: 'Dogcat',
                        owner: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                    }
                ]
            })
        })
        it('should include linked documents', function () {
            const expectedResponse = {
                people: [
                    {
                        id: 'd7b93612-1820-47e0-b547-0b6e484319c5',
                        links: {
                            pets: [
                                'a7b93612-1820-47e0-b547-0b6e484319c5',
                                'b7b93612-1820-47e0-b547-0b6e484319c5'
                            ],
                            soulmate: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                        },
                        name: 'Dilbert'
                    }
                ],
                linked: {
                    people: [
                        {
                            id: 'c7b93612-1820-47e0-b547-0b6e484319c5',
                            name: 'Smok Wawelski'
                        }
                    ],
                    pets: [
                        {
                            id: 'b7b93612-1820-47e0-b547-0b6e484319c5',
                            name: 'Dogcat',
                            links: {
                                owner: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                            }
                        },
                        {
                            id: 'a7b93612-1820-47e0-b547-0b6e484319c5',
                            name: 'Dogbert'
                        }
                    ]
                }
            }
            return server.injectThen(
                {method: 'get', url: '/people/d7b93612-1820-47e0-b547-0b6e484319c5?include=soulmate,pets', headers: {jsonapiversion: '0.8'}})
                .then(function (res) {
                    expect(res.statusCode).to.equal(200)
                    const payload = JSON.parse(res.payload)
                    //expect(_.keys(payload).sort()).to.eql(_.keys(expectedResponse).sort())
                    expect(payload).to.eql(expectedResponse)
                })
        })
    })
    describe('GET many', function () {
        beforeEach(function () {
            return seeder(server).dropCollectionsAndSeed({
                people: [
                    {
                        pets: [
                            'a7b93612-1820-47e0-b547-0b6e484319c5',
                            'b7b93612-1820-47e0-b547-0b6e484319c5'
                        ],
                        soulmate: 'c7b93612-1820-47e0-b547-0b6e484319c5',
                        id: 'd7b93612-1820-47e0-b547-0b6e484319c5',
                        name: 'Dilbert'
                    },
                    {
                        id: 'c7b93612-1820-47e0-b547-0b6e484319c5',
                        name: 'Smok Wawelski'
                    }
                ],
                pets: [
                    {
                        id: 'a7b93612-1820-47e0-b547-0b6e484319c5',
                        name: 'Dogbert'
                    },
                    {
                        id: 'b7b93612-1820-47e0-b547-0b6e484319c5',
                        name: 'Dogcat',
                        owner: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                    }
                ]
            })
        })
        describe('when jsonapiversion is 0.8 but payload is 1.0', function () {
            it('should respond with 400', function () {
                const payload = {
                    data: {
                        id: '4ef2b6ea-7024-4466-ad52-59be17abae9f',
                        type: 'people',
                        attributes: {
                            name: '44'
                        }
                    }
                }
                return server.injectThen({method: 'post', url: '/people', payload: payload, headers: {jsonapiversion: '0.8'}}).then(function (res) {
                    expect(res.statusCode).to.equal(400)
                })
            });
        });
        describe('without includes', function () {
            it('should NOT include linked documents', function () {
                const expectedResponse = {
                    people: [
                        {
                            id: 'd7b93612-1820-47e0-b547-0b6e484319c5',
                            links: {
                                pets: [
                                    'a7b93612-1820-47e0-b547-0b6e484319c5',
                                    'b7b93612-1820-47e0-b547-0b6e484319c5'
                                ],
                                soulmate: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                            },
                            name: 'Dilbert'
                        },
                        {
                            id: 'c7b93612-1820-47e0-b547-0b6e484319c5',
                            name: 'Smok Wawelski'
                        }
                    ]
                }
                return server.injectThen({method: 'get', url: '/people', headers: {jsonapiversion: '0.8'}})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(200)
                        const payload = JSON.parse(res.payload)
                        expect(payload).to.eql(expectedResponse)
                    })
            })
            it('should use query param to determine jsonapiversion: query(1.0) vs header(0.8)', function () {
                const expectedResponse = {
                    data: [
                        {
                            type: 'people',
                            relationships: {
                                lovers: {
                                    data: []
                                },
                                soulmate: {
                                    data: {
                                        type: 'people',
                                        id: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                                    },
                                    links: {
                                        related: '/people/d7b93612-1820-47e0-b547-0b6e484319c5/people'
                                    }
                                },
                                pets: {
                                    data: [
                                        {
                                            type: 'pets',
                                            id: 'a7b93612-1820-47e0-b547-0b6e484319c5'
                                        },
                                        {
                                            type: 'pets',
                                            id: 'b7b93612-1820-47e0-b547-0b6e484319c5'
                                        }
                                    ],
                                    links: {
                                        related: '/people/d7b93612-1820-47e0-b547-0b6e484319c5/pets'
                                    }
                                }
                            },
                            attributes: {
                                name: 'Dilbert'
                            },
                            id: 'd7b93612-1820-47e0-b547-0b6e484319c5'
                        },
                        {
                            type: 'people',
                            relationships: {
                                lovers: {
                                    data: []
                                },
                                pets: {
                                    data: []
                                }
                            },
                            attributes: {
                                name: 'Smok Wawelski'
                            },
                            id: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                        }
                    ]
                }
                return server.injectThen({method: 'get', url: '/people?jsonapiversion=1.0', headers: {jsonapiversion: '0.8'}})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(200)
                        const payload = JSON.parse(res.payload)
                        expect(payload).to.eql(expectedResponse)
                    })
            })
            it('should use query param to determine jsonapiversion: query(0.8) vs header(1.0)', function () {
                const expectedResponse = {
                    people: [
                        {
                            id: 'd7b93612-1820-47e0-b547-0b6e484319c5',
                            links: {
                                pets: [
                                    'a7b93612-1820-47e0-b547-0b6e484319c5',
                                    'b7b93612-1820-47e0-b547-0b6e484319c5'
                                ],
                                soulmate: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                            },
                            name: 'Dilbert'
                        },
                        {
                            id: 'c7b93612-1820-47e0-b547-0b6e484319c5',
                            name: 'Smok Wawelski'
                        }
                    ]
                }
                return server.injectThen({method: 'get', url: '/people?jsonapiversion=0.8', headers: {jsonapiversion: '1.0'}})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(200)
                        const payload = JSON.parse(res.payload)
                        expect(payload).to.eql(expectedResponse)
                    })
            })
        })
        describe('with includes when jsonapiversion is 8.0', function () {
            it('should include linked documents', function () {
                const expectedResponse = {
                    people: [
                        {
                            id: 'd7b93612-1820-47e0-b547-0b6e484319c5',
                            links: {
                                pets: [
                                    'a7b93612-1820-47e0-b547-0b6e484319c5',
                                    'b7b93612-1820-47e0-b547-0b6e484319c5'
                                ],
                                soulmate: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                            },
                            name: 'Dilbert'
                        },
                        {
                            id: 'c7b93612-1820-47e0-b547-0b6e484319c5',
                            name: 'Smok Wawelski'
                        }
                    ],
                    linked: {
                        pets: [
                            {
                                id: 'b7b93612-1820-47e0-b547-0b6e484319c5',
                                name: 'Dogcat',
                                links: {
                                    owner: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                                }
                            },
                            {
                                id: 'a7b93612-1820-47e0-b547-0b6e484319c5',
                                name: 'Dogbert'
                            }
                        ]
                    }
                }
                return server.injectThen({method: 'get', url: '/people?include=soulmate,pets', headers: {jsonapiversion: '0.8'}})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(200)
                        const payload = JSON.parse(res.payload)
                        expect(payload).to.eql(expectedResponse)
                    })
            })
        })
        describe('with includes when jsonapiversion is 1.0', function () {
            it('should include linked documents', function () {
                const expectedResponse = {
                    data: [
                        {
                            type: 'people',
                            relationships: {
                                lovers: {
                                    data: []
                                },
                                soulmate: {
                                    data: {
                                        type: 'people',
                                        id: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                                    },
                                    links: {
                                        related: '/people/d7b93612-1820-47e0-b547-0b6e484319c5/people'
                                    }
                                },
                                pets: {
                                    data: [
                                        {
                                            type: 'pets',
                                            id: 'a7b93612-1820-47e0-b547-0b6e484319c5'
                                        },
                                        {
                                            type: 'pets',
                                            id: 'b7b93612-1820-47e0-b547-0b6e484319c5'
                                        }
                                    ],
                                    links: {
                                        related: '/people/d7b93612-1820-47e0-b547-0b6e484319c5/pets'
                                    }
                                }
                            },
                            attributes: {
                                name: 'Dilbert'
                            },
                            id: 'd7b93612-1820-47e0-b547-0b6e484319c5'
                        },
                        {
                            type: 'people',
                            relationships: {
                                lovers: {
                                    data: []
                                },
                                pets: {
                                    data: []
                                }
                            },
                            attributes: {
                                name: 'Smok Wawelski'
                            },
                            id: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                        }
                    ],
                    included: [
                        {
                            type: 'pets',
                            relationships: {
                                owner: {
                                    data: {
                                        type: 'people',
                                        id: 'c7b93612-1820-47e0-b547-0b6e484319c5'
                                    },
                                    links: {
                                        related: '/pets/b7b93612-1820-47e0-b547-0b6e484319c5/people'
                                    }
                                }
                            },
                            attributes: {
                                name: 'Dogcat'
                            },
                            id: 'b7b93612-1820-47e0-b547-0b6e484319c5'
                        },
                        {
                            type: 'pets',
                            attributes: {
                                name: 'Dogbert'
                            },
                            id: 'a7b93612-1820-47e0-b547-0b6e484319c5'
                        }
                    ]
                }
                return server.injectThen({method: 'get', url: '/people?include=soulmate,pets', headers: {jsonapiversion: '1.0'}})
                    .then(function (res) {
                        expect(res.statusCode).to.equal(200)
                        const payload = JSON.parse(res.payload)
                        expect(payload).to.eql(expectedResponse)
                    })
            })
        })
        describe('with filters', function () {
            describe('when jsonapiversion is 0.8', function () {
                it('should include only matching documents', function () {
                    const expectedResponse = {
                        people: [
                            {
                                id: 'c7b93612-1820-47e0-b547-0b6e484319c5',
                                name: 'Smok Wawelski'
                            }
                        ]
                    }
                    return server.injectThen({method: 'get', url: '/people?name=Smok Wawelski', headers: {jsonapiversion: '0.8'}})
                        .then(function (res) {
                            expect(res.statusCode).to.equal(200)
                            const payload = JSON.parse(res.payload)
                            expect(payload).to.eql(expectedResponse)
                        })
                })
                describe('when nothing matches', function () {
                    it('should return empty array', function () {
                        const expectedResponse = {
                            people: []
                        }
                        return server.injectThen({method: 'get', url: '/people?name=Smok', headers: {jsonapiversion: '0.8'}})
                            .then(function (res) {
                                expect(res.statusCode).to.equal(200)
                                const payload = JSON.parse(res.payload)
                                expect(payload).to.eql(expectedResponse)
                            })
                    })
                })
            });
            describe('when jsonapiversion is 1.0', function () {
                it('should include only matching documents', function () {
                    const expectedResponse = {
                        data: [
                            {
                                attributes: {
                                    name: 'Smok Wawelski'
                                },
                                id: 'c7b93612-1820-47e0-b547-0b6e484319c5',
                                relationships: {
                                    lovers: {
                                        data: []
                                    },
                                    pets: {
                                        data: []
                                    }
                                },
                                type: 'people'
                            }
                        ]
                    }
                    return server.injectThen({method: 'get', url: '/people?filter[name]=Smok Wawelski', headers: {jsonapiversion: '1.0'}})
                        .then(function (res) {
                            expect(res.statusCode).to.equal(200)
                            const payload = JSON.parse(res.payload)
                            expect(payload).to.eql(expectedResponse)
                        })
                })

            });
        })
    })

    describe('Custom routes', function () {
        let customServer

        before(function () {
            this.timeout(5000)
            return utils.buildDefaultServer(schema).then(function (res) {
                customServer = res.server
                customServer.route({
                    method: 'GET',
                    path: '/customRoute',
                    handler: function (req, reply) {
                        reply(JSON.stringify(req.query))
                    }
                })
                customServer.route({
                    method: 'POST',
                    path: '/customRoute',
                    handler: function (req, reply) {
                        reply(req.payload)
                    }
                })
                return seeder(customServer).dropCollections('brands', 'people')
            })
        })

        after(function () {
            return new Promise(function (resolve, reject) {
                customServer.stop(function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                })
            });
        })

        describe('custom POST route', function () {
            it('should NOT translate payload', function () {
                const payload = {
                    query: {
                        filtered: {
                            match_all: {}
                        }
                    },
                    fields: ['name'],
                    size: 11
                }
                return customServer.injectThen({method: 'post', url: '/customRoute', payload: payload, headers: {jsonapiversion: '0.8'}}).then(function (res) {
                    expect(res.statusCode).to.equal(200)
                    expect(res.payload).to.eql(JSON.stringify(payload))
                })
            });

        });
        describe('custom GET route', function () {
            it('should NOT translate query', function () {
                return customServer.injectThen({method: 'get', url: '/customRoute?echo=Ping', headers: {jsonapiversion: '0.8'}}).then(function (res) {
                    expect(res.statusCode).to.equal(200)
                    expect(res.payload).to.eql('{"echo":"Ping"}')
                    return customServer.injectThen({method: 'get', url: '/customRoute?echo=Pong&size=1', headers: {jsonapiversion: '0.8'}})
                }).then(function (res) {
                    expect(res.statusCode).to.equal(200)
                    expect(res.payload).to.eql('{"echo":"Pong","size":"1"}')
                })
            });
        });
        it('should translate POST single resource without relationships on standard route', function () {
            const payload = {
                brands: [
                    {
                        id: '4ef2b6ea-7024-4466-ad52-59be17abae9f',
                        code: '456',
                        type: 'desc',
                        year: 2016
                    }
                ]
            }
            return customServer.injectThen({method: 'post', url: '/brands', payload: payload, headers: {jsonapiversion: '0.8'}}).then(function (res) {
                expect(res.statusCode).to.equal(201)
                const payload = JSON.parse(res.payload)
                expect(payload).to.eql({brands: [{id: '4ef2b6ea-7024-4466-ad52-59be17abae9f', code: '456', type: 'desc', year: 2016}]})
            })
        })
        it('should NOT translate POST single resource without relationships on standard route with jsonapiversion header set to 1.0', function () {
            const payload = {
                data: {
                    id: '5ef2b6ea-7024-4466-ad52-59be17abae9f',
                    type: 'brands',
                    attributes: {
                        code: '456',
                        type: 'desc',
                        year: 2016
                    }
                }
            }
            return customServer.injectThen({method: 'post', url: '/brands', payload: payload, headers: {jsonapiversion: '1.0'}}).then(function (res) {
                expect(res.statusCode).to.equal(201)
                const payload = JSON.parse(res.payload)
                expect(payload).to.eql({
                    data: {
                        attributes: {
                            code: '456',
                            type: 'desc',
                            year: 2016
                        },
                        id: '5ef2b6ea-7024-4466-ad52-59be17abae9f',
                        type: 'brands'
                    }
                })
            })
        })
    });

})
