const express = require("express");
const Messages = require("../models/message");
const Conversations = require("../models/conversations");
const middleware = require("../middleware");

const router = express.Router();

router.get("/conversations", middleware.isLoggedIn, (req, res) => {
	Conversations.find({participants: req.user._id, isActive: true})
		.populate('participants')
		.populate('lastMessageAuthor')
		.exec((err, conversations) => {
			if (err || conversations.length == 0 || !conversations) {
				console.log(err);
				req.flash("error", "There are no conversations available for you");
				res.render('conversations', { conversations: [], unreadMessagesCounter: []});
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
				});
			}
		});
});

router.get("/conversations/:conversation_id", middleware.isLoggedIn, (req, res) => {
	Messages.find({ conversationId: req.params.conversation_id })
		.sort('createdAt')
		.populate('sentBy')
		.populate('conversationId')
		.exec((err, messages) => {
			if (err || !messages) {
				console.log(err);
				req.flash('error', "Conversation not found!");
				res.redirect("/conversations");
			} else {
				Conversations.findById(req.params.conversation_id)
				.populate('participants')
				.exec((err, conversation) => {
					if (err || conversation) {
						console.log(err);
						req.flash('error', "Conversation not found!");
						res.redirect("conversations");
					} else {
						if (conversation.isActive) {
							var sender_id = conversation.participants.filter(user => user._id.toString() !== req.user._id.toString());
							Messages.updateMany({"isRead": false, "sentBy": sender_id[0]._id}, {"$set":{"isRead": true}}, {"multi": true}, (err, mess) => {
								if (err) {
									console.log(err);
								} else {
									console.log(mess);
								}
							});
							res.render('chat', {messages: messages, conversation: conversation});
						} else {
							req.flash('error', "This conversation is not accessible as one of the users has blocked or disliked another one");
							res.redirect('/conversations');
						}
					}
				})
			}
		});
});

module.exports = router;
