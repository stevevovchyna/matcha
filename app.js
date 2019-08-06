require("dotenv").config();

const express = 		require('express'),
app =		 			express(),
bodyParser = 			require("body-parser"),
mongoose = 				require("mongoose"),
User = 					require("./models/user"),
Likes = 				require("./models/likes"),
Messages = 				require("./models/message"),
Notifications = 		require("./models/notifications"),
Conversations = 		require("./models/conversations"),
Dislikeslog = 			require("./models/dislikeslog"),
Token = 				require("./models/token"),
passport = 				require("passport"),
localStrategy = 		require("passport-local"),
passportLocalMongoose = require("passport-local-mongoose"),
methodOverride = 		require("method-override"),
flash = 				require("connect-flash"),
moment =        		require("moment"),
expressSanitizer = 		require('express-sanitizer'),
assert = 				require('assert'),
nodemailer = 			require("nodemailer"),
crypto = 				require("crypto"),
async = 				require("async"),
iplocate = 				require('node-iplocate'),
seed = 					require("./seed"),
http = 					require('http'),
socketio = 				require('socket.io'),
passportSocketIo = 		require('passport.socketio'),
cookieParser = 			require('cookie-parser'),
session = 				require('express-session'),
redis = 				require('redis'),
redisStore = 			require('connect-redis')(session),
server = 				http.Server(app),
io = 					socketio(server),
redisClient = 			redis.createClient(),
xss = 					require("xss"),
FortyTwoStrategy = 		require('passport-42').Strategy;

const NodeGeocoder = 	require('node-geocoder');

var options = {
	provider: 'google',
	httpAdapter: 'https',
	apiKey: 'AIzaSyBxM1Dxy_gcBhgoCKoSAgfCL6TjwGf2dQE',
	formatter: null
};
var geocoder = NodeGeocoder(options);

const sessionStore = new redisStore({ host: 'localhost', port: 6379, client: redisClient, ttl: 86400 });

redisClient.on('error', (err) => {
	console.log('Redis error: ', err);
});

// requiring routes from ./routes folder
const authRoutes = require("./routes/index"),
feedRoutes = require("./routes/feed"),
likesRoutes = require("./routes/likes"),
profileRoutes = require("./routes/profile");
fakenblockRoutes = require("./routes/fakenblock");
chatRoutes = require("./routes/chat");

// databse connection
mongoose.connect("mongodb://localhost/matcha", {useNewUrlParser: true, useFindAndModify: false, useCreateIndex: true});

app.set("view engine", "ejs"); //no need to write .ejs in the end of the file name
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({ //session initializer
	store: sessionStore,
	cookie: { secure: false },
	secret: "I love Kate",
	resave: false,
	saveUninitialized: true
}));

io.use(passportSocketIo.authorize({
	key: 'connect.sid',
	secret: "I love Kate",
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
		clientID: '738c8f86020f7a4b67ed7f77a01425d699fd61cb5189339b5f537d777b1c5d63',
		clientSecret: '57efff68ef25910a11c8af0f3e86fc12d8911f72bae9a58af691d450482122ce',
		callbackURL: "http://localhost:3000/auth/42/callback"
	},
	function (accessToken, refreshToken, profile, cb) {
		User.find({intra_id: profile._json.id}, (err, user) => {
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
						}
					});
					user.save((err) => {
						if (err) console.log(err);
						return cb(err, user)
					});
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
app.use(chatRoutes);

// seed("Male");
// seed("Female");
// seed("Bi-Sexual");

var eventSocket = io.of('/events');
var onlineUsers = [];
// on connection event
eventSocket.on('connection', (socket) => {
	if (socket.request.user && socket.request.user.logged_in) {
		onlineUsers.push(socket.request.user);
		console.log(socket.request.user.username + " connected");
	}	
	eventSocket.emit('broadcast', onlineUsers);

	socket.on('connectToRoom', socketId => {
		console.log(socket.request.user.username + " connected to the socket: " + socketId);
		var mySocketId = xss(socketId);
		socket.join(mySocketId);
	});

	socket.on('new visit', (socketId, users_info) => {
		console.log("Ther's some movement in the " + socketId);
		if (users_info.visitor !== users_info.visited_one) {
			Notifications.create({
				n_type: "visit",
				for_who: users_info.visited_one,
				from_whom: users_info.visitor
			}, (err, newNotification) => {
				if (err) console.log(err);
				else {
					User.findById(users_info.visited_one, (err, foundUser) => {
						if (err) console.log(err);
						else {
							foundUser.notifications.push(newNotification);
							foundUser.save((err) => {
								if (err) console.log(err);
							});
							console.log("everything's created!");
							User.findById(users_info.visitor, (err, foundVisitor) => {
								if (err) {
									console.log(err);
								} else {
									socket.broadcast.to(socketId).emit('new notification', { id: foundVisitor._id, username: foundVisitor.username});
								}
							})
						}
					})
				}
			});
		}
		console.log(users_info);
	});

	socket.on('disconnect', () => {
		for (var i = 0; i < onlineUsers.length; i++) {
			if (onlineUsers[i]._id.toString() === socket.request.user._id.toString()) {
				User.findByIdAndUpdate(socket.request.user._id, { lastseen: Date.now() }, (err, user) => {
					if (err) {
						console.log(err);
					} else {
						console.log(socket.request.user.username + " disconnected");
					}
				});
				onlineUsers.splice(i, 1);
			}
		}
		eventSocket.emit('broadcast', onlineUsers);
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
		var roomParticipants = socket.adapter.rooms[room];
		var onlineToggle = roomParticipants.length === 1 ? false : true;
		console.log("message: " + message);
		fn(onlineToggle);
		//broadcast message to everyone in the room
		socket.broadcast.to(room).emit("received", {
			message: message,
			user: authorName,
			conversationId: currentRoom,
			isOnline: onlineToggle
		});
		socket.broadcast.emit('new message notification', {
			message: message,
			user: authorName,
			conversationId: currentRoom,
			userId: authorId
		});
		// eventSocket.emit('newmessagenotification', {
		// 	message: message,
		// 	user: authorName,
		// 	conversationId: currentRoom,
		// 	userId: authorId
		// });

		//save chat to the database
		Messages.create({
			conversationId: currentRoom,
			body: message,
			sentBy: authorId,
			isRead: onlineToggle
		}, (err) => {
			if (err) {
				console.log(err);
			}
		});
		Conversations
		.findByIdAndUpdate(
			currentRoom,
			{
				lastMessage: message,
				lastMessageAuthor: authorId
			},
			err => {
				if (err) {
					console.log(err);
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
