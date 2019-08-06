const mongoose = require("mongoose");

var notificationsSchema = new mongoose.Schema({
	createdAt: {
		type: Date,
		default: Date.now 
	},
	n_type: String,
	for_who: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User"
	},
	from_whom: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	},
	isChecked: {
		type: Boolean,
		default: false
	}
});

//exporting model to the db
module.exports = mongoose.model("Notifications", notificationsSchema);
