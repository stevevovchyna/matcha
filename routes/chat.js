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
				var result = conversations.filter(conversation => conversation.isActive);
				res.render('conversations', {conversations: result});
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
						Messages.update({"isRead": false}, {"$set":{"isRead": true}}, {"multi": true}, (err, mess) => {
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
