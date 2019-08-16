const mongoose = require("mongoose"),
	DateOnly = require('mongoose-dateonly')(mongoose),
	passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require('mongoose-findorcreate');

var UserSchema = new mongoose.Schema({
	intra_id: String,
	username: String,
	lastname: String,
	birthday: {
		type: Date,
		default: '1995-01-01T00:00:00.000Z'
	},
	lastseen: {
		type: Date
	},
	firstname: String,
	gender: {
		type: String,
		default: "Female"
	},
	hasLocation: Boolean,
	locationname: String,
	location: {
		type: {
			type: String, // Don't do `{ location: { type: String } }`
			enum: ['Point'] // 'location.type' must be 'Point'
		},
		coordinates: {
			type: [Number],
			index: true
		}
	},
	reallocationname: String,
	reallocation: {
		type: {
			type: String, // Don't do `{ location: { type: String } }`
			enum: ['Point'] // 'location.type' must be 'Point'
		},
		coordinates: {
			type: [Number],
			index: true
		}
	},
	sexPreferences: {
		type: String,
		default: "Bi-Sexual"
	},
	bio: {
		type: String,
		default: "I'm a very interesting person!"
	},
	interests: [{
		text: String
	}],
	pictures: [{
		url: String,
		naked_url: String,
		isProfile: {
			type: Boolean,
			default: false
		}
	}],
	email: {
		type: String,
		unique: true
	},
	filledFields: {
		type: Boolean,
		default: false
	},
	isVerified: {
		type: Boolean,
		default: false
	},
	password: String,
	passwordResetToken: String,
	passwordResetExpires: Date,
	visits: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "Visits"
	}],
	myVisits: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "Visits"
	}],
	likes: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "Likes"
	}],
	myLikes: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "Likes"
	}],
	likeslog: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "Likeslog"
	}],
	mylikeslog: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "Likeslog"
	}],
	fakeReports: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "FakeReports"
	}],
	blockedUsers: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "BlockedUsers"
	}],
	dislikeslog: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "Dislikeslog"
	}],
	mydislikeslog: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "Dislikeslog"
	}],
	notifications: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "Notifications"
	}],
	createdAt: {
		type: Date,
		required: true,
		default: Date.now
	}
});

UserSchema.plugin(passportLocalMongoose, {
	usernameUnique: false,
	findByUsername: function (model, queryParameters) {
		queryParameters.isVerified = true;
		return model.findOne(queryParameters);
	}
});

UserSchema.index({ location: "2dsphere"});
UserSchema.index({ reallocation: "2dsphere"});
UserSchema.plugin(findOrCreate);

//exporting model to the db
module.exports = mongoose.model("User", UserSchema);
