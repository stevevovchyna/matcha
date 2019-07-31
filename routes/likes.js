const express = require("express");
const router = express.Router({mergeParams: true});
const passport = require("passport");
const User = require("../models/user");
const Likes = require("../models/likes");
const Dislikeslog = require("../models/dislikeslog");
const Likeslog = require("../models/likeslog");
const Visits = require("../models/visits");
const middleware = require("../middleware");
const _  = require('lodash');
const app = 			express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);


router.put("/:id/ajaxlike", middleware.isLoggedIn, middleware.haveLikedMe, (req, res) => {
	User.findByIdAndUpdate(req.sanitize(req.params.id), {}, (err, user) => {
		if (req.user.pictures.length === 0) {
			res.send({status: 'error', error: "Please add a picture to your profile first!"});
		} else {
			if (err) {
				console.log(err);
				res.send({status: 'error', error: err});
			} else {
				if (req.user._id.toString() === user._id.toString()) {
					res.send({status: 'error', error: "You can't 'like' your own profile"});
				} else {
					var match = 0;

					User.findById(req.sanitize(req.params.id)).populate('likes').exec((err, userlikes) => {
						if (err) {
							res.send({status: 'error', error: err});
							console.log(err);
						} else {
							userlikes.likes.forEach((like) => {
								if (like.id.toString() === req.user._id.toString()) {
									match = 1;
								}
							});
							if (match) {
								res.send({status: 'error', error: "This person already knows about your sympathy", user: userlikes});
							} else {
								Likes.create({}, (err, like) => {
									if (err) {
										console.log(err);
										res.send({status: 'error', error: err});
									} else {
										like.id = req.user._id;
										like.save();

										Likeslog.create({}, (err, likelog) => {
											if (err) {
												console.log(err);
												res.send({status: 'error', error: err});
											} else {
												likelog.id = req.user._id;
												likelog.save();
											}
											user.likeslog.push(likelog);
											user.likes.push(like);
											user.save(() => {
												if (res.locals.message !== "") {
													var message = res.locals.message;
													res.locals.message = "";
												} else {
													var message = "That's a like!";
												}
												res.send({status: 'success', user: user, message: message});
											});
										});
									}
								});
							}
						}
					});
				}
			}
		}
	});
});

router.delete("/:id/ajaxdislike", middleware.isLoggedIn, middleware.isConnected, (req, res) => {
	User.findByIdAndUpdate(req.sanitize(req.params.id), {}, (err, user) => {
		if (err) {
			console.log(err);
			res.send({status: 'error', error: err});
		} else {
			if (req.user._id.toString() === user._id.toString()) {
				res.send({status: 'error', error: "Don't be so hard on yourself"});
			} else {
				var match = 0;
				var id = "";
				User.findById(req.sanitize(req.params.id)).populate('likes').exec((err, userlikes) => {
					if (err) {
						console.log(err);
						res.send({status: 'error', error: err});
					} else {
						userlikes.likes.forEach((like) => {
							if (like.id.toString() === req.user._id.toString()) {
								match = 1;
								id = like._id.toString();
							}
						});
						if (match) {
							Likes.findByIdAndDelete(id, (err) => {
								if (err) {
									console.log(err);
									res.send({status: 'error', error: err});
								} else {
									Dislikeslog.create({}, (err, dislike) => {
										if (err) {
											console.log(err);
											res.send({status: 'error', error: err});
										} else {
											dislike.id = req.user._id;
											dislike.save();
										}
										user.dislikeslog.push(dislike);
										user.likes.pull(id);
										user.save();
										res.send({status: 'success', user: user});
									});
								}
							});
						} else {
							res.send({status: 'error', error: "Like this account first!!!"});
						}
					}
				});
			}
		}
	});
});
// router.put("/:id/like", middleware.isLoggedIn, (req, res) => {
// 	User.findByIdAndUpdate(req.sanitize(req.params.id), {}, (err, user) => {
// 		if (err) {
// 			req.flash("error", "Something went wrong(" + err.message + ").");
// 			console.log(err);
// 			res.redirect("back");
// 		} else {
// 			if (req.user._id.toString() === user._id.toString()) {
// 				req.flash("error", "You can't 'like' you own profile");
// 				return res.redirect("back");
// 			} else {
// 				var match = 0;

