const express = require("express");
const router = express.Router({mergeParams: true});
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
	User.findByIdAndUpdate(id, {}).populate('fakeReports').exec((err, user) => {
		if (err) {
			console.log(err);
			res.send({sttus: 'error', error: err});
		} else {
			if (req.user._id.toString() === user._id.toString()) {
				res.send({sttus: 'error', error: "You cant report your own profile"});
			} else {
				var result = user.fakeReports.filter(report => report.id.toString() === req.user._id.toString());
				if (result.length > 0) {
					res.send({sttus: 'error', error: "You have already reported this profile"});
				} else {
					FakeReports.create({}, (err, fakeReport) => {
						if (err) {
							console.log(err);
							res.send({status: 'error', error: err});
						} else {
							fakeReport.id = req.user._id;
							fakeReport.save();
							user.fakeReports.push(fakeReport);
							user.save(() => {
								res.send({status: 'success', user: user});
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
	User.findByIdAndUpdate(req.user._id.toString(), {}).populate('blockedUsers').exec((err, user) => {
		if (err) {
			console.log(err);
			res.send({sttus: 'error', error: err});
		} else {
			if (req.user._id.toString() === id.toString()) {
				res.send({sttus: 'error', error: "You cant block your own profile"});
			} else {
				var result = user.blockedUsers.filter(blocked => blocked.id.toString() === id.toString());
				if (result.length > 0) {
					BlockedUsers.findByIdAndDelete(result[0]._id, (err) => {
						if (err) {
							console.log(err);
							res.send({status: 'error', error: err});
						} else {
							user.blockedUsers.pull(result._id);
							user.save();
							Conversations.find({participants: [req.params.id, req.user._id]}, (err, foundConversations) => {
								if (err) {
									console.log(err);
									res.send({status: 'error', error: err});
								} else {
									if (foundConversations) {
										Conversations.findByIdAndUpdate(foundConversations[0]._id, {isActive: true}, (err, conversation) => {
											if (err) {
												console.log(err);
												res.send({status: 'error', error: err});
											}
										});
									}
							res.send({status: 'success',
										message: "You've unblocked this user!",
										user: user,
										buttonText: "Block this user"
									});
								}
							});
						}
					});
				} else {
					BlockedUsers.create({}, (err, blockedUser) => {
						if (err) {
							console.log(err);
							res.send({status: 'error', error: err});
						} else {
							blockedUser.id = id.toString();
							blockedUser.save();
							user.blockedUsers.push(blockedUser);
							user.save(() => {
								Conversations.find({participants: [req.params.id, req.user._id]}, (err, foundConversations) => {
									if (err) {
										console.log(err);
										res.send({status: 'error', error: err});
									} else {
										if (foundConversations) {
											Conversations.findByIdAndUpdate(foundConversations[0]._id, {isActive: false}, (err, conversation) => {
												if (err) {
													console.log(err);
													res.send({status: 'error', error: err});
												}
											});
										}
										res.send({status: 'success',
													message: "You've blocked this user!",
													user: user,
													buttonText: "Unblock this user"
												});
									}
								});
							});
						}
					});
				}
			}
		}
	});
});

module.exports = router;
