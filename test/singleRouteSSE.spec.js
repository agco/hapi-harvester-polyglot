'use strict';

const utils = require('./utils')
const fixtures = require('./fixtures')
const expect = require('chai').expect;
const seeder = require('./seeder.js')
const supertest = require('supertest-as-promised')
const ess = require('agco-event-source-stream');
const _ = require('lodash')
const config = require('./config.js')
const Joi = require('joi')
const Promise = require('bluebird')

describe('EventSource implementation for resource changes', function () {

    let sseServer
    let baseUrl

    describe('Server Sent Events', function () {
        this.timeout(20000);
        let lastEventId;

        before(function () {
            const schema = {
                books: {
                    type: 'books',
                    attributes: {
                        title: Joi.string(),
                        author: Joi.string()
                    }
                },
                superHeros: {
                    type: 'superHeros',
                    attributes: {
                        timestamp: Joi.number()
                    }
                },
                dvds: {
                    type: 'dvds',
                    attributes: {
                        title: Joi.string()
                    }
                }
            };
            const port = 9005;
            baseUrl = 'http://localhost:' + port
            return utils.buildServer(schema, {port: port}).then(function (res) {
                sseServer = res.server
                return seeder(sseServer).dropCollections('books', 'dvds', 'superHeros')
            });
        });

        after(function () {
            return new Promise(function (resolve, reject) {
                sseServer.stop(function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                })
            });
        })

        describe('When I post to the newly created resource', function () {
            it('Then I should receive a change event with data but not the one before it', function (done) {
                const eventSource = ess(baseUrl + '/books/changes/stream', {retry : false})
                .on('data', function(res) {
                    lastEventId = res.id;
                    const data = JSON.parse(res.data);
                    //ignore ticker data
                    if (_.isNumber(data)) {
                        //post data after we've hooked into change events and receive a ticker
                        return seeder(sseServer).seed({
                            books: [
                                {
                                    title: 'test title 2'
                                }
                            ]
                        });
                    }
                    expect(res.event.trim()).to.equal('books_i');
                    expect(_.omit(data, 'id')).to.deep.equal({title: 'test title 2'});
                    done();
                    eventSource.destroy();
                });
            });
        });

        describe('When I post resource with uppercased characters in name', function () {
            it('Then I should receive a change event', function (done) {
                    let seeded;
                    const eventSource = ess(baseUrl + '/superHeros/changes/stream', {retry: false})
                        .on('data', function (data) {
                            data = JSON.parse(data.data);
                            if (_.isNumber(data)) {
                                if (!seeded) {
                                    seeded = true
                                    seeder(sseServer).seed({
                                        superHeros: [
                                            {
                                                timestamp: 123
                                            }
                                        ]
                                    });
                                }
                                return
                            }
                            expect(_.omit(data, 'id')).to.deep.equal({timestamp: 123});
                            done();
                            eventSource.destroy();
                        })
                }
            );
        });

        describe('when I ask for events with ids greater than a certain id with filters enabled', function () {
            it('I should get only one event without setting a limit', function (done) {
                seeder(sseServer).seed({
                    books: [
                        {
                            title: 'test title 3'
                        },
                        {
                            title: 'filtered'
                        },
                        {
                            title: 'filtered',
                            author: 'Asimov'
                        }
                    ]
                });
                const eventSource = ess(baseUrl + '/books/changes/stream?title=filtered&author=Asimov&limit=100', {retry : false, headers : {
                    'Last-Event-ID' : lastEventId
                }
                }).on('data', function (res) {
                    lastEventId = res.id;
                    const data = JSON.parse(res.data);
                    //ignore ticker data
                    if(_.isNumber(data)) return;
                    expect(_.omit(data, 'id')).to.deep.equal({title : 'filtered', author : 'Asimov'});
                    done();
                    eventSource.destroy();
                });
            });
        });

        describe('when I ask for events with ids greater than a certain id', function () {
            it('I should get only one event without setting a limit', function (done) {
                seeder(sseServer).seed({
                    books: [
                        {
                            title: 'test title 3'
                        }
                    ]
                });
                const eventSource = ess(baseUrl + '/books/changes/stream', {
                    retry: false, headers: {
                        'Last-Event-ID': lastEventId
                    }
                }).on('data', function (res) {
                    const data = JSON.parse(res.data);
                    //ignore ticker data
                    if (_.isNumber(data)) {
                        return;
                    }
                    expect(_.omit(data, 'id')).to.deep.equal({title: 'test title 3'});
                    done();
                    eventSource.destroy();
                });
            });
        });

        describe('Given a resource x with property y ' +
            '\nWhen the value of y changes', function () {
            it('Then an SSE is broadcast with event set to x_update, ID set to the oplog timestamp' +
                'and data set to an instance of x that contains document id and new value for property y', function (done) {

                const payloads = [
                    {
                        books: [{
                            title: 'test title 4',
                            author: 'Asimov'
                        }]
                    },
                    {
                        books: [{
                            title: 'test title 5'
                        }]
                    }
                ];
                supertest(baseUrl).post('/books').send(payloads[0]).expect(201).then(function (res) {
                    let counter = 0;
                    const documentId = res.body.books[0].id;
                    const expected = {
                        id: documentId,
                        title: payloads[1].books[0].title
                    };

                    const eventSource = ess(baseUrl + '/books/changes/stream', {retry: false})
                        .on('data', function (data)
                        {
                            data = JSON.parse(data.data);
                            if (counter === 0) {
                                supertest(baseUrl).put('/books/' + documentId).send(payloads[1]).expect(200).then()
                            }
                            if (counter === 1) {
                                expect(data).to.deep.equal(expected);
                            }
                            if (counter === 2) {
                                done();
                                eventSource.destroy();
                            }
                            counter++;
                        });
                });
            });
        });


        describe('When I update collection document directly through mongodb adapter', function ()
        {
            let documentId;

            before(function(done)
            {
                seeder(sseServer).seed({
                    books: [
                        {
                            title: 'The Bourne Identity',
                            author: 'Robert Ludlum'
                        }
                    ]
                }).then(function (result)
                {
                    documentId = result.books[0];
                    done();
                });
            });

            it('Then SSE should broadcast event with data containing properties that has been changed', function (done) {
                const expected = {
                    id: documentId,
                    title: 'The Bourne Supremacy'
                };
                let counter = 0;
                const eventSource = ess(baseUrl + '/books/changes/stream', {retry: false})
                    .on('data', function (data) {
                        data = JSON.parse(data.data);
                        if (0 === counter) {
                            counter++
                            sseServer.plugins['hapi-harvester'].adapter.models.books.findOneAndUpdate({_id: documentId},
                                {'attributes.title': 'The Bourne Supremacy'},
                                function () {
                                    counter++
                                })
                        }

                        if (2 === counter) {
                            expect(data).to.deep.equal(expected);
                            counter++
                        }
                        if (3 === counter) {
                            done();
                            eventSource.destroy();
                        }
                    });
            });
        });
    });
});
