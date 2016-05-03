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

describe('EventSource implementation for multiple resources', function () {

    describe('Server Sent Events', function () {
        this.timeout(20000);
        let lastEventId
        let sseServer
        let baseUrl

        var sendAndCheckSSE = function(resources, payloads, done) {
            var index = 0;
            var eventSource = ess(baseUrl + '/changes/stream?resources=' + resources.join(','), {retry : false})
            .on('data', function(res, id) {
                lastEventId = res.id;
                var data = JSON.parse(res.data);
                var expectedEventName = resources[index] + 's_i';
                //ignore ticker data
                if(_.isNumber(data)) {

                    //post data after we've hooked into change events and receive a ticker
                    return Promise.map(payloads, function(payload) {
                        return seeder(sseServer).seed(payload);
                    }, {concurrency : 1});

                }

                expect(res.event.trim()).to.equal(expectedEventName);
                expect(_.omit(data, 'id')).to.deep.equal(payloads[index][resources[index] + 's'][0]);
                if(index === payloads.length - 1) {
                    done();
                    eventSource.destroy();
                }

                index++;
            });
        }

        before(function () {
            const schema = {
                bookas: {
                    type: 'bookas',
                    attributes: {
                        name: Joi.string()
                    }
                },
                bookbs: {
                    type: 'bookbs',
                    attributes: {
                        name: Joi.string()
                    }
                }
            };
            const port = 8020;
            baseUrl = 'http://localhost:' + port
            return utils.buildServer(schema, {port: port}).then(function (res) {
                sseServer = res.server
                return seeder(sseServer).dropCollections('bookas', 'bookbs')
            });
        });

        describe('Given a resources A' +
            '\nAND base URL base_url' +
            '\nWhen a GET is made to base_url/changes/stream?resources=A', function () {
            it('Then all events for resource A streamed back to the API caller ', function (done) {
                var payloads = [{
                    bookas: [
                        {
                            name: 'test name 1'
                        }
                    ]
                }];
                sendAndCheckSSE(['booka'], payloads, done);
            });
        });

        describe('Given a list of resources A, B, C' +
            '\nAND base URL base_url' +
            '\nWhen a GET is made to base_url/changes/stream?resources=A,B,C ', function () {
            it('Then all events for resources A, B and C are streamed back to the API caller ', function (done) {
                var payloads = [{
                    bookas: [
                        {
                            name: 'test name 1'
                        }
                    ]
                },
                    {
                        bookbs: [
                            {
                                name: 'test name 2'
                            }
                        ]
                    }];
                sendAndCheckSSE(['booka', 'bookb'], payloads, done);
            });
        });

        describe('Given a list of resources A, B, C' +
            '\nAND base URL base_url' +
            '\nWhen a GET is made to base_url/changes/stream?resources=A,B,C ', function () {
            it('Then all events for resources A, B and C are streamed back to the API caller ', function (done) {
                var payloads = [{
                        bookas: [
                            {
                                name: 'test name 1'
                            }
                        ]
                },
                    {
                        bookbs: [
                            {
                                name: 'test name 2'
                            }
                        ]
                    }];
                sendAndCheckSSE(['booka', 'bookb'], payloads, done);
            });
        });

        describe('Given a list of resources A, B, C' +
            '\nAND base URL base_url' +
            '\nWhen a GET is made to base_url/changes/stream?resources=A,D ', function () {
            it('Then a 400 HTTP error code and a JSON API error specifying the invalid resource are returned to the API caller ', function () {
                return supertest(baseUrl)
                    .get('/changes/stream?resources=booka,wrongResource')
                    .expect(400)
                    .then()
            });
        });

        describe('Given a list of resources A, B, C' +
            '\nAND base URL base_url' +
            '\nWhen a GET is made to base_url/changes/stream', function () {
            it('Then a 400 HTTP error code and a JSON API error specifying the invalid resource are returned to the API caller ', function () {
                return supertest(baseUrl)
                    .get('/changes/stream')
                    .expect(400)
                    .then()
            });
        });

        describe('Given a list of resources A, B, C' +
            '\nAND base URL base_url' +
            '\nWhen a GET is made to base_url/changes/stream?resources=A,B ', function () {
            it('Then a 400 HTTP error code and a JSON API error indicating the timestamp is invalid are returned to the API caller. ', function () {
                return supertest(baseUrl)
                    .get('/changes/stream?resources=booka,bookb')
                    .set('Last-Event-ID', '1234567_wrong')
                    .expect(400)
                    .then()
            });
        });
    });
});
