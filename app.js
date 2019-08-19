const dotenv = require("dotenv").config();
console.log(dotenv.parsed);
const express = require('express'),
	app = express(),
	bodyParser = require("body-parser"),
	mongoose = require("mongoose"),
	DateOnly = require('mongoose-dateonly')(mongoose),
	User = require("./models/user"),
	Likes = require("./models/likes"),
	Messages = require("./models/message"),
	Notifications = require("./models/notifications"),
	Conversations = require("./models/conversations"),
	Dislikeslog = require("./models/dislikeslog"),
	Token = require("./models/token"),
	passport = require("passport"),
	localStrategy = require("passport-local"),
	passportLocalMongoose = require("passport-local-mongoose"),
	methodOverride = require("method-override"),
	flash = require("connect-flash"),
	moment = require("moment"),
	expressSanitizer = require('express-sanitizer'),
	nodemailer = require("nodemailer"),
	crypto = require("crypto"),
	async = require("async"),
		iplocate = require('node-iplocate'),
		seed = require("./seed"),
		http = require('http'),
		socketio = require('socket.io'),
		passportSocketIo = require('passport.socketio'),
		cookieParser = require('cookie-parser'),
		session = require('express-session'),
		redis = require('redis'),
		redisStore = require('connect-redis')(session),
		server = http.Server(app),
		io = socketio(server),
		redisClient = redis.createClient(),
		xss = require("xss"),
		FortyTwoStrategy = require('passport-42').Strategy,
		NodeGeocoder = require('node-geocoder'),
		GitHubStrategy = require('passport-github').Strategy;

var options = {
	provider: 'google',
	httpAdapter: 'https',
	apiKey: process.env.GEOCODER_API_KEY,
	formatter: null
};
var geocoder = NodeGeocoder(options);

const sessionStore = new redisStore({
	host: 'localhost',
	port: process.env.REDIS_PORT,
	client: redisClient,
	ttl: process.env.REDIS_TTL
});

redisClient.on('error', (err) => {
	console.log('Redis error: ', err);
});

// requiring routes from ./routes folder
const authRoutes = require("./routes/index"),
	feedRoutes = require("./routes/feed"),
	likesRoutes = require("./routes/likes"),
	profileRoutes = require("./routes/profile");
fakenblockRoutes = require("./routes/fakenblock");
notificationsRoutes = require("./routes/notifications");
chatRoutes = require("./routes/chat");

// databse connection
mongoose.connect("mongodb://localhost/matcha", {
	useNewUrlParser: true,
	useFindAndModify: false,
	useCreateIndex: true,
	autoIndex: true
});

// mongoose.set('debug', true);

app.set("view engine", "ejs"); //no need to write .ejs in the end of the file name
app.use(bodyParser.urlencoded({
	extended: true
}));

app.use(session({ //session initializer
	store: sessionStore,
	cookie: {
		secure: false
	},
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: true
}));

io.use(passportSocketIo.authorize({
	key: 'connect.sid',
	secret: process.env.SESSION_SECRET,
	store: sessionStore,
	passport: passport,
	cookieParser: cookieParser
}));

app.use(expressSanitizer());

app.use(flash());
app.use(express.static("public")); // including .css files directory here
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));

passport.use(new localStrategy(User.authenticate()));
passport.use(new FortyTwoStrategy({
		clientID: process.env.ECOLE_42_CLIENT_ID,
		clientSecret: process.env.ECOLE_42_CLIENT_SECRET,
		callbackURL: "http://localhost:3000/auth/42/callback"
	},
	function (accessToken, refreshToken, profile, cb) {
		User.find({
			intra_id: profile._json.id
		}, (err, user) => {
			if (err) {
				console.log(err);
				return cb(err);
			}
			//user is not found
			if (user.length == 0) {
				var userLocation = {
					latitude: "",
					longitude: "",
					city: ""
				};
				geocoder.geocode(profile._json.campus[0].time_zone, (err, res) => {
					userLocation = {
						latitude: res[0].latitude,
						longitude: res[0].longitude,
						city: res[0].city
					}
					user = new User({
						intra_id: profile._json.id,
						isVerified: true,
						username: profile._json.login,
						email: profile._json.email,
						lastname: profile._json.last_name,
						firstname: profile._json.first_name,
						pictures: [{
							url: profile._json.image_url,
							isProfile: true
						}],
						reallocationname: userLocation.city,
						reallocation: {
							type: "Point",
							coordinates: [Number(userLocation.longitude), Number(userLocation.latitude)]
						},
						locationname: userLocation.city,
						location: {
							type: "Point",
							coordinates: [Number(userLocation.longitude), Number(userLocation.latitude)]
						},
						hasLocation: true,
						interests: [{
								text: "dating"
							},
							{
								text: 'coding'
							}
						]
					});
					user.save((err) => {
						if (err) {
							console.log(err);
							return cb(err);
						} else {
							return cb(err, user)
						}
					});
				});
			} else {
				//user is found!!!
				return cb(err, user[0]);
			}
		});
	}
));

