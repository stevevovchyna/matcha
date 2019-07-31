const express = require("express");
const Messages = require("../models/message");
const Conversations = require("../models/conversations");
const middleware = require("../middleware");

const router = express.Router();

router.get("/chatik", (req, res) => {
	res.render('chatik');
})

router.get("/chat", (req, res, next) => {
	res.setHeader("Content-Type", "application/json");
	res.statusCode = 200;
	Messages.find({}).populate('sentBy').exec((err, messages) => {
		res.json(messages);
	});
});

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
	Message.find({ conversationId: req.params.conversation_id })
		.sort('-createdAt')
		.populate('sentBy')
		.exec((err, messages) => {
			if (err) {
				console.log(err);
			} else {
				res.render('chat', {messages: messages});
			}
		});
});

module.exports = router;
