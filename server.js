var Hapi = require('hapi');
var uuid = require('uuid');
var fs = require('fs');
var Joi = require('joi');
var Boom = require('boom');


var server = new Hapi.Server();

var cards = loadCards();

server.connection({ port: 3000 });

server.views({
  engines: {
    html: require('handlebars')
  },
  path: './templates'
});

server.register({
    register: require('good'),
    options: {
      opsInterval: 5000,
      reporters: [
        {
          reporter: require('good-file'),
          events: { ops: '*'},
          config: {
            path: './logs',
            prefix: 'hapi-process',
            rotate: 'daily'
          }
        },
        {
          reporter: require('good-file'),
          events: { response: '*'},
          config: {
            path: './logs',
            prefix: 'hapi-requests',
            rotate: 'daily'
          }
        },
        {
          reporter: require('good-file'),
          events: { error: '*'},
          config: {
            path: './logs',
            prefix: 'hapi-error',
            rotate: 'daily'
          }
        }
      ]
    }
}, function(err) {
    console.log(err);
});

server.ext('onPreResponse', function(request, reply) {
  if(request.response.isBoom) {
    return reply.view('error', request.response);
  }
  reply.continue();
});

server.route({
  path: '/',
  method: 'GET',
  handler: {
    file: 'templates/index.html'
  }
});

server.route({
	path: '/assets/{path*}',
	method: 'GET',
	handler: {
		directory: {
			path: './public',
			listing: false
		}
	}
});

server.route({
  path: '/cards/new',
  method: ['GET', 'POST'],
  handler: newCardHandler
});

server.route({
  path: '/cards',
  method: 'GET',
  handler: cardsHandler
});

server.route({
  path: '/cards/{id}',
  method: 'DELETE',
  handler: deleteCardHandler
});

var cardSchema = Joi.object().keys({
  name: Joi.string().min(3).max(50).required(),
  recipient_email: Joi.string().email().required(),
  sender_name: Joi.string().min(3).max(50).required(),
  sender_email: Joi.string().email().required(),
  card_image: Joi.string().regex(/.+\.(jpg|bmp|png|gif)\b/).required()
});

function newCardHandler(request, reply) {
    if(request.method === 'get') {
      reply.view('new', { card_images: mapImages() });
    } else {
      Joi.validate(request.payload, cardSchema, function(err, val){
        if(err) {
          return reply(Boom.badRequest(err.details[0].message));
        }
        var card = {
          name: val.name,
          recipient_email: val.recipient_email,
          sender_name: val.sender_name,
          sender_email: val.sender_email,
          card_image: val.card_image
        };
        saveCard(card);
        reply.redirect('/cards');  
      }); 
    }
};

function cardsHandler(request, reply) {
  reply.view('cards', { cards: cards });
}

function deleteCardHandler(request, reply) {
  delete cards[request.params.id];
  reply();
}

function saveCard(card) {
  var id = uuid.v1();
  card.id = id;
  cards[id] = card;
}

function loadCards() {
  var file = fs.readFileSync('./cards.json');
  return JSON.parse(file.toString());
}

function mapImages() {
  return fs.readdirSync('./public/images/cards');
}

server.start(function() {
	console.log('Listening on ' + server.info.uri);
});