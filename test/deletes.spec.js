'use strict'

const _ = require('lodash')
const should = require('should')
const supertest = require('supertest-as-promised')
const fixtures = require('./fixtures')
const seeder = require('./seeder.js')

describe('deletes', function () {

    let ids

    beforeEach(function () {
        return seeder(server).dropCollectionsAndSeed(_.pick(fixtures(), 'people', 'pets')).then((_ids)=>ids = _ids)
    })

    it('Should handle deletes with a 204 statusCode', function () {
        return supertest(baseUrl).del('/people/' + ids.people[0], {json: {}}).expect(204)
    })
})