// 				User.findById(req.sanitize(req.params.id)).populate('likes').exec((err, userlikes) => {
// 					if (err) {
// 						req.flash("error", "Something went wrong(" + err.message + ").");
// 						console.log(err);
// 						res.redirect("back");
// 					} else {
// 						userlikes.likes.forEach((like) => {
// 							if (like.id.toString() === req.user._id.toString()) {
// 								match = 1;
// 							}
// 						});
// 						if (match) {
// 							req.flash("success", "This person already knows about your sympathy!");
// 							return res.redirect("back");
// 						} else {
// 							Likes.create({}, (err, like) => {
// 								if (err) {
// 									req.flash("error", "Something went wrong(" + err.message + ").");
// 									console.log(err);
// 									res.redirect("back");
// 								} else {
// 									like.id = req.user._id;
// 									like.save();

// 									Likeslog.create({}, (err, likelog) => {
// 										if (err) {
// 											req.flash("error", "Something went wrong(" + err.message + ").");
// 											console.log(err);
// 											res.redirect("back");
// 										} else {
// 											likelog.id = req.user._id;
// 											likelog.save();
// 										}
// 										user.likeslog.push(likelog);
// 										user.likes.push(like);
// 										user.save(() => {
// 											req.flash("success", "That's a like!");
// 											res.redirect("back");
// 										});
// 									});
// 								}
// 							});
// 						}
// 					}
// 				});
// 			}
// 		}
// 	});
// });

// router.delete("/:id/dislike", middleware.isLoggedIn, (req, res) => {
// 	User.findByIdAndUpdate(req.sanitize(req.params.id), {}, (err, user) => {
// 		if (err) {
// 			req.flash("error", "Something went wrong(" + err.message + ").");
// 			console.log(err);
// 			res.redirect("back");
// 		} else {
// 			if (req.user._id.toString() === user._id.toString()) {
// 				req.flash("error", "Don't be so hard on yourself!");
// 				return res.redirect("back");
// 			} else {
// 				var match = 0;
// 				var id = "";
// 				User.findById(req.sanitize(req.params.id)).populate('likes').exec((err, userlikes) => {
// 					if (err) {
// 						req.flash("error", "Something went wrong(" + err.message + ").");
// 						console.log(err);
// 						res.redirect("back");
// 					} else {
// 						userlikes.likes.forEach((like) => {
// 							if (like.id.toString() === req.user._id.toString()) {
// 								match = 1;
// 								id = like._id.toString();
// 							}
// 						});
// 						if (match) {
// 							Likes.findByIdAndDelete(id, (err) => {
// 								if (err) {
// 									req.flash("error", "Something went wrong(" + err.message + ").");
// 									console.log(err);
// 									res.redirect("back");
// 								} else {
// 									Dislikeslog.create({}, (err, dislike) => {
// 										if (err) {
// 											req.flash("error", "Something went wrong(" + err.message + ").");
// 											console.log(err);
// 											res.redirect("back");
// 										} else {
// 											dislike.id = req.user._id;
// 											dislike.save();
// 										}
// 										user.dislikeslog.push(dislike);
// 										user.likes.pull(id);
// 										user.save();
// 										req.flash("success", "As you wish! You don't like this person anymore!");
// 										return res.redirect("back");
// 									});
// 								}
// 							});
// 						} else {
// 							req.flash("success", "Like this account first!");
// 							return res.redirect("back");
// 						}
// 					}
// 				});
// 			}
// 		}
// 	});
// });

router.get("/:id/activity", middleware.checkProfileOwnership, (req, res) => {
	User.findById(req.sanitize(req.params.id))
	.populate({path: 'likes', populate: {path: 'id'}})
	.populate({path: 'visits', populate: {path: 'id'}})
	.populate({path: 'likeslog', populate: {path: 'id'}})
	.populate({path: 'dislikeslog', populate: {path: 'id'}})
	.exec((err, user) => {
				res.render("activity", {user: user});
	});
});

module.exports = router;
