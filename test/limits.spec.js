'use strict';

const _ = require('lodash')
const expect = require('chai').expect
const supertest = require('supertest-as-promised')
const fixtures = require('./fixtures')
const seeder = require('./seeder.js')


describe('limits', function () {

    beforeEach(function () {
        return seeder(server).dropCollectionsAndSeed(_.pick(fixtures(), 'people', 'pets'))
    })

    describe('limits', function () {
        it('should be possible to tell how many documents to return', function () {
            return supertest(baseUrl).get('/people?limit=1').expect(200).then(function (res) {
                const body = JSON.parse(res.text)
                expect(body.people).to.have.length(1)
            })
        })
    })
})
