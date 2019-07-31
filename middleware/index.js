const flash = require("connect-flash");
const expressSanitizer = require("express-sanitizer");
const User = require("../models/user");
const Conversations = require("../models/conversations");
const iplocate = require('node-iplocate');

var middlewareObject = {};

middlewareObject.location = (req, res, next) => {
	let ip = req.header('x-forwarded-for') || req.connection.remoteAddress;
	iplocate(ip).then((results) => {
		User.findOneAndUpdate({username: req.sanitize(req.body.username)},
		{	
			reallocationname: results.city,
			reallocation: {
				type: "Point",
				coordinates: [results.longitude, results.latitude]
			},
		}, (err, user)  => {
			if (err) {
				console.log(err);
				next();
			} else {
				console.log('got some location info about this buddy!');
				next();
			}
		})
	});
}

middlewareObject.isConnected = (req, res, next) => {
	Conversations.find({}, (err, conversations) => {
		var result = conversations.filter(
			conversation => conversation.participants.includes(req.params.id.toString()) && 
			conversation.participants.includes(req.user._id.toString()));
		if (result.length > 0) {
			Conversations.findByIdAndUpdate(result[0]._id, {isActive: "false"}, (err) => {
				if (err) {
					console.log(err);
				} else {
					console.log("It's inactive, SIr!!!");
					next();
				}
			})
		} else {
			next();
		}
	});
}

middlewareObject.haveLikedMe = (req, res, next) => {
	User.findById(req.sanitize(req.user._id)).populate('likes').exec((err, user) => {
		var result = user.likes.filter(like => like.id.toString() === req.params.id.toString());
		if (result.length > 0) {
			Conversations.find({}, (err, conversations) => {
				var conversationFound = conversations.filter(
					conversation => conversation.participants.includes(req.params.id.toString()) && 
					conversation.participants.includes(req.user._id.toString()));
				if (conversationFound.length === 1) {
					Conversations.findByIdAndUpdate(conversationFound[0]._id, {isActive: "true"}, (err) => {
						if (err) {
							console.log(err);
						} else {
							console.log("It's active again, Sir!!!");
							res.locals.message = "That's a match! You can check the conversations list again!";
							next();
						}
					});
				} else {
					Conversations.create({}, (err, conversation) => {
						conversation.participants.push(req.params.id);
						conversation.participants.push(req.user._id);
						conversation.lastMessage = "Hi there!";
						conversation.lastMessageAuthor = req.user._id;
						conversation.save(() => {
							console.log("New conversation was created!!!");
							res.locals.message = "That's a match! You can check the conversations list!";
							next();
						});
					});
				}
			});
		} else {
			next();
		}
	});
}

middlewareObject.haveFilled = (req, res, next) => {
	if (req.isAuthenticated()) {
		User.findById(req.user._id, (err, user) => {
			if (user.filledFields) {
				return next();
			} else {
				user.filledFields = true;
				user.save((err) => {
					if (err) {
						req.flash("error", err.message);
						res.redirect("/login");
					}
					res.redirect("/profile/" + user._id + "/edit");
				});
			}
		});
	} else {
		req.flash("error", "Please login first!");
		res.redirect("/login");
	}
}

middlewareObject.isLoggedIn = (req, res, next) => {
	if (req.isAuthenticated())
		return next();
	req.flash("error", "Please login first!");
	res.redirect("/login");
};

middlewareObject.additionalCheck = (req, res, next) => {
	User.findOne({ username: req.sanitize(req.body.username) }, function(err, user) {
		if (err || !user) {
			console.log(err);
			return next();
		}
		if (user.isVerified)
			return next();
		if (!user.isVerified) {
			req.flash("error", "User with this email is not verified yet. Please, check the inbox of " + user.email + " to go through the verification process.");
			res.redirect("/login");
		}
	});
}

middlewareObject.checkProfileOwnership = (req, res, next) => {
	if (req.isAuthenticated()) {
		if(req.params.id == res.locals.currentUser._id) {
			next();
		} else {
			req.flash("error", "You don't have permission to do that");
			res.redirect("/feed/browse");
		}
	} else {
		req.flash("error", "You need to be logged in!");
		res.redirect("/feed/browse");
	}
};


module.exports = middlewareObject;
