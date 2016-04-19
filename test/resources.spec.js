'use strict'

const should = require('should')
const expect = require('chai').expect
const _ = require('lodash')
const Promise = require('bluebird')
const supertest = require('supertest-as-promised')
const fixtures = require('./fixtures')
const seeder = require('./seeder.js')


describe('resources', function () {

    let ids
    const seed = _.pick(fixtures(), 'people', 'pets')

    beforeEach(function () {
        return seeder(server).dropCollectionsAndSeed(seed).then((_ids)=>ids = _ids)
    })

    describe('getting a list of resources', function () {
        _.each(_.keys(seed), function (key) {
            it('in collection "' + key + '"', function () {
                return supertest(baseUrl).get('/' + key).expect('Content-Type', /json/).expect(200).then(function (response) {
                    const body = JSON.parse(response.text)
                    ids[key].forEach(function (id) {
                        _.contains(_.pluck(body[key], 'id'), id).should.equal(true)
                    })
                })
            })
        })
    })

    describe('getting each individual resource', function () {
        _.each(_.keys(seed), function (key) {
            it('in collection "' + key + '"', function () {
                return Promise.all(ids[key].map(function (id) {
                    return supertest(baseUrl).get('/' + key + '/' + id).expect('Content-Type', /json/).expect(200).then(function (response) {
                        const body = JSON.parse(response.text)
                        body[key].forEach(function (resource) {
                            (resource.id).should.equal(id)
                        })
                    })
                }))
            })
        })
    })

    describe('posting a duplicate resource', function () {
        it('in collection "people"', function () {
            const body = {people: []}
            body.people.push(_.cloneDeep(fixtures().people[0]))
            body.people[0].id = ids.people[0]
            return Promise.map([ids.people[0]], function () {
                return supertest(baseUrl).post('/people').send(body).expect('Content-Type', /json/).expect(409).then(function (response) {
                    should.exist(response.error)
                })
            })
        })
    })

    //TODO I don't think we support namespaces in hapi-harvester
    describe.skip('posting a resource with a namespace', function () {
        it('should post without a special key', function () {
            const cat = {
                name: 'Spot', hasToy: true, numToys: 0
            }, body = {cats: []}
            body.cats.push(cat)
            return supertest(baseUrl).post('/animals/cats').send(body).expect('Content-Type', /json/).expect(201)
        })
    })

    describe('putting a resource', function () {
        it('should get updated entity', function () {
            const person = fixtures().people[0];
            person.name = 'PapaJoe'
            return supertest(baseUrl)
                .put('/people/' + ids.people[0])
                .send({people: [person]})
                .expect('Content-Type', /json/)
                .expect(200)
                .then(function (res) {
                    expect(res.body).to.have.deep.property('people.0.name', 'PapaJoe')
                });
        });
    });

})
