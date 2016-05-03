'use strict';

const _ = require('lodash')
const expect = require('chai').expect
const should = require('should')
const supertest = require('supertest-as-promised')
const fixtures = require('./fixtures')
const seeder = require('./seeder.js')

describe('filters', function () {

    let ids

    beforeEach(function () {
        return seeder(server).dropCollectionsAndSeed(_.pick(fixtures(), 'people', 'pets')).then((_ids)=>ids = _ids)
    })

    it('should allow top-level resource filtering for collection routes', function () {
        return supertest(baseUrl).get('/people?name=Dilbert').expect('Content-Type', /json/).expect(200).then(function (response) {
            const body = JSON.parse(response.text)
            body.people.length.should.equal(1)
        })
    })

    it('should allow top-level resource filtering based on a numeric value', function () {
        return supertest(baseUrl).get('/people?appearances=1934').expect('Content-Type', /json/).expect(200).then(function (response) {
            const body = JSON.parse(response.text)
            body.people.length.should.equal(1)
        })
    })
    it('should allow combining top-level resource filtering for collection routes based on string & numeric values', function () {
        return supertest(baseUrl).get('/people?name=Dilbert&appearances=3457').expect('Content-Type', /json/).expect(200).then(function (response) {
            const body = JSON.parse(response.text)
            body.people.length.should.equal(1)
        })
    })
    it('*skipped in HarvesterJS: should allow resource sub-document filtering based on a numeric value')
    it('*skipped in HarvesterJS: should be possible to filter related resources by ObjectId')
    it('*skipped in HarvesterJS: should support filtering by id for one-to-one relationships')
    it('*skipped in HarvesterJS: should support `in` query')
    it('*skipped in HarvesterJS: should support $in query against one-to-one refs')
    it('*skipped in HarvesterJS: should support $in query against many-to-many refs')
    it('*skipped in HarvesterJS: should support $in query against external refs values')
    it('*skipped in HarvesterJS: should be able to run $in query against nested fields')
    it('*skipped in HarvesterJS: should be able to run in query against links')
    it('*skipped in HarvesterJS: should support or query')
    it('should support lt query', function () {
        return supertest(baseUrl).get('/people?appearances=lt=1935').expect(200).then(function (res) {
            const body = JSON.parse(res.text)
            expect(body.people).to.have.length(2)
            expect(body.people[0].name).to.equal('Wally')
        })
    })
    it('should support le query', function () {
        return supertest(baseUrl).get('/people?appearances=le=1934').expect(200).then(function (res) {
            var body = JSON.parse(res.text)
            expect(body.people).to.have.length(2)
            expect(body.people[0].name).to.equal('Wally')
        })
    })
    it('should support gt query', function () {
        return supertest(baseUrl).get('/people?appearances=gt=1935').expect(200).then(function (res) {
            const body = JSON.parse(res.text)
            expect(body.people).to.have.length(1)
            expect(body.people[0].name).to.equal('Dilbert')
        })
    })
    it('should support ge query', function () {
        return supertest(baseUrl).get('/people?appearances=ge=3457').expect(200).then(function (res) {
            const body = JSON.parse(res.text)
            expect(body.people).to.have.length(1)
            expect(body.people[0].name).to.equal('Dilbert')
        })
    })
    it('should have id filter', function () {
        return supertest(baseUrl).get('/people?id=' + ids.people[0]).expect(200).then(function (res) {
            const body = JSON.parse(res.text)
            expect(body.people).to.have.length(1)
            expect(body.people[0].id).to.equal(ids.people[0])
        })
    })
    it('should convert a range query with lt= and gt= into a mongo query object', function () {
        var testUrl = '/pets?limit=100&adopted=ge=2015-10-08T18:40:28.000Z&adopted=le=2015-10-16T21:40:28.000Z'
        return supertest(baseUrl).get(testUrl).expect(200).then(function (res) {
            const body = JSON.parse(res.text)
            expect(body.pets).to.have.length(2)
        })
    })

})
