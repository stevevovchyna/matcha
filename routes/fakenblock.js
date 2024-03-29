const express = require("express");
const router = express.Router({
	mergeParams: true
});
const middleware = require("../middleware");
const User = require("../models/user");
const Likes = require("../models/likes");
const Dislikeslog = require("../models/dislikeslog");
const Likeslog = require("../models/likeslog");
const Visits = require("../models/visits");
const FakeReports = require("../models/fake");
const BlockedUsers = require("../models/blocked");
const Conversations = require("../models/conversations");

router.put("/:id/ajaxfakeaccount", middleware.isLoggedIn, (req, res) => {
	var id = req.sanitize(req.params.id);
	User.findById(id).populate('fakeReports').exec((err, user) => {
		if (err || !user) {
			console.log(err);
			res.send({
				status: 'error',
				error: "User not found!"
			});
		} else {
			if (req.user._id.toString() === user._id.toString()) {
				res.send({
					status: 'error',
					error: "You cant report your own profile"
				});
			} else {
				var result = user.fakeReports.filter(report => report.id.toString() === req.user._id.toString());
				if (result.length > 0) {
					res.send({
						status: 'error',
						error: "You have already reported this profile"
					});
				} else {
					// fake report is being created
					FakeReports.create({}, (err, fakeReport) => {
						if (err) {
							console.log(err);
							res.send({
								status: 'error',
								error: err.message
							});
						} else {
							fakeReport.id = req.user._id;
							fakeReport.save();
							user.fakeReports.push(fakeReport);
							if (!user.hasLocation) {
								user.location = undefined;
							}
							if (!user.reallocation.coordinates[0]) {
								user.reallocation = undefined;
							}
							// now in your profile you have a list of users you've marked as fake
							user.save(() => {
								res.send({
									status: 'success',
									user: user
								});
							});
						}
					});
				}
			}
		}
	});
});

router.put("/:id/ajaxblockaccount", middleware.isLoggedIn, (req, res) => {
	var id = req.sanitize(req.params.id);
	User.findById(req.user._id.toString()).populate('blockedUsers').exec((err, user) => {
		if (err || !user) {
			console.log(err);
			res.send({
				status: 'error',
				error: "User not found!"
			});
		} else {
			if (req.user._id.toString() === id.toString()) {
				res.send({
					status: 'error',
					error: "You cant block your own profile"
				});
			} else {
				var result = user.blockedUsers.filter(blocked => blocked.id.toString() === id.toString());
				if (result.length > 0) {
					BlockedUsers.findByIdAndDelete(result[0]._id, (err) => {
						if (err) {
							console.log(err);
							res.send({
								status: 'error',
								error: err.message
							});
						} else {
							user.blockedUsers.pull(result[0]._id);
							if (!user.hasLocation) {
								user.location = undefined;
							}
							if (!user.reallocation.coordinates[0]) {
								user.reallocation = undefined;
							}
							user.save((err) => {
								if (err) {
									console.log(err);
									res.send({
										status: 'error',
										error: err.message
									});
								} else {
									Conversations.find({}, (err, foundConversations) => {
										var neededConversation = foundConversations.filter(conversation => conversation.participants.includes(req.params.id) && conversation.participants.includes(req.user._id));
										if (err) {
											console.log(err);
											res.send({
												status: 'error',
												error: err.message
											});
										} else {
											if (neededConversation.length > 0) {
												Conversations.findByIdAndUpdate(neededConversation[0]._id, {
													isActive: true
												}, (err, conversation) => {
													if (err) {
														console.log(err);
														res.send({
															status: 'error',
															error: err.message
														});
													}
												});
											}
											res.send({
												status: 'success',
												message: "You've unblocked this user!",
												user: user,
												buttonText: "Block this user"
											});
										}
									});
								}
							});
						}
					});
				} else {
					BlockedUsers.create({id: id.toString()}, (err, blockedUser) => {
						if (err) {
							console.log(err);
							res.send({
								status: 'error',
								error: err.message
							});
						} else {
							user.blockedUsers.push(blockedUser);
							if (!user.hasLocation) {
								user.location = undefined;
							}
							if (!user.reallocation.coordinates[0]) {
								user.reallocation = undefined;
							}
							user.save((err) => {
								if (err) {
									console.log(err);
									res.send({
										status: 'error',
										error: err.message
									});
								} else {
									Conversations.find({}, (err, foundConversations) => {
										var neededConversation = foundConversations.filter(conversation => conversation.participants.includes(req.params.id) && conversation.participants.includes(req.user._id));
										if (err) {
											console.log(err);
											res.send({
												status: 'error',
												error: err.message
											});
										} else {
											if (neededConversation.length > 0) {
												Conversations.findByIdAndUpdate(neededConversation[0]._id, {
													isActive: false
												}, (err, conversation) => {
													if (err) {
														console.log(err);
														res.send({
															status: 'error',
															error: err.message
														});
													}
												});
											}
											res.send({
												status: 'success',
												message: "You've blocked this user!",
												user: user,
												buttonText: "Unblock this user"
											});
										}
									});
								}
							});
						}
					});
				}
			}
		}
	});
});

module.exports = router;
