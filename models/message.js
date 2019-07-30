const mongoose = require("mongoose");

var messagesSchema = new mongoose.Schema({
	createdAt: { type: Date, default: Date.now },
	sentBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	},
	// sentTo: {
	// 	type: mongoose.Schema.Types.ObjectId,
	// 	ref: "User"
	// },
	body: String,
	// room: {
	// 	type: mongoose.Schema.Types.ObjectId,
	// 	ref: "Rooms"
	// }
});

//exporting model to the db
module.exports = mongoose.model("Messages", messagesSchema);