passport.use(new GitHubStrategy({
		clientID: process.env.GIT_CLIENT_ID,
		clientSecret: process.env.GIT_CLIENT_SECRET,
		callbackURL: "http://localhost:3000/auth/github/callback"
	},
	function (accessToken, refreshToken, profile, cb) {
		User.find({
			github_id: profile._json.id
		}, (err, user) => {
			if (err) {
				console.log(err);
				return cb(err);
			}
			//user is not found
			if (user.length == 0) {
				var userLocation = {
					latitude: "",
					longitude: "",
					city: ""
				};
				user = new User({
					github_id: profile.id,
					isVerified: true,
					username: profile._json.login,
					lastname: profile._json.name,
					firstname: profile._json.name,
					pictures: [{
						url: profile._json.avatar_url ? profile._json.avatar_url : "https://image.flaticon.com/icons/svg/25/25231.svg",
						isProfile: true
					}],
					hasLocation: false,
					interests: [{
							text: "dating"
						},
						{
							text: 'coding'
						}
					],
				});
				user.location = undefined;
				user.reallocation = undefined;
				user.save((err) => {
					if (err) {
						console.log(err);
						return cb(err);
					} else {
						return cb(err, user)
					}
				});
			} else {
				//user is found!!!
				return cb(err, user[0]);
			}
		});
	}
));

passport.serializeUser((user, done) => {
	done(null, user);
});
passport.deserializeUser((user, done) => {
	User.findById(user._id).populate('blockedUsers').exec((err, user) => {
		done(err, user);
	});
});

// allows using current user data across all the views
app.use((req, res, next) => {
	res.locals.oauth = false;
	res.locals.message = "";
	res.locals.currentUser = req.user;
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	next();
});

app.locals.moment = require('moment');

//including routes from the ./routes folder
app.use(authRoutes);
app.use("/profile", profileRoutes);
app.use("/likes", likesRoutes);
app.use("/feed", feedRoutes);
app.use("/fakenblock", fakenblockRoutes);
app.use(notificationsRoutes);
app.use(chatRoutes);

app.get('*', (req, res) => {
	res.render('error');
})

// seed("Male", 5);
// seed("Female", 5);
// seed("Bi-Sexual", 5);


var eventSocket = io.of('/events');
var onlineUsers = [];
module.exports.eventSocket = eventSocket;
// on connection event
eventSocket.on('connection', (socket) => {
	if (socket.request.user && socket.request.user.logged_in) {
		onlineUsers.push(socket.request.user);
		console.log(socket.request.user.username + " connected");
	}
	eventSocket.emit('broadcast', {
		onlineUsers: onlineUsers
	});

	socket.on('connectToRoom', socketId => {
		console.log(socket.request.user.username + " connected to the socket: " + socketId);
		var mySocketId = xss(socketId);
		socket.join(mySocketId);
	});

	socket.on('new income notification', (socketId, users_info) => {
		if (users_info.visitor !== users_info.visited_one) {
			Notifications.create({
				n_type: users_info.n_type,
				for_who: users_info.visited_one,
				from_whom: users_info.visitor,
				conversationID: users_info.conversationID ? users_info.conversationID : ""
			}, (err, newNotification) => {
				if (err || !newNotification) {
					console.log(err);
				} else {
					User.findById(users_info.visited_one, (err, foundUser) => {
						if (err) console.log(err);
						else {
							foundUser.notifications.push(newNotification);
							if (!foundUser.hasLocation) {
								foundUser.location = undefined;
							}
							if (!foundUser.reallocation.coordinates[0]) {
								foundUser.reallocation = undefined;
							}
							foundUser.save((err) => {
								if (err) console.log(err);
							});
							User.findById(users_info.visitor, (err, foundVisitor) => {
								if (err) {
									console.log(err);
								} else {
									socket.broadcast.to(socketId).emit('new notification', {
										foundVisitorID: foundVisitor._id,
										foundVisitorUsername: foundVisitor.username,
										notificationID: newNotification._id,
										n_type: users_info.n_type
									});
								}
							});
						}
					});
				}
			});
		}
	});

	socket.on('disconnect', () => {
		var leftUser = {};
		for (var i = 0; i < onlineUsers.length; i++) {
			if (onlineUsers[i]._id.toString() === socket.request.user._id.toString()) {
				User.findByIdAndUpdate(socket.request.user._id, {
					lastseen: Date.now()
				}, (err, user) => {
					if (err) {
						console.log(err);
					} else {
						console.log(socket.request.user.username + " disconnected");
						leftUser = user;
					}
				});
				onlineUsers.splice(i, 1);
			}
		}
		eventSocket.emit('broadcast', {
			onlineUsers: onlineUsers,
			leftUser: leftUser
		});
	});
});

//

