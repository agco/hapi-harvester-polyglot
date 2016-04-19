'use strict'

const _ = require('lodash')
const expect = require('chai').expect
const supertest = require('supertest-as-promised')
const fixtures = require('./fixtures')
const seeder = require('./seeder.js')

describe('sorting', function () {

    beforeEach(function () {
        return seeder(server).dropCollectionsAndSeed(_.pick(fixtures(), 'people', 'pets'))
    })

    it('should be possible to sort by name', function () {
        return supertest(baseUrl).get('/people?sort=name').expect(200).then(function (res) {
            const body = JSON.parse(res.text)
            expect(_.pluck(body.people, 'name')).to.eql(['Catbert', 'Dilbert', 'Wally'])
        })
    })

    it('should be possible to sort by name desc', function () {
        return supertest(baseUrl).get('/people?sort=-name').expect(200).then(function (res) {
            const body = JSON.parse(res.text)
            expect(_.pluck(body.people, 'name')).to.eql(['Wally', 'Dilbert', 'Catbert'])
        })
    })

    it('should be possible to sort by appearances', function () {
        return supertest(baseUrl).get('/people?sort=appearances').expect(200).then(function (res) {
            var body = JSON.parse(res.text)
            expect(_.pluck(body.people, 'name')).to.eql(['Catbert', 'Wally', 'Dilbert'])
        })
    })
})
