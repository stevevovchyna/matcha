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
					User.findById(req.sanitize(req.params.id)).populate('likes').exec((err, userlikes) => {
						if (err) {
							res.send({status: 'error', error: err});
							console.log(err);
						} else {
							var foundLikes = userlikes.likes.filter(like => like.liker_id.toString() === req.user._id.toString());
							if (foundLikes.length === 0) {
								//new like is being created
								Likes.create({ liker_id: req.user._id, liked_one_id: req.params.id}, (err, like) => {
									if (err) {
										console.log(err);
										res.send({status: 'error', error: err});
									} else {
										Likeslog.create({ liker_id: req.user._id, liked_one_id: req.params.id }, (err, likelog) => {
											if (err) {
												console.log(err);
												res.send({status: 'error', error: err});
											} else {
												user.likeslog.push(likelog);
												user.likes.push(like);
												// liked user gets  a new like in the Likes array and new likelog entry in the Likelogs
												user.save(() => {
													if (res.locals.message !== "") {
														var message = res.locals.message;
														res.locals.message = "";
													} else {
														var message = "That's a like!";
														res.locals.message = "";
													}
													User.findById(req.user._id, (err, liker_user) => {
														liker_user.mylikeslog.push(likelog);
														liker_user.myLikes.push(like);
														// user who liked gets an entry in the 'myLikes' field and in the 'mylikeslog' field
														liker_user.save((err) => {
															if (err) console.log(err);
															res.send({status: 'success', user: user, message: message});
														})
													});
												});
											}
										});
									}
								});
							} else {
								res.send({status: 'error', error: "This person already knows about your sympathy", user: userlikes});
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
				User.findById(req.sanitize(req.params.id)).populate('likes').exec((err, userlikes) => {
					if (err) {
						console.log(err);
						res.send({status: 'error', error: err});
					} else {
						var foundLikes = userlikes.likes.filter(like => like.liker_id.toString() === req.user._id.toString());
						if (foundLikes.length === 1) {
							var id = foundLikes[0]._id;
							// corresponding like is being deleted
							Likes.findByIdAndDelete(id, (err) => {
								if (err) {
									console.log(err);
									res.send({status: 'error', error: err});
								} else {
									// creating corresponding entry in the dislikeslog
									Dislikeslog.create({ disliker_id: req.user._id, disliked_one_id: req.params.id }, (err, dislikelog) => {
										if (err) {
											console.log(err);
											res.send({status: 'error', error: err});
										} else {
											//a new entry in the 'dislikeslog' is being created
											user.dislikeslog.push(dislikelog);
											user.likes.pull(id);
											// disliked user has a new entry in the 'dislikeslog' field and an old like is being deleted
											user.save((err) => {
												if (err) console.log(err);
												// user that dislikes gets his data updated
												User.findById(req.user._id, (err, disliking_user) => {
													if (err) console.log(err);
													disliking_user.mydislikeslog.push(dislikelog);
													disliking_user.myLikes.pull(id);
													// disliking user gets a new entry about the dislike and his like is being deleted from the db
													disliking_user.save((err) => {
														if (err) console.log(err);
														res.send({status: 'success', user: user});
													});
												});
											});
										}
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

router.get("/:id/activity", middleware.checkProfileOwnership, (req, res) => {
	User.findById(req.sanitize(req.params.id))
	.populate({ path: 'likes', populate: {path: 'liked_one_id, liker_id' }})
	.populate({ path: 'myLikes', populate: {path: 'liker_id, liked_one_id' }})
	.populate({ path: 'visits', populate: {path: 'profile_id, visitor_id' }})
	.populate({ path: 'myVisits', populate: {path: 'visitor_id, profile_id' }})
	.populate({ path: 'likeslog', populate: { path: 'liked_one_id, liker_id' }})
	.populate({ path: 'mylikeslog', populate: { path: 'liker_id, liked_one_id' }})
	.populate({ path: 'dislikeslog', populate: { path: 'disliked_one_id, disliker_id' }})
	.populate({ path: 'mydislikeslog', populate: { path: 'disliker_id, disliked_one_id' }})
	.exec((err, user) => {
		res.render("activity", {user: user});
	});
});

module.exports = router;
