/**
 * Copyright 2016, Yahoo! Inc.
 * Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import Ember from 'ember';
import ValidationResultCollection from './result-collection';
import ValidationError from './error';
import { hasEmberData } from '../utils/utils';

const {
  get,
  set,
  isNone,
  isArray,
  computed,
  canInvoke,
  makeArray,
  setProperties,
  getProperties,
  defineProperty,
  A: emberArray
} = Ember;

const {
  and,
  not
} = computed;

/**
 * This class is `private` and is only used by {{#crossLink 'ResultCollection'}}{{/crossLink}}
 * @module Validations
 * @class Result
 * @private
 */

var ValidationsObject = Ember.Object.extend({
  model: null,
  isValid: true,
  isValidating: false,
  message: null,
  attribute: '',

  attrValue: undefined,
  _promise: undefined,

  init() {
    this._super(...arguments);
    var attribute = get(this, 'attribute');
    // TODO: Not good practice. Stef will make this go away.
    defineProperty(this, 'attrValue', computed.oneWay(`model.${attribute}`));
  },

  isNotValidating: not('isValidating'),
  isInvalid: not('isValid'),
  isTruelyValid: and('isNotValidating', 'isValid'),

  isAsync: computed('_promise', function() {
    var promise = get(this, '_promise');
    return !isNone(promise) && canInvoke(promise, 'then');
  }),

  isDirty: computed('attrValue', function() {
    var model = get(this, 'model');
    var attribute = get(this, 'attribute');
    var attrValue = get(this, 'attrValue');

    // Check default model values
    if (hasEmberData() && model instanceof self.DS.Model && canInvoke(model, 'eachAttribute')) {
      let attrMeta = model.get('constructor.attributes').get(attribute);
      if (attrMeta) {
        let defaultValue = attrMeta.options.defaultValue;
        if (!isNone(defaultValue)) {
          return defaultValue !== attrValue;
        }
      }
    }
    return !isNone(attrValue);
  }),

  messages: computed('message', function() {
    return makeArray(get(this, 'message'));
  }),

  messageObject: null,
  _message: null,
  message: computed('messageObject.message', {
    get() {
      return get(this, '_message') || get(this, 'messageObject.message');
    },
    set(key, val) {
      return set(this, '_message', val);
    }
  }),

  error: computed('message', 'isInvalid', 'attribute', function() {
    if (get(this, 'isInvalid')) {
      return ValidationError.create({
        message: get(this, 'message'),
        attribute: get(this, 'attribute')
      });
    }

    return null;
  }),

  errors: computed('error', function() {
    return makeArray(get(this, 'error'));
  })
});

export default Ember.Object.extend({
  /**
   * @property model
   * @type {Object}
   */
  model: null,

  /**
   * @property attribute
   * @type {String}
   */
  attribute: '',

  /**
   * @property _promise
   * @async
   * @private
   * @type {Promise}
   */
  _promise: undefined,

  /**
   * The validator that returned this result
   * @property _validator
   * @private
   * @type {Validator}
   */
  _validator: null,

  /**
   * @property isValid
   * @readOnly
   * @type {Ember.ComputedProperty}
   */
  isValid: computed.oneWay('_validations.isValid'),

  /**
   * @property isInvalid
   * @readOnly
   * @type {Ember.ComputedProperty}
   */
  isInvalid: computed.oneWay('_validations.isInvalid'),

  /**
   * @property isValidating
   * @readOnly
   * @type {Ember.ComputedProperty}
   */
  isValidating: computed.oneWay('_validations.isValidating'),

  /**
   * @property isTruelyValid
   * @readOnly
   * @type {Ember.ComputedProperty}
   */
  isTruelyValid: computed.oneWay('_validations.isTruelyValid'),

  /**
   * @property isAsync
   * @readOnly
   * @type {Ember.ComputedProperty}
   */
  isAsync: computed.oneWay('_validations.isAsync'),

  /**
   * @property isDirty
   * @readOnly
   * @type {Ember.ComputedProperty}
   */
  isDirty: computed.oneWay('_validations.isDirty'),

  /**
   * @property message
   * @readOnly
   * @type {Ember.ComputedProperty}
   */
  message: computed.oneWay('_validations.message'),

  /**
   * @property messages
   * @readOnly
   * @type {Ember.ComputedProperty}
   */
  messages: computed.oneWay('_validations.messages'),

  /**
   * @property error
   * @readOnly
   * @type {Ember.ComputedProperty}
   */
  error: computed.oneWay('_validations.error'),

  /**
   * @property errors
   * @readOnly
   * @type {Ember.ComputedProperty}
   */
  errors: computed.oneWay('_validations.errors'),

  /**
   * This hold all the logic for the above CPs. We do this so we can easily switch this object out with a different validations object
   * @property _validations
   * @private
   * @type {Result}
   */
  _validations: computed('model', 'attribute', '_promise', function() {
    return ValidationsObject.create(getProperties(this, ['model', 'attribute', '_promise']));
  }),

  init() {
    this._super(...arguments);

    if (get(this, 'isAsync')) {
      this._handlePromise();
    }
  },

  /**
   * Update the current validation result object with the given result
   * - If result is undefined or null, set isValid to false
   * - If result is a validations object from a different model/object, set the _validations object to the one given (belongs-to)
   * - If result is a collection of validation result objects, create a Validation Result Collection and set that to the _validations object (has-many)
   * - If result is a string, set the message to the given string and set isValid to false
   * - If result is a boolean, set isValid to result
   * - If result is a pojo, update _validations object with the information given
   *
   * @method update
   * @private
   * @param result
   */
  update(result) {
    var validations = get(this, '_validations');

    if (isNone(result)) {
      this.update(false);
      return;
    }

    if(get(result, 'isMessageObject')) {
      setProperties(validations, {
        messageObject: result,
        isValid: false,
      });
    } else if (get(result, 'isValidations')) {
      set(this, '_validations', result);
    } else if (isArray(result) && emberArray(result).isEvery('isValidations', true)) {
      var validationResultsCollection = ValidationResultCollection.create({
        attribute: get(this, 'attribute'),
        content: result
      });
      set(this, '_validations', validationResultsCollection);
    } else if (typeof result === 'string') {
      setProperties(validations, {
        message: result,
        isValid: false
      });
    } else if (typeof result === 'boolean') {
      set(validations, 'isValid', result);
    } else if (typeof result === 'object') {
      setProperties(validations, result);
    }
  },

  /**
   * Promise handler
   * @method  _handlePromise
   * @private
   */
  _handlePromise() {
    var validations = get(this, '_validations');
    set(validations, 'isValidating', true);
    get(this, '_promise').then(
      result => this.update(result),
      result => this.update(result)
    ).catch(reason => {
      // TODO: send into error state
      throw reason;
    }).finally(() => {
      set(validations, 'isValidating', false);
    });
  }
});
