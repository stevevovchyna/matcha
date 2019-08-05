const mongoose = require("mongoose");

var likesSchema = new mongoose.Schema({
	createdAt: { type: Date, default: Date.now },
	liker_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	},
	liked_one_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	}
});

//exporting model to the db
module.exports = mongoose.model("Likes", likesSchema);

