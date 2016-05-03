'use strict';

const _ = require('lodash')
const expect = require('chai').expect
const supertest = require('supertest-as-promised')
const fixtures = require('./fixtures')
const seeder = require('./seeder.js')


describe('paging', function () {

    beforeEach(function () {
        return seeder(server).dropCollectionsAndSeed(_.pick(fixtures(), 'people', 'pets'))
    })

    it('should be possible to get page 1', function () {
        return supertest(baseUrl).get('/people?sort=name&offset=0&limit=1').expect(200).then(function (res) {
            const body = JSON.parse(res.text);
            expect(body.people).to.have.length(1);
            expect(_.pluck(body.people, 'name')).to.eql(['Catbert']);
        });
    });

    it('should be possible to get page 2', function () {
        return supertest(baseUrl).get('/people?sort=name&offset=1&limit=1').expect(200).then(function (res) {
            var body = JSON.parse(res.text);
            expect(body.people).to.have.length(1);
            expect(_.pluck(body.people, 'name')).to.eql(['Dilbert']);
        });
    });
});
