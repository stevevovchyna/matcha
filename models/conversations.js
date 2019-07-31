const mongoose = require("mongoose");

var conversationsSchema = new mongoose.Schema({
	participants: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User'
		}
	],
	lastMessage: String,
	lastMessageAuthor: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	},
	isActive: {type: Boolean, default: true}
});

module.exports = mongoose.model("Conversations", conversationsSchema);
