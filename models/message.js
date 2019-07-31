const mongoose = require("mongoose");

var messagesSchema = new mongoose.Schema({
	conversationId: {
		type: mongoose.Schema.Types.ObjectId,
		required: true
	},
	body: {
		type: String,
		required: true
	},
	sentBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	}
},
{
	timestamps: true // Saves createdAt and updatedAt as dates. createdAt will be our timestamp.
});

//exporting model to the db
module.exports = mongoose.model("Messages", messagesSchema);

