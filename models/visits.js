const mongoose = require("mongoose");

var visitsSchema = new mongoose.Schema({
	createdAt: { type: Date, default: Date.now },
	profile_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	},
	visitor_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	}
});

//exporting model to the db
module.exports = mongoose.model("Visits", visitsSchema);
