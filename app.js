'use strict';

const apiai = require('apiai');
const config = require('./config');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const uuid = require('uuid');


// Messenger API parameters
if (!config.FB_PAGE_TOKEN) {
	throw new Error('missing FB_PAGE_TOKEN');
}
if (!config.FB_VERIFY_TOKEN) {
	throw new Error('missing FB_VERIFY_TOKEN');
}
if (!config.API_AI_CLIENT_ACCESS_TOKEN) {
	throw new Error('missing API_AI_CLIENT_ACCESS_TOKEN');
}

app.set('port', (process.env.PORT || 80))

//serve static files in the public directory
app.use(express.static('public'));

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
	extended: false
}))

// Process application/json
app.use(bodyParser.json())

const apiAiService = apiai(config.API_AI_CLIENT_ACCESS_TOKEN, {
	language: "ko"	
});
const sessionIds = new Map();

app.get('/', function (req, res) {
    res.send('Hello world, I am a chat bot')
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
    console.log("request");
	if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.FB_VERIFY_TOKEN) {
		res.status(200).send(req.query['hub.challenge']);
	} else {
		console.error("Failed validation. Make sure the validation tokens match.");
		res.sendStatus(403);
	}
})

app.post('/webhook', function (req, res) {
  var data = req.body;
  console.log("Webhook received :: " + data);

  // Make sure this is a page subscription
  if (data.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});
  
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  
  if (!sessionIds.has(senderID)) {
		sessionIds.set(senderID, uuid.v1());
  }

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;

 console.log(messageText);
  if (messageText) { 
        sendToApiAi(senderID, messageText);    
  } 
}

function sendToApiAi(sender, text) {
	
	var apiaiRequest = apiAiService.textRequest(text, {
		sessionId: sessionIds.get(sender),
		lang: 'ko'
	});

	apiaiRequest.on('response', (response) => {
		handleApiAiResponse(sender, response);		
	});

	apiaiRequest.on('error', (error) => console.error(error));
	apiaiRequest.end();
}

function handleApiAiResponse(sender, response) {
	var responseText = response.result.fulfillment.speech;
	var messages = response.result.fulfillment.messages;
	var action = response.result.action;
	var contexts = response.result.contexts;
	var parameters = response.result.parameters;
	var actionIncompleted = response.result.actionIncomplete;
	
	if(actionIncompleted) sendTextMessage(sender, responseText);
	else{
	
		switch (action) {
			case "input.meal":
				if(!actionIncompleted){
					var quick = [
						{
							"content_type":"text",
							"title":"족발",
							"payload":"COURSE_ACTION"
						},
						{
							"content_type":"text",
							"title":"보쌈",
							"payload":"COURSE_ACTION"
						},
						{
							"content_type":"text",
							"title":"치킨",
							"payload":"COURSE_ACTION"
						}
			
					];
						
					sendQuickReply(sender, responseText,quick);
				}
				break;
			default:
				sendTextMessage(sender, responseText);
		}	
	
	}	
}

function sendQuickReply(recipientId, text, replies, metadata) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			text: text,
			metadata: isDefined(metadata)?metadata:'',
			quick_replies: replies
		}
	};

	callSendAPI(messageData);
}


function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: config.FB_PAGE_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}

function isDefined(obj) {
	if (typeof obj == 'undefined') {
		return false;
	}

	if (!obj) {
		return false;
	}

	return obj != null;
}

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})