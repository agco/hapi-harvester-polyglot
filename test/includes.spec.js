'use strict'

const _ = require('lodash')
const expect = require('chai').expect
const supertest = require('supertest-as-promised')
const fixtures = require('./fixtures')
const seeder = require('./seeder.js')


describe('includes', function () {

    function setupLinks(ids) {

        function link(url, path, type, value) {
            var data = {
                [type]: [
                    {
                        links: {
                            [path]: value
                        }
                    }
                ]
            }

            return supertest(baseUrl).put(url).set('Content-Type', 'application/json').send(JSON.stringify(data)).expect(200)
                .then()
                .delay(100)//sometimes tests fail if resolve is called immediately, probably mongo has problems indexing concurrently
        }

        return Promise.all([
            link('/people/' + ids.people[0], 'soulmate', 'people', ids.people[1]),
            link('/people/' + ids.people[1], 'soulmate', 'people', ids.people[0]),
            link('/people/' + ids.people[0], 'lovers', 'people', [ids.people[1]]),
            link('/pets/' + ids.pets[0], 'owner', 'pets', ids.people[0]),
            link('/pets/' + ids.pets[0], 'food', 'pets', ids.foobars[0]),
            link('/collars/' + ids.collars[0], 'collarOwner', 'collars', ids.pets[0])
        ])
    }


    beforeEach(function () {
        return seeder(server).dropCollectionsAndSeed(_.pick(fixtures(), 'people', 'pets', 'collars', 'foobars')).then(setupLinks)
    })

    describe('many to many', function () {
        it('should include referenced lovers when querying people', function () {
            return supertest(baseUrl).get('/people?include=lovers').expect(200).then(function (res) {
                const body = JSON.parse(res.text)
                expect(body).to.not.have.property('linked')
            })
        })
    })

    describe('one to one', function () {
        it('should include soulmate when querying people', function () {
            return supertest(baseUrl).get('/people?include=soulmate&id=c344d722-b7f9-49dd-9842-f0a375f7dfdc').expect(200).then(function (res) {
                const body = JSON.parse(res.text)
                expect(body.linked).to.be.an.Object
                expect(body.linked.people).to.be.an.Array
                expect(body.linked.people).to.have.length(1)
            })
        })
    })

    describe('repeated entities', function () {
        it('should deduplicate included soulmate & lovers when querying people', function () {
            return supertest(baseUrl).get('/people?include=soulmate,lovers&id=c344d722-b7f9-49dd-9842-f0a375f7dfdc').expect(200).then(function (res) {
                const body = JSON.parse(res.text)
                expect(body.linked).to.be.an.Object
                expect(body.linked.people).to.be.an.Array
                var log = {}
                _.each(body.linked.people, function (person) {
                    expect(log).to.not.have.property(person.id)
                    log[person.id] = person
                })
            })
        })
    })

    describe('compound documents', function () {
        it('should include pet and person when querying collars', function () {
            return supertest(baseUrl)
                .get('/collars?include=collarOwner.owner.soulmate,collarOwner.food,collarOwner,collarOwner.owner')
                .expect(200)
                .then(function (res) {
                    const body = JSON.parse(res.text)
                    expect(body.linked).to.be.an.Object
                    expect(body.linked.pets).to.be.an.Array
                    expect(body.linked.pets).to.have.length(1)
                    expect(body.linked.people).to.be.an.Array
                    expect(body.linked.people).to.have.length(2)
                    expect(body.linked.foobars).to.be.an.Array
                    expect(body.linked.foobars).to.have.length(1)
                })
        })
    })
})
