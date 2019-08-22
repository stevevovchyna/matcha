const express = require("express");
const app = express();
const router = express.Router({
	mergeParams: true
});
const passport = require("passport");
const User = require("../models/user");
const Likes = require("../models/likes");
const Dislikeslog = require("../models/dislikeslog");
const Notifications = require("../models/notifications");
const Likeslog = require("../models/likeslog");
const Visits = require("../models/visits");
const middleware = require("../middleware");
const _ = require('lodash');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const mainFileImport = require('../app.js');

router.put("/:id/ajaxlike", middleware.isLoggedIn, middleware.haveLikedMe, (req, res) => {
	User.findById(req.sanitize(req.params.id))
		.populate('blockedUsers')
		.exec((err, user) => {
			if (req.user.pictures.length === 0) {
				res.send({
					status: 'error',
					error: "Please add a picture to your profile first!"
				});
			} else {
				if (err || !user) {
					console.log(err);
					res.send({
						status: 'error',
						error: err.message
					});
				} else {
					// checking if user has blocked us
					var blocked = user.blockedUsers.filter(user => user.id.toString() === req.user._id.toString());
					if (req.user._id.toString() === user._id.toString()) {
						res.send({
							status: 'error',
							error: "You can't 'like' your own profile"
						});
					} else if (blocked.length > 0) {
						res.send({
							status: 'error',
							error: "You can't like this user as he/she has blocked you"
						});
					} else {
						User.findById(req.sanitize(req.params.id)).populate('likes').exec((err, userlikes) => {
							if (err) {
								console.log(err);
								res.send({
									status: 'error',
									error: err
								});
							} else {
								var foundLikes = userlikes.likes.filter(like => like.liker_id.toString() === req.user._id.toString());
								if (foundLikes.length === 0) {
									//new like is being created
									Likes.create({
										liker_id: req.user._id,
										liked_one_id: req.params.id
									}, (err, like) => {
										if (err) {
											console.log(err);
											res.send({
												status: 'error',
												error: err
											});
										} else {
											Likeslog.create({
												liker_id: req.user._id,
												liked_one_id: req.params.id
											}, (err, likelog) => {
												if (err) {
													console.log(err);
													res.send({
														status: 'error',
														error: err
													});
												} else {
													user.likeslog.push(likelog);
													user.likes.push(like);
													if (!user.hasLocation) {
														user.location = undefined;
													}
													if (!user.reallocation.coordinates[0]) {
														user.reallocation = undefined;
													}
													// liked user gets  a new like in the Likes array and new likelog entry in the Likelogs
													user.save((err) => {
														if (err) {
															console.log(err);
															res.send({
																status: 'error',
																error: err.message
															});
														} else {
															if (res.locals.message !== "") {
																var n_type = 'mutual_like';
																var message = res.locals.message;
																res.locals.message = "";
															} else {
																var n_type = 'like';
																var message = "That's a like!";
																res.locals.message = "";
															}
															User.findById(req.user._id, (err, liker_user) => {
																if (err || !liker_user) {
																	console.log(err);
																	res.send({
																		status: 'error',
																		error: err.message
																	});
																} else {
																	liker_user.mylikeslog.push(likelog);
																	liker_user.myLikes.push(like);
																	if (!liker_user.hasLocation) {
																		liker_user.location = undefined;
																	}
																	if (!liker_user.reallocation.coordinates[0]) {
																		liker_user.reallocation = undefined;
																	}
																	// user who liked gets an entry in the 'myLikes' field and in the 'mylikeslog' field
																	liker_user.save((err) => {
																		if (err) {
																			console.log(err);
																			res.send({
																				status: 'error',
																				error: err.message
																			});
																		} else {
																			// CREATING A NEW NOTIFICATION
																			var users_info = {
																				visitor: req.user._id,
																				visited_one: req.params.id,
																				n_type: n_type,
																			}
																			Notifications.create({
																				n_type: users_info.n_type,
																				for_who: users_info.visited_one,
																				from_whom: users_info.visitor,
																			}, (err, newNotification) => {
																				if (err) {
																					console.log(err);
																					res.send({
																						status: 'error',
																						error: err.message
																					});
																				} else {
																					// PUSHING A NEW NOTIFICATION TO THE USER'S PROFILE
																					User.findById(users_info.visited_one, (err, foundUser) => {
																						if (err) {
																							console.log(err);
																							res.send({
																								status: 'error',
																								error: err.message
																							});
																						} else {
																							foundUser.notifications.push(newNotification);
																							if (!foundUser.hasLocation) {
																								foundUser.location = undefined;
																							}
																							if (!foundUser.reallocation.coordinates[0]) {
																								foundUser.reallocation = undefined;
																							}
																							foundUser.save((err) => {
																								if (err) {
																									console.log(err);
																								} else {
																									// EMITING A NOTIFICATION TO THE USER
																									mainFileImport.eventSocket.to(req.params.id).emit('new notification', {
																										foundVisitorID: req.user._id,
																										foundVisitorUsername: req.user.username,
																										notificationID: newNotification._id,
																										n_type: users_info.n_type
																									});
																									res.send({
																										status: 'success',
																										user: user,
																										message: message
																									});
																								}
																							});
																						}
																					});
																				}
																			});
																		}
																	});
																}
															});
														}
													});
												}
											});
										}
									});
								} else {
									res.send({
										status: 'error',
										error: "This person already knows about your sympathy",
										user: userlikes
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
	User.findById(req.sanitize(req.params.id))
		.populate('blockedUsers')
		.exec((err, user) => {
			if (err || !user) {
				console.log(err);
				res.send({
					status: 'error',
					error: err ? err.message : "Seems like there's an invalid address!"
				});
			} else {
				// checking if user has blocked us
				var blocked = user.blockedUsers.filter(user => user.id.toString() === req.user._id.toString());
				if (req.user._id.toString() === user._id.toString()) {
					res.send({
						status: 'error',
						error: "Don't be so hard on yourself"
					});
				} else if (blocked.length > 0) {
					res.send({
						status: 'error',
						error: "You can't dislike this user as he/she has blocked you"
					});
				} else {
					User.findById(req.sanitize(req.params.id)).populate('likes').exec((err, userlikes) => {
						if (err) {
							console.log(err);
							res.send({
								status: 'error',
								error: err
							});
						} else {
							var foundLikes = userlikes.likes.filter(like => like.liker_id.toString() === req.user._id.toString());
							if (foundLikes.length === 1) {
								var id = foundLikes[0]._id;
								// corresponding like is being deleted
								Likes.findByIdAndDelete(id, (err) => {
									if (err) {
										console.log(err);
										res.send({
											status: 'error',
											error: err
										});
									} else {
										// creating corresponding entry in the dislikeslog
										Dislikeslog.create({
											disliker_id: req.user._id,
											disliked_one_id: req.params.id
										}, (err, dislikelog) => {
											if (err) {
												console.log(err);
												res.send({
													status: 'error',
													error: err
												});
											} else {
												//a new entry in the 'dislikeslog' is being created
												user.dislikeslog.push(dislikelog);
												user.likes.pull(id);
												if (!user.hasLocation) {
													user.location = undefined;
												}
												if (!user.reallocation.coordinates[0]) {
													user.reallocation = undefined;
												}
												// disliked user has a new entry in the 'dislikeslog' field and an old like is being deleted
												user.save((err) => {
													if (err) {
														console.log(err);
														res.send({
															status: 'error',
															error: err.message
														});
													} else {
														// user that dislikes gets his data updated
														User.findById(req.user._id, (err, disliking_user) => {
															if (err) {
																console.log(err);
																res.send({
																	status: 'error',
																	error: err.message
																});
															} else {
																disliking_user.mydislikeslog.push(dislikelog);
																disliking_user.myLikes.pull(id);
																if (!disliking_user.hasLocation) {
																	disliking_user.location = undefined;
																}
																if (!disliking_user.reallocation.coordinates[0]) {
																	disliking_user.reallocation = undefined;
																}
																// disliking user gets a new entry about the dislike and his like is being deleted from the db
																disliking_user.save((err) => {
																	if (err) {
																		console.log(err);
																		res.send({
																			status: 'error',
																			error: err.message
																		});
																	} else {
																		if (res.locals.message === "mutual_dislike") {
																			var users_info = {
																				visitor: req.user._id,
																				visited_one: req.params.id,
																				n_type: 'mutual_dislike',
																			}
																			res.locals.message = "";
																			Notifications.create({
																				n_type: users_info.n_type,
																				for_who: users_info.visited_one,
																				from_whom: users_info.visitor,
																			}, (err, newNotification) => {
																				if (err) {
																					console.log(err);
																					res.send({
																						status: 'error',
																						error: err.message
																					});
																				} else {
																					// PUSHING A NEW NOTIFICATION TO THE USER'S PROFILE
																					User.findById(users_info.visited_one, (err, foundUser) => {
																						if (err) {
																							console.log(err);
																							res.send({
																								status: 'error',
																								error: err.message
																							});
																						} else {
																							foundUser.notifications.push(newNotification);
																							if (!foundUser.hasLocation) {
																								foundUser.location = undefined;
																							}
																							if (!foundUser.reallocation.coordinates[0]) {
																								foundUser.reallocation = undefined;
																							}
																							foundUser.save((err) => {
																								if (err) {
																									console.log(err);
																									res.send({
																										status: 'error',
																										error: err.message
																									});
																								} else {
																									// EMITING A NOTIFICATION TO THE USER
																									mainFileImport.eventSocket.to(req.params.id).emit('new notification', {
																										foundVisitorID: req.user._id,
																										foundVisitorUsername: req.user.username,
																										notificationID: newNotification._id,
																										n_type: users_info.n_type
																									});
																									res.send({
																										status: 'success',
																										user: user
																									});
																								}
																							});
																						}
																					});
																				}
																			});
																		} else {
																			res.send({
																				status: 'success',
																				user: user
																			});
																		}
																	}
																});
															}
														});
													}
												});
											}
										});
									}
								});
							} else {
								res.send({
									status: 'error',
									error: "Like this account first!!!"
								});
							}
						}
					});
				}
			}
		});
});

router.get("/:id/activity", middleware.checkProfileOwnership, (req, res) => {
	User.findById(req.sanitize(req.params.id))
		.populate({
			path: 'likes',
			populate: {
				path: 'liked_one_id, liker_id'
			}
		})
		.populate({
			path: 'myLikes',
			populate: {
				path: 'liker_id, liked_one_id'
			}
		})
		.populate({
			path: 'visits',
			populate: {
				path: 'profile_id, visitor_id'
			}
		})
		.populate({
			path: 'myVisits',
			populate: {
				path: 'visitor_id, profile_id'
			}
		})
		.populate({
			path: 'likeslog',
			populate: {
				path: 'liked_one_id, liker_id'
			}
		})
		.populate({
			path: 'mylikeslog',
			populate: {
				path: 'liker_id, liked_one_id'
			}
		})
		.populate({
			path: 'dislikeslog',
			populate: {
				path: 'disliked_one_id, disliker_id'
			}
		})
		.populate({
			path: 'mydislikeslog',
			populate: {
				path: 'disliker_id, disliked_one_id'
			}
		})
		.exec((err, user) => {
			if (err || !user) {
				console.log(err);
				req.flash('error', "No activity found");
				res.redirect('back');
			} else {
				res.render("activity", {
					user: user
				});
			}
		});
});

module.exports = router;