var chatSocket = io.of('/chat');
var currentRoom = "";
chatSocket.on('connection', socket => {
	console.log(socket.request.user.username + " connected to the chat");
	socket.on('disconnect', () => {
		console.log(socket.request.user.username + " disconnected from the chat");
	});
	socket.on('connectToRoom', room => {
		console.log(socket.request.user.username + " connected to the conversation " + room);
		currentRoom = xss(room);
		socket.join(currentRoom);
		socket.broadcast.to(currentRoom).emit("read", {});
	});
	socket.on("chat message", (room, msg, fn) => {
		var message = xss(msg.message);
		var authorName = xss(msg.authorName);
		var authorId = xss(msg.authorId);
		var recipientID = xss(msg.recipientID)
		var roomParticipants = socket.adapter.rooms[room];
		var onlineToggle = roomParticipants.length === 1 ? false : true;
		var onlineNBlockedToggle = {
			onlineToggle: onlineToggle,
			isBlocked: false,
			error: false,
			erorrMessage: ""
		}
		console.log("message: " + message);
		User.findById(recipientID)
			.populate('blockedUsers')
			.exec((err, recipientUser) => {
				if (err || !recipientUser) {
					console.log(err);
					onlineNBlockedToggle.error = true;
					onlineNBlockedToggle.message = err.message;
					fn(onlineNBlockedToggle);
				} else {
					// checking if we are not blocked by the recipient of the message
					var filteredUsers = recipientUser.blockedUsers.filter(blockedUser => blockedUser.id.toString() === authorId.toString());
					if (filteredUsers.length > 0) {
						console.log("You are blocked!");
						onlineNBlockedToggle.isBlocked = true;
						fn(onlineNBlockedToggle);
					} else {
						// everything's fine, procceding!
						fn(onlineNBlockedToggle); //returning toggle so the message is drawn in the chat or not. chat is open -> drawing the message; chat is not open -> not drawing
						//broadcast message to everyone in the room
						socket.broadcast.to(room).emit("received", {
							message: message,
							user: authorName,
							conversationId: currentRoom,
							isOnline: onlineToggle
						});
						// creating and emiting of a new notification!!!
						if (!onlineToggle && authorId !== recipientID) {
							var users_info = {
								visitor: authorId,
								visited_one: recipientID,
								n_type: 'message',
								conversationID: currentRoom
							}
							Notifications.create({
								n_type: users_info.n_type,
								for_who: users_info.visited_one,
								from_whom: users_info.visitor,
								conversationID: users_info.conversationID
							}, (err, newNotification) => {
								if (err || !newNotification) {
									console.log(err);
									onlineNBlockedToggle.error = true;
									onlineNBlockedToggle.message = err.message;
									fn(onlineNBlockedToggle);
								} else {
									// console.log("Notification created!!! Adding it to the user's profile!!");
									User.findById(users_info.visited_one, (err, foundUser) => {
										if (err || !foundUser) {
											console.log(err);
											onlineNBlockedToggle.error = true;
											onlineNBlockedToggle.message = err.message;
											fn(onlineNBlockedToggle);
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
													onlineNBlockedToggle.error = true;
													onlineNBlockedToggle.message = err.message;
													fn(onlineNBlockedToggle);
												} else {
													// console.log("everything's fine! emiting notification with a socket!!!");
													User.findById(users_info.visitor, (err, foundVisitor) => {
														if (err) {
															console.log(err);
															onlineNBlockedToggle.error = true;
															onlineNBlockedToggle.message = err.message;
															fn(onlineNBlockedToggle);
														} else {
															io.of('/events').to(recipientID).emit('new notification', {
																foundVisitorID: foundVisitor._id,
																foundVisitorUsername: foundVisitor.username,
																notificationID: newNotification._id,
																conversationID: users_info.conversationID,
																n_type: 'message'
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
						socket.broadcast.emit('new message notification', {
							message: message,
							user: authorName,
							conversationId: currentRoom,
							userId: authorId
						});
						//save chat to the database
						Messages.create({
								conversationId: currentRoom,
								body: message,
								sentBy: authorId,
								isRead: onlineToggle
							},
							err => {
								if (err) {
									console.log(err);
									onlineNBlockedToggle.error = true;
									onlineNBlockedToggle.message = err.message;
									fn(onlineNBlockedToggle);
								} else {
									// SAVING LAST MESSAGE AUTHOR AND THE MESAGE ITSELF RO THE CONVERSATION TO DISPLAY IT ON THE CONVERSATIONS PAGE
									Conversations.findByIdAndUpdate(currentRoom, {
											lastMessage: message,
											lastMessageAuthor: authorId
										},
										err => {
											if (err) {
												console.log(err);
												onlineNBlockedToggle.error = true;
												onlineNBlockedToggle.message = err.message;
												fn(onlineNBlockedToggle);
											}
										});
								}
							});
					}
				}
			});
	});
});

let port = process.env.PORT;
if (port == null || port == "") {
	port = 3000;
}
server.listen(port, process.env.IP, () => {
	console.log("Setup is done, Sir!");
});
