const mongoose = require("mongoose"),
passportLocalMongoose = require("passport-local-mongoose");

var UserSchema = new mongoose.Schema({
	username: String,
	lastname: String,
	lastseen: {type: Date},
	firstname: String,
	gender: {
		type: String,
		default: "Female"
	},
	locationname: String,
	location: {
		type: { type: String },
		coordinates: [Number],
	},
	reallocationname: String,
	reallocation: {
		type: { type: String },
		coordinates: [Number],
	},
	sexPreferences: {
		type: String,
		default: "Bi-Sexual"
	},
	bio: { type: String,
		default: "I'm a very interesting person!"
	},
	interests: [
		{
			text: String
		}
	],
	pictures: [{
		url: String,
		naked_url: String,
		isProfile: {
			type: Boolean,
			default: false
		}
	}],
	email: { type: String, unique: true },
	filledFields: { type: Boolean, default: false }, 
	isVerified: { type: Boolean, default: false },
	password: String,
	passwordResetToken: String,
	passwordResetExpires: Date,
	visits: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Visits"
		}
	],
	likes: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Likes"
		}
	],
	likeslog: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Likeslog"
		}
	],
	fakeReports: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "FakeReports"
		}
	],
	blockedUsers: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "BlockedUsers"
		}
	],
	dislikeslog: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Dislikeslog"
		}
	],
	createdAt: {
		type: Date,
		required: true,
		default: Date.now
	}
});

UserSchema.plugin(passportLocalMongoose, {
	usernameUnique: false,
	findByUsername: function(model, queryParameters) {
		queryParameters.isVerified = true;
		return model.findOne(queryParameters);
	}
});

UserSchema.index( { "location" : "2dsphere" } );

//exporting model to the db
module.exports = mongoose.model("User", UserSchema);
