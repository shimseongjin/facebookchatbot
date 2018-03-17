'use strict';

const config = require('./config');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();


// Messenger API parameters
if (!config.FB_PAGE_TOKEN) {
	throw new Error('missing FB_PAGE_TOKEN');
}
if (!config.FB_VERIFY_TOKEN) {
	throw new Error('missing FB_VERIFY_TOKEN');
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

//<-- sleep -->//
function sleep(num){	//[1/1000초]
	var now = new Date();
	var stop = now.getTime() + num;
	while(true){
		now = new Date();
		if(now.getTime() > stop)return;
	}
}

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

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;

 console.log(messageText);
  if (messageText) { 
		var seen = {
			recipient : {
				id: senderID
			},
			sender_action:"mark_seen"
		};
		callSendAPI(seen);
		var typingon = {
			recipient : {
				id: senderID
			},
			sender_action:"typing_on"
		};
		callSendAPI(typingon);
	
        sendTextMessage(senderID, messageText);
  } 
}

function sendTextMessage(recipientId, messageText) {
	var message = messageText;
	var botname = message.indexOf('이름');
	var timer = message.indexOf('배고파');
	if(botname != -1){
		message = '안녕하세요 저는 비룡입니다.'
	}
	if(timer != -1){
		var d = new Date();
		var n = d.getHours(); 
		if(n>=6&&n<=9){
			message = '아침 드시겠어요?';
		}
		else if(n>9&&n<=14){
			message = '점심 드시겠어요?';
		}
		else if(n>14&&n<=20){
			message = '저녁 드시겠어요?';
		}
		else{
			message = '야식 드시겠어요?';
		}
	}
	
	var typingoff = {
		recipient : {
			id: recipientId
		},
		sender_action:"typing_off"
	};
	callSendAPI(typingoff);
	
	
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			text: message
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

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})