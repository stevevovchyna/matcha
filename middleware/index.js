const flash = require("connect-flash");
const expressSanitizer = require("express-sanitizer");
const User = require("../models/user");
const Conversations = require("../models/conversations");
const Notifications = require("../models/notifications");
const iplocate = require('node-iplocate');
const xss = require("xss");
const mongoose = require('mongoose');
const DateOnly = require('mongoose-dateonly')(mongoose);
const moment = require('moment');

var middlewareObject = {};

middlewareObject.countDistance = (req, res, next) => {
	if (req.user._id !== req.params.id) {
		User.findById(req.params.id, (err, foundUser) => {
			res.locals.distance = 0;
			// getting user's location
			if (req.user.location) {
				var lon1 = req.user.location.coordinates[0];
				var lat1 = req.user.location.coordinates[1];
			} else if (req.user.reallocation) {
				var lon1 = req.user.reallocation.coordinates[0];
				var lat1 = req.user.reallocation.coordinates[1];
			} else {
				var lon1 = 30.5234;
				var lat1 = 50.4501;
			}
			// getting user's location - the page we visit
			if (foundUser.location) {
				var lon2 = foundUser.location.coordinates[0];
				var lat2 = foundUser.location.coordinates[1];
			} else if (foundUser.reallocation) {
				var lon2 = foundUser.reallocation.coordinates[0];
				var lat2 = foundUser.reallocation.coordinates[1];
			} else {
				var lon2 = 30.5234;
				var lat2 = 50.4501;
			}
			if ((lat1 == lat2) && (lon1 == lon2)) {
				res.locals.distance = 0;
			} else {
				var radlat1 = Math.PI * lat1/180;
				var radlat2 = Math.PI * lat2/180;
				var theta = lon1-lon2;
				var radtheta = Math.PI * theta/180;
				var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
				if (dist > 1)
					dist = 1;
				dist = Math.acos(dist);
				dist = dist * 180/Math.PI;
				dist = dist * 60 * 1.1515;
				dist = dist * 1.609344;
				res.locals.distance = dist;
			}
			next();
		});
	} else {
		res.locals.distance = 0;
		next();
	}
}

middlewareObject.checkSortInput = (req, res, next) => {
	var params = Object.values(req.body.userparams);
	var err = 0;
	for (var i = 0; i < 8; i++) {
		if (parseInt(params[i]) < 0 || parseInt(params[i]) > 36500) {
			err++;
		}
	}
	if (parseInt(params[0]) > parseInt(params[1]) ||
		parseInt(params[2]) > parseInt(params[3]) ||
		parseInt(params[4]) > parseInt(params[5]) ||
		parseInt(params[6]) > parseInt(params[7])) {
			err++;
	}
	if (err > 0) {
		req.flash("error", "Invalid search data! Please make sure you are using correct parameters!");
		res.redirect("/feed/research");
	} else {
		next();
	}
}

middlewareObject.checkDate = (req, res, next) => {
	if (!req.body.user.birthdate || req.body.user.birthdate == "") {
		req.flash("error", "Birth date field empty! Please let us know your birth date");
		res.redirect("back");
	} else {
		var birthDate = new DateOnly(xss(req.body.user.birthdate));
		var now = new DateOnly();
		if (!moment(birthDate.toDate(),"YYYY-MM-DD HH:mm Z").isValid()){
			req.flash("error", "Invalid date! Please double-check your input");
			res.redirect("back");
		} else if ((now.year - birthDate.year < 16 && now.year - birthDate.year < 100) || (now.year - birthDate.year) < 0) {
			req.flash("error", "Seems like you are too young or too old, sweetie. Come back when you are at least 16 y.o. or younger than 100 years");
			res.redirect("back");
		} else {
			console.log("Your birthdate is : " + birthDate + "and you are "+(now.year - birthDate.year)+" years old");
			next();
		}
	}
}

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
	User.findByIdAndUpdate(req.sanitize(req.params.id), {})
		.populate('blockedUsers')
		.exec((err, user) => {
			var blocked = user.blockedUsers.filter(user => user.id.toString() === req.user._id.toString());
			if (blocked.length > 0) {
				next();
			} else {
				Conversations.find({}, (err, conversations) => {
					var result = conversations.filter(
						conversation => conversation.participants.includes(req.params.id.toString()) && 
						conversation.participants.includes(req.user._id.toString()));
					if (result.length > 0) {
						Conversations.findByIdAndUpdate(result[0]._id, {isActive: "false"}, (err) => {
							if (err) {
								console.log(err);
							} else {
								console.log("It's inactive, Sir!!!");
								res.locals.message = "mutual_dislike";
								next();
							}
						})
					} else {
						next();
					}
				});
			}
		});
}

middlewareObject.haveLikedMe = (req, res, next) => {
	User.findById(req.sanitize(req.user._id)).populate('likes').exec((err, user) => {
		User.findByIdAndUpdate(req.sanitize(req.params.id), {})
		.populate('blockedUsers')
		.exec((err, user) => {
			var blocked = user.blockedUsers.filter(user => user.id.toString() === req.user._id.toString());
			if (blocked.length > 0) {
				next();
			} else {
				var result = user.likes.filter(like => like.liker_id.toString() === req.params.id.toString());
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
								conversation.lastMessage = "Start of your conversation!";
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
			}
		});
	});
}

middlewareObject.haveFilled = (req, res, next) => {
	User.findById(req.user._id, (err, user) => {
		if (user.filledFields) {
			return next();
		} else {
			user.filledFields = true;
			user.save((err) => {
				if (err) {
					req.flash("error", err.message);
					res.redirect("/login");
				} else {
					res.redirect("/profile/" + user._id + "/edit");
				}
			});
		}
	});
}

middlewareObject.checkIfLogged = (req, res, next) => {
	if (req.isAuthenticated()) {
		res.redirect('/feed/browse/default.asc');
	} else {
		next();
	}
}

middlewareObject.isLoggedIn = (req, res, next) => {
	if (req.isAuthenticated()) {
		return next();
	} else {
		req.flash("error", "Please login first");
		res.redirect("/login");
	}
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

middlewareObject.checkOwnership = (req, res, next) => {
	if (req.isAuthenticated()) {
		if (req.params.user_id == res.locals.currentUser._id) {
			next();
		} else {
			req.flash("error", "You don't have permission to do that");
			res.redirect("back");
		}
	} else {
		req.flash("error", "You don't have permission to do that");
		res.redirect("back");
	}
}

middlewareObject.checkNotificationRecipient = (req, res, next) => {
	Notifications.findById(req.params.notification_id, (err, foundNotification) => {
		if (foundNotification.for_who.toString() === req.user._id.toString()) {
			next();
		} else {
			req.flash("error", "You don't have permission to do that");
			res.redirect("back");
		}
	});
}


module.exports = middlewareObject;
