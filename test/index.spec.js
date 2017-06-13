/*eslint-env node, mocha */
const _                   = require('ramda');
const expect              = require('chai').expect;

const Awesomize           = require('../index');
const Spec                = require('../lib/spec');
const Check               = require('../lib/check');

const EMPTY_FIELD_FACTORY = _.always({});

describe('awesomize/index.js', () => {

  it('should be a function with an arity of 2', () => {
    expect(Awesomize).to.be.a('function');
    expect(Awesomize.length).to.eql(2);
  });

  it('should require the second parameter to be a function', () => {
    function AwsomizeTest() {
      Awesomize({}, 'not a function');
    }

    expect(AwsomizeTest).to.throw(
      /field_factory parameter must be a function/
    );
  });

  it('should require the first parameter to be an object', () => {
    function AwsomizeTest() {
      Awesomize('not an object', EMPTY_FIELD_FACTORY);
    }

    expect(AwsomizeTest).to.throw(
      /context parameter \(ctx\) must be an object/
    );
  });

  it('should return a function with an arity of 2', () => {
    const actual = Awesomize({}, EMPTY_FIELD_FACTORY);

    expect(actual).to.be.a('function');
    expect(actual.length).to.eql(2);
  });

  it('should call the field factory with the given context', (done) => {

    const expected = { test: 'foo' };

    Awesomize(expected, (v, ctx) => {
      expect(ctx).to.deep.eql(expected);
      done();

      return {};
    });

  });

  it('should require that our field spec be an object', () => {

    const test = () => Awesomize({}, () => null);

    expect(test).to.throw(/field_factory must return an object/);

  });


  it('should expose the Validator.MSG constant.', () => {
    expect(Awesomize.MSG).to.be.a('object');
    expect(Awesomize.MSG.REQUIRED).to.not.be.undefined;
  });


  it('should require a field when the spec denotes it', () => {

    const spec = Awesomize({}, (v) => ({
      read: {
        validate: [ v.required ]
      }
    }));

    return spec({}).then((awesomized) =>
      expect(awesomized.validated.read).to.eql(Awesomize.MSG.REQUIRED)
    );

  });

  it('should throw an error when you specify a validation that is not a ' +
    'function', () => {

      const test = () => Awesomize({}, (v) => ({
        read: {
          validate: [ v.thisDoesNotExist ]
        }
      }));

      expect(test).to.throw(/Invalid validation test for key: <read>/);

    });

  it('should not return an error is an optional parameter is omitted', () => {

    const test = Awesomize({}, (v) => ({
      foo: {
        validate: [ v.isArray ]
      }
    }));

    return test({}).then((results) =>
      expect(Awesomize.Result.hasError(results)).to.be.false
    );

  });


  it('should not run the normalize function when validaiton fails', () => {

    const spec = Awesomize({}, (v) => ({
      foo: {
        validate: [ v.required, _.always('invalid') ]
      , normalize: [ _.always('damn!') ]
      }
    }));

    const test = { foo: 'blah' };

    return spec(test, {}).then((result) => {
      expect(result.validated.foo).to.eql('invalid');
      expect(result.data.foo).to.eql('blah');
    });

  });


  it('should return an AwesomeResponse', () => {

      const spec = Awesomize({}, (v) => ({
        foo: {
          sanitize: [ _.toUpper, _.trim ]
        , validate: [ v.required ]
        , normalize: [ _.replace(/-/g, '_') ]
        }

      , moo: {
          read: _.path([ 'boo', 'foo' ])
        , sanitize: [ _.toUpper, _.trim ]
        , validate: [ v.required ]
        }
      , bar: {
          sanitize: [ _.toLower, _.replace(/-/g,'_') ]
        , validate: [ v.required ]
        , normalize: [ _.trim ]
        }
      , yes: {
          read: (request, current) =>
            (current.yes === 'horseshit' ? 'bullshit' : 'noshit')
        }
      , baz: {
          validate: [ v.isArray ]
        }
      }));

      const test = {
        foo: 'foo-bar'
      , boo: { foo: ' foofoo ' }
      , bar: ' BAR-BAR-bar '
      };

      const cur = {
        yes: 'horseshit'
      };

      return spec(test, cur).then((result) => {
        const expected = {
          request: {
            foo: 'foo-bar'
          , boo: { foo: ' foofoo ' }
          , bar: ' BAR-BAR-bar '
          }
        , current: {
            yes: 'horseshit'
          }
        , data: {
            foo: 'FOO_BAR'
          , moo: 'FOOFOO'
          , bar: 'bar_bar_bar'
          , yes: 'bullshit'
          , baz: undefined
          }
        , validated: {
            foo: null
          , moo: null
          , bar: null
          , yes: null
          , baz: null
          }

        };

        expect(result).to.deep.eql(expected);
      });
  });

  it('should return a PropsCheckError', () => {

      const test = () => Awesomize({}, (v) => ({
        foo: {
          sanitizing: [ _.toUpper, _.trim ]
        , validator: [ v.required ]
        , normalizer: [ _.replace(/-/g, '_') ]
        }
      }));

      expect(test).to.throw(/sanitizing <-> sanitize/);
      expect(test).to.throw(/validator <-> validate/);
      expect(test).to.throw(/normalizer <-> normalize/);
  });

  describe('Validation of the Awesomize Spec Spec', () => {

    it('should catch failures', () => {
      const spec = Awesomize({}, Spec);
      const test = {
        read: 'not a function'
        , sanitize: { not: 'an array' }
        , validate: 'not an array'
        , normalize: 13245
      };

      return spec(test).then((result) => {
        expect(result.validated.read).to.eql(Awesomize.MSG.NOT_FUNCTION);
        expect(result.validated.sanitize).to.eql(Awesomize.MSG.NOT_ARRAY);
        expect(result.validated.validate).to.eql(Awesomize.MSG.NOT_ARRAY);
        expect(result.validated.normalize).to.eql(Awesomize.MSG.NOT_ARRAY);
      });
    });

    it('should allow pass a properly formatted spec', () => {
      const spec = Awesomize({}, Spec);
      const test = {
        read: _.prop('foo')
        , sanitize: [ _.trim ]
        , validate: [ Check.required ]
        , normalize: [ _.toUpper ]
      };

      return spec(test).then((result) => {
        expect(result.validated.read).to.be.null;
        expect(result.validated.sanitize).to.be.null;
        expect(result.validated.validate).to.be.null;
        expect(result.validated.normalize).to.be.null;
      });
    });


    it('should catch one of the items not being a function', () => {

      const spec = Awesomize({}, Spec);
      const test = {
        read: _.prop('foo')
        , sanitize: [ _.trim ]
        , validate: [ Check.required, Check.thisDoesNotExist, Check.isArray ]
        , normalize: [ _.toUpper ]
      };

      return spec(test).then((result) => {
        expect(result.validated.read).to.be.null;
        expect(result.validated.sanitize).to.be.null;
        expect(result.validated.validate).to.eql(Check.MSG.LIST_ITEM_NOT_SPEC);
        expect(result.validated.normalize).to.be.null;
      });

    });

  });


  describe('::Result::hasError', () => {

    it('should return true when there is an error', () => {
      const spec = Awesomize({}, Spec);
      const test = {
        read: 'fubar'
      };

      return spec(test).then((result) =>
        expect(Awesomize.Result.hasError(result)).to.be.true
      );

    });

    it('should return false when an error is not present', () => {
      const spec = Awesomize({}, Spec);
      const test = {
        read: _.prop('foo')
        , sanitize: [ _.trim ]
        , validate: [ Check.required ]
        , normalize: [ _.toUpper ]
      };

      return spec(test).then((result) =>
        expect(Awesomize.Result.hasError(result)).to.be.false
      );
    });

  });


  describe('::dataOrError', () => {

    it('should return the sanitized/normalized data', () => {

      const e = (v) => { throw v; };
      const spec = Awesomize.dataOrError(e)({}, (v) => ({
        foo: {
          sanitize: [ _.toUpper, _.trim ]
        , validate: [ v.required ]
        , normalize: [ _.replace(/-/g, '_') ]
        }
      }));


      const request = {
        foo: ' foo-bar '
      };

      return spec(request).then((data) =>
        expect(data.foo).to.eql('FOO_BAR')
      );

    });


    it('should run the sanitize and normalize method', () => {

      const error = (e) => { throw e; }

      const spec = Awesomize.dataOrError(error)({}, (v) => ({
        foo: {
          sanitize: [ _.toUpper, _.trim ]
        , validate: [ v.required ]
        , normalize: [ _.replace(/-/g, '_') ]
        }

      , moo: {
          read: _.path([ 'boo', 'foo' ])
        , sanitize: [ _.toUpper, _.trim ]
        , validate: [ v.required ]
        }
      , bar: {
          sanitize: [ _.toLower, _.replace(/-/g,'_') ]
        , validate: [ v.required ]
        , normalize: [ _.trim ]
        }
      , baz: {
          validate: [ v.isArray ]
        }
      }));

      const test = {
        foo: 'foo-bar'
      , boo: { foo: ' foofoo ' }
      , bar: ' BAR-BAR-bar '
      };

      return spec(test).then((result) => {
        expect(result.moo).to.eql('FOOFOO');
        expect(result.bar).to.eql('bar_bar_bar');
        expect(result.baz).to.be.undefined;
      });

    });


    it ('should call sanitize before validate', () => {

      const error = (e) => { throw e; };

      const spec = Awesomize.dataOrError(error)({}, (v) => ({
        foo: {
          read: _.pathOr(0, [ 'foo', 'bar' ])
        , sanitize: [ _.toString ]
        , validate: [ v.isInt ]
        }
      }));

      const test = {
        foo: {}
      , bar: 'barfoo'
      };

      return spec(test).then(result => {
        expect(result.foo).to.equal('0')
      });

    });


    it('should return a promise of the awesomized data', () => {

      const error = (e) => { throw e; }

      const spec = Awesomize.dataOrError(error)({}, (v) => ({
        foo: {
          validate: [ v.required ]
        }
      , bar: {
          validate: [ v.required ]
        }
      , baz: {
          validate: [ v.isArray ]
        }
      }));

      const test = {
        foo: 'foofoo'
        , bar: 'barbar'
      };

      return spec(test).then((result) => {
        expect(result.foo).to.eql('foofoo');
        expect(result.bar).to.eql('barbar');
        expect(result.baz).to.be.undefined;
      });

    });

    it('should call the error method when an error occurs', () => {

      const error    = (validation) => {
        const e      = new Error('ValidationError');
        e.validation = validation;

        throw e;
      };

      const spec = Awesomize.dataOrError(error)({}, (v) => ({
        foo: {
          validate: [ v.required ]
        }
      , bar: {
          validate: [ v.required ]
        }
      , baz: {
          validate: [ v.isArray ]
        }
      }));

      return spec({}).then(() => { throw "Unexpected Success!" })

      .catch((e) => {
        expect(e.validation.foo).to.eql(Awesomize.MSG.REQUIRED);       
        expect(e.validation.bar).to.eql(Awesomize.MSG.REQUIRED);       
        expect(e.validation.baz).to.be.null;
      });

    });

  });

});
