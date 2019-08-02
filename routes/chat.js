const express = require("express");
const Messages = require("../models/message");
const Conversations = require("../models/conversations");
const middleware = require("../middleware");

const router = express.Router();

router.get("/chatik", (req, res) => {
	res.render('chatik');
})

router.get("/conversations", middleware.isLoggedIn, (req, res) => {
	Conversations.find({participants: req.user._id})
		.populate('participants')
		.populate('lastMessageAuthor')
		.exec((err, conversations) => {
			if (err) {
				console.log(err);
			} else {
				Messages.find({"isRead": false}, (err, messages) => {					
					if (err) {
						console.log(err);
					} else {
						var unreadMessagesCounter = [];
						var result = conversations.filter(conversation => conversation.isActive);
						result.forEach(conver => {
							var unreadMessages = messages.filter(message => 
								message.conversationId.toString() === conver._id.toString() &&
								message.isRead === false &&
								message.sentBy._id.toString() !== req.user._id.toString()
							);
							unreadMessagesCounter.push({ conversation_id: conver._id, count: unreadMessages.length });
						});
						res.render('conversations', {conversations: result, unreadMessagesCounter: unreadMessagesCounter});
					}
				})
			}
		})
});

router.get("/conversations/:conversation_id", middleware.isLoggedIn, (req, res) => {
	Messages.find({ conversationId: req.params.conversation_id })
		.sort('createdAt')
		.populate('sentBy')
		.populate('conversationId')
		.exec((err, messages) => {
			if (err) {
				console.log(err);
			} else {
				Conversations.findById(req.params.conversation_id)
				.populate('participants')
				.exec((err, conversation) => {
					if (err) {
						console.log(err);
					} else {
						var sender_id = conversation.participants.filter(user => user._id.toString() !== req.user._id.toString());
						Messages.updateMany({"isRead": false, "sentBy": sender_id[0]._id}, {"$set":{"isRead": true}}, {"multi": true}, (err, mess) => {
							if (err) {
								console.log(err);
							} else {
								console.log(mess);
							}
						});
						res.render('chat', {messages: messages, conversation: conversation});
					}
				})
			}
		});
});

module.exports = router;
