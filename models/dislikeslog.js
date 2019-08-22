const mongoose = require("mongoose");

var dislikeslogSchema = new mongoose.Schema({
	createdAt: { type: Date, default: Date.now },
	disliker_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	},
	disliked_one_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	}
});

//exporting model to the db
module.exports = mongoose.model("Dislikeslog", dislikeslogSchema);
