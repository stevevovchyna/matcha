const mongoose = require("mongoose");

var tagsSchema = new mongoose.Schema({
	text: { type: String, unique: true },
	createdAt: { type: Date, default: Date.now },
});

//exporting model to the db
module.exports = mongoose.model("Tags", tagsSchema);
