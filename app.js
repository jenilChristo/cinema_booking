const http = require('http');
const express = require('express');
const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);
const mysql = require('mysql');

//Create mysql connection object
const myconn = mysql.createConnection({
	host: "localhost",
	user: "user",
	password: "password",
	database: "cinema_ticket"
});

//Connect to mysql server
myconn.connect(function (err) {
	if (err) {
		console.log('Error connecting to database'+ err);
	}
	else {
		console.log('Connection established');
	}
});

//Start Node server on port 8000
app.set('port', process.env.PORT || 8000);
server.listen(app.get('port'), function () {
	console.log('server listening at' + app.get('port'));
});

//Public assets path
app.use("/gentelella-master", express.static(__dirname + '/gentelella-master'));

//Initial render
app.get('/', function (req, res) {
	res.sendFile(__dirname + '/booking-show.html');
});

//Util to update seats after a booking is done
function update_seats() {
	myconn.query("select * from booking", function (err, row) {
		if (!err) {
			io.emit('seats_left', (45 - row.length));
			for (i = 0; i < row.length; i++) {
				io.emit('booked', { seat: row[i].seat, status: row[i].status });
			}
		}
		else {
			console.log('cannot fetch results');
		}
	});
}

//Util to clear seats for a new show
function clear_seats() {
	myconn.query("delete from booking", function (err, row) {
		if (!err) {
			io.emit('seats_left', 45);
			io.emit('booked', { status: 100 });
		}
		else {
			console.log('cannot fetch results');
		}
	});
}

//Websockets handler
io.on('connection', function (socket) {
	//update seats for user
	update_seats();

	//book_seat event from the client
	socket.on('book_seat', function (data) {
		let seat_id = data;

		//insert seat id and status into booking table
		myconn.query("insert into booking(seat,status) values(?,?)", [seat_id, '1'],
			function (error, rows, fields) {
				if (!error) {
					update_seats();
					let last_row = rows.insertId; 
					// get the results after inserting a booking and emit to the client to show updated status.
					myconn.query("select * from booking where id=?", [last_row], function (er1, ro1) {
						if (!er1) {
							for (i = 0; i < ro1.length; i++) {
								io.emit('booked', { seat: ro1[i].seat, status: ro1[i].status });
							}
						}
						else {
							console.log('cannot fetch results');
						}
					});
				}
				else {
					console.log(error);
				}
			});
	});

	//New show event is emitted when a new show is started
	socket.on('new_show', function () {
		//clear all seats for booking new show
		clear_seats();
	});
});

