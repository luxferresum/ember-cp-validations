import Ember from 'ember';
import getOwner from 'ember-getowner-polyfill';
import DefaultMessages from './messages';

const {get,getProperties} = Ember;

function formatMessage(message, context = {}) {
	if (isNone(message) || typeof message !== 'string') {
	  message = get(this, 'invalid');
	}
	return message.replace(get(this, '_regex'), (s, attr) => context[attr]);
}

export default Ember.Object.extend({
	isMessageObject: true,

	defaultDescription: 'This field',

	message: Ember.computed('type', 'attribute', 'value', 'options', {
		get() {
			let {type, value, options} = getProperties(this, 'type', 'value', 'options');

			let owner = getOwner(this);
			let messagesFactory = owner._lookupFactory('validator:messages');
			messagesFactory = messagesFactory || DefaultMessages;
			let messages = messagesFactory.create();

			var message;

			options.description = messages.getDescriptionFor(get(this, 'attribute'), options);


			if (options.message) {
			  if (typeof options.message === 'string') {
			    message = messages.formatMessage(options.message, options);
			  } else if (typeof options.message === 'function') {
			    message = options.message.apply(this, arguments);
			    message = isNone(message) ? messages.getMessageFor(type, options) : messages.formatMessage(message, options); // fail-safe to default message of type
			  }
			} else {
			  message = messages.getMessageFor(type, options);
			}

			return message.trim();
		}
	})
});